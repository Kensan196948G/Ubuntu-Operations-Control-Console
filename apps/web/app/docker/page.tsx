"use client";

import { useEffect, useState } from "react";
import { getDockerContainers, runAction } from "@/lib/api";
import type { ActionName, DockerContainer } from "@/lib/types";
import { ActionButton, LogsLink } from "@/components/ui/actions";
import { ConfirmDialog, type ConfirmState } from "@/components/ui/confirm-dialog";
import { DataTable } from "@/components/ui/data-table";
import { ErrorBanner } from "@/components/ui/error-banner";
import { PageTitle } from "@/components/ui/page-title";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";

export default function DockerPage() {
  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [error, setError] = useState<string>();
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [busy, setBusy] = useState<string>();

  const load = () =>
    getDockerContainers().then((result) => {
      setContainers(result.data);
      setError(result.fromFallback ? result.error : undefined);
    });

  useEffect(() => {
    void load();
  }, []);

  const handleAction = (container: DockerContainer, action: ActionName) => {
    const execute = async () => {
      setBusy(`${container.id}:${action}`);
      const result = await runAction("docker", container.id, action);
      setBusy(undefined);
      setConfirm(null);
      setError(result.fromFallback ? `Action could not reach API: ${result.error}` : undefined);
      await load();
    };

    if (action === "stop" || action === "restart") {
      setConfirm({
        title: action === "stop" ? "Stop container?" : "Restart container?",
        target: container.name,
        detail:
          action === "stop"
            ? "This may affect users or services connected to the container."
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
      <PageTitle title="Docker" description="Container state, resource hints, logs, and allowlisted lifecycle actions." />
      <ErrorBanner message={error} />
      <Panel title="Containers">
        <DataTable
          headers={["Container Name", "Image", "Status", "Uptime", "Ports", "CPU", "Memory", "Actions"]}
          emptyTitle="No Docker containers returned"
          rows={containers.map((container) => [
            <span key="name" className="font-medium">{container.name}</span>,
            <span key="image" className="font-mono text-xs">{container.image}</span>,
            <StatusBadge key="status" value={container.status} />,
            container.uptime ?? "-",
            <span key="ports" className="font-mono text-xs">{container.ports ?? "-"}</span>,
            container.cpu ?? "-",
            container.memory ?? "-",
            <div key="actions" className="flex justify-end gap-2">
              <LogsLink type="docker" id={container.id} />
              {(container.actions ?? ["start", "stop", "restart"]).map((action) => (
                <ActionButton
                  key={action}
                  action={action}
                  onClick={() => handleAction(container, action)}
                  disabled={busy === `${container.id}:${action}`}
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
