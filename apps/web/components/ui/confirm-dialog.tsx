"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/ui";

export type ConfirmState = {
  title: string;
  target: string;
  detail: string;
  confirmLabel: string;
  variant: "danger" | "warning";
  onConfirm: () => Promise<void> | void;
};

export function ConfirmDialog({
  state,
  busy,
  onClose
}: {
  state: ConfirmState | null;
  busy?: boolean;
  onClose: () => void;
}) {
  if (!state) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-lg border border-console-line bg-white shadow-2xl">
        <div className="flex items-start gap-3 border-b border-console-line p-5">
          <span className="rounded-md bg-amber-50 p-2 text-amber-700">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-console-ink">{state.title}</h2>
            <p className="mt-1 text-sm text-console-muted">{state.detail}</p>
          </div>
        </div>
        <div className="p-5">
          <p className="text-xs font-semibold uppercase tracking-normal text-console-muted">Target</p>
          <p className="mt-1 rounded-md border border-console-line bg-console-bg px-3 py-2 font-mono text-sm text-console-ink">
            {state.target}
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-console-line px-5 py-4">
          <button
            className="rounded-md border border-console-line bg-white px-4 py-2 text-sm font-medium text-console-ink hover:bg-console-bg"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            className={cn(
              "rounded-md px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70",
              state.variant === "danger" ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700"
            )}
            onClick={state.onConfirm}
            disabled={busy}
          >
            {busy ? "Working..." : state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
