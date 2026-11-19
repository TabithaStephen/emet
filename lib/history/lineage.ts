import type { SavedAudit } from "@/lib/types";

/**
 * Groups stored audits into content lineages.
 *
 * A lineage is the set of audits that are versions of one piece of content.
 * Membership is never inferred: it comes from `lineageId`, which the author
 * sets explicitly when the audit is run. Titles are deliberately not used —
 * they are free text, so matching on them would silently pair two unrelated
 * drafts that happen to share a name, and would break a lineage the moment
 * somebody renamed a version.
 */

export interface Lineage {
  id: string;
  /** The most recent version's title, which is what people will recognise. */
  title: string;
  /** Newest first. */
  versions: SavedAudit[];
  latest: SavedAudit;
  /** True once there is something to compare. */
  comparable: boolean;
}

/** An audit with no lineage recorded stands alone, keyed by its own id. */
export function lineageIdOf(audit: SavedAudit): string {
  return audit.lineageId ?? audit.id;
}

export function versionOf(audit: SavedAudit): number {
  return typeof audit.version === "number" ? audit.version : 1;
}

/** Groups audits into lineages, newest activity first. */
export function lineagesOf(audits: SavedAudit[]): Lineage[] {
  const byLineage = new Map<string, SavedAudit[]>();
  for (const audit of audits) {
    const key = lineageIdOf(audit);
    const bucket = byLineage.get(key);
    if (bucket) bucket.push(audit);
    else byLineage.set(key, [audit]);
  }

  const lineages: Lineage[] = [];
  for (const [id, group] of byLineage) {
    // Highest version first; fall back to recency when versions tie.
    const versions = [...group].sort(
      (a, b) =>
        versionOf(b) - versionOf(a) ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    lineages.push({
      id,
      title: versions[0].title,
      versions,
      latest: versions[0],
      comparable: versions.length > 1,
    });
  }

  return lineages.sort(
    (a, b) =>
      new Date(b.latest.createdAt).getTime() - new Date(a.latest.createdAt).getTime(),
  );
}

/** The version number a new audit joining this lineage should take. */
export function nextVersionFor(audits: SavedAudit[], lineageId: string): number {
  const highest = audits
    .filter((audit) => lineageIdOf(audit) === lineageId)
    .reduce((max, audit) => Math.max(max, versionOf(audit)), 0);
  return highest + 1;
}

/** The versions of one lineage, oldest first — the order a history reads in. */
export function versionsInOrder(audits: SavedAudit[], lineageId: string): SavedAudit[] {
  return audits
    .filter((audit) => lineageIdOf(audit) === lineageId)
    .sort(
      (a, b) =>
        versionOf(a) - versionOf(b) ||
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
}

/**
 * The pair a comparison should default to: the two most recent versions.
 * Returns null when the lineage has only one version, which the UI must say
 * rather than filling with something fabricated.
 */
export function defaultComparisonPair(
  audits: SavedAudit[],
  lineageId: string,
): { before: SavedAudit; after: SavedAudit } | null {
  const ordered = versionsInOrder(audits, lineageId);
  if (ordered.length < 2) return null;
  return {
    before: ordered[ordered.length - 2],
    after: ordered[ordered.length - 1],
  };
}
