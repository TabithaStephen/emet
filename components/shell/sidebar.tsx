"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/components/shell/nav";

interface SidebarProps {
  /** Called after a link is followed, so the mobile drawer can close itself. */
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col border-r border-border bg-background-secondary">
      {/* Wordmark */}
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-6">
        <span aria-hidden className="h-6 w-px bg-accent" />
        <Link
          href="/"
          onClick={onNavigate}
          className="font-display text-2xl leading-none tracking-tight text-foreground"
        >
          êmet
        </Link>
      </div>

      <nav aria-label="Primary" className="flex-1 overflow-y-auto px-3 py-6">
        <p className="px-3 pb-3 text-[0.6rem] font-medium uppercase tracking-[0.2em] text-foreground-muted/70">
          Workspace
        </p>
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={`group relative flex items-center gap-3 rounded-md py-2.5 pl-4 pr-3 text-sm transition-colors duration-200 ${
                    active
                      ? "bg-surface text-foreground"
                      : "text-foreground-muted hover:bg-surface/60 hover:text-foreground"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full transition-colors duration-200 ${
                      active ? "bg-accent" : "bg-transparent"
                    }`}
                  />
                  <Icon
                    className={`shrink-0 transition-colors duration-200 ${
                      active ? "text-accent" : "text-silver/60 group-hover:text-silver"
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="shrink-0 border-t border-border px-6 py-5">
        <p className="text-[0.65rem] uppercase tracking-[0.16em] text-foreground-muted/70">
          Workspace
        </p>
        <p className="mt-1.5 truncate text-sm text-foreground">Northwind Capital</p>
        <p className="mt-0.5 text-xs text-foreground-muted">Governance · Phase 1 preview</p>
      </div>
    </div>
  );
}
