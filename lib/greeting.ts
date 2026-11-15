"use client";

import { useSyncExternalStore } from "react";

/**
 * Time-of-day greeting, from the viewer's own clock.
 *
 * Read through `useSyncExternalStore` rather than an effect, for two reasons.
 * The server has no idea what time it is where the viewer is, so
 * `getServerSnapshot` returns null and the component renders a neutral line
 * until hydration finishes — no hydration mismatch, and no setState inside an
 * effect, which the project's lint rules forbid. The subscription also re-fires
 * on the hour, so a dashboard left open overnight does not still say
 * "Good evening" at breakfast.
 */

export type Daypart = "morning" | "afternoon" | "evening";

/**
 * Morning 05:00–11:59 · Afternoon 12:00–16:59 · Evening 17:00–04:59.
 * Exported for tests.
 */
export function daypartFor(hour: number): Daypart {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  return "evening";
}

const GREETING: Record<Daypart, string> = {
  morning: "Good morning",
  afternoon: "Good afternoon",
  evening: "Good evening",
};

export function greetingFor(hour: number): string {
  return GREETING[daypartFor(hour)];
}

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;

/** Wakes once, just after the next hour turns, then reschedules. */
function scheduleNextHour() {
  if (timer !== null) return;
  const now = new Date();
  const msUntilNextHour =
    (60 - now.getMinutes()) * 60_000 - now.getSeconds() * 1000 + 1_000;
  timer = setTimeout(() => {
    timer = null;
    listeners.forEach((listener) => listener());
    if (listeners.size > 0) scheduleNextHour();
  }, msUntilNextHour);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  scheduleNextHour();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };
}

/**
 * Returns the same string for a given hour, so React's identity check is stable
 * between renders and this does not loop.
 */
function getSnapshot(): string {
  return greetingFor(new Date().getHours());
}

/** The server cannot know the viewer's local hour, so it renders nothing. */
function getServerSnapshot(): null {
  return null;
}

/** `null` until the browser has hydrated; a greeting thereafter. */
export function useGreeting(): string | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
