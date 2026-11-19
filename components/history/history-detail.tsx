"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { HighlightedContent } from "@/components/audit/highlighted-content";
import { ExportReportButton } from "@/components/audit/export-report-button";
import { ScoreDial } from "@/components/charts/score-dial";
import { SeverityDistribution } from "@/components/charts/severity-distribution";
import { ArrowRightIcon, DocumentIcon } from "@/components/icons";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { SeverityBadge } from "@/components/ui/severity";
import { StatusPill } from "@/components/ui/status";
import { timeAgo, useAudits } from "@/lib/audit-store";
import { verdictFor } from "@/lib/report/report-model";
import { lineageIdOf, versionOf, versionsInOrder } from "@/lib/history/lineage";

/**
 * One audit from history, in full.
 *
 * Read-only by design: a stored audit is a record of what was reviewed at a
 * moment in time, so nothing here edits it. The findings are shown against the
 * exact content they were computed from.
 */
export function HistoryDetail() {
  const params = useSearchParams();
  const audits = useAudits();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const requestedId = params.get("id") ?? "";
  const audit = audits.find((a) => a.id === requestedId);

  const siblings = useMemo(
    () => (audit ? versionsInOrder(audits, lineageIdOf(audit)) : []),
    [audits, audit],
  );

  if (!audit) {
    return (
      <div className="space-y-10">
        <PageHeader
          eyebrow="Audit History"
          title="This audit is not in your history."
          description="History is kept in this browser only. The record may have been deleted, pushed out by the 50-audit limit, or created in a different browser."
        />
        <Panel>
          <PanelBody className="flex flex-col items-center gap-4 py-16 text-center">
            <DocumentIcon width={26} height={26} className="text-silver/50" />
            <p className="max-w-md text-sm leading-relaxed text-foreground-muted">
              Nothing is shown here rather than a reconstruction, because the
              audit itself is gone.
            </p>
            <ButtonLink href="/history" variant="secondary" size="sm">
              Back to Audit History
            </ButtonLink>
          </PanelBody>
        </Panel>
      </div>
    );
  }

  const { outcome } = audit;
  const version = versionOf(audit);
  const previous = siblings.filter((s) => versionOf(s) < version).at(-1);

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Audit record"
        title={audit.title}
        description={`${audit.channel} · ${outcome.wordCount} words · audited ${timeAgo(audit.createdAt)}${
          audit.owner ? ` by ${audit.owner.name}` : ""
        }`}
        action={
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill status={audit.status} />
            <ExportReportButton audit={audit} variant="ghost" label="Export PDF" />
          </div>
        }
      />

      <Link
        href="/history"
        className="inline-flex items-center gap-2 text-xs text-accent transition-colors duration-200 hover:text-accent/75"
      >
        ← All audits
      </Link>

      {/* Result */}
      <Panel>
        <PanelHeader
          eyebrow={`Version ${version}`}
          title="Result"
          description={
            outcome.engine === "gemini"
              ? `Reviewed by Google Gemini (${outcome.model ?? "unknown model"}).`
              : "Produced by the built-in rule check — not AI."
          }
        />
        <PanelBody className="space-y-8">
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
                  How is this score calculated?
                </summary>
                <p className="mt-2.5 text-xs leading-relaxed text-foreground-muted">
                  {outcome.scoreRationale}
                </p>
              </details>
              {audit.reviewNote ? (
                <p className="rounded-md border border-border bg-background-secondary px-4 py-3 text-xs leading-relaxed text-foreground-muted">
                  <span className="text-foreground">Reviewer note:</span>{" "}
                  {audit.reviewNote}
                </p>
              ) : null}
            </div>
          </div>

          <div className="border-t border-border pt-7">
            <h3 className="mb-5 text-[0.65rem] font-medium uppercase tracking-[0.18em] text-accent/80">
              Severity distribution
            </h3>
            <SeverityDistribution counts={outcome.counts} />
          </div>
        </PanelBody>
      </Panel>

      {/* Versions */}
      <Panel>
        <PanelHeader
          eyebrow="Version history"
          title={
            siblings.length > 1
              ? `${siblings.length} versions of this content`
              : "Only one version"
          }
          description={
            siblings.length > 1
              ? "Each version is a separate audit of the same piece, in the order they were run."
              : "No other version of this content has been audited, so there is nothing to compare it against yet."
          }
          action={
            previous ? (
              <ButtonLink
                href={`/history/compare?before=${previous.id}&after=${audit.id}`}
                size="sm"
              >
                Compare with v{versionOf(previous)}
                <ArrowRightIcon width={15} height={15} />
              </ButtonLink>
            ) : null
          }
        />
        <PanelBody>
          <ul className="divide-y divide-border">
            {siblings.map((sibling) => {
              const isCurrent = sibling.id === audit.id;
              return (
                <li key={sibling.id}>
                  <Link
                    href={`/history/record?id=${sibling.id}`}
                    className={`flex flex-wrap items-center justify-between gap-4 px-1 py-3.5 transition-colors duration-200 ${
                      isCurrent ? "" : "hover:bg-surface-elevated/40"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.1em] ${
                          isCurrent
                            ? "border-accent/40 bg-accent/10 text-accent"
                            : "border-border text-foreground-muted"
                        }`}
                      >
                        v{versionOf(sibling)}
                      </span>
                      <span className="truncate text-sm text-foreground">
                        {sibling.title}
                      </span>
                      {isCurrent ? (
                        <span className="shrink-0 text-xs text-foreground-muted">
                          (viewing)
                        </span>
                      ) : null}
                    </span>
                    <span className="flex shrink-0 items-center gap-4 text-xs text-foreground-muted">
                      <span>{timeAgo(sibling.createdAt)}</span>
                      <span className="tabular-nums text-foreground">
                        {sibling.outcome.score}
                      </span>
                      <StatusPill status={sibling.status} />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </PanelBody>
      </Panel>

      {/* Findings */}
      <Panel>
        <PanelHeader
          eyebrow="Findings"
          title={
            outcome.findings.length === 0
              ? "No findings"
              : `${outcome.findings.length} finding${outcome.findings.length === 1 ? "" : "s"}`
          }
          description={
            outcome.findings.length === 0
              ? "This version raised nothing against the brand rules in force when it was audited."
              : "Exactly as recorded at the time of the audit."
          }
        />
        {outcome.findings.length > 0 ? (
          <div className="divide-y divide-border">
            {outcome.findings.map((finding) => (
              <article key={finding.id} className="space-y-3 px-6 py-5 sm:px-8">
                <div className="flex flex-wrap items-center gap-3">
                  <SeverityBadge severity={finding.severity} />
                  <h3 className="text-sm text-foreground">{finding.rule}</h3>
                  <span className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-[0.65rem] text-accent">
                    {finding.guidelineRef}
                  </span>
                </div>
                {finding.phrase ? (
                  <p className="font-mono text-xs text-critical">
                    “{finding.phrase}”
                    {finding.start < 0 ? (
                      <span className="ml-2 font-sans text-foreground-muted">
                        (not located in the draft)
                      </span>
                    ) : null}
                  </p>
                ) : null}
                <p className="text-sm leading-relaxed text-foreground-muted">
                  {finding.explanation}
                </p>
                <p className="text-sm leading-relaxed text-positive">
                  Suggested: {finding.suggestion}
                </p>
              </article>
            ))}
          </div>
        ) : null}
      </Panel>

      {/* Content as audited */}
      <Panel>
        <PanelHeader
          eyebrow="Content"
          title="As audited"
          description="The exact text these findings were computed against. Stored records are never rewritten, so this is what the reviewer saw."
        />
        <PanelBody>
          <HighlightedContent
            text={audit.text}
            findings={outcome.findings}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </PanelBody>
      </Panel>
    </div>
  );
}
