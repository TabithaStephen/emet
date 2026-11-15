"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertIcon, ArrowRightIcon, CheckIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  ROLE_BLURB,
  ROLE_LABEL,
  accountFor,
  authenticate,
  signIn,
  type Role,
} from "@/lib/auth";

const ROLES: Role[] = ["creator", "approver"];

export function LoginForm({ nextPath }: { nextPath: string | null }) {
  const router = useRouter();

  const [role, setRole] = useState<Role>("creator");
  const [email, setEmail] = useState(accountFor("creator").email);
  const [password, setPassword] = useState(accountFor("creator").password);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Switching role swaps in that role's demo credentials. */
  const pickRole = (next: Role) => {
    setRole(next);
    setEmail(accountFor(next).email);
    setPassword(accountFor(next).password);
    setError(null);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const session = authenticate(email, password, role);
    if (!session) {
      setError(
        `Those details do not match the ${ROLE_LABEL[role]} account. Check the demo credentials below.`,
      );
      return;
    }

    setBusy(true);
    signIn(session);
    // Land on the requested page if there was one, else the role's own home.
    router.replace(nextPath ?? accountFor(role).landing);
  };

  return (
    <form onSubmit={submit} className="space-y-7">
      {/* Role picker */}
      <fieldset className="space-y-3">
        <legend className="text-[0.7rem] font-medium uppercase tracking-[0.14em] text-foreground-muted">
          Sign in as
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {ROLES.map((option) => {
            const active = role === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => pickRole(option)}
                aria-pressed={active}
                className={`rounded-md border px-4 py-3.5 text-left transition-colors duration-200 ${
                  active
                    ? "border-accent/55 bg-accent/10"
                    : "border-border bg-background-secondary hover:border-silver/30"
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm text-foreground">
                    {ROLE_LABEL[option]}
                  </span>
                  {active ? (
                    <CheckIcon width={14} height={14} className="text-accent" />
                  ) : null}
                </span>
                <span className="mt-1.5 block text-xs leading-relaxed text-foreground-muted">
                  {ROLE_BLURB[option]}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="space-y-5">
        <label className="block">
          <span className="mb-1.5 block text-[0.7rem] font-medium uppercase tracking-[0.14em] text-foreground-muted">
            Email
          </span>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-border bg-background-secondary px-3.5 py-2.5 text-sm text-foreground transition-colors duration-200 hover:border-silver/25 focus:border-accent/60 focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[0.7rem] font-medium uppercase tracking-[0.14em] text-foreground-muted">
            Password
          </span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-border bg-background-secondary px-3.5 py-2.5 text-sm text-foreground transition-colors duration-200 hover:border-silver/25 focus:border-accent/60 focus:outline-none"
          />
        </label>
      </div>

      {error ? (
        <p
          role="alert"
          className="flex items-start gap-3 rounded-md border border-critical/40 bg-critical/10 px-4 py-3 text-xs leading-relaxed text-critical"
        >
          <AlertIcon width={14} height={14} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Signing in…" : `Continue as ${ROLE_LABEL[role]}`}
        <ArrowRightIcon width={16} height={16} />
      </Button>
    </form>
  );
}
