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
    assert dashboard.json()["host"]["hostname"]

    units = client.get("/api/systemd/units")
    assert units.status_code == 200
    assert units.json()["items"][0]["id"] == "ssh"


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

    denied = client.post("/api/systemd/units/ssh/actions/stop", headers=headers)
    assert denied.status_code == 403

    audit = client.get("/api/audit-logs").json()["items"]
    assert any(item["action"] == "restart" and item["result"] == "success" for item in audit)
    assert any(item["action"] == "stop" and item["result"] == "failed" for item in audit)


def test_log_line_limit_is_enforced(tmp_path, monkeypatch):
    client = build_client(tmp_path, monkeypatch)

    ok = client.get("/api/systemd/units/ssh/logs?lines=1000")
    assert ok.status_code == 200

    too_many = client.get("/api/systemd/units/ssh/logs?lines=1001")
    assert too_many.status_code == 400


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
        local_backend._compose_args(target, ["ps"])
    except ValueError as exc:
        assert "inside project directory" in str(exc)
    else:
        raise AssertionError("compose file escape must be rejected")
