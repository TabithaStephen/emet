"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { CloseIcon } from "@/components/icons";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";

export function AppShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);

  // Close the drawer whenever the route changes, including browser back/forward.
  // Adjusting state during render is React's recommended alternative to an effect.
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setMenuOpen(false);
  }

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // The sign-in screen stands alone: no sidebar and no top bar until there is
  // a session. Hooks above still run unconditionally, so this early return is
  // safe for the rules of hooks.
  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-full">
      {/* Permanent sidebar from lg up */}
      <aside className="fixed inset-y-0 left-0 hidden w-[264px] lg:block">
        <Sidebar />
      </aside>

      {/* Mobile drawer */}
      {menuOpen ? (
        <div className="lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
          />
          <div className="fixed inset-y-0 left-0 z-50 w-[264px] max-w-[85vw] shadow-[0_0_60px_rgba(0,0,0,0.6)]">
            <Sidebar onNavigate={() => setMenuOpen(false)} />
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Close navigation"
              className="absolute right-3 top-4 rounded-md p-2 text-foreground-muted transition-colors duration-200 hover:text-foreground"
            >
              <CloseIcon width={18} height={18} />
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-[264px]">
        <Topbar onOpenMenu={() => setMenuOpen(true)} />
        <main className="flex-1 px-4 py-10 sm:px-8 sm:py-12 lg:px-12">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
