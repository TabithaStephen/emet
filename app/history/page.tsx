"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertIcon, ArrowRightIcon, DocumentIcon } from "@/components/icons";
import { ButtonLink } from "@/components/ui/button";
import { Meter } from "@/components/ui/data";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody } from "@/components/ui/panel";
import { SeverityBadge } from "@/components/ui/severity";
import { StatusPill } from "@/components/ui/status";
import {
  HISTORY_LIMIT,
  timeAgo,
  useAudits,
  useStorageStatus,
} from "@/lib/audit-store";
import {
  DATE_WINDOW_LABEL,
  EMPTY_FILTERS,
  channelsIn,
  cutoffFor,
  filterAudits,
  isFiltered,
  topSeverityOf,
  type DateWindow,
  type HistoryFilters,
} from "@/lib/history/filters";
import { lineagesOf, versionOf } from "@/lib/history/lineage";
import { SEVERITY_LABEL, SEVERITY_ORDER, type ReviewStatus, type Severity } from "@/lib/types";

/**
 * Audit history.
 *
 * Every completed audit appears here, whether or not it was submitted for
 * approval — the Approval Workspace shows only submitted work, this shows
 * everything that was actually run. Nothing on this page is sample data: with
 * no audits it says so rather than filling the screen with an illustration.
 */

const STATUS_OPTIONS: Array<{ id: ReviewStatus | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "draft", label: "Not submitted" },
  { id: "in-review", label: "In review" },
  { id: "approved", label: "Approved" },
  { id: "changes-requested", label: "Returned" },
];

const selectClass =
  "rounded-md border border-border bg-background-secondary px-3 py-2 text-xs text-foreground transition-colors duration-200 hover:border-silver/25 focus:border-accent/60 focus:outline-none";

export default function HistoryPage() {
  const audits = useAudits();
  const storage = useStorageStatus();
  const [filters, setFilters] = useState<HistoryFilters>(EMPTY_FILTERS);

  const channels = useMemo(() => channelsIn(audits), [audits]);
  const visible = useMemo(() => filterAudits(audits, filters), [audits, filters]);
  const lineages = useMemo(() => lineagesOf(audits), [audits]);
  const comparable = lineages.filter((l) => l.comparable);

  const set = <K extends keyof HistoryFilters>(key: K, value: HistoryFilters[K]) =>
    setFilters((current) => ({ ...current, [key]: value }));

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Audit History"
        title="Every audit this workspace has run."
        description="Each completed audit is recorded here the moment it finishes, submitted for approval or not. Stored in this browser only."
        action={
          audits.length > 0 ? (
            <span className="text-xs text-foreground-muted">
              {audits.length} audit{audits.length === 1 ? "" : "s"}
              {comparable.length > 0
                ? ` · ${comparable.length} with more than one version`
                : ""}
            </span>
          ) : null
        }
      />

      {/* Storage is written on every audit now, so a failure must be visible. */}
      {!storage.persisted && storage.error ? (
        <Panel className="border-critical/40">
          <PanelBody className="flex items-start gap-3">
            <AlertIcon width={16} height={16} className="mt-0.5 shrink-0 text-critical" />
            <p className="text-sm leading-relaxed text-critical">{storage.error}</p>
          </PanelBody>
        </Panel>
      ) : null}

      {storage.atCapacity ? (
        <Panel className="border-accent/30">
          <PanelBody className="flex items-start gap-3">
            <AlertIcon width={16} height={16} className="mt-0.5 shrink-0 text-accent" />
            <div className="min-w-0 space-y-1.5">
              <p className="text-sm leading-relaxed text-accent">
                History is full at {HISTORY_LIMIT} audits.
              </p>
              <p className="text-xs leading-relaxed text-foreground-muted">
                The oldest audit is discarded each time a new one is saved
                {storage.dropped > 0
                  ? `; ${storage.dropped} ${storage.dropped === 1 ? "has" : "have"} been dropped since this page was opened`
                  : ""}
                . Anything already removed cannot be recovered, so a version
                history may be incomplete.
              </p>
            </div>
          </PanelBody>
        </Panel>
      ) : null}

      {audits.length === 0 ? (
        <Panel>
          <PanelBody className="flex flex-col items-center gap-4 py-20 text-center">
            <DocumentIcon width={28} height={28} className="text-silver/50" />
            <h2 className="font-display text-xl text-foreground">No audits yet</h2>
            <p className="max-w-md text-sm leading-relaxed text-foreground-muted">
              Run an audit in the AI Audit Studio and it will be recorded here
              automatically — you do not have to submit it for approval first.
            </p>
            <ButtonLink href="/audit" variant="secondary" size="sm">
              Go to AI Audit Studio
              <ArrowRightIcon width={15} height={15} />
            </ButtonLink>
          </PanelBody>
        </Panel>
      ) : (
        <>
          {/* Search and filters */}
          <Panel>
            <PanelBody className="space-y-4">
              <input
                type="search"
                value={filters.query}
                onChange={(e) => set("query", e.target.value)}
                placeholder="Search titles and content…"
                aria-label="Search audit history"
                className="w-full rounded-md border border-border bg-background-secondary px-4 py-2.5 text-sm text-foreground placeholder:text-foreground-muted/60 transition-colors duration-200 hover:border-silver/25 focus:border-accent/60 focus:outline-none"
              />

              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2">
                  <span className="text-[0.65rem] uppercase tracking-[0.12em] text-foreground-muted">
                    Status
                  </span>
                  <select
                    value={filters.status}
                    onChange={(e) => set("status", e.target.value as ReviewStatus | "all")}
                    className={selectClass}
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex items-center gap-2">
                  <span className="text-[0.65rem] uppercase tracking-[0.12em] text-foreground-muted">
                    Severity
                  </span>
                  <select
                    value={filters.severity}
                    onChange={(e) => set("severity", e.target.value as Severity | "all")}
                    className={selectClass}
                  >
                    <option value="all">Any</option>
                    {SEVERITY_ORDER.map((s) => (
                      <option key={s} value={s}>
                        Contains {SEVERITY_LABEL[s].toLowerCase()}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex items-center gap-2">
                  <span className="text-[0.65rem] uppercase tracking-[0.12em] text-foreground-muted">
                    Channel
                  </span>
                  <select
                    value={filters.channel}
                    onChange={(e) => set("channel", e.target.value)}
                    className={selectClass}
                  >
                    <option value="all">Any</option>
                    {channels.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex items-center gap-2">
                  <span className="text-[0.65rem] uppercase tracking-[0.12em] text-foreground-muted">
                    When
                  </span>
                  <select
                    value={filters.window}
                    onChange={(e) => {
                      // Anchor the window here, in the handler: reading the
                      // clock during render is an unstable prerender value.
                      const next = e.target.value as DateWindow;
                      setFilters((current) => ({
                        ...current,
                        window: next,
                        windowFrom: cutoffFor(next),
                      }));
                    }}
                    className={selectClass}
                  >
                    {(Object.keys(DATE_WINDOW_LABEL) as DateWindow[]).map((w) => (
                      <option key={w} value={w}>
                        {DATE_WINDOW_LABEL[w]}
                      </option>
                    ))}
                  </select>
                </label>

                {isFiltered(filters) ? (
                  <button
                    onClick={() => setFilters(EMPTY_FILTERS)}
                    className="rounded px-3 py-2 text-xs text-accent transition-colors duration-200 hover:text-accent/75"
                  >
                    Clear filters
                  </button>
                ) : null}

                <span className="ml-auto text-xs text-foreground-muted">
                  {visible.length} of {audits.length} shown
                </span>
              </div>
            </PanelBody>
          </Panel>

          {/* Results */}
          {visible.length === 0 ? (
            <Panel>
              <PanelBody className="py-16 text-center">
                <p className="font-display text-xl text-foreground">Nothing matches</p>
                <p className="mt-2 text-sm text-foreground-muted">
                  No audit in your history matches these filters.
                </p>
              </PanelBody>
            </Panel>
          ) : (
            <Panel>
              <div className="divide-y divide-border">
                {visible.map((audit) => {
                  const top = topSeverityOf(audit);
                  const version = versionOf(audit);
                  return (
                    <Link
                      key={audit.id}
                      href={`/history/record?id=${audit.id}`}
                      className="flex flex-wrap items-center gap-x-6 gap-y-4 px-6 py-5 transition-colors duration-200 hover:bg-surface-elevated/40 sm:px-8"
                    >
                      <div className="min-w-0 flex-1 basis-64">
                        <div className="flex items-center gap-2.5">
                          <h3 className="truncate text-sm text-foreground">
                            {audit.title}
                          </h3>
                          {version > 1 ? (
                            <span className="shrink-0 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.1em] text-accent">
                              v{version}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1.5 text-xs text-foreground-muted">
                          {audit.channel} ·{" "}
                          {audit.outcome.engine === "gemini"
                            ? `Gemini ${audit.outcome.model ?? ""}`
                            : "Built-in rule check"}{" "}
                          · {timeAgo(audit.createdAt)}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        {top ? <SeverityBadge severity={top} /> : null}
                        <span className="text-xs text-foreground-muted">
                          {audit.outcome.findings.length} finding
                          {audit.outcome.findings.length === 1 ? "" : "s"}
                        </span>
                      </div>

                      <div className="w-28 shrink-0">
                        <div className="flex items-baseline justify-between">
                          <span className="text-[0.65rem] uppercase tracking-[0.14em] text-foreground-muted">
                            Score
                          </span>
                          <span className="text-sm tabular-nums text-foreground">
                            {audit.outcome.score}
                          </span>
                        </div>
                        <Meter value={audit.outcome.score} className="mt-2" />
                      </div>

                      <div className="shrink-0">
                        <StatusPill status={audit.status} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
