/**
 * Word-level diff between two versions of a draft. No dependencies.
 *
 * Used to show what actually changed between two audited versions of the same
 * content. A diff library would do this too, but the whole job is one LCS and
 * a tokeniser, and a dependency here would have to be justified against about
 * eighty lines.
 *
 * ## Why this is not a plain LCS
 *
 * A naive word-level LCS fills an (n × m) table. Two drafts at the audit
 * endpoint's 20,000-character ceiling are roughly 3,500 words each, which is
 * 12 million cells — far too much time and memory to run in a browser tab on a
 * modest machine. Three things keep it bounded:
 *
 *  1. Identical head and tail are trimmed first. Two versions of the same
 *     document usually differ in a few places, so this alone collapses the
 *     problem to the changed region in the common case.
 *  2. What remains is only run through the LCS if it fits inside
 *     `MAX_LCS_CELLS`.
 *  3. Past that, the diff falls back to comparing paragraphs rather than
 *     words, which is coarser but still honest and runs in linear time.
 *
 * `granularity` on the result says which path was taken, so the UI can tell
 * the reader when it is showing a coarse comparison rather than implying a
 * precision it does not have.
 */

export type DiffOp = "equal" | "insert" | "delete";

export interface DiffSegment {
  op: DiffOp;
  /** The text of this segment, including its trailing whitespace. */
  text: string;
  /**
   * For an `equal` segment whose two versions differ only in whitespace, the
   * earlier version's exact spelling.
   *
   * Words are matched ignoring the whitespace they carry, so "word " and
   * "word\n" count as equal — which is what makes a reflowed paragraph read as
   * unchanged instead of as hundreds of edits. But the two spellings are not
   * the same bytes, so keeping only one of them would mean the diff could no
   * longer reproduce the earlier version exactly. When they differ, the
   * earlier spelling is kept here; `text` always holds the later one.
   */
  beforeText?: string;
}

export interface DiffResult {
  segments: DiffSegment[];
  /** Word counts, for a plain-language summary. */
  added: number;
  removed: number;
  unchanged: number;
  /** True when the two inputs are character-for-character identical. */
  identical: boolean;
  /**
   * "word" for the exact comparison, "paragraph" when the inputs were too
   * large and the coarser fallback was used.
   */
  granularity: "word" | "paragraph";
}

/**
 * Cell budget for the LCS table.
 *
 * Sized so that a word-level diff always succeeds for content the audit
 * endpoint would accept: its ceiling is 20,000 characters, which tokenises to
 * roughly 3,200 words, or about 10.1M cells when two such drafts share
 * nothing at all.
 *
 * Measured on the development machine (Intel, 8GB):
 *
 *   chars   tokens   cells     table    time
 *    5,000     795    0.6M       2MB     43ms
 *   10,000   1,590    2.5M      10MB    153ms
 *   15,000   2,383    5.7M      22MB    332ms
 *   20,000   3,175   10.1M      38MB    589ms
 *
 * An earlier budget of 1.2M cells was far too tight: a 10,000-character draft
 * with scattered one-percent edits fell back to paragraphs and then reported
 * 174 words changed when six had been. Being slower by half a second on a
 * click the user asked for is much cheaper than overstating what changed, so
 * the budget now covers the real worst case and the paragraph path is a
 * genuine fallback rather than the common case.
 */
const MAX_LCS_CELLS = 12_000_000;

/**
 * Splits text into tokens that each carry their trailing whitespace, so
 * joining the segments back together reproduces the input exactly. Comparing
 * whole words rather than characters keeps the output readable: a changed word
 * reads as one replacement, not a flurry of single letters.
 */
export function tokenise(text: string): string[] {
  if (!text) return [];
  return text.match(/\S+\s*|\s+/g) ?? [];
}

/** Splits into paragraphs, each keeping its trailing blank lines. */
function toParagraphs(text: string): string[] {
  if (!text) return [];
  return text.match(/[^\n]*\n{2,}|[^\n]*\n|[^\n]+/g) ?? [];
}

/** Compares tokens ignoring the whitespace they carry. */
const core = (token: string) => token.trim();

/**
 * Classic dynamic-programming LCS over two token arrays.
 *
 * Uses a Uint32Array rather than nested JS arrays: the table is the memory
 * hot-spot, and a flat typed array avoids both the per-row object overhead and
 * the garbage collector.
 */
function lcsSegments(a: string[], b: string[]): DiffSegment[] {
  const n = a.length;
  const m = b.length;
  const width = m + 1;
  const table = new Uint32Array((n + 1) * width);

  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      table[i * width + j] =
        core(a[i]) === core(b[j])
          ? table[(i + 1) * width + (j + 1)] + 1
          : Math.max(table[(i + 1) * width + j], table[i * width + (j + 1)]);
    }
  }

  const segments: DiffSegment[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (core(a[i]) === core(b[j])) {
      push(segments, "equal", b[j], a[i]);
      i += 1;
      j += 1;
    } else if (table[(i + 1) * width + j] >= table[i * width + (j + 1)]) {
      push(segments, "delete", a[i]);
      i += 1;
    } else {
      push(segments, "insert", b[j]);
      j += 1;
    }
  }
  while (i < n) {
    push(segments, "delete", a[i]);
    i += 1;
  }
  while (j < m) {
    push(segments, "insert", b[j]);
    j += 1;
  }
  return segments;
}

/**
 * Appends a token, merging it into the previous segment when the op matches.
 *
 * `beforeText` is the earlier version's spelling of an `equal` token; it is
 * tracked separately so the diff can still reproduce both inputs byte for
 * byte even though matching ignores whitespace.
 */
function push(
  segments: DiffSegment[],
  op: DiffOp,
  text: string,
  beforeText: string = text,
) {
  const last = segments[segments.length - 1];
  if (last && last.op === op) {
    last.beforeText = (last.beforeText ?? last.text) + beforeText;
    last.text += text;
    if (last.beforeText === last.text) delete last.beforeText;
    return;
  }
  const segment: DiffSegment = { op, text };
  if (beforeText !== text) segment.beforeText = beforeText;
  segments.push(segment);
}

/** Counts the words in a segment, ignoring pure whitespace. */
function wordsIn(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/**
 * Diffs two versions of a draft.
 *
 * `before` is the earlier version, `after` the later one: an "insert" is text
 * the later version added, a "delete" is text it removed.
 */
export function diffText(before: string, after: string): DiffResult {
  if (before === after) {
    return {
      segments: before ? [{ op: "equal", text: before }] : [],
      added: 0,
      removed: 0,
      unchanged: wordsIn(before),
      identical: true,
      granularity: "word",
    };
  }

  let aTokens = tokenise(before);
  let bTokens = tokenise(after);

  /*
   * Trim the identical head and tail before doing any real work. Two versions
   * of one document normally share most of their length, so this is what keeps
   * the LCS small enough to run at all.
   */
  const head: DiffSegment[] = [];
  let start = 0;
  while (
    start < aTokens.length &&
    start < bTokens.length &&
    core(aTokens[start]) === core(bTokens[start])
  ) {
    push(head, "equal", bTokens[start], aTokens[start]);
    start += 1;
  }

  const tail: DiffSegment[] = [];
  let endA = aTokens.length;
  let endB = bTokens.length;
  while (
    endA > start &&
    endB > start &&
    core(aTokens[endA - 1]) === core(bTokens[endB - 1])
  ) {
    {
      const after = bTokens[endB - 1];
      const before = aTokens[endA - 1];
      const segment: DiffSegment = { op: "equal", text: after };
      if (before !== after) segment.beforeText = before;
      tail.unshift(segment);
    }
    endA -= 1;
    endB -= 1;
  }

  aTokens = aTokens.slice(start, endA);
  bTokens = bTokens.slice(start, endB);

  let middle: DiffSegment[];
  let granularity: DiffResult["granularity"] = "word";

  if ((aTokens.length + 1) * (bTokens.length + 1) <= MAX_LCS_CELLS) {
    middle = lcsSegments(aTokens, bTokens);
  } else {
    /*
     * Too large for an exact word diff. Fall back to paragraphs, which is a
     * far smaller problem and still tells the reader truthfully which blocks
     * changed — it simply does not pinpoint the words inside them.
     */
    granularity = "paragraph";
    const aParas = toParagraphs(aTokens.join(""));
    const bParas = toParagraphs(bTokens.join(""));
    middle =
      (aParas.length + 1) * (bParas.length + 1) <= MAX_LCS_CELLS
        ? lcsSegments(aParas, bParas)
        : // Pathological even by paragraph: report wholesale replacement
          // rather than spend the time, and say it was coarse.
          [
            ...(aParas.length ? ([{ op: "delete", text: aParas.join("") }] as DiffSegment[]) : []),
            ...(bParas.length ? ([{ op: "insert", text: bParas.join("") }] as DiffSegment[]) : []),
          ];
  }

  // Stitch the three parts back together, merging at the joins.
  const segments: DiffSegment[] = [];
  for (const part of [head, middle, tail]) {
    for (const segment of part) {
      push(segments, segment.op, segment.text, segment.beforeText ?? segment.text);
    }
  }

  let added = 0;
  let removed = 0;
  let unchanged = 0;
  for (const segment of segments) {
    const count = wordsIn(segment.text);
    if (segment.op === "insert") added += count;
    else if (segment.op === "delete") removed += count;
    else unchanged += count;
  }

  return { segments, added, removed, unchanged, identical: false, granularity };
}

/** One-line plain-language summary of a diff, for the UI and for reports. */
export function describeDiff(diff: DiffResult): string {
  if (diff.identical) return "The content is identical in both versions.";
  const parts: string[] = [];
  if (diff.added) parts.push(`${diff.added} word${diff.added === 1 ? "" : "s"} added`);
  if (diff.removed)
    parts.push(`${diff.removed} word${diff.removed === 1 ? "" : "s"} removed`);
  if (parts.length === 0) return "The wording is unchanged; only spacing differs.";
  const coarse =
    diff.granularity === "paragraph"
      ? " Compared paragraph by paragraph, because the versions were too long for a word-level comparison."
      : "";
  return `${parts.join(", ")}.${coarse}`;
}

/** The text an `equal` segment had in the earlier version. */
export function beforeTextOf(segment: DiffSegment): string {
  return segment.beforeText ?? segment.text;
}
