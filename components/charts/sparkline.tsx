/** The data-visualisation hues, by role. Fixed order — never cycled. */
export const CHART_TONES = {
  gold: "var(--gold)",
  emerald: "var(--positive)",
  coral: "var(--critical)",
  sapphire: "var(--activity)",
  amethyst: "var(--analysis)",
  turquoise: "var(--turquoise)",
  silver: "var(--silver)",
} as const;

export type ChartTone = keyof typeof CHART_TONES;

interface SparklineProps {
  points: number[];
  tone?: ChartTone;
  className?: string;
}

/**
 * A twelve-point trend cue for a stat tile, drawn at full strength with a soft
 * glow so the hue actually reads at 96px wide. Hidden from assistive
 * technology: the same series appears in full, with a table view, in the chart
 * further down the page.
 */
export function Sparkline({ points, tone = "gold", className = "" }: SparklineProps) {
  if (points.length < 2) return null;

  const W = 104;
  const H = 28;
  const colour = CHART_TONES[tone];

  const lo = Math.min(...points);
  const hi = Math.max(...points);
  const span = hi - lo || 1;

  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => H - 3 - ((v - lo) / span) * (H - 6);

  const line = points.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;
  const last = points.length - 1;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      aria-hidden="true"
      className={`overflow-visible ${className}`}
    >
      <path d={area} fill={colour} fillOpacity={0.14} />
      <path
        d={line}
        fill="none"
        stroke={colour}
        strokeWidth={1.75}
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 3px ${colour})` }}
      />
      <circle
        cx={x(last)}
        cy={y(points[last])}
        r={2.75}
        fill={colour}
        stroke="var(--surface)"
        strokeWidth={1.5}
      />
    </svg>
  );
}
