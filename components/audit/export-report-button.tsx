"use client";

import { useState } from "react";
import { DocumentIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useBrand } from "@/lib/brand-store";
import { buildReportModel } from "@/lib/report/report-model";
import type { SavedAudit } from "@/lib/types";

/**
 * Exports one audit as a PDF.
 *
 * The renderer and jsPDF are loaded on demand, so neither is in the bundle
 * until somebody actually exports something. Rendering happens entirely in the
 * browser: the audit content never leaves the device to become a report.
 *
 * `audit` is the real record — the same object the Approval Workspace stores —
 * so the report cannot show anything the audit did not produce.
 */
export function ExportReportButton({
  audit,
  variant = "secondary",
  label = "Export PDF report",
}: {
  audit: Omit<SavedAudit, "id">;
  variant?: "primary" | "secondary" | "ghost";
  label?: string;
}) {
  const { brand } = useBrand();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const { downloadAuditReport } = await import("@/lib/report/render-report");
      await downloadAuditReport(buildReportModel(audit, brand.identity.name));
    } catch (caught) {
      // A failed export says so; it never leaves a silent dead button.
      setError(
        caught instanceof Error
          ? `The report could not be generated: ${caught.message}`
          : "The report could not be generated.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex flex-col items-end gap-1.5">
      <Button variant={variant} size="sm" disabled={busy} onClick={run}>
        {busy ? "Preparing…" : label}
        {busy ? null : <DocumentIcon width={15} height={15} />}
      </Button>
      {error ? (
        <span role="alert" className="text-right text-xs leading-relaxed text-critical">
          {error}
        </span>
      ) : null}
    </span>
  );
}
