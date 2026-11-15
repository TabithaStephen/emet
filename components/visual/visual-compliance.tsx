"use client";

import { useState } from "react";
import { ScoreDial } from "@/components/charts/score-dial";
import { SeverityDistribution } from "@/components/charts/severity-distribution";
import { AlertIcon, AuditIcon, CheckIcon } from "@/components/icons";
import { ImageSlot } from "@/components/visual/image-slot";
import { Button } from "@/components/ui/button";
import { DemoTag } from "@/components/ui/data";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { SEVERITY_EDGE, SeverityBadge } from "@/components/ui/severity";
import { useBrand } from "@/lib/brand-store";
import { NOVATECH_APPROVED, NOVATECH_MODIFIED } from "@/lib/demo-assets";
import { assetToPayload, fileToPayload } from "@/lib/image-payload";
import type { ImagePayload, VisualAuditOutcome } from "@/lib/types";

interface VisualError {
  code: string;
  message: string;
  hint?: string;
}

export function VisualCompliance({
  configured,
  model,
}: {
  configured: boolean;
  model: string;
}) {
  const { brand } = useBrand();

  const [reference, setReference] = useState<ImagePayload | null>(null);
  const [candidate, setCandidate] = useState<ImagePayload | null>(null);
  const [outcome, setOutcome] = useState<VisualAuditOutcome | null>(null);
  const [error, setError] = useState<VisualError | null>(null);
  const [running, setRunning] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [demoLoaded, setDemoLoaded] = useState(false);

  const reset = () => {
    setOutcome(null);
    setError(null);
  };

  /** Loads the bundled NovaTech pair: approved as reference, modified as candidate. */
  const loadDemo = async () => {
    reset();
    setLoadingDemo(true);
    try {
      const [ref, cand] = await Promise.all([
        assetToPayload(
          NOVATECH_APPROVED.src,
          "novatech-approved.png",
          NOVATECH_APPROVED.mimeType,
        ),
        assetToPayload(
          NOVATECH_MODIFIED.src,
          "novatech-modified.png",
          NOVATECH_MODIFIED.mimeType,
        ),
      ]);
      setReference(ref);
      setCandidate(cand);
      setDemoLoaded(true);
    } catch (caught) {
      setError({
        code: "demo-load-failed",
        message:
          caught instanceof Error ? caught.message : "Could not load the demo images.",
        hint: "The files live in public/demo-assets. Check the dev server is running.",
      });
    } finally {
      setLoadingDemo(false);
    }
  };

  const pick = async (which: "reference" | "candidate", file: File) => {
    reset();
    setDemoLoaded(false);
    try {
      const payload = await fileToPayload(file);
      if (which === "reference") setReference(payload);
      else setCandidate(payload);
    } catch (caught) {
      setError({
        code: "file-read-failed",
        message: caught instanceof Error ? caught.message : "Could not read that file.",
      });
    }
  };

  const run = async () => {
    if (!reference || !candidate) return;
    reset();
    setRunning(true);
    try {
      const response = await fetch("/api/visual-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference, candidate, brand }),
        signal: AbortSignal.timeout(75_000),
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
      setOutcome(data as VisualAuditOutcome);
    } catch (caught) {
      const aborted =
        caught instanceof DOMException &&
        (caught.name === "TimeoutError" || caught.name === "AbortError");
      setError(
        aborted
          ? {
              code: "timeout",
              message: "The visual audit did not finish in time, so it was stopped.",
              hint: "Try smaller images, or raise GEMINI_VISUAL_TIMEOUT_MS in .env.local.",
            }
          : { code: "network", message: "Could not reach the visual audit endpoint." },
      );
    } finally {
      setRunning(false);
    }
  };

  const ready = Boolean(reference && candidate);

  return (
    <div className="space-y-12">
      <PageHeader
        eyebrow="Visual Brand Compliance"
        title="Compare artwork against the approved mark."
        description="Gemini looks at both images and reports every way the candidate departs from the approved reference. Nothing is precomputed — swap in your own artwork and it reviews that instead."
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

      {/* Demo + inputs ----------------------------------------------------- */}
      <Panel>
        <PanelHeader
          eyebrow="Assets"
          title="Reference and candidate"
          description="Load the built-in NovaTech sample, or upload your own pair."
          action={
            <div className="flex flex-wrap items-center gap-3">
              <DemoTag>NovaTech — fictional sample brand</DemoTag>
              <Button
                variant="secondary"
                size="sm"
                onClick={loadDemo}
                disabled={loadingDemo || running}
              >
                {loadingDemo ? "Loading…" : "Try demo"}
              </Button>
            </div>
          }
        />
        <PanelBody className="space-y-7">
          {demoLoaded ? (
            <p className="flex items-start gap-3 rounded-md border border-accent/30 bg-accent/10 px-4 py-3 text-xs leading-relaxed text-accent">
              <CheckIcon width={14} height={14} className="mt-0.5 shrink-0" />
              NovaTech sample loaded — the approved mark as reference, a modified
              version as the candidate. These are fictional demo assets. Run the
              audit to see what Gemini actually finds.
            </p>
          ) : null}

          <div className="grid gap-8 md:grid-cols-2">
            <ImageSlot
              title="Approved reference"
              hint="The official mark. Upload a PNG, JPEG or WebP."
              image={reference}
              disabled={running}
              onPick={(file) => pick("reference", file)}
              onClear={() => {
                setReference(null);
                setDemoLoaded(false);
                reset();
              }}
            />
            <ImageSlot
              title="Candidate asset"
              hint="The artwork to check. Upload a PNG, JPEG or WebP."
              image={candidate}
              disabled={running}
              onPick={(file) => pick("candidate", file)}
              onClear={() => {
                setCandidate(null);
                setDemoLoaded(false);
                reset();
              }}
            />
          </div>

          <div className="flex flex-wrap items-center gap-4 border-t border-border pt-6">
            <Button onClick={run} disabled={!ready || running || !configured}>
              <AuditIcon width={16} height={16} />
              {running ? "Comparing with Gemini…" : "Run visual audit"}
            </Button>
            <p className="text-xs leading-relaxed text-foreground-muted">
              {!configured
                ? "Add a Gemini API key in .env.local to run the comparison."
                : ready
                  ? "Both images are sent to Gemini and genuinely analysed."
                  : "Load the demo or upload both images to continue."}
            </p>
          </div>
        </PanelBody>
      </Panel>

      {/* Error -------------------------------------------------------------- */}
      {error ? (
        <Panel className="border-critical/40">
          <PanelBody>
            <div className="flex items-start gap-4">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-critical/40 text-critical">
                <AlertIcon width={16} height={16} />
              </span>
              <div className="min-w-0">
                <h2 className="font-display text-lg text-foreground">
                  The visual audit did not run
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
          </PanelBody>
        </Panel>
      ) : null}

      {/* Result ------------------------------------------------------------- */}
      {outcome ? (
        <>
          <Panel>
            <PanelHeader
              eyebrow="Result"
              title={`${outcome.findings.length} deviation${
                outcome.findings.length === 1 ? "" : "s"
              } found`}
              description={outcome.summary}
              action={
                <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[0.65rem] uppercase tracking-[0.1em] text-accent">
                  Gemini · {outcome.model} ·{" "}
                  {(outcome.timings.totalMs / 1000).toFixed(1)}s
                </span>
              }
            />
            <PanelBody className="space-y-8">
              <div className="flex flex-col items-start gap-8 sm:flex-row sm:items-center">
                <ScoreDial
                  score={outcome.score}
                  verdict={`Visual compliance score ${outcome.score} out of 100.`}
                />
                <div className="min-w-0 flex-1 space-y-4">
                  <p className="text-sm leading-relaxed text-foreground">
                    {outcome.findings.length === 0
                      ? "The candidate matches the approved reference."
                      : "The candidate departs from the approved reference in the ways listed below."}
                  </p>
                  <details>
                    <summary className="cursor-pointer list-none text-xs text-accent transition-colors duration-200 hover:text-accent/75">
                      How is this score calculated?
                    </summary>
                    <p className="mt-2.5 text-xs leading-relaxed text-foreground-muted">
                      {outcome.scoreRationale}
                    </p>
                  </details>
                  {outcome.usage ? (
                    <p className="text-xs leading-relaxed text-foreground-muted/80">
                      Gemini took {(outcome.timings.geminiMs / 1000).toFixed(1)}s.
                      Tokens in/out/thinking:{" "}
                      {outcome.usage.inputTokens ?? "?"}/
                      {outcome.usage.outputTokens ?? "?"}/
                      {outcome.usage.thoughtTokens ?? "?"}.
                    </p>
                  ) : null}
                </div>
              </div>

              {outcome.findings.length > 0 ? (
                <div className="border-t border-border pt-7">
                  <h3 className="mb-5 text-[0.65rem] font-medium uppercase tracking-[0.18em] text-accent/80">
                    Severity distribution
                  </h3>
                  <SeverityDistribution counts={outcome.counts} noun="deviations" />
                </div>
              ) : null}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              eyebrow="Findings"
              title="What differs, and what to do"
              description="Reported by Gemini from the two images. Nothing here is precomputed."
            />
            {outcome.findings.length === 0 ? (
              <PanelBody className="flex flex-col items-center gap-3 py-16 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-full border border-positive/35 text-positive">
                  <CheckIcon width={18} height={18} />
                </span>
                <p className="text-sm text-foreground">
                  No deviations found against the approved reference.
                </p>
              </PanelBody>
            ) : (
              <div className="divide-y divide-border">
                {outcome.findings.map((finding) => (
                  <article
                    key={finding.id}
                    className={`border-l-2 bg-background-secondary px-5 py-5 ${
                      SEVERITY_EDGE[finding.severity]
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <SeverityBadge severity={finding.severity} />
                      <span className="inline-flex items-center rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[0.65rem] tracking-[0.06em] text-accent">
                        {finding.guideline}
                      </span>
                    </div>
                    <h3 className="mt-3 text-sm text-foreground">{finding.title}</h3>
                    <p className="mt-1.5 text-[0.7rem] uppercase tracking-[0.12em] text-silver">
                      {finding.element}
                    </p>
                    <p className="mt-3 text-xs leading-relaxed text-foreground-muted">
                      {finding.explanation}
                    </p>
                    <div className="mt-4 rounded-md border border-border bg-surface px-4 py-3">
                      <p className="text-[0.6rem] font-medium uppercase tracking-[0.16em] text-accent/80">
                        Recommended correction
                      </p>
                      <p className="mt-1.5 text-xs leading-relaxed text-foreground">
                        {finding.recommendation}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </Panel>
        </>
      ) : null}
    </div>
  );
}
