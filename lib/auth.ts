"use client";

import { useSyncExternalStore } from "react";
import {
  SESSION_COOKIE,
  decodeSession,
  encodeSession,
  type Session,
} from "@/lib/auth-shared";

/**
 * Browser-side half of the demo session. The pure parts — accounts, roles,
 * cookie name, encode/decode — live in `auth-shared.ts` so the route gate in
 * `proxy.ts` can import them without pulling React in.
 */

export * from "@/lib/auth-shared";

/* ---- client-side session store ---------------------------------------- */

const listeners = new Set<() => void>();
let cached: string | null = null;
let cachedSession: Session | null = null;

function readCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]*)`),
  );
  return match ? match[1] : null;
}

function emit() {
  listeners.forEach((listener) => listener());
}

export function signIn(session: Session) {
  // 12-hour demo session. `SameSite=Lax` so a normal navigation carries it.
  document.cookie = `${SESSION_COOKIE}=${encodeSession(session)}; path=/; max-age=43200; SameSite=Lax`;
  emit();
}

export function signOut() {
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Cached so repeated reads return a stable object for React's identity check. */
function getSnapshot(): Session | null {
  const raw = readCookie();
  if (raw !== cached) {
    cached = raw;
    cachedSession = decodeSession(raw ?? undefined);
  }
  return cachedSession;
}

function getServerSnapshot(): Session | null {
  return null;
}

/** The current session, or null while signed out or before hydration. */
export function useSession(): Session | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
