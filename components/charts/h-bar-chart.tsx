"use client";

import { useState } from "react";
import { ChartFrame } from "@/components/charts/chart-frame";
import { CHART_TONES, type ChartTone } from "@/components/charts/sparkline";
import { SEVERITY_LABEL, SEVERITY_VAR } from "@/components/ui/severity";
import type { Severity } from "@/lib/types";

export interface HBarDatum {
  label: string;
  value: number;
  /** Renders a labelled severity marker beneath the bar. */
  severity?: Severity;
  /** Plain secondary text beneath the bar, when severity does not apply. */
  note?: string;
  /**
   * Hue bound to this row's entity. Preferred over `palette`, because a chart
   * sorted a different way must not repaint the categories — a reader who
   * learned "Social is amethyst" would otherwise be misled.
   */
  colour?: ChartTone;
}

interface HBarChartProps {
  data: HBarDatum[];
  ariaLabel: string;
  /** Third column heading for the table twin, when rows carry a note. */
  metaColumn?: string;
  columns: [string, string];
  /** Upper bound of the shared scale. Omit to use the largest value. */
  max?: number;
  suffix?: string;
  footnote?: string;
  tone?: ChartTone;
  /**
   * One hue per row, assigned in fixed order. Never cycled: a row past the end
   * of the palette falls back to silver rather than reusing a hue, which would
   * imply two categories are the same.
   */
  palette?: ChartTone[];
  /**
   * Colour each bar by its own severity instead of one series hue. Safe here
   * because every row sits on its own baseline beside its own name and a
   * written severity label — colour never carries the identity.
   */
  colourBySeverity?: boolean;
}

/**
 * Ranked horizontal bars in HTML rather than SVG, so a long guideline name wraps
 * instead of being clipped. Every value is direct-laid at the bar tip, so no
 * number is reachable only by hovering.
 */
export function HBarChart({
  data,
  ariaLabel,
  columns,
  metaColumn,
  max,
  suffix = "",
  footnote,
  tone = "gold",
  palette,
  colourBySeverity = false,
}: HBarChartProps) {
  const [active, setActive] = useState<string | null>(null);
  const ceiling = max ?? Math.max(...data.map((d) => d.value), 1);

  const hueFor = (d: HBarDatum, index: number) => {
    if (d.colour) return CHART_TONES[d.colour];
    if (colourBySeverity && d.severity) return SEVERITY_VAR[d.severity];
    if (palette) return CHART_TONES[palette[index] ?? "silver"];
    return CHART_TONES[tone];
  };

  const metaText = (d: HBarDatum) =>
    d.severity ? `${SEVERITY_LABEL[d.severity]} severity` : (d.note ?? "");

  return (
    <ChartFrame
      columns={metaColumn ? [...columns, metaColumn] : columns}
      rows={data.map((d) =>
        metaColumn
          ? [d.label, `${d.value}${suffix}`, metaText(d)]
          : [d.label, `${d.value}${suffix}`],
      )}
      footnote={footnote}
    >
      <p className="sr-only">{ariaLabel}</p>
      <ul className="space-y-5">
        {data.map((datum, index) => {
          const dim = active !== null && active !== datum.label;
          const colour = hueFor(datum, index);
          return (
            <li
              key={datum.label}
              onPointerEnter={() => setActive(datum.label)}
              onPointerLeave={() => setActive(null)}
              className="-mx-3 rounded-md px-3 py-1.5 transition-colors duration-200 hover:bg-surface-elevated/40"
            >
              <div className="flex items-baseline justify-between gap-4">
                <span className="flex min-w-0 items-center gap-2.5 text-sm leading-snug text-foreground">
                  <span
                    aria-hidden
                    className="h-2 w-2 shrink-0 rounded-sm"
                    style={{ background: colour }}
                  />
                  {datum.label}
                </span>
                <span className="shrink-0 text-sm tabular-nums text-foreground">
                  {datum.value}
                  {suffix}
                </span>
              </div>

              {/* 6px track, 4px rounded data-end, one shared baseline */}
              {/* 8px track so the hue has room to read; full strength fill */}
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-elevated">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${(datum.value / ceiling) * 100}%`,
                    background: colour,
                    opacity: dim ? 0.4 : 1,
                    filter: dim ? undefined : `drop-shadow(0 0 4px ${colour})`,
                  }}
                />
              </div>

              {datum.severity ? (
                <p className="mt-2 inline-flex items-center gap-2 text-[0.65rem] uppercase tracking-[0.12em] text-foreground-muted">
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: SEVERITY_VAR[datum.severity] }}
                  />
                  {SEVERITY_LABEL[datum.severity]} severity
                </p>
              ) : datum.note ? (
                <p className="mt-2 text-[0.65rem] uppercase tracking-[0.12em] text-foreground-muted">
                  {datum.note}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </ChartFrame>
  );
}
