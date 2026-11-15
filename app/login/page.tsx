import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { DEMO_ACCOUNTS, ROLE_LABEL, safeNextPath } from "@/lib/auth-shared";

export const metadata = {
  title: "Sign in — êmet",
};

/**
 * The application's entry point. Rendered without the app shell: no sidebar and
 * no top bar until there is a session (see `components/shell/app-shell.tsx`).
 */
/**
 * Reads `?next=` inside the Suspense boundary.
 *
 * `searchParams` is request-time data, so awaiting it in the page body would
 * stop the whole screen prerendering under `cacheComponents`. The promise is
 * passed down un-awaited instead: the page stays static and only this part
 * waits for the request.
 */
async function SignInForm({
  searchParams,
}: {
  searchParams: PageProps<"/login">["searchParams"];
}) {
  const params = await searchParams;
  // Only internal paths are accepted, so ?next= cannot bounce anyone off-site.
  return <LoginForm nextPath={safeNextPath(params?.next)} />;
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-12 sm:px-6">
      <div className="w-full max-w-md">
        {/* Wordmark */}
        <div className="mb-10 text-center">
          <span
            aria-hidden
            className="mx-auto mb-5 block h-7 w-px bg-accent"
          />
          <h1 className="font-display text-4xl leading-none tracking-tight text-foreground">
            êmet
          </h1>
          <p className="mt-4 text-[0.65rem] uppercase tracking-[0.2em] text-accent/75">
            Brand governance
          </p>
        </div>

        <div className="rounded-lg border border-border bg-surface px-6 py-8 shadow-[0_1px_0_0_rgba(243,240,232,0.03)_inset] sm:px-8">
          <h2 className="font-display text-2xl tracking-tight text-foreground">
            Sign in
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
            Choose a role to see the workspace built for it.
          </p>

          <div className="mt-7">
            <Suspense
              fallback={
                <p className="py-8 text-center text-sm text-foreground-muted">
                  Loading sign-in…
                </p>
              }
            >
              <SignInForm searchParams={searchParams} />
            </Suspense>
          </div>
        </div>

        {/* Demo credentials, on screen so the demo needs no cheat sheet */}
        <section className="mt-6 rounded-lg border border-dashed border-border px-6 py-5">
          <h3 className="text-[0.6rem] font-medium uppercase tracking-[0.16em] text-foreground-muted">
            Demo credentials
          </h3>
          <dl className="mt-3.5 space-y-3">
            {DEMO_ACCOUNTS.map((account) => (
              <div key={account.email} className="flex flex-wrap gap-x-3 gap-y-1">
                <dt className="w-20 shrink-0 text-xs text-accent/80">
                  {ROLE_LABEL[account.role]}
                </dt>
                <dd className="min-w-0 font-mono text-xs text-foreground">
                  {account.email}
                  <span className="text-foreground-muted"> · </span>
                  {account.password}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs leading-relaxed text-foreground-muted/80">
            Prototype sign-in only. Credentials are checked in the browser and the
            session is an unsigned cookie — it demonstrates the two roles, it is
            not security.
          </p>
        </section>
      </div>
    </main>
  );
}
