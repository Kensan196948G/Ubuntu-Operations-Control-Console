from __future__ import annotations

import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml


SAFE_ACTIONS = {
    "systemd": {"status", "logs", "start", "stop", "restart", "delete", "edit"},
    "docker": {"status", "logs", "start", "stop", "restart"},
    "compose": {"ps", "logs", "restart"},
}
SYSTEMD_UNIT_PATTERN = re.compile(r"^[A-Za-z0-9:_.@-]+\.[A-Za-z]+$")
SYSTEMD_ALL_ACTIONS = ("status", "logs", "start", "stop", "restart", "delete", "edit")


@dataclass(frozen=True)
class Settings:
    backend: str = "demo"
    allowlist_path: str = "config/allowlist.example.yaml"
    default_lines: int = 200
    max_lines: int = 1000
    command_timeout_seconds: int = 30

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            backend=os.getenv("AGENT_BACKEND", "demo").lower(),
            allowlist_path=os.getenv("ALLOWLIST_PATH", cls.allowlist_path),
            default_lines=int(os.getenv("LOG_DEFAULT_LINES", cls.default_lines)),
            max_lines=int(os.getenv("LOG_MAX_LINES", cls.max_lines)),
            command_timeout_seconds=int(os.getenv("AGENT_COMMAND_TIMEOUT_SECONDS", cls.command_timeout_seconds)),
        )


def load_allowlist(path: str) -> dict[str, Any]:
    candidate = Path(path)
    if not candidate.exists():
        raise FileNotFoundError(f"Allowlist file not found: {path}")
    return yaml.safe_load(candidate.read_text(encoding="utf-8")) or {}


def allowlisted_targets(data: dict[str, Any], target_type: str) -> list[dict[str, Any]]:
    if target_type == "systemd":
        return [_with_type(item, "systemd") for item in data.get("systemd_units", [])]
    if target_type == "docker":
        return [_with_type(item, "docker") for item in data.get("docker_containers", [])]
    if target_type == "compose":
        return [_with_type(_normalize_compose(item), "compose") for item in data.get("compose_projects", [])]
    return []


def require_target(data: dict[str, Any], target_type: str, target_id: str, action_name: str) -> dict[str, Any]:
    for target in allowlisted_targets(data, target_type):
        if target.get("id") == target_id:
            if target_type == "systemd" and action_name in SAFE_ACTIONS["systemd"]:
                return dict(target) | {"actions": list(SYSTEMD_ALL_ACTIONS)}
            if action_name in set(target.get("actions", [])):
                return target
    if target_type == "systemd" and action_name in SAFE_ACTIONS["systemd"] and SYSTEMD_UNIT_PATTERN.fullmatch(target_id):
        return {
            "id": target_id,
            "type": "systemd",
            "name": target_id,
            "display_name": target_id,
            "description": "",
            "actions": list(SYSTEMD_ALL_ACTIONS),
        }
    raise PermissionError("Target is not allowed")


def _with_type(item: dict[str, Any], target_type: str) -> dict[str, Any]:
    return dict(item) | {"type": target_type}


def _normalize_compose(item: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(item)
    normalized.setdefault("name", item.get("display_name", item["id"]))
    normalized.setdefault("compose_file", "docker-compose.yml")
    return normalized


settings = Settings.from_env()
