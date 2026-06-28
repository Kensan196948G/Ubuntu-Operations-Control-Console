"use client";

import { useEffect, useState } from "react";
import { getOperations } from "@/lib/api";
import type { OperationRecord } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { DataTable } from "@/components/ui/data-table";
import { ErrorBanner } from "@/components/ui/error-banner";
import { PageTitle } from "@/components/ui/page-title";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";

export default function OperationsPage() {
  const [operations, setOperations] = useState<OperationRecord[]>([]);
  const [error, setError] = useState<string>();

  useEffect(() => {
    void getOperations().then((result) => {
      setOperations(result.data);
      setError(result.fromFallback ? result.error : undefined);
    });
  }, []);

  return (
    <>
      <PageTitle title="Operations" description="Execution history for allowed operations and log views." />
      <ErrorBanner message={error} />
      <Panel title="Operation History">
        <DataTable
          headers={["Started At", "Target Type", "Target Name", "Action", "Status", "Duration", "Error"]}
          emptyTitle="No operations returned"
          rows={operations.map((operation) => [
            formatDateTime(operation.startedAt),
            operation.targetType,
            operation.targetName,
            operation.action,
            <StatusBadge key="status" value={operation.status} />,
            operation.duration ?? "-",
            operation.error ?? "-"
          ])}
        />
      </Panel>
    </>
  );
}
