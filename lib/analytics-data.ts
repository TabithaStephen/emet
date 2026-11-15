import { DEMO_ISSUE_TRENDS } from "@/lib/demo-data";
import { SEVERITY_ORDER, type Severity } from "@/lib/types";

/**
 * DEMO HISTORICAL DATA — Phase 1.
 *
 * These twelve-week series are illustrative sample figures for the prototype.
 * They are NOT real measurements and must never be presented as any
 * organisation's actual performance. Every screen that renders them carries a
 * visible "Demo data" tag.
 *
 * Anything that can be computed from live audit results is derived instead of
 * being hardcoded — see `deriveSeverityTotals` below and the Audit Studio, which
 * charts the real result object.
 */

export interface TrendDatum {
  label: string;
  value: number;
}

/** Weighted average compliance score per week. Sample data. */
export const DEMO_SCORE_TREND: TrendDatum[] = [
  { label: "W1", value: 64 },
  { label: "W2", value: 61 },
  { label: "W3", value: 68 },
  { label: "W4", value: 72 },
  { label: "W5", value: 70 },
  { label: "W6", value: 75 },
  { label: "W7", value: 73 },
  { label: "W8", value: 79 },
  { label: "W9", value: 77 },
  { label: "W10", value: 82 },
  { label: "W11", value: 84 },
  { label: "W12", value: 83 },
];

/** Audits submitted per week. Sample data. */
export const DEMO_AUDIT_ACTIVITY: TrendDatum[] = [
  { label: "W1", value: 6 },
  { label: "W2", value: 9 },
  { label: "W3", value: 7 },
  { label: "W4", value: 12 },
  { label: "W5", value: 10 },
  { label: "W6", value: 14 },
  { label: "W7", value: 11 },
  { label: "W8", value: 16 },
  { label: "W9", value: 13 },
  { label: "W10", value: 18 },
  { label: "W11", value: 15 },
  { label: "W12", value: 17 },
];

/**
 * Severity totals summed from the recurring-issue counts, so the distribution
 * chart and the issue list can never disagree.
 */
export function deriveSeverityTotals(): Record<Severity, number> {
  const totals: Record<Severity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  DEMO_ISSUE_TRENDS.forEach((issue) => {
    totals[issue.severity] += issue.count;
  });
  return totals;
}

/** Percentage change between the first and last point of a series. */
export function trendDelta(series: TrendDatum[]): number {
  if (series.length < 2) return 0;
  const first = series[0].value;
  const lastValue = series[series.length - 1].value;
  if (first === 0) return 0;
  return Math.round(((lastValue - first) / first) * 100);
}

/** Sum of every severity bucket. */
export function totalFindings(counts: Record<Severity, number>): number {
  return SEVERITY_ORDER.reduce((sum, s) => sum + counts[s], 0);
}

/**
 * Hue bound to each channel, so every chart paints a channel the same colour
 * however it is sorted.
 */
export const CHANNEL_TONES: Record<string, "gold" | "emerald" | "coral" | "sapphire" | "amethyst" | "turquoise"> = {
  Email: "sapphire",
  Web: "turquoise",
  Social: "coral",
  Print: "emerald",
};

export interface IssueDelta {
  label: string;
  count: number;
  previous: number;
  change: number;
  percentChange: number;
  improving: boolean;
}

/**
 * Direction of travel per recurring issue, computed from the current and prior
 * counts. Nothing here is asserted — every figure is arithmetic on the two
 * demo counts, so the written read-out below the chart cannot drift from them.
 */
export function issueDeltas(): IssueDelta[] {
  return DEMO_ISSUE_TRENDS.map((issue) => {
    const change = issue.count - issue.previous;
    return {
      label: issue.label,
      count: issue.count,
      previous: issue.previous,
      change,
      percentChange:
        issue.previous === 0 ? 0 : Math.round((change / issue.previous) * 100),
      improving: change < 0,
    };
  });
}
