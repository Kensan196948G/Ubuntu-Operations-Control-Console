import { EmptyState } from "@/components/ui/empty-state";

export function DataTable({
  headers,
  rows,
  emptyTitle
}: {
  headers: string[];
  rows: React.ReactNode[][];
  emptyTitle: string;
}) {
  if (rows.length === 0) return <EmptyState title={emptyTitle} />;

  return (
    <div className="table-scroll">
      <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-sm">
        <thead>
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                className="border-b border-console-line bg-console-bg px-4 py-3 text-xs font-semibold uppercase tracking-normal text-console-muted first:rounded-tl-md last:rounded-tr-md"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="group">
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className="border-b border-console-line px-4 py-3 align-middle text-console-ink group-hover:bg-console-bg/60"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
