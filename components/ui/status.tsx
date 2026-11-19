import type { ReviewStatus } from "@/lib/types";

/**
 * Keyed by `ReviewStatus`, which is `AuditStatus` plus `draft`. Existing
 * callers pass the narrower type, so they are unaffected.
 */
const STATUS: Record<ReviewStatus, { label: string; className: string }> = {
  draft: {
    // "Not submitted" says what it means to a reader; "draft" sounds unfinished.
    label: "Not submitted",
    className: "border-silver/25 text-foreground-muted",
  },
  approved: {
    label: "Approved",
    className: "border-positive/35 text-positive",
  },
  "in-review": {
    label: "In review",
    className: "border-silver/30 text-silver",
  },
  "changes-requested": {
    label: "Changes requested",
    className: "border-critical/35 text-critical",
  },
};

export function StatusPill({ status }: { status: ReviewStatus }) {
  const { label, className } = STATUS[status];
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border bg-background-secondary px-2.5 py-1 text-[0.65rem] font-medium uppercase tracking-[0.12em] ${className}`}
    >
      {label}
    </span>
  );
}
