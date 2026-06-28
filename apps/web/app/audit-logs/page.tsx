"use client";

import { useEffect, useState } from "react";
import { getAuditLogs } from "@/lib/api";
import type { AuditLogRecord } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { DataTable } from "@/components/ui/data-table";
import { ErrorBanner } from "@/components/ui/error-banner";
import { PageTitle } from "@/components/ui/page-title";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";

export default function AuditLogsPage() {
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [error, setError] = useState<string>();

  useEffect(() => {
    void getAuditLogs().then((result) => {
      setAuditLogs(result.data);
      setError(result.fromFallback ? result.error : undefined);
    });
  }, []);

  return (
    <>
      <PageTitle title="Audit Logs" description="Who, where, and what records for views and operations in the no-auth MVP." />
      <ErrorBanner message={error} />
      <Panel title="Audit Events">
        <DataTable
          headers={["Created At", "IP Address", "Event Type", "Target", "Action", "Result", "User-Agent"]}
          emptyTitle="No audit logs returned"
          rows={auditLogs.map((log) => [
            formatDateTime(log.createdAt),
            log.ipAddress,
            log.eventType,
            log.target,
            log.action,
            <StatusBadge key="result" value={log.result} />,
            <span key="ua" className="line-clamp-2 max-w-[320px] text-xs text-console-muted">{log.userAgent}</span>
          ])}
        />
      </Panel>
    </>
  );
}
