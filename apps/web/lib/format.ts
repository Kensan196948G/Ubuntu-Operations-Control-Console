export function formatDateTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

export function formatTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

export function asPercent(value: number | string, unit?: string) {
  if (typeof value === "number") return `${Math.round(value)}${unit ?? "%"}`;
  return `${value}${unit ?? ""}`;
}

export function normalizeStatus(value?: string) {
  return (value ?? "unknown").trim().toLowerCase();
}

export function durationFromMs(value?: unknown) {
  if (value === undefined || value === null || value === "") return "-";
  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(numeric)) return String(value);
  if (numeric < 1000) return `${numeric} ms`;
  return `${(numeric / 1000).toFixed(1)} s`;
}
