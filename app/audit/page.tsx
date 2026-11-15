import { Suspense } from "react";
import { connection } from "next/server";
import { AuditStudio } from "@/components/audit/audit-studio";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody } from "@/components/ui/panel";

/**
 * Server shell for the Audit Studio.
 *
 * Reads the Gemini configuration at request time and passes down only whether a
 * key exists and which model is selected — the key itself never reaches the
 * client bundle. `connection()` keeps this out of the prerender so that adding
 * the key to .env.local takes effect on reload rather than needing a rebuild,
 * and the Suspense boundary gives `cacheComponents` a static shell to serve
 * while that request-time read happens.
 */

function Loading() {
  return (
    <div className="space-y-12">
      <PageHeader
        eyebrow="AI Audit Studio"
        title="Review content against the brand rules."
        description="Paste a draft and êmet checks it against the Brand DNA you have defined."
      />
      <Panel>
        <PanelBody className="py-24 text-center text-sm text-foreground-muted">
          Loading the studio…
        </PanelBody>
      </Panel>
    </div>
  );
}

async function StudioWithConfig() {
  await connection();

  const configured = Boolean(process.env.GEMINI_API_KEY?.trim());
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite";

  return <AuditStudio configured={configured} model={model} />;
}

export default function AuditStudioPage() {
  return (
    <Suspense fallback={<Loading />}>
      <StudioWithConfig />
    </Suspense>
  );
}
