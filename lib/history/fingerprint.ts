import { buildBrandBrief } from "@/lib/ai/build-prompt";
import type { BrandProfile, Finding } from "@/lib/types";

/**
 * Stable identities for content, brand rules and individual findings.
 *
 * These exist so a comparison between two audits can be trusted:
 *
 *  - `contentHashOf` tells us whether two versions really differ.
 *  - `brandHashOf` tells us whether they were judged against the same rules.
 *    Without it a score change could be credited to a rewrite when in fact
 *    somebody edited the Brand DNA in between, which would be exactly the
 *    invented improvement this project must never report.
 *  - `fingerprintFinding` lets a finding be followed from one version to the
 *    next, which `Finding.id` cannot do — ids are positional (`g1`, `g2`, …)
 *    and are reassigned on every run.
 *
 * Fingerprints are computed when a comparison is drawn, never stored, so
 * audits saved before any of this existed compare correctly too.
 */

/**
 * FNV-1a, run twice with different offsets and concatenated.
 *
 * Not cryptographic and not meant to be: this only ever answers "are these two
 * strings the same?" for equality checks inside one browser. Two 32-bit passes
 * give a 64-bit value, which makes an accidental collision between two drafts
 * vanishingly unlikely while staying dependency-free and fast.
 */
export function hashString(value: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= code + i;
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

/**
 * Identity of a piece of content.
 *
 * Normalises line endings and trims the ends so that a stray trailing newline
 * does not read as a revision, but is otherwise exact: internal spacing is
 * part of the content.
 */
export function contentHashOf(text: string): string {
  return hashString(text.replace(/\r\n/g, "\n").trim());
}

/**
 * Identity of the rules an audit was judged against.
 *
 * Hashes the reviewer's brief rather than the profile object, because the
 * brief is precisely what the model was told — two profiles that render the
 * same brief are the same rules for this purpose, and a field that never
 * reaches the brief cannot change an outcome.
 */
export function brandHashOf(brand: BrandProfile): string {
  return hashString(buildBrandBrief(brand));
}

/** Collapses whitespace and case so trivial respacing does not look like a change. */
function normalise(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Strict identity: the same rule, breached by the same words.
 *
 * Two findings sharing this key are the same problem, still present.
 */
export function fingerprintFinding(finding: Finding): string {
  return [
    finding.severity,
    normalise(finding.guidelineRef),
    normalise(finding.rule),
    normalise(finding.phrase),
  ].join("\u0000");
}

/**
 * Loose identity: the same rule, regardless of the words or severity.
 *
 * Used as a second pass, so that rewording a sentence without fixing the
 * underlying breach is reported as a problem that persists rather than as one
 * resolved and a different one introduced.
 */
export function ruleKeyOf(finding: Finding): string {
  return [normalise(finding.guidelineRef), normalise(finding.rule)].join("\u0000");
}
