import Link from "next/link";
import { ArrowRightIcon, AuditIcon, ImageIcon } from "@/components/icons";

export const metadata = {
  title: "êmet — Brand governance",
  description:
    "AI-powered brand governance. Sign in, or explore a guided demo with no account required.",
};

/**
 * The public front door.
 *
 * Signed-out visitors to the root domain land here. It offers exactly two
 * routes onward — sign in, or the guided demo — and bypasses nothing: the
 * application itself is still gated by proxy.ts.
 */
export default function WelcomePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-14 sm:px-6">
      <div className="w-full max-w-3xl">
        <div className="text-center">
          <span aria-hidden className="mx-auto mb-5 block h-7 w-px bg-accent" />
          <h1 className="font-display text-4xl leading-none tracking-tight text-foreground sm:text-5xl">
            êmet
          </h1>
          <p className="mt-4 text-[0.65rem] uppercase tracking-[0.2em] text-accent/75">
            Brand governance
          </p>
          <p className="mx-auto mt-7 max-w-xl text-sm leading-relaxed text-foreground-muted sm:text-base">
            Define your brand once. Every piece of content and artwork is checked
            against it before it ships — with a person making the final call.
          </p>
        </div>

        <div className="mt-11 grid gap-5 sm:grid-cols-2">
          {/* Option A */}
          <Link
            href="/login"
            className="group flex flex-col rounded-lg border border-border bg-surface px-6 py-7 transition-colors duration-200 hover:border-accent/45"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-accent/30 text-accent">
              <AuditIcon width={18} height={18} />
            </span>
            <h2 className="mt-5 font-display text-2xl tracking-tight text-foreground">
              Sign in
            </h2>
            <p className="mt-2.5 flex-1 text-sm leading-relaxed text-foreground-muted">
              Open the full workspace: Brand DNA, live Gemini audits, visual
              compliance and the approval queue.
            </p>
            <span className="mt-6 inline-flex items-center gap-2 text-sm text-accent transition-colors duration-200 group-hover:text-accent/80">
              Continue to sign in
              <ArrowRightIcon width={15} height={15} />
            </span>
          </Link>

          {/* Option B */}
          <Link
            href="/demo"
            className="group flex flex-col rounded-lg border border-border bg-surface px-6 py-7 transition-colors duration-200 hover:border-accent/45"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-silver/30 text-silver">
              <ImageIcon width={18} height={18} />
            </span>
            <h2 className="mt-5 font-display text-2xl tracking-tight text-foreground">
              Explore guided demo
            </h2>
            <p className="mt-2.5 flex-1 text-sm leading-relaxed text-foreground-muted">
              An eight-step walkthrough of the whole workflow. No account, no
              sign-up, nothing to install.
            </p>
            <span className="mt-6 inline-flex items-center gap-2 text-sm text-accent transition-colors duration-200 group-hover:text-accent/80">
              Start the demo
              <ArrowRightIcon width={15} height={15} />
            </span>
          </Link>
        </div>

        <p className="mx-auto mt-9 max-w-xl text-center text-xs leading-relaxed text-foreground-muted/80">
          The guided demo is a simulated demonstration built on a fictional brand
          called NovaTech. Its findings and figures are prepared sample data, not
          live AI analysis, and nothing you do inside it affects a real account.
        </p>
      </div>
    </main>
  );
}
