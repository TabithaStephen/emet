import { compareOutcomes } from "@/lib/history/compare";
import { lineagesOf, versionsInOrder } from "@/lib/history/lineage";
import type { SavedAudit } from "@/lib/types";

/**
 * Improvement insights drawn from stored audits.
 *
 * Every figure here is counted from records that exist. Nothing is projected,
 * smoothed or filled in, and where the stored data cannot support a claim the
 * result says so rather than offering a plausible-looking number. In
 * particular:
 *
 *  - A lineage only contributes to the improvement figures when both of its
 *    end points were judged against the same Brand DNA. Otherwise the score
 *    moved for a reason that has nothing to do with the writing.
 *  - A recurring violation is one seen in more than one SEPARATE audit, not
 *    one that happens to appear twice in a single draft.
 */

export interface LineageProgress {
  lineageId: string;
  title: string;
  versions: number;
  firstScore: number;
  latestScore: number;
  delta: number;
  resolved: number;
  introduced: number;
  persistent: number;
  /** False when the two ends used different brand rules. */
  attributable: boolean;
}

export interface RecurringViolation {
  guideline: string;
  rule: string;
  /** How many separate audits raised it. */
  audits: number;
  /** Total occurrences across those audits. */
  occurrences: number;
}

export interface HistoryInsights {
  /** Audits that exist at all. */
  totalAudits: number;
  /** Content with more than one audited version. */
  revisedLineages: number;
  /** Progress per lineage, biggest improvement first. */
  progress: LineageProgress[];
  /** Lineages excluded because the brand rules changed between versions. */
  unattributable: number;
  improved: number;
  regressed: number;
  unchanged: number;
  /** Mean score change across attributable lineages, or null when there are none. */
  meanDelta: number | null;
  recurring: RecurringViolation[];
  /** Scores over time, oldest first — only real audits, never padded. */
  scoreSeries: Array<{ label: string; value: number }>;
}

/** Violations seen across more than one audit. */
export function recurringViolations(audits: SavedAudit[]): RecurringViolation[] {
  const seen = new Map<
    string,
    { guideline: string; rule: string; audits: Set<string>; occurrences: number }
  >();

  for (const audit of audits) {
    for (const finding of audit.outcome.findings) {
      const key = `${finding.guidelineRef}\u0000${finding.rule}`;
      const row =
        seen.get(key) ??
        {
          guideline: finding.guidelineRef,
          rule: finding.rule,
          audits: new Set<string>(),
          occurrences: 0,
        };
      row.audits.add(audit.id);
      row.occurrences += 1;
      seen.set(key, row);
    }
  }

  return [...seen.values()]
    .filter((row) => row.audits.size > 1)
    .map((row) => ({
      guideline: row.guideline,
      rule: row.rule,
      audits: row.audits.size,
      occurrences: row.occurrences,
    }))
    .sort((a, b) => b.audits - a.audits || b.occurrences - a.occurrences);
}

/** Everything the Insights page needs, computed from stored audits alone. */
export function buildHistoryInsights(audits: SavedAudit[]): HistoryInsights {
  const lineages = lineagesOf(audits);
  const revised = lineages.filter((l) => l.comparable);

  const progress: LineageProgress[] = [];
  let unattributable = 0;

  for (const lineage of revised) {
    const ordered = versionsInOrder(audits, lineage.id);
    const first = ordered[0];
    const latest = ordered[ordered.length - 1];
    // compareOutcomes, not compareAudits: this runs once per revised lineage
    // on every render, and none of the figures below need the text diff.
    const comparison = compareOutcomes(first, latest);

    if (!comparison.attributable) unattributable += 1;

    progress.push({
      lineageId: lineage.id,
      title: latest.title,
      versions: ordered.length,
      firstScore: first.outcome.score,
      latestScore: latest.outcome.score,
      delta: comparison.scoreDelta,
      resolved: comparison.resolved.length,
      introduced: comparison.introduced.length,
      persistent: comparison.persistent.length,
      attributable: comparison.attributable,
    });
  }

  progress.sort((a, b) => b.delta - a.delta);

  // Only attributable lineages count toward the headline direction.
  const attributable = progress.filter((p) => p.attributable);
  const improved = attributable.filter((p) => p.delta > 0).length;
  const regressed = attributable.filter((p) => p.delta < 0).length;
  const unchanged = attributable.filter((p) => p.delta === 0).length;
  const meanDelta = attributable.length
    ? Math.round(
        attributable.reduce((sum, p) => sum + p.delta, 0) / attributable.length,
      )
    : null;

  // Oldest first, so a chart reads left to right in time.
  const scoreSeries = [...audits]
    .sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )
    .map((audit, index) => ({
      label: `#${index + 1}`,
      value: audit.outcome.score,
    }));

  return {
    totalAudits: audits.length,
    revisedLineages: revised.length,
    progress,
    unattributable,
    improved,
    regressed,
    unchanged,
    meanDelta,
    recurring: recurringViolations(audits),
    scoreSeries,
  };
}
