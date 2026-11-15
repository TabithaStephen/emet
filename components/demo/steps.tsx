"use client";

import Image from "next/image";
import { HighlightedContent } from "@/components/audit/highlighted-content";
import { HBarChart } from "@/components/charts/h-bar-chart";
import { LineChart } from "@/components/charts/line-chart";
import { ScoreDial } from "@/components/charts/score-dial";
import { SeverityDistribution } from "@/components/charts/severity-distribution";
import { ArrowRightIcon, CheckIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { DemoTag, StatTile } from "@/components/ui/data";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { SEVERITY_EDGE, SEVERITY_VAR, SeverityBadge } from "@/components/ui/severity";
import { scoreFromFindings } from "@/lib/audit-engine";
import { NOVATECH_APPROVED, NOVATECH_MODIFIED } from "@/lib/demo-assets";
import {
  DEMO_DRAFT,
  DEMO_FINDINGS,
  DEMO_INSIGHT_RULES,
  DEMO_INSIGHT_SEVERITY,
  DEMO_INSIGHT_TILES,
  DEMO_INSIGHT_TREND,
  DEMO_JOURNEY,
  DEMO_SUMMARY,
  DEMO_VISUAL_DEVIATIONS,
  NOVATECH_BRAND,
} from "@/lib/demo-script";
import type { Severity } from "@/lib/types";

/** Marks anything the visitor might mistake for live AI output. */
export function SimulatedNotice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-accent/30 bg-accent/10 px-4 py-3 text-xs leading-relaxed text-accent">
      {children}
    </p>
  );
}

/* ---- Step 1 ------------------------------------------------------------ */

export function StepWelcome() {
  return (
    <div className="space-y-8">
      <p className="text-sm leading-relaxed text-foreground-muted sm:text-base">
        Most organisations write their brand rules once, then watch them erode.
        A claim creeps into an email. A logo gets rebuilt from memory. By the
        time anyone notices, the inconsistency is already public — and whoever
        wrote it never meant to break a rule.
      </p>
      <p className="text-sm leading-relaxed text-foreground-muted sm:text-base">
        êmet turns those rules into something a machine can check. You define
        the brand once, and every piece of content and artwork is measured
        against it before it ships — with a person making the final call.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {DEMO_JOURNEY.map((stage, index) => (
          <div
            key={stage.title}
            className="rounded-lg border border-border bg-surface px-5 py-4"
          >
            <span className="text-[0.6rem] uppercase tracking-[0.16em] text-accent/70">
              Stage {index + 1}
            </span>
            <h3 className="mt-2 text-sm text-foreground">{stage.title}</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-foreground-muted">
              {stage.blurb}
            </p>
          </div>
        ))}
      </div>

      <SimulatedNotice>
        This walkthrough uses a fictional brand called NovaTech and prepared
        sample results, so it runs without an account or an API key. The real
        product sends your content to Google Gemini.
      </SimulatedNotice>
    </div>
  );
}

/* ---- Step 2 ------------------------------------------------------------ */

const BRAND_TABS = [
  "Identity",
  "Voice",
  "Terminology",
  "Messaging",
  "Approved facts",
  "Prohibited claims",
] as const;
export type BrandTab = (typeof BRAND_TABS)[number];
export const DEFAULT_BRAND_TAB: BrandTab = "Identity";

export function StepBrandDna({
  tab,
  onTab,
}: {
  tab: BrandTab;
  onTab: (t: BrandTab) => void;
}) {
  const b = NOVATECH_BRAND;

  return (
    <div className="space-y-6">
      <p className="text-sm leading-relaxed text-foreground-muted">
        Everything an audit checks comes from here. Change a rule and the next
        audit enforces the new one — nothing is hardcoded into the reviewer.
      </p>

      <div role="tablist" aria-label="Brand DNA sections" className="flex flex-wrap gap-2">
        {BRAND_TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => onTab(t)}
            className={`rounded-full border px-3.5 py-1.5 text-xs transition-colors duration-200 ${
              tab === t
                ? "border-accent/50 bg-accent/10 text-foreground"
                : "border-border text-foreground-muted hover:border-silver/30 hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <Panel>
        <PanelBody className="space-y-4">
          {tab === "Identity" ? (
            <dl className="grid gap-4 sm:grid-cols-2">
              {[
                ["Name", b.identity.name],
                ["Industry", b.identity.industry],
                ["Tagline", b.identity.tagline],
                ["Mission", b.identity.mission],
                ["Audience", b.identity.audience],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[0.65rem] uppercase tracking-[0.14em] text-foreground-muted">
                    {k}
                  </dt>
                  <dd className="mt-1.5 text-sm leading-relaxed text-foreground">{v}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {tab === "Voice" ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {b.voice.personality.map((p) => (
                  <span
                    key={p}
                    className="rounded-full border border-border bg-surface-elevated px-3.5 py-1.5 text-xs text-foreground"
                  >
                    {p}
                  </span>
                ))}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-[0.65rem] uppercase tracking-[0.14em] text-positive">
                    Always
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-foreground-muted">
                    {b.voice.toneDo}
                  </p>
                </div>
                <div>
                  <p className="text-[0.65rem] uppercase tracking-[0.14em] text-critical">
                    Never
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-foreground-muted">
                    {b.voice.toneAvoid}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {tab === "Terminology" ? (
            <ul className="space-y-3">
              {b.terminology.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-background-secondary px-4 py-3"
                >
                  <span className="font-mono text-xs text-critical line-through">
                    {t.avoid}
                  </span>
                  <ArrowRightIcon width={14} height={14} className="text-foreground-muted" />
                  <span className="font-mono text-xs text-positive">{t.prefer}</span>
                  <span className="w-full text-xs leading-relaxed text-foreground-muted sm:w-auto sm:flex-1">
                    {t.note}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {tab === "Messaging" ? (
            <div className="space-y-4">
              <ul className="space-y-2.5">
                {b.messaging.pillars.map((p) => (
                  <li key={p} className="flex gap-3 text-sm text-foreground">
                    <span aria-hidden className="mt-2.5 h-px w-4 shrink-0 bg-accent/60" />
                    {p}
                  </li>
                ))}
              </ul>
              <p className="rounded-md border border-border bg-background-secondary px-4 py-3 text-xs leading-relaxed text-foreground-muted">
                <span className="text-foreground">Boilerplate:</span>{" "}
                {b.messaging.boilerplate}
              </p>
            </div>
          ) : null}

          {tab === "Approved facts" ? (
            <ul className="space-y-3">
              {b.approvedFacts.map((f) => (
                <li key={f.id} className="rounded-md border border-border bg-background-secondary px-4 py-3">
                  <p className="text-sm text-foreground">{f.statement}</p>
                  <p className="mt-1.5 text-xs text-foreground-muted">Source: {f.source}</p>
                </li>
              ))}
            </ul>
          ) : null}

          {tab === "Prohibited claims" ? (
            <ul className="space-y-3">
              {b.prohibitedClaims.map((c) => (
                <li
                  key={c.id}
                  className="rounded-md border-l-2 border-l-critical border-y border-r border-border bg-background-secondary px-4 py-3"
                >
                  <p className="font-mono text-sm text-critical">“{c.phrase}”</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-foreground-muted">
                    {c.reason}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
        </PanelBody>
      </Panel>
    </div>
  );
}

/* ---- Step 3 ------------------------------------------------------------ */

export function StepVisual({
  revealed,
  onReveal,
}: {
  revealed: boolean;
  onReveal: () => void;
}) {
  return (
    <div className="space-y-6">
      <p className="text-sm leading-relaxed text-foreground-muted">
        Artwork drifts the same way words do. êmet compares a candidate asset
        against the approved mark and reports colour, proportion, typography and
        anything added that should not be there.
      </p>

      <div className="grid gap-5 md:grid-cols-2">
        {[
          { asset: NOVATECH_APPROVED, label: "Approved reference", tone: "text-positive" },
          { asset: NOVATECH_MODIFIED, label: "Candidate found in use", tone: "text-critical" },
        ].map(({ asset, label, tone }) => (
          <div key={asset.id}>
            <p className={`text-[0.65rem] uppercase tracking-[0.14em] ${tone}`}>{label}</p>
            <div className="mt-2.5 flex h-36 items-center justify-center rounded-md border border-border bg-white p-4">
              <Image
                src={asset.src}
                alt={asset.label}
                width={1200}
                height={420}
                unoptimized
                className="max-h-full w-auto object-contain"
              />
            </div>
          </div>
        ))}
      </div>

      {!revealed ? (
        <div className="flex flex-wrap items-center gap-4">
          <Button onClick={onReveal}>Show what êmet found</Button>
          <p className="text-xs text-foreground-muted">
            Look at the two marks first — how many differences can you spot?
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <SimulatedNotice>
            Prepared sample findings. In the product both images are sent to
            Gemini and genuinely analysed.
          </SimulatedNotice>
          {DEMO_VISUAL_DEVIATIONS.map((d) => (
            <article
              key={d.title}
              className={`border-l-2 bg-background-secondary px-5 py-4 ${SEVERITY_EDGE[d.severity]}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <SeverityBadge severity={d.severity} />
                <span className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[0.65rem] text-accent">
                  {d.guideline}
                </span>
              </div>
              <h3 className="mt-3 text-sm text-foreground">{d.title}</h3>
              <p className="mt-1 text-[0.7rem] uppercase tracking-[0.12em] text-silver">
                {d.element}
              </p>
              <p className="mt-2.5 text-xs leading-relaxed text-foreground-muted">
                {d.explanation}
              </p>
              <p className="mt-3 rounded-md border border-border bg-surface px-4 py-2.5 text-xs leading-relaxed text-foreground">
                {d.recommendation}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---- Step 4 ------------------------------------------------------------ */

export function StepAudit({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const score = scoreFromFindings(DEMO_FINDINGS);
  const counts = (["critical", "high", "medium", "low"] as Severity[]).reduce(
    (acc, s) => {
      acc[s] = DEMO_FINDINGS.filter((f) => f.severity === s).length;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0 } as Record<Severity, number>,
  );

  return (
    <div className="space-y-6">
      <SimulatedNotice>
        Simulated results. These findings were written in advance so the
        walkthrough needs no API key — Gemini did not analyse this draft. The
        real AI Audit Studio sends your content to Gemini and returns findings
        in exactly this shape.
      </SimulatedNotice>

      <Panel>
        <PanelHeader
          eyebrow="Draft"
          title="NovaTech Orbit — launch email"
          description="Select any highlighted phrase to read why it was flagged."
        />
        <PanelBody>
          <HighlightedContent
            text={DEMO_DRAFT}
            findings={DEMO_FINDINGS}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        </PanelBody>
      </Panel>

      <div className="flex flex-col items-start gap-8 sm:flex-row sm:items-center">
        <ScoreDial score={score} verdict={`Compliance score ${score} out of 100.`} />
        <div className="min-w-0 flex-1 space-y-4">
          <p className="text-sm leading-relaxed text-foreground">{DEMO_SUMMARY}</p>
          <SeverityDistribution counts={counts} />
        </div>
      </div>

      <div className="space-y-3">
        {DEMO_FINDINGS.map((f) => (
          <article
            key={f.id}
            onClick={() => onSelect(f.id)}
            className={`cursor-pointer border-l-2 bg-background-secondary px-5 py-4 transition-colors duration-200 ${
              SEVERITY_EDGE[f.severity]
            } ${selectedId === f.id ? "bg-surface-elevated/60" : "hover:bg-surface-elevated/35"}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SeverityBadge severity={f.severity} />
              <span className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[0.65rem] text-accent">
                {f.guidelineRef}
              </span>
            </div>
            <h3 className="mt-3 text-sm text-foreground">{f.rule}</h3>
            <p className="mt-2 font-mono text-[0.8rem] text-silver">“{f.phrase}”</p>
            <p className="mt-2.5 text-xs leading-relaxed text-foreground-muted">
              {f.explanation}
            </p>
            <p className="mt-3 rounded-md border border-border bg-surface px-4 py-2.5 text-xs leading-relaxed text-foreground">
              <span className="text-accent/80">Suggested:</span> {f.suggestion}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}

/* ---- Step 5 ------------------------------------------------------------ */

const FIX_TARGET = DEMO_FINDINGS.find((f) => f.severity === "critical")!;

export const DEMO_DRAFT_FIXED =
  FIX_TARGET.start >= 0
    ? DEMO_DRAFT.slice(0, FIX_TARGET.start) +
      (FIX_TARGET.replacement ?? FIX_TARGET.suggestion) +
      DEMO_DRAFT.slice(FIX_TARGET.end)
    : DEMO_DRAFT;

export function StepFix({
  applied,
  onApply,
  onReset,
}: {
  applied: boolean;
  onApply: () => void;
  onReset: () => void;
}) {
  const remaining = DEMO_FINDINGS.filter((f) => f.id !== FIX_TARGET.id);
  const before = scoreFromFindings(DEMO_FINDINGS);
  const after = scoreFromFindings(remaining);

  return (
    <div className="space-y-6">
      <p className="text-sm leading-relaxed text-foreground-muted">
        A finding is only useful if it is easy to act on. Each one carries a
        replacement that drops straight into the sentence, so the author keeps
        their meaning and loses the breach.
      </p>

      <article className={`border-l-2 bg-background-secondary px-5 py-4 ${SEVERITY_EDGE.critical}`}>
        <SeverityBadge severity="critical" />
        <h3 className="mt-3 text-sm text-foreground">{FIX_TARGET.rule}</h3>
        <p className="mt-2.5 text-xs leading-relaxed text-foreground-muted">
          {FIX_TARGET.explanation}
        </p>
      </article>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.14em] text-critical">Before</p>
          <p className="mt-2.5 whitespace-pre-wrap rounded-md border border-border bg-background-secondary px-4 py-3.5 text-sm leading-relaxed text-foreground-muted">
            {DEMO_DRAFT}
          </p>
        </div>
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.14em] text-positive">
            {applied ? "After" : "After — not applied yet"}
          </p>
          <p
            className={`mt-2.5 whitespace-pre-wrap rounded-md border px-4 py-3.5 text-sm leading-relaxed transition-colors duration-300 ${
              applied
                ? "border-positive/35 bg-positive/5 text-foreground"
                : "border-dashed border-border bg-background-secondary text-foreground-muted/50"
            }`}
          >
            {applied ? DEMO_DRAFT_FIXED : DEMO_DRAFT}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {applied ? (
          <>
            <span className="inline-flex items-center gap-2 rounded-full border border-positive/35 bg-positive/10 px-3.5 py-1.5 text-xs text-positive">
              <CheckIcon width={14} height={14} />
              Fix applied · score {before} → {after}
            </span>
            <Button variant="ghost" size="sm" onClick={onReset}>
              Undo
            </Button>
          </>
        ) : (
          <>
            <Button onClick={onApply}>Apply fix</Button>
            <p className="text-xs text-foreground-muted">
              Replaces the guarantee with wording NovaTech can stand behind.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/* ---- Step 6 ------------------------------------------------------------ */

export type Decision = "pending" | "approved" | "changes";

export function StepApproval({
  decision,
  onDecide,
}: {
  decision: Decision;
  onDecide: (d: Decision) => void;
}) {
  return (
    <div className="space-y-6">
      <p className="text-sm leading-relaxed text-foreground-muted">
        êmet never publishes a decision on its own. A corrected draft goes to a
        human approver, who sees the findings, the score and the content — and
        takes responsibility for the call.
      </p>

      <Panel>
        <PanelHeader
          eyebrow="Approval queue"
          title="NovaTech Orbit — launch email"
          description="Email · submitted by John Doe · corrected once"
        />
        <PanelBody className="space-y-5">
          <p className="whitespace-pre-wrap rounded-md border border-border bg-background-secondary px-4 py-3.5 text-sm leading-relaxed text-foreground-muted">
            {DEMO_DRAFT_FIXED}
          </p>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            {(["high", "medium", "low"] as Severity[]).map((s) => (
              <span key={s} className="inline-flex items-center gap-2 text-xs text-foreground-muted">
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: SEVERITY_VAR[s] }}
                />
                {DEMO_FINDINGS.filter((f) => f.severity === s).length} {s}
              </span>
            ))}
            <span className="text-xs text-positive">critical resolved</span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
            <p className="text-xs text-foreground-muted">
              {decision === "pending"
                ? "Awaiting a decision."
                : decision === "approved"
                  ? "Approved for publication. The author is notified and the audit is archived."
                  : "Returned to the author with the remaining findings attached."}
            </p>
            <div className="flex gap-2">
              {decision === "pending" ? (
                <>
                  <Button size="sm" onClick={() => onDecide("approved")}>
                    Approve
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => onDecide("changes")}>
                    Request changes
                  </Button>
                </>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => onDecide("pending")}>
                  Undo decision
                </Button>
              )}
            </div>
          </div>

          {decision !== "pending" ? (
            <p
              className={`rounded-md border px-4 py-3 text-xs leading-relaxed ${
                decision === "approved"
                  ? "border-positive/35 bg-positive/10 text-positive"
                  : "border-critical/35 bg-critical/10 text-critical"
              }`}
            >
              {decision === "approved"
                ? "Status: Approved. In the product this writes to the approval record and shows on the Command Centre."
                : "Status: Changes requested. The author sees your note alongside the open findings."}
            </p>
          ) : null}
        </PanelBody>
      </Panel>
    </div>
  );
}

/* ---- Step 7 ------------------------------------------------------------ */

export function StepInsights() {
  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-2xl text-sm leading-relaxed text-foreground-muted">
          One audit is a correction. A hundred audits are a pattern — which
          rules get broken, on which channels, and whether it is improving.
        </p>
        <DemoTag>Illustrative sample data</DemoTag>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {DEMO_INSIGHT_TILES.map((t, i) => (
          <StatTile
            key={t.label}
            label={t.label}
            value={t.value}
            caption={t.caption}
            accent={(["sapphire", "gold", "emerald", "coral"] as const)[i]}
          />
        ))}
      </div>

      <Panel>
        <PanelHeader
          eyebrow="Trend"
          title="Compliance score over twelve weeks"
          description="Sample figures, not measured performance."
        />
        <PanelBody>
          <LineChart
            points={DEMO_INSIGHT_TREND}
            ariaLabel="Sample compliance score by week, rising from 64 to 81 out of 100."
            columns={["Week", "Score"]}
            min={50}
            max={100}
            tickEvery={2}
            footnote="Illustrative sample data."
          />
        </PanelBody>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader eyebrow="Composition" title="Findings by severity" />
          <PanelBody>
            <SeverityDistribution counts={DEMO_INSIGHT_SEVERITY} noun="violations" />
          </PanelBody>
        </Panel>
        <Panel>
          <PanelHeader eyebrow="Patterns" title="Most violated guidelines" />
          <PanelBody>
            <HBarChart
              data={DEMO_INSIGHT_RULES}
              ariaLabel={`Sample guideline violations: ${DEMO_INSIGHT_RULES.map((r) => `${r.label} ${r.value}`).join(", ")}.`}
              columns={["Guideline", "Findings"]}
            />
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}

/* ---- Step 8 ------------------------------------------------------------ */

export function StepComplete({
  onRestart,
}: {
  onRestart: () => void;
}) {
  return (
    <div className="space-y-8">
      <p className="text-sm leading-relaxed text-foreground-muted sm:text-base">
        That is the whole loop. Rules are written once, every draft and every
        asset is measured against them, corrections are one click, a person signs
        off, and the patterns feed back into the rules.
      </p>

      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {DEMO_JOURNEY.map((stage, index) => (
          <li
            key={stage.title}
            className="relative rounded-lg border border-border bg-surface px-5 py-4"
          >
            <span className="font-display text-2xl leading-none text-accent/60">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h3 className="mt-2.5 text-sm text-foreground">{stage.title}</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-foreground-muted">
              {stage.blurb}
            </p>
          </li>
        ))}
      </ol>

      <div className="rounded-lg border border-accent/25 bg-accent/5 px-6 py-6">
        <h3 className="font-display text-xl tracking-tight text-foreground">
          Brand governance that actually runs
        </h3>
        <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-foreground-muted">
          Every screen in this walkthrough exists in the product. The difference
          is that there, the audit is a real Gemini call against the rules you
          wrote, and the approval is recorded.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button variant="secondary" onClick={onRestart}>
            Restart guided demo
          </Button>
          <a
            href="/login"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-accent px-5 text-sm font-medium tracking-tight text-background transition-colors duration-200 hover:bg-accent/85"
          >
            Sign in to êmet
            <ArrowRightIcon width={16} height={16} />
          </a>
        </div>
      </div>
    </div>
  );
}
