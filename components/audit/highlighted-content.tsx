"use client";

import { buildSegments } from "@/lib/audit-engine";
import type { Finding } from "@/lib/types";
import { SEVERITY_MARK } from "@/components/ui/severity";

interface HighlightedContentProps {
  text: string;
  findings: Finding[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** The submitted copy, with every flagged phrase marked in place. */
export function HighlightedContent({
  text,
  findings,
  selectedId,
  onSelect,
}: HighlightedContentProps) {
  const segments = buildSegments(text, findings);

  return (
    <p className="whitespace-pre-wrap text-sm leading-[1.9] text-foreground-muted">
      {segments.map((segment, index) => {
        if (!segment.finding) {
          return <span key={index}>{segment.text}</span>;
        }
        const active = segment.finding.id === selectedId;
        return (
          <button
            key={index}
            type="button"
            onClick={() => onSelect(segment.finding!.id)}
            aria-label={`${segment.finding.rule}: ${segment.finding.phrase}`}
            className={`rounded-sm px-0.5 text-foreground underline decoration-dotted underline-offset-4 transition-colors duration-200 ${
              SEVERITY_MARK[segment.finding.severity]
            } ${active ? "ring-1 ring-accent" : ""}`}
          >
            {segment.text}
          </button>
        );
      })}
    </p>
  );
}
