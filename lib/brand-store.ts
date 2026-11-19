"use client";

import { useSyncExternalStore } from "react";
import { DEMO_BRAND } from "@/lib/demo-data";
import type {
  ApprovedFact,
  BrandDocument,
  BrandProfile,
  ExtractedRule,
  ProhibitedClaim,
  TerminologyRule,
} from "@/lib/types";

const STORAGE_KEY = "emet.brand-profile.v1";

export interface BrandState {
  brand: BrandProfile;
  /** Time of the last successful save, or null if nothing is stored. */
  savedAt: string | null;
  /** False during server render and hydration, true once storage has been read. */
  hydrated: boolean;
}

/**
 * A tiny external store rather than context + effects.
 *
 * `useSyncExternalStore` renders the server snapshot during hydration and swaps
 * to the stored snapshot immediately afterwards, so saved edits survive a reload
 * without a hydration mismatch and without setting state inside an effect.
 */

const SERVER_STATE: BrandState = {
  brand: DEMO_BRAND,
  savedAt: null,
  hydrated: false,
};

let state: BrandState = SERVER_STATE;
let initialised = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function stamp(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Idempotent: reads localStorage once, on the first client snapshot. */
function ensureLoaded() {
  if (initialised) return;
  initialised = true;

  let brand = DEMO_BRAND;
  let savedAt: string | null = null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const stored = JSON.parse(raw) as Partial<BrandProfile>;
      brand = {
        ...DEMO_BRAND,
        ...stored,
        /*
         * Both arrays post-date the first stored shape, and the spread above
         * is shallow, so a profile saved before they existed would carry
         * DEMO_BRAND's defaults — but one saved WITH the key explicitly unset
         * would carry undefined and crash on .map(). Normalise both.
         */
        importedRules: Array.isArray(stored.importedRules) ? stored.importedRules : [],
        documents: Array.isArray(stored.documents) ? stored.documents : [],
      };
      savedAt = stamp();
    }
  } catch {
    // Private browsing or blocked storage: carry on with the demo profile.
  }
  state = { brand, savedAt, hydrated: true };
}

function subscribe(listener: () => void) {
  ensureLoaded();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): BrandState {
  ensureLoaded();
  return state;
}

function getServerSnapshot(): BrandState {
  return SERVER_STATE;
}

export function updateBrand(patch: Partial<BrandProfile>) {
  const brand = { ...state.brand, ...patch };
  let savedAt: string | null = null;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(brand));
    savedAt = stamp();
  } catch {
    // Edits still apply for this session; they just will not persist.
  }
  state = { brand, savedAt, hydrated: true };
  emit();
}

export function resetBrand() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
  state = { brand: DEMO_BRAND, savedAt: null, hydrated: true };
  emit();
}


/* ---- imported brand documents ----------------------------------------- */

/**
 * Total ceiling on imported rules with no native home.
 *
 * Every one of these is sent with EVERY later audit, so this is a cost and
 * latency control, not just a tidiness one. The three native kinds are exempt:
 * they land in the lists already on the page, where they are visible and the
 * user can delete them with the editors they already know.
 */
export const MAX_IMPORTED_RULES = 40;

/** One step of undo, held for this session only. Never persisted. */
let previousBrand: BrandProfile | null = null;

export interface MergeOutcome {
  added: number;
  /** Rules skipped because the same rule was already present. */
  duplicates: number;
  /** Rules skipped because MAX_IMPORTED_RULES was reached. */
  overflow: number;
}

const norm = (value: string) => value.trim().toLowerCase();

/**
 * Appends accepted rules to the Brand DNA. APPEND ONLY.
 *
 * Nothing existing is ever modified or removed: terminology, prohibited claims
 * and approved facts are pushed onto their native lists, everything else onto
 * `importedRules`. A rule that matches one already present is skipped rather
 * than written over, and the whole operation is reversible with
 * `undoLastImport` for as long as the page stays open.
 *
 * This is the guarantee that importing a document can never silently cost the
 * user rules they wrote by hand.
 */
export function mergeImportedRules(
  rules: ExtractedRule[],
  document: BrandDocument,
): MergeOutcome {
  previousBrand = state.brand;

  const terminology: TerminologyRule[] = [...state.brand.terminology];
  const prohibitedClaims: ProhibitedClaim[] = [...state.brand.prohibitedClaims];
  const approvedFacts: ApprovedFact[] = [...state.brand.approvedFacts];
  const importedRules: ExtractedRule[] = [...state.brand.importedRules];

  let added = 0;
  let duplicates = 0;
  let overflow = 0;

  for (const rule of rules) {
    const sourceDoc = document.name;

    if (rule.kind === "terminology" && rule.avoid && rule.prefer) {
      if (terminology.some((t) => norm(t.avoid) === norm(rule.avoid!))) {
        duplicates += 1;
        continue;
      }
      terminology.push({
        id: rule.id,
        avoid: rule.avoid,
        prefer: rule.prefer,
        note: rule.summary,
        sourceDoc,
      });
      added += 1;
      continue;
    }

    if (rule.kind === "prohibited-claim") {
      if (prohibitedClaims.some((c) => norm(c.phrase) === norm(rule.summary))) {
        duplicates += 1;
        continue;
      }
      prohibitedClaims.push({
        id: rule.id,
        // The quote is the phrase as the document wrote it; the summary is the
        // reviewer-facing reason.
        phrase: rule.sourceQuote,
        reason: rule.summary,
        sourceDoc,
      });
      added += 1;
      continue;
    }

    if (rule.kind === "approved-fact") {
      if (approvedFacts.some((f) => norm(f.statement) === norm(rule.summary))) {
        duplicates += 1;
        continue;
      }
      approvedFacts.push({
        id: rule.id,
        statement: rule.summary,
        source: `${sourceDoc}${rule.page ? `, p.${rule.page}` : ""}`,
        sourceDoc,
      });
      added += 1;
      continue;
    }

    // voice, tone, messaging, visual — no native list.
    if (importedRules.some((r) => norm(r.summary) === norm(rule.summary))) {
      duplicates += 1;
      continue;
    }
    if (importedRules.length >= MAX_IMPORTED_RULES) {
      overflow += 1;
      continue;
    }
    importedRules.push({ ...rule, sourceDoc });
    added += 1;
  }

  updateBrand({
    terminology,
    prohibitedClaims,
    approvedFacts,
    importedRules,
    documents: [{ ...document, acceptedRules: added }, ...state.brand.documents].slice(0, 20),
  });

  return { added, duplicates, overflow };
}

/** True while the last import can still be rolled back. */
export function canUndoImport(): boolean {
  return previousBrand !== null;
}

/** Restores the profile exactly as it was before the last merge. */
export function undoLastImport() {
  if (!previousBrand) return;
  const restore = previousBrand;
  previousBrand = null;
  updateBrand(restore);
}

/** Removes one imported rule from the narrative list. */
export function removeImportedRule(id: string) {
  updateBrand({ importedRules: state.brand.importedRules.filter((r) => r.id !== id) });
}

/** Read the brand profile from any client component. */
export function useBrand(): BrandState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
