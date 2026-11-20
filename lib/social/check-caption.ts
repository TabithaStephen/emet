import { MENTION_LIMIT_OMITTED, PLATFORMS } from "@/lib/social/platform-rules";
import type { PlatformCheck, SocialPlatform } from "@/lib/types";

/**
 * Deterministic caption checks.
 *
 * Arithmetic, not a model: counting characters and hashtags is exactly the
 * kind of thing that should never be asked of a language model, because the
 * answer must be reproducible and defensible to the person whose post is
 * being held back.
 */

/**
 * Counts characters as Unicode code points.
 *
 * None of the three platforms says which unit it counts — code points, UTF-16
 * units, or grapheme clusters — and the three disagree for emoji. A family
 * emoji is one grapheme, several code points and more UTF-16 units again.
 * Code points are the middle reading and are what `[...string]` gives; the UI
 * states the unit so a caption sitting on the boundary is not presented as
 * settled.
 */
export function countCharacters(caption: string): number {
  return [...caption].length;
}

/**
 * Hashtags in the caption.
 *
 * A hashtag is `#` followed by at least one letter, digit or underscore. A
 * bare `#`, or one followed by punctuation, is not a tag on any of these
 * platforms. Duplicates are counted separately because that is what the text
 * contains; no platform says it deduplicates.
 */
export function findHashtags(caption: string): string[] {
  return caption.match(/#[\p{L}\p{N}_]+/gu) ?? [];
}

/** Mentions in the caption: `@` followed by a username-shaped token. */
export function findMentions(caption: string): string[] {
  return caption.match(/@[\p{L}\p{N}._]+/gu) ?? [];
}

/** Bare URLs, which Instagram does not make clickable in captions. */
export function findLinks(caption: string): string[] {
  return caption.match(/https?:\/\/[^\s]+/gi) ?? [];
}

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

export function checkCaption(
  caption: string,
  platform: SocialPlatform,
): PlatformCheck[] {
  const rules = PLATFORMS[platform];
  const checks: PlatformCheck[] = [];

  const trimmed = caption.trim();
  const chars = countCharacters(caption);
  const hashtags = findHashtags(caption);
  const mentions = findMentions(caption);
  const links = findLinks(caption);

  /* 1. Something to post at all. Structural, no platform rule needed. */
  checks.push({
    id: "caption-present",
    label: "Caption has content",
    state: trimmed.length > 0 ? "pass" : "fail",
    measured: trimmed.length > 0 ? `${plural(chars, "character")}` : "empty",
    expected: "At least one character",
    explanation:
      trimmed.length > 0
        ? "There is caption text to publish."
        : "An empty caption cannot be published, whatever the platform.",
    suggestion: trimmed.length > 0 ? null : "Write the caption before checking readiness.",
    source: null,
    confidence: "none",
    /*
     * Shown, but deliberately NOT scored.
     *
     * Having written something is true of any post anywhere; it is not a
     * requirement the platform publishes. Counting it would let LinkedIn and
     * Facebook — which document no requirements at all — report a readiness
     * score of 100 on the strength of the caption not being empty, which
     * claims a verification that never happened.
     */
    scored: false,
  });

  /* 2. Caption length: documented where published, advisory otherwise. */
  const documentedCaption = rules.documented.caption;
  const advisoryCaption = rules.advisory.caption;

  if (documentedCaption) {
    const within = chars <= documentedCaption.maxChars;
    checks.push({
      id: "caption-length",
      label: "Caption length",
      state: within ? "pass" : "fail",
      measured: `${chars.toLocaleString()} characters`,
      expected: `${documentedCaption.maxChars.toLocaleString()} maximum`,
      confidence: "documented",
      explanation: within
        ? `Within the ${documentedCaption.maxChars.toLocaleString()}-character maximum stated in the API reference. Counted in Unicode code points, which is the unit the documentation does not specify.`
        : `Over the documented maximum by ${(chars - documentedCaption.maxChars).toLocaleString()} characters. The Content Publishing API rejects a caption longer than ${documentedCaption.maxChars.toLocaleString()}.`,
      suggestion: within
        ? null
        : `Cut at least ${(chars - documentedCaption.maxChars).toLocaleString()} characters.`,
      source: documentedCaption.source,
      scored: true,
    });
  } else if (advisoryCaption) {
    const within = chars <= advisoryCaption.maxChars;
    checks.push({
      id: "caption-length-advisory",
      label: "Caption length",
      state: "info",
      measured: `${chars.toLocaleString()} characters`,
      expected: `around ${advisoryCaption.maxChars.toLocaleString()}, widely reported`,
      confidence: "advisory",
      explanation: within
        ? `${rules.label} publishes no caption limit, so nothing here is enforced. For context, ${advisoryCaption.maxChars.toLocaleString()} characters is the figure commonly cited, and this caption is within it.`
        : `${rules.label} publishes no caption limit, so this is not a failure. It does exceed the ${advisoryCaption.maxChars.toLocaleString()} characters commonly cited, which may mean it is truncated or rejected.`,
      suggestion: within
        ? null
        : `Consider shortening it, or test the post before relying on it. ${rules.label} does not document the real limit.`,
      source: advisoryCaption.source,
      scored: false,
    });
  }

  /* 3. Hashtags. */
  const hashtagRule = rules.documented.hashtags;
  if (hashtagRule) {
    const within = hashtags.length <= hashtagRule.max;
    checks.push({
      id: "hashtag-count",
      label: "Hashtags",
      state: within ? "pass" : "fail",
      measured: plural(hashtags.length, "hashtag"),
      expected: `${hashtagRule.max} maximum`,
      confidence: "documented",
      explanation: within
        ? `Within the documented maximum of ${hashtagRule.max}.`
        : `${hashtags.length} hashtags exceeds the documented maximum of ${hashtagRule.max}.`,
      suggestion: within
        ? null
        : `Remove ${plural(hashtags.length - hashtagRule.max, "hashtag")}.`,
      source: hashtagRule.source,
      scored: true,
    });
  } else {
    checks.push({
      id: "hashtag-count-info",
      label: "Hashtags",
      state: "info",
      measured: plural(hashtags.length, "hashtag"),
      expected: null,
      confidence: "none",
      explanation: `${rules.label} publishes no hashtag limit, so this is a count rather than a check.`,
      suggestion: null,
      source: null,
      scored: false,
    });
  }

  /* 4. Mentions — counted, never enforced. See MENTION_LIMIT_OMITTED. */
  checks.push({
    id: "mention-count",
    label: "Mentions",
    state: "info",
    measured: plural(mentions.length, "mention"),
    expected: null,
    confidence: "none",
    explanation:
      platform === "instagram"
        ? MENTION_LIMIT_OMITTED
        : `${rules.label} publishes no limit on mentions, so this is a count rather than a check.`,
    suggestion: null,
    source: platform === "instagram" ? PLATFORMS.instagram.documented.caption?.source ?? null : null,
    scored: false,
  });

  /* 5. Instagram only: links in captions, and the truncation point. */
  if (platform === "instagram") {
    if (links.length > 0) {
      checks.push({
        id: "caption-links",
        label: "Links in the caption",
        state: "info",
        measured: plural(links.length, "link"),
        expected: null,
        confidence: "advisory",
        explanation:
          "Instagram captions are widely reported not to render links as clickable. Meta does not document this, so it is guidance rather than a rule.",
        suggestion: "Point readers to the profile link instead of relying on a caption URL.",
        source: null,
        scored: false,
      });
    }

    const truncation = rules.advisory.truncatesAfter;
    if (truncation && chars > truncation.chars) {
      checks.push({
        id: "caption-truncation",
        label: "Visible before “more”",
        state: "info",
        measured: `${chars.toLocaleString()} characters, about ${(chars - truncation.chars).toLocaleString()} beyond the fold`,
        expected: `roughly ${truncation.chars} characters shown`,
        confidence: "advisory",
        explanation: truncation.note,
        suggestion: "Put what matters in the opening sentence.",
        source: null,
        scored: false,
      });
    }
  }

  return checks;
}
