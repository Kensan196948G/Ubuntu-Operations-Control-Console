"use client";

import {
  mockAuditLogs,
  mockComposeProjects,
  mockComposeServices,
  mockDashboard,
  mockDockerContainers,
  mockLogs,
  mockOperations,
  mockSystemdUnits
} from "@/lib/mock-data";
import { durationFromMs } from "@/lib/format";
import type {
  ActionName,
  AuditLogRecord,
  ComposeProject,
  ComposeService,
  DashboardData,
  DockerContainer,
  LogPayload,
  OperationRecord,
  SystemdUnit,
  TargetType
} from "@/lib/types";

type FetchResult<T> = {
  data: T;
  fromFallback: boolean;
  error?: string;
};

const clientApiBase = process.env.NEXT_PUBLIC_API_BASE_URL
  ? `${process.env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, "")}/api`
  : "/ops-api";

async function request<T>(path: string, fallback: T, init?: RequestInit): Promise<FetchResult<T>> {
  try {
    const response = await fetch(`${clientApiBase}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init?.headers ?? {})
      },
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    const payload = await response.json();
    return { data: payload as T, fromFallback: false };
  } catch (error) {
    return {
      data: fallback,
      fromFallback: true,
      error: error instanceof Error ? error.message : "Failed to reach API"
    };
  }
}

function listFrom<T>(payload: unknown, keys: string[]): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object") {
    for (const key of keys) {
      const value = (payload as Record<string, unknown>)[key];
      if (Array.isArray(value)) return value as T[];
    }
  }
  return [];
}

function textFrom(value: unknown, fallback = "-") {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value);
}

function numberFrom(value: unknown, fallback = 0) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function actionsFrom(value: unknown, fallback: ActionName[] = ["start", "stop", "restart"]) {
  if (!Array.isArray(value)) return fallback;
  return value.filter((action): action is ActionName =>
    action === "start" || action === "stop" || action === "restart"
  );
}

function normalizeDashboard(raw: unknown): DashboardData {
  if (!raw || typeof raw !== "object") return mockDashboard;
  const data = raw as Record<string, unknown>;
  const host = (data.host && typeof data.host === "object" ? data.host : {}) as Record<string, unknown>;
  const docker = (data.docker_summary ?? data.dockerSummary ?? {}) as Record<string, unknown>;
  const systemd = (data.systemd_summary ?? data.systemdSummary ?? {}) as Record<string, unknown>;
  const cpu = (data.cpu && typeof data.cpu === "object" ? data.cpu : { value: data.cpu }) as Record<string, unknown>;
  const memory = (data.memory && typeof data.memory === "object" ? data.memory : { value: data.memory }) as Record<string, unknown>;
  const disk = (data.disk && typeof data.disk === "object" ? data.disk : { value: data.disk }) as Record<string, unknown>;

  return {
    host: {
      hostname: textFrom(host.hostname ?? host.name ?? data.hostname, "unknown-host"),
      os: textFrom(host.os ?? host.os_info ?? data.os, undefined),
      uptime: textFrom(host.uptime ?? data.uptime, undefined),
      agentOnline: Boolean(host.agent_online ?? host.agentOnline ?? data.agent_online ?? true)
    },
    updatedAt: textFrom(data.updated_at ?? data.updatedAt, new Date().toISOString()),
    cpu: {
      label: "CPU Usage",
      value: numberFrom(cpu.usage ?? cpu.percent ?? cpu.value, 0),
      state: metricState(numberFrom(cpu.usage ?? cpu.percent ?? cpu.value, 0)),
      helper: textFrom(cpu.helper ?? cpu.load_average, undefined)
    },
    memory: {
      label: "Memory Usage",
      value: numberFrom(memory.usage ?? memory.percent ?? memory.value, 0),
      state: metricState(numberFrom(memory.usage ?? memory.percent ?? memory.value, 0)),
      helper: textFrom(memory.helper ?? memory.used, undefined)
    },
    disk: {
      label: "Disk Usage",
      value: numberFrom(disk.usage ?? disk.percent ?? disk.value, 0),
      state: metricState(numberFrom(disk.usage ?? disk.percent ?? disk.value, 0)),
      helper: textFrom(disk.helper ?? disk.mount, undefined)
    },
    dockerSummary: {
      running: numberFrom(docker.running),
      stopped: numberFrom(docker.stopped ?? docker.exited),
      failed: numberFrom(docker.failed ?? docker.unhealthy),
      total: numberFrom(docker.total)
    },
    systemdSummary: {
      running: numberFrom(systemd.running ?? systemd.active),
      stopped: numberFrom(systemd.stopped ?? systemd.inactive),
      failed: numberFrom(systemd.failed),
      total: numberFrom(systemd.total)
    },
    recentOperations: normalizeOperations(data.recent_operations ?? data.recentOperations ?? []),
    alerts: listFrom<Record<string, unknown>>(data.alerts, ["alerts"]).map((alert, index) => ({
      id: textFrom(alert.id, `alert-${index}`),
      severity: textFrom(alert.severity, "warning") === "critical" ? "critical" : "warning",
      message: textFrom(alert.message ?? alert.detail)
    }))
  };
}

function metricState(value: number): "normal" | "warning" | "critical" {
  if (value >= 90) return "critical";
  if (value >= 70) return "warning";
  return "normal";
}

function normalizeSystemd(payload: unknown): SystemdUnit[] {
  return listFrom<Record<string, unknown>>(payload, ["units", "items", "data"]).map((unit, index) => ({
    id: textFrom(unit.id ?? unit.name ?? unit.unit_name, `unit-${index}`),
    displayName: textFrom(unit.display_name ?? unit.displayName ?? unit.name ?? unit.unit_name),
    unitName: textFrom(unit.unit_name ?? unit.unitName ?? unit.name),
    description: textFrom(unit.description, undefined),
    status: textFrom(unit.status ?? unit.active_state ?? unit.activeState, "unknown"),
    activeState: textFrom(unit.active_state ?? unit.activeState, "unknown"),
    subState: textFrom(unit.sub_state ?? unit.subState, "unknown"),
    lastChanged: textFrom(unit.last_changed ?? unit.lastChanged, undefined),
    actions: actionsFrom(unit.actions)
  }));
}

function normalizeDocker(payload: unknown): DockerContainer[] {
  return listFrom<Record<string, unknown>>(payload, ["containers", "items", "data"]).map((container, index) => ({
    id: textFrom(container.id ?? container.name, `container-${index}`),
    name: textFrom(container.name ?? container.container_name),
    image: textFrom(container.image),
    status: textFrom(container.status ?? container.state, "unknown"),
    uptime: textFrom(container.uptime ?? container.running_for, undefined),
    ports: Array.isArray(container.ports) ? container.ports.join(", ") : textFrom(container.ports, undefined),
    cpu: textFrom(container.cpu ?? container.cpu_percent, undefined),
    memory: textFrom(container.memory ?? container.mem_usage, undefined),
    actions: actionsFrom(container.actions)
  }));
}

function normalizeCompose(payload: unknown): ComposeProject[] {
  return listFrom<Record<string, unknown>>(payload, ["projects", "items", "data"]).map((project, index) => ({
    id: textFrom(project.id ?? project.project_name ?? project.name, `project-${index}`),
    projectName: textFrom(project.project_name ?? project.projectName ?? project.display_name ?? project.name),
    path: textFrom(project.path),
    composeFile: textFrom(project.compose_file ?? project.composeFile, "docker-compose.yml"),
    services: numberFrom(project.services ?? project.service_count),
    running: numberFrom(project.running),
    stopped: numberFrom(project.stopped),
    actions: ["restart"]
  }));
}

function normalizeOperations(payload: unknown): OperationRecord[] {
  return listFrom<Record<string, unknown>>(payload, ["operations", "items", "data", "recent_operations"]).map((operation, index) => ({
    id: textFrom(operation.id, `operation-${index}`),
    startedAt: textFrom(operation.started_at ?? operation.startedAt ?? operation.created_at, ""),
    targetType: textFrom(operation.target_type ?? operation.targetType),
    targetName: textFrom(operation.target_name ?? operation.targetName ?? operation.target_id),
    action: textFrom(operation.action),
    status: textFrom(operation.status),
    duration: textFrom(operation.duration ?? durationFromMs(operation.duration_ms), undefined),
    error: textFrom(operation.error_message ?? operation.error, undefined)
  }));
}

function normalizeAuditLogs(payload: unknown): AuditLogRecord[] {
  return listFrom<Record<string, unknown>>(payload, ["audit_logs", "auditLogs", "items", "data"]).map((log, index) => ({
    id: textFrom(log.id, `audit-${index}`),
    createdAt: textFrom(log.created_at ?? log.createdAt, ""),
    ipAddress: textFrom(log.ip_address ?? log.ipAddress),
    eventType: textFrom(log.event_type ?? log.eventType),
    target: textFrom(log.target ?? [log.target_type, log.target_name].filter(Boolean).join("/")),
    action: textFrom(log.action),
    result: textFrom(log.result),
    userAgent: textFrom(log.user_agent ?? log.userAgent)
  }));
}

function normalizeLogs(payload: unknown, fallbackLabel: string): LogPayload {
  if (typeof payload === "string") return { ...mockLogs(fallbackLabel), lines: payload.split("\n") };
  if (!payload || typeof payload !== "object") return mockLogs(fallbackLabel);
  const data = payload as Record<string, unknown>;
  const rawLines = data.lines ?? data.logs ?? data.content ?? data.output;
  const lines = Array.isArray(rawLines)
    ? rawLines.map(String)
    : typeof rawLines === "string"
      ? rawLines.split("\n")
      : [];
  return {
    targetLabel: textFrom(data.target_label ?? data.targetLabel ?? data.target ?? fallbackLabel, fallbackLabel),
    updatedAt: textFrom(data.updated_at ?? data.updatedAt, new Date().toISOString()),
    lines
  };
}

function normalizeComposeServices(payload: unknown): ComposeService[] {
  return listFrom<Record<string, unknown>>(payload, ["services", "items", "data"]).map((service, index) => ({
    name: textFrom(service.name ?? service.service, `service-${index}`),
    status: textFrom(service.status ?? service.state),
    ports: Array.isArray(service.ports) ? service.ports.join(", ") : textFrom(service.ports, undefined)
  }));
}

export async function getDashboard() {
  const result = await request<unknown>("/dashboard", mockDashboard);
  return { ...result, data: normalizeDashboard(result.data) };
}

export async function getSystemdUnits() {
  const result = await request<unknown>("/systemd/units", mockSystemdUnits);
  return { ...result, data: normalizeSystemd(result.data) };
}

export async function getDockerContainers() {
  const result = await request<unknown>("/docker/containers", mockDockerContainers);
  return { ...result, data: normalizeDocker(result.data) };
}

export async function getComposeProjects() {
  const result = await request<unknown>("/compose/projects", mockComposeProjects);
  return { ...result, data: normalizeCompose(result.data) };
}

export async function getComposeServices(projectId: string) {
  const result = await request<unknown>(`/compose/projects/${projectId}/ps`, mockComposeServices);
  return { ...result, data: normalizeComposeServices(result.data) };
}

export async function getOperations() {
  const result = await request<unknown>("/operations", mockOperations);
  return { ...result, data: normalizeOperations(result.data) };
}

export async function getAuditLogs() {
  const result = await request<unknown>("/audit-logs", mockAuditLogs);
  return { ...result, data: normalizeAuditLogs(result.data) };
}

export async function getLogs(type: TargetType, id: string, lines: number) {
  const path =
    type === "systemd"
      ? `/systemd/units/${id}/logs?lines=${lines}`
      : type === "docker"
        ? `/docker/containers/${id}/logs?lines=${lines}`
        : `/compose/projects/${id}/logs?lines=${lines}`;
  const result = await request<unknown>(path, mockLogs(id));
  return { ...result, data: normalizeLogs(result.data, id) };
}

export async function runAction(type: TargetType, id: string, action: ActionName) {
  const path =
    type === "systemd"
      ? `/systemd/units/${id}/actions/${action}`
      : type === "docker"
        ? `/docker/containers/${id}/actions/${action}`
        : `/compose/projects/${id}/actions/${action}`;
  return request<unknown>(path, { ok: true }, { method: "POST", body: JSON.stringify({}) });
}
