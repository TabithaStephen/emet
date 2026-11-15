"use client";

import { usePathname, useRouter } from "next/navigation";
import { MenuIcon } from "@/components/icons";
import { matchNav } from "@/components/shell/nav";
import { ButtonLink } from "@/components/ui/button";
import { ROLE_LABEL, signOut, useSession } from "@/lib/auth";

interface TopbarProps {
  onOpenMenu: () => void;
}

export function Topbar({ onOpenMenu }: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSession();
  const current = matchNav(pathname);

  const leave = () => {
    signOut();
    router.replace("/login");
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-4 border-b border-border bg-background/85 px-4 backdrop-blur-sm sm:px-8">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Open navigation"
        className="rounded-md p-2 text-foreground-muted transition-colors duration-200 hover:bg-surface hover:text-foreground lg:hidden"
      >
        <MenuIcon width={20} height={20} />
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-foreground">
          {current?.label ?? "êmet"}
        </p>
        <p className="hidden truncate text-xs text-foreground-muted sm:block">
          {current?.description ?? "Brand governance"}
        </p>
      </div>

      <div className="hidden sm:block">
        <ButtonLink href="/audit" variant="secondary" size="sm">
          New audit
        </ButtonLink>
      </div>

      {/*
        The session is read from the cookie in the browser, so it is null for
        the first paint. Render a neutral placeholder rather than "Signed out",
        which would flash a state that is not true. Reading the cookie on the
        server would remove the placeholder entirely, at the cost of making
        every route dynamic — not a trade worth making at feature freeze.
      */}
      <div className="flex items-center gap-3 border-l border-border pl-4">
        <div className="hidden min-w-28 text-right md:block">
          {session ? (
            <>
              <p className="text-xs leading-tight text-foreground">
                {session.name}
              </p>
              <p className="text-[0.7rem] leading-tight text-foreground-muted">
                {ROLE_LABEL[session.role]} · {session.jobTitle}
              </p>
            </>
          ) : (
            <span className="sr-only">Loading account</span>
          )}
        </div>
        <span
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-accent/30 bg-surface text-xs tracking-wide text-accent"
        >
          {session?.initials ?? ""}
        </span>
        <button
          type="button"
          onClick={leave}
          className="rounded-md border border-border px-2.5 py-1.5 text-[0.65rem] uppercase tracking-[0.1em] text-foreground-muted transition-colors duration-200 hover:border-critical/40 hover:text-critical"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
