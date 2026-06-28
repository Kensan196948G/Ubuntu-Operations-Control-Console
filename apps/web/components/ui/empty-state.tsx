export function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-console-line bg-console-bg px-5 py-8 text-center">
      <p className="font-medium text-console-ink">{title}</p>
      {detail ? <p className="mt-1 text-sm text-console-muted">{detail}</p> : null}
    </div>
  );
}
