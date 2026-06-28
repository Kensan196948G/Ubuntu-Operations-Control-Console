import { cn } from "@/lib/ui";

export function Panel({
  title,
  children,
  action,
  className
}: {
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-lg border border-console-line bg-white shadow-panel", className)}>
      {title || action ? (
        <div className="flex items-center justify-between gap-3 border-b border-console-line px-5 py-4">
          {title ? <h2 className="text-base font-semibold text-console-ink">{title}</h2> : <span />}
          {action}
        </div>
      ) : null}
      <div className="p-5">{children}</div>
    </section>
  );
}
