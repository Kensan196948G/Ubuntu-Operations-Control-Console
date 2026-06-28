from __future__ import annotations

import time
from typing import Annotated

from fastapi import FastAPI, HTTPException, Query, Request

from .agent_client import AgentClient, AgentUnavailable
from .allowlist import Allowlist
from . import db as db_module
from .db import (
    create_operation,
    finish_operation,
    get_operation,
    init_db,
    list_audit_logs,
    list_operations,
    write_audit,
)
from .settings import settings

app = FastAPI(title=settings.app_name)
allowlist = Allowlist.load(settings.allowlist_path)
agent = AgentClient()


@app.on_event("startup")
def startup() -> None:
    init_db()


@app.get("/health")
@app.get("/api/health")
async def health() -> dict:
    agent_health = await agent.health()
    return {"status": "ok", "database": "ok" if db_module.db_available else "unavailable", "agent": agent_health}


@app.get("/api/dashboard")
async def dashboard() -> dict:
    return await agent.dashboard(
        {
            "systemd": allowlist.list("systemd"),
            "docker": allowlist.list("docker"),
            "compose": allowlist.list("compose"),
        }
    )


@app.get("/api/systemd/units")
async def systemd_units() -> dict:
    return {"items": await agent.list_targets("systemd", allowlist.list("systemd"))}


@app.get("/api/systemd/units/{target_id}")
async def systemd_unit(target_id: str) -> dict:
    target = _require("systemd", target_id, "status")
    return await agent.get_target("systemd", target)


@app.get("/api/systemd/units/{target_id}/logs")
async def systemd_logs(target_id: str, request: Request, lines: Annotated[int, Query(ge=1)] = settings.log_default_lines) -> dict:
    target = _require("systemd", target_id, "logs")
    safe_lines = _safe_lines(lines)
    result = await agent.logs("systemd", target, safe_lines)
    _audit_view(request, "systemd", target.name, "logs", "success")
    return result


@app.post("/api/systemd/units/{target_id}/actions/{action}")
async def systemd_action(target_id: str, action: str, request: Request) -> dict:
    _require_operator(request)
    return await _run_action("systemd", target_id, action, request)


@app.get("/api/docker/containers")
async def docker_containers() -> dict:
    return {"items": await agent.list_targets("docker", allowlist.list("docker"))}


@app.get("/api/docker/containers/{target_id}")
async def docker_container(target_id: str) -> dict:
    target = _require("docker", target_id, "status")
    return await agent.get_target("docker", target)


@app.get("/api/docker/containers/{target_id}/logs")
async def docker_logs(target_id: str, request: Request, lines: Annotated[int, Query(ge=1)] = settings.log_default_lines) -> dict:
    target = _require("docker", target_id, "logs")
    result = await agent.logs("docker", target, _safe_lines(lines))
    _audit_view(request, "docker", target.name, "logs", "success")
    return result


@app.post("/api/docker/containers/{target_id}/actions/{action}")
async def docker_action(target_id: str, action: str, request: Request) -> dict:
    _require_operator(request)
    return await _run_action("docker", target_id, action, request)


@app.get("/api/compose/projects")
async def compose_projects() -> dict:
    return {"items": await agent.list_targets("compose", allowlist.list("compose"))}


@app.get("/api/compose/projects/{target_id}")
async def compose_project(target_id: str) -> dict:
    target = _require("compose", target_id, "ps")
    return await agent.get_target("compose", target)


@app.get("/api/compose/projects/{target_id}/ps")
async def compose_ps(target_id: str) -> dict:
    target = _require("compose", target_id, "ps")
    return await agent.get_target("compose", target)


@app.get("/api/compose/projects/{target_id}/logs")
async def compose_logs(target_id: str, request: Request, lines: Annotated[int, Query(ge=1)] = settings.log_default_lines) -> dict:
    target = _require("compose", target_id, "logs")
    result = await agent.logs("compose", target, _safe_lines(lines))
    _audit_view(request, "compose", target.display_name, "logs", "success")
    return result


@app.post("/api/compose/projects/{target_id}/actions/{action}")
async def compose_action(target_id: str, action: str, request: Request) -> dict:
    _require_operator(request)
    return await _run_action("compose", target_id, action, request)


@app.get("/api/logs")
async def logs(
    request: Request,
    target_type: str,
    target_id: str,
    lines: Annotated[int, Query(ge=1)] = settings.log_default_lines,
) -> dict:
    if target_type not in {"systemd", "docker", "compose"}:
        raise HTTPException(status_code=400, detail="Invalid target_type")
    target = _require(target_type, target_id, "logs")
    result = await agent.logs(target_type, target, _safe_lines(lines))
    _audit_view(request, target_type, target.name, "logs", "success")
    return result


@app.get("/api/operations")
async def operations(limit: Annotated[int, Query(ge=1, le=500)] = 100) -> dict:
    return {"items": [_operation_to_dict(item) for item in list_operations(limit)]}


@app.get("/api/operations/{operation_id}")
async def operation(operation_id: str) -> dict:
    item = get_operation(operation_id)
    if not item:
        raise HTTPException(status_code=404, detail="Operation not found")
    return _operation_to_dict(item)


@app.get("/api/audit-logs")
async def audit_logs(limit: Annotated[int, Query(ge=1, le=500)] = 100) -> dict:
    return {"items": [_audit_to_dict(item) for item in list_audit_logs(limit)]}


def _require(target_type: str, target_id: str, action: str):
    try:
        return allowlist.require(target_type, target_id, action)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


def _safe_lines(lines: int) -> int:
    if lines > settings.log_max_lines:
        raise HTTPException(status_code=400, detail=f"lines must be <= {settings.log_max_lines}")
    return lines


def _require_operator(request: Request) -> None:
    if not settings.operator_token:
        raise HTTPException(status_code=503, detail="Operator token is not configured")

    supplied = request.headers.get("x-uocc-operator-token")
    if supplied != settings.operator_token:
        raise HTTPException(status_code=401, detail="Operator token is required")

    origin = request.headers.get("origin")
    if origin and origin not in settings.allowed_origins:
        raise HTTPException(status_code=403, detail="Origin is not allowed")


async def _run_action(target_type: str, target_id: str, action: str, request: Request) -> dict:
    target = allowlist.get(target_type, target_id)
    if not target or not target.allows(action):
        target_name = target.name if target else target_id
        error = "Target is not allowed"
        write_audit("operation", target_type, target_name, action, "failed", _ip(request), _ua(request), error)
        raise HTTPException(status_code=403, detail=error)
    operation_id = create_operation(target_type, target.id, target.name, action)
    started = time.perf_counter()
    try:
        result = await agent.action(target_type, target, action)
        duration_ms = int((time.perf_counter() - started) * 1000)
        status = "success" if result.get("ok", True) else "failed"
        error = None if status == "success" else result.get("message", "Operation failed")
        finish_operation(operation_id, status, duration_ms, error)
        write_audit("operation", target_type, target.name, action, status, _ip(request), _ua(request), error)
        if status == "failed":
            raise HTTPException(status_code=502, detail=error)
        return {"operation_id": operation_id, "status": status, "duration_ms": duration_ms, "result": result}
    except AgentUnavailable as exc:
        duration_ms = int((time.perf_counter() - started) * 1000)
        finish_operation(operation_id, "failed", duration_ms, str(exc))
        write_audit("operation", target_type, target.name, action, "failed", _ip(request), _ua(request), str(exc))
        raise HTTPException(status_code=502, detail=str(exc)) from exc


def _audit_view(request: Request, target_type: str, target_name: str, action: str, result: str) -> None:
    write_audit("view", target_type, target_name, action, result, _ip(request), _ua(request))


def _ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def _ua(request: Request) -> str | None:
    return request.headers.get("user-agent")


def _operation_to_dict(item) -> dict:
    return {
        "id": item.id,
        "target_type": item.target_type,
        "target_id": item.target_id,
        "target_name": item.target_name,
        "action": item.action,
        "status": item.status,
        "started_at": item.started_at.isoformat(),
        "finished_at": item.finished_at.isoformat() if item.finished_at else None,
        "duration_ms": item.duration_ms,
        "error_message": item.error_message,
    }


def _audit_to_dict(item) -> dict:
    return {
        "id": item.id,
        "event_type": item.event_type,
        "target_type": item.target_type,
        "target_name": item.target_name,
        "action": item.action,
        "result": item.result,
        "ip_address": item.ip_address,
        "user_agent": item.user_agent,
        "error_message": item.error_message,
        "created_at": item.created_at.isoformat(),
    }
