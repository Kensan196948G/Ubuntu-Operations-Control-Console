"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Server } from "lucide-react";
import { getDashboard } from "@/lib/api";
import type { DashboardData } from "@/lib/types";
import { mockDashboard } from "@/lib/mock-data";
import { formatDateTime, formatTime } from "@/lib/format";
import { ErrorBanner } from "@/components/ui/error-banner";
import { MetricCard } from "@/components/ui/metric-card";
import { PageTitle } from "@/components/ui/page-title";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable } from "@/components/ui/data-table";

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardData>(mockDashboard);
  const [error, setError] = useState<string>();

  useEffect(() => {
    void getDashboard().then((result) => {
      setDashboard(result.data);
      setError(result.fromFallback ? result.error : undefined);
    });
  }, []);

  return (
    <>
      <PageTitle
        title="Dashboard"
        description="Host health, important service state, recent actions, and alerts for daily operations."
        action={<span className="text-sm text-console-muted">Updated {formatTime(dashboard.updatedAt)}</span>}
      />
      <ErrorBanner message={error} />

      <section className="mb-5 grid gap-4 lg:grid-cols-[1.2fr_repeat(3,1fr)]">
        <Panel className="bg-white" title="Host Status">
          <div className="flex items-start gap-4">
            <span className="rounded-md border border-console-line bg-console-bg p-3 text-console-muted">
              <Server className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-2xl font-semibold text-console-ink">{dashboard.host.hostname}</p>
              <p className="mt-1 text-sm text-console-muted">{dashboard.host.os ?? "OS information unavailable"}</p>
              <p className="mt-3 text-sm text-console-muted">Uptime: {dashboard.host.uptime ?? "-"}</p>
              <div className="mt-3">
                <StatusBadge value={dashboard.host.agentOnline ? "Agent Online" : "Agent Offline"} />
              </div>
            </div>
          </div>
        </Panel>
        <MetricCard metric={dashboard.cpu} />
        <MetricCard metric={dashboard.memory} />
        <MetricCard metric={dashboard.disk} />
      </section>

      <section className="mb-5 grid gap-4 lg:grid-cols-2">
        <Panel title="Docker Summary">
          <SummaryGrid summary={dashboard.dockerSummary} />
        </Panel>
        <Panel title="systemd Summary">
          <SummaryGrid summary={dashboard.systemdSummary} />
        </Panel>
      </section>

      {dashboard.alerts.length > 0 ? (
        <Panel title="Alerts" className="mb-5 border-amber-200">
          <div className="space-y-2">
            {dashboard.alerts.map((alert) => (
              <div key={alert.id} className="flex items-start gap-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{alert.message}</span>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      <Panel title="Recent Operations">
        <DataTable
          headers={["Started At", "Target Type", "Target Name", "Action", "Status", "Duration"]}
          emptyTitle="No recent operations"
          rows={dashboard.recentOperations.map((operation) => [
            formatDateTime(operation.startedAt),
            operation.targetType,
            operation.targetName,
            operation.action,
            <StatusBadge key="status" value={operation.status} />,
            operation.duration ?? "-"
          ])}
        />
      </Panel>
    </>
  );
}

function SummaryGrid({ summary }: { summary: { running: number; stopped: number; failed: number; total: number } }) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {[
        ["Running", summary.running, "text-emerald-700"],
        ["Stopped", summary.stopped, "text-slate-600"],
        ["Failed", summary.failed, "text-red-700"],
        ["Total", summary.total, "text-console-ink"]
      ].map(([label, value, tone]) => (
        <div key={label} className="rounded-md border border-console-line bg-console-bg px-3 py-3">
          <p className="text-xs font-medium uppercase tracking-normal text-console-muted">{label}</p>
          <p className={`mt-1 text-2xl font-semibold ${tone}`}>{value}</p>
        </div>
      ))}
    </div>
  );
}
