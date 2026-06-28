from __future__ import annotations

from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from . import demo, local_backend
from .config import SAFE_ACTIONS, allowlisted_targets, load_allowlist, require_target, settings

app = FastAPI(title="Ubuntu Ops Control Console Agent")
allowlist_data = load_allowlist(settings.allowlist_path)


class TargetRequest(BaseModel):
    target_id: str | None = None
    target: dict[str, Any] = Field(default_factory=dict)


class TargetsRequest(BaseModel):
    targets: list[dict[str, Any]] = Field(default_factory=list)


class DashboardRequest(BaseModel):
    targets: dict[str, list[dict[str, Any]]] = Field(default_factory=dict)


class LogsRequest(TargetRequest):
    lines: int = Field(default=settings.default_lines, ge=1, le=settings.max_lines)


@app.get("/v1/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "backend": settings.backend}


@app.post("/v1/dashboard")
def dashboard(payload: DashboardRequest) -> dict[str, Any]:
    if settings.backend == "demo":
        return demo.dashboard()
    return local_backend.dashboard(_dashboard_targets())


@app.post("/v1/{target_type}/list")
def list_targets(target_type: str, payload: TargetsRequest) -> dict[str, Any]:
    _validate_target_type(target_type)
    targets = allowlisted_targets(allowlist_data, target_type)
    if settings.backend == "demo":
        return {"items": [demo.target(target_type, item) for item in targets]}
    return {"items": local_backend.list_targets(target_type, targets)}


@app.post("/v1/{target_type}/status")
def status(target_type: str, payload: TargetRequest) -> dict[str, Any]:
    action_name = "status" if target_type != "compose" else "ps"
    _validate_action(target_type, action_name)
    target = _require_request_target(target_type, payload, action_name)
    if settings.backend == "demo":
        return demo.target(target_type, target)
    return local_backend.status(target_type, target)


@app.post("/v1/{target_type}/logs")
def logs(target_type: str, payload: LogsRequest) -> dict[str, Any]:
    _validate_action(target_type, "logs")
    target = _require_request_target(target_type, payload, "logs")
    if settings.backend == "demo":
        return demo.logs(target_type, target, payload.lines)
    return local_backend.logs(target_type, target, payload.lines)


@app.post("/v1/{target_type}/actions/{action_name}")
def action(target_type: str, action_name: str, payload: TargetRequest) -> dict[str, Any]:
    _validate_action(target_type, action_name)
    target = _require_request_target(target_type, payload, action_name)
    if settings.backend == "demo":
        return demo.action(action_name)
    return local_backend.action(target_type, target, action_name)


def _validate_target_type(target_type: str) -> None:
    if target_type not in SAFE_ACTIONS:
        raise HTTPException(status_code=404, detail="target type is not supported")


def _validate_action(target_type: str, action_name: str) -> None:
    _validate_target_type(target_type)
    if action_name not in SAFE_ACTIONS[target_type]:
        raise HTTPException(status_code=403, detail="operation is not permitted")


def _require_request_target(target_type: str, payload: TargetRequest, action_name: str) -> dict[str, Any]:
    target_id = payload.target_id or payload.target.get("id")
    if not target_id:
        raise HTTPException(status_code=400, detail="target_id is required")
    try:
        return require_target(allowlist_data, target_type, target_id, action_name)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


def _dashboard_targets() -> dict[str, list[dict[str, Any]]]:
    return {
        "systemd": allowlisted_targets(allowlist_data, "systemd"),
        "docker": allowlisted_targets(allowlist_data, "docker"),
        "compose": allowlisted_targets(allowlist_data, "compose"),
    }
