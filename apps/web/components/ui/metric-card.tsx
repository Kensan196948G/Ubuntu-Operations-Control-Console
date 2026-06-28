import { Activity, AlertTriangle, CheckCircle2 } from "lucide-react";
import { asPercent } from "@/lib/format";
import type { MetricValue } from "@/lib/types";
import { cn } from "@/lib/ui";

const stateStyles = {
  normal: "border-emerald-100 bg-white",
  warning: "border-amber-200 bg-amber-50",
  critical: "border-red-200 bg-red-50",
  unknown: "border-slate-200 bg-white"
};

export function MetricCard({ metric }: { metric: MetricValue }) {
  const Icon = metric.state === "normal" ? CheckCircle2 : metric.state === "unknown" ? Activity : AlertTriangle;
  return (
    <section className={cn("rounded-lg border p-5 shadow-panel", stateStyles[metric.state])}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-console-muted">{metric.label}</p>
          <p className="mt-3 text-3xl font-semibold text-console-ink">{asPercent(metric.value, metric.unit)}</p>
        </div>
        <span className="rounded-md border border-console-line bg-white p-2 text-console-muted">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 min-h-5 text-sm text-console-muted">{metric.helper ?? metric.state}</p>
    </section>
  );
}
