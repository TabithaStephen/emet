import { formatBytes } from "@/lib/social/format-bytes";
import { PLATFORMS } from "@/lib/social/platform-rules";
import type { CreativeInspection, PlatformCheck, SocialPlatform } from "@/lib/types";

/**
 * Deterministic checks on an uploaded creative.
 *
 * The image is inspected in the browser and never leaves it: its dimensions,
 * type and size are measured, those few numbers are kept, and the file itself
 * is discarded. Nothing is uploaded, nothing is sent to Gemini and nothing is
 * persisted, so a creative cannot end up in storage or in a model prompt.
 *
 * Brand questions about artwork — does this match the approved mark — belong
 * to Visual Compliance, which already answers them. This only measures the
 * creative against the platform's published specification.
 */

/** Image types a browser can reliably measure. */
export const READABLE_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

/**
 * Named ratios, as exact integer pairs.
 *
 * Integers rather than decimals so a match can be tested by cross-multiplying,
 * which is exact. 1.91:1 is 191:100 and 4:5 is 4:5 — no rounding is involved
 * at any point, so a ratio is only ever given a name when it genuinely IS
 * that ratio.
 */
const NAMED_RATIOS: Array<[number, number, string]> = [
  [1, 1, "1:1"],
  [4, 5, "4:5"],
  [191, 100, "1.91:1"],
  [16, 9, "16:9"],
  [9, 16, "9:16"],
  [4, 3, "4:3"],
  [3, 4, "3:4"],
];

/**
 * The name of this ratio, or null when it is not exactly a named one.
 *
 * Exact by construction: `width × namedHeight === height × namedWidth` is
 * integer arithmetic on the pixel dimensions. Nothing is snapped, so an image
 * that is merely CLOSE to 4:5 is never called 4:5.
 */
export function exactNamedRatio(width: number, height: number): string | null {
  for (const [w, h, label] of NAMED_RATIOS) {
    if (width * h === height * w) return label;
  }
  return null;
}

/**
 * Formats a ratio with enough precision that the number shown always agrees
 * with the verdict given.
 *
 * Three decimals is normally plenty, but a ratio can sit so close to a limit
 * that rounding carries it across — 0.7999 displayed as "0.800" would read as
 * compliant beside a FAIL. Precision therefore increases until the displayed
 * value falls on the same side of the range as the true one, so the figure can
 * never contradict the result.
 */
export function formatRatio(
  ratio: number,
  range?: { minAspect: number; maxAspect: number },
): string {
  const within = (value: number) =>
    range ? value >= range.minAspect && value <= range.maxAspect : true;
  const truth = within(ratio);

  for (let decimals = 3; decimals <= 6; decimals += 1) {
    const shown = ratio.toFixed(decimals);
    if (within(Number(shown)) === truth) return shown;
  }
  return ratio.toFixed(6);
}

/**
 * Describes a creative's aspect ratio.
 *
 * The measured value always leads. A named ratio is appended only when the
 * dimensions are exactly that ratio, as a reference — it never stands in for
 * the measurement.
 *
 * This replaces an earlier version that snapped any ratio within 0.01 to the
 * nearest name, which produced the contradiction "4:5 → FAIL" for a 795×1000
 * image: 0.795 is not 4:5, and Instagram's documented range starts at 4:5.
 */
export function describeAspect(
  width: number,
  height: number,
  range?: { minAspect: number; maxAspect: number },
): string {
  const measured = `${formatRatio(width / height, range)}:1`;
  const name = exactNamedRatio(width, height);
  return name ? `${measured} (${name})` : measured;
}

export function checkCreative(
  creative: CreativeInspection,
  platform: SocialPlatform,
): PlatformCheck[] {
  const rules = PLATFORMS[platform];
  const spec = rules.documented.image;
  const checks: PlatformCheck[] = [];
  const aspectLabel = describeAspect(
    creative.width,
    creative.height,
    spec ? { minAspect: spec.minAspect, maxAspect: spec.maxAspect } : undefined,
  );

  /*
   * Without a published specification there is nothing to check against, so
   * the creative's details are reported as measurements. Inventing a
   * requirement here would be exactly the fabrication this feature avoids.
   */
  if (!spec) {
    checks.push({
      id: "creative-info",
      label: "Creative",
      state: "info",
      measured: `${creative.width}×${creative.height} (${aspectLabel}), ${creative.mimeType.replace("image/", "").toUpperCase()}, ${formatBytes(creative.bytes)}`,
      expected: null,
      confidence: "none",
      explanation: `${rules.label} publishes no image specification for posts, so these are measurements rather than checks.`,
      suggestion: null,
      source: null,
      scored: false,
    });
    return checks;
  }

  /* Format. */
  const formatOk = spec.formats.includes(creative.mimeType);
  checks.push({
    id: "creative-format",
    label: "File format",
    state: formatOk ? "pass" : "fail",
    measured: creative.mimeType.replace("image/", "").toUpperCase(),
    expected: spec.formatLabel,
    confidence: "documented",
    explanation: formatOk
      ? `${spec.formatLabel} is the documented format.`
      : `The API reference lists ${spec.formatLabel} as the only supported format for a feed image.`,
    suggestion: formatOk ? null : `Export the creative as ${spec.formatLabel}.`,
    source: spec.source,
    scored: true,
  });

  /* File size. */
  const sizeOk = creative.bytes <= spec.maxBytes;
  checks.push({
    id: "creative-size",
    label: "File size",
    state: sizeOk ? "pass" : "fail",
    measured: formatBytes(creative.bytes),
    expected: `${formatBytes(spec.maxBytes)} maximum`,
    confidence: "documented",
    explanation: sizeOk
      ? `Within the documented ${formatBytes(spec.maxBytes)} maximum.`
      : `Over the documented maximum of ${formatBytes(spec.maxBytes)}.`,
    suggestion: sizeOk ? null : "Re-export at a lower quality setting or smaller dimensions.",
    source: spec.source,
    scored: true,
  });

  /* Aspect ratio. */
  const ratio = creative.width / creative.height;
  const aspectOk = ratio >= spec.minAspect && ratio <= spec.maxAspect;
  checks.push({
    id: "creative-aspect",
    label: "Aspect ratio",
    state: aspectOk ? "pass" : "fail",
    // aspectLabel already carries the measured value at a precision that
    // cannot disagree with `aspectOk`.
    measured: aspectLabel,
    expected: spec.aspectLabel,
    confidence: "documented",
    explanation: aspectOk
      ? `Inside the documented range, ${spec.aspectLabel}.`
      : ratio < spec.minAspect
        ? `Taller than the documented range allows, so the image would be cropped or rejected. The range is ${spec.aspectLabel}.`
        : `Wider than the documented range allows, so the image would be cropped or rejected. The range is ${spec.aspectLabel}.`,
    suggestion: aspectOk ? null : `Crop or export the creative ${spec.aspectLabel}.`,
    source: spec.source,
    scored: true,
  });

  /* Width. */
  const widthOk = creative.width >= spec.minWidth && creative.width <= spec.maxWidth;
  checks.push({
    id: "creative-width",
    label: "Width",
    state: widthOk ? "pass" : "fail",
    measured: `${creative.width}px`,
    expected: `${spec.minWidth}–${spec.maxWidth}px`,
    confidence: "documented",
    explanation: widthOk
      ? `Within the documented range of ${spec.minWidth} to ${spec.maxWidth} pixels.`
      : creative.width < spec.minWidth
        ? `Narrower than the documented minimum of ${spec.minWidth}px.`
        : `Wider than the documented maximum of ${spec.maxWidth}px; the image would be resized.`,
    suggestion: widthOk
      ? null
      : `Export between ${spec.minWidth} and ${spec.maxWidth} pixels wide.`,
    source: spec.source,
    scored: true,
  });

  return checks;
}
