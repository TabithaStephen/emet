"use client";

import { beforeTextOf, type DiffResult } from "@/lib/diff/text-diff";

/**
 * Renders a word diff between two versions of a draft.
 *
 * Additions and removals are marked with both colour AND a symbol, because
 * red/green is the one pairing this design system treats as unreliable: coral
 * and emerald sit close together under deuteranopia, so neither mark is left
 * to carry its meaning on hue alone.
 */
export function DiffView({ diff }: { diff: DiffResult }) {
  if (diff.identical) {
    return (
      <p className="rounded-md border border-border bg-background-secondary px-4 py-3.5 text-sm leading-relaxed text-foreground-muted">
        The content is identical in both versions — not one character differs.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="whitespace-pre-wrap text-sm leading-[1.9] text-foreground-muted">
        {diff.segments.map((segment, index) => {
          if (segment.op === "equal") {
            return <span key={index}>{segment.text}</span>;
          }
          if (segment.op === "insert") {
            return (
              <ins
                key={index}
                className="rounded bg-positive/15 text-positive no-underline decoration-positive/40"
                title="Added in the later version"
              >
                {segment.text}
              </ins>
            );
          }
          return (
            <del
              key={index}
              className="rounded bg-critical/15 text-critical decoration-critical/50"
              title="Removed from the earlier version"
            >
              {beforeTextOf(segment)}
            </del>
          );
        })}
      </p>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border pt-4 text-xs text-foreground-muted">
        <span className="inline-flex items-center gap-2">
          <ins className="rounded bg-positive/15 px-1.5 text-positive no-underline">
            added
          </ins>
          {diff.added} word{diff.added === 1 ? "" : "s"}
        </span>
        <span className="inline-flex items-center gap-2">
          <del className="rounded bg-critical/15 px-1.5 text-critical">removed</del>
          {diff.removed} word{diff.removed === 1 ? "" : "s"}
        </span>
        <span>{diff.unchanged} unchanged</span>
        {diff.granularity === "paragraph" ? (
          <span className="text-accent">
            Compared paragraph by paragraph — these versions were too long for a
            word-level comparison.
          </span>
        ) : null}
      </div>
    </div>
  );
}
