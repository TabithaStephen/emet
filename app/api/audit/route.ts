import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import {
  AUDIT_JSON_SCHEMA,
  InvalidModelResponse,
  locateFindings,
  parseAuditPayload,
} from "@/lib/ai/contract";
import { buildAuditPrompt } from "@/lib/ai/build-prompt";
import { explainScore, scoreFromFindings } from "@/lib/audit-engine";
import { SEVERITY_ORDER, type BrandProfile, type Severity } from "@/lib/types";

/**
 * Server-side audit endpoint.
 *
 * The Gemini key is read from the server environment and never leaves it — the
 * browser posts the draft and the brand rules here, and gets findings back. The
 * key is not in any client bundle, and this file is never imported by one.
 */

/**
 * Fastest Stable model for this job.
 *
 * Google describes `gemini-3.5-flash-lite` as "our fastest, most cost-effective
 * 3.5 model for high-throughput execution", and it defaults to MINIMAL thinking.
 * `gemini-3.8-flash` — the previous default — is documented as a model "for
 * software engineering, autonomous agents, and complex enterprise workflows"
 * and runs thinking at MEDIUM by default, which is why audits took minutes.
 * Brand compliance is extraction against an explicit rule list, not open
 * reasoning, so the lighter model is the right tool.
 *
 * Never `gemini-2.5-*`: deprecated, auto-routes elsewhere from 1 Dec 2026.
 */
const DEFAULT_MODEL = "gemini-3.5-flash-lite";

/**
 * Serverless execution budget, in seconds.
 *
 * Without this, a host applies its own default — 10 seconds on Vercel's Hobby
 * plan — and kills the function mid-audit, long before our own 45s ceiling and
 * its clear error message ever fire. Set above GEMINI_TIMEOUT_MS so our timeout
 * wins the race and the user gets a usable message instead of a dead request.
 */
export const maxDuration = 60;

const MAX_DRAFT_CHARS = 20000;

/**
 * Hard ceiling on one audit. Beyond this the request is abandoned and the user
 * gets a clear timeout rather than a spinner that never resolves.
 */
const DEFAULT_TIMEOUT_MS = 45_000;

/**
 * Thinking control for Gemini 3.x and 4.
 *
 * `thinkingBudget` is the WRONG knob here and was the bug in the previous
 * attempt at this: Google's docs state "For Gemini 4 and Gemini 3 models, use
 * thinkingLevel instead of thinkingBudget", so a budget of 0 was accepted and
 * silently ignored while the model kept thinking at its default level.
 *
 * Thinking also cannot be fully disabled on these models. MINIMAL is the floor
 * where supported — but the docs are explicit that on `gemini-3.8-flash`
 * "minimal is not supported and returns an error", so that family gets LOW
 * instead ("fewest tokens, lowest latency" of the levels it accepts).
 */
function thinkingLevelFor(model: string): ThinkingLevel {
  const override = process.env.GEMINI_THINKING_LEVEL?.trim().toUpperCase();
  if (override && override in ThinkingLevel) {
    return ThinkingLevel[override as keyof typeof ThinkingLevel];
  }
  // 3.6 / 3.8 Flash reject MINIMAL; LOW is their floor.
  if (/gemini-3\.(6|8)-flash/.test(model)) return ThinkingLevel.LOW;
  return ThinkingLevel.MINIMAL;
}

/**
 * Output ceiling. Thinking tokens are billed as output and count against this,
 * and the docs warn that hitting the cap mid-reasoning returns
 * `finish_reason: MAX_TOKENS` with truncated or empty text. 60 findings at
 * ~300 characters is about 4.5k tokens, so this leaves room for both.
 */
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

function apiKey(): string | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  return key ? key : null;
}

function fail(code: string, message: string, status: number, hint?: string) {
  return Response.json({ ok: false, code, message, hint }, { status });
}

/**
 * Configuration probe, plus an optional latency probe.
 *
 * `GET /api/audit` reports configuration only — no network call, so the UI can
 * show the setup notice before the user wastes a click.
 *
 * `GET /api/audit?probe=1` additionally sends the smallest possible request to
 * Gemini and times it. That isolates the cause of a slow audit: if a five-token
 * "say OK" also takes 40 seconds, the problem is the network, the region or the
 * quota rather than our prompt.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const wantsProbe = params.get("probe") === "1";

  if (wantsProbe) {
    const key = apiKey();
    if (!key) {
      return fail(
        "missing-api-key",
        "No Gemini API key is configured, so latency cannot be probed.",
        503,
        "Add GEMINI_API_KEY to .env.local and restart the dev server.",
      );
    }
    // ?model=… lets a slow model be compared against a fast one without
    // editing .env.local. Diagnostics only; the audit itself uses GEMINI_MODEL.
    const chosen = params.get("model")?.trim() || model();
    const level = thinkingLevelFor(chosen);
    const timeoutMs = intFromEnv("GEMINI_TIMEOUT_MS", DEFAULT_TIMEOUT_MS);
    const startedAt = performance.now();
    try {
      const ai = new GoogleGenAI({ apiKey: key });
      const response = await ai.models.generateContent({
        model: chosen,
        contents: "Reply with the single word OK.",
        config: {
          maxOutputTokens: 2048,
          thinkingConfig: { thinkingLevel: level },
          abortSignal: AbortSignal.timeout(timeoutMs),
          httpOptions: { timeout: timeoutMs, retryOptions: { attempts: 1 } },
        },
      });
      const ms = Math.round(performance.now() - startedAt);
      console.log(
        `[probe] model=${chosen} thinkingLevel=${level} latency=${(ms / 1000).toFixed(2)}s ` +
          `thinking=${response.usageMetadata?.thoughtsTokenCount ?? "?"}`,
      );
      return Response.json({
        ok: true,
        probe: true,
        model: chosen,
        thinkingLevel: level,
        latencyMs: ms,
        reply: (response.text ?? "").slice(0, 40),
        usage: {
          inputTokens: response.usageMetadata?.promptTokenCount ?? null,
          outputTokens: response.usageMetadata?.candidatesTokenCount ?? null,
          thoughtTokens: response.usageMetadata?.thoughtsTokenCount ?? null,
        },
      });
    } catch (error) {
      const ms = Math.round(performance.now() - startedAt);
      const raw = error instanceof Error ? error.message : String(error);
      const name = error instanceof Error ? error.name : "";
      const code =
        name === "TimeoutError" ||
        name === "AbortError" ||
        /DEADLINE_EXCEEDED|Deadline expired/i.test(raw)
          ? "timeout"
          : /high demand|UNAVAILABLE|overloaded|503/i.test(raw)
            ? "model-overloaded"
          : /RESOURCE_EXHAUSTED|quota|rate limit|429/i.test(raw)
            ? "rate-limited"
            : /API[_ ]?key|PERMISSION_DENIED|UNAUTHENTICATED|401|403/i.test(raw)
              ? "invalid-api-key"
              : /NOT_FOUND|not found|is not supported|404/i.test(raw)
                ? "unknown-model"
                : "upstream-error";
      return Response.json(
        { ok: false, probe: true, code, model: chosen, latencyMs: ms, message: raw },
        { status: 502 },
      );
    }
  }

  return Response.json({
    ok: true,
    configured: apiKey() !== null,
    model: model(),
    timeoutMs: intFromEnv("GEMINI_TIMEOUT_MS", DEFAULT_TIMEOUT_MS),
    thinkingLevel: thinkingLevelFor(model()),
  });
}

/** Narrow runtime check on the posted brand profile. */
function isBrandProfile(value: unknown): value is BrandProfile {
  if (typeof value !== "object" || value === null) return false;
  const b = value as Record<string, unknown>;
  return (
    typeof b.identity === "object" &&
    b.identity !== null &&
    typeof b.voice === "object" &&
    b.voice !== null &&
    Array.isArray(b.terminology) &&
    Array.isArray(b.prohibitedClaims) &&
    Array.isArray(b.approvedFacts) &&
    typeof b.messaging === "object" &&
    b.messaging !== null
  );
}

export async function POST(request: Request) {
  const startedAt = performance.now();

  // 1. Configuration ------------------------------------------------------
  const key = apiKey();
  if (!key) {
    return fail(
      "missing-api-key",
      "No Gemini API key is configured on the server, so no AI audit was run.",
      503,
      "Create .env.local with GEMINI_API_KEY=your-key and restart the dev server.",
    );
  }

  // 2. Input --------------------------------------------------------------
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("bad-request", "Request body was not valid JSON.", 400);
  }

  const payload = body as Record<string, unknown>;
  const draft = typeof payload.text === "string" ? payload.text : "";
  const channel = typeof payload.channel === "string" ? payload.channel : "Unspecified";

  if (!draft.trim()) {
    return fail("bad-request", "No draft text was supplied.", 400);
  }
  if (draft.length > MAX_DRAFT_CHARS) {
    return fail(
      "draft-too-long",
      `Draft is ${draft.length} characters; the limit is ${MAX_DRAFT_CHARS}.`,
      413,
      "Audit a section at a time.",
    );
  }
  if (!isBrandProfile(payload.brand)) {
    return fail("bad-request", "Brand profile was missing or malformed.", 400);
  }

  const brand = payload.brand;
  const chosenModel = model();

  // 3. The model call -----------------------------------------------------
  const timeoutMs = intFromEnv("GEMINI_TIMEOUT_MS", DEFAULT_TIMEOUT_MS);
  const thinkingLevel = thinkingLevelFor(chosenModel);

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
      contents: buildAuditPrompt(brand, draft, channel),
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: AUDIT_JSON_SCHEMA,
        temperature: 0.2,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        // thinkingLevel, not thinkingBudget — see thinkingLevelFor().
        thinkingConfig: { thinkingLevel },
        // Hard stop, so a hung request cannot spin indefinitely.
        abortSignal: AbortSignal.timeout(timeoutMs),
        httpOptions: {
          timeout: timeoutMs,
          /*
           * No retries. The SDK defaults to FIVE attempts with 1s/2s/4s/8s
           * backoff on 408, 429 and 5xx, which turns a rate-limited key into
           * minutes of silent waiting and then a timeout that hides the real
           * cause. One attempt means a 429 surfaces immediately as a 429.
           */
          retryOptions: { attempts: 1 },
        },
      },
    });
    geminiMs = performance.now() - geminiStartedAt;

    // Thinking tokens are the thing to watch: they are billed as output and are
    // where the latency went. Reporting them makes the cause visible.
    thoughtTokens = response.usageMetadata?.thoughtsTokenCount ?? null;
    outputTokens = response.usageMetadata?.candidatesTokenCount ?? null;
    inputTokens = response.usageMetadata?.promptTokenCount ?? null;

    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason === "MAX_TOKENS") {
      return fail(
        "output-truncated",
        `Gemini hit the ${MAX_OUTPUT_TOKENS}-token output limit before finishing, so the reply was unusable.`,
        502,
        "Audit a shorter section, or lower GEMINI_THINKING_LEVEL so fewer tokens go on reasoning.",
      );
    }

    text = typeof response.text === "string" ? response.text : "";
    if (!text.trim()) {
      return fail(
        "empty-model-response",
        "Gemini returned an empty response. This can happen if the draft tripped a safety filter, or if the reply was cut off by the output limit.",
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
      // Gemini's own server-side deadline. Reported as HTTP 504 in the body.
      /DEADLINE_EXCEEDED|Deadline expired/i.test(raw)
    ) {
      return fail(
        "timeout",
        `Gemini did not respond within ${Math.max(1, Math.round(timeoutMs / 1000))} second${timeoutMs >= 2000 ? "s" : ""}, so the audit was abandoned after ${(geminiMs / 1000).toFixed(1)}s.`,
        504,
        "Switch to a faster model: set GEMINI_MODEL=gemini-3.5-flash-lite in .env.local and restart. Compare models with /api/audit?probe=1&model=…",
      );
    }

    // Map the common cases to something a user can act on, without echoing
    // anything that might carry the key back to the browser.
    if (/API[_ ]?key|API key not valid|PERMISSION_DENIED|UNAUTHENTICATED|401|403/i.test(raw)) {
      return fail(
        "invalid-api-key",
        "Gemini rejected the API key.",
        502,
        "Check GEMINI_API_KEY in .env.local, then restart the dev server.",
      );
    }
    if (/NOT_FOUND|not found|is not supported|404/i.test(raw)) {
      return fail(
        "unknown-model",
        `Gemini does not recognise the model "${chosenModel}".`,
        502,
        `Set GEMINI_MODEL in .env.local to a current model, e.g. ${DEFAULT_MODEL}.`,
      );
    }
    if (/high demand|UNAVAILABLE|overloaded|503/i.test(raw)) {
      return fail(
        "model-overloaded",
        `Gemini reports that "${chosenModel}" is currently overloaded, so the audit could not run.`,
        503,
        "This is capacity on Google's side, not your draft. Set GEMINI_MODEL=gemini-3.5-flash-lite in .env.local and restart — it is the fastest Stable model and far less contended.",
      );
    }
    if (/RESOURCE_EXHAUSTED|quota|rate limit|429/i.test(raw)) {
      return fail(
        "rate-limited",
        "Gemini rate limit or quota reached.",
        429,
        "Wait a moment and run the audit again.",
      );
    }
    return fail("upstream-error", `Gemini request failed: ${raw}`, 502);
  }

  // 4. Validate the response ---------------------------------------------
  let parsed;
  try {
    parsed = parseAuditPayload(JSON.parse(text));
  } catch (error) {
    const reason =
      error instanceof InvalidModelResponse
        ? error.message
        : "Response was not valid JSON.";
    return fail(
      "invalid-model-response",
      `Gemini's reply did not match the expected format. ${reason}`,
      502,
      "Run the audit again; if it keeps happening, try a different GEMINI_MODEL.",
    );
  }

  // 5. Grade it ourselves -------------------------------------------------
  const findings = locateFindings(draft, parsed.findings);
  const counts = SEVERITY_ORDER.reduce(
    (acc, severity) => {
      acc[severity] = findings.filter((f) => f.severity === severity).length;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0 } as Record<Severity, number>,
  );

  const unlocated = findings.filter((f) => f.start === -1).length;
  const totalMs = performance.now() - startedAt;

  // One line per audit, so the real split is visible in the dev terminal.
  console.log(
    `[audit] model=${chosenModel} thinkingLevel=${thinkingLevel} ` +
      `gemini=${(geminiMs / 1000).toFixed(2)}s ours=${((totalMs - geminiMs) / 1000).toFixed(3)}s ` +
      `total=${(totalMs / 1000).toFixed(2)}s findings=${findings.length} ` +
      `tokens(in/out/thinking)=${inputTokens ?? "?"}/${outputTokens ?? "?"}/${thoughtTokens ?? "?"}`,
  );

  return Response.json({
    ok: true,
    engine: "gemini",
    model: chosenModel,
    summary: parsed.summary,
    findings,
    counts,
    score: scoreFromFindings(findings),
    scoreRationale: explainScore(findings),
    wordCount: draft.trim() ? draft.trim().split(/\s+/).length : 0,
    unlocated,
    timings: {
      geminiMs: Math.round(geminiMs),
      ourMs: Math.round(totalMs - geminiMs),
      totalMs: Math.round(totalMs),
    },
    usage: {
      inputTokens,
      outputTokens,
      thoughtTokens,
      thinkingLevel,
    },
  });
}
