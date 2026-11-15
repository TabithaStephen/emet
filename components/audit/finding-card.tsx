"use client";

import { Button } from "@/components/ui/button";
import { SEVERITY_EDGE, SeverityBadge } from "@/components/ui/severity";
import type { Finding } from "@/lib/types";

interface FindingCardProps {
  finding: Finding;
  selected: boolean;
  dismissed: boolean;
  onSelect: () => void;
  onDismiss: () => void;
  onApply: () => void;
}

export function FindingCard({
  finding,
  selected,
  dismissed,
  onSelect,
  onDismiss,
  onApply,
}: FindingCardProps) {
  return (
    <article
      onClick={onSelect}
      className={`cursor-pointer border-l-2 bg-background-secondary px-5 py-5 transition-colors duration-200 ${
        SEVERITY_EDGE[finding.severity]
      } ${selected ? "bg-surface-elevated/60" : "hover:bg-surface-elevated/35"} ${
        dismissed ? "opacity-40" : ""
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SeverityBadge severity={finding.severity} />
        {/* Guideline reference as its own chip, so the rule is scannable */}
        <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[0.65rem] font-medium tracking-[0.06em] text-accent">
          <svg
            viewBox="0 0 24 24"
            width={11}
            height={11}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path d="M5 4h11l3 3v13H5z" />
            <path d="M9 10h6M9 14h4" />
          </svg>
          {finding.guidelineRef}
        </span>
      </div>

      <h3 className="mt-3 text-sm text-foreground">{finding.rule}</h3>

      <p className="mt-2 font-mono text-[0.8rem] text-silver">
        “{finding.phrase}”
      </p>

      <p className="mt-3 text-xs leading-relaxed text-foreground-muted">
        {finding.explanation}
      </p>

      <div className="mt-4 rounded-md border border-border bg-surface px-4 py-3">
        <p className="text-[0.6rem] font-medium uppercase tracking-[0.16em] text-accent/80">
          Suggested rewrite
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-foreground">
          {finding.suggestion}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {finding.replacement && !dismissed ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onApply();
            }}
          >
            Apply fix
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
        >
          {dismissed ? "Restore" : "Dismiss"}
        </Button>
      </div>
    </article>
  );
}
