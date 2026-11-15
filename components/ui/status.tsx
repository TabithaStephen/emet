import type { AuditStatus } from "@/lib/types";

const STATUS: Record<AuditStatus, { label: string; className: string }> = {
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

export function StatusPill({ status }: { status: AuditStatus }) {
  const { label, className } = STATUS[status];
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border bg-background-secondary px-2.5 py-1 text-[0.65rem] font-medium uppercase tracking-[0.12em] ${className}`}
    >
      {label}
    </span>
  );
}
