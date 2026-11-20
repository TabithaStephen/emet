"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ExportReportButton } from "@/components/audit/export-report-button";
import { ScoreDial } from "@/components/charts/score-dial";
import { SeverityDistribution } from "@/components/charts/severity-distribution";
import { ReadinessPanel } from "@/components/social/readiness-panel";
import { AlertIcon, ArrowRightIcon, CheckIcon, ImageIcon } from "@/components/icons";
import { Button, ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { SeverityBadge } from "@/components/ui/severity";
import { useSession } from "@/lib/auth";
import {
  newAuditId,
  newLineageId,
  saveAudit,
  submitAudit,
  useAudits,
  useStorageStatus,
} from "@/lib/audit-store";
import { useBrand } from "@/lib/brand-store";
import { brandHashOf, contentHashOf } from "@/lib/history/fingerprint";
import { lineagesOf, nextVersionFor, versionOf } from "@/lib/history/lineage";
import { verdictFor } from "@/lib/report/report-model";
import { formatBytes } from "@/lib/social/format-bytes";
import { inspectCreative } from "@/lib/social/inspect-creative";
import { PLATFORMS, PLATFORM_ORDER } from "@/lib/social/platform-rules";
import { buildReadiness } from "@/lib/social/readiness";
import type {
  AuditOutcome,
  CreativeInspection,
  Finding,
  PlatformReadiness,
  Severity,
  SocialPlatform,
} from "@/lib/types";

/**
 * Social Media Content Readiness.
 *
 * Two assessments, deliberately kept apart:
 *
 *  1. BRAND CONSISTENCY — the existing Gemini audit, unchanged, run against
 *     the saved Brand DNA. No second engine, no duplicated prompt.
 *  2. PLATFORM READINESS — deterministic arithmetic against each platform's
 *     published specification, computed here with no model involved.
 *
 * They never share a score. A caption that is forty characters too long for
 * Instagram has broken no brand rule, and a prohibited claim is not a platform
 * problem; collapsing the two into one number would misrepresent both.
 */

/** Above the server's own 45s ceiling, so the server's clearer error wins. */
const CLIENT_TIMEOUT_MS = 60_000;

interface StudioError {
  code: string;
  message: string;
  hint?: string;
}

export function SocialStudio({
  configured,
  model,
}: {
  configured: boolean;
  model: string;
}) {
  const { brand } = useBrand();
  const audits = useAudits();
  const storage = useStorageStatus();
  const session = useSession();
  const fileRef = useRef<HTMLInputElement>(null);

  const [platform, setPlatform] = useState<SocialPlatform>("instagram");
  const [title, setTitle] = useState("Product launch post");
  const [caption, setCaption] = useState("");
  const [creative, setCreative] = useState<CreativeInspection | null>(null);
  const [creativeError, setCreativeError] = useState<string | null>(null);

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<StudioError | null>(null);
  const [outcome, setOutcome] = useState<AuditOutcome | null>(null);
  const [readiness, setReadiness] = useState<PlatformReadiness | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [lineageChoice, setLineageChoice] = useState<string>("new");

  const lineages = useMemo(() => lineagesOf(audits), [audits]);

  /*
   * Readiness is pure arithmetic, so it is recomputed as the caption is typed
   * and shown before anything is sent anywhere. Only the brand half needs an
   * API call.
   */
  const livePreview = useMemo(
    () => buildReadiness(caption, platform, creative),
    [caption, platform, creative],
  );

  const rules = PLATFORMS[platform];
  const brandIsEmpty =
    brand.terminology.length === 0 &&
    brand.prohibitedClaims.length === 0 &&
    brand.approvedFacts.length === 0 &&
    brand.importedRules.length === 0 &&
    !brand.voice.toneAvoid.trim();

  const pickCreative = async (file: File) => {
    setCreativeError(null);
    try {
      setCreative(await inspectCreative(file));
      if (outcome) setStale(true);
    } catch (caught) {
      setCreative(null);
      setCreativeError(
        caught instanceof Error ? caught.message : "That file could not be read.",
      );
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  /**
   * Runs both assessments.
   *
   * Platform readiness is computed locally and always succeeds. The brand
   * audit may fail — no key, a timeout, Gemini capacity — and when it does the
   * readiness result is still shown, clearly labelled as half the picture,
   * rather than discarding work that was never at risk.
   */
  const run = async () => {
    setRunning(true);
    setError(null);
    setOutcome(null);
    setSavedId(null);
    setSubmittedId(null);
    setStale(false);

    const checkedReadiness = buildReadiness(caption, platform, creative);
    setReadiness(checkedReadiness);

    try {
      const response = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The platform travels as the channel, which the audit route already
        // accepts as free text — so no change to the API was needed.
        body: JSON.stringify({ text: caption, channel: rules.label, brand }),
        signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS),
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        setError({
          code: data?.code ?? "unknown",
          message: data?.message ?? `Request failed with status ${response.status}.`,
          hint: data?.hint,
        });
        return;
      }

      const completed: AuditOutcome = {
        findings: data.findings as Finding[],
        counts: data.counts as Record<Severity, number>,
        score: data.score as number,
        scoreRationale: data.scoreRationale as string,
        wordCount: data.wordCount as number,
        engine: "gemini",
        model: data.model as string,
        summary: data.summary as string,
        unlocated: (data.unlocated as number) ?? 0,
        timings: data.timings as AuditOutcome["timings"],
        usage: data.usage as AuditOutcome["usage"],
        // Alongside the brand findings, never inside them.
        platform: checkedReadiness,
      };
      setOutcome(completed);

      // Saved immediately, exactly like the Audit Studio, so a finished check
      // is in history whether or not it is submitted.
      const id = newAuditId();
      const lineageId = lineageChoice === "new" ? newLineageId() : lineageChoice;
      saveAudit({
        id,
        title: title.trim() || "Untitled social post",
        channel: rules.label,
        text: caption,
        outcome: completed,
        createdAt: new Date().toISOString(),
        status: "draft",
        reviewedAt: null,
        reviewNote: null,
        lineageId,
        version: nextVersionFor(audits, lineageId),
        contentHash: contentHashOf(caption),
        brandHash: brandHashOf(brand),
        owner: session ? { email: session.email, name: session.name } : undefined,
      });
      setSavedId(id);
      if (lineageChoice === "new") setLineageChoice(lineageId);
    } catch (caught) {
      const aborted =
        caught instanceof DOMException &&
        (caught.name === "TimeoutError" || caught.name === "AbortError");
      setError(
        aborted
          ? {
              code: "timeout",
              message: `The brand audit did not finish within ${Math.round(CLIENT_TIMEOUT_MS / 1000)} seconds, so it was stopped.`,
              hint: "Platform readiness below is unaffected — it is measured here, not by Gemini.",
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

  const submit = () => {
    if (!outcome || !savedId || stale) return;
    const result = submitAudit(savedId, outcome);
    if (result === "not-found") {
      setError({
        code: "missing-record",
        message: "This check is no longer in your history, so it could not be submitted.",
        hint: "History keeps the 50 most recent audits. Run the check again to submit it.",
      });
      return;
    }
    setSubmittedId(savedId);
  };

  const canRun = configured && caption.trim().length > 0 && !running;

  return (
    <div className="space-y-12">
      <PageHeader
        eyebrow="Social Readiness"
        title="Check a post before it goes out."
        description="Two separate assessments: whether the caption follows your Brand DNA, and whether the post meets what the platform actually publishes as a requirement."
        action={
          configured ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-positive/35 bg-positive/10 px-3 py-1 text-[0.65rem] uppercase tracking-[0.1em] text-positive">
              <span className="h-1.5 w-1.5 rounded-full bg-positive" />
              Gemini ready · {model}
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[0.65rem] uppercase tracking-[0.1em] text-accent">
              No API key
            </span>
          )
        }
      />

      {!storage.persisted && storage.error ? (
        <Panel className="border-critical/40">
          <PanelBody className="flex items-start gap-3">
            <AlertIcon width={16} height={16} className="mt-0.5 shrink-0 text-critical" />
            <p className="text-sm leading-relaxed text-critical">{storage.error}</p>
          </PanelBody>
        </Panel>
      ) : null}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        {/* ---- composer ------------------------------------------------- */}
        <Panel className="xl:sticky xl:top-24 xl:self-start">
          <PanelHeader eyebrow="The post" title="Platform and caption" />
          <PanelBody className="space-y-6">
            {/* Platform */}
            <div>
              <span className="mb-2 block text-[0.7rem] font-medium uppercase tracking-[0.14em] text-foreground-muted">
                Platform
              </span>
              <div
                role="tablist"
                aria-label="Social platform"
                className="flex gap-1 rounded-md border border-border bg-background-secondary p-1"
              >
                {PLATFORM_ORDER.map((id) => (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={platform === id}
                    disabled={running}
                    onClick={() => {
                      setPlatform(id);
                      if (outcome) setStale(true);
                    }}
                    className={`flex-1 rounded px-3 py-1.5 text-xs transition-colors duration-200 disabled:opacity-50 ${
                      platform === id
                        ? "bg-surface-elevated text-foreground"
                        : "text-foreground-muted hover:text-foreground"
                    }`}
                  >
                    {PLATFORMS[id].label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-foreground-muted">
                {rules.documentationNote}
              </p>
            </div>

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
                Content version
              </span>
              <select
                value={lineageChoice}
                onChange={(e) => setLineageChoice(e.target.value)}
                disabled={running}
                className="w-full rounded-md border border-border bg-background-secondary px-3.5 py-2.5 text-sm text-foreground transition-colors duration-200 hover:border-silver/25 focus:border-accent/60 focus:outline-none disabled:opacity-60"
              >
                <option value="new">New content</option>
                {lineages.map((lineage) => (
                  <option key={lineage.id} value={lineage.id}>
                    New version of: {lineage.title} (v{versionOf(lineage.latest)})
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[0.7rem] font-medium uppercase tracking-[0.14em] text-foreground-muted">
                Caption
              </span>
              <textarea
                value={caption}
                onChange={(e) => {
                  setCaption(e.target.value);
                  if (outcome) setStale(true);
                }}
                rows={10}
                placeholder="Write or paste the caption…"
                className="w-full resize-y rounded-md border border-border bg-background-secondary px-4 py-3.5 text-sm leading-relaxed text-foreground placeholder:text-foreground-muted/60 transition-colors duration-200 hover:border-silver/25 focus:border-accent/60 focus:outline-none"
              />
            </label>

            {/* Live, local measurements — no API call involved. */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-foreground-muted">
              {livePreview.checks
                .filter((c) => ["caption-length", "caption-length-advisory", "hashtag-count", "hashtag-count-info", "mention-count"].includes(c.id))
                .map((c) => (
                  <span
                    key={c.id}
                    className={c.state === "fail" ? "text-critical" : undefined}
                  >
                    {c.measured}
                    {c.expected && c.confidence === "documented" ? ` / ${c.expected}` : ""}
                  </span>
                ))}
            </div>

            {/* Creative */}
            <div className="space-y-3 border-t border-border pt-5">
              <span className="block text-[0.7rem] font-medium uppercase tracking-[0.14em] text-foreground-muted">
                Creative (optional)
              </span>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void pickCreative(file);
                }}
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={running}
                  onClick={() => fileRef.current?.click()}
                >
                  <ImageIcon width={15} height={15} />
                  {creative ? "Replace image" : "Add an image"}
                </Button>
                {creative ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCreative(null);
                      if (outcome) setStale(true);
                    }}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
              {creative ? (
                <p className="font-mono text-xs text-foreground-muted">
                  {creative.width}×{creative.height} ·{" "}
                  {creative.mimeType.replace("image/", "").toUpperCase()} ·{" "}
                  {formatBytes(creative.bytes)}
                </p>
              ) : (
                <p className="text-xs leading-relaxed text-foreground-muted">
                  Measured in your browser only. The image is never uploaded,
                  never sent to Gemini and never stored.
                </p>
              )}
              {creativeError ? (
                <p className="text-xs leading-relaxed text-critical">{creativeError}</p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-3 border-t border-border pt-5">
              <Button disabled={!canRun} onClick={run}>
                {running ? "Checking…" : "Check readiness"}
              </Button>
              <Button
                variant="ghost"
                disabled={running}
                onClick={() => {
                  setCaption("");
                  setCreative(null);
                  setOutcome(null);
                  setReadiness(null);
                  setError(null);
                  setSavedId(null);
                  setSubmittedId(null);
                }}
              >
                Clear
              </Button>
            </div>

            {!configured ? (
              <p className="rounded-md border border-accent/30 bg-accent/10 px-4 py-3 text-xs leading-relaxed text-accent">
                Brand consistency needs a Gemini API key, which is not
                configured. Platform readiness still works — it is measured
                here, not by a model.
              </p>
            ) : null}

            {brandIsEmpty ? (
              <p className="rounded-md border border-border bg-background-secondary px-4 py-3 text-xs leading-relaxed text-foreground-muted">
                Your Brand DNA has no terminology, claims or facts recorded, so
                a brand audit has little to measure against.{" "}
                <Link
                  href="/brand-dna"
                  className="text-accent underline decoration-dotted underline-offset-4"
                >
                  Add rules, or import a PDF
                </Link>
                .
              </p>
            ) : null}
          </PanelBody>
        </Panel>

        {/* ---- results --------------------------------------------------- */}
        <div className="space-y-8">
          {!readiness && !outcome ? (
            <Panel>
              <PanelBody className="flex flex-col items-center justify-center gap-4 py-24 text-center">
                <ImageIcon width={28} height={28} className="text-silver/50" />
                <h2 className="font-display text-xl text-foreground">
                  Nothing checked yet
                </h2>
                <p className="max-w-md text-sm leading-relaxed text-foreground-muted">
                  Choose a platform, write the caption, and êmet will check it
                  against your brand rules and against what the platform
                  actually requires.
                </p>
              </PanelBody>
            </Panel>
          ) : null}

          {stale && (readiness || outcome) ? (
            <p className="rounded-md border border-accent/30 bg-accent/10 px-4 py-3 text-xs leading-relaxed text-accent">
              The post has changed since this check ran. Run it again to
              re-check the edited version.
            </p>
          ) : null}

          {/* Brand consistency */}
          {outcome ? (
            <Panel>
              <PanelHeader
                eyebrow="Brand consistency"
                title="Against your Brand DNA"
                description="The same Gemini review the Audit Studio runs, applied to this caption. Separate from platform readiness."
                action={
                  <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[0.65rem] uppercase tracking-[0.1em] text-accent">
                    Gemini · {outcome.model}
                  </span>
                }
              />
              <PanelBody className="space-y-7">
                {outcome.summary ? (
                  <blockquote className="border-l-2 border-accent/40 pl-5 text-sm leading-relaxed text-foreground">
                    {outcome.summary}
                  </blockquote>
                ) : null}

                <div className="flex flex-col items-start gap-8 sm:flex-row sm:items-center">
                  <ScoreDial score={outcome.score} verdict={verdictFor(outcome.score)} />
                  <div className="min-w-0 flex-1 space-y-4">
                    <p className="text-sm leading-relaxed text-foreground">
                      {verdictFor(outcome.score)}
                    </p>
                    <details className="group">
                      <summary className="cursor-pointer list-none text-xs text-accent transition-colors duration-200 hover:text-accent/75">
                        How is this compliance score calculated?
                      </summary>
                      <p className="mt-2.5 text-xs leading-relaxed text-foreground-muted">
                        {outcome.scoreRationale}
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-foreground-muted/80">
                        This is the brand compliance score, computed from the
                        findings below. It is unrelated to the platform
                        readiness score, which measures something else entirely.
                      </p>
                    </details>
                  </div>
                </div>

                <div className="border-t border-border pt-6">
                  <h3 className="mb-5 text-[0.65rem] font-medium uppercase tracking-[0.18em] text-accent/80">
                    Severity distribution
                  </h3>
                  <SeverityDistribution counts={outcome.counts} />
                </div>

                {outcome.findings.length > 0 ? (
                  <ul className="divide-y divide-border border-t border-border">
                    {outcome.findings.map((finding) => (
                      <li key={finding.id} className="space-y-2 py-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <SeverityBadge severity={finding.severity} />
                          <h4 className="text-sm text-foreground">{finding.rule}</h4>
                          <span className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-[0.65rem] text-accent">
                            {finding.guidelineRef}
                          </span>
                        </div>
                        {finding.phrase ? (
                          <p className="font-mono text-xs text-critical">
                            “{finding.phrase}”
                          </p>
                        ) : null}
                        <p className="text-xs leading-relaxed text-foreground-muted">
                          {finding.explanation}
                        </p>
                        <p className="text-xs leading-relaxed text-positive">
                          Suggested: {finding.suggestion}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="border-t border-border pt-5 text-sm leading-relaxed text-positive">
                    No brand findings — the caption raised nothing against your
                    Brand DNA.
                  </p>
                )}

                {/* Review workflow, same records as everywhere else */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
                  {submittedId ? (
                    <p className="flex items-center gap-2.5 text-sm text-positive">
                      <CheckIcon width={16} height={16} />
                      Submitted for review.
                    </p>
                  ) : stale ? (
                    <p className="text-xs leading-relaxed text-accent">
                      Re-run the check before submitting.
                    </p>
                  ) : (
                    <p className="text-xs leading-relaxed text-foreground-muted">
                      {savedId
                        ? "Saved to audit history already. Submitting sends this same record for approval."
                        : "Submitting sends this check for approval."}
                    </p>
                  )}
                  <div className="flex flex-wrap items-start gap-3">
                    {savedId ? (
                      <ExportReportButton
                        audit={{
                          title: title.trim() || "Untitled social post",
                          channel: rules.label,
                          text: caption,
                          outcome,
                          createdAt: new Date().toISOString(),
                          status: submittedId ? "in-review" : "draft",
                          reviewedAt: null,
                          reviewNote: null,
                        }}
                      />
                    ) : null}
                    {submittedId ? (
                      <ButtonLink href="/approvals" variant="secondary" size="sm">
                        Open Approval Workspace
                        <ArrowRightIcon width={15} height={15} />
                      </ButtonLink>
                    ) : (
                      <Button size="sm" disabled={stale || !savedId} onClick={submit}>
                        Submit for review
                      </Button>
                    )}
                  </div>
                </div>
              </PanelBody>
            </Panel>
          ) : null}

          {/* Brand audit failed, readiness still stands */}
          {error ? (
            <Panel className="border-critical/40">
              <PanelBody className="space-y-2">
                <p className="flex items-start gap-3 text-sm leading-relaxed text-critical">
                  <AlertIcon width={16} height={16} className="mt-0.5 shrink-0" />
                  Brand consistency could not be checked: {error.message}
                </p>
                {error.hint ? (
                  <p className="pl-7 text-xs leading-relaxed text-foreground-muted">
                    {error.hint}
                  </p>
                ) : null}
                <p className="pl-7 font-mono text-[0.65rem] text-foreground-muted/70">
                  {error.code}
                </p>
                {readiness ? (
                  <p className="pl-7 text-xs leading-relaxed text-foreground-muted">
                    Platform readiness below is complete and unaffected. Nothing
                    was saved to history, because only half the check succeeded.
                  </p>
                ) : null}
              </PanelBody>
            </Panel>
          ) : null}

          {/* Platform readiness */}
          {readiness ? <ReadinessPanel readiness={readiness} /> : null}

          {readiness ? (
            <p className="text-xs leading-relaxed text-foreground-muted">
              Checking the artwork against your approved mark is a different
              job:{" "}
              <Link
                href="/visual"
                className="text-accent underline decoration-dotted underline-offset-4"
              >
                open Visual Compliance
              </Link>
              .
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
