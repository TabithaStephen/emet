import { checkCaption } from "@/lib/social/check-caption";
import { checkCreative } from "@/lib/social/check-creative";
import { PLATFORMS } from "@/lib/social/platform-rules";
import type { CreativeInspection, PlatformReadiness, SocialPlatform } from "@/lib/types";

/**
 * Assembles a readiness result from the deterministic checks.
 *
 * ## How the score is arrived at
 *
 * It is the share of SCORED checks that passed, and nothing else: no weights,
 * no curve, no severity arithmetic. A scored check is one measured against a
 * requirement the platform actually publishes. Advisories and plain
 * measurements are excluded by construction, so a convention nobody documents
 * can never move the number.
 *
 * The share is used rather than the compliance engine's asymptotic curve
 * because these checks are not findings of differing seriousness — each one
 * either meets a published specification or does not. "Four of five passed"
 * is a claim the arithmetic actually supports.
 *
 * When a platform publishes nothing checkable the score is null, reported as
 * "not applicable". Scoring zero, or scoring a hundred, would both be
 * assertions about a platform that has said nothing.
 */
export function buildReadiness(
  caption: string,
  platform: SocialPlatform,
  creative: CreativeInspection | null,
  now: Date = new Date(),
): PlatformReadiness {
  const rules = PLATFORMS[platform];

  const checks = [
    ...checkCaption(caption, platform),
    ...(creative ? checkCreative(creative, platform) : []),
  ];

  const scored = checks.filter((check) => check.scored);
  const passed = scored.filter((check) => check.state === "pass").length;
  const failed = scored.filter((check) => check.state === "fail").length;
  const advisories = checks.filter((check) => !check.scored).length;

  /*
   * No caption means nothing to assess. Returning a number here — 100 because
   * the few applicable checks vacuously passed, or 0 — would both be claims
   * about content that does not exist.
   */
  const hasCaption = caption.trim().length > 0;

  const score =
    !hasCaption || scored.length === 0
      ? null
      : Math.round((passed / scored.length) * 100);

  const scoreRationale = !hasCaption
    ? "There is no caption to check, so no readiness score is given."
    : scored.length === 0
      ? `${rules.label} publishes no requirements this tool can verify, so there is no readiness score to give. ${advisories} ${advisories === 1 ? "measurement is" : "measurements are"} shown for information.`
      : `${passed} of ${scored.length} documented ${scored.length === 1 ? "requirement" : "requirements"} met. Score = ${passed} ÷ ${scored.length} × 100 = ${score}. ` +
        `Counted: ${scored.map((c) => c.label.toLowerCase()).join(", ")}. ` +
        (advisories > 0
          ? `${advisories} further ${advisories === 1 ? "item is" : "items are"} shown but excluded, because ${advisories === 1 ? "it is" : "they are"} not documented by the platform.`
          : "Nothing was excluded.");

  return {
    platform,
    platformLabel: rules.label,
    checks,
    score,
    scoreRationale,
    passed,
    failed,
    advisories,
    creative,
    checkedAt: now.toISOString(),
  };
}

/** Short verdict for the headline. */
export function readinessVerdict(readiness: PlatformReadiness): string {
  if (readiness.score === null) {
    const empty = readiness.checks.some(
      (check) => check.id === "caption-present" && check.state === "fail",
    );
    if (empty) return "There is no caption to check.";
    return `No published requirements to check for ${readiness.platformLabel}.`;
  }
  if (readiness.failed === 0) {
    return `Meets every documented ${readiness.platformLabel} requirement checked.`;
  }
  return `${readiness.failed} documented ${readiness.failed === 1 ? "requirement is" : "requirements are"} not met.`;
}
