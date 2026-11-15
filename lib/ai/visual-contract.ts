import type { Severity, VisualFinding } from "@/lib/types";

/**
 * Contract for the visual comparison. Same discipline as the text audit: the
 * model is asked for JSON matching the schema, and nothing it returns is
 * trusted until it has been revalidated here.
 */

export const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];

/** Image types Gemini accepts, and that we therefore accept from an upload. */
export const ACCEPTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
];

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export const VISUAL_JSON_SCHEMA = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description: "One or two sentences on how closely the candidate matches.",
    },
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          severity: { type: "string", enum: SEVERITIES },
          element: {
            type: "string",
            description: "Part of the mark affected, e.g. symbol, wordmark, tagline.",
          },
          title: { type: "string", description: "Short name for the deviation." },
          explanation: {
            type: "string",
            description: "What differs between the two images, concretely.",
          },
          guideline: {
            type: "string",
            description: "The brand rule breached, e.g. Colour, Typography, Logo construction.",
          },
          recommendation: {
            type: "string",
            description: "What to change to bring it back into line.",
          },
        },
        required: [
          "severity",
          "element",
          "title",
          "explanation",
          "guideline",
          "recommendation",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "findings"],
  additionalProperties: false,
} as const;

const MAX_FINDINGS = 40;
const MAX_FIELD = 1500;

function clean(value: unknown, max = MAX_FIELD): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export class InvalidVisualResponse extends Error {}

export interface VisualPayload {
  summary: string;
  findings: VisualFinding[];
}

export function parseVisualPayload(raw: unknown): VisualPayload {
  if (typeof raw !== "object" || raw === null) {
    throw new InvalidVisualResponse("Response was not a JSON object.");
  }
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.findings)) {
    throw new InvalidVisualResponse("Response had no findings array.");
  }

  const findings: VisualFinding[] = [];
  for (const entry of obj.findings.slice(0, MAX_FINDINGS)) {
    if (typeof entry !== "object" || entry === null) continue;
    const row = entry as Record<string, unknown>;

    const severity = clean(row.severity, 20)?.toLowerCase();
    const element = clean(row.element, 120);
    const title = clean(row.title, 200);
    const explanation = clean(row.explanation);
    const guideline = clean(row.guideline, 200);
    const recommendation = clean(row.recommendation);

    if (
      !severity ||
      !SEVERITIES.includes(severity as Severity) ||
      !element ||
      !title ||
      !explanation ||
      !guideline ||
      !recommendation
    ) {
      continue;
    }

    findings.push({
      id: `v${findings.length + 1}`,
      severity: severity as Severity,
      element,
      title,
      explanation,
      guideline,
      recommendation,
    });
  }

  return {
    summary: clean(obj.summary) ?? "No summary returned.",
    findings,
  };
}

export const VISUAL_BRIEF = `You are a brand compliance reviewer inspecting artwork.

You are given two images. The FIRST is the organisation's APPROVED reference mark. The SECOND is a CANDIDATE asset found in use. Report every way the candidate departs from the approved reference.

Look at, in order of seriousness:
1. Colour — any hue that differs from the reference. critical, because colour is the most recognisable brand asset.
2. Logo construction — the symbol's shape, proportions, stroke weight, size relative to the wordmark, or its position. high.
3. Typography — weight, width, letter spacing or case of the wordmark or tagline. high.
4. Unauthorised elements — rules, underlines, boxes, shadows, glows or anything present in the candidate but absent from the reference. high.
5. Spacing and layout — clear space, alignment, or the gap between symbol and wordmark. medium.
6. Tagline — wording, presence, or styling. medium, or critical if the words themselves changed.

Rules:
- Compare ONLY what you can see in the two images. Do not speculate about files, formats or intent.
- Describe each difference concretely: name the element, say what the reference shows and what the candidate shows.
- "recommendation" must say what to change to match the reference.
- One finding per distinct deviation.
- If the candidate matches the reference, return an empty findings array and say so in the summary.
- Judge the candidate against the reference image, not against general design taste.`;
