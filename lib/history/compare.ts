import { diffText, type DiffResult } from "@/lib/diff/text-diff";
import { fingerprintFinding, ruleKeyOf } from "@/lib/history/fingerprint";
import {
  SEVERITY_LABEL,
  SEVERITY_ORDER,
  type Finding,
  type SavedAudit,
  type Severity,
} from "@/lib/types";

/**
 * Compares two audited versions of the same content.
 *
 * Everything here is arithmetic and set matching over two stored records.
 * Nothing is inferred, estimated or smoothed: if a conclusion cannot be drawn
 * from the two records, the comparison says so rather than guessing. In
 * particular a score change is only described as an improvement when both
 * audits were judged against the same Brand DNA — otherwise the number moved
 * for a reason that has nothing to do with the writing.
 */

/** A finding that exists in both versions. */
export interface PersistentFinding {
  before: Finding;
  after: Finding;
  /** False when the wording moved but the same rule is still breached. */
  samePhrase: boolean;
  /** True when the same breach is now rated differently. */
  severityChanged: boolean;
}

export type ComparabilityIssue =
  | "different-brand"
  | "identical-content"
  | "different-lineage"
  | "reversed-order";

/**
 * A comparison WITHOUT the text diff.
 *
 * The diff is by far the most expensive part — a word-level LCS over two
 * drafts, which at the audit endpoint's 20,000-character ceiling costs around
 * half a second. Callers that only need the figures (the Insights page runs
 * one of these per revised lineage on every render) take this instead, so the
 * page does not spend seconds computing diffs it never shows.
 */
export interface OutcomeComparison {
  before: SavedAudit;
  after: SavedAudit;

  /** after − before. Positive means the score went up. */
  scoreDelta: number;
  /** after − before, per severity. Positive means more findings of that kind. */
  severityDeltas: Record<Severity, number>;
  findingsDelta: number;

  /** Present in the earlier version, gone from the later one. */
  resolved: Finding[];
  /** Present in both. */
  persistent: PersistentFinding[];
  /** Absent from the earlier version, present in the later one. */
  introduced: Finding[];

  /**
   * Whether the score movement can be attributed to the content at all.
   * False when the two audits were judged against different brand rules.
   */
  attributable: boolean;
  /** Anything that weakens the comparison, for the UI to state plainly. */
  issues: ComparabilityIssue[];

  direction: "improved" | "regressed" | "unchanged";
}

/** A full comparison: the figures above, plus the text diff and a summary. */
export interface AuditComparison extends OutcomeComparison {
  diff: DiffResult;
  /** One or two sentences, built only from the figures above. */
  summary: string;
}

const emptyCounts = (): Record<Severity, number> => ({
  critical: 0,
  high: 0,
  medium: 0,
  low: 0,
});

/**
 * Matches findings across the two versions in two passes.
 *
 * The first pass pairs findings that are the same rule breached by the same
 * words. The second pass pairs what is left by rule alone, so that rewording a
 * sentence without fixing the breach reads as persistent rather than as one
 * problem solved and a new one created. Whatever is still unmatched afterwards
 * genuinely only exists on one side.
 */
function matchFindings(before: Finding[], after: Finding[]) {
  const beforeTaken = new Set<number>();
  const afterTaken = new Set<number>();
  const persistent: PersistentFinding[] = [];

  // Pass one: exact — same rule, same words, same severity.
  const byFingerprint = new Map<string, number[]>();
  before.forEach((finding, index) => {
    const key = fingerprintFinding(finding);
    const bucket = byFingerprint.get(key);
    if (bucket) bucket.push(index);
    else byFingerprint.set(key, [index]);
  });

  after.forEach((finding, afterIndex) => {
    const bucket = byFingerprint.get(fingerprintFinding(finding));
    const beforeIndex = bucket?.shift();
    if (beforeIndex === undefined) return;
    beforeTaken.add(beforeIndex);
    afterTaken.add(afterIndex);
    persistent.push({
      before: before[beforeIndex],
      after: finding,
      samePhrase: true,
      severityChanged: false,
    });
  });

  // Pass two: same rule, different wording or severity.
  const byRule = new Map<string, number[]>();
  before.forEach((finding, index) => {
    if (beforeTaken.has(index)) return;
    const key = ruleKeyOf(finding);
    const bucket = byRule.get(key);
    if (bucket) bucket.push(index);
    else byRule.set(key, [index]);
  });

  after.forEach((finding, afterIndex) => {
    if (afterTaken.has(afterIndex)) return;
    const bucket = byRule.get(ruleKeyOf(finding));
    const beforeIndex = bucket?.shift();
    if (beforeIndex === undefined) return;
    beforeTaken.add(beforeIndex);
    afterTaken.add(afterIndex);
    persistent.push({
      before: before[beforeIndex],
      after: finding,
      samePhrase: false,
      severityChanged: before[beforeIndex].severity !== finding.severity,
    });
  });

  const resolved = before.filter((_, index) => !beforeTaken.has(index));
  const introduced = after.filter((_, index) => !afterTaken.has(index));

  // Most serious first, so a reader sees what matters at the top.
  const bySeverity = (a: Finding, b: Finding) =>
    SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
  resolved.sort(bySeverity);
  introduced.sort(bySeverity);
  persistent.sort((a, b) => bySeverity(a.after, b.after));

  return { resolved, persistent, introduced };
}

function listSeverities(findings: Finding[]): string {
  const counts = emptyCounts();
  for (const finding of findings) counts[finding.severity] += 1;
  return SEVERITY_ORDER.filter((s) => counts[s] > 0)
    .map((s) => `${counts[s]} ${SEVERITY_LABEL[s].toLowerCase()}`)
    .join(", ");
}

/**
 * Builds the written summary.
 *
 * Every clause is derived from a figure in the comparison, so the prose and
 * the numbers cannot drift apart, and nothing is claimed that the two records
 * do not support.
 */
function summarise(c: OutcomeComparison & { diff: DiffResult }): string {
  const parts: string[] = [];

  if (c.diff.identical) {
    parts.push("The content is identical in both versions.");
  } else {
    const bits: string[] = [];
    if (c.diff.added) bits.push(`${c.diff.added} word${c.diff.added === 1 ? "" : "s"} added`);
    if (c.diff.removed)
      bits.push(`${c.diff.removed} word${c.diff.removed === 1 ? "" : "s"} removed`);
    parts.push(bits.length ? `${bits.join(" and ")}.` : "Only spacing changed.");
  }

  if (!c.attributable) {
    parts.push(
      `The score moved from ${c.before.outcome.score} to ${c.after.outcome.score}, but the two audits were run against different Brand DNA, so that movement cannot be attributed to the rewrite.`,
    );
  } else if (c.scoreDelta === 0) {
    parts.push(`The score is unchanged at ${c.after.outcome.score}.`);
  } else {
    parts.push(
      `The score ${c.scoreDelta > 0 ? "rose" : "fell"} ${Math.abs(c.scoreDelta)} point${Math.abs(c.scoreDelta) === 1 ? "" : "s"}, from ${c.before.outcome.score} to ${c.after.outcome.score}.`,
    );
  }

  const outcome: string[] = [];
  if (c.resolved.length)
    outcome.push(`${c.resolved.length} finding${c.resolved.length === 1 ? "" : "s"} resolved (${listSeverities(c.resolved)})`);
  if (c.persistent.length) outcome.push(`${c.persistent.length} still present`);
  if (c.introduced.length)
    outcome.push(`${c.introduced.length} newly introduced (${listSeverities(c.introduced)})`);

  parts.push(
    outcome.length
      ? `${outcome.join(", ")}.`
      : "Neither version raised any findings.",
  );

  return parts.join(" ");
}

/**
 * Compares two stored audits WITHOUT diffing their text.
 *
 * Everything except the word diff and the written summary, for callers that
 * only need the figures.
 */
export function compareOutcomes(
  before: SavedAudit,
  after: SavedAudit,
): OutcomeComparison {
  const severityDeltas = emptyCounts();
  for (const severity of SEVERITY_ORDER) {
    severityDeltas[severity] =
      (after.outcome.counts[severity] ?? 0) - (before.outcome.counts[severity] ?? 0);
  }

  const { resolved, persistent, introduced } = matchFindings(
    before.outcome.findings,
    after.outcome.findings,
  );

  const issues: ComparabilityIssue[] = [];

  /*
   * Both hashes are optional: records saved before this feature existed have
   * neither. A missing hash means "unknown", which must not be reported as a
   * mismatch — so the check only fires when both are present and differ.
   */
  const sameBrand =
    before.brandHash && after.brandHash ? before.brandHash === after.brandHash : true;
  if (!sameBrand) issues.push("different-brand");

  /*
   * Compared directly rather than through the diff: whether two drafts are the
   * same string is a string comparison, and this path must stay cheap.
   */
  if (before.text === after.text) issues.push("identical-content");

  if (
    before.lineageId &&
    after.lineageId &&
    before.lineageId !== after.lineageId
  ) {
    issues.push("different-lineage");
  }

  if (new Date(after.createdAt).getTime() < new Date(before.createdAt).getTime()) {
    issues.push("reversed-order");
  }

  const scoreDelta = after.outcome.score - before.outcome.score;
  const findingsDelta = after.outcome.findings.length - before.outcome.findings.length;

  return {
    before,
    after,
    scoreDelta,
    severityDeltas,
    findingsDelta,
    resolved,
    persistent,
    introduced,
    attributable: sameBrand,
    issues,
    direction: scoreDelta > 0 ? "improved" : scoreDelta < 0 ? "regressed" : "unchanged",
  };
}

/**
 * Compares two stored audits in full, including the word-level text diff.
 *
 * `before` and `after` are taken in the order given. If they are passed in the
 * wrong chronological order that is reported as an issue rather than silently
 * corrected, because which version is "the revision" is the caller's decision.
 */
export function compareAudits(before: SavedAudit, after: SavedAudit): AuditComparison {
  const outcome = compareOutcomes(before, after);
  const diff = diffText(before.text, after.text);
  const withDiff = { ...outcome, diff };
  return { ...withDiff, summary: summarise(withDiff) };
}

/** Human-readable account of anything that weakens a comparison. */
export const COMPARABILITY_COPY: Record<ComparabilityIssue, string> = {
  "different-brand":
    "These two audits were judged against different Brand DNA, so a score change cannot be attributed to the content alone.",
  "identical-content":
    "The content is identical in both versions, so any score difference comes from the rules or the reviewer, not the writing.",
  "different-lineage":
    "These audits belong to different content lineages, so they are not two versions of the same piece.",
  "reversed-order":
    "The version selected as the later one was audited first; the comparison reads in the order you chose.",
};
