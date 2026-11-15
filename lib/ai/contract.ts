import type { Finding, Severity } from "@/lib/types";

/**
 * The contract between the Gemini call and the UI.
 *
 * The model is asked for JSON matching AUDIT_JSON_SCHEMA. Nothing it returns is
 * trusted: `parseAuditPayload` re-checks every field, and anything malformed is
 * rejected rather than rendered. A model response is untrusted input, exactly
 * like a form post.
 */

export const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];

export interface AiFinding {
  severity: Severity;
  /** Must be an exact substring of the submitted draft. */
  phrase: string;
  title: string;
  explanation: string;
  guideline: string;
  /** A drop-in replacement for `phrase`, not advice about it. */
  suggestion: string;
}

export interface AiAuditPayload {
  findings: AiFinding[];
  summary: string;
}

/**
 * JSON Schema passed to Gemini as `responseJsonSchema`.
 *
 * Descriptions are deliberately terse: they are billed as input on every call,
 * and the detailed instructions already live in the system brief. Structure and
 * constraints are unchanged.
 */
export const AUDIT_JSON_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string", description: "One or two sentences on overall compliance." },
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          severity: { type: "string", enum: SEVERITIES },
          phrase: { type: "string", description: "Verbatim text from the draft." },
          title: { type: "string", description: "Short issue name." },
          explanation: { type: "string", description: "Why it breaches the rules." },
          guideline: { type: "string", description: "Guideline heading breached." },
          suggestion: { type: "string", description: "Compliant replacement text." },
        },
        required: [
          "severity",
          "phrase",
          "title",
          "explanation",
          "guideline",
          "suggestion",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "findings"],
  additionalProperties: false,
} as const;

/** Caps, so a runaway response cannot flood the UI. */
const MAX_FINDINGS = 60;
const MAX_FIELD = 2000;

function cleanString(value: unknown, max = MAX_FIELD): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

export class InvalidModelResponse extends Error {}

/**
 * Validates a parsed model response. Throws `InvalidModelResponse` when the
 * shape is wrong; silently drops individual findings that are unusable, since
 * one bad row should not discard an otherwise good audit.
 */
export function parseAuditPayload(raw: unknown): AiAuditPayload {
  if (typeof raw !== "object" || raw === null) {
    throw new InvalidModelResponse("Response was not a JSON object.");
  }
  const obj = raw as Record<string, unknown>;

  if (!Array.isArray(obj.findings)) {
    throw new InvalidModelResponse("Response had no findings array.");
  }

  const summary = cleanString(obj.summary) ?? "No summary returned.";

  const findings: AiFinding[] = [];
  for (const entry of obj.findings.slice(0, MAX_FINDINGS)) {
    if (typeof entry !== "object" || entry === null) continue;
    const row = entry as Record<string, unknown>;

    const severity = cleanString(row.severity, 20)?.toLowerCase();
    const phrase = cleanString(row.phrase);
    const title = cleanString(row.title, 200);
    const explanation = cleanString(row.explanation);
    const guideline = cleanString(row.guideline, 200);
    const suggestion = cleanString(row.suggestion);

    if (
      !severity ||
      !SEVERITIES.includes(severity as Severity) ||
      !phrase ||
      !title ||
      !explanation ||
      !guideline ||
      !suggestion
    ) {
      continue;
    }

    findings.push({
      severity: severity as Severity,
      phrase,
      title,
      explanation,
      guideline,
      suggestion,
    });
  }

  return { summary, findings };
}

/**
 * Finds each phrase in the draft so the UI can highlight it in place.
 *
 * The model is asked to quote verbatim but does not always manage it, so a
 * phrase that cannot be located keeps `start`/`end` of -1: its card still
 * renders, it just is not highlighted. Occurrences already claimed by another
 * finding are skipped, so two findings never point at the same words.
 */
export function locateFindings(text: string, aiFindings: AiFinding[]): Finding[] {
  const haystack = text.toLowerCase();
  const taken: Array<[number, number]> = [];

  return aiFindings.map((finding, index) => {
    const needle = finding.phrase.toLowerCase();
    let start = -1;
    let from = 0;

    while (needle.length > 0) {
      const at = haystack.indexOf(needle, from);
      if (at === -1) break;
      const end = at + needle.length;
      const clashes = taken.some(([s, e]) => at < e && s < end);
      if (!clashes) {
        start = at;
        taken.push([at, end]);
        break;
      }
      from = at + 1;
    }

    const end = start === -1 ? -1 : start + finding.phrase.length;

    return {
      id: `g${index + 1}`,
      severity: finding.severity,
      // Use the draft's own casing when located, so the highlight matches.
      phrase: start === -1 ? finding.phrase : text.slice(start, end),
      start,
      end,
      rule: finding.title,
      explanation: finding.explanation,
      guidelineRef: finding.guideline,
      suggestion: finding.suggestion,
      replacement: start === -1 ? undefined : finding.suggestion,
    };
  });
}
