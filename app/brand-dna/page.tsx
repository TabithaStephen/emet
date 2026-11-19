import { Suspense } from "react";
import { connection } from "next/server";
import { BrandDnaStudio } from "@/components/brand/brand-dna-studio";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody } from "@/components/ui/panel";

/**
 * Server shell for the Brand DNA Studio.
 *
 * Mirrors `app/audit/page.tsx`: reads the Gemini configuration at request time
 * and passes down only whether a key exists — the key itself never reaches the
 * client bundle. `connection()` keeps this out of the prerender so adding the
 * key to .env.local takes effect on reload rather than needing a rebuild, and
 * the Suspense boundary gives `cacheComponents` a static shell to serve while
 * that request-time read happens.
 */

function Loading() {
  return (
    <div className="space-y-12">
      <PageHeader
        eyebrow="Brand DNA Studio"
        title="The rules every audit is measured against."
        description="Edit any field and the AI Audit Studio immediately uses the new rules."
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
  return <BrandDnaStudio configured={configured} />;
}

export default function BrandDnaPage() {
  return (
    <Suspense fallback={<Loading />}>
      <StudioWithConfig />
    </Suspense>
  );
}
