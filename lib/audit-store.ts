"use client";

import { useSyncExternalStore } from "react";
import { contentHashOf } from "@/lib/history/fingerprint";
import type { ReviewStatus, SavedAudit } from "@/lib/types";

const STORAGE_KEY = "emet.audits.v1";
const MAX_STORED = 50;

/**
 * Saved audits and their review state, kept in this browser.
 *
 * Same external-store pattern as the brand profile: `useSyncExternalStore`
 * renders the server snapshot during hydration and swaps to stored data
 * immediately afterwards, so history survives a reload without a hydration
 * mismatch and without setting state inside an effect.
 *
 * This is deliberately localStorage for now — no database, no auth. It means
 * history is per-browser and per-device, which is the honest limitation of the
 * current phase.
 *
 * Every completed audit is saved here the moment it finishes, as a `draft`.
 * Submitting for review UPDATES that same record rather than writing a second
 * one, so a piece of content never appears twice in history and its id,
 * timestamp, content and lineage survive the transition.
 */

const EMPTY: SavedAudit[] = [];

/**
 * Whether the last write reached storage, and whether history is now full.
 *
 * Saving used to fail silently, which was tolerable when the user pressed
 * Submit and could see the result. Now that every finished audit is saved
 * automatically, a silent failure would leave someone believing their history
 * was being kept when nothing was being written at all. The status is exposed
 * so the UI can say so.
 */
export interface StorageStatus {
  /** False when the last attempt to write to localStorage failed. */
  persisted: boolean;
  /** Why it failed, in plain words. Null when it did not. */
  error: string | null;
  /** True once the cap is reached and the oldest record is being dropped. */
  atCapacity: boolean;
  /** How many records have been dropped in this session because of the cap. */
  dropped: number;
}

const OK_STATUS: StorageStatus = {
  persisted: true,
  error: null,
  atCapacity: false,
  dropped: 0,
};

let state: SavedAudit[] = EMPTY;
let status: StorageStatus = OK_STATUS;
let initialised = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function setStatus(next: Partial<StorageStatus>) {
  const merged = { ...status, ...next };
  // Keep the reference stable when nothing actually changed, because
  // useSyncExternalStore compares snapshots by identity.
  if (
    merged.persisted === status.persisted &&
    merged.error === status.error &&
    merged.atCapacity === status.atCapacity &&
    merged.dropped === status.dropped
  ) {
    return;
  }
  status = merged;
}

/**
 * Writes the history to localStorage, reporting rather than swallowing failure.
 *
 * A quota error is the one that matters: the session keeps working from memory,
 * but nothing is being kept, and the user needs to know that before they close
 * the tab.
 */
function persist() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setStatus({ persisted: true, error: null });
  } catch (error) {
    const quota =
      error instanceof DOMException &&
      (error.name === "QuotaExceededError" ||
        error.name === "NS_ERROR_DOM_QUOTA_REACHED");
    setStatus({
      persisted: false,
      error: quota
        ? "This browser's storage is full, so the most recent audit could not be saved. Delete some older audits to make room."
        : "This browser blocked saving, so audit history will not survive a reload.",
    });
  }
}

/**
 * Brings a stored record up to the current shape.
 *
 * Records saved before audit history existed carry none of the lineage or
 * fingerprint fields. What can be recomputed is filled in; what cannot is left
 * undefined, which downstream code reads as "unknown" rather than as a
 * mismatch.
 *
 * `brandHash` is the one that deliberately stays empty: we cannot know which
 * Brand DNA an old audit was judged against, and inventing one would let a
 * comparison claim a score change was caused by the writing when there is no
 * evidence for that. Unknown is the truthful answer.
 */
/**
 * Whether a stored row is a coherent audit result.
 *
 * The line is drawn between a record that is INCOMPLETE and one that is
 * INCOHERENT. A missing title, content, lineage or hash is incomplete: the
 * audit still happened, so `migrate` repairs it and the record is kept, along
 * with any approval decision on it. An outcome with no findings array or no
 * numeric score is incoherent — this application could never have written it,
 * nothing can render it, and keeping it would crash the screens that try.
 *
 * Erring either way costs something, so the rule is deliberately narrow:
 * discard only what cannot be made to work.
 */
function isUsableRecord(row: unknown): row is SavedAudit {
  if (typeof row !== "object" || row === null) return false;
  const r = row as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.status !== "string") return false;
  const outcome = r.outcome as Record<string, unknown> | undefined;
  return (
    typeof outcome === "object" &&
    outcome !== null &&
    Array.isArray(outcome.findings) &&
    typeof outcome.score === "number"
  );
}

/** Rebuilds severity counts from the findings themselves. */
function countsFrom(findings: SavedAudit["outcome"]["findings"]) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const finding of findings) {
    if (finding && finding.severity in counts) counts[finding.severity] += 1;
  }
  return counts;
}

function migrate(row: SavedAudit): SavedAudit {
  const needsLineage = typeof row.lineageId !== "string";
  const needsHash = typeof row.contentHash !== "string";
  /*
   * A record with no `text` is repaired rather than discarded.
   *
   * Dropping it would destroy an audit — its findings, its score and any
   * approval decision on it — because of one missing field. Migration must
   * never lose a record, so the content becomes an empty string and the audit
   * survives; the rest of the app already handles empty content.
   */
  const needsText = typeof row.text !== "string";
  /*
   * Counts can be rebuilt exactly from the findings — that is how they were
   * produced in the first place — so a record missing them is repaired rather
   * than discarded. This is recomputation, not invention.
   */
  const needsCounts =
    typeof row.outcome?.counts !== "object" || row.outcome.counts === null;

  if (
    !needsLineage &&
    !needsHash &&
    !needsText &&
    !needsCounts &&
    typeof row.version === "number"
  ) {
    return row;
  }

  const text = needsText ? "" : row.text;
  return {
    ...row,
    text,
    outcome: needsCounts
      ? { ...row.outcome, counts: countsFrom(row.outcome.findings) }
      : row.outcome,
    // An old record stands alone: there is no record of what it revised.
    lineageId: needsLineage ? row.id : row.lineageId,
    version: typeof row.version === "number" ? row.version : 1,
    contentHash: needsHash ? contentHashOf(text) : row.contentHash,
  };
}

/**
 * Reads stored history once, before anything touches `state`.
 *
 * EVERY mutator must call this first. `state` starts empty and is only filled
 * on the first read, so a write that ran before any component had subscribed
 * would operate on an empty array and then persist it — silently erasing the
 * stored history. That became reachable as soon as audits began saving
 * themselves on completion rather than on a button press.
 */
function ensureLoaded() {
  if (initialised) return;
  initialised = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Stored data is untrusted — it may be from an older shape.
      if (Array.isArray(parsed)) {
        state = parsed.filter(isUsableRecord).map(migrate);
        setStatus({ atCapacity: state.length >= MAX_STORED });
      }
    }
  } catch {
    state = EMPTY;
  }
}

function subscribe(listener: () => void) {
  ensureLoaded();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): SavedAudit[] {
  ensureLoaded();
  return state;
}

function getServerSnapshot(): SavedAudit[] {
  return EMPTY;
}

/**
 * Saves a new audit, or replaces one with the same id.
 *
 * Called the moment an audit completes, with status "draft". Submission goes
 * through `updateAudit` instead, so a submitted audit keeps the id, timestamp
 * and lineage it was given here rather than becoming a second record.
 */
export function saveAudit(audit: SavedAudit) {
  ensureLoaded();
  const next = [audit, ...state.filter((a) => a.id !== audit.id)];
  const dropped = Math.max(0, next.length - MAX_STORED);
  state = next.slice(0, MAX_STORED);
  if (dropped > 0) {
    setStatus({ atCapacity: true, dropped: status.dropped + dropped });
  } else {
    setStatus({ atCapacity: state.length >= MAX_STORED });
  }
  persist();
  emit();
}

/**
 * Updates one stored audit in place.
 *
 * Position, id and `createdAt` are preserved, and `text` is never touched: the
 * findings were computed against that exact content, so replacing it would
 * leave a record whose findings point at words that are no longer in it.
 * Returns false when no record with that id exists.
 */
export function updateAudit(
  id: string,
  patch: Partial<Omit<SavedAudit, "id" | "createdAt" | "text">>,
): boolean {
  ensureLoaded();
  let found = false;
  state = state.map((audit) => {
    if (audit.id !== id) return audit;
    found = true;
    return { ...audit, ...patch, id: audit.id, createdAt: audit.createdAt, text: audit.text };
  });
  if (!found) return false;
  persist();
  emit();
  return true;
}

/**
 * Marks a saved audit as submitted for review.
 *
 * Idempotent on purpose: pressing Submit twice, or submitting something that
 * has already been decided, must not create a second record or quietly reset a
 * decision an approver has already made.
 */
export function submitAudit(
  id: string,
  outcome?: SavedAudit["outcome"],
): "submitted" | "already-submitted" | "not-found" {
  ensureLoaded();
  const existing = state.find((a) => a.id === id);
  if (!existing) return "not-found";
  if (existing.status !== "draft") return "already-submitted";
  updateAudit(id, {
    status: "in-review",
    reviewedAt: null,
    reviewNote: null,
    ...(outcome ? { outcome } : {}),
  });
  return "submitted";
}

export function setAuditStatus(
  id: string,
  status: ReviewStatus,
  reviewNote: string | null = null,
) {
  ensureLoaded();
  state = state.map((audit) =>
    audit.id === id
      ? {
          ...audit,
          status,
          reviewNote,
          reviewedAt: status === "in-review" ? null : new Date().toISOString(),
        }
      : audit,
  );
  persist();
  emit();
}

export function deleteAudit(id: string) {
  ensureLoaded();
  state = state.filter((audit) => audit.id !== id);
  setStatus({ atCapacity: state.length >= MAX_STORED });
  persist();
  emit();
}

export function clearAudits() {
  // Mark as loaded so a later read cannot resurrect what was just cleared.
  initialised = true;
  state = EMPTY;
  status = OK_STATUS;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
  emit();
}

/** Read the saved audits from any client component. */
export function useAudits(): SavedAudit[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function newAuditId(): string {
  return `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** A fresh content lineage, for an audit that revises nothing. */
export function newLineageId(): string {
  return `L${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** The storage cap, so the UI can explain it rather than just hit it. */
export const HISTORY_LIMIT = MAX_STORED;

function getStatus(): StorageStatus {
  ensureLoaded();
  return status;
}

function getServerStatus(): StorageStatus {
  return OK_STATUS;
}

/**
 * Whether history is actually being saved, and whether it is full.
 * Shares the store's listeners, so it updates with every write.
 */
export function useStorageStatus(): StorageStatus {
  return useSyncExternalStore(subscribe, getStatus, getServerStatus);
}

/** Relative time, good enough for a review queue. */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "unknown";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
