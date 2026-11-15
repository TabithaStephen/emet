import type { Severity } from "@/lib/types";

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

/**
 * Severity colours: coral, champagne, sapphire, emerald.
 *
 * Measured against the panel surface, this set PASSES the normal-vision
 * separation check — worst pair 16.7, against a floor of 15. The previous
 * muted set managed only 11.0.
 *
 * One caveat remains: coral and emerald sit at ΔE 5.7 under deuteranopia, the
 * classic red/green confusion. Severity is therefore still always paired with
 * its written label, and the donut carries a legend with counts and percentages
 * so identity never rests on hue.
 */
export const SEVERITY_DOT: Record<Severity, string> = {
  critical: "bg-critical",
  high: "bg-gold",
  medium: "bg-activity",
  low: "bg-positive",
};

export const SEVERITY_TEXT: Record<Severity, string> = {
  critical: "text-critical",
  high: "text-gold",
  medium: "text-activity",
  low: "text-positive",
};

export const SEVERITY_EDGE: Record<Severity, string> = {
  critical: "border-l-critical",
  high: "border-l-gold",
  medium: "border-l-activity",
  low: "border-l-positive",
};

export const SEVERITY_MARK: Record<Severity, string> = {
  critical: "bg-critical/25 decoration-critical",
  high: "bg-gold/25 decoration-gold",
  medium: "bg-activity/25 decoration-activity",
  low: "bg-positive/25 decoration-positive",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-[0.7rem] font-medium uppercase tracking-[0.12em]">
      <span className={`h-1.5 w-1.5 rounded-full ${SEVERITY_DOT[severity]}`} />
      <span className={SEVERITY_TEXT[severity]}>{SEVERITY_LABEL[severity]}</span>
    </span>
  );
}

/** CSS variable per severity, for SVG fills and inline styles. */
export const SEVERITY_VAR: Record<Severity, string> = {
  critical: "var(--critical)", /* coral */
  high: "var(--gold)", /* champagne */
  medium: "var(--activity)", /* sapphire */
  low: "var(--positive)", /* emerald */
};
