/** Shared domain types for êmet. */

export type Severity = "critical" | "high" | "medium" | "low";

export const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];

export interface TerminologyRule {
  id: string;
  avoid: string;
  prefer: string;
  note: string;
}

export interface ProhibitedClaim {
  id: string;
  phrase: string;
  reason: string;
}

export interface ApprovedFact {
  id: string;
  statement: string;
  source: string;
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

export interface BrandProfile {
  identity: BrandIdentity;
  voice: BrandVoice;
  terminology: TerminologyRule[];
  messaging: BrandMessaging;
  prohibitedClaims: ProhibitedClaim[];
  approvedFacts: ApprovedFact[];
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

/** An audit persisted to this browser, with its review state. */
export interface SavedAudit {
  id: string;
  title: string;
  channel: string;
  text: string;
  outcome: AuditOutcome;
  createdAt: string;
  status: ReviewStatus;
  reviewedAt: string | null;
  reviewNote: string | null;
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
