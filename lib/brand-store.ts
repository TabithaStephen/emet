"use client";

import { useSyncExternalStore } from "react";
import { DEMO_BRAND } from "@/lib/demo-data";
import type { BrandProfile } from "@/lib/types";

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
      brand = { ...DEMO_BRAND, ...(JSON.parse(raw) as BrandProfile) };
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

/** Read the brand profile from any client component. */
export function useBrand(): BrandState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
