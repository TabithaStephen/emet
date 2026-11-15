import { Suspense } from "react";
import { connection } from "next/server";
import { VisualCompliance } from "@/components/visual/visual-compliance";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody } from "@/components/ui/panel";

/** Server shell: reads whether Gemini is configured, same as the text studio. */
async function WithConfig() {
  await connection();
  const configured = Boolean(process.env.GEMINI_API_KEY?.trim());
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite";
  return <VisualCompliance configured={configured} model={model} />;
}

export default function VisualCompliancePage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-12">
          <PageHeader
            eyebrow="Visual Brand Compliance"
            title="Compare artwork against the approved mark."
            description="Loading…"
          />
          <Panel>
            <PanelBody className="py-24 text-center text-sm text-foreground-muted">
              Loading…
            </PanelBody>
          </Panel>
        </div>
      }
    >
      <WithConfig />
    </Suspense>
  );
}
