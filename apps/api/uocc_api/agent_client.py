from __future__ import annotations

from dataclasses import asdict
from typing import Any

import httpx

from .allowlist import Target
from .settings import settings


class AgentUnavailable(RuntimeError):
    pass


class AgentClient:
    def __init__(self) -> None:
        self.base_url = settings.agent_base_url.rstrip("/")
        self.mode = settings.agent_mode
        self.timeout = settings.agent_timeout_seconds

    async def health(self) -> dict[str, Any]:
        if self.mode == "demo":
            return demo_health()
        try:
            return await self._request("GET", "/v1/health")
        except AgentUnavailable:
            if self.mode == "auto":
                return demo_health(agent_reachable=False)
            raise

    async def dashboard(self, targets: dict[str, list[Target]]) -> dict[str, Any]:
        return await self._post_or_demo("/v1/dashboard", {"targets": serialize_targets(targets)}, demo_dashboard())

    async def list_targets(self, target_type: str, targets: list[Target]) -> list[dict[str, Any]]:
        fallback = demo_target_list(target_type, targets)
        payload = {"targets": [asdict(target) for target in targets]}
        data = await self._post_or_demo(f"/v1/{target_type}/list", payload, {"items": fallback})
        return data.get("items", data if isinstance(data, list) else fallback)

    async def get_target(self, target_type: str, target: Target) -> dict[str, Any]:
        fallback = demo_target(target_type, target)
        return await self._post_or_demo(f"/v1/{target_type}/status", {"target": asdict(target)}, fallback)

    async def logs(self, target_type: str, target: Target, lines: int) -> dict[str, Any]:
        fallback = {"target_id": target.id, "target_name": target.name, "lines": demo_logs(target_type, target, lines)}
        return await self._post_or_demo(f"/v1/{target_type}/logs", {"target": asdict(target), "lines": lines}, fallback)

    async def action(self, target_type: str, target: Target, action: str) -> dict[str, Any]:
        fallback = {"ok": True, "message": f"demo {action} accepted", "changed": False}
        return await self._post_or_demo(
            f"/v1/{target_type}/actions/{action}",
            {"target": asdict(target)},
            fallback,
            allow_demo_actions=True,
        )

    async def _post_or_demo(
        self,
        path: str,
        payload: dict[str, Any],
        fallback: dict[str, Any],
        allow_demo_actions: bool = False,
    ) -> dict[str, Any]:
        if self.mode == "demo":
            return fallback
        try:
            return await self._request("POST", path, json=payload)
        except AgentUnavailable:
            if self.mode == "auto" and (not allow_demo_actions or settings.environment == "local"):
                return fallback
            raise

    async def _request(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.request(method, f"{self.base_url}{path}", **kwargs)
                response.raise_for_status()
                return response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise AgentUnavailable("Agent is not reachable") from exc


def serialize_targets(targets: dict[str, list[Target]]) -> dict[str, list[dict[str, Any]]]:
    return {key: [asdict(target) for target in value] for key, value in targets.items()}


def demo_health(agent_reachable: bool = True) -> dict[str, Any]:
    return {"status": "ok", "agent_reachable": agent_reachable, "backend": "demo"}


def demo_dashboard() -> dict[str, Any]:
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


def demo_target_list(target_type: str, targets: list[Target]) -> list[dict[str, Any]]:
    return [demo_target(target_type, target) for target in targets]


def demo_target(target_type: str, target: Target) -> dict[str, Any]:
    base = {
        "id": target.id,
        "name": target.name,
        "display_name": target.display_name,
        "description": target.description,
        "actions": list(target.actions),
    }
    if target_type == "systemd":
        return base | {"active_state": "active", "sub_state": "running", "status": "active", "last_changed": None}
    if target_type == "docker":
        return base | {"image": "demo:latest", "state": "running", "status": "Up 1 hour", "uptime": "1 hour", "ports": []}
    return base | {"path": target.path, "compose_file": target.compose_file, "services": 1, "running": 1, "stopped": 0}


def demo_logs(target_type: str, target: Target, lines: int) -> list[str]:
    sample = [
        f"[demo] {target_type}:{target.name} log stream is using fallback data",
        "[demo] INFO service is reachable",
        "[demo] WARN configure AGENT_BACKEND=local for host-backed reads",
    ]
    return sample[-lines:]
