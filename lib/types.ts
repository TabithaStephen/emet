/** Shared domain types for êmet. */

export type Severity = "critical" | "high" | "medium" | "low";

export const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];

/**
 * Written labels for each severity.
 *
 * Domain data, so it lives here rather than in a component: severity never
 * travels on colour alone, and the PDF report needs these labels without
 * pulling a React module in. `components/ui/severity` re-exports it, so every
 * existing import carries on working unchanged.
 */
export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export interface TerminologyRule {
  id: string;
  avoid: string;
  prefer: string;
  note: string;
  /** Set when the rule came from an imported document, for provenance. */
  sourceDoc?: string;
}

export interface ProhibitedClaim {
  id: string;
  phrase: string;
  reason: string;
  /** Set when the claim came from an imported document, for provenance. */
  sourceDoc?: string;
}

export interface ApprovedFact {
  id: string;
  statement: string;
  source: string;
  /** Set when the fact came from an imported document, for provenance. */
  sourceDoc?: string;
}

export interface BrandIdentity {
  name: string;
  tagline: string;
  mission: string;
  industry: string;
  audience: string;
}

export interface BrandVoice {
  personality: string[];
  toneDo: string;
  toneAvoid: string;
  readingLevel: string;
}

export interface BrandMessaging {
  pillars: string[];
  boilerplate: string;
}

/* ---- imported brand documents ----------------------------------------- */

/** Which part of the Brand DNA an extracted rule belongs to. */
export type ExtractedRuleKind =
  | "voice"
  | "tone"
  | "terminology"
  | "prohibited-claim"
  | "approved-fact"
  | "messaging"
  | "visual";

/**
 * One rule Gemini read out of an uploaded brand document.
 *
 * `sourceQuote` is the verbatim line it came from. It is never editable: the
 * reviewer may rewrite the rule, but the evidence it rests on stays as the
 * document wrote it, so a rule can always be traced back.
 */
export interface ExtractedRule {
  id: string;
  kind: ExtractedRuleKind;
  summary: string;
  sourceQuote: string;
  page: number | null;
  /** Terminology only: the discouraged term and its approved replacement. */
  avoid?: string;
  prefer?: string;
  /** Name of the document it came from. Set once the rule is accepted. */
  sourceDoc?: string;
}

/** A document that has been imported, kept for provenance. The file itself is never stored. */
export interface BrandDocument {
  id: string;
  name: string;
  bytes: number;
  pages: number | null;
  importedAt: string;
  /** How many rules from this document were accepted into the Brand DNA. */
  acceptedRules: number;
}

export interface BrandProfile {
  identity: BrandIdentity;
  voice: BrandVoice;
  terminology: TerminologyRule[];
  messaging: BrandMessaging;
  prohibitedClaims: ProhibitedClaim[];
  approvedFacts: ApprovedFact[];
  /**
   * Accepted rules with no native home above — voice, tone, messaging and
   * visual guidance read out of uploaded documents.
   *
   * Top-level on purpose: `brand-store` merges a stored profile over
   * `DEMO_BRAND` shallowly, so a new top-level key picks up its default for
   * anyone whose saved profile predates it, while a new nested key would not.
   */
  importedRules: ExtractedRule[];
  /** Documents imported into this profile, newest first. */
  documents: BrandDocument[];
}

/** One issue found in a piece of content. */
export interface Finding {
  id: string;
  severity: Severity;
  /** The exact substring that triggered the finding. */
  phrase: string;
  /** Character offsets into the submitted text, for highlighting. */
  start: number;
  end: number;
  rule: string;
  explanation: string;
  guidelineRef: string;
  suggestion: string;
  /** A literal substitution the UI can apply, when one exists. */
  replacement?: string;
}

export interface AuditResult {
  findings: Finding[];
  score: number;
  wordCount: number;
  counts: Record<Severity, number>;
}

export type AuditStatus = "approved" | "changes-requested" | "in-review";

export interface AuditRecord {
  id: string;
  title: string;
  channel: string;
  owner: string;
  submittedAt: string;
  status: AuditStatus;
  score: number;
  findingCount: number;
  topSeverity: Severity | null;
}

export type ApprovalDecision = "pending" | "approved" | "rejected";

export interface ApprovalItem {
  id: string;
  title: string;
  channel: string;
  owner: string;
  submittedAt: string;
  excerpt: string;
  score: number;
  counts: Record<Severity, number>;
  decision: ApprovalDecision;
}

/** Which reviewer produced an audit. */
export type AuditEngine = "gemini" | "local";

/**
 * A completed audit, from either the Gemini reviewer or the local rule check.
 * Superset of `AuditResult`, which is what the local engine alone returns.
 */
export interface AuditOutcome {
  findings: Finding[];
  counts: Record<Severity, number>;
  score: number;
  scoreRationale: string;
  wordCount: number;
  engine: AuditEngine;
  model: string | null;
  summary: string | null;
  /** Findings whose phrase could not be located in the draft, so are not highlighted. */
  unlocated: number;
  /** Measured latency split, when the audit came from the API. */
  timings?: { geminiMs: number; ourMs: number; totalMs: number };
  /** Token accounting, so thinking spend is visible rather than inferred. */
  usage?: {
    inputTokens: number | null;
    outputTokens: number | null;
    thoughtTokens: number | null;
    thinkingLevel: string;
  };
}

export type ReviewStatus =
  | "draft"
  | "in-review"
  | "approved"
  | "changes-requested";

/**
 * An audit persisted to this browser, with its review state.
 *
 * Every field below `reviewNote` was added for audit history and version
 * comparison, and every one of them is optional on purpose: records saved
 * before that feature existed have none of them, and must keep loading and
 * rendering exactly as they did. Code that reads them treats absence as
 * "unknown", never as a mismatch.
 */
export interface SavedAudit {
  id: string;
  title: string;
  channel: string;
  /**
   * The content exactly as it was audited.
   *
   * Immutable once saved. The findings were computed against this text, so
   * changing it would leave a record whose findings point at words that are no
   * longer there. Editing a draft and re-auditing produces a new record
   * instead.
   */
  text: string;
  outcome: AuditOutcome;
  createdAt: string;
  status: ReviewStatus;
  reviewedAt: string | null;
  reviewNote: string | null;

  /* ---- history and version comparison -------------------------------- */

  /**
   * Groups the versions of one piece of content. Chosen explicitly by the
   * author when the audit is run — never inferred from the title, which is
   * freely editable and would silently mis-pair unrelated drafts.
   */
  lineageId?: string;
  /** Position within the lineage, counting from 1. */
  version?: number;
  /** Identity of `text`, so an unchanged revision can be told from a real one. */
  contentHash?: string;
  /**
   * Identity of the Brand DNA this audit was judged against.
   *
   * Without it, a score that moved because somebody edited the brand rules
   * would be indistinguishable from one that moved because the writing
   * improved. Comparisons use it to refuse to claim credit they cannot prove.
   */
  brandHash?: string;
  /** Who ran the audit, when a session was present. */
  owner?: { email: string; name: string };
}

/* ---- visual brand compliance ------------------------------------------ */

/** One deviation found by comparing a candidate asset against the approved one. */
export interface VisualFinding {
  id: string;
  severity: Severity;
  /** Which part of the mark: symbol, wordmark, tagline, colour, layout… */
  element: string;
  title: string;
  explanation: string;
  guideline: string;
  recommendation: string;
}

export interface VisualAuditOutcome {
  findings: VisualFinding[];
  counts: Record<Severity, number>;
  score: number;
  scoreRationale: string;
  summary: string;
  model: string;
  timings: { geminiMs: number; ourMs: number; totalMs: number };
  usage?: {
    inputTokens: number | null;
    outputTokens: number | null;
    thoughtTokens: number | null;
    thinkingLevel: string;
  };
}

/** An image held in the browser, ready to post to the audit endpoint. */
export interface ImagePayload {
  /** Base64 WITHOUT the data: prefix. */
  data: string;
  mimeType: string;
  name: string;
  /** Object URL or public path, for preview. */
  previewUrl: string;
}
