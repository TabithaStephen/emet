"use client";

import { ChartFrame } from "@/components/charts/chart-frame";
import { DonutChart, type DonutSlice } from "@/components/charts/donut-chart";
import { SEVERITY_LABEL, SEVERITY_VAR } from "@/components/ui/severity";
import { SEVERITY_ORDER, type Severity } from "@/lib/types";

interface SeverityDistributionProps {
  counts: Record<Severity, number>;
  /** Pass a label such as "findings" or "violations". */
  noun?: string;
}

/**
 * Severity as a part-to-whole ring: coral, champagne, sapphire, emerald.
 * The legend carries every count and percentage, and the frame adds a table,
 * so no value depends on reading the colours apart.
 */
export function SeverityDistribution({
  counts,
  noun = "findings",
}: SeverityDistributionProps) {
  const total = SEVERITY_ORDER.reduce((sum, s) => sum + counts[s], 0);
  const share = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100));

  const slices: DonutSlice[] = SEVERITY_ORDER.map((severity) => ({
    key: severity,
    label: SEVERITY_LABEL[severity],
    value: counts[severity],
    colour: SEVERITY_VAR[severity],
  }));

  if (total === 0) {
    return (
      <p className="rounded-md border border-dashed border-border px-5 py-10 text-center text-sm text-foreground-muted">
        No {noun} to distribute.
      </p>
    );
  }

  return (
    <ChartFrame
      columns={["Severity", noun === "findings" ? "Findings" : "Violations", "Share"]}
      rows={SEVERITY_ORDER.map((s) => [
        SEVERITY_LABEL[s],
        counts[s],
        `${share(counts[s])}%`,
      ])}
      footnote={`${total} ${noun} in total. Percentages derived from the counts.`}
    >
      <p className="sr-only">
        {`Severity distribution of ${total} ${noun}: ` +
          SEVERITY_ORDER.map(
            (s) => `${SEVERITY_LABEL[s]} ${counts[s]}, ${share(counts[s])} percent`,
          ).join("; ")}
      </p>
      <DonutChart slices={slices} noun={noun} />
    </ChartFrame>
  );
}
