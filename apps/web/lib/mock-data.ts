import type {
  AuditLogRecord,
  ComposeProject,
  ComposeService,
  DashboardData,
  DockerContainer,
  LogPayload,
  OperationRecord,
  SystemdUnit
} from "@/lib/types";

const now = new Date().toISOString();

export const mockSystemdUnits: SystemdUnit[] = [
  {
    id: "ssh",
    displayName: "SSH Service",
    unitName: "ssh.service",
    description: "SSH remote access service",
    status: "running",
    activeState: "active",
    subState: "running",
    lastChanged: now,
    fragmentPath: "/etc/systemd/system/ssh.service",
    editable: true,
    allowed: true,
    actions: ["start", "stop", "restart", "delete"]
  },
  {
    id: "docker",
    displayName: "Docker Engine",
    unitName: "docker.service",
    description: "Docker daemon service",
    status: "running",
    activeState: "active",
    subState: "running",
    lastChanged: now,
    fragmentPath: "/etc/systemd/system/docker.service",
    editable: true,
    allowed: true,
    actions: ["start", "stop", "restart", "delete"]
  },
  {
    id: "uocc-agent",
    displayName: "UOCC Agent",
    unitName: "uocc-agent.service",
    description: "Host control agent",
    status: "failed",
    activeState: "failed",
    subState: "exit-code",
    lastChanged: now,
    fragmentPath: "/etc/systemd/system/uocc-agent.service",
    editable: true,
    allowed: true,
    actions: ["start", "stop", "restart", "delete"]
  }
];

export const mockDockerContainers: DockerContainer[] = [
  {
    id: "rsp-api",
    name: "rsp-api",
    image: "ghcr.io/example/rsp-api:latest",
    status: "running",
    uptime: "2 days",
    ports: "127.0.0.1:8080->8080/tcp",
    cpu: "4%",
    memory: "312 MiB",
    actions: ["start", "stop", "restart"]
  },
  {
    id: "uocc-postgres",
    name: "uocc-postgres",
    image: "postgres:16",
    status: "running",
    uptime: "2 days",
    ports: "127.0.0.1:5432->5432/tcp",
    cpu: "1%",
    memory: "188 MiB",
    actions: ["start", "stop", "restart"]
  },
  {
    id: "home-grafana",
    name: "home-grafana",
    image: "grafana/grafana:latest",
    status: "exited",
    uptime: "-",
    ports: "3000/tcp",
    cpu: "0%",
    memory: "0 MiB",
    actions: ["start"]
  }
];

export const mockComposeProjects: ComposeProject[] = [
  {
    id: "remote-service-platform",
    projectName: "Remote Service Platform",
    path: "/home/kensan/Projects/Remote-Service-Platform",
    composeFile: "docker-compose.yml",
    services: 4,
    running: 3,
    stopped: 1,
    actions: ["restart"]
  },
  {
    id: "ubuntu-ops-control-console",
    projectName: "Ubuntu Ops Control Console",
    path: "/home/kensan/Projects/Ubuntu-Operations-Control-Console",
    composeFile: "docker-compose.yml",
    services: 3,
    running: 2,
    stopped: 1,
    actions: ["restart"]
  }
];

export const mockOperations: OperationRecord[] = [
  {
    id: "op-1",
    startedAt: now,
    targetType: "docker",
    targetName: "rsp-api",
    action: "restart",
    status: "success",
    duration: "1.4 s"
  },
  {
    id: "op-2",
    startedAt: now,
    targetType: "systemd",
    targetName: "uocc-agent.service",
    action: "start",
    status: "failed",
    duration: "622 ms",
    error: "Operation is not permitted"
  },
  {
    id: "op-3",
    startedAt: now,
    targetType: "compose",
    targetName: "remote-service-platform",
    action: "logs",
    status: "running",
    duration: "-"
  }
];

export const mockAuditLogs: AuditLogRecord[] = [
  {
    id: "audit-1",
    createdAt: now,
    ipAddress: "192.168.10.12",
    eventType: "operation",
    target: "docker/rsp-api",
    action: "restart",
    result: "success",
    userAgent: "Mozilla/5.0"
  },
  {
    id: "audit-2",
    createdAt: now,
    ipAddress: "192.168.10.12",
    eventType: "view",
    target: "logs/docker/rsp-api",
    action: "logs",
    result: "success",
    userAgent: "Mozilla/5.0"
  }
];

export const mockDashboard: DashboardData = {
  host: {
    hostname: "ubuntu-home",
    os: "Ubuntu 24.04 LTS",
    uptime: "14 days 06:22",
    agentOnline: true
  },
  updatedAt: now,
  cpu: { label: "CPU Usage", value: 23, state: "normal", helper: "Load is stable" },
  memory: { label: "Memory Usage", value: 68, state: "warning", helper: "6.8 GiB / 10 GiB" },
  disk: { label: "Disk Usage", value: 41, state: "normal", helper: "/ volume" },
  dockerSummary: { running: 2, stopped: 1, failed: 0, total: 3 },
  systemdSummary: { running: 2, stopped: 0, failed: 1, total: 3 },
  recentOperations: mockOperations,
  alerts: [
    { id: "alert-1", severity: "critical", message: "uocc-agent.service is failed" },
    { id: "alert-2", severity: "warning", message: "home-grafana container is exited" }
  ]
};

export function mockLogs(targetLabel = "rsp-api"): LogPayload {
  return {
    targetLabel,
    updatedAt: new Date().toISOString(),
    lines: [
      "[2026-06-28 21:35:10] INFO  service started",
      "[2026-06-28 21:35:12] WARN  retrying connection",
      "[2026-06-28 21:35:15] ERROR failed to connect database",
      "[2026-06-28 21:35:20] INFO  health check recovered"
    ]
  };
}

export const mockComposeServices: ComposeService[] = [
  { name: "api", status: "running", ports: "127.0.0.1:8000->8000/tcp" },
  { name: "web", status: "running", ports: "127.0.0.1:3000->3000/tcp" },
  { name: "db", status: "running", ports: "5432/tcp" },
  { name: "worker", status: "exited" }
];
