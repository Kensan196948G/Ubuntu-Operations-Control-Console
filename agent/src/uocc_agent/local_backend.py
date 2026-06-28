from __future__ import annotations

import json
import platform
import socket
import time
from pathlib import Path
from typing import Any

import psutil

from .safe_process import run_fixed


def dashboard(targets: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    return {
        "host": {"hostname": socket.gethostname(), "os": platform.platform(), "agent": "local"},
        "uptime": {"seconds": int(time.time() - psutil.boot_time()), "label": None},
        "cpu": {"usage_percent": psutil.cpu_percent(interval=0.1)},
        "memory": {
            "usage_percent": memory.percent,
            "total_mb": int(memory.total / 1024 / 1024),
            "used_mb": int(memory.used / 1024 / 1024),
        },
        "disk": {
            "usage_percent": disk.percent,
            "total_gb": round(disk.total / 1024 / 1024 / 1024, 1),
            "used_gb": round(disk.used / 1024 / 1024 / 1024, 1),
        },
        "systemd_summary": _systemd_summary(targets.get("systemd", [])),
        "docker_summary": _docker_summary(targets.get("docker", [])),
        "alerts": [],
    }


def list_targets(target_type: str, targets: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [status(target_type, target) for target in targets]


def status(target_type: str, target: dict[str, Any]) -> dict[str, Any]:
    if target_type == "systemd":
        return systemd_status(target)
    if target_type == "docker":
        return docker_status(target)
    if target_type == "compose":
        return compose_status(target)
    raise ValueError("invalid target type")


def logs(target_type: str, target: dict[str, Any], lines: int) -> dict[str, Any]:
    if target_type == "systemd":
        code, stdout, stderr = run_fixed(["journalctl", "-u", target["name"], "-n", str(lines), "--no-pager", "-o", "short-iso"])
    elif target_type == "docker":
        container = _docker_container(target["name"])
        output = container.logs(tail=lines).decode("utf-8", errors="replace")
        return {"target_id": target["id"], "target_name": target["name"], "lines": output.splitlines()}
    elif target_type == "compose":
        code, stdout, stderr = run_fixed(_compose_args(target, ["logs", "--no-color", "--tail", str(lines)]), timeout=60)
    else:
        raise ValueError("invalid target type")
    if code != 0:
        return {"target_id": target["id"], "target_name": target.get("name", target["id"]), "lines": [], "error": stderr}
    return {"target_id": target["id"], "target_name": target.get("name", target["id"]), "lines": stdout.splitlines()}


def action(target_type: str, target: dict[str, Any], action_name: str) -> dict[str, Any]:
    if target_type == "systemd":
        code, stdout, stderr = run_fixed(["systemctl", action_name, target["name"]], timeout=60)
    elif target_type == "docker":
        container = _docker_container(target["name"])
        getattr(container, action_name)()
        return {"ok": True, "message": f"docker {action_name} completed", "changed": True}
    elif target_type == "compose":
        if action_name != "restart":
            return {"ok": False, "message": "compose action is not permitted", "changed": False}
        code, stdout, stderr = run_fixed(_compose_args(target, ["restart"]), timeout=120)
    else:
        raise ValueError("invalid target type")
    return {"ok": code == 0, "message": stdout or stderr or f"{target_type} {action_name} completed", "changed": code == 0}


def systemd_status(target: dict[str, Any]) -> dict[str, Any]:
    props = "Id,Description,LoadState,ActiveState,SubState,StateChangeTimestamp"
    code, stdout, stderr = run_fixed(["systemctl", "show", target["name"], f"--property={props}", "--no-page"])
    parsed = _parse_systemctl_show(stdout) if code == 0 else {}
    return _base(target) | {
        "status": parsed.get("ActiveState", "unknown" if code else "inactive"),
        "active_state": parsed.get("ActiveState", "unknown"),
        "sub_state": parsed.get("SubState", "unknown"),
        "load_state": parsed.get("LoadState", "unknown"),
        "last_changed": parsed.get("StateChangeTimestamp") or None,
        "error": stderr if code != 0 else None,
    }


def docker_status(target: dict[str, Any]) -> dict[str, Any]:
    container = _docker_container(target["name"])
    container.reload()
    attrs = container.attrs
    ports = attrs.get("NetworkSettings", {}).get("Ports") or {}
    return _base(target) | {
        "image": attrs.get("Config", {}).get("Image"),
        "state": attrs.get("State", {}).get("Status"),
        "status": container.status,
        "uptime": attrs.get("State", {}).get("StartedAt"),
        "ports": ports,
    }


def compose_status(target: dict[str, Any]) -> dict[str, Any]:
    code, stdout, stderr = run_fixed(_compose_args(target, ["ps", "--format", "json"]), timeout=60)
    services = _parse_compose_ps(stdout) if code == 0 else []
    running = sum(1 for item in services if str(item.get("State", "")).lower() == "running")
    return _base(target) | {
        "path": target.get("path"),
        "compose_file": target.get("compose_file", "docker-compose.yml"),
        "services": len(services),
        "running": running,
        "stopped": max(len(services) - running, 0),
        "items": services,
        "error": stderr if code != 0 else None,
    }


def _base(target: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": target["id"],
        "name": target.get("name") or target.get("display_name") or target["id"],
        "display_name": target.get("display_name", target.get("name", target["id"])),
        "description": target.get("description", ""),
        "actions": target.get("actions", []),
    }


def _systemd_summary(targets: list[dict[str, Any]]) -> dict[str, Any]:
    statuses = [systemd_status(target) for target in targets]
    return {
        "total": len(statuses),
        "active": sum(1 for item in statuses if item.get("active_state") == "active"),
        "failed": sum(1 for item in statuses if item.get("active_state") == "failed"),
    }


def _docker_summary(targets: list[dict[str, Any]]) -> dict[str, Any]:
    statuses: list[dict[str, Any]] = []
    for target in targets:
        try:
            statuses.append(docker_status(target))
        except Exception:
            statuses.append({"state": "unknown"})
    return {
        "running": sum(1 for item in statuses if item.get("state") == "running"),
        "stopped": sum(1 for item in statuses if item.get("state") in {"exited", "created"}),
        "unhealthy": sum(1 for item in statuses if item.get("state") == "unhealthy"),
    }


def _parse_systemctl_show(output: str) -> dict[str, str]:
    result: dict[str, str] = {}
    for line in output.splitlines():
        if "=" in line:
            key, value = line.split("=", 1)
            result[key] = value
    return result


def _docker_container(name: str):
    import docker

    client = docker.from_env()
    return client.containers.get(name)


def _compose_args(target: dict[str, Any], suffix: list[str]) -> list[str]:
    project_dir = Path(target["path"]).resolve()
    compose_file_name = target.get("compose_file", "docker-compose.yml")
    if Path(compose_file_name).is_absolute():
        raise ValueError("compose file must be relative to project directory")
    compose_file = (project_dir / compose_file_name).resolve()
    if not compose_file.is_relative_to(project_dir):
        raise ValueError("compose file must be inside project directory")
    return ["docker", "compose", "--project-directory", str(project_dir), "-f", str(compose_file), *suffix]


def _parse_compose_ps(output: str) -> list[dict[str, Any]]:
    if not output:
        return []
    try:
        parsed = json.loads(output)
        return parsed if isinstance(parsed, list) else [parsed]
    except json.JSONDecodeError:
        return [{"raw": line} for line in output.splitlines() if line.strip()]
