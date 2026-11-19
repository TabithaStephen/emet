import {
  SEVERITY_LABEL,
  SEVERITY_ORDER,
  type SavedAudit,
  type Severity,
} from "@/lib/types";

/**
 * Turns a real audit into the exact shape the PDF report draws.
 *
 * Deliberately pure and React-free, so it can be tested directly against a
 * genuine saved audit. It is also the ONLY source the renderer reads from:
 * the renderer holds no sample text of its own, so a report cannot show
 * anything the audit did not actually produce. An audit with no findings
 * renders as a report with no findings, not as a placeholder.
 */

/** Everything a report needs about one finding. */
export interface ReportFinding {
  number: number;
  severity: Severity;
  severityLabel: string;
  title: string;
  phrase: string;
  /** False when the phrase could not be located in the draft. */
  located: boolean;
  explanation: string;
  guideline: string;
  suggestion: string;
}

export interface ReportModel {
  brandName: string;
  title: string;
  channel: string;
  createdAtLabel: string;
  /** Null when the audit has not been decided yet. */
  reviewedAtLabel: string | null;
  statusLabel: string;
  reviewNote: string | null;
  /** "Google Gemini · model", or the honest label for the local check. */
  engineLabel: string;
  isAi: boolean;
  score: number;
  verdict: string;
  scoreRationale: string;
  summary: string | null;
  wordCount: number;
  counts: Record<Severity, number>;
  findings: ReportFinding[];
  content: string;
  unlocated: number;
  generatedAtLabel: string;
  /** Suggested download name. */
  fileName: string;
}

const STATUS_LABEL: Record<SavedAudit["status"], string> = {
  draft: "Draft — not yet submitted",
  "in-review": "In review — awaiting a decision",
  approved: "Approved for publication",
  "changes-requested": "Returned for changes",
};

/** Same thresholds as the Audit Studio, so the report never disagrees with it. */
export function verdictFor(score: number): string {
  if (score >= 90) return "Ready to publish.";
  if (score >= 70) return "Minor revisions recommended before sign-off.";
  return "Needs rework before it can go to approval.";
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return `${formatDate(iso)} at ${date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

/** Lowercase, hyphenated, ASCII-safe — suitable for a download name. */
function slug(value: string): string {
  return (
    value
      .normalize("NFKD")
      // Drop combining marks so "é" becomes "e" rather than vanishing.
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "audit"
  );
}

/**
 * Builds the report model from an audit that actually ran.
 *
 * Takes a `SavedAudit` without its id, so the Audit Studio can export a result
 * that is on screen but not yet submitted, and the Approval Workspace can
 * export one that has been through review — the same report either way.
 */
export function buildReportModel(
  audit: Omit<SavedAudit, "id">,
  brandName: string,
  now: Date = new Date(),
): ReportModel {
  const { outcome } = audit;

  const findings: ReportFinding[] = outcome.findings.map((finding, index) => ({
    number: index + 1,
    severity: finding.severity,
    severityLabel: SEVERITY_LABEL[finding.severity],
    title: finding.rule,
    phrase: finding.phrase,
    located: finding.start >= 0,
    explanation: finding.explanation,
    guideline: finding.guidelineRef,
    suggestion: finding.suggestion,
  }));

  // Most serious first, so the report opens on what matters.
  findings.sort(
    (a, b) =>
      SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) ||
      a.number - b.number,
  );
  findings.forEach((finding, index) => {
    finding.number = index + 1;
  });

  const trimmedName = brandName.trim();

  return {
    brandName: trimmedName || "Unnamed brand",
    title: audit.title.trim() || "Untitled submission",
    channel: audit.channel,
    createdAtLabel: formatDateTime(audit.createdAt),
    reviewedAtLabel: audit.reviewedAt ? formatDateTime(audit.reviewedAt) : null,
    statusLabel: STATUS_LABEL[audit.status],
    reviewNote: audit.reviewNote,
    engineLabel:
      outcome.engine === "gemini"
        ? `Google Gemini · ${outcome.model ?? "unknown model"}`
        : "Built-in rule check — not AI",
    isAi: outcome.engine === "gemini",
    score: outcome.score,
    verdict: verdictFor(outcome.score),
    scoreRationale: outcome.scoreRationale,
    summary: outcome.summary,
    wordCount: outcome.wordCount,
    counts: outcome.counts,
    findings,
    content: audit.text,
    unlocated: outcome.unlocated,
    generatedAtLabel: formatDateTime(now.toISOString()),
    fileName: `emet-audit-${slug(audit.title)}-${now.toISOString().slice(0, 10)}.pdf`,
  };
}
