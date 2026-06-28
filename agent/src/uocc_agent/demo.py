from __future__ import annotations

from typing import Any


def dashboard() -> dict[str, Any]:
    return {
        "host": {"hostname": "uocc-demo", "os": "Ubuntu demo", "agent": "demo"},
        "uptime": {"seconds": 123456, "label": "1 day, 10 hours"},
        "cpu": {"usage_percent": 12.5},
        "memory": {"usage_percent": 42.0, "total_mb": 8192, "used_mb": 3440},
        "disk": {"usage_percent": 61.0, "total_gb": 128, "used_gb": 78},
        "systemd_summary": {"total": 2, "active": 2, "failed": 0},
        "docker_summary": {"running": 1, "stopped": 0, "unhealthy": 0},
        "alerts": [],
    }


def target(target_type: str, item: dict[str, Any]) -> dict[str, Any]:
    base = {
        "id": item["id"],
        "name": item.get("name") or item.get("display_name") or item["id"],
        "display_name": item.get("display_name", item.get("name", item["id"])),
        "description": item.get("description", ""),
        "actions": item.get("actions", []),
    }
    if target_type == "systemd":
        return base | {"active_state": "active", "sub_state": "running", "status": "active", "last_changed": None}
    if target_type == "docker":
        return base | {"image": "demo:latest", "state": "running", "status": "Up 1 hour", "uptime": "1 hour", "ports": []}
    return base | {
        "path": item.get("path"),
        "compose_file": item.get("compose_file", "docker-compose.yml"),
        "services": 1,
        "running": 1,
        "stopped": 0,
    }


def logs(target_type: str, item: dict[str, Any], lines: int) -> dict[str, Any]:
    name = item.get("name") or item.get("display_name") or item["id"]
    sample = [
        f"[demo] {target_type}:{name} log stream is using fallback data",
        "[demo] INFO service is reachable",
        "[demo] WARN set AGENT_BACKEND=local to read host state",
    ]
    return {"target_id": item["id"], "target_name": name, "lines": sample[-lines:]}


def action(action_name: str) -> dict[str, Any]:
    return {"ok": True, "message": f"demo {action_name} accepted", "changed": False}

