from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml


SAFE_ACTIONS = {
    "systemd": {"status", "logs", "start", "stop", "restart"},
    "docker": {"status", "logs", "start", "stop", "restart"},
    "compose": {"ps", "logs", "restart"},
}


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
    if not candidate.exists() and path.endswith("allowlist.yaml"):
        candidate = Path(path).with_name("allowlist.example.yaml")
    if not candidate.exists():
        candidate = Path("config/allowlist.example.yaml")
    return yaml.safe_load(candidate.read_text(encoding="utf-8")) or {}


settings = Settings.from_env()

