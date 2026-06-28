from __future__ import annotations

from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from . import demo, local_backend
from .config import SAFE_ACTIONS, load_allowlist, settings

app = FastAPI(title="Ubuntu Ops Control Console Agent")
allowlist_data = load_allowlist(settings.allowlist_path)


class TargetRequest(BaseModel):
    target: dict[str, Any]


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
    return local_backend.dashboard(payload.targets)


@app.post("/v1/{target_type}/list")
def list_targets(target_type: str, payload: TargetsRequest) -> dict[str, Any]:
    _validate_target_type(target_type)
    if settings.backend == "demo":
        return {"items": [demo.target(target_type, item) for item in payload.targets]}
    return {"items": local_backend.list_targets(target_type, payload.targets)}


@app.post("/v1/{target_type}/status")
def status(target_type: str, payload: TargetRequest) -> dict[str, Any]:
    _validate_action(target_type, "status" if target_type != "compose" else "ps")
    if settings.backend == "demo":
        return demo.target(target_type, payload.target)
    return local_backend.status(target_type, payload.target)


@app.post("/v1/{target_type}/logs")
def logs(target_type: str, payload: LogsRequest) -> dict[str, Any]:
    _validate_action(target_type, "logs")
    if settings.backend == "demo":
        return demo.logs(target_type, payload.target, payload.lines)
    return local_backend.logs(target_type, payload.target, payload.lines)


@app.post("/v1/{target_type}/actions/{action_name}")
def action(target_type: str, action_name: str, payload: TargetRequest) -> dict[str, Any]:
    _validate_action(target_type, action_name)
    if settings.backend == "demo":
        return demo.action(action_name)
    return local_backend.action(target_type, payload.target, action_name)


def _validate_target_type(target_type: str) -> None:
    if target_type not in SAFE_ACTIONS:
        raise HTTPException(status_code=404, detail="target type is not supported")


def _validate_action(target_type: str, action_name: str) -> None:
    _validate_target_type(target_type)
    if action_name not in SAFE_ACTIONS[target_type]:
        raise HTTPException(status_code=403, detail="operation is not permitted")

