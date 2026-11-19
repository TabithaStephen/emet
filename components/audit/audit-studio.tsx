"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExportReportButton } from "@/components/audit/export-report-button";
import { FindingCard } from "@/components/audit/finding-card";
import { HighlightedContent } from "@/components/audit/highlighted-content";
import { ScoreDial } from "@/components/charts/score-dial";
import { SeverityDistribution } from "@/components/charts/severity-distribution";
import { AlertIcon, ArrowRightIcon, AuditIcon, CheckIcon } from "@/components/icons";
import { Button, ButtonLink } from "@/components/ui/button";
import { DemoTag } from "@/components/ui/data";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { SEVERITY_LABEL, SEVERITY_VAR } from "@/components/ui/severity";
import { auditContent, explainScore, scoreFromFindings } from "@/lib/audit-engine";
import { newAuditId, saveAudit } from "@/lib/audit-store";
import { useBrand } from "@/lib/brand-store";
import { DEMO_SUBMISSION } from "@/lib/demo-data";
import {
  SEVERITY_ORDER,
  type AuditOutcome,
  type Finding,
  type Severity,
} from "@/lib/types";

const CHANNELS = ["Email", "Web", "Social", "Print"];

/** Above the server's own 45s ceiling, so the server's clearer error wins. */
const CLIENT_TIMEOUT_MS = 60_000;

interface AuditError {
  code: string;
  message: string;
  hint?: string;
}

function countBySeverity(findings: Finding[]): Record<Severity, number> {
  return SEVERITY_ORDER.reduce(
    (acc, severity) => {
      acc[severity] = findings.filter((f) => f.severity === severity).length;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0 } as Record<Severity, number>,
  );
}

const words = (value: string) =>
  value.trim() ? value.trim().split(/\s+/).length : 0;

export function AuditStudio({
  configured,
  model,
}: {
  configured: boolean;
  model: string;
}) {
  const { brand } = useBrand();

  const [title, setTitle] = useState("Q4 partner letter — opening section");
  const [channel, setChannel] = useState(CHANNELS[0]);
  const [text, setText] = useState("");
  const [outcome, setOutcome] = useState<AuditOutcome | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<AuditError | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [severityFilter, setSeverityFilter] = useState<Severity | "all">("all");
  /** True once the draft has been edited since the audit that produced `outcome`. */
  const [stale, setStale] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const wordCount = useMemo(() => words(text), [text]);

  const resetForRun = () => {
    setSelectedId(null);
    setDismissed(new Set());
    setSeverityFilter("all");
    setStale(false);
    setSubmittedId(null);
    setError(null);
  };

  /**
   * The real audit: Gemini, server-side.
   *
   * The client timeout sits above the server's so the server's clearer,
   * code-tagged error normally wins the race; this one only catches the case
   * where the route itself never answers.
   */
  const runAiAudit = async (source: string) => {
    resetForRun();
    setRunning(true);
    const startedAt = performance.now();
    try {
      const response = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: source, channel, brand }),
        signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS),
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        setOutcome(null);
        setError({
          code: data?.code ?? "unknown",
          message: data?.message ?? `Request failed with status ${response.status}.`,
          hint: data?.hint,
        });
        return;
      }

      setOutcome({
        findings: data.findings as Finding[],
        counts: data.counts as Record<Severity, number>,
        score: data.score as number,
        scoreRationale: data.scoreRationale as string,
        wordCount: data.wordCount as number,
        engine: "gemini",
        model: data.model as string,
        summary: data.summary as string,
        unlocated: (data.unlocated as number) ?? 0,
        timings: (data.timings as AuditOutcome["timings"]) ?? {
          geminiMs: 0,
          ourMs: 0,
          totalMs: Math.round(performance.now() - startedAt),
        },
        usage: data.usage as AuditOutcome["usage"],
      });
    } catch (caught) {
      setOutcome(null);
      const aborted =
        caught instanceof DOMException &&
        (caught.name === "TimeoutError" || caught.name === "AbortError");
      setError(
        aborted
          ? {
              code: "timeout",
              message: `The audit did not finish within ${Math.round(
                CLIENT_TIMEOUT_MS / 1000,
              )} seconds, so it was stopped.`,
              hint: "Try a shorter draft, or raise GEMINI_TIMEOUT_MS in .env.local.",
            }
          : {
              code: "network",
              message: "Could not reach the audit endpoint.",
              hint: "Check the dev server is still running, then try again.",
            },
      );
    } finally {
      setRunning(false);
    }
  };

  /** The deterministic local check. Explicitly chosen, never a silent fallback. */
  const runLocalAudit = (source: string) => {
    resetForRun();
    const result = auditContent(source, brand);
    setOutcome({
      findings: result.findings,
      counts: result.counts,
      score: result.score,
      scoreRationale: explainScore(result.findings),
      wordCount: result.wordCount,
      engine: "local",
      model: null,
      summary: null,
      unlocated: 0,
    });
  };

  const applyFix = (findingId: string) => {
    if (!outcome) return;
    const finding = outcome.findings.find((f) => f.id === findingId);
    if (!finding?.replacement || finding.start < 0) return;

    const next =
      text.slice(0, finding.start) + finding.replacement + text.slice(finding.end);
    const delta = finding.replacement.length - (finding.end - finding.start);

    // Keep the remaining highlights pointing at the right words: drop anything
    // that overlapped the rewritten span, and shift everything after it.
    const remaining = outcome.findings
      .filter((f) => f.id !== findingId)
      .filter((f) => f.start < 0 || f.end <= finding.start || f.start >= finding.end)
      .map((f) =>
        f.start >= finding.end
          ? { ...f, start: f.start + delta, end: f.end + delta }
          : f,
      );

    setText(next);
    setOutcome({
      ...outcome,
      findings: remaining,
      counts: countBySeverity(remaining),
      score: scoreFromFindings(remaining),
      scoreRationale: explainScore(remaining),
      wordCount: words(next),
    });
    setSelectedId(null);
    setStale(true);
    setSubmittedId(null);
  };

  const toggleDismiss = (findingId: string) =>
    setDismissed((current) => {
      const next = new Set(current);
      if (next.has(findingId)) next.delete(findingId);
      else next.add(findingId);
      return next;
    });

  const liveFindings = outcome?.findings.filter((f) => !dismissed.has(f.id)) ?? [];
  const liveCounts = countBySeverity(liveFindings);
  const liveScore = scoreFromFindings(liveFindings);
  const liveRationale = explainScore(liveFindings);
  const verdict =
    liveScore >= 90
      ? "Ready to publish."
      : liveScore >= 70
        ? "Minor revisions recommended before sign-off."
        : "Needs rework before it can go to approval.";

  const visibleFindings =
    outcome && severityFilter !== "all"
      ? outcome.findings.filter((f) => f.severity === severityFilter)
      : (outcome?.findings ?? []);

  const submitForReview = () => {
    if (!outcome) return;
    const id = newAuditId();
    saveAudit({
      id,
      title: title.trim() || "Untitled submission",
      channel,
      text,
      outcome: {
        ...outcome,
        findings: liveFindings,
        counts: liveCounts,
        score: liveScore,
        scoreRationale: liveRationale,
      },
      createdAt: new Date().toISOString(),
      status: "in-review",
      reviewedAt: null,
      reviewNote: null,
    });
    setSubmittedId(id);
  };

  return (
    <div className="space-y-12">
      <PageHeader
        eyebrow="AI Audit Studio"
        title="Review content against the brand rules."
        description="Paste a draft and êmet checks it against the Brand DNA you have defined. The review runs on Google Gemini, server-side — your API key never reaches the browser."
        action={
          configured ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-positive/35 bg-positive/10 px-3 py-1.5 text-xs text-positive">
              <span className="h-1.5 w-1.5 rounded-full bg-positive" />
              Gemini ready · {model}
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full border border-critical/35 bg-critical/10 px-3 py-1.5 text-xs text-critical">
              <span className="h-1.5 w-1.5 rounded-full bg-critical" />
              No API key
            </span>
          )
        }
      />

      {/* Setup notice — shown instead of pretending an audit ran ------------ */}
      {!configured ? (
        <Panel>
          <PanelHeader
            eyebrow="Setup required"
            title="Add a Gemini API key to run real audits"
            description="Without a key there is no AI review. Nothing needs installing or launching separately — add the key below and audits run from this page. In the meantime the built-in rule check exercises the same workflow."
          />
          <PanelBody className="space-y-5">
            <ol className="space-y-3 text-sm leading-relaxed text-foreground-muted">
              <li className="flex gap-3">
                <span className="text-accent">1.</span>
                <span>
                  Get a free key at{" "}
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent underline decoration-dotted underline-offset-4"
                  >
                    aistudio.google.com/apikey
                  </a>
                  .
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-accent">2.</span>
                <span>
                  In the project folder, run{" "}
                  <code className="rounded bg-background-secondary px-1.5 py-0.5 font-mono text-xs text-foreground">
                    cp .env.example .env.local
                  </code>
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-accent">3.</span>
                <span>
                  Put your key in{" "}
                  <code className="rounded bg-background-secondary px-1.5 py-0.5 font-mono text-xs text-foreground">
                    GEMINI_API_KEY=
                  </code>{" "}
                  and save. Optionally set{" "}
                  <code className="rounded bg-background-secondary px-1.5 py-0.5 font-mono text-xs text-foreground">
                    GEMINI_MODEL
                  </code>
                  .
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-accent">4.</span>
                <span>
                  Restart the dev server, then reload this page. The badge above
                  will turn green.
                </span>
              </li>
            </ol>
            <p className="rounded-md border border-border bg-background-secondary px-4 py-3 text-xs leading-relaxed text-foreground-muted">
              <code className="font-mono">.env.local</code> is gitignored, so the key
              is never committed. It is read only on the server.
            </p>
          </PanelBody>
        </Panel>
      ) : null}

      <div className="grid gap-8 xl:grid-cols-12">
        {/* Submission ----------------------------------------------------- */}
        <div className="xl:col-span-5">
          <Panel className="xl:sticky xl:top-24">
            <PanelHeader eyebrow="Submission" title="Content to review" />
            <PanelBody className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-[0.7rem] font-medium uppercase tracking-[0.14em] text-foreground-muted">
                    Title
                  </span>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-md border border-border bg-background-secondary px-3.5 py-2.5 text-sm text-foreground transition-colors duration-200 hover:border-silver/25 focus:border-accent/60 focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[0.7rem] font-medium uppercase tracking-[0.14em] text-foreground-muted">
                    Channel
                  </span>
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value)}
                    className="w-full rounded-md border border-border bg-background-secondary px-3.5 py-2.5 text-sm text-foreground transition-colors duration-200 hover:border-silver/25 focus:border-accent/60 focus:outline-none"
                  >
                    {CHANNELS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-[0.7rem] font-medium uppercase tracking-[0.14em] text-foreground-muted">
                  Draft
                </span>
                <textarea
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    if (outcome) setStale(true);
                  }}
                  rows={14}
                  placeholder="Paste the copy you want reviewed…"
                  className="w-full resize-y rounded-md border border-border bg-background-secondary px-4 py-3.5 text-sm leading-relaxed text-foreground placeholder:text-foreground-muted/60 transition-colors duration-200 hover:border-silver/25 focus:border-accent/60 focus:outline-none"
                />
              </label>

              <div className="flex items-center justify-between text-xs text-foreground-muted">
                <span>{wordCount} words</span>
                <span>
                  {brand.prohibitedClaims.length} prohibited claims ·{" "}
                  {brand.terminology.length} terms ·{" "}
                  {brand.approvedFacts.length} approved facts
                </span>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => runAiAudit(text)}
                  disabled={running || text.trim().length === 0 || !configured}
                >
                  <AuditIcon width={16} height={16} />
                  {running ? "Reviewing with Gemini…" : "Run AI audit"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setText(DEMO_SUBMISSION);
                    if (configured) runAiAudit(DEMO_SUBMISSION);
                    else runLocalAudit(DEMO_SUBMISSION);
                  }}
                  disabled={running}
                >
                  Load sample
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => runLocalAudit(text)}
                  disabled={running || text.trim().length === 0}
                >
                  Built-in rule check
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setText("");
                    setOutcome(null);
                    resetForRun();
                  }}
                  disabled={running}
                >
                  Clear
                </Button>
              </div>

              <p className="text-xs leading-relaxed text-foreground-muted/80">
                <strong className="font-medium text-foreground-muted">
                  Built-in rule check
                </strong>{" "}
                is deterministic pattern matching that runs inside this page. There
                is nothing to install and no separate process to start. It is not AI
                and finds far less — it is here so the workflow still works without
                a key.
              </p>
            </PanelBody>
          </Panel>
        </div>

        {/* Results --------------------------------------------------------- */}
        <div className="space-y-8 xl:col-span-7">
          {/* Error ------------------------------------------------------- */}
          {error ? (
            <Panel className="border-critical/40">
              <PanelBody className="space-y-4">
                <div className="flex items-start gap-4">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-critical/40 text-critical">
                    <AlertIcon width={16} height={16} />
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-display text-lg text-foreground">
                      The audit did not run
                    </h2>
                    <p className="mt-1.5 text-sm leading-relaxed text-foreground-muted">
                      {error.message}
                    </p>
                    {error.hint ? (
                      <p className="mt-2 text-sm leading-relaxed text-accent/90">
                        {error.hint}
                      </p>
                    ) : null}
                    <p className="mt-3 font-mono text-[0.7rem] uppercase tracking-wider text-foreground-muted/70">
                      {error.code}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 border-t border-border pt-4">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => runAiAudit(text)}
                    disabled={running || !configured || !text.trim()}
                  >
                    Try again
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => runLocalAudit(text)}
                    disabled={running || !text.trim()}
                  >
                    Run local rule check instead
                  </Button>
                </div>
              </PanelBody>
            </Panel>
          ) : null}

          {!outcome && !error ? (
            <Panel>
              <PanelBody className="flex flex-col items-center justify-center gap-4 py-24 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-border text-silver/60">
                  <AuditIcon width={20} height={20} />
                </span>
                <h2 className="font-display text-xl text-foreground">
                  No audit run yet
                </h2>
                <p className="max-w-sm text-sm leading-relaxed text-foreground-muted">
                  {configured
                    ? "Paste a draft and run the AI audit, or load the sample letter to see how findings are presented."
                    : "Add a Gemini API key to run the AI audit, or try the built-in rule check on the sample letter."}
                </p>
              </PanelBody>
            </Panel>
          ) : null}

          {outcome ? (
            <>
              {/* Score summary */}
              <Panel>
                <PanelHeader
                  eyebrow="Result"
                  title={title || "Untitled submission"}
                  description={`${channel} · ${outcome.wordCount} words · ${liveFindings.length} open finding${
                    liveFindings.length === 1 ? "" : "s"
                  }`}
                  action={
                    outcome.engine === "gemini" ? (
                      <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[0.65rem] uppercase tracking-[0.1em] text-accent">
                        Gemini · {outcome.model}
                        {outcome.timings
                          ? ` · ${(outcome.timings.totalMs / 1000).toFixed(1)}s`
                          : ""}
                      </span>
                    ) : (
                      <DemoTag>Built-in rule check — not AI</DemoTag>
                    )
                  }
                />
                <PanelBody className="space-y-8">
                  {stale ? (
                    <p className="rounded-md border border-accent/30 bg-accent/10 px-4 py-3 text-xs leading-relaxed text-accent">
                      The draft has changed since this audit ran. Re-run it to
                      re-check the edited text.
                    </p>
                  ) : null}

                  {outcome.summary ? (
                    <blockquote className="border-l-2 border-accent/40 pl-5 text-sm leading-relaxed text-foreground">
                      {outcome.summary}
                    </blockquote>
                  ) : null}

                  <div className="flex flex-col items-start gap-8 sm:flex-row sm:items-center">
                    <ScoreDial score={liveScore} verdict={verdict} />

                    <div className="min-w-0 flex-1 space-y-5">
                      <p className="text-sm leading-relaxed text-foreground">
                        {verdict}
                      </p>

                      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-4">
                        {[
                          { term: "Channel", value: channel },
                          { term: "Words", value: outcome.wordCount },
                          { term: "Open", value: liveFindings.length },
                          { term: "Dismissed", value: dismissed.size },
                        ].map((item) => (
                          <div key={item.term} className="bg-surface px-4 py-3.5">
                            <dt className="text-[0.6rem] uppercase tracking-[0.12em] text-foreground-muted">
                              {item.term}
                            </dt>
                            <dd className="mt-1.5 text-lg font-semibold leading-none text-foreground">
                              {item.value}
                            </dd>
                          </div>
                        ))}
                      </dl>

                      <details className="group">
                        <summary className="cursor-pointer list-none text-xs text-accent transition-colors duration-200 hover:text-accent/75">
                          How is this score calculated?
                        </summary>
                        <p className="mt-2.5 text-xs leading-relaxed text-foreground-muted">
                          {liveRationale}
                        </p>
                        <p className="mt-2 text-xs leading-relaxed text-foreground-muted/80">
                          The model finds the problems; this arithmetic grades them.
                          The number is computed here, not asked of Gemini, so it is
                          reproducible and moves predictably as you dismiss findings.
                        </p>
                      </details>

                      {outcome.engine === "gemini" && outcome.timings ? (
                        <p className="text-xs leading-relaxed text-foreground-muted/80">
                          Gemini took{" "}
                          {(outcome.timings.geminiMs / 1000).toFixed(1)}s; our own
                          processing took{" "}
                          {outcome.timings.ourMs < 10
                            ? "under 10ms"
                            : `${outcome.timings.ourMs}ms`}
                          {outcome.usage
                            ? `. Tokens in/out/thinking: ${outcome.usage.inputTokens ?? "?"}/${outcome.usage.outputTokens ?? "?"}/${outcome.usage.thoughtTokens ?? "?"} at thinking level ${outcome.usage.thinkingLevel}`
                            : ""}
                          .
                        </p>
                      ) : null}

                      {outcome.unlocated > 0 ? (
                        <p className="text-xs leading-relaxed text-foreground-muted/80">
                          {outcome.unlocated} finding
                          {outcome.unlocated === 1 ? "" : "s"} could not be matched
                          to exact text in the draft, so{" "}
                          {outcome.unlocated === 1 ? "it is" : "they are"} listed but
                          not highlighted.
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="border-t border-border pt-7">
                    <h3 className="mb-5 text-[0.65rem] font-medium uppercase tracking-[0.18em] text-accent/80">
                      Severity distribution
                    </h3>
                    <SeverityDistribution counts={liveCounts} />
                  </div>

                  {/* Review workflow */}
                  <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
                    {submittedId ? (
                      <p className="flex items-center gap-2.5 text-sm text-positive">
                        <CheckIcon width={16} height={16} />
                        Submitted for review.
                      </p>
                    ) : (
                      <p className="text-xs leading-relaxed text-foreground-muted">
                        Submitting saves this audit to the Approval Workspace, in
                        this browser.
                      </p>
                    )}
                    <div className="flex flex-wrap items-start gap-3">
                      {/*
                        Exports exactly what is on screen, including any
                        findings dismissed above — the live set, not the raw
                        audit — so the report matches what the reviewer sees.
                      */}
                      <ExportReportButton
                        audit={{
                          title: title.trim() || "Untitled submission",
                          channel,
                          text,
                          outcome: {
                            ...outcome,
                            findings: liveFindings,
                            counts: liveCounts,
                            score: liveScore,
                            scoreRationale: liveRationale,
                          },
                          createdAt: new Date().toISOString(),
                          status: submittedId ? "in-review" : "draft",
                          reviewedAt: null,
                          reviewNote: null,
                        }}
                      />
                      {submittedId ? (
                        <ButtonLink href="/approvals" variant="secondary" size="sm">
                          Open Approval Workspace
                          <ArrowRightIcon width={15} height={15} />
                        </ButtonLink>
                      ) : (
                        <Button size="sm" onClick={submitForReview}>
                          Submit for review
                        </Button>
                      )}
                    </div>
                  </div>
                </PanelBody>
              </Panel>

              {/* Marked-up content */}
              <Panel>
                <PanelHeader
                  eyebrow="Annotated draft"
                  title="Flagged phrases in context"
                  description="Select any highlighted phrase to jump to its finding."
                />
                <PanelBody>
                  <HighlightedContent
                    text={text}
                    findings={liveFindings.filter((f) => f.start >= 0)}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                  />
                </PanelBody>
              </Panel>

              {/* Findings */}
              <Panel>
                <PanelHeader
                  eyebrow="Findings"
                  title={`${outcome.findings.length} issue${
                    outcome.findings.length === 1 ? "" : "s"
                  } detected`}
                  description="Ordered as returned by the reviewer. Applying a fix rewrites the draft."
                />

                {outcome.findings.length > 0 ? (
                  <div
                    role="tablist"
                    aria-label="Filter findings by severity"
                    className="flex flex-wrap gap-2 border-b border-border px-6 py-4 sm:px-8"
                  >
                    <button
                      role="tab"
                      aria-selected={severityFilter === "all"}
                      onClick={() => setSeverityFilter("all")}
                      className={`rounded-full border px-3.5 py-1.5 text-xs transition-colors duration-200 ${
                        severityFilter === "all"
                          ? "border-accent/50 bg-accent/10 text-foreground"
                          : "border-border text-foreground-muted hover:border-silver/30 hover:text-foreground"
                      }`}
                    >
                      All {outcome.findings.length}
                    </button>
                    {SEVERITY_ORDER.map((severity) => {
                      const total = outcome.findings.filter(
                        (f) => f.severity === severity,
                      ).length;
                      const on = severityFilter === severity;
                      return (
                        <button
                          key={severity}
                          role="tab"
                          aria-selected={on}
                          disabled={total === 0}
                          onClick={() => setSeverityFilter(severity)}
                          className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-35 ${
                            on
                              ? "border-silver/40 bg-surface-elevated text-foreground"
                              : "border-border text-foreground-muted hover:border-silver/30 hover:text-foreground"
                          }`}
                        >
                          <span
                            aria-hidden
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ background: SEVERITY_VAR[severity] }}
                          />
                          {SEVERITY_LABEL[severity]} {total}
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                {outcome.findings.length === 0 ? (
                  <PanelBody className="flex flex-col items-center gap-3 py-16 text-center">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full border border-positive/35 text-positive">
                      <CheckIcon width={18} height={18} />
                    </span>
                    <p className="text-sm text-foreground">
                      Nothing flagged against the current Brand DNA.
                    </p>
                    <p className="max-w-sm text-xs leading-relaxed text-foreground-muted">
                      {outcome.engine === "gemini"
                        ? "Gemini reviewed the draft against every section of your Brand DNA and found no breaches."
                        : "The built-in rule check found no pattern matches. It is far narrower than the AI review."}
                    </p>
                  </PanelBody>
                ) : (
                  <div className="divide-y divide-border">
                    {visibleFindings.length === 0 ? (
                      <p className="px-6 py-12 text-center text-sm text-foreground-muted sm:px-8">
                        No {severityFilter} findings in this draft.
                      </p>
                    ) : null}
                    {visibleFindings.map((finding) => (
                      <FindingCard
                        key={finding.id}
                        finding={finding}
                        selected={selectedId === finding.id}
                        dismissed={dismissed.has(finding.id)}
                        onSelect={() => setSelectedId(finding.id)}
                        onDismiss={() => toggleDismiss(finding.id)}
                        onApply={() => applyFix(finding.id)}
                      />
                    ))}
                  </div>
                )}
              </Panel>

              {stale ? (
                <div className="flex justify-center">
                  <Button
                    onClick={() => runAiAudit(text)}
                    disabled={running || !configured || !text.trim()}
                  >
                    <AuditIcon width={16} height={16} />
                    {running ? "Reviewing…" : "Re-run audit on the edited draft"}
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      <p className="text-center text-xs text-foreground-muted/70">
        Brand rules come from{" "}
        <Link
          href="/brand-dna"
          className="text-accent underline decoration-dotted underline-offset-4"
        >
          Brand DNA Studio
        </Link>{" "}
        and are saved in this browser.
      </p>
    </div>
  );
}
