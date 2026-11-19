"use client";

import { Suspense } from "react";
import { HistoryDetail } from "@/components/history/history-detail";
import { PageHeader } from "@/components/ui/page-header";

/**
 * One audit record, addressed by `?id=`.
 *
 * A query parameter rather than a dynamic `/history/[id]` segment on purpose.
 * The shared app shell reads `usePathname()`, which has no stable value while
 * prerendering a path that is not known until the request, so a dynamic
 * segment would force the whole layout to render at request time. A static
 * path with a search parameter keeps the shell prerenderable, and the record
 * is read from this browser anyway — these URLs were never shareable.
 */
export default function HistoryRecordPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-10">
          <PageHeader
            eyebrow="Audit record"
            title="Loading…"
            description="Reading this audit from your browser's history."
          />
        </div>
      }
    >
      <HistoryDetail />
    </Suspense>
  );
}
