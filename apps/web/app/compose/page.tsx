"use client";

import { useEffect, useState } from "react";
import { ListTree } from "lucide-react";
import { getComposeProjects, getComposeServices, runAction } from "@/lib/api";
import type { ComposeProject, ComposeService } from "@/lib/types";
import { ActionButton, LogsLink } from "@/components/ui/actions";
import { ConfirmDialog, type ConfirmState } from "@/components/ui/confirm-dialog";
import { DataTable } from "@/components/ui/data-table";
import { ErrorBanner } from "@/components/ui/error-banner";
import { PageTitle } from "@/components/ui/page-title";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";

export default function ComposePage() {
  const [projects, setProjects] = useState<ComposeProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>();
  const [services, setServices] = useState<ComposeService[]>([]);
  const [error, setError] = useState<string>();
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [busy, setBusy] = useState<string>();

  const loadProjects = () =>
    getComposeProjects().then((result) => {
      setProjects(result.data);
      setSelectedProject((current) => current ?? result.data[0]?.id);
      setError(result.fromFallback ? result.error : undefined);
    });

  useEffect(() => {
    void loadProjects();
  }, []);

  useEffect(() => {
    if (!selectedProject) return;
    void getComposeServices(selectedProject).then((result) => {
      setServices(result.data);
      setError(result.fromFallback ? result.error : undefined);
    });
  }, [selectedProject]);

  const handleRestart = (project: ComposeProject) => {
    setConfirm({
      title: "Restart Compose project?",
      target: project.projectName,
      detail: "This restarts services in the registered Compose project and may briefly interrupt them.",
      confirmLabel: "Restart",
      variant: "warning",
      onConfirm: async () => {
        setBusy(project.id);
        const result = await runAction("compose", project.id, "restart");
        setBusy(undefined);
        setConfirm(null);
        setError(result.fromFallback ? `Action could not reach API: ${result.error}` : undefined);
        await loadProjects();
      }
    });
  };

  return (
    <>
      <PageTitle title="Compose" description="Registered Docker Compose projects with ps, logs, and restart only." />
      <ErrorBanner message={error} />
      <Panel title="Projects" className="mb-5">
        <DataTable
          headers={["Project Name", "Path", "Compose File", "Services", "Running", "Stopped", "Actions"]}
          emptyTitle="No Compose projects returned"
          rows={projects.map((project) => [
            <button
              key="name"
              className="text-left font-medium text-blue-700 hover:underline"
              onClick={() => setSelectedProject(project.id)}
            >
              {project.projectName}
            </button>,
            <span key="path" className="font-mono text-xs">{project.path}</span>,
            project.composeFile,
            project.services,
            <StatusBadge key="running" value={`${project.running} running`} />,
            <StatusBadge key="stopped" value={`${project.stopped} stopped`} />,
            <div key="actions" className="flex justify-end gap-2">
              <LogsLink type="compose" id={project.id} />
              <ActionButton action="restart" onClick={() => handleRestart(project)} disabled={busy === project.id} />
            </div>
          ])}
        />
      </Panel>
      <Panel
        title="Compose ps"
        action={
          <span className="inline-flex items-center gap-2 text-sm text-console-muted">
            <ListTree className="h-4 w-4" aria-hidden="true" />
            {selectedProject ?? "No project selected"}
          </span>
        }
      >
        <DataTable
          headers={["Service", "Status", "Ports"]}
          emptyTitle="No Compose services returned"
          rows={services.map((service) => [
            <span key="service" className="font-medium">{service.name}</span>,
            <StatusBadge key="status" value={service.status} />,
            <span key="ports" className="font-mono text-xs">{service.ports ?? "-"}</span>
          ])}
        />
      </Panel>
      <ConfirmDialog state={confirm} busy={Boolean(busy)} onClose={() => setConfirm(null)} />
    </>
  );
}
