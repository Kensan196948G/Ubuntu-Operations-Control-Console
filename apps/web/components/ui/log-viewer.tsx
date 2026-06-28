import { cn } from "@/lib/ui";

function lineTone(line: string) {
  const normalized = line.toLowerCase();
  if (normalized.includes("error") || normalized.includes("failed") || normalized.includes("fatal")) {
    return "bg-red-950/50 text-red-100";
  }
  if (normalized.includes("warn")) return "bg-amber-950/45 text-amber-100";
  return "text-slate-200";
}

export function LogViewer({ lines }: { lines: string[] }) {
  return (
    <div className="log-scroll max-h-[620px] overflow-auto rounded-lg border border-slate-700 bg-[#101827] p-3 font-mono text-sm leading-6 shadow-inner">
      {lines.length === 0 ? (
        <p className="px-2 py-6 text-center text-slate-400">No log lines returned.</p>
      ) : (
        <ol>
          {lines.map((line, index) => (
            <li key={`${index}-${line}`} className={cn("grid grid-cols-[4.5rem_minmax(0,1fr)] rounded px-2", lineTone(line))}>
              <span className="select-none text-slate-500">{String(index + 1).padStart(4, "0")}</span>
              <span className="whitespace-pre-wrap break-words">{line}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
