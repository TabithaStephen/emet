"use client";

import type { ReactNode } from "react";
import { useSession } from "@/lib/auth";
import { useGreeting } from "@/lib/greeting";
import { CURRENT_USER } from "@/lib/user";

interface WelcomeHeaderProps {
  /** The primary action, kept to the right of the greeting on wide screens. */
  action?: ReactNode;
  /** One quiet line of workspace status, under the action. */
  status?: string;
}

/**
 * The Command Centre's opening block. Used on that screen only — every other
 * screen keeps the standard `PageHeader`.
 *
 * Mirrors the established header rhythm (gold eyebrow, hairline, serif title)
 * so it reads as part of the same system, then adds the two lines of welcome
 * beneath. Before hydration the greeting is unknown, so the title falls back to
 * the name alone rather than guessing a time of day.
 */
export function WelcomeHeader({ action, status }: WelcomeHeaderProps) {
  const greeting = useGreeting();
  const session = useSession();
  // Name whoever is signed in; fall back to the stored profile before hydration.
  const firstName = session?.firstName ?? CURRENT_USER.firstName;

  return (
    <header className="border-b border-border pb-10">
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
        <div className="min-w-0 max-w-2xl">
          <p className="text-[0.65rem] font-medium uppercase tracking-[0.2em] text-accent/80">
            Command Centre
          </p>
          <span aria-hidden className="mt-4 block h-px w-10 bg-accent/50" />

          <h1 className="mt-5 font-display text-3xl leading-tight tracking-tight text-foreground sm:text-4xl lg:text-[2.6rem]">
            {greeting ? `${greeting}, ${firstName}.` : `${firstName}.`}
          </h1>

          <p className="mt-4 text-base leading-relaxed text-foreground-muted sm:text-lg">
            What are we bringing into alignment today?
          </p>

          <p className="mt-5 text-[0.7rem] uppercase tracking-[0.18em] text-accent/70">
            Your brand. Your standards. Every interaction.
          </p>
        </div>

        {action ? (
          <div className="flex shrink-0 flex-col items-start gap-2.5 sm:items-end">
            {action}
            {status ? (
              <p className="max-w-64 text-xs leading-relaxed text-foreground-muted sm:text-right">
                {status}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}
