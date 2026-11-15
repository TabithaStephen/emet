import type { ReactNode } from "react";
import { Sparkline } from "@/components/charts/sparkline";

import { CHART_TONES, type ChartTone } from "@/components/charts/sparkline";

const DELTA_TEXT = {
  positive: "text-positive",
  critical: "text-critical",
  neutral: "text-foreground-muted",
} as const;

interface StatTileProps {
  label: string;
  value: ReactNode;
  caption?: string;
  /** Hue for this metric's sparkline, glow and top rule. */
  accent?: ChartTone;
  /** Change against a named period. Direction is coloured by whether it is good. */
  delta?: { value: number; period: string; upIsGood?: boolean; suffix?: string };
  /** Twelve-point trend cue drawn beside the figure. */
  series?: number[];
  /** A labelled state dot, for tiles with no series behind them. */
  marker?: { state: "positive" | "critical" | "neutral"; label: string };
}

/**
 * Stat tile: label, figure, and one quiet indicator.
 *
 * Each metric carries its own hue, applied in three restrained places — a top
 * hairline, a soft corner glow behind the figure, and the sparkline. The card
 * body itself stays on the standard surface, so a row of tiles reads as one
 * system rather than a row of coloured boxes.
 */
export function StatTile({
  label,
  value,
  caption,
  accent = "gold",
  delta,
  series,
  marker,
}: StatTileProps) {
  const colour = CHART_TONES[accent];
  const deltaState = delta
    ? delta.value === 0
      ? "neutral"
      : (delta.value > 0) === (delta.upIsGood ?? true)
        ? "positive"
        : "critical"
    : null;

  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-surface px-6 py-6 transition-colors duration-200 hover:border-silver/25">
      {/* Accent hairline along the top edge */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: colour, opacity: 0.55 }}
      />
      {/* Soft single-hue glow behind the figure — no multi-colour gradients */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full"
        style={{
          background: `radial-gradient(circle, ${colour} 0%, transparent 70%)`,
          opacity: 0.13,
        }}
      />

      <div className="relative">
        <p className="text-[0.65rem] font-medium uppercase tracking-[0.16em] text-foreground-muted">
          {label}
        </p>

        <div className="mt-3 flex items-end justify-between gap-3">
          <p className="font-display text-4xl leading-none tracking-tight text-foreground">
            {value}
          </p>
          {series ? (
            <Sparkline points={series} tone={accent} className="mb-1 shrink-0" />
          ) : null}
        </div>

        {delta && deltaState ? (
          <p className="mt-3 flex items-center gap-1.5 text-xs">
            <span aria-hidden className={DELTA_TEXT[deltaState]}>
              {delta.value > 0 ? "▲" : delta.value < 0 ? "▼" : "—"}
            </span>
            <span className={DELTA_TEXT[deltaState]}>
              {delta.value > 0 ? "+" : ""}
              {delta.value}
              {delta.suffix ?? "%"}
            </span>
            <span className="text-foreground-muted">{delta.period}</span>
          </p>
        ) : null}

        {marker ? (
          <p className="mt-3 flex items-center gap-2 text-xs text-foreground-muted">
            <span
              aria-hidden
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{
                background:
                  marker.state === "critical"
                    ? "var(--critical)"
                    : marker.state === "positive"
                      ? "var(--positive)"
                      : "var(--silver)",
              }}
            />
            {marker.label}
          </p>
        ) : null}

        {caption ? (
          <p className="mt-3 text-xs leading-relaxed text-foreground-muted">
            {caption}
          </p>
        ) : null}
      </div>
    </div>
  );
}

interface MeterProps {
  /** 0–100. */
  value: number;
  /** Visual weight of the fill. */
  tone?: "accent" | "silver";
  className?: string;
}

/** A thin, recessive magnitude bar. One hue, rounded data-end, no gradient. */
export function Meter({ value, tone = "accent", className = "" }: MeterProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const fill = tone === "accent" ? "bg-gold/85" : "bg-silver/60";
  return (
    <div
      className={`h-1.5 w-full overflow-hidden rounded-full bg-surface-elevated ${className}`}
      role="img"
      aria-label={`${clamped} out of 100`}
    >
      <div
        className={`h-full rounded-full ${fill} transition-[width] duration-500`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

/** Marks anything on screen as prototype content rather than live data. */
export function DemoTag({ children = "Demo data" }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-background-secondary px-2.5 py-1 text-[0.6rem] font-medium uppercase tracking-[0.14em] text-foreground-muted">
      {children}
    </span>
  );
}
