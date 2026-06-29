export type TargetType = "systemd" | "docker" | "compose";
export type ActionName = "start" | "stop" | "restart" | "delete";

export type ApiHealth = {
  online: boolean;
  message?: string;
};

export type DashboardData = {
  host: {
    hostname: string;
    os?: string;
    uptime?: string;
    agentOnline: boolean;
  };
  updatedAt: string;
  cpu: MetricValue;
  memory: MetricValue;
  disk: MetricValue;
  dockerSummary: SummaryValue;
  systemdSummary: SummaryValue;
  recentOperations: OperationRecord[];
  alerts: AlertRecord[];
};

export type MetricValue = {
  label: string;
  value: number | string;
  unit?: string;
  state: "normal" | "warning" | "critical" | "unknown";
  helper?: string;
};

export type SummaryValue = {
  running: number;
  stopped: number;
  failed: number;
  total: number;
};

export type AlertRecord = {
  id: string;
  severity: "warning" | "critical";
  message: string;
};

export type SystemdUnit = {
  id: string;
  displayName: string;
  unitName: string;
  description?: string;
  status: string;
  activeState: string;
  subState: string;
  loadState?: string;
  lastChanged?: string;
  fragmentPath?: string;
  unitFileState?: string;
  editable?: boolean;
  allowed?: boolean;
  controlCategory?: "allowed" | "prohibited";
  actions?: ActionName[];
};

export type SystemdUnitFile = {
  targetId: string;
  targetName: string;
  fragmentPath?: string;
  editable: boolean;
  content: string;
  error?: string;
};

export type SystemdCatalog = {
  allUnits: SystemdUnit[];
  allowedUnits: SystemdUnit[];
  prohibitedUnits: SystemdUnit[];
};

export type DockerContainer = {
  id: string;
  name: string;
  image: string;
  status: string;
  uptime?: string;
  ports?: string;
  cpu?: string;
  memory?: string;
  actions?: ActionName[];
};

export type ComposeProject = {
  id: string;
  projectName: string;
  path: string;
  composeFile: string;
  services: number;
  running: number;
  stopped: number;
  actions?: Extract<ActionName, "restart">[];
};

export type OperationRecord = {
  id: string;
  startedAt: string;
  targetType: string;
  targetName: string;
  action: string;
  status: "running" | "success" | "failed" | string;
  duration?: string;
  error?: string;
};

export type AuditLogRecord = {
  id: string;
  createdAt: string;
  ipAddress: string;
  eventType: string;
  target: string;
  action: string;
  result: string;
  userAgent: string;
};

export type LogPayload = {
  targetLabel: string;
  lines: string[];
  updatedAt: string;
};

export type ComposeService = {
  name: string;
  status: string;
  ports?: string;
};
