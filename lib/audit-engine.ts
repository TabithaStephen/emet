import {
  SEVERITY_ORDER,
  type AuditResult,
  type BrandProfile,
  type Finding,
  type Severity,
} from "@/lib/types";

/**
 * Phase 1 audit engine.
 *
 * This is deterministic, local rule matching — NOT a language model. It reads the
 * brand rules the user edits in the Brand DNA Studio and flags literal matches in
 * the submitted text. It runs entirely in the browser; nothing leaves the device.
 * The AI reviewer replaces this in a later phase.
 */

/** Penalty points per finding. Exported so the score can be explained. */
export const SCORE_WEIGHTS: Record<Severity, number> = {
  critical: 18,
  high: 10,
  medium: 5,
  low: 2,
};

const SEVERITY_WEIGHT = SCORE_WEIGHTS;

/**
 * The single definition of the compliance score.
 *
 * Asymptotic rather than linear: a heavily flagged draft never saturates at
 * zero, so clearing any one finding always moves the score upward. One medium
 * issue lands near 92, one prohibited claim near 77.
 *
 * Exported so the Audit Studio can rescore the findings still in play after the
 * reviewer dismisses some, without keeping a second copy of the weights.
 */
export function scoreFromFindings(
  findings: Array<{ severity: Severity }>,
): number {
  const penalty = findings.reduce((sum, f) => sum + SEVERITY_WEIGHT[f.severity], 0);
  return Math.round(100 / (1 + penalty / 60));
}

/**
 * Plain-English account of how the score was reached.
 *
 * The score is computed here, never asked of the model: a language model cannot
 * give a reproducible number, and the dial has to move predictably when the
 * reviewer dismisses a finding. The model finds the problems; this arithmetic
 * grades them.
 */
export function explainScore(
  findings: Array<{ severity: Severity }>,
): string {
  const counts = SEVERITY_ORDER.reduce(
    (acc, severity) => {
      acc[severity] = findings.filter((f) => f.severity === severity).length;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0 } as Record<Severity, number>,
  );

  const penalty = findings.reduce((sum, f) => sum + SCORE_WEIGHTS[f.severity], 0);

  if (findings.length === 0) {
    return "No findings, so the score is 100. The score starts at 100 and falls as findings accumulate.";
  }

  const parts = SEVERITY_ORDER.filter((s) => counts[s] > 0).map(
    (s) => `${counts[s]} × ${s} (${SCORE_WEIGHTS[s]} each)`,
  );

  return `Penalty points: ${parts.join(" + ")} = ${penalty}. Score = 100 ÷ (1 + ${penalty}/60) = ${scoreFromFindings(
    findings,
  )}. The curve is asymptotic, so clearing any finding always raises the score and a heavily flagged draft never pins at zero.`;
}

/** Superlatives and absolutes that need evidence behind them. */
const UNSUPPORTED_SUPERLATIVES = [
  "the best",
  "world-class",
  "number one",
  "unmatched",
  "always outperforms",
  "never fails",
  "guaranteed",
  "remarkable",
  "exceptional",
];

/** Urgency devices the voice guidelines rule out. */
const URGENCY_PHRASES = ["act now", "don't miss out", "limited time", "hurry"];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Finds every case-insensitive occurrence of `needle`, respecting word edges. */
function findOccurrences(haystack: string, needle: string): Array<[number, number]> {
  const trimmed = needle.trim();
  if (!trimmed) return [];

  const leading = /^[\w]/.test(trimmed) ? "\\b" : "";
  const trailing = /[\w]$/.test(trimmed) ? "\\b" : "";
  const pattern = new RegExp(`${leading}${escapeRegExp(trimmed)}${trailing}`, "gi");

  const hits: Array<[number, number]> = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(haystack)) !== null) {
    hits.push([match.index, match.index + match[0].length]);
    if (match.index === pattern.lastIndex) pattern.lastIndex += 1;
  }
  return hits;
}

export function auditContent(text: string, brand: BrandProfile): AuditResult {
  const findings: Finding[] = [];
  let seq = 0;

  const push = (
    severity: Severity,
    range: [number, number],
    rule: string,
    explanation: string,
    guidelineRef: string,
    suggestion: string,
    replacement?: string,
  ) => {
    findings.push({
      id: `f${(seq += 1)}`,
      severity,
      phrase: text.slice(range[0], range[1]),
      start: range[0],
      end: range[1],
      rule,
      explanation,
      guidelineRef,
      suggestion,
      replacement,
    });
  };

  // 1. Prohibited claims — the highest-stakes category.
  brand.prohibitedClaims.forEach((claim, index) => {
    findOccurrences(text, claim.phrase).forEach((range) => {
      push(
        "critical",
        range,
        "Prohibited claim",
        claim.reason,
        `Prohibited Claims §${index + 1}`,
        "Remove the claim, or replace it with a published, attributable fact.",
      );
    });
  });

  // 2. Off-list terminology.
  brand.terminology.forEach((term, index) => {
    findOccurrences(text, term.avoid).forEach((range) => {
      push(
        "medium",
        range,
        "Off-list terminology",
        term.note,
        `Approved Terminology §${index + 1}`,
        `Use "${term.prefer}" instead of "${term.avoid}".`,
        term.prefer,
      );
    });
  });

  // 3. Superlatives with nothing behind them.
  UNSUPPORTED_SUPERLATIVES.forEach((word) => {
    findOccurrences(text, word).forEach((range) => {
      push(
        "high",
        range,
        "Unsupported superlative",
        "A comparative or absolute claim with no cited evidence in the approved facts list.",
        "Messaging Guidelines §2 — Evidence over opinion",
        "Cite an approved fact, or state the specific, measurable benefit instead.",
      );
    });
  });

  // 4. Urgency devices.
  URGENCY_PHRASES.forEach((phrase) => {
    findOccurrences(text, phrase).forEach((range) => {
      push(
        "medium",
        range,
        "Manufactured urgency",
        "Urgency devices conflict with the unhurried, advisory tone of the brand.",
        "Voice & Tone §1 — Unhurried",
        "State the deadline plainly, or remove the pressure entirely.",
      );
    });
  });

  // 5. Hype punctuation.
  findOccurrences(text, "!!").forEach((range) => {
    push(
      "low",
      range,
      "Hype punctuation",
      "Repeated exclamation marks read as promotional rather than advisory.",
      "Voice & Tone §2 — Measured",
      "Replace with a full stop.",
      ".",
    );
  });

  // 6. Shouting in capitals (four letters or more).
  const shouting = /\b[A-Z]{4,}\b/g;
  let caps: RegExpExecArray | null;
  while ((caps = shouting.exec(text)) !== null) {
    push(
      "low",
      [caps.index, caps.index + caps[0].length],
      "Shouting capitals",
      "Full capitals signal urgency the brand voice deliberately avoids.",
      "Voice & Tone §2 — Measured",
      "Use sentence case and let the sentence carry the emphasis.",
      caps[0].charAt(0) + caps[0].slice(1).toLowerCase(),
    );
  }

  // Resolve overlaps: when two rules claim the same span, keep the more severe one.
  const rank: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const ordered = [...findings].sort(
    (a, b) => a.start - b.start || rank[a.severity] - rank[b.severity],
  );
  const kept: Finding[] = [];
  for (const finding of ordered) {
    const clashes = kept.some((k) => finding.start < k.end && k.start < finding.end);
    if (!clashes) kept.push(finding);
  }

  const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  kept.forEach((f) => {
    counts[f.severity] += 1;
  });

  const score = scoreFromFindings(kept);
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  return {
    findings: kept.sort((a, b) => rank[a.severity] - rank[b.severity] || a.start - b.start),
    score,
    wordCount,
    counts,
  };
}

/** Splits text into highlighted and plain segments for the results view. */
export interface Segment {
  text: string;
  finding: Finding | null;
}

export function buildSegments(text: string, findings: Finding[]): Segment[] {
  const byPosition = [...findings].sort((a, b) => a.start - b.start);
  const segments: Segment[] = [];
  let cursor = 0;

  for (const finding of byPosition) {
    if (finding.start > cursor) {
      segments.push({ text: text.slice(cursor, finding.start), finding: null });
    }
    segments.push({ text: text.slice(finding.start, finding.end), finding });
    cursor = finding.end;
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), finding: null });
  }
  return segments;
}
