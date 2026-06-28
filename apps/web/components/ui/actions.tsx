"use client";

import Link from "next/link";
import { Play, RotateCw, ScrollText, Square } from "lucide-react";
import { cn } from "@/lib/ui";
import type { ActionName, TargetType } from "@/lib/types";

export function ActionButton({
  action,
  onClick,
  disabled
}: {
  action: ActionName;
  onClick: () => void;
  disabled?: boolean;
}) {
  const Icon = action === "start" ? Play : action === "stop" ? Square : RotateCw;
  return (
    <button
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
        action === "stop"
          ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
          : action === "restart"
            ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
            : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
      )}
      onClick={onClick}
      disabled={disabled}
      title={action}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span className="hidden lg:inline capitalize">{action}</span>
    </button>
  );
}

export function LogsLink({ type, id }: { type: TargetType; id: string }) {
  return (
    <Link
      href={`/logs?type=${type}&id=${encodeURIComponent(id)}`}
      className="inline-flex h-9 items-center gap-2 rounded-md border border-console-line bg-white px-3 text-sm font-medium text-console-ink hover:bg-console-bg"
      title="View logs"
    >
      <ScrollText className="h-4 w-4" aria-hidden="true" />
      <span className="hidden lg:inline">Logs</span>
    </Link>
  );
}
