import type {
  ApprovalItem,
  AuditRecord,
  BrandProfile,
} from "@/lib/types";

/**
 * DEMO DATA — Phase 1.
 * Every value below is fictional sample content for the prototype.
 * None of it comes from a database or an external service.
 */

export const DEMO_BRAND: BrandProfile = {
  identity: {
    name: "Northwind Capital",
    tagline: "Considered wealth, quietly compounded.",
    mission:
      "To give families and institutions a calm, transparent way to steward long-term capital.",
    industry: "Private wealth management",
    audience:
      "Chief financial officers, family offices, and individuals with complex portfolios.",
  },
  voice: {
    personality: ["Measured", "Precise", "Warm", "Unhurried"],
    toneDo:
      "Write in plain, confident sentences. Lead with evidence. Respect the reader's intelligence and their time.",
    toneAvoid:
      "Hype, urgency, exclamation marks, financial jargon used for its own sake, and any promise about future performance.",
    readingLevel: "Clear professional prose, roughly grade 10–12.",
  },
  terminology: [
    {
      id: "t1",
      avoid: "cheap",
      prefer: "cost-efficient",
      note: "Price positioning is never about being cheap.",
    },
    {
      id: "t2",
      avoid: "clients",
      prefer: "partners",
      note: "We describe the relationship as a partnership.",
    },
    {
      id: "t3",
      avoid: "AI-powered",
      prefer: "intelligence-led",
      note: "Avoid vendor-category language in client-facing copy.",
    },
    {
      id: "t4",
      avoid: "synergy",
      prefer: "shared advantage",
      note: "Corporate filler. Say the actual benefit.",
    },
  ],
  messaging: {
    pillars: [
      "Transparency before persuasion",
      "Evidence over opinion",
      "Stewardship across generations",
      "Calm in volatile markets",
    ],
    boilerplate:
      "Northwind Capital is a private wealth manager working with families and institutions across Europe. We publish our methodology, our fees, and our reasoning.",
  },
  prohibitedClaims: [
    {
      id: "p1",
      phrase: "guaranteed returns",
      reason:
        "Regulated jurisdictions prohibit any guarantee of investment performance.",
    },
    {
      id: "p2",
      phrase: "risk-free",
      reason: "No investment product we offer is risk-free.",
    },
    {
      id: "p3",
      phrase: "beat the market",
      reason:
        "Implies a performance promise the firm has never committed to publicly.",
    },
    {
      id: "p4",
      phrase: "double your money",
      reason: "Unsubstantiated performance claim.",
    },
  ],
  approvedFacts: [
    {
      id: "f1",
      statement: "Founded in 1998 and independently owned since inception.",
      source: "Corporate fact sheet, rev. 14",
    },
    {
      id: "f2",
      statement: "Advises on £4.2bn of assets across 31 countries.",
      source: "Q3 regulatory filing",
    },
    {
      id: "f3",
      statement: "Average partner relationship spans 11 years.",
      source: "Internal retention study, March",
    },
    {
      id: "f4",
      statement: "Fee schedule published in full on the public website.",
      source: "Transparency policy §2",
    },
  ],
  importedRules: [],
  documents: [],
};

export const DEMO_AUDITS: AuditRecord[] = [
  {
    id: "a-1041",
    title: "Q4 partner letter — opening section",
    channel: "Email",
    owner: "R. Castellan",
    submittedAt: "2 hours ago",
    status: "changes-requested",
    score: 62,
    findingCount: 5,
    topSeverity: "critical",
  },
  {
    id: "a-1040",
    title: "Private markets landing page",
    channel: "Web",
    owner: "M. Okafor",
    submittedAt: "5 hours ago",
    status: "in-review",
    score: 78,
    findingCount: 3,
    topSeverity: "high",
  },
  {
    id: "a-1039",
    title: "Stewardship report foreword",
    channel: "Print",
    owner: "A. Lindqvist",
    submittedAt: "Yesterday",
    status: "approved",
    score: 96,
    findingCount: 1,
    topSeverity: "low",
  },
  {
    id: "a-1038",
    title: "Recruitment campaign — social copy",
    channel: "Social",
    owner: "J. Mbeki",
    submittedAt: "Yesterday",
    status: "changes-requested",
    score: 54,
    findingCount: 7,
    topSeverity: "critical",
  },
  {
    id: "a-1037",
    title: "Volatility briefing note",
    channel: "Email",
    owner: "R. Castellan",
    submittedAt: "2 days ago",
    status: "approved",
    score: 91,
    findingCount: 2,
    topSeverity: "medium",
  },
];

export const DEMO_APPROVALS: ApprovalItem[] = [
  {
    id: "r-318",
    title: "Q4 partner letter — opening section",
    channel: "Email",
    owner: "R. Castellan",
    submittedAt: "2 hours ago",
    excerpt:
      "This year our clients saw guaranteed returns in a risk-free structure that is simply the best in the market.",
    score: 62,
    counts: { critical: 2, high: 1, medium: 1, low: 1 },
    decision: "pending",
  },
  {
    id: "r-317",
    title: "Private markets landing page",
    channel: "Web",
    owner: "M. Okafor",
    submittedAt: "5 hours ago",
    excerpt:
      "Our AI-powered platform helps clients find cheap entry points into private markets.",
    score: 78,
    counts: { critical: 0, high: 1, medium: 2, low: 0 },
    decision: "pending",
  },
  {
    id: "r-316",
    title: "Recruitment campaign — social copy",
    channel: "Social",
    owner: "J. Mbeki",
    submittedAt: "Yesterday",
    excerpt:
      "JOIN THE TEAM that will beat the market every single year. Guaranteed!!",
    score: 54,
    counts: { critical: 2, high: 2, medium: 1, low: 2 },
    decision: "pending",
  },
];

/** Sample content offered in the Audit Studio, so the reviewer has something to run. */
export const DEMO_SUBMISSION = `Dear clients,

This has been an exceptional year. Our AI-powered strategy delivered guaranteed returns through a risk-free allocation that we believe is simply the best approach available anywhere.

Our PERFORMANCE speaks for itself, and we are confident we will beat the market again next year. Our cheap fee structure and remarkable synergy across teams means you can expect to double your money over the coming cycle.

Thank you for your trust. ACT NOW to increase your allocation before the window closes!!`;

/**
 * Recurring-issue counts for the Insights screen. Demo figures.
 * `previous` is the same count in the prior twelve-week block, so the direction
 * of travel can be computed rather than asserted.
 */
export const DEMO_ISSUE_TRENDS = [
  {
    label: "Unsupported performance claims",
    count: 34,
    previous: 41,
    severity: "critical" as const,
  },
  {
    label: "Superlatives without evidence",
    count: 27,
    previous: 25,
    severity: "high" as const,
  },
  {
    label: "Off-list terminology",
    count: 22,
    previous: 34,
    severity: "medium" as const,
  },
  {
    label: "Urgency and hype punctuation",
    count: 15,
    previous: 14,
    severity: "low" as const,
  },
  {
    label: "Vendor-category language",
    count: 9,
    previous: 16,
    severity: "medium" as const,
  },
];

export const DEMO_CHANNEL_HEALTH = [
  { channel: "Email", audits: 41, averageScore: 84 },
  { channel: "Web", audits: 36, averageScore: 79 },
  { channel: "Social", audits: 28, averageScore: 61 },
  { channel: "Print", audits: 12, averageScore: 93 },
];
