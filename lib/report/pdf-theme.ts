"use client";

/**
 * The Midnight Luxury palette, for the PDF renderer.
 *
 * A PDF cannot reference a CSS custom property, so the values have to become
 * numbers somewhere. Rather than hardcoding a second palette that could drift
 * from `app/globals.css`, this reads the live computed values off the document
 * root — the same tokens every screen uses — and only falls back to literals
 * when there is no document to read (server render, or a locked-down browser).
 *
 * The fallbacks are therefore a safety net, never the source of truth.
 */

export type Rgb = [number, number, number];

/** Token name -> fallback, mirroring :root in app/globals.css. */
const FALLBACK: Record<string, string> = {
  "--background": "#0b1120",
  "--background-secondary": "#101827",
  "--surface": "#151e2e",
  "--surface-elevated": "#1c293b",
  "--accent": "#c8aa72",
  "--silver": "#aab4c3",
  "--foreground": "#f3f0e8",
  "--foreground-muted": "#929eaf",
  "--border": "#1c293b",
  "--critical": "#f07878",
  "--positive": "#43c6a0",
  "--gold": "#e0b967",
  "--activity": "#789bfa",
  "--analysis": "#b18ae8",
  "--turquoise": "#53c2d1",
};

function hexToRgb(hex: string): Rgb {
  const clean = hex.trim().replace(/^#/, "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const n = Number.parseInt(full.slice(0, 6), 16);
  if (!Number.isFinite(n)) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export interface PdfPalette {
  background: Rgb;
  backgroundSecondary: Rgb;
  surface: Rgb;
  surfaceElevated: Rgb;
  accent: Rgb;
  silver: Rgb;
  foreground: Rgb;
  foregroundMuted: Rgb;
  border: Rgb;
  critical: Rgb;
  positive: Rgb;
  gold: Rgb;
  activity: Rgb;
  analysis: Rgb;
}

/** Reads one token from the live stylesheet, falling back to its literal. */
function token(name: string): Rgb {
  let value = FALLBACK[name];
  if (typeof document !== "undefined") {
    try {
      const live = getComputedStyle(document.documentElement)
        .getPropertyValue(name)
        .trim();
      // A custom property can resolve to "" before styles load.
      if (live) value = live;
    } catch {
      // Fall through to the literal.
    }
  }
  return hexToRgb(value);
}

export function readPalette(): PdfPalette {
  return {
    background: token("--background"),
    backgroundSecondary: token("--background-secondary"),
    surface: token("--surface"),
    surfaceElevated: token("--surface-elevated"),
    accent: token("--accent"),
    silver: token("--silver"),
    foreground: token("--foreground"),
    foregroundMuted: token("--foreground-muted"),
    border: token("--border"),
    critical: token("--critical"),
    positive: token("--positive"),
    gold: token("--gold"),
    activity: token("--activity"),
    analysis: token("--analysis"),
  };
}

/**
 * Severity colours, in the fixed roles the design system sets:
 * coral / champagne / sapphire / emerald. Never reassigned per chart.
 */
export function severityColour(
  severity: "critical" | "high" | "medium" | "low",
  palette: PdfPalette,
): Rgb {
  if (severity === "critical") return palette.critical;
  if (severity === "high") return palette.gold;
  if (severity === "medium") return palette.activity;
  return palette.positive;
}
