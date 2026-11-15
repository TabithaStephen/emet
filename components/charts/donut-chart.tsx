"use client";

import { useState } from "react";

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  /** CSS colour, normally a design token such as `var(--gold)`. */
  colour: string;
}

interface DonutChartProps {
  slices: DonutSlice[];
  /** Plural noun for the total, e.g. "findings". */
  noun: string;
  size?: number;
}

const SIZE = 208;
const STROKE = 26;
/** Gap in user units, so neighbouring arcs are separated by surface, not a stroke. */
const GAP = 4;

/**
 * Part-to-whole ring with the total in the centre.
 *
 * A donut makes close values harder to compare than bars do, so the legend
 * carries the exact count and percentage for every slice and the frame adds a
 * table view. Hovering or focusing a slice swaps the centre readout to that
 * slice, which is what makes the ring worth having: it answers "how big is
 * this one" without a tooltip chasing the pointer.
 */
export function DonutChart({ slices, noun, size = SIZE }: DonutChartProps) {
  const [active, setActive] = useState<string | null>(null);

  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const present = slices.filter((s) => s.value > 0);
  const radius = (size - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;

  const shown = active ? present.find((s) => s.key === active) : null;
  const share = (value: number) => (total === 0 ? 0 : (value / total) * 100);

  // Arc geometry computed up front rather than accumulated during render, so
  // nothing is mutated mid-render. Each slice starts where the previous ended.
  const arcs = present.map((slice, index) => {
    const before = present
      .slice(0, index)
      .reduce((sum, earlier) => sum + earlier.value, 0);
    const arc = (slice.value / total) * circumference;
    return {
      slice,
      dash: Math.max(arc - GAP, 1),
      offset: -(before / total) * circumference,
    };
  });

  return (
    <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-center sm:gap-10">
      <div
        className="relative shrink-0"
        style={{ width: size, height: size }}
        onPointerLeave={() => setActive(null)}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
        >
          {/* Empty track, so a mostly-empty ring still reads as a ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--surface-elevated)"
            strokeWidth={STROKE}
          />
          {arcs.map(({ slice, dash, offset }) => {
            const dim = active !== null && active !== slice.key;
            return (
              <circle
                key={slice.key}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={slice.colour}
                strokeWidth={STROKE}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={offset}
                tabIndex={0}
                role="img"
                aria-label={`${slice.label}: ${slice.value} ${noun}, ${Math.round(
                  share(slice.value),
                )} percent`}
                onPointerEnter={() => setActive(slice.key)}
                onFocus={() => setActive(slice.key)}
                onBlur={() => setActive(null)}
                className="cursor-pointer transition-opacity duration-200 focus:outline-none"
                style={{ opacity: dim ? 0.3 : 1 }}
              />
            );
          })}
        </svg>

        {/* Centre readout: the total, or the hovered slice */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {shown ? (
            <>
              <span className="text-4xl font-semibold leading-none text-foreground">
                {Math.round(share(shown.value))}%
              </span>
              <span
                className="mt-1.5 text-[0.65rem] font-medium uppercase tracking-[0.14em]"
                style={{ color: shown.colour }}
              >
                {shown.label}
              </span>
              <span className="mt-1 text-xs text-foreground-muted">
                {shown.value} {noun}
              </span>
            </>
          ) : (
            <>
              <span className="text-4xl font-semibold leading-none text-foreground">
                {total}
              </span>
              <span className="mt-1.5 text-xs text-foreground-muted">{noun}</span>
            </>
          )}
        </div>
      </div>

      {/* Legend: name, count and exact percentage for every slice */}
      <ul className="w-full min-w-0 space-y-1">
        {slices.map((slice) => {
          const dim = active !== null && active !== slice.key;
          return (
            <li key={slice.key}>
              <button
                type="button"
                onPointerEnter={() => setActive(slice.key)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(slice.key)}
                onBlur={() => setActive(null)}
                className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors duration-200 hover:bg-surface-elevated/50"
                style={{ opacity: dim ? 0.55 : 1 }}
              >
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ background: slice.colour }}
                />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {slice.label}
                </span>
                <span className="shrink-0 text-sm tabular-nums text-foreground">
                  {slice.value}
                </span>
                <span className="w-12 shrink-0 text-right text-xs tabular-nums text-foreground-muted">
                  {Math.round(share(slice.value))}%
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
