/**
 * Guided-demo step list and navigation rules.
 *
 * Pulled out of the component so the behaviour can be tested directly: the
 * clamping is what stops Back on step 1 or Next on step 8 walking off the end,
 * and that is exactly the kind of thing that breaks silently.
 */

export interface DemoStep {
  title: string;
  blurb: string;
}

export const DEMO_STEPS: DemoStep[] = [
  { title: "Welcome to êmet", blurb: "Why brand governance needs more than a PDF." },
  { title: "Brand DNA Studio", blurb: "The rules every audit is measured against." },
  { title: "Visual Brand Compliance", blurb: "Catching artwork that has drifted." },
  { title: "AI Content Audit", blurb: "What a review actually returns." },
  { title: "Fix and improve", blurb: "Corrections that keep the author's meaning." },
  { title: "Human approval", blurb: "A person always makes the final call." },
  { title: "Insights", blurb: "Patterns across every audit." },
  { title: "The complete workflow", blurb: "End to end, in one loop." },
];

export const TOTAL_STEPS = DEMO_STEPS.length;

/**
 * Keeps a requested step inside the list, however it was requested.
 *
 * Only NaN needs a special case: Math.min/max already pin ±Infinity to the
 * ends, which is the intuitive result. Guarding on `!isFinite` instead would
 * send Infinity to the FIRST step, which is the opposite of what a reader
 * would expect.
 */
export function clampStep(next: number, total: number = TOTAL_STEPS): number {
  if (Number.isNaN(next)) return 0;
  return Math.max(0, Math.min(total - 1, Math.trunc(next)));
}

export function isFirstStep(index: number): boolean {
  return index <= 0;
}

export function isLastStep(index: number, total: number = TOTAL_STEPS): boolean {
  return index >= total - 1;
}

/** Percentage shown in the progress bar, 1-based for humans. */
export function progressPercent(index: number, total: number = TOTAL_STEPS): number {
  return Math.round(((clampStep(index, total) + 1) / total) * 100);
}
