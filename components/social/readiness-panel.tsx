"use client";

import { AlertIcon, CheckIcon } from "@/components/icons";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { formatBytes } from "@/lib/social/format-bytes";
import { readinessVerdict } from "@/lib/social/readiness";
import type { PlatformCheck, PlatformReadiness } from "@/lib/types";

/**
 * Platform readiness, kept visually distinct from brand compliance.
 *
 * The two are different claims about different things, so they never share a
 * score, a panel or a severity vocabulary. Every row states what was measured,
 * what was expected, and — where a requirement exists — a link to the
 * documentation it came from, so a reader can check the rule rather than
 * trust it.
 */

function StateMark({ check }: { check: PlatformCheck }) {
  if (check.state === "pass") {
    return (
      <span className="mt-0.5 inline-flex shrink-0 items-center gap-1.5 text-positive">
        <CheckIcon width={15} height={15} />
        <span className="text-[0.6rem] uppercase tracking-[0.1em]">Pass</span>
      </span>
    );
  }
  if (check.state === "fail") {
    return (
      <span className="mt-0.5 inline-flex shrink-0 items-center gap-1.5 text-critical">
        <AlertIcon width={15} height={15} />
        <span className="text-[0.6rem] uppercase tracking-[0.1em]">Fail</span>
      </span>
    );
  }
  return (
    <span className="mt-0.5 inline-flex shrink-0 items-center gap-1.5 text-silver">
      <span aria-hidden className="text-sm leading-none">·</span>
      <span className="text-[0.6rem] uppercase tracking-[0.1em]">Info</span>
    </span>
  );
}

function CheckRow({ check }: { check: PlatformCheck }) {
  return (
    <li className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
      <StateMark check={check} />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h4 className="text-sm text-foreground">{check.label}</h4>
          <span className="font-mono text-xs text-foreground-muted">
            {check.measured}
            {check.expected ? ` · expected ${check.expected}` : ""}
          </span>
          {/*
            An advisory is marked in words as well as position, so it cannot be
            mistaken for a requirement the platform actually publishes.
          */}
          {check.confidence === "advisory" ? (
            <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.1em] text-accent">
              Not officially documented
            </span>
          ) : null}
          {!check.scored ? (
            <span className="text-[0.6rem] uppercase tracking-[0.1em] text-foreground-muted/70">
              Not scored
            </span>
          ) : null}
        </div>
        <p className="text-xs leading-relaxed text-foreground-muted">
          {check.explanation}
        </p>
        {check.suggestion ? (
          <p className="text-xs leading-relaxed text-positive">{check.suggestion}</p>
        ) : null}
        {check.source ? (
          <p className="text-xs leading-relaxed text-foreground-muted/80">
            <a
              href={check.source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline decoration-dotted underline-offset-4"
            >
              {check.source.title}
            </a>
            {" · checked "}
            {check.source.verifiedOn}
            {check.source.caveat ? ` · ${check.source.caveat}` : ""}
          </p>
        ) : null}
      </div>
    </li>
  );
}

export function ReadinessPanel({ readiness }: { readiness: PlatformReadiness }) {
  const scored = readiness.checks.filter((c) => c.scored);
  const unscored = readiness.checks.filter((c) => !c.scored);

  return (
    <Panel>
      <PanelHeader
        eyebrow="Platform readiness"
        title={`${readiness.platformLabel} requirements`}
        description="Measured, not reviewed: these are arithmetic checks against the platform's published specification. Separate from brand compliance."
        action={
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[0.65rem] uppercase tracking-[0.1em] ${
              readiness.score === null
                ? "border-silver/30 text-silver"
                : readiness.failed === 0
                  ? "border-positive/40 bg-positive/10 text-positive"
                  : "border-critical/40 bg-critical/10 text-critical"
            }`}
          >
            {readiness.score === null ? "Not applicable" : `${readiness.score}% ready`}
          </span>
        }
      />
      <PanelBody className="space-y-7">
        <p className="text-sm leading-relaxed text-foreground">
          {readinessVerdict(readiness)}
        </p>

        {/* Requirement 4: the score must show its calculation. */}
        <details className="group rounded-md border border-border bg-background-secondary px-4 py-3">
          <summary className="cursor-pointer list-none text-xs text-accent transition-colors duration-200 hover:text-accent/75">
            How is this readiness score calculated?
          </summary>
          <p className="mt-2.5 text-xs leading-relaxed text-foreground-muted">
            {readiness.scoreRationale}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-foreground-muted/80">
            Only requirements a platform publishes in its own documentation can
            affect this score. Conventions that are widely followed but
            unofficial are shown and measured, never counted.
          </p>
        </details>

        {scored.length > 0 ? (
          <div>
            <h3 className="mb-3 text-[0.65rem] font-medium uppercase tracking-[0.18em] text-accent/80">
              Documented requirements · counted
            </h3>
            <ul className="divide-y divide-border">
              {scored.map((check) => (
                <CheckRow key={check.id} check={check} />
              ))}
            </ul>
          </div>
        ) : null}

        {unscored.length > 0 ? (
          <div className="border-t border-border pt-6">
            <h3 className="mb-2 text-[0.65rem] font-medium uppercase tracking-[0.18em] text-silver/80">
              Measurements and advisories · not counted
            </h3>
            <p className="mb-3 text-xs leading-relaxed text-foreground-muted">
              Useful to know, but not requirements the platform publishes, so
              none of these affects the score above.
            </p>
            <ul className="divide-y divide-border">
              {unscored.map((check) => (
                <CheckRow key={check.id} check={check} />
              ))}
            </ul>
          </div>
        ) : null}

        {readiness.creative ? (
          <p className="border-t border-border pt-5 text-xs leading-relaxed text-foreground-muted">
            Creative measured in your browser: {readiness.creative.name} ·{" "}
            {readiness.creative.width}×{readiness.creative.height} ·{" "}
            {formatBytes(readiness.creative.bytes)}. The image
            itself was not uploaded, not sent to Gemini and not stored — only
            these measurements were kept.
          </p>
        ) : null}
      </PanelBody>
    </Panel>
  );
}
