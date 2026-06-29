from __future__ import annotations

import json
import os
import platform
import re
import socket
import time
from pathlib import Path
from typing import Any

import psutil

from .safe_process import run_fixed

LOCAL_ACTIONS = {
    "systemd": {"start", "stop", "restart", "delete"},
    "docker": {"start", "stop", "restart"},
    "compose": {"restart"},
}
SYSTEMD_UNIT_PATTERN = re.compile(r"^[A-Za-z0-9:_.@-]+\.[A-Za-z]+$")
SYSTEMD_CONTROL_ACTIONS = ["start", "stop", "restart", "delete"]
SYSTEMD_MANAGED_DIRS = (
    Path("/etc/systemd/system"),
    Path("/run/systemd/system"),
    Path("/usr/lib/systemd/system"),
    Path("/lib/systemd/system"),
)
DOCKER_NAME_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]*$")


def dashboard(targets: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage(str(_host_root()))
    return {
        "host": {"hostname": socket.gethostname(), "os": _host_os(), "agent": "local"},
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


def systemd_catalog(targets: list[dict[str, Any]]) -> dict[str, Any]:
    allowed_by_name = {target["name"]: target for target in targets}
    all_units: list[dict[str, Any]] = []
    for unit in _list_systemd_units():
        target = allowed_by_name.get(unit["name"]) or unit
        all_units.append(_systemd_unit_record(unit, target, allowed=True))

    present_names = {unit["name"] for unit in all_units}
    for target in targets:
        if target["name"] not in present_names:
            all_units.append(systemd_status(target) | {"allowed": True, "control_category": "allowed"})

    return {"all_units": all_units, "allowed_units": all_units, "prohibited_units": []}


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
        _validate_systemd_unit(target["name"])
        code, stdout, stderr = run_fixed(_systemd_host_command(["journalctl", "-u", target["name"], "-n", str(lines), "--no-pager", "-o", "short-iso"]))
    elif target_type == "docker":
        container = _docker_container(_validate_docker_name(target["name"]))
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
    _require_local_action(target_type, action_name)
    if target_type == "systemd":
        _validate_systemd_unit(target["name"])
        if action_name == "delete":
            return _delete_systemd_unit(target)
        code, stdout, stderr = run_fixed(_systemd_host_command(["systemctl", action_name, target["name"]]), timeout=60)
    elif target_type == "docker":
        container = _docker_container(_validate_docker_name(target["name"]))
        if action_name == "start":
            container.start()
        elif action_name == "stop":
            container.stop()
        elif action_name == "restart":
            container.restart()
        return {"ok": True, "message": f"docker {action_name} completed", "changed": True}
    elif target_type == "compose":
        code, stdout, stderr = run_fixed(_compose_args(target, ["restart"]), timeout=120)
    else:
        raise ValueError("invalid target type")
    return {"ok": code == 0, "message": stdout or stderr or f"{target_type} {action_name} completed", "changed": code == 0}


def systemd_unit_file(target: dict[str, Any]) -> dict[str, Any]:
    unit_name = _validate_systemd_unit(target["name"])
    fragment_path = _systemd_show_value(unit_name, "FragmentPath")
    if not _manageable_systemd_fragment(fragment_path, unit_name):
        return {
            "target_id": target["id"],
            "target_name": unit_name,
            "fragment_path": fragment_path,
            "editable": False,
            "content": "",
            "error": "unit file is not editable",
        }

    code, stdout, stderr = run_fixed(_systemd_host_command(["cat", fragment_path]), timeout=30, strip=False)
    return {
        "target_id": target["id"],
        "target_name": unit_name,
        "fragment_path": fragment_path,
        "editable": code == 0,
        "content": stdout if code == 0 else "",
        "error": stderr if code != 0 else None,
    }


def save_systemd_unit_file(target: dict[str, Any], content: str) -> dict[str, Any]:
    unit_name = _validate_systemd_unit(target["name"])
    fragment_path = _systemd_show_value(unit_name, "FragmentPath")
    if not _manageable_systemd_fragment(fragment_path, unit_name):
        return {"ok": False, "message": "unit file is not editable", "changed": False}

    write_code, _write_stdout, write_stderr = run_fixed(
        _systemd_host_command(["sh", "-c", 'cat > "$1"', "uocc-write-unit", fragment_path]),
        timeout=30,
        input_text=content,
    )
    if write_code != 0:
        return {"ok": False, "message": write_stderr or "failed to write unit file", "changed": False}

    reload_code, reload_stdout, reload_stderr = run_fixed(_systemd_host_command(["systemctl", "daemon-reload"]), timeout=60)
    return {
        "ok": reload_code == 0,
        "message": reload_stdout or reload_stderr or f"saved {unit_name}",
        "changed": reload_code == 0,
    }


def systemd_status(target: dict[str, Any]) -> dict[str, Any]:
    _validate_systemd_unit(target["name"])
    props = "Id,Description,LoadState,ActiveState,SubState,StateChangeTimestamp,FragmentPath,UnitFileState"
    code, stdout, stderr = run_fixed(_systemd_host_command(["systemctl", "show", target["name"], f"--property={props}", "--no-page"]))
    parsed = _parse_systemctl_show(stdout) if code == 0 else {}
    fragment_path = parsed.get("FragmentPath", "")
    editable = _manageable_systemd_fragment(fragment_path, target["name"])
    return _base(target) | {
        "status": parsed.get("ActiveState", "unknown" if code else "inactive"),
        "active_state": parsed.get("ActiveState", "unknown"),
        "sub_state": parsed.get("SubState", "unknown"),
        "load_state": parsed.get("LoadState", "unknown"),
        "last_changed": parsed.get("StateChangeTimestamp") or None,
        "fragment_path": fragment_path or None,
        "unit_file_state": parsed.get("UnitFileState") or None,
        "editable": editable,
        "actions": _systemd_actions(target["name"], fragment_path),
        "error": stderr if code != 0 else None,
    }


def docker_status(target: dict[str, Any]) -> dict[str, Any]:
    container = _docker_container(_validate_docker_name(target["name"]))
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
    try:
        code, stdout, stderr = run_fixed(_compose_args(target, ["ps", "--format", "json"]), timeout=60)
    except Exception as exc:
        code, stdout, stderr = 1, "", str(exc)
    services = _parse_compose_ps(stdout) if code == 0 else []
    if code != 0:
        services = _compose_services_from_docker(target)
    running = sum(1 for item in services if str(item.get("State", "")).lower() == "running")
    return _base(target) | {
        "path": target.get("path"),
        "compose_file": target.get("compose_file", "docker-compose.yml"),
        "services": len(services),
        "running": running,
        "stopped": max(len(services) - running, 0),
        "items": services,
        "error": stderr if code != 0 and not services else None,
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


def _list_systemd_units() -> list[dict[str, Any]]:
    code, stdout, _stderr = run_fixed(
        _systemd_host_command(["systemctl", "list-units", "--all", "--no-legend", "--no-pager", "--plain"]),
        timeout=60,
    )
    if code != 0:
        return []
    units: list[dict[str, Any]] = []
    seen: set[str] = set()
    for line in stdout.splitlines():
        parts = line.split(maxsplit=4)
        if len(parts) < 4:
            continue
        name, load_state, active_state, sub_state = parts[:4]
        description = parts[4] if len(parts) > 4 else ""
        if not _valid_systemd_unit_name(name):
            continue
        units.append(
            {
                "id": name,
                "name": name,
                "display_name": name,
                "description": description,
                "status": active_state,
                "load_state": load_state,
                "active_state": active_state,
                "sub_state": sub_state,
                "last_changed": None,
                "fragment_path": None,
                "unit_file_state": None,
                "editable": True,
                "actions": SYSTEMD_CONTROL_ACTIONS,
            }
        )
        seen.add(name)
    units.extend(_list_systemd_unit_files(seen))
    return units


def _list_systemd_unit_files(seen: set[str]) -> list[dict[str, Any]]:
    code, stdout, _stderr = run_fixed(
        _systemd_host_command(["systemctl", "list-unit-files", "--all", "--no-legend", "--no-pager"]),
        timeout=60,
    )
    if code != 0:
        return []
    units: list[dict[str, Any]] = []
    for line in stdout.splitlines():
        parts = line.split()
        if len(parts) < 2:
            continue
        name, unit_file_state = parts[:2]
        if name in seen or not _valid_systemd_unit_name(name):
            continue
        units.append(
            {
                "id": name,
                "name": name,
                "display_name": name,
                "description": "",
                "status": "inactive",
                "load_state": "unknown",
                "active_state": "inactive",
                "sub_state": "dead",
                "last_changed": None,
                "fragment_path": None,
                "unit_file_state": unit_file_state,
                "editable": True,
                "actions": SYSTEMD_CONTROL_ACTIONS,
            }
        )
    return units


def _systemd_unit_record(unit: dict[str, Any], target: dict[str, Any], allowed: bool) -> dict[str, Any]:
    return unit | {
        "id": target.get("id", unit["name"]),
        "display_name": target.get("display_name", unit.get("display_name", unit["name"])),
        "description": target.get("description") or unit.get("description", ""),
        "actions": unit.get("actions", SYSTEMD_CONTROL_ACTIONS),
        "allowed": allowed,
        "control_category": "allowed" if allowed else "prohibited",
    }


def _delete_systemd_unit(target: dict[str, Any]) -> dict[str, Any]:
    fragment_path = _systemd_show_value(target["name"], "FragmentPath")
    if not _manageable_systemd_fragment(fragment_path, target["name"]):
        return {
            "ok": False,
            "message": "unit file is not deletable",
            "changed": False,
        }

    stop_code, stop_stdout, stop_stderr = run_fixed(_systemd_host_command(["systemctl", "disable", "--now", target["name"]]), timeout=60)
    if stop_code != 0:
        return {"ok": False, "message": stop_stdout or stop_stderr or "failed to disable unit", "changed": False}

    rm_code, _rm_stdout, rm_stderr = run_fixed(_systemd_host_command(["rm", "-f", fragment_path]), timeout=30)
    if rm_code != 0:
        return {"ok": False, "message": rm_stderr or "failed to delete unit file", "changed": False}

    reload_code, reload_stdout, reload_stderr = run_fixed(_systemd_host_command(["systemctl", "daemon-reload"]), timeout=60)
    return {
        "ok": reload_code == 0,
        "message": reload_stdout or reload_stderr or f"deleted {target['name']}",
        "changed": reload_code == 0,
    }


def _systemd_show_value(unit_name: str, property_name: str) -> str:
    code, stdout, _stderr = run_fixed(
        _systemd_host_command(["systemctl", "show", unit_name, f"--property={property_name}", "--value", "--no-page"]),
        timeout=30,
    )
    return stdout.strip() if code == 0 else ""


def _systemd_unit_metadata(unit_name: str) -> dict[str, str]:
    props = "Description,LoadState,ActiveState,SubState,StateChangeTimestamp,FragmentPath,UnitFileState"
    code, stdout, _stderr = run_fixed(
        _systemd_host_command(["systemctl", "show", unit_name, f"--property={props}", "--no-page"]),
        timeout=30,
    )
    return _parse_systemctl_show(stdout) if code == 0 else {}


def _systemd_actions(unit_name: str, fragment_path: str) -> list[str]:
    _validate_systemd_unit(unit_name)
    actions = ["start", "stop", "restart"]
    if _manageable_systemd_fragment(fragment_path, unit_name):
        actions.append("delete")
    return actions


def _valid_systemd_unit_name(name: str) -> bool:
    return bool(name and not name.startswith("-") and SYSTEMD_UNIT_PATTERN.fullmatch(name))


def _manageable_systemd_fragment(fragment_path: str, unit_name: str) -> bool:
    path = Path(fragment_path)
    unit_suffix = Path(unit_name).suffix
    if not path.is_absolute() or not unit_suffix or path.suffix != unit_suffix:
        return False
    if path.name.startswith(".") or path.name in {"", "dev/null"}:
        return False
    return any(path.is_relative_to(root) for root in SYSTEMD_MANAGED_DIRS)


def _docker_summary(targets: list[dict[str, Any]]) -> dict[str, Any]:
    statuses: list[dict[str, Any]] = []
    for target in targets:
        try:
            statuses.append(docker_status(target))
        except Exception:
            statuses.append({"state": "unknown"})
    return {
        "total": len(statuses),
        "running": sum(1 for item in statuses if item.get("state") == "running"),
        "stopped": sum(1 for item in statuses if item.get("state") in {"exited", "created"}),
        "unhealthy": sum(1 for item in statuses if item.get("state") in {"unhealthy", "unknown"}),
    }


def _parse_systemctl_show(output: str) -> dict[str, str]:
    result: dict[str, str] = {}
    for line in output.splitlines():
        if "=" in line:
            key, value = line.split("=", 1)
            result[key] = value
    return result


def _systemd_host_command(args: list[str]) -> list[str]:
    if os.getenv("HOST_SYSTEMD_NSENTER", "true").lower() in {"0", "false", "no"}:
        return args
    return ["nsenter", "--target", "1", "--mount", "--uts", "--ipc", "--net", "--pid", *args]


def _docker_container(name: str):
    import docker

    client = docker.from_env()
    return client.containers.get(name)


def _docker_client():
    import docker

    return docker.from_env()


def _compose_services_from_docker(target: dict[str, Any]) -> list[dict[str, Any]]:
    project_name = _compose_project_name(target)
    try:
        containers = _docker_client().containers.list(
            all=True,
            filters={"label": f"com.docker.compose.project={project_name}"},
        )
    except Exception:
        return []
    services = []
    for container in containers:
        labels = container.labels or {}
        services.append(
            {
                "Name": container.name,
                "Service": labels.get("com.docker.compose.service", container.name),
                "State": container.status,
                "Publishers": [],
            }
        )
    return services


def _compose_project_name(target: dict[str, Any]) -> str:
    if target.get("project_name"):
        return str(target["project_name"])
    return re.sub(r"[^a-z0-9_-]", "", Path(target["path"]).name.lower())


def _host_root() -> Path:
    return Path(os.getenv("HOST_ROOT", "/"))


def _host_os() -> str:
    os_release = _host_root() / "etc/os-release"
    if os_release.exists():
        values = _parse_os_release(os_release.read_text(encoding="utf-8", errors="replace"))
        if values.get("PRETTY_NAME"):
            return values["PRETTY_NAME"]
    return platform.platform()


def _parse_os_release(content: str) -> dict[str, str]:
    values: dict[str, str] = {}
    for line in content.splitlines():
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key] = value.strip().strip('"')
    return values


def _compose_args(target: dict[str, Any], suffix: list[str]) -> list[str]:
    _validate_compose_suffix(suffix)
    project_dir = Path(target["path"]).resolve()
    compose_file_name = target.get("compose_file", "docker-compose.yml")
    if Path(compose_file_name).is_absolute():
        raise ValueError("compose file must be relative to project directory")
    compose_file = (project_dir / compose_file_name).resolve()
    if not compose_file.is_relative_to(project_dir):
        raise ValueError("compose file must be inside project directory")
    return ["docker", "compose", "--project-directory", str(project_dir), "-f", str(compose_file), *suffix]


def _require_local_action(target_type: str, action_name: str) -> None:
    if action_name not in LOCAL_ACTIONS.get(target_type, set()):
        raise ValueError(f"{target_type} action is not permitted")


def _validate_systemd_unit(name: str) -> str:
    if not name or name.startswith("-") or not SYSTEMD_UNIT_PATTERN.fullmatch(name):
        raise ValueError("systemd unit name is not permitted")
    return name


def _validate_docker_name(name: str) -> str:
    if not name or name.startswith("-") or not DOCKER_NAME_PATTERN.fullmatch(name):
        raise ValueError("docker container name is not permitted")
    return name


def _validate_compose_suffix(suffix: list[str]) -> None:
    if suffix == ["ps", "--format", "json"]:
        return
    if suffix == ["restart"]:
        return
    if len(suffix) == 4 and suffix[:3] == ["logs", "--no-color", "--tail"] and suffix[3].isdigit():
        return
    raise ValueError("compose operation is not permitted")


def _parse_compose_ps(output: str) -> list[dict[str, Any]]:
    if not output:
        return []
    try:
        parsed = json.loads(output)
        return parsed if isinstance(parsed, list) else [parsed]
    except json.JSONDecodeError:
        return [{"raw": line} for line in output.splitlines() if line.strip()]
