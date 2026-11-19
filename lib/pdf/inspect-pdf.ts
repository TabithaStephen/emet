/**
 * Structural validation for an uploaded PDF — no dependencies.
 *
 * This runs BEFORE the file is sent to Gemini, so a file that cannot possibly
 * work is rejected without spending a model call. It deliberately does NOT try
 * to extract text: reading the page content is Gemini's job, and a text-layer
 * parser would return nothing at all for a scanned document that Gemini reads
 * perfectly well.
 *
 * Everything here is best-effort structure checking on the raw bytes. Where a
 * fact cannot be established — the page count of a PDF that keeps its objects
 * in compressed object streams, for instance — it is reported as `null` rather
 * than guessed at.
 */

export const PDF_MIME = "application/pdf";

/**
 * Upload ceiling, set by the transport rather than by Gemini.
 *
 * Gemini itself accepts 20MB inline, but the file reaches us base64-encoded
 * inside a JSON body, which inflates it by 4/3 — and Next caps a request body
 * passing through `proxy.ts` at 10MB, silently TRUNCATING anything larger
 * (`middlewareClientMaxBodySize`). A truncated body then fails to parse as
 * JSON, which would surface to the user as "not valid JSON" rather than "too
 * big".
 *
 * 7MB is the largest PDF whose encoded body stays comfortably inside that
 * ceiling: 7 × 4/3 = 9.3MB, plus the small JSON envelope.
 */
export const MAX_PDF_BYTES = 7 * 1024 * 1024;

/**
 * The JSON body budget this implies, used to reject an oversized upload from
 * its Content-Length before the body is read at all.
 */
export const MAX_BODY_BYTES = 10 * 1024 * 1024;

/**
 * Page ceiling. Each page costs roughly 260 input tokens plus latency, and the
 * route has to finish inside `maxDuration`. Measured: a 3-page document took
 * 10.1s and 1,590 input tokens.
 */
export const MAX_PDF_PAGES = 30;

export interface PdfInfo {
  bytes: number;
  /** PDF version from the header, e.g. "1.4". */
  version: string;
  /**
   * Pages, or null when the count could not be established from the raw bytes
   * (PDF 1.5+ may hold its page objects inside compressed object streams).
   * Null means unknown, never zero.
   */
  pages: number | null;
}

export interface PdfProblem {
  code:
    | "empty-file"
    | "not-a-pdf"
    | "file-too-large"
    | "truncated-pdf"
    | "encrypted-pdf"
    | "too-many-pages";
  message: string;
  hint?: string;
}

export function isPdfProblem(value: PdfInfo | PdfProblem): value is PdfProblem {
  return "code" in value;
}

/** Byte-preserving decode: every byte maps to one char, so offsets stay true. */
function asLatin1(bytes: Uint8Array): string {
  return new TextDecoder("latin1").decode(bytes);
}

/**
 * Best-effort page count.
 *
 * Tries the page tree's `/Count` first, then falls back to counting `/Type
 * /Page` objects. Both only work when the objects sit in the file as plain
 * text; a PDF using cross-reference streams hides them inside a compressed
 * stream, and then neither finds anything and we return null.
 */
function countPages(text: string): number | null {
  // `/Count N` belongs to a /Pages node. Take the largest, which is the root.
  let fromCount: number | null = null;
  for (const match of text.matchAll(/\/Count\s+(\d+)/g)) {
    const n = Number.parseInt(match[1], 10);
    if (Number.isFinite(n) && (fromCount === null || n > fromCount)) fromCount = n;
  }

  // `/Type /Page` but not `/Type /Pages`.
  const pageObjects = (text.match(/\/Type\s*\/Page(?![s])/g) ?? []).length;

  if (fromCount !== null && fromCount > 0) return fromCount;
  if (pageObjects > 0) return pageObjects;
  return null;
}

/**
 * Validates the structure of an uploaded PDF.
 *
 * Returns the file's details, or the single clearest reason it cannot be used.
 */
export function inspectPdf(bytes: Uint8Array): PdfInfo | PdfProblem {
  if (bytes.length === 0) {
    return { code: "empty-file", message: "That file is empty — it contains no data at all." };
  }

  if (bytes.length > MAX_PDF_BYTES) {
    const mb = (bytes.length / 1024 / 1024).toFixed(1);
    return {
      code: "file-too-large",
      message: `That PDF is ${mb}MB; the limit is ${MAX_PDF_BYTES / 1024 / 1024}MB.`,
      hint: "Upload only the sections that carry the brand rules. Image-heavy brand books are usually well over this; the pages with the written rules rarely are.",
    };
  }

  const text = asLatin1(bytes);

  /*
   * The header need not be at byte zero: the spec allows leading bytes, and
   * files that have been through a mail gateway often have them. Anything past
   * the first 1KB, though, is not a PDF by any reasonable reading.
   */
  const headerAt = text.slice(0, 1024).indexOf("%PDF-");
  if (headerAt === -1) {
    return {
      code: "not-a-pdf",
      message: "That file is not a PDF — it has no %PDF- header.",
      hint: "Renaming a file to .pdf does not convert it. Export or print it as a PDF first.",
    };
  }

  const version = /^%PDF-(\d+\.\d+)/.exec(text.slice(headerAt, headerAt + 16))?.[1] ?? "unknown";

  /*
   * A complete PDF ends with %%EOF. Trailing whitespace is common, so look in
   * the last 2KB rather than at the very end. Its absence means the upload was
   * cut short — worth catching here, because Gemini would simply fail later.
   */
  if (!text.slice(-2048).includes("%%EOF")) {
    return {
      code: "truncated-pdf",
      message: "That PDF looks incomplete — it has no end-of-file marker, so the upload was probably cut short.",
      hint: "Try uploading it again.",
    };
  }

  /*
   * Password-protected and rights-managed files carry an /Encrypt entry in the
   * trailer. Gemini cannot read them, so say so plainly now rather than
   * returning an opaque upstream error a minute later.
   */
  if (/\/Encrypt[\s/<\[]/.test(text)) {
    return {
      code: "encrypted-pdf",
      message: "That PDF is password-protected or rights-restricted, so its text cannot be read.",
      hint: "Open it, save an unprotected copy, and upload that instead.",
    };
  }

  const pages = countPages(text);
  if (pages !== null && pages > MAX_PDF_PAGES) {
    return {
      code: "too-many-pages",
      message: `That PDF has ${pages} pages; the limit is ${MAX_PDF_PAGES}.`,
      hint: "Upload the sections that carry the brand rules rather than the whole document.",
    };
  }

  return { bytes: bytes.length, version, pages };
}

/** Decodes a base64 payload to bytes, or null when it is not valid base64. */
export function decodeBase64(data: string): Uint8Array | null {
  try {
    const binary = atob(data);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}
