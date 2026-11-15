import { GoogleGenAI, ThinkingLevel, createPartFromBase64, createUserContent } from "@google/genai";
import {
  ACCEPTED_IMAGE_TYPES,
  InvalidVisualResponse,
  MAX_IMAGE_BYTES,
  VISUAL_BRIEF,
  VISUAL_JSON_SCHEMA,
  parseVisualPayload,
} from "@/lib/ai/visual-contract";
import { buildBrandBrief } from "@/lib/ai/build-prompt";
import { explainScore, scoreFromFindings } from "@/lib/audit-engine";
import { SEVERITY_ORDER, type BrandProfile, type Severity } from "@/lib/types";

/**
 * Visual brand compliance: compares a candidate asset against the approved one.
 *
 * Both images are sent to Gemini and genuinely analysed — no findings are
 * precomputed, and nothing about the demo pair is special-cased. Swap in two
 * unrelated images and the model will report on those instead.
 */

const DEFAULT_MODEL = "gemini-3.5-flash-lite";

/** See the note in app/api/audit/route.ts. Must exceed the timeout below. */
export const maxDuration = 60;

/**
 * Vision is heavier than text, but this has to stay under `maxDuration` so our
 * own timeout fires first and returns a clear error rather than the host
 * killing the function silently.
 */
const DEFAULT_TIMEOUT_MS = 50_000;
const MAX_OUTPUT_TOKENS = 16384;

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function model(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}

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

interface IncomingImage {
  data: string;
  mimeType: string;
  name?: string;
}

/** Validates one posted image: right type, present, and within the size cap. */
function checkImage(value: unknown, label: string): IncomingImage | string {
  if (typeof value !== "object" || value === null) return `${label} was missing.`;
  const img = value as Record<string, unknown>;
  const data = typeof img.data === "string" ? img.data : "";
  const mimeType = typeof img.mimeType === "string" ? img.mimeType : "";

  if (!data) return `${label} had no image data.`;
  if (!ACCEPTED_IMAGE_TYPES.includes(mimeType)) {
    return `${label} is ${mimeType || "an unknown type"}. Use PNG, JPEG or WebP.`;
  }
  // base64 is about 4 characters per 3 bytes.
  const approxBytes = Math.floor((data.length * 3) / 4);
  if (approxBytes > MAX_IMAGE_BYTES) {
    return `${label} is about ${Math.round(approxBytes / 1024 / 1024)}MB; the limit is ${MAX_IMAGE_BYTES / 1024 / 1024}MB.`;
  }
  return { data, mimeType, name: typeof img.name === "string" ? img.name : label };
}

export async function POST(request: Request) {
  const startedAt = performance.now();

  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    return fail(
      "missing-api-key",
      "No Gemini API key is configured on the server, so no visual audit was run.",
      503,
      "Create .env.local with GEMINI_API_KEY=your-key and restart the dev server.",
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("bad-request", "Request body was not valid JSON.", 400);
  }
  const payload = body as Record<string, unknown>;

  const reference = checkImage(payload.reference, "The approved reference image");
  if (typeof reference === "string") return fail("bad-request", reference, 400);

  const candidate = checkImage(payload.candidate, "The candidate image");
  if (typeof candidate === "string") return fail("bad-request", candidate, 400);

  const brand =
    typeof payload.brand === "object" && payload.brand !== null
      ? (payload.brand as BrandProfile)
      : null;

  const chosenModel = model();
  const timeoutMs = intFromEnv("GEMINI_VISUAL_TIMEOUT_MS", DEFAULT_TIMEOUT_MS);
  const thinkingLevel = thinkingLevelFor(chosenModel);

  const prompt = `${VISUAL_BRIEF}

${brand ? `# The organisation's brand guidelines\n\n${buildBrandBrief(brand)}\n` : ""}
# Images

Image 1 = the APPROVED reference mark.
Image 2 = the CANDIDATE asset to review.

Return JSON matching the schema.`;

  const geminiStartedAt = performance.now();
  let geminiMs = 0;
  let text: string;
  let thoughtTokens: number | null = null;
  let outputTokens: number | null = null;
  let inputTokens: number | null = null;

  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const response = await ai.models.generateContent({
      model: chosenModel,
      contents: createUserContent([
        prompt,
        createPartFromBase64(reference.data, reference.mimeType),
        createPartFromBase64(candidate.data, candidate.mimeType),
      ]),
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: VISUAL_JSON_SCHEMA,
        temperature: 0.2,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        thinkingConfig: { thinkingLevel },
        abortSignal: AbortSignal.timeout(timeoutMs),
        httpOptions: { timeout: timeoutMs, retryOptions: { attempts: 1 } },
      },
    });
    geminiMs = performance.now() - geminiStartedAt;

    thoughtTokens = response.usageMetadata?.thoughtsTokenCount ?? null;
    outputTokens = response.usageMetadata?.candidatesTokenCount ?? null;
    inputTokens = response.usageMetadata?.promptTokenCount ?? null;

    if (response.candidates?.[0]?.finishReason === "MAX_TOKENS") {
      return fail(
        "output-truncated",
        "Gemini hit the output limit before finishing the comparison.",
        502,
        "Try smaller images, or lower GEMINI_THINKING_LEVEL.",
      );
    }

    text = typeof response.text === "string" ? response.text : "";
    if (!text.trim()) {
      return fail(
        "empty-model-response",
        "Gemini returned an empty response for these images.",
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
      /DEADLINE_EXCEEDED|Deadline expired|abort|timed? ?out/i.test(raw)
    ) {
      return fail(
        "timeout",
        `Gemini did not respond within ${Math.round(timeoutMs / 1000)} seconds, so the visual audit was abandoned after ${(geminiMs / 1000).toFixed(1)}s.`,
        504,
        "Try smaller images, or raise GEMINI_VISUAL_TIMEOUT_MS in .env.local.",
      );
    }
    if (/high demand|UNAVAILABLE|overloaded|503/i.test(raw)) {
      return fail(
        "model-overloaded",
        `Gemini reports that "${chosenModel}" is currently overloaded.`,
        503,
        "Capacity on Google's side. Try again shortly, or set a different GEMINI_MODEL.",
      );
    }
    if (/RESOURCE_EXHAUSTED|quota|rate limit|429/i.test(raw)) {
      return fail("rate-limited", "Gemini rate limit or quota reached.", 429, "Wait a moment and run it again.");
    }
    if (/API[_ ]?key|PERMISSION_DENIED|UNAUTHENTICATED|401|403/i.test(raw)) {
      return fail("invalid-api-key", "Gemini rejected the API key.", 502, "Check GEMINI_API_KEY in .env.local.");
    }
    if (/NOT_FOUND|not found|is not supported|404/i.test(raw)) {
      return fail(
        "unknown-model",
        `Gemini does not recognise the model "${chosenModel}", or it cannot read images.`,
        502,
        `Set GEMINI_MODEL to a vision-capable model, e.g. ${DEFAULT_MODEL}.`,
      );
    }
    return fail("upstream-error", `Gemini request failed: ${raw}`, 502);
  }

  let parsed;
  try {
    parsed = parseVisualPayload(JSON.parse(text));
  } catch (error) {
    const reason =
      error instanceof InvalidVisualResponse ? error.message : "Response was not valid JSON.";
    return fail(
      "invalid-model-response",
      `Gemini's reply did not match the expected format. ${reason}`,
      502,
      "Run the comparison again.",
    );
  }

  const counts = SEVERITY_ORDER.reduce(
    (acc, severity) => {
      acc[severity] = parsed.findings.filter((f) => f.severity === severity).length;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0 } as Record<Severity, number>,
  );

  const totalMs = performance.now() - startedAt;
  console.log(
    `[visual] model=${chosenModel} thinkingLevel=${thinkingLevel} ` +
      `gemini=${(geminiMs / 1000).toFixed(2)}s ours=${((totalMs - geminiMs) / 1000).toFixed(3)}s ` +
      `findings=${parsed.findings.length} tokens(in/out/thinking)=${inputTokens ?? "?"}/${outputTokens ?? "?"}/${thoughtTokens ?? "?"}`,
  );

  return Response.json({
    ok: true,
    model: chosenModel,
    summary: parsed.summary,
    findings: parsed.findings,
    counts,
    score: scoreFromFindings(parsed.findings),
    scoreRationale: explainScore(parsed.findings),
    timings: {
      geminiMs: Math.round(geminiMs),
      ourMs: Math.round(totalMs - geminiMs),
      totalMs: Math.round(totalMs),
    },
    usage: { inputTokens, outputTokens, thoughtTokens, thinkingLevel },
  });
}
