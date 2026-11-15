"use client";

import { useSyncExternalStore } from "react";
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
 */

const EMPTY: SavedAudit[] = [];

let state: SavedAudit[] = EMPTY;
let initialised = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function persist() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked: the session keeps working, it just will not persist.
  }
}

function ensureLoaded() {
  if (initialised) return;
  initialised = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Stored data is untrusted — it may be from an older shape.
      if (Array.isArray(parsed)) {
        state = parsed.filter(
          (row): row is SavedAudit =>
            typeof row === "object" &&
            row !== null &&
            typeof row.id === "string" &&
            typeof row.status === "string" &&
            typeof row.outcome === "object" &&
            row.outcome !== null &&
            Array.isArray(row.outcome.findings),
        );
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

export function saveAudit(audit: SavedAudit) {
  state = [audit, ...state.filter((a) => a.id !== audit.id)].slice(0, MAX_STORED);
  persist();
  emit();
}

export function setAuditStatus(
  id: string,
  status: ReviewStatus,
  reviewNote: string | null = null,
) {
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
  state = state.filter((audit) => audit.id !== id);
  persist();
  emit();
}

export function clearAudits() {
  state = EMPTY;
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
