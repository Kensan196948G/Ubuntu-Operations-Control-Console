"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Boxes,
  ClipboardList,
  Container,
  FileClock,
  Gauge,
  Layers3,
  ScrollText,
  Settings,
  ShieldCheck
} from "lucide-react";
import { cn } from "@/lib/ui";

const navItems = [
  { href: "/", label: "Dashboard", icon: Gauge },
  { href: "/systemd", label: "systemd", icon: Activity },
  { href: "/docker", label: "Docker", icon: Container },
  { href: "/compose", label: "Compose", icon: Layers3 },
  { href: "/logs", label: "Logs", icon: ScrollText },
  { href: "/operations", label: "Operations", icon: ClipboardList },
  { href: "/audit-logs", label: "Audit Logs", icon: FileClock },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-console-line bg-white/92 backdrop-blur">
        <div className="flex min-h-16 flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-6">
          <Link href="/" className="flex items-center gap-3 text-lg font-semibold text-console-ink">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#dd4814] text-white">
              <Boxes className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>Ubuntu Ops Control Console</span>
          </Link>
          <div className="flex flex-wrap items-center gap-2 text-sm text-console-muted">
            <span className="rounded-md border border-console-line bg-console-bg px-3 py-1.5">Host: ubuntu-home</span>
            <span className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-700">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Agent: Online
            </span>
            <span className="rounded-md border border-console-line bg-console-bg px-3 py-1.5">
              Updated: live
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1560px] grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="border-b border-console-line bg-console-sidebar md:min-h-[calc(100vh-65px)] md:border-b-0 md:border-r">
          <nav className="flex gap-1 overflow-x-auto p-3 md:flex-col md:gap-1.5 md:p-4" aria-label="Primary">
            {navItems.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex shrink-0 items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition",
                    active
                      ? "bg-white text-console-ink shadow-sm"
                      : "text-slate-300 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="min-w-0 px-4 py-5 md:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
