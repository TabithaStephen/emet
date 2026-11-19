import {
  GoogleGenAI,
  ThinkingLevel,
  createPartFromBase64,
  createUserContent,
} from "@google/genai";
import {
  DOC_JSON_SCHEMA,
  InvalidDocResponse,
  MAX_RULES,
  parseDocPayload,
} from "@/lib/ai/doc-contract";
import { buildDocPrompt } from "@/lib/ai/build-doc-prompt";
import {
  MAX_BODY_BYTES,
  MAX_PDF_BYTES,
  MAX_PDF_PAGES,
  PDF_MIME,
  decodeBase64,
  inspectPdf,
  isPdfProblem,
} from "@/lib/pdf/inspect-pdf";

/**
 * Brand document extraction: reads rules out of an uploaded PDF.
 *
 * The PDF is sent to Gemini as an inline `application/pdf` part and genuinely
 * read — Gemini's document handling is page-native, so this also works on a
 * scanned document with no text layer, which a text-layer parser cannot read at
 * all. Verified on both during development.
 *
 * Nothing here is ever faked. With no API key the endpoint returns a 503 with
 * setup instructions; when the model can read nothing, that is reported as an
 * honest empty result rather than padded with plausible-sounding rules.
 *
 * The key is read from the server environment and never leaves it. This file is
 * never imported by a client component.
 */

/**
 * Same default as the audit route. Verified during Stage 1 of this work:
 * `gemini-3.5-flash-lite` accepts inline application/pdf and read a 3-page
 * document in 10.1s for 1,590 input tokens, including a scanned, image-only
 * PDF via OCR. `GEMINI_DOC_MODEL` overrides it if a future model does not.
 */
const DEFAULT_MODEL = "gemini-3.5-flash-lite";

/** See the note in app/api/audit/route.ts. Must exceed the timeout below. */
export const maxDuration = 60;

/**
 * A document is heavier than a draft: every page is processed as an image as
 * well as text, so cost and latency scale with the page count. This sits under
 * `maxDuration` so our own clear error wins the race against the host.
 */
const DEFAULT_TIMEOUT_MS = 50_000;

/**
 * Output ceiling. 40 rules at roughly 150 tokens each is about 6k, and thinking
 * tokens are billed against the same budget.
 */
const MAX_OUTPUT_TOKENS = 16384;

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function model(): string {
  return (
    process.env.GEMINI_DOC_MODEL?.trim() ||
    process.env.GEMINI_MODEL?.trim() ||
    DEFAULT_MODEL
  );
}

function apiKey(): string | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  return key ? key : null;
}

/** 3.6 / 3.8 Flash reject MINIMAL; LOW is their floor. See the audit route. */
function thinkingLevelFor(name: string): ThinkingLevel {
  const override = process.env.GEMINI_THINKING_LEVEL?.trim().toUpperCase();
  if (override && override in ThinkingLevel) {
    return ThinkingLevel[override as keyof typeof ThinkingLevel];
  }
  if (/gemini-3\.(6|8)-flash/.test(name)) return ThinkingLevel.LOW;
  return ThinkingLevel.MINIMAL;
}

function fail(code: string, message: string, status: number, hint?: string) {
  return Response.json({ ok: false, code, message, hint }, { status });
}

/** Google's transient capacity error, as opposed to anything we did wrong. */
function isOverloaded(error: unknown): boolean {
  const raw = error instanceof Error ? error.message : String(error);
  return /high demand|UNAVAILABLE|overloaded|503/i.test(raw);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retries ONLY a transient "high demand" failure.
 *
 * The audit route deliberately sends `attempts: 1`, because the SDK's default
 * of five attempts with exponential backoff turns a rate-limited key into
 * minutes of silent waiting and then a timeout that hides the real cause. That
 * reasoning is right, and it is kept: a 429, a bad key or a bad document still
 * surfaces immediately and unretried.
 *
 * The exception is Google's own capacity error. Measured during development,
 * `gemini-3.5-flash-lite` returned 503 UNAVAILABLE on roughly one call in
 * three, intermittently and regardless of the document — a user uploading a
 * perfectly good PDF would see it fail for reasons that have nothing to do with
 * them. Two extra attempts over a shared deadline turn that into a brief wait.
 *
 * `timeoutMs` is the budget for ALL attempts, not each, so this can never run
 * past the function's own ceiling.
 */
async function generateWithRetry<T>(
  call: (perAttemptTimeoutMs: number) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  const MAX_ATTEMPTS = 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    try {
      return await call(remaining);
    } catch (error) {
      lastError = error;
      if (!isOverloaded(error) || attempt === MAX_ATTEMPTS) throw error;
      // Short, bounded backoff, and only if there is time left to use it.
      const backoff = attempt * 1000;
      if (deadline - Date.now() < backoff + 8000) throw error;
      console.log(
        `[brand-doc] attempt ${attempt} hit Gemini capacity limits; retrying in ${backoff}ms`,
      );
      await sleep(backoff);
    }
  }
  throw lastError;
}

/**
 * Configuration probe. No network call, so the Brand DNA page can show the
 * setup notice before the user picks a file and wastes the wait.
 */
export async function GET() {
  return Response.json({
    ok: true,
    configured: apiKey() !== null,
    model: model(),
    maxBytes: MAX_PDF_BYTES,
    maxPages: MAX_PDF_PAGES,
    maxRules: MAX_RULES,
  });
}

export async function POST(request: Request) {
  const startedAt = performance.now();

  // 1. Configuration ------------------------------------------------------
  const key = apiKey();
  if (!key) {
    return fail(
      "missing-api-key",
      "No Gemini API key is configured on the server, so the document was not read.",
      503,
      "Create .env.local with GEMINI_API_KEY=your-key and restart the dev server.",
    );
  }

  // 2. Input --------------------------------------------------------------

  /*
   * Size first, from the header, BEFORE the body is read.
   *
   * Next truncates a request body over MAX_BODY_BYTES on its way through
   * proxy.ts rather than rejecting it, and a truncated body fails to parse —
   * so without this check an oversized upload surfaces as "not valid JSON",
   * which tells the user nothing. Content-Length is advisory, so the byte cap
   * in inspectPdf still backs it up for anything that slips past.
   */
  const declaredLength = Number.parseInt(request.headers.get("content-length") ?? "", 10);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return fail(
      "file-too-large",
      `That upload is about ${(declaredLength / 1024 / 1024).toFixed(1)}MB once encoded for transfer; the limit is ${MAX_PDF_BYTES / 1024 / 1024}MB per PDF.`,
      413,
      "Upload only the sections that carry the brand rules.",
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(
      "bad-request",
      "The request body could not be read. If the document is large, it may have been truncated in transfer.",
      400,
      `The limit is ${MAX_PDF_BYTES / 1024 / 1024}MB per PDF.`,
    );
  }

  const payload = body as Record<string, unknown>;
  const data = typeof payload.data === "string" ? payload.data : "";
  const mimeType = typeof payload.mimeType === "string" ? payload.mimeType : "";
  const rawName = typeof payload.name === "string" ? payload.name : "document.pdf";
  // The file name is echoed into the prompt, so keep it short and plain.
  const fileName = rawName.replace(/[\u0000-\u001F\u007F]/g, "").slice(0, 120) || "document.pdf";

  if (!data) {
    return fail("bad-request", "No document was supplied.", 400);
  }
  if (mimeType !== PDF_MIME) {
    return fail(
      "unsupported-type",
      `That file is ${mimeType || "of an unknown type"}. Only PDF documents can be imported.`,
      415,
      "Export or print the document as a PDF, then upload that.",
    );
  }

  // 3. Structural validation, before any model call is spent ---------------
  const bytes = decodeBase64(data);
  if (!bytes) {
    return fail("bad-request", "The uploaded document could not be decoded.", 400);
  }

  const info = inspectPdf(bytes);
  if (isPdfProblem(info)) {
    // 413 for the size cap, 422 for a file we simply cannot process.
    const status = info.code === "file-too-large" ? 413 : 422;
    return fail(info.code, info.message, status, info.hint);
  }

  const chosenModel = model();
  const timeoutMs = intFromEnv("GEMINI_DOC_TIMEOUT_MS", DEFAULT_TIMEOUT_MS);
  const thinkingLevel = thinkingLevelFor(chosenModel);

  // 4. The model call -----------------------------------------------------
  const geminiStartedAt = performance.now();
  let geminiMs = 0;
  let text: string;
  let thoughtTokens: number | null = null;
  let outputTokens: number | null = null;
  let inputTokens: number | null = null;

  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const response = await generateWithRetry(
      (perAttemptMs) =>
        ai.models.generateContent({
          model: chosenModel,
          contents: createUserContent([
            createPartFromBase64(data, PDF_MIME),
            buildDocPrompt(fileName, info.pages),
          ]),
          config: {
            responseMimeType: "application/json",
            responseJsonSchema: DOC_JSON_SCHEMA,
            temperature: 0.1,
            maxOutputTokens: MAX_OUTPUT_TOKENS,
            thinkingConfig: { thinkingLevel },
            abortSignal: AbortSignal.timeout(perAttemptMs),
            /*
             * One SDK-level attempt, as in the audit route — the retrying that
             * does happen is ours, in generateWithRetry, and is confined to
             * Google's transient capacity error.
             */
            httpOptions: { timeout: perAttemptMs, retryOptions: { attempts: 1 } },
          },
        }),
      timeoutMs,
    );
    geminiMs = performance.now() - geminiStartedAt;

    thoughtTokens = response.usageMetadata?.thoughtsTokenCount ?? null;
    outputTokens = response.usageMetadata?.candidatesTokenCount ?? null;
    inputTokens = response.usageMetadata?.promptTokenCount ?? null;

    if (response.candidates?.[0]?.finishReason === "MAX_TOKENS") {
      return fail(
        "output-truncated",
        `Gemini hit the ${MAX_OUTPUT_TOKENS}-token output limit before finishing, so the reply was unusable.`,
        502,
        "Upload a shorter section of the document.",
      );
    }

    text = typeof response.text === "string" ? response.text : "";
    if (!text.trim()) {
      return fail(
        "empty-model-response",
        "Gemini returned an empty response, so no rules were extracted. The document may have tripped a safety filter, or the reply was cut off.",
        502,
      );
    }
  } catch (error) {
    geminiMs = performance.now() - geminiStartedAt;
    const raw = error instanceof Error ? error.message : String(error);
    const name = error instanceof Error ? error.name : "";

    if (
      name === "TimeoutError" ||
      name === "AbortError" ||
      /abort|timed? ?out/i.test(raw) ||
      /DEADLINE_EXCEEDED|Deadline expired/i.test(raw)
    ) {
      return fail(
        "timeout",
        `Gemini did not finish reading the document within ${Math.round(timeoutMs / 1000)} seconds, so it was abandoned after ${(geminiMs / 1000).toFixed(1)}s.`,
        504,
        "Upload fewer pages, or raise GEMINI_DOC_TIMEOUT_MS in .env.local.",
      );
    }
    if (/API[_ ]?key|API key not valid|PERMISSION_DENIED|UNAUTHENTICATED|401|403/i.test(raw)) {
      return fail("invalid-api-key", "Gemini rejected the API key.", 502,
        "Check GEMINI_API_KEY in .env.local, then restart the dev server.");
    }
    if (/NOT_FOUND|not found|is not supported|404/i.test(raw)) {
      return fail(
        "unknown-model",
        `Gemini does not recognise the model "${chosenModel}", or it cannot read PDF documents.`,
        502,
        `Set GEMINI_DOC_MODEL in .env.local to a model with document support, e.g. ${DEFAULT_MODEL}.`,
      );
    }
    if (isOverloaded(error)) {
      return fail(
        "model-overloaded",
        `Gemini reports that "${chosenModel}" is overloaded. The document was retried and still could not be read.`,
        503,
        "This is capacity on Google's side, not a problem with your document. Wait a moment and upload it again.",
      );
    }
    if (/RESOURCE_EXHAUSTED|quota|rate limit|429/i.test(raw)) {
      return fail("rate-limited", "Gemini rate limit or quota reached.", 429,
        "Wait a moment and upload the document again.");
    }
    return fail("upstream-error", `Gemini request failed: ${raw}`, 502);
  }

  // 5. Validate the response ----------------------------------------------
  let extraction;
  try {
    extraction = parseDocPayload(JSON.parse(text));
  } catch (error) {
    const reason =
      error instanceof InvalidDocResponse ? error.message : "Response was not valid JSON.";
    return fail(
      "invalid-model-response",
      `Gemini's reply did not match the expected format. ${reason}`,
      502,
      "Upload the document again; if it keeps happening, try a different GEMINI_DOC_MODEL.",
    );
  }

  const totalMs = performance.now() - startedAt;

  console.log(
    `[brand-doc] model=${chosenModel} thinkingLevel=${thinkingLevel} ` +
      `file=${(info.bytes / 1024).toFixed(0)}KB pages=${info.pages ?? "?"} ` +
      `gemini=${(geminiMs / 1000).toFixed(2)}s total=${(totalMs / 1000).toFixed(2)}s ` +
      `rules=${extraction.rules.length} unreadable=${extraction.unreadable} ` +
      `tokens(in/out/thinking)=${inputTokens ?? "?"}/${outputTokens ?? "?"}/${thoughtTokens ?? "?"}`,
  );

  /*
   * An honest empty result. The document was read, the model found nothing it
   * could quote, and that is reported as such — never padded out with invented
   * rules so the screen looks productive.
   */
  if (extraction.unreadable || extraction.rules.length === 0) {
    return Response.json({
      ok: true,
      extracted: false,
      model: chosenModel,
      document: { name: fileName, bytes: info.bytes, pages: info.pages },
      notes:
        extraction.notes ||
        "No brand rules could be read from this document.",
      rules: [],
      timings: { geminiMs: Math.round(geminiMs), totalMs: Math.round(totalMs) },
    });
  }

  return Response.json({
    ok: true,
    extracted: true,
    model: chosenModel,
    document: {
      name: fileName,
      bytes: info.bytes,
      // Prefer what the model could actually read over what we counted.
      pages: extraction.pagesRead ?? info.pages,
      title: extraction.documentTitle,
    },
    notes: extraction.notes,
    rules: extraction.rules,
    timings: { geminiMs: Math.round(geminiMs), totalMs: Math.round(totalMs) },
    usage: { inputTokens, outputTokens, thoughtTokens, thinkingLevel },
  });
}
