from __future__ import annotations

import importlib
import sys

from fastapi.testclient import TestClient


ALLOWLIST = """
systemd_units:
  - id: ssh
    name: ssh.service
    display_name: SSH Service
    actions: [status, logs, restart]
docker_containers:
  - id: rsp-api
    name: rsp-api
    display_name: RSP API
    actions: [status, logs, restart]
compose_projects:
  - id: demo-compose
    display_name: Demo Compose
    path: /tmp/demo-compose
    compose_file: docker-compose.yml
    actions: [ps, logs, restart]
"""

MALICIOUS_ALLOWLIST = """
compose_projects:
  - id: demo-compose
    display_name: Demo Compose
    path: /tmp/app
    compose_file: ../app2/docker-compose.yml
    actions: [ps, logs, restart]
"""


def build_client(tmp_path, monkeypatch) -> TestClient:
    allowlist = tmp_path / "allowlist.yaml"
    allowlist.write_text(ALLOWLIST, encoding="utf-8")
    data_dir = tmp_path / "data"
    data_dir.mkdir()

    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{data_dir / 'uocc.sqlite3'}")
    monkeypatch.setenv("ALLOWLIST_PATH", str(allowlist))
    monkeypatch.setenv("AGENT_MODE", "demo")
    monkeypatch.setenv("UOCC_ENV", "local")
    monkeypatch.setenv("UOCC_OPERATOR_TOKEN", "test-token")
    monkeypatch.setenv("UOCC_ALLOWED_ORIGINS", "http://127.0.0.1:3000")

    for name in list(sys.modules):
        if name == "uocc_api" or name.startswith("uocc_api."):
            del sys.modules[name]

    main = importlib.import_module("uocc_api.main")
    main.init_db()
    return TestClient(main.app)


def test_dashboard_and_allowlisted_targets(tmp_path, monkeypatch):
    client = build_client(tmp_path, monkeypatch)

    assert client.get("/api/health").status_code == 200

    dashboard = client.get("/api/dashboard")
    assert dashboard.status_code == 200
    dashboard_json = dashboard.json()
    assert dashboard_json["host"]["hostname"]
    assert dashboard_json["host"]["agent_online"] is True
    assert dashboard_json["updated_at"]
    assert dashboard_json["recent_operations"] == []
    assert dashboard_json["systemd_summary"]["total"] == 2
    assert dashboard_json["docker_summary"]["total"] == 1
    assert any(item["id"] == "agent-demo-backend" for item in dashboard_json["alerts"])

    units = client.get("/api/systemd/units")
    assert units.status_code == 200
    assert units.json()["items"][0]["id"] == "ssh"

    catalog = client.get("/api/systemd/catalog")
    assert catalog.status_code == 200
    catalog_json = catalog.json()
    assert "all_units" in catalog_json
    assert any(item["id"] == "ssh" and item["allowed"] is True for item in catalog_json["allowed_units"])
    assert all(item["allowed"] is False for item in catalog_json["prohibited_units"])


def test_actions_are_allowlisted_and_audited(tmp_path, monkeypatch):
    client = build_client(tmp_path, monkeypatch)
    headers = {"x-uocc-operator-token": "test-token", "origin": "http://127.0.0.1:3000"}

    unauthenticated = client.post("/api/systemd/units/ssh/actions/restart")
    assert unauthenticated.status_code == 401

    bad_origin = client.post(
        "/api/systemd/units/ssh/actions/restart",
        headers={"x-uocc-operator-token": "test-token", "origin": "http://evil.example"},
    )
    assert bad_origin.status_code == 403

    allowed = client.post("/api/systemd/units/ssh/actions/restart", headers=headers)
    assert allowed.status_code == 200
    assert allowed.json()["status"] == "success"

    dashboard = client.get("/api/dashboard").json()
    assert dashboard["recent_operations"][0]["action"] == "restart"
    assert dashboard["recent_operations"][0]["status"] == "success"

    allowed_stop = client.post("/api/systemd/units/ssh/actions/stop", headers=headers)
    assert allowed_stop.status_code == 200

    allowed_delete = client.post("/api/systemd/units/ssh/actions/delete", headers=headers)
    assert allowed_delete.status_code == 200

    audit = client.get("/api/audit-logs").json()["items"]
    assert any(item["action"] == "restart" and item["result"] == "success" for item in audit)
    assert any(item["action"] == "stop" and item["result"] == "success" for item in audit)


def test_log_line_limit_is_enforced(tmp_path, monkeypatch):
    client = build_client(tmp_path, monkeypatch)

    ok = client.get("/api/systemd/units/ssh/logs?lines=1000")
    assert ok.status_code == 200

    too_many = client.get("/api/systemd/units/ssh/logs?lines=1001")
    assert too_many.status_code == 400


def test_log_redaction_masks_common_secret_patterns(tmp_path, monkeypatch):
    build_client(tmp_path, monkeypatch)
    main = sys.modules["uocc_api.main"]

    password_line = main._redact_log_line("database password=hunter2")
    token_line = main._redact_log_line("auth token: abc.def.ghi")
    authorization_line = main._redact_log_line("Authorization: Bearer abcdef12345")

    assert "password=[REDACTED]" in password_line
    assert "hunter2" not in password_line
    assert "token: [REDACTED]" in token_line
    assert "abc.def.ghi" not in token_line
    assert "Authorization: Bearer [REDACTED]" in authorization_line
    assert "abcdef12345" not in authorization_line


def test_api_settings_reject_invalid_log_line_defaults(tmp_path, monkeypatch):
    build_client(tmp_path, monkeypatch)
    settings_module = importlib.import_module("uocc_api.settings")

    for kwargs in (
        {"log_default_lines": 0, "log_max_lines": 1000},
        {"log_default_lines": 1001, "log_max_lines": 1000},
    ):
        try:
            settings_module.Settings(**kwargs)
        except ValueError as exc:
            assert "LOG_" in str(exc)
        else:
            raise AssertionError("invalid log line settings must fail fast")


def test_missing_allowlist_fails_closed(tmp_path, monkeypatch):
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{data_dir / 'uocc.sqlite3'}")
    monkeypatch.setenv("ALLOWLIST_PATH", str(tmp_path / "missing.yaml"))

    for name in list(sys.modules):
        if name == "uocc_api" or name.startswith("uocc_api."):
            del sys.modules[name]

    try:
        importlib.import_module("uocc_api.main")
    except FileNotFoundError as exc:
        assert "Allowlist file not found" in str(exc)
    else:
        raise AssertionError("missing allowlist must fail closed")


def test_agent_reconstructs_targets_from_its_own_allowlist(tmp_path, monkeypatch):
    allowlist = tmp_path / "allowlist.yaml"
    allowlist.write_text(ALLOWLIST, encoding="utf-8")
    monkeypatch.setenv("ALLOWLIST_PATH", str(allowlist))
    monkeypatch.setenv("AGENT_BACKEND", "demo")

    for name in list(sys.modules):
        if name == "uocc_agent" or name.startswith("uocc_agent."):
            del sys.modules[name]

    agent_main = importlib.import_module("uocc_agent.main")
    client = TestClient(agent_main.app)

    spoofed = client.post(
        "/v1/systemd/status",
        json={"target": {"id": "ssh", "name": "evil.service", "actions": ["status"]}},
    )
    assert spoofed.status_code == 200
    assert spoofed.json()["name"] == "ssh.service"

    forbidden = client.post("/v1/systemd/status", json={"target_id": "not-allowed"})
    assert forbidden.status_code == 403


def test_agent_rejects_compose_file_escape(tmp_path, monkeypatch):
    allowlist = tmp_path / "allowlist.yaml"
    allowlist.write_text(MALICIOUS_ALLOWLIST, encoding="utf-8")
    monkeypatch.setenv("ALLOWLIST_PATH", str(allowlist))

    for name in list(sys.modules):
        if name == "uocc_agent" or name.startswith("uocc_agent."):
            del sys.modules[name]

    config = importlib.import_module("uocc_agent.config")
    local_backend = importlib.import_module("uocc_agent.local_backend")
    target = config.require_target(config.load_allowlist(str(allowlist)), "compose", "demo-compose", "ps")

    try:
        local_backend._compose_args(target, ["ps", "--format", "json"])
    except ValueError as exc:
        assert "inside project directory" in str(exc)
    else:
        raise AssertionError("compose file escape must be rejected")


def test_agent_local_backend_rejects_dangerous_direct_actions(monkeypatch):
    monkeypatch.setenv("AGENT_BACKEND", "local")

    for name in list(sys.modules):
        if name == "uocc_agent" or name.startswith("uocc_agent."):
            del sys.modules[name]

    local_backend = importlib.import_module("uocc_agent.local_backend")

    target = {"id": "ssh", "name": "ssh.service", "actions": ["restart"]}
    try:
        local_backend.action("systemd", target, "disable")
    except ValueError as exc:
        assert "not permitted" in str(exc)
    else:
        raise AssertionError("dangerous systemd action must be rejected")

    try:
        local_backend.action("systemd", {"id": "ssh", "name": "--bad.service"}, "restart")
    except ValueError as exc:
        assert "unit name" in str(exc)
    else:
        raise AssertionError("unsafe systemd unit name must be rejected")

    try:
        local_backend.action("docker", {"id": "app", "name": "bad name"}, "restart")
    except ValueError as exc:
        assert "container name" in str(exc)
    else:
        raise AssertionError("unsafe docker container name must be rejected")


def test_agent_local_backend_rejects_dangerous_compose_suffix(tmp_path, monkeypatch):
    monkeypatch.setenv("AGENT_BACKEND", "local")

    for name in list(sys.modules):
        if name == "uocc_agent" or name.startswith("uocc_agent."):
            del sys.modules[name]

    local_backend = importlib.import_module("uocc_agent.local_backend")
    target = {"id": "demo-compose", "name": "demo-compose", "path": str(tmp_path), "compose_file": "docker-compose.yml"}

    try:
        local_backend._compose_args(target, ["down", "-v"])
    except ValueError as exc:
        assert "not permitted" in str(exc)
    else:
        raise AssertionError("dangerous compose suffix must be rejected")
