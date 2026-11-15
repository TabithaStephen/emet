"use client";

interface ScoreDialProps {
  /** 0–100. */
  score: number;
  /** Shown beneath the figure. */
  verdict: string;
  size?: number;
}

/**
 * The ring is always champagne gold — it is the brand's primary data accent and
 * the score is the headline figure. The written verdict carries the state, in
 * its own status colour, so meaning never rests on the ring's hue.
 */
const RING = "var(--gold)";

function band(score: number) {
  if (score >= 90)
    return { token: "var(--positive)", label: "Strong compliance" };
  if (score >= 70) return { token: "var(--gold)", label: "Needs improvement" };
  return { token: "var(--critical)", label: "High risk" };
}

/**
 * Radial progress around a hero figure. The number is the message; the ring is a
 * secondary magnitude cue, which is why this is not drawn as a two-slice pie.
 */
export function ScoreDial({ score, verdict, size = 184 }: ScoreDialProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const { token, label } = band(clamped);

  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (clamped / 100) * circumference;

  return (
    <div
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`Compliance score ${clamped} out of 100. ${label}.`}
        className="-rotate-90"
      >
        {/* Track: a lighter step of the same colour, so state reads across the ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={RING}
          strokeOpacity={0.18}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={RING}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference - filled}`}
          className="transition-[stroke-dasharray] duration-700"
          style={{ filter: `drop-shadow(0 0 6px ${RING})` }}
        />
      </svg>

      {/* Hero figure: same sans as the rest of the product, proportional digits */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-5xl font-semibold leading-none tracking-tight text-foreground">
          {clamped}
        </span>
        <span className="mt-1 text-xs text-foreground-muted">out of 100</span>
        <span
          className="mt-2.5 text-[0.6rem] font-medium uppercase tracking-[0.14em]"
          style={{ color: token }}
        >
          {label}
        </span>
      </div>

      <span className="sr-only">{verdict}</span>
    </div>
  );
}
