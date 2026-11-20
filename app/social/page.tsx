import { Suspense } from "react";
import { connection } from "next/server";
import { SocialStudio } from "@/components/social/social-studio";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody } from "@/components/ui/panel";

/**
 * Server shell for the Social Studio.
 *
 * Mirrors the Audit Studio: reads the Gemini configuration at request time and
 * passes down only whether a key exists and which model is selected. The key
 * itself never reaches the client bundle.
 */
function Loading() {
  return (
    <div className="space-y-12">
      <PageHeader
        eyebrow="Social Readiness"
        title="Check a post before it goes out."
        description="Brand consistency and platform readiness, assessed separately."
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
  return <SocialStudio configured={configured} model={model} />;
}

export default function SocialPage() {
  return (
    <Suspense fallback={<Loading />}>
      <StudioWithConfig />
    </Suspense>
  );
}
