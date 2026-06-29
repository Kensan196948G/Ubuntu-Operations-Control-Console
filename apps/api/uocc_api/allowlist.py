from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml


TARGET_TYPES = {"systemd", "docker", "compose"}
SAFE_ACTIONS = {
    "systemd": {"status", "logs", "start", "stop", "restart", "delete", "edit"},
    "docker": {"status", "logs", "start", "stop", "restart"},
    "compose": {"ps", "logs", "restart"},
}
SYSTEMD_ALL_ACTIONS = ("status", "logs", "start", "stop", "restart", "delete", "edit")


@dataclass(frozen=True)
class Target:
    id: str
    type: str
    name: str
    display_name: str
    description: str = ""
    actions: tuple[str, ...] = ()
    path: str | None = None
    compose_file: str | None = None

    def allows(self, action: str) -> bool:
        return action in SAFE_ACTIONS[self.type] and action in set(self.actions)


class Allowlist:
    def __init__(self, targets: list[Target]):
        self._targets = {(target.type, target.id): target for target in targets}

    @classmethod
    def load(cls, path: str) -> "Allowlist":
        candidate = Path(path)
        if not candidate.exists():
            raise FileNotFoundError(f"Allowlist file not found: {path}")
        data = yaml.safe_load(candidate.read_text(encoding="utf-8")) or {}
        return cls(_parse_targets(data))

    def list(self, target_type: str) -> list[Target]:
        return [target for target in self._targets.values() if target.type == target_type]

    def get(self, target_type: str, target_id: str) -> Target | None:
        return self._targets.get((target_type, target_id))

    def require(self, target_type: str, target_id: str, action: str) -> Target:
        target = self.get(target_type, target_id)
        if not target or not target.allows(action):
            raise PermissionError("Target is not allowed")
        return target


def _parse_targets(data: dict[str, Any]) -> list[Target]:
    targets: list[Target] = []
    for item in data.get("systemd_units", []):
        targets.append(
            Target(
                id=item["id"],
                type="systemd",
                name=item["name"],
                display_name=item.get("display_name", item["name"]),
                description=item.get("description", ""),
                actions=tuple(item.get("actions", [])),
            )
        )
    for item in data.get("docker_containers", []):
        targets.append(
            Target(
                id=item["id"],
                type="docker",
                name=item["name"],
                display_name=item.get("display_name", item["name"]),
                description=item.get("description", ""),
                actions=tuple(item.get("actions", [])),
            )
        )
    for item in data.get("compose_projects", []):
        targets.append(
            Target(
                id=item["id"],
                type="compose",
                name=item.get("display_name", item["id"]),
                display_name=item.get("display_name", item["id"]),
                description=item.get("description", ""),
                actions=tuple(item.get("actions", [])),
                path=item["path"],
                compose_file=item.get("compose_file", "docker-compose.yml"),
            )
        )
    return targets
