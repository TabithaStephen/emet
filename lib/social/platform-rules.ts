import type { RuleSource, SocialPlatform } from "@/lib/types";

/**
 * Platform requirements, each tied to the source it came from.
 *
 * ## The rule this file exists to enforce
 *
 * A number here may only affect a readiness score if it appears in the
 * platform's own primary documentation, with the URL and the date it was
 * read. Everything else is an advisory: shown, measured, clearly marked as
 * unofficial, and unable to change the score.
 *
 * That distinction is not pedantry. When this feature was researched, the
 * three platforms turned out to be wildly unequal:
 *
 *  - Instagram publishes exact figures in its Content Publishing API
 *    reference.
 *  - LinkedIn's Posts API returns a FIELD_LENGTH_TOO_LONG error but states no
 *    threshold anywhere.
 *  - Meta's Page Feed reference describes the `message` field with no maximum
 *    at all.
 *
 * The familiar "LinkedIn 3,000" and "Facebook 63,206" figures are not in
 * either company's documentation. They may well be right, and they are useful
 * to see, but presenting them as requirements would be inventing platform
 * rules — so they live here as advisories and the score ignores them.
 *
 * ## A caveat that applies to every Instagram figure below
 *
 * These are **Content Publishing API** specifications: what Meta's API
 * accepts when software posts on a business account's behalf. They are not a
 * guarantee about what the Instagram app allows a person posting by hand.
 * They are the best verifiable source available, and the UI says so.
 */

/* ---- sources ----------------------------------------------------------- */

const IG_MEDIA_REFERENCE: RuleSource = {
  title: "Meta — Instagram Platform, IG User Media API reference",
  url: "https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media",
  verifiedOn: "2026-11-19",
  caveat:
    "Content Publishing API specification. Describes what Meta's API accepts, not what the Instagram app permits when posting manually.",
};

const LINKEDIN_POSTS_API: RuleSource = {
  title: "LinkedIn — Posts API (states no maximum for commentary)",
  url: "https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api",
  verifiedOn: "2026-11-19",
  caveat:
    "LinkedIn documents a FIELD_LENGTH_TOO_LONG error for over-long text but publishes no threshold. The figure shown is widely reported, not official.",
};

const FACEBOOK_PAGE_FEED: RuleSource = {
  title: "Meta — Page Feed API reference (states no maximum for message)",
  url: "https://developers.facebook.com/docs/graph-api/reference/page/feed/",
  verifiedOn: "2026-11-19",
  caveat:
    "Meta describes the post message field without any length limit. The figure shown is widely reported, not official.",
};

/* ---- the table --------------------------------------------------------- */

export interface CaptionLimit {
  maxChars: number;
  source: RuleSource;
}

export interface HashtagLimit {
  max: number;
  source: RuleSource;
}

export interface ImageSpec {
  formats: string[];
  formatLabel: string;
  maxBytes: number;
  /** width ÷ height, inclusive. */
  minAspect: number;
  maxAspect: number;
  aspectLabel: string;
  minWidth: number;
  maxWidth: number;
  source: RuleSource;
}

export interface PlatformRules {
  id: SocialPlatform;
  label: string;
  /** One line on what this platform does and does not publish. */
  documentationNote: string;
  /** Requirements that may fail a check and move the score. */
  documented: {
    caption?: CaptionLimit;
    hashtags?: HashtagLimit;
    image?: ImageSpec;
  };
  /** Conventions shown for information only. Never scored. */
  advisory: {
    caption?: CaptionLimit;
    truncatesAfter?: { chars: number; note: string };
    note?: string;
  };
}

export const PLATFORMS: Record<SocialPlatform, PlatformRules> = {
  instagram: {
    id: "instagram",
    label: "Instagram",
    documentationNote:
      "Meta publishes exact figures for the Content Publishing API, so these checks are measured against the specification itself.",
    documented: {
      caption: { maxChars: 2200, source: IG_MEDIA_REFERENCE },
      hashtags: { max: 30, source: IG_MEDIA_REFERENCE },
      image: {
        formats: ["image/jpeg"],
        formatLabel: "JPEG",
        maxBytes: 8 * 1024 * 1024,
        // 4:5 = 0.8 at the tall end, 1.91:1 at the wide end.
        minAspect: 0.8,
        maxAspect: 1.91,
        aspectLabel: "between 4:5 and 1.91:1",
        minWidth: 320,
        maxWidth: 1440,
        source: IG_MEDIA_REFERENCE,
      },
    },
    advisory: {
      truncatesAfter: {
        chars: 125,
        note: "Instagram is widely reported to collapse a caption after roughly 125 characters behind a “more” link. Meta does not document this, so it is shown as guidance only.",
      },
    },
  },

  linkedin: {
    id: "linkedin",
    label: "LinkedIn",
    documentationNote:
      "LinkedIn publishes no caption, hashtag or image limits for posts, so êmet asserts none. The figure below is widely reported but unofficial, and does not affect the score.",
    documented: {},
    advisory: {
      caption: { maxChars: 3000, source: LINKEDIN_POSTS_API },
    },
  },

  facebook: {
    id: "facebook",
    label: "Facebook",
    documentationNote:
      "Meta's Page Feed reference describes the post message with no length limit, so êmet asserts none. The figure below is widely reported but unofficial, and does not affect the score.",
    documented: {},
    advisory: {
      caption: { maxChars: 63206, source: FACEBOOK_PAGE_FEED },
    },
  },
};

export const PLATFORM_ORDER: SocialPlatform[] = ["instagram", "linkedin", "facebook"];

export function isSocialPlatform(value: unknown): value is SocialPlatform {
  return typeof value === "string" && value in PLATFORMS;
}

/**
 * Instagram's caption row also states a limit of "20 @ tags".
 *
 * It is deliberately NOT implemented. The page never defines what an "@ tag"
 * is, and never says whether the count is of distinct usernames or of total
 * occurrences — mentioning one account twenty-five times would breach the rule
 * under one reading and not the other. A validator would have to pick an
 * interpretation Meta does not state, and would then warn people about a limit
 * they may not have crossed.
 *
 * The mention count is reported as a plain measurement instead, with this
 * explanation, which is the honest version of what is actually known.
 */
export const MENTION_LIMIT_OMITTED =
  "Meta's caption documentation states a limit of 20 “@ tags” but does not define the term, or say whether it counts distinct usernames or every occurrence. êmet therefore reports the count without enforcing a limit.";
