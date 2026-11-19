import { SEVERITY_ORDER, type ReviewStatus, type SavedAudit, type Severity } from "@/lib/types";

/**
 * Search and filtering for audit history.
 *
 * Pure functions over the stored records, so the list can be tested without a
 * browser and the page component stays presentational.
 */

export type DateWindow = "all" | "24h" | "7d" | "30d";

export interface HistoryFilters {
  query: string;
  status: ReviewStatus | "all";
  severity: Severity | "all";
  channel: string | "all";
  /** Which window is selected. Kept for the control's label. */
  window: DateWindow;
  /**
   * The absolute cutoff the window resolves to, in epoch milliseconds, or null
   * for "any time".
   *
   * Deliberately an absolute instant rather than a clock read at filter time.
   * Reading `Date.now()` while rendering is an unstable value that Next
   * refuses to prerender, and anchoring the window when the user chooses it is
   * also better behaviour: the boundary stays put instead of sliding under
   * them while they read the list.
   */
  windowFrom: number | null;
}

export const EMPTY_FILTERS: HistoryFilters = {
  query: "",
  status: "all",
  severity: "all",
  channel: "all",
  window: "all",
  windowFrom: null,
};

export const DATE_WINDOW_LABEL: Record<DateWindow, string> = {
  all: "Any time",
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
};

const WINDOW_MS: Record<Exclude<DateWindow, "all">, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

/**
 * Resolves a window to an absolute cutoff. Call this from the event handler
 * that changes the filter, never during render.
 */
export function cutoffFor(window: DateWindow, now: number = Date.now()): number | null {
  return window === "all" ? null : now - WINDOW_MS[window];
}

/** Channels actually present in the history, so the filter offers only real options. */
export function channelsIn(audits: SavedAudit[]): string[] {
  return [...new Set(audits.map((a) => a.channel).filter(Boolean))].sort();
}

/** True when the audit contains at least one finding of this severity. */
function hasSeverity(audit: SavedAudit, severity: Severity): boolean {
  return (audit.outcome.counts[severity] ?? 0) > 0;
}

/**
 * Applies every active filter.
 *
 * Search matches the title and the audited content, because people look for a
 * phrase they remember writing as often as they look for a title.
 */
export function filterAudits(
  audits: SavedAudit[],
  filters: HistoryFilters,
): SavedAudit[] {
  const query = filters.query.trim().toLowerCase();

  return audits.filter((audit) => {
    if (filters.status !== "all" && audit.status !== filters.status) return false;
    if (filters.channel !== "all" && audit.channel !== filters.channel) return false;
    if (filters.severity !== "all" && !hasSeverity(audit, filters.severity)) return false;

    if (filters.windowFrom !== null) {
      const at = new Date(audit.createdAt).getTime();
      // An unparseable date is kept rather than silently hidden.
      if (Number.isFinite(at) && at < filters.windowFrom) return false;
    }

    if (query) {
      const haystack = `${audit.title}\n${audit.text}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

export function isFiltered(filters: HistoryFilters): boolean {
  return (
    filters.query.trim() !== "" ||
    filters.status !== "all" ||
    filters.severity !== "all" ||
    filters.channel !== "all" ||
    filters.window !== "all"
  );
}

/** The most serious severity present, for the row badge. */
export function topSeverityOf(audit: SavedAudit): Severity | null {
  return SEVERITY_ORDER.find((s) => (audit.outcome.counts[s] ?? 0) > 0) ?? null;
}
