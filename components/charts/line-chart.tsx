"use client";

import { useId, useRef, useState } from "react";
import { ChartFrame, ChartTooltip } from "@/components/charts/chart-frame";
import { CHART_TONES, type ChartTone } from "@/components/charts/sparkline";

export interface TrendPoint {
  label: string;
  value: number;
}

interface LineChartProps {
  points: TrendPoint[];
  ariaLabel: string;
  columns: [string, string];
  min?: number;
  max?: number;
  suffix?: string;
  footnote?: string;
  /** Single series, so one hue and no legend — the title names what is plotted. */
  tone?: ChartTone;
  /** Show every nth x-axis label, to stop them colliding. */
  tickEvery?: number;
}

const VB_W = 680;
const VB_H = 216;
const PAD = { top: 18, right: 54, bottom: 30, left: 38 };
const PLOT_W = VB_W - PAD.left - PAD.right;
const PLOT_H = VB_H - PAD.top - PAD.bottom;

export function LineChart({
  points,
  ariaLabel,
  columns,
  min,
  max,
  suffix = "",
  footnote,
  tone = "gold",
  tickEvery = 3,
}: LineChartProps) {
  const wrap = useRef<HTMLDivElement>(null);
  // useId() contains colons, which are not safe inside an SVG url(#id) reference.
  const gradientId = `grad${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [active, setActive] = useState<number | null>(null);
  const [width, setWidth] = useState(0);

  const hue = CHART_TONES[tone];
  const values = points.map((p) => p.value);
  const lo = min ?? Math.max(0, Math.floor((Math.min(...values) - 6) / 10) * 10);
  const hi = max ?? Math.ceil((Math.max(...values) + 4) / 10) * 10;
  const span = hi - lo || 1;

  const x = (i: number) =>
    PAD.left + (points.length === 1 ? PLOT_W / 2 : (i / (points.length - 1)) * PLOT_W);
  const y = (v: number) => PAD.top + (1 - (v - lo) / span) * PLOT_H;

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.value)}`).join(" ");
  const area = `${line} L${x(points.length - 1)},${PAD.top + PLOT_H} L${x(0)},${
    PAD.top + PLOT_H
  } Z`;

  const ticks = [0, 1, 2, 3].map((i) => Math.round(lo + (span * i) / 3));
  const last = points.length - 1;
  const shown = active ?? last;

  const measure = () => {
    const w = wrap.current?.clientWidth ?? 0;
    setWidth(w);
    return w;
  };

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const vbX = ((e.clientX - rect.left) / rect.width) * PLOT_W + PAD.left;
    const ratio = (vbX - PAD.left) / PLOT_W;
    const index = Math.max(0, Math.min(last, Math.round(ratio * last)));
    measure();
    setActive(index);
  };

  const tooltipLeft = width > 0 ? (x(shown) / VB_W) * width : 0;

  return (
    <ChartFrame
      columns={columns}
      rows={points.map((p) => [p.label, `${p.value}${suffix}`])}
      footnote={footnote}
    >
      <div ref={wrap} className="relative w-full">
        {active !== null && width > 0 ? (
          <ChartTooltip
            x={tooltipLeft}
            title={points[shown].label}
            value={`${points[shown].value}${suffix}`}
          />
        ) : null}

        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="h-auto w-full"
          style={{ aspectRatio: `${VB_W} / ${VB_H}` }}
          role="img"
          aria-label={`${ariaLabel} Press the left and right arrow keys to step through each week.`}
          tabIndex={0}
          onFocus={() => {
            measure();
            setActive(last);
          }}
          onBlur={() => setActive(null)}
          onKeyDown={(e) => {
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
            e.preventDefault();
            measure();
            setActive((current) => {
              const base = current ?? last;
              return e.key === "ArrowLeft"
                ? Math.max(0, base - 1)
                : Math.min(last, base + 1);
            });
          }}
        >
          {/* Faint plot background: a surface for the series, not decoration */}
          <rect
            x={PAD.left}
            y={PAD.top}
            width={PLOT_W}
            height={PLOT_H}
            fill="var(--background-secondary)"
            fillOpacity={0.55}
            rx={4}
          />

          {/* Gridlines: solid hairlines one step off the surface, never dashed */}
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={PAD.left + PLOT_W}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--surface-elevated)"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 10}
                y={y(t) + 4}
                textAnchor="end"
                className="fill-[var(--foreground-muted)] text-[11px] tabular-nums"
              >
                {t}
              </text>
            </g>
          ))}

          {/* Single-hue area fill, alpha-only fade so the baseline stays light */}
          <defs>
            <linearGradient id={`${gradientId}-fill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={hue} stopOpacity={0.34} />
              <stop offset="100%" stopColor={hue} stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${gradientId}-fill)`} />
          <path
            d={line}
            fill="none"
            stroke={hue}
            strokeWidth={2.25}
            strokeLinejoin="round"
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 5px ${hue})` }}
          />

          {/* x-axis labels, every nth so they never collide */}
          {points.map((p, i) =>
            i % tickEvery === 0 || i === last ? (
              <text
                key={p.label}
                x={x(i)}
                y={VB_H - 10}
                textAnchor={i === last ? "end" : i === 0 ? "start" : "middle"}
                className="fill-[var(--foreground-muted)] text-[11px]"
              >
                {p.label}
              </text>
            ) : null,
          )}

          {/* Crosshair for the active point */}
          {active !== null ? (
            <line
              x1={x(shown)}
              x2={x(shown)}
              y1={PAD.top}
              y2={PAD.top + PLOT_H}
              stroke="var(--silver)"
              strokeOpacity={0.35}
              strokeWidth={1}
            />
          ) : null}

          {/* Highlighted endpoint: halo, then the marker with a surface ring */}
          <circle
            cx={x(last)}
            cy={y(points[last].value)}
            r={11}
            fill={hue}
            fillOpacity={0.18}
          />
          <circle
            cx={x(last)}
            cy={y(points[last].value)}
            r={5.5}
            fill={hue}
            stroke="var(--surface)"
            strokeWidth={2}
            style={{ filter: `drop-shadow(0 0 5px ${hue})` }}
          />
          {active !== null && shown !== last ? (
            <circle
              cx={x(shown)}
              cy={y(points[shown].value)}
              r={4.5}
              fill={hue}
              stroke="var(--surface)"
              strokeWidth={2}
            />
          ) : null}

          {/* The one direct label: the endpoint */}
          <text
            x={x(last) + 12}
            y={y(points[last].value) + 4}
            className="fill-[var(--foreground)] text-[12px]"
          >
            {points[last].value}
            {suffix}
          </text>

          {/* Hover surface: full plot height, so the target is never pinpoint */}
          <rect
            x={PAD.left}
            y={PAD.top}
            width={PLOT_W}
            height={PLOT_H}
            fill="transparent"
            onPointerMove={onMove}
            onPointerLeave={() => setActive(null)}
          />
        </svg>
      </div>
    </ChartFrame>
  );
}
