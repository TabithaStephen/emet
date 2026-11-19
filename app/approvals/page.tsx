"use client";

import { useState } from "react";
import { ExportReportButton } from "@/components/audit/export-report-button";
import { ButtonLink, Button } from "@/components/ui/button";
import { DemoTag, Meter } from "@/components/ui/data";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody } from "@/components/ui/panel";
import { SEVERITY_LABEL, SEVERITY_VAR } from "@/components/ui/severity";
import { setAuditStatus, timeAgo, useAudits } from "@/lib/audit-store";
import { DEMO_APPROVALS } from "@/lib/demo-data";
import { SEVERITY_ORDER, type ReviewStatus } from "@/lib/types";

const FILTERS: Array<{ id: ReviewStatus | "all"; label: string }> = [
  { id: "in-review", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "changes-requested", label: "Returned" },
  { id: "all", label: "All" },
];

const STATUS_COPY: Record<ReviewStatus, string> = {
  draft: "Not yet submitted.",
  "in-review": "Awaiting your decision.",
  approved: "Approved for publication.",
  "changes-requested": "Returned to the author for revision.",
};

export default function ApprovalsPage() {
  const audits = useAudits();
  const [filter, setFilter] = useState<ReviewStatus | "all">("in-review");
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const visible = audits.filter((a) => (filter === "all" ? true : a.status === filter));
  const pendingCount = audits.filter((a) => a.status === "in-review").length;

  const requestChanges = (id: string) => {
    setAuditStatus(id, "changes-requested", note.trim() || null);
    setNoteFor(null);
    setNote("");
  };

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Approval Workspace"
        title="Human sign-off on flagged content."
        description="êmet never publishes a decision on its own. Audits submitted from the Audit Studio wait here for a person to approve them or send them back."
        action={
          audits.length > 0 ? (
            <span className="text-xs text-foreground-muted">
              {audits.length} saved audit{audits.length === 1 ? "" : "s"}
            </span>
          ) : null
        }
      />

      {audits.length === 0 ? (
        <>
          <Panel>
            <PanelBody className="flex flex-col items-center gap-4 py-16 text-center">
              <h2 className="font-display text-xl text-foreground">
                No audits submitted yet
              </h2>
              <p className="max-w-md text-sm leading-relaxed text-foreground-muted">
                Run an audit in the AI Audit Studio and submit it for review. It
                will appear here with its findings and score.
              </p>
              <ButtonLink href="/audit" variant="secondary" size="sm">
                Go to AI Audit Studio
              </ButtonLink>
            </PanelBody>
          </Panel>

          {/* Shown only while the real queue is empty, so the screen is not blank */}
          <section className="space-y-5">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-[0.65rem] font-medium uppercase tracking-[0.2em] text-foreground-muted">
                Sample queue
              </h2>
              <DemoTag>Demo data — not real submissions</DemoTag>
            </div>
            <div className="space-y-4">
              {DEMO_APPROVALS.map((item) => (
                <Panel key={item.id} className="opacity-70">
                  <PanelBody className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="font-display text-lg tracking-tight text-foreground">
                          {item.title}
                        </h3>
                        <p className="mt-1.5 text-xs text-foreground-muted">
                          {item.channel} · {item.owner} · {item.submittedAt}
                        </p>
                      </div>
                      <div className="w-36 shrink-0">
                        <div className="flex items-baseline justify-between">
                          <span className="text-[0.65rem] uppercase tracking-[0.14em] text-foreground-muted">
                            Score
                          </span>
                          <span className="text-sm tabular-nums text-foreground">
                            {item.score}
                          </span>
                        </div>
                        <Meter value={item.score} className="mt-2" />
                      </div>
                    </div>
                    <blockquote className="border-l-2 border-border pl-5 text-sm leading-relaxed text-foreground-muted">
                      {item.excerpt}
                    </blockquote>
                  </PanelBody>
                </Panel>
              ))}
            </div>
          </section>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div
              role="tablist"
              aria-label="Filter by decision"
              className="flex gap-1 rounded-md border border-border bg-background-secondary p-1"
            >
              {FILTERS.map((option) => (
                <button
                  key={option.id}
                  role="tab"
                  aria-selected={filter === option.id}
                  onClick={() => setFilter(option.id)}
                  className={`rounded px-4 py-1.5 text-xs transition-colors duration-200 ${
                    filter === option.id
                      ? "bg-surface-elevated text-foreground"
                      : "text-foreground-muted hover:text-foreground"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-foreground-muted">
              {pendingCount} awaiting decision
            </p>
          </div>

          {visible.length === 0 ? (
            <Panel>
              <PanelBody className="py-20 text-center">
                <p className="font-display text-xl text-foreground">Nothing here</p>
                <p className="mt-2 text-sm text-foreground-muted">
                  No submissions match this filter.
                </p>
              </PanelBody>
            </Panel>
          ) : (
            <div className="space-y-5">
              {visible.map((audit) => (
                <Panel key={audit.id}>
                  <PanelBody className="space-y-6">
                    <div className="flex flex-wrap items-start justify-between gap-5">
                      <div className="min-w-0">
                        <h2 className="font-display text-xl tracking-tight text-foreground">
                          {audit.title}
                        </h2>
                        <p className="mt-1.5 text-xs text-foreground-muted">
                          {audit.channel} · {timeAgo(audit.createdAt)} ·{" "}
                          {audit.outcome.engine === "gemini"
                            ? `Gemini ${audit.outcome.model ?? ""}`
                            : "Local rule check"}
                        </p>
                      </div>
                      <div className="w-40 shrink-0">
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
                    </div>

                    <blockquote className="line-clamp-3 border-l-2 border-border pl-5 text-sm leading-relaxed text-foreground-muted">
                      {audit.text}
                    </blockquote>

                    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                      {SEVERITY_ORDER.filter((s) => audit.outcome.counts[s] > 0).map(
                        (severity) => (
                          <span
                            key={severity}
                            className="inline-flex items-center gap-2 text-xs text-foreground-muted"
                          >
                            <span
                              aria-hidden
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ background: SEVERITY_VAR[severity] }}
                            />
                            {audit.outcome.counts[severity]}{" "}
                            {SEVERITY_LABEL[severity].toLowerCase()}
                          </span>
                        ),
                      )}
                      {audit.outcome.findings.length === 0 ? (
                        <span className="text-xs text-positive">No findings</span>
                      ) : null}
                    </div>

                    {audit.reviewNote ? (
                      <p className="rounded-md border border-border bg-background-secondary px-4 py-3 text-xs leading-relaxed text-foreground-muted">
                        <span className="text-foreground">Reviewer note:</span>{" "}
                        {audit.reviewNote}
                      </p>
                    ) : null}

                    <div className="space-y-4 border-t border-border pt-5">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <p className="text-xs text-foreground-muted">
                          {STATUS_COPY[audit.status]}
                          {audit.reviewedAt
                            ? ` Decided ${timeAgo(audit.reviewedAt)}.`
                            : ""}
                        </p>
                        <div className="flex flex-wrap items-start gap-2">
                          <ExportReportButton audit={audit} variant="ghost" label="Export PDF" />
                          {audit.status === "in-review" ? (
                            <>
                              <Button
                                size="sm"
                                onClick={() => setAuditStatus(audit.id, "approved")}
                              >
                                Approve
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() =>
                                  setNoteFor(noteFor === audit.id ? null : audit.id)
                                }
                              >
                                Return for changes
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setAuditStatus(audit.id, "in-review")}
                            >
                              Undo decision
                            </Button>
                          )}
                        </div>
                      </div>

                      {noteFor === audit.id ? (
                        <div className="space-y-3 rounded-md border border-border bg-background-secondary p-4">
                          <label className="block">
                            <span className="mb-1.5 block text-[0.7rem] font-medium uppercase tracking-[0.14em] text-foreground-muted">
                              Note for the author (optional)
                            </span>
                            <textarea
                              value={note}
                              onChange={(e) => setNote(e.target.value)}
                              rows={3}
                              placeholder="What needs to change before this can be approved?"
                              className="w-full resize-y rounded-md border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground placeholder:text-foreground-muted/60 focus:border-accent/60 focus:outline-none"
                            />
                          </label>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => requestChanges(audit.id)}>
                              Send back
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setNoteFor(null);
                                setNote("");
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </PanelBody>
                </Panel>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
