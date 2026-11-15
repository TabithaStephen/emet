import { locateFindings } from "@/lib/ai/contract";
import type { AiFinding } from "@/lib/ai/contract";
import type { BrandProfile, Finding, Severity } from "@/lib/types";

/**
 * Content for the public guided demo.
 *
 * ALL FICTIONAL. NovaTech is an invented company; every figure, finding and
 * piece of copy below is written for the walkthrough. Nothing here is a real
 * measurement, and nothing here is produced by Gemini — the demo must work with
 * no API key and no network, so the findings are prepared in advance and
 * labelled as such wherever they appear.
 *
 * This module is deliberately isolated from the signed-in application: it never
 * touches the brand store, the audit store, or any localStorage key. The demo
 * holds its state in React only, so a visitor cannot disturb real data.
 */

export const NOVATECH_BRAND: BrandProfile = {
  identity: {
    name: "NovaTech",
    tagline: "Technology that moves you",
    mission:
      "To give engineering teams tooling that is calm, dependable and honest about its limits.",
    industry: "Developer platforms",
    audience:
      "Engineering leads and platform teams at mid-sized software companies.",
  },
  voice: {
    personality: ["Precise", "Plain-spoken", "Confident", "Unhurried"],
    toneDo:
      "Lead with what the product does. Use short sentences. Cite a number only when it is on the approved facts list.",
    toneAvoid:
      "Urgency, exclamation marks, superlatives, and any promise about performance or outcomes.",
    readingLevel: "Clear professional prose, roughly grade 10–12.",
  },
  terminology: [
    {
      id: "t1",
      avoid: "cheap",
      prefer: "accessible",
      note: "Price is positioned on value, never on being the cheapest.",
    },
    {
      id: "t2",
      avoid: "AI-powered",
      prefer: "intelligence-led",
      note: "Vendor-category language. Say what the product actually does.",
    },
    {
      id: "t3",
      avoid: "customers",
      prefer: "teams",
      note: "NovaTech is bought and used by teams, not individuals.",
    },
  ],
  messaging: {
    pillars: [
      "Evidence before enthusiasm",
      "Boring reliability is a feature",
      "Plain pricing, plainly explained",
      "Built with engineers, not at them",
    ],
    boilerplate:
      "NovaTech builds deployment tooling for engineering teams. We publish our uptime, our pricing and our roadmap.",
  },
  prohibitedClaims: [
    {
      id: "p1",
      phrase: "guarantees faster deployments",
      reason:
        "A performance guarantee NovaTech has never committed to contractually.",
    },
    {
      id: "p2",
      phrase: "never pay more",
      reason: "Pricing changes with usage; this implies a cap that does not exist.",
    },
    {
      id: "p3",
      phrase: "zero downtime",
      reason: "Contradicts the published 99.95% uptime figure.",
    },
  ],
  approvedFacts: [
    {
      id: "f1",
      statement: "Founded in 2017 and independently owned.",
      source: "Company fact sheet, rev. 9",
    },
    {
      id: "f2",
      statement: "Used by 4,200 engineering teams across 38 countries.",
      source: "Q3 platform report",
    },
    {
      id: "f3",
      statement: "99.95% platform uptime over the last twelve months.",
      source: "Public status page",
    },
  ],
};

/** The draft a NovaTech marketer might write. Deliberately non-compliant. */
export const DEMO_DRAFT = `Introducing NovaTech Orbit — the best developer tooling money can buy.

Our AI-powered engine guarantees faster deployments for every single customer, and our cheap pricing means teams never pay more than they expect. Thousands have already switched.

ACT NOW to claim your place before enrolment closes!!`;

/**
 * Prepared findings for the walkthrough. In the real product these come back
 * from Gemini; here they are written in advance so the demo needs no API key.
 */
const DEMO_AI_FINDINGS: AiFinding[] = [
  {
    severity: "critical",
    phrase: "guarantees faster deployments",
    title: "Prohibited performance guarantee",
    explanation:
      "The prohibited claims list rules this out: NovaTech has never committed to a deployment-speed guarantee contractually, so stating one creates an obligation the company has not accepted.",
    guideline: "Prohibited claims",
    suggestion: "is built for faster deployments",
  },
  {
    severity: "high",
    phrase: "the best developer tooling money can buy",
    title: "Superlative with no evidence",
    explanation:
      "A comparative claim with nothing on the approved facts list behind it. The messaging pillars ask for evidence before enthusiasm.",
    guideline: "Messaging guidelines",
    suggestion: "deployment tooling built for engineering teams",
  },
  {
    severity: "medium",
    phrase: "AI-powered",
    title: "Off-list terminology",
    explanation:
      "Vendor-category language the terminology list replaces, because it describes the category rather than what the product does.",
    guideline: "Approved terminology",
    suggestion: "intelligence-led",
  },
  {
    severity: "medium",
    phrase: "cheap",
    title: "Off-list terminology",
    explanation:
      "NovaTech positions price on value. The approved substitution keeps the meaning without competing on being cheapest.",
    guideline: "Approved terminology",
    suggestion: "accessible",
  },
  {
    severity: "medium",
    phrase: "ACT NOW",
    title: "Manufactured urgency",
    explanation:
      "The voice guidelines rule out urgency devices. Shouting capitals compound it.",
    guideline: "Voice and tone",
    suggestion: "Talk to us",
  },
  {
    severity: "low",
    phrase: "!!",
    title: "Hype punctuation",
    explanation:
      "Repeated exclamation marks read as promotional rather than plain-spoken.",
    guideline: "Voice and tone",
    suggestion: ".",
  },
];

/**
 * Offsets are located with the same function the real audit uses, so the
 * highlighting in the demo behaves exactly as it does in the product.
 */
export const DEMO_FINDINGS: Finding[] = locateFindings(
  DEMO_DRAFT,
  DEMO_AI_FINDINGS,
);

export const DEMO_SUMMARY =
  "The draft carries a prohibited performance guarantee, an unsupported superlative, three terminology breaches and an urgency device.";

/** The four deviations planted in the modified NovaTech logo. */
export interface VisualDeviation {
  severity: Severity;
  element: string;
  title: string;
  explanation: string;
  guideline: string;
  recommendation: string;
}

export const DEMO_VISUAL_DEVIATIONS: VisualDeviation[] = [
  {
    severity: "critical",
    element: "Symbol colour",
    title: "Teal replaced with orange",
    explanation:
      "The approved mark uses the NovaTech teal. The candidate renders the orbit and star in orange, the most recognisable breach a reader will notice.",
    guideline: "Colour",
    recommendation: "Restore the approved teal across the orbit and star.",
  },
  {
    severity: "high",
    element: "Symbol construction",
    title: "Orbit proportions altered",
    explanation:
      "The approved orbit is an angled ellipse with a fine stroke. The candidate is close to a circle, larger, and noticeably heavier.",
    guideline: "Logo construction",
    recommendation:
      "Return the orbit to the approved ellipse, angle and stroke weight.",
  },
  {
    severity: "high",
    element: "Wordmark",
    title: "Typography too heavy",
    explanation:
      "The wordmark is set in a much bolder weight with wider letter spacing than the approved artwork.",
    guideline: "Typography",
    recommendation: "Reset the wordmark to the approved weight and tracking.",
  },
  {
    severity: "high",
    element: "Unauthorised element",
    title: "Orange rule added beneath the wordmark",
    explanation:
      "A solid orange bar sits under the name. Nothing of the kind exists in the approved mark.",
    guideline: "Unauthorised elements",
    recommendation: "Remove the rule entirely.",
  },
];

/** Sample figures for the Insights step. Illustrative only. */
export const DEMO_INSIGHT_TILES = [
  { label: "Audits run", value: "128", caption: "Across every channel this quarter." },
  { label: "Average score", value: "81", caption: "Up from 64 twelve weeks ago." },
  { label: "Approved first pass", value: "62%", caption: "Cleared without a rework cycle." },
  { label: "Critical share", value: "22%", caption: "Of all findings recorded." },
];

export const DEMO_INSIGHT_TREND = [
  { label: "W1", value: 64 },
  { label: "W2", value: 62 },
  { label: "W3", value: 69 },
  { label: "W4", value: 71 },
  { label: "W5", value: 70 },
  { label: "W6", value: 74 },
  { label: "W7", value: 76 },
  { label: "W8", value: 75 },
  { label: "W9", value: 78 },
  { label: "W10", value: 80 },
  { label: "W11", value: 82 },
  { label: "W12", value: 81 },
];

export const DEMO_INSIGHT_RULES = [
  { label: "Unsupported performance claims", value: 31, colour: "coral" as const },
  { label: "Superlatives without evidence", value: 24, colour: "gold" as const },
  { label: "Off-list terminology", value: 19, colour: "sapphire" as const },
  { label: "Manufactured urgency", value: 12, colour: "amethyst" as const },
  { label: "Hype punctuation", value: 8, colour: "emerald" as const },
];

export const DEMO_INSIGHT_SEVERITY: Record<Severity, number> = {
  critical: 31,
  high: 24,
  medium: 31,
  low: 8,
};

/** The end-to-end journey shown in steps 1 and 8. */
export const DEMO_JOURNEY = [
  { title: "Brand DNA", blurb: "The rules, written once." },
  { title: "Content creation", blurb: "A draft is written as normal." },
  { title: "AI audit", blurb: "Gemini checks it against the rules." },
  { title: "Corrections", blurb: "Suggested rewrites applied in place." },
  { title: "Human approval", blurb: "A person signs it off." },
  { title: "Insights", blurb: "Patterns feed back into the rules." },
];
