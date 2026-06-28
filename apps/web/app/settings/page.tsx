import { ServerCog, ShieldAlert, SlidersHorizontal } from "lucide-react";
import { PageTitle } from "@/components/ui/page-title";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";

const apiBase = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export default function SettingsPage() {
  return (
    <>
      <PageTitle title="Settings" description="Read-only MVP settings and safety posture for this console." />
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="API Connection">
          <div className="flex items-start gap-3">
            <ServerCog className="mt-1 h-5 w-5 text-console-muted" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-console-ink">Backend API Base</p>
              <p className="mt-2 break-all rounded-md border border-console-line bg-console-bg px-3 py-2 font-mono text-xs text-console-muted">
                {apiBase}
              </p>
              <p className="mt-3 text-sm text-console-muted">Browser requests use the local `/ops-api` proxy unless `NEXT_PUBLIC_API_BASE_URL` is set.</p>
            </div>
          </div>
        </Panel>
        <Panel title="Safety Rules">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-1 h-5 w-5 text-console-muted" aria-hidden="true" />
            <div>
              <StatusBadge value="MVP Safe Surface" />
              <ul className="mt-4 space-y-2 text-sm text-console-muted">
                <li>Allowlisted targets only</li>
                <li>Confirmation required for stop and restart</li>
                <li>No delete, remove, prune, exec, shell, reboot, or shutdown controls</li>
              </ul>
            </div>
          </div>
        </Panel>
        <Panel title="Log Limits">
          <div className="flex items-start gap-3">
            <SlidersHorizontal className="mt-1 h-5 w-5 text-console-muted" aria-hidden="true" />
            <div className="text-sm text-console-muted">
              <p>Initial log view uses 200 lines.</p>
              <p className="mt-2">Selectable line counts: 100, 200, 500, 1000.</p>
              <p className="mt-2">Auto refresh interval is fixed at 5 seconds.</p>
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}
