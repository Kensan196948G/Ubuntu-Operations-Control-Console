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


def build_client(tmp_path, monkeypatch) -> TestClient:
    allowlist = tmp_path / "allowlist.yaml"
    allowlist.write_text(ALLOWLIST, encoding="utf-8")
    data_dir = tmp_path / "data"
    data_dir.mkdir()

    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{data_dir / 'uocc.sqlite3'}")
    monkeypatch.setenv("ALLOWLIST_PATH", str(allowlist))
    monkeypatch.setenv("AGENT_MODE", "demo")
    monkeypatch.setenv("UOCC_ENV", "local")

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

    allowed = client.post("/api/systemd/units/ssh/actions/restart")
    assert allowed.status_code == 200
    assert allowed.json()["status"] == "success"

    denied = client.post("/api/systemd/units/ssh/actions/stop")
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
