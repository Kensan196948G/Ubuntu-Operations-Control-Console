"use client";

import { useEffect, useState } from "react";
import { getSystemdUnits, runAction } from "@/lib/api";
import type { ActionName, SystemdUnit } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { ActionButton, LogsLink } from "@/components/ui/actions";
import { ConfirmDialog, type ConfirmState } from "@/components/ui/confirm-dialog";
import { DataTable } from "@/components/ui/data-table";
import { ErrorBanner } from "@/components/ui/error-banner";
import { PageTitle } from "@/components/ui/page-title";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";

export default function SystemdPage() {
  const [units, setUnits] = useState<SystemdUnit[]>([]);
  const [error, setError] = useState<string>();
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [busy, setBusy] = useState<string>();

  const load = () =>
    getSystemdUnits().then((result) => {
      setUnits(result.data);
      setError(result.fromFallback ? result.error : undefined);
    });

  useEffect(() => {
    void load();
  }, []);

  const handleAction = (unit: SystemdUnit, action: ActionName) => {
    const execute = async () => {
      setBusy(`${unit.id}:${action}`);
      const result = await runAction("systemd", unit.id, action);
      setBusy(undefined);
      setConfirm(null);
      setError(result.fromFallback ? `Action could not reach API: ${result.error}` : undefined);
      await load();
    };

    if (action === "stop" || action === "restart") {
      setConfirm({
        title: action === "stop" ? "Stop service?" : "Restart service?",
        target: unit.unitName,
        detail:
          action === "stop"
            ? "This may affect running workloads that depend on the service."
            : "This operation may temporarily interrupt the service.",
        confirmLabel: action === "stop" ? "Stop" : "Restart",
        variant: action === "stop" ? "danger" : "warning",
        onConfirm: execute
      });
      return;
    }

    void execute();
  };

  return (
    <>
      <PageTitle title="systemd" description="Allowed systemd units with safe status checks and limited actions." />
      <ErrorBanner message={error} />
      <Panel title="Allowed Units">
        <DataTable
          headers={["Display Name", "Unit Name", "Status", "Active State", "Sub State", "Last Changed", "Actions"]}
          emptyTitle="No systemd units returned"
          rows={units.map((unit) => [
            <div key="name">
              <p className="font-medium">{unit.displayName}</p>
              {unit.description ? <p className="mt-1 text-xs text-console-muted">{unit.description}</p> : null}
            </div>,
            <span key="unit" className="font-mono text-xs">{unit.unitName}</span>,
            <StatusBadge key="status" value={unit.status} />,
            <StatusBadge key="active" value={unit.activeState} />,
            unit.subState,
            formatDateTime(unit.lastChanged),
            <div key="actions" className="flex justify-end gap-2">
              <LogsLink type="systemd" id={unit.id} />
              {(unit.actions ?? ["start", "stop", "restart"]).map((action) => (
                <ActionButton
                  key={action}
                  action={action}
                  onClick={() => handleAction(unit, action)}
                  disabled={busy === `${unit.id}:${action}`}
                />
              ))}
            </div>
          ])}
        />
      </Panel>
      <ConfirmDialog state={confirm} busy={Boolean(busy)} onClose={() => setConfirm(null)} />
    </>
  );
}
