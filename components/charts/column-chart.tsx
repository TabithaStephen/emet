"use client";

import { useRef, useState } from "react";
import { ChartFrame, ChartTooltip } from "@/components/charts/chart-frame";

export interface ColumnDatum {
  label: string;
  value: number;
}

interface ColumnChartProps {
  data: ColumnDatum[];
  ariaLabel: string;
  columns: [string, string];
  footnote?: string;
  unit?: string;
  tickEvery?: number;
  /** Draw the last column in champagne gold, to mark the current period. */
  highlightLast?: boolean;
}

/**
 * Sapphire to turquoise across the series. Blue and cyan are analogous
 * neighbours, so this reads as one ordered ramp rather than a rainbow, and the
 * x-axis it tracks is genuinely ordered (time), not nominal.
 */
const RAMP_FROM = [120, 155, 250]; // #789BFA sapphire
const RAMP_TO = [83, 194, 209]; // #53C2D1 turquoise

function rampColour(ratio: number) {
  const mix = RAMP_FROM.map((from, i) =>
    Math.round(from + (RAMP_TO[i] - from) * ratio),
  );
  return `rgb(${mix[0]} ${mix[1]} ${mix[2]})`;
}

const VB_W = 680;
const VB_H = 180;
const PAD = { top: 20, right: 8, bottom: 28, left: 32 };
const PLOT_W = VB_W - PAD.left - PAD.right;
const PLOT_H = VB_H - PAD.top - PAD.bottom;
const GAP = 2; // the surface gap does the separating, not a stroke
const MAX_BAR = 24;

/** Rounded 4px at the data end, square where it meets the baseline. */
function columnPath(bx: number, bw: number, top: number, base: number) {
  const h = base - top;
  if (h <= 4) return `M${bx},${base} h${bw} v${-h} h${-bw} Z`;
  const r = 4;
  return [
    `M${bx},${base}`,
    `V${top + r}`,
    `Q${bx},${top} ${bx + r},${top}`,
    `H${bx + bw - r}`,
    `Q${bx + bw},${top} ${bx + bw},${top + r}`,
    `V${base}`,
    "Z",
  ].join(" ");
}

export function ColumnChart({
  data,
  ariaLabel,
  columns,
  footnote,
  unit = "",
  tickEvery = 2,
  highlightLast = true,
}: ColumnChartProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const [width, setWidth] = useState(0);

  const max = Math.max(...data.map((d) => d.value), 1);
  const peak = data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0);
  const slot = PLOT_W / data.length;
  const barW = Math.min(MAX_BAR, slot - GAP * 2);
  const base = PAD.top + PLOT_H;

  const bx = (i: number) => PAD.left + i * slot + (slot - barW) / 2;
  const top = (v: number) => base - (v / max) * PLOT_H;

  const measure = () => {
    const w = wrap.current?.clientWidth ?? 0;
    setWidth(w);
    return w;
  };

  const shown = active;

  return (
    <ChartFrame
      columns={columns}
      rows={data.map((d) => [d.label, `${d.value}${unit}`])}
      footnote={footnote}
    >
      <div ref={wrap} className="relative w-full">
        {shown !== null && width > 0 ? (
          <ChartTooltip
            x={((bx(shown) + barW / 2) / VB_W) * width}
            title={data[shown].label}
            value={`${data[shown].value}${unit}`}
          />
        ) : null}

        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="h-auto w-full"
          style={{ aspectRatio: `${VB_W} / ${VB_H}` }}
          role="img"
          aria-label={`${ariaLabel} Press the left and right arrow keys to step through each column.`}
          tabIndex={0}
          onFocus={() => {
            measure();
            setActive(data.length - 1);
          }}
          onBlur={() => setActive(null)}
          onKeyDown={(e) => {
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
            e.preventDefault();
            measure();
            setActive((current) => {
              const cur = current ?? data.length - 1;
              return e.key === "ArrowLeft"
                ? Math.max(0, cur - 1)
                : Math.min(data.length - 1, cur + 1);
            });
          }}
        >
          {/* Faint plot background, so the bars sit on a surface of their own */}
          <rect
            x={PAD.left}
            y={PAD.top}
            width={PLOT_W}
            height={PLOT_H}
            fill="var(--background-secondary)"
            fillOpacity={0.55}
            rx={4}
          />
          <line
            x1={PAD.left}
            x2={PAD.left + PLOT_W}
            y1={base}
            y2={base}
            stroke="var(--surface-elevated)"
            strokeWidth={1}
          />
          <text
            x={PAD.left - 8}
            y={base + 4}
            textAnchor="end"
            className="fill-[var(--foreground-muted)] text-[11px] tabular-nums"
          >
            0
          </text>
          <text
            x={PAD.left - 8}
            y={PAD.top + 4}
            textAnchor="end"
            className="fill-[var(--foreground-muted)] text-[11px] tabular-nums"
          >
            {max}
          </text>

          {data.map((d, i) => {
            const isLatest = highlightLast && i === data.length - 1;
            const colour = isLatest
              ? "var(--gold)"
              : rampColour(data.length > 1 ? i / (data.length - 1) : 0);
            const faded = shown !== null && shown !== i;
            return (
              <path
                key={d.label}
                d={columnPath(bx(i), barW, top(d.value), base)}
                fill={colour}
                fillOpacity={faded ? 0.4 : 1}
                className="transition-opacity duration-200"
                style={
                  isLatest ? { filter: "drop-shadow(0 0 6px var(--gold))" } : undefined
                }
              />
            );
          })}

          {/* One direct label: the peak. The axis and tooltip carry the rest. */}
          <text
            x={bx(peak) + barW / 2}
            y={top(data[peak].value) - 7}
            textAnchor="middle"
            className="fill-[var(--foreground)] text-[11px]"
          >
            {data[peak].value}
          </text>

          {data.map((d, i) =>
            i % tickEvery === 0 ? (
              <text
                key={`t-${d.label}`}
                x={bx(i) + barW / 2}
                y={VB_H - 9}
                textAnchor="middle"
                className="fill-[var(--foreground-muted)] text-[11px]"
              >
                {d.label}
              </text>
            ) : null,
          )}

          {/* Full-height hit slots, so the target is never the bar width alone */}
          {data.map((d, i) => (
            <rect
              key={`hit-${d.label}`}
              x={PAD.left + i * slot}
              y={PAD.top}
              width={slot}
              height={PLOT_H}
              fill="transparent"
              onPointerEnter={() => {
                measure();
                setActive(i);
              }}
              onPointerLeave={() => setActive(null)}
            />
          ))}
        </svg>
      </div>
    </ChartFrame>
  );
}
