import { cn } from "@/lib/ui";
import { normalizeStatus } from "@/lib/format";

const statusStyles: Record<string, string> = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  running: "border-emerald-200 bg-emerald-50 text-emerald-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  healthy: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  inactive: "border-slate-200 bg-slate-100 text-slate-600",
  exited: "border-slate-200 bg-slate-100 text-slate-600",
  stopped: "border-slate-200 bg-slate-100 text-slate-600",
  failed: "border-red-200 bg-red-50 text-red-700",
  error: "border-red-200 bg-red-50 text-red-700",
  unhealthy: "border-red-200 bg-red-50 text-red-700",
  critical: "border-red-200 bg-red-50 text-red-700",
  restarting: "border-blue-200 bg-blue-50 text-blue-700",
  pending: "border-blue-200 bg-blue-50 text-blue-700",
  unknown: "border-slate-200 bg-white text-slate-600"
};

export function StatusBadge({ value, className }: { value?: string; className?: string }) {
  const status = normalizeStatus(value);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold capitalize",
        statusStyles[status] ?? statusStyles.unknown,
        className
      )}
    >
      {value || "unknown"}
    </span>
  );
}
