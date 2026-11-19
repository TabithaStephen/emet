"use client";

import { useRef, useState } from "react";
import {
  AlertIcon,
  CheckIcon,
  DocumentIcon,
  TrashIcon,
  UndoIcon,
  UploadIcon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { RULE_KIND_LABEL } from "@/lib/ai/doc-contract";
import {
  MAX_IMPORTED_RULES,
  mergeImportedRules,
  undoLastImport,
  useBrand,
  type MergeOutcome,
} from "@/lib/brand-store";
import { MAX_PDF_BYTES, MAX_PDF_PAGES } from "@/lib/pdf/inspect-pdf";
import { pdfFileToPayload } from "@/lib/pdf/pdf-payload";
import type { ExtractedRule, ExtractedRuleKind } from "@/lib/types";

/**
 * Import brand rules from a PDF.
 *
 * Nothing reaches the Brand DNA without a person approving it. Gemini proposes;
 * this screen lets the user edit every rule, untick the ones that are wrong,
 * and see the verbatim line each rule came from before anything is saved. The
 * merge that follows is append-only and reversible.
 *
 * The file is posted to `/api/brand-doc`, which holds the API key. The browser
 * never sees it.
 */

/** Above the server's own 50s ceiling, so the server's clearer error wins. */
const CLIENT_TIMEOUT_MS = 70_000;

interface ImportError {
  code: string;
  message: string;
  hint?: string;
}

interface ExtractionResult {
  document: { name: string; bytes: number; pages: number | null; title?: string };
  notes: string;
  rules: ExtractedRule[];
  model: string;
  timings: { geminiMs: number; totalMs: number };
}

/** A rule in the review table: the proposal, plus what the reviewer did to it. */
interface Candidate extends ExtractedRule {
  accepted: boolean;
  /** The summary as edited. The source quote is never editable. */
  edited: string;
}

const KIND_TONE: Record<ExtractedRuleKind, string> = {
  "prohibited-claim": "text-critical border-critical/40 bg-critical/10",
  "approved-fact": "text-positive border-positive/40 bg-positive/10",
  terminology: "text-activity border-activity/40 bg-activity/10",
  voice: "text-accent border-accent/30 bg-accent/10",
  tone: "text-accent border-accent/30 bg-accent/10",
  messaging: "text-analysis border-analysis/40 bg-analysis/10",
  visual: "text-turquoise border-turquoise/40 bg-turquoise/10",
};

function KindBadge({ kind }: { kind: ExtractedRuleKind }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[0.6rem] uppercase tracking-[0.1em] ${KIND_TONE[kind]}`}
    >
      {RULE_KIND_LABEL[kind]}
    </span>
  );
}

export function DocumentImport({ configured }: { configured: boolean }) {
  const { brand } = useBrand();
  const inputRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ImportError | null>(null);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [merged, setMerged] = useState<MergeOutcome | null>(null);
  const [undone, setUndone] = useState(false);

  const reset = () => {
    setError(null);
    setResult(null);
    setCandidates([]);
    setMerged(null);
    setUndone(false);
  };

  const handleFile = async (file: File) => {
    reset();
    setBusy(true);
    try {
      const payload = await pdfFileToPayload(file);

      const response = await fetch("/api/brand-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        setError({
          code: data?.code ?? "unknown",
          message: data?.message ?? `The upload failed with status ${response.status}.`,
          hint: data?.hint,
        });
        return;
      }

      setResult({
        document: data.document,
        notes: data.notes ?? "",
        rules: data.rules ?? [],
        model: data.model,
        timings: data.timings ?? { geminiMs: 0, totalMs: 0 },
      });
      setCandidates(
        (data.rules as ExtractedRule[]).map((rule) => ({
          ...rule,
          accepted: true,
          edited: rule.summary,
        })),
      );
    } catch (caught) {
      const aborted =
        caught instanceof DOMException &&
        (caught.name === "TimeoutError" || caught.name === "AbortError");
      setError(
        aborted
          ? {
              code: "timeout",
              message: `Reading the document did not finish within ${Math.round(CLIENT_TIMEOUT_MS / 1000)} seconds, so it was stopped.`,
              hint: "Try a shorter document.",
            }
          : {
              code: "client",
              message:
                caught instanceof Error ? caught.message : "That file could not be read.",
            },
      );
    } finally {
      setBusy(false);
      // Let the same file be picked again after a failure.
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const toggle = (id: string) =>
    setCandidates((rows) =>
      rows.map((row) => (row.id === id ? { ...row, accepted: !row.accepted } : row)),
    );

  const edit = (id: string, edited: string) =>
    setCandidates((rows) => rows.map((row) => (row.id === id ? { ...row, edited } : row)));

  const acceptedRows = candidates.filter((row) => row.accepted && row.edited.trim());

  const applyMerge = () => {
    if (!result || acceptedRows.length === 0) return;
    const outcome = mergeImportedRules(
      acceptedRows.map(({ accepted, edited, ...rule }) => {
        void accepted;
        return { ...rule, summary: edited.trim() };
      }),
      {
        id: `d${Date.now().toString(36)}`,
        name: result.document.name,
        bytes: result.document.bytes,
        pages: result.document.pages,
        importedAt: new Date().toISOString(),
        acceptedRules: 0,
      },
    );
    setMerged(outcome);
    setUndone(false);
  };

  const undo = () => {
    undoLastImport();
    setUndone(true);
    setMerged(null);
  };

  /* ---- not configured -------------------------------------------------- */
  if (!configured) {
    return (
      <Panel>
        <PanelHeader
          eyebrow="Document import"
          title="Import rules from a brand guidelines PDF."
          description="Upload the document your organisation already has, and êmet reads the rules out of it."
        />
        <PanelBody className="space-y-4">
          <div className="flex items-start gap-3 rounded-md border border-accent/30 bg-accent/10 px-4 py-3.5">
            <AlertIcon width={16} height={16} className="mt-0.5 shrink-0 text-accent" />
            <div className="min-w-0 space-y-2 text-xs leading-relaxed text-accent">
              <p>
                Reading a document needs Gemini, and no API key is configured on
                the server. Nothing is imported until one is.
              </p>
              <p className="text-foreground-muted">
                Add{" "}
                <code className="rounded bg-background-secondary px-1.5 py-0.5 font-mono text-[0.7rem] text-foreground">
                  GEMINI_API_KEY=your-key
                </code>{" "}
                to <span className="font-mono text-[0.7rem]">.env.local</span> and
                restart the dev server.
              </p>
            </div>
          </div>
          <p className="text-xs leading-relaxed text-foreground-muted">
            Every other section of the Brand DNA Studio works without a key — you
            can write the rules in by hand below.
          </p>
        </PanelBody>
      </Panel>
    );
  }

  /* ---- the importer ---------------------------------------------------- */
  return (
    <Panel>
      <PanelHeader
        eyebrow="Document import"
        title="Import rules from a brand guidelines PDF."
        description="Gemini reads the document and proposes rules. You review and edit every one before anything is saved — nothing is added on its own."
        action={
          brand.documents.length > 0 ? (
            <span className="text-xs text-foreground-muted">
              {brand.documents.length} document
              {brand.documents.length === 1 ? "" : "s"} imported
            </span>
          ) : null
        }
      />
      <PanelBody className="space-y-6">
        {/* Picker */}
        <div className="flex flex-wrap items-center gap-4">
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <Button
            size="sm"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? "Reading the document…" : "Choose a PDF"}
            {busy ? null : <UploadIcon width={15} height={15} />}
          </Button>
          <p className="text-xs leading-relaxed text-foreground-muted">
            PDF only, up to {MAX_PDF_BYTES / 1024 / 1024}MB and {MAX_PDF_PAGES} pages.
            The file is read on the server and never stored.
          </p>
        </div>

        {busy ? (
          <div className="flex items-center gap-3 rounded-md border border-border bg-background-secondary px-4 py-3.5">
            <span
              aria-hidden
              className="h-3 w-3 shrink-0 animate-pulse rounded-full bg-accent"
            />
            <p className="text-xs leading-relaxed text-foreground-muted">
              Reading every page and extracting the rules. This usually takes
              five to twenty seconds.
            </p>
          </div>
        ) : null}

        {/* Error */}
        {error ? (
          <div className="flex items-start gap-3 rounded-md border border-critical/40 bg-critical/10 px-4 py-3.5">
            <AlertIcon width={16} height={16} className="mt-0.5 shrink-0 text-critical" />
            <div className="min-w-0 space-y-1.5">
              <p className="text-sm leading-relaxed text-critical">{error.message}</p>
              {error.hint ? (
                <p className="text-xs leading-relaxed text-foreground-muted">{error.hint}</p>
              ) : null}
              <p className="font-mono text-[0.65rem] text-foreground-muted/70">
                {error.code}
              </p>
            </div>
          </div>
        ) : null}

        {/* Nothing readable — stated plainly, never padded out */}
        {result && result.rules.length === 0 ? (
          <div className="flex items-start gap-3 rounded-md border border-border bg-background-secondary px-4 py-3.5">
            <DocumentIcon width={16} height={16} className="mt-0.5 shrink-0 text-silver" />
            <div className="min-w-0 space-y-1.5">
              <p className="text-sm leading-relaxed text-foreground">
                No brand rules could be read from {result.document.name}.
              </p>
              <p className="text-xs leading-relaxed text-foreground-muted">
                {result.notes}
              </p>
              <p className="text-xs leading-relaxed text-foreground-muted/80">
                Nothing has been added. If this document does contain rules, it
                may be a scan too faint to read, or the rules may be in an
                appendix worth uploading on its own.
              </p>
            </div>
          </div>
        ) : null}

        {/* Review table */}
        {result && candidates.length > 0 && !merged ? (
          <div className="space-y-5">
            <div className="rounded-md border border-border bg-background-secondary px-4 py-3.5">
              <p className="text-sm leading-relaxed text-foreground">
                {candidates.length} rule{candidates.length === 1 ? "" : "s"} found in{" "}
                <span className="text-accent">{result.document.name}</span>
                {result.document.pages
                  ? ` · ${result.document.pages} page${result.document.pages === 1 ? "" : "s"}`
                  : ""}{" "}
                ·{" "}
                {(result.timings.geminiMs / 1000).toFixed(1)}s
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-foreground-muted">
                {result.notes}
              </p>
            </div>

            <p className="text-xs leading-relaxed text-foreground-muted">
              Edit any rule, or untick it to leave it out. The quoted line under
              each one is what the document actually says, and is kept as
              evidence — it cannot be edited.
            </p>

            <ul className="space-y-3">
              {candidates.map((row) => (
                <li
                  key={row.id}
                  className={`rounded-md border p-4 transition-colors duration-200 ${
                    row.accepted
                      ? "border-border bg-background-secondary"
                      : "border-border/50 bg-background-secondary/40 opacity-55"
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    <input
                      type="checkbox"
                      checked={row.accepted}
                      onChange={() => toggle(row.id)}
                      aria-label={`Include this ${RULE_KIND_LABEL[row.kind].toLowerCase()} rule`}
                      className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
                    />
                    <div className="min-w-0 flex-1 space-y-2.5">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <KindBadge kind={row.kind} />
                        {row.page ? (
                          <span className="text-[0.65rem] text-foreground-muted">
                            page {row.page}
                          </span>
                        ) : null}
                      </div>

                      <textarea
                        value={row.edited}
                        rows={2}
                        disabled={!row.accepted}
                        onChange={(e) => edit(row.id, e.target.value)}
                        aria-label="Rule wording"
                        className="w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm leading-relaxed text-foreground transition-colors duration-200 focus:border-accent/60 focus:outline-none disabled:opacity-60"
                      />

                      {row.avoid && row.prefer ? (
                        <p className="font-mono text-[0.7rem] text-foreground-muted">
                          avoid <span className="text-critical">{row.avoid}</span> → prefer{" "}
                          <span className="text-positive">{row.prefer}</span>
                        </p>
                      ) : null}

                      <blockquote className="border-l-2 border-accent/30 pl-3.5 text-xs leading-relaxed text-foreground-muted">
                        {row.sourceQuote}
                      </blockquote>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
              <p className="text-xs leading-relaxed text-foreground-muted">
                {acceptedRows.length} of {candidates.length} selected. Adding them
                never overwrites a rule you already have.
              </p>
              <div className="flex gap-3">
                <Button variant="ghost" size="sm" onClick={reset}>
                  Discard
                </Button>
                <Button size="sm" disabled={acceptedRows.length === 0} onClick={applyMerge}>
                  Add {acceptedRows.length} rule{acceptedRows.length === 1 ? "" : "s"} to Brand DNA
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Merged */}
        {merged ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-md border border-positive/40 bg-positive/10 px-4 py-3.5">
              <CheckIcon width={16} height={16} className="mt-0.5 shrink-0 text-positive" />
              <div className="min-w-0 space-y-1.5">
                <p className="text-sm leading-relaxed text-positive">
                  {merged.added} rule{merged.added === 1 ? "" : "s"} added to the
                  Brand DNA.
                </p>
                <p className="text-xs leading-relaxed text-foreground-muted">
                  Terminology, prohibited claims and approved facts have joined
                  their sections below, where you can edit or delete them as
                  normal. Voice, tone, messaging and visual rules are listed
                  under Imported rules. Every audit from now on uses them.
                </p>
                {merged.duplicates > 0 ? (
                  <p className="text-xs leading-relaxed text-foreground-muted">
                    {merged.duplicates} were already present and were left
                    untouched rather than duplicated.
                  </p>
                ) : null}
                {merged.overflow > 0 ? (
                  <p className="text-xs leading-relaxed text-foreground-muted">
                    {merged.overflow} could not be added: the imported-rule limit
                    of {MAX_IMPORTED_RULES} was reached. Remove some first.
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" size="sm" onClick={undo}>
                <UndoIcon width={15} height={15} />
                Undo this import
              </Button>
              <Button variant="ghost" size="sm" onClick={reset}>
                Import another document
              </Button>
            </div>
          </div>
        ) : null}

        {undone ? (
          <div className="flex items-start gap-3 rounded-md border border-border bg-background-secondary px-4 py-3.5">
            <UndoIcon width={16} height={16} className="mt-0.5 shrink-0 text-silver" />
            <p className="text-sm leading-relaxed text-foreground-muted">
              Import undone. The Brand DNA is exactly as it was before.
            </p>
          </div>
        ) : null}

        {/* Documents already imported */}
        {brand.documents.length > 0 && !result ? (
          <div className="space-y-2.5 border-t border-border pt-5">
            <h3 className="text-[0.65rem] font-medium uppercase tracking-[0.18em] text-accent/80">
              Imported documents
            </h3>
            <ul className="space-y-2">
              {brand.documents.map((doc) => (
                <li
                  key={doc.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-background-secondary px-4 py-3"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <DocumentIcon width={15} height={15} className="shrink-0 text-silver" />
                    <span className="truncate text-sm text-foreground">{doc.name}</span>
                  </span>
                  <span className="text-xs text-foreground-muted">
                    {doc.acceptedRules} rule{doc.acceptedRules === 1 ? "" : "s"} ·{" "}
                    {(doc.bytes / 1024).toFixed(0)}KB
                    {doc.pages ? ` · ${doc.pages} page${doc.pages === 1 ? "" : "s"}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </PanelBody>
    </Panel>
  );
}

/** The imported rules that have no native section, with a way to remove them. */
export function ImportedRulesSection({ onRemove }: { onRemove: (id: string) => void }) {
  const { brand } = useBrand();
  if (brand.importedRules.length === 0) return null;

  return (
    <Panel>
      <PanelHeader
        eyebrow="From your documents"
        title="Imported rules"
        description="Voice, tone, messaging and visual rules read out of uploaded documents. These are sent to the reviewer with every audit, alongside the sections above."
      />
      <PanelBody>
        <ul className="space-y-3">
          {brand.importedRules.map((rule) => (
            <li
              key={rule.id}
              className="rounded-md border border-border bg-background-secondary p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <KindBadge kind={rule.kind} />
                    {rule.sourceDoc ? (
                      <span className="truncate text-[0.65rem] text-foreground-muted">
                        {rule.sourceDoc}
                        {rule.page ? `, page ${rule.page}` : ""}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm leading-relaxed text-foreground">{rule.summary}</p>
                  <blockquote className="border-l-2 border-accent/30 pl-3.5 text-xs leading-relaxed text-foreground-muted">
                    {rule.sourceQuote}
                  </blockquote>
                </div>
                <button
                  onClick={() => onRemove(rule.id)}
                  aria-label="Remove this imported rule"
                  className="shrink-0 rounded p-1.5 text-foreground-muted transition-colors duration-200 hover:bg-surface-elevated hover:text-critical"
                >
                  <TrashIcon width={15} height={15} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </PanelBody>
    </Panel>
  );
}
