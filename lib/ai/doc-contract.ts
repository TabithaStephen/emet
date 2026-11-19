import type { ExtractedRule, ExtractedRuleKind } from "@/lib/types";

/**
 * The contract for brand-document extraction.
 *
 * Same discipline as the text and visual audits: Gemini is asked for JSON
 * matching the schema, and nothing it returns is trusted until it has been
 * revalidated here.
 *
 * There is a second reason for the caps in this file, beyond guarding the UI.
 * An extracted rule is replayed into EVERY later audit prompt once a reviewer
 * accepts it, so a hostile or malformed document gets two attempts at the
 * model: once during extraction, and once per audit thereafter. Fields are
 * therefore length-capped and stripped of control characters before they are
 * ever stored.
 */

export const RULE_KINDS: ExtractedRuleKind[] = [
  "voice",
  "tone",
  "terminology",
  "prohibited-claim",
  "approved-fact",
  "messaging",
  "visual",
];

/** Headings shown in the review table, and used in the reviewer's brief. */
export const RULE_KIND_LABEL: Record<ExtractedRuleKind, string> = {
  voice: "Brand voice",
  tone: "Tone",
  terminology: "Terminology",
  "prohibited-claim": "Prohibited claim",
  "approved-fact": "Approved fact",
  messaging: "Messaging",
  visual: "Visual guideline",
};

/**
 * Kinds that have a home in the existing Brand DNA sections. On acceptance
 * these are appended to `terminology`, `prohibitedClaims` and `approvedFacts`
 * respectively, so they appear in the editors already on the page. The rest
 * have no native list and are kept as imported rules in their own section.
 */
export const NATIVE_KINDS: ExtractedRuleKind[] = [
  "terminology",
  "prohibited-claim",
  "approved-fact",
];

export const DOC_JSON_SCHEMA = {
  type: "object",
  properties: {
    documentTitle: {
      type: "string",
      description: "The document's own title, or empty if it states none.",
    },
    pagesRead: {
      type: "integer",
      description: "Number of pages whose content was legible.",
    },
    unreadable: {
      type: "boolean",
      description: "True if no brand rules could be read from the document at all.",
    },
    notes: {
      type: "string",
      description: "One sentence on what the document is and how well it could be read.",
    },
    rules: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: RULE_KINDS },
          summary: {
            type: "string",
            description: "The rule as one clear imperative sentence.",
          },
          sourceQuote: {
            type: "string",
            description: "Verbatim sentence from the document that states this rule.",
          },
          page: { type: "integer", description: "Page the quote appears on, 1-based." },
          avoid: {
            type: "string",
            description: "Terminology only: the discouraged term. Empty otherwise.",
          },
          prefer: {
            type: "string",
            description: "Terminology only: the approved replacement. Empty otherwise.",
          },
        },
        required: ["kind", "summary", "sourceQuote", "page", "avoid", "prefer"],
        additionalProperties: false,
      },
    },
  },
  required: ["documentTitle", "pagesRead", "unreadable", "notes", "rules"],
  additionalProperties: false,
} as const;

/**
 * Caps. MAX_RULES bounds both the review table and the per-audit prompt cost:
 * every accepted rule is sent with every subsequent audit.
 */
export const MAX_RULES = 40;
const MAX_SUMMARY = 400;
const MAX_QUOTE = 600;
const MAX_TERM = 120;
const MAX_NOTES = 500;
const MAX_TITLE = 200;

/**
 * Removes C0/C1 control characters except tab and newline, collapses runs of
 * whitespace, and trims. Control characters in model output are never
 * meaningful here and can be used to disguise injected text.
 */
function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export class InvalidDocResponse extends Error {}

export interface DocExtraction {
  documentTitle: string;
  pagesRead: number | null;
  unreadable: boolean;
  notes: string;
  rules: ExtractedRule[];
}

function ruleId(index: number): string {
  return `r${Date.now().toString(36)}${index}${Math.random().toString(36).slice(2, 5)}`;
}

/**
 * Validates a parsed extraction response.
 *
 * Throws `InvalidDocResponse` when the overall shape is wrong; drops individual
 * rules that are unusable, since one bad row should not discard a good
 * document. A rule with no source quote is dropped on purpose — provenance is
 * the whole point of the review step, and a rule nobody can trace back to a
 * line in the document is not reviewable.
 */
export function parseDocPayload(raw: unknown): DocExtraction {
  if (typeof raw !== "object" || raw === null) {
    throw new InvalidDocResponse("Response was not a JSON object.");
  }
  const obj = raw as Record<string, unknown>;

  if (!Array.isArray(obj.rules)) {
    throw new InvalidDocResponse("Response had no rules array.");
  }

  const rules: ExtractedRule[] = [];
  const seen = new Set<string>();

  for (const [index, entry] of obj.rules.slice(0, MAX_RULES).entries()) {
    if (typeof entry !== "object" || entry === null) continue;
    const row = entry as Record<string, unknown>;

    const kind = clean(row.kind, 40).toLowerCase() as ExtractedRuleKind;
    const summary = clean(row.summary, MAX_SUMMARY);
    const sourceQuote = clean(row.sourceQuote, MAX_QUOTE);

    if (!RULE_KINDS.includes(kind) || !summary || !sourceQuote) continue;

    // One rule per distinct statement; models repeat themselves across pages.
    const fingerprint = `${kind}:${summary.toLowerCase()}`;
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);

    const pageRaw = typeof row.page === "number" ? Math.trunc(row.page) : 0;
    const avoid = clean(row.avoid, MAX_TERM);
    const prefer = clean(row.prefer, MAX_TERM);

    rules.push({
      id: ruleId(index),
      kind,
      summary,
      sourceQuote,
      page: pageRaw > 0 ? pageRaw : null,
      // Only meaningful for terminology, and only when both halves are present.
      avoid: kind === "terminology" && avoid && prefer ? avoid : undefined,
      prefer: kind === "terminology" && avoid && prefer ? prefer : undefined,
    });
  }

  const pagesRaw = typeof obj.pagesRead === "number" ? Math.trunc(obj.pagesRead) : 0;

  return {
    documentTitle: clean(obj.documentTitle, MAX_TITLE),
    pagesRead: pagesRaw > 0 ? pagesRaw : null,
    // Trust the model's own admission, but treat "no rules at all" as
    // unreadable regardless of what it claimed.
    unreadable: obj.unreadable === true || rules.length === 0,
    notes: clean(obj.notes, MAX_NOTES),
    rules,
  };
}
