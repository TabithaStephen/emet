"use client";

import Image from "next/image";
import Link from "next/link";
import { ListEditor, RowInput } from "@/components/brand/list-editor";
import { Button } from "@/components/ui/button";
import { TextAreaField, TextField } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { DemoTag } from "@/components/ui/data";
import { TagInput } from "@/components/ui/tag-input";
import { resetBrand, updateBrand, useBrand } from "@/lib/brand-store";
import { APPROVED_ASSETS } from "@/lib/demo-assets";

const newId = () => `x${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export default function BrandDnaPage() {
  const { brand, savedAt, hydrated } = useBrand();

  return (
    <div className="space-y-12">
      <PageHeader
        eyebrow="Brand DNA Studio"
        title="The rules every audit is measured against."
        description="Edit any field and the AI Audit Studio immediately uses the new rules. Changes are saved in this browser only — nothing is sent anywhere."
        action={
          <div className="flex items-center gap-4">
            <span className="text-xs text-foreground-muted">
              {!hydrated ? "Loading…" : savedAt ? `Saved ${savedAt}` : "No local edits"}
            </span>
            <Button variant="secondary" size="sm" onClick={resetBrand}>
              Reset to default
            </Button>
          </div>
        }
      />

      {/* 1. Identity ------------------------------------------------------- */}
      <Panel>
        <PanelHeader
          eyebrow="Section one"
          title="Brand identity"
          description="Who the brand is, in the words the organisation has agreed on."
        />
        <PanelBody className="grid gap-6 md:grid-cols-2">
          <TextField
            label="Brand name"
            value={brand.identity.name}
            onChange={(e) =>
              updateBrand({ identity: { ...brand.identity, name: e.target.value } })
            }
          />
          <TextField
            label="Industry"
            value={brand.identity.industry}
            onChange={(e) =>
              updateBrand({ identity: { ...brand.identity, industry: e.target.value } })
            }
          />
          <div className="md:col-span-2">
            <TextField
              label="Tagline"
              value={brand.identity.tagline}
              onChange={(e) =>
                updateBrand({ identity: { ...brand.identity, tagline: e.target.value } })
              }
            />
          </div>
          <div className="md:col-span-2">
            <TextAreaField
              label="Mission"
              rows={2}
              value={brand.identity.mission}
              onChange={(e) =>
                updateBrand({ identity: { ...brand.identity, mission: e.target.value } })
              }
            />
          </div>
          <div className="md:col-span-2">
            <TextAreaField
              label="Primary audience"
              rows={2}
              hint="Used to judge whether tone and reading level are appropriate."
              value={brand.identity.audience}
              onChange={(e) =>
                updateBrand({ identity: { ...brand.identity, audience: e.target.value } })
              }
            />
          </div>
        </PanelBody>
      </Panel>

      {/* 2. Voice ---------------------------------------------------------- */}
      <Panel>
        <PanelHeader
          eyebrow="Section two"
          title="Voice and tone"
          description="How the brand sounds — and the registers it never uses."
        />
        <PanelBody className="space-y-8">
          <TagInput
            label="Voice traits"
            values={brand.voice.personality}
            placeholder="e.g. Measured"
            hint="Press Enter or Add. These appear in reviewer guidance."
            onChange={(personality) =>
              updateBrand({ voice: { ...brand.voice, personality } })
            }
          />
          <div className="grid gap-6 md:grid-cols-2">
            <TextAreaField
              label="Always do"
              rows={4}
              value={brand.voice.toneDo}
              onChange={(e) =>
                updateBrand({ voice: { ...brand.voice, toneDo: e.target.value } })
              }
            />
            <TextAreaField
              label="Never do"
              rows={4}
              value={brand.voice.toneAvoid}
              onChange={(e) =>
                updateBrand({ voice: { ...brand.voice, toneAvoid: e.target.value } })
              }
            />
          </div>
          <TextField
            label="Reading level"
            value={brand.voice.readingLevel}
            onChange={(e) =>
              updateBrand({ voice: { ...brand.voice, readingLevel: e.target.value } })
            }
          />
        </PanelBody>
      </Panel>

      {/* 3. Terminology ---------------------------------------------------- */}
      <Panel>
        <PanelHeader
          eyebrow="Section three"
          title="Approved terminology"
          description="Word-level substitutions. The audit flags the left column and proposes the right."
        />
        <PanelBody>
          <ListEditor
            items={brand.terminology}
            onChange={(terminology) => updateBrand({ terminology })}
            blank={() => ({ id: newId(), avoid: "", prefer: "", note: "" })}
            addLabel="Add a term"
            emptyLabel="No terminology rules yet."
            renderRow={(item, update) => (
              <div className="grid gap-3 sm:grid-cols-2">
                <RowInput
                  label="Avoid"
                  mono
                  value={item.avoid}
                  placeholder="cheap"
                  onChange={(avoid) => update({ avoid })}
                />
                <RowInput
                  label="Prefer"
                  mono
                  value={item.prefer}
                  placeholder="cost-efficient"
                  onChange={(prefer) => update({ prefer })}
                />
                <div className="sm:col-span-2">
                  <RowInput
                    label="Why"
                    value={item.note}
                    placeholder="Reasoning shown to the writer"
                    onChange={(note) => update({ note })}
                  />
                </div>
              </div>
            )}
          />
        </PanelBody>
      </Panel>

      {/* 4. Messaging ------------------------------------------------------ */}
      <Panel>
        <PanelHeader
          eyebrow="Section four"
          title="Messaging guidelines"
          description="The pillars every piece of content should ladder up to."
        />
        <PanelBody className="space-y-8">
          <TagInput
            label="Messaging pillars"
            values={brand.messaging.pillars}
            placeholder="e.g. Evidence over opinion"
            onChange={(pillars) =>
              updateBrand({ messaging: { ...brand.messaging, pillars } })
            }
          />
          <TextAreaField
            label="Approved boilerplate"
            rows={4}
            hint="The standing description of the organisation, used verbatim."
            value={brand.messaging.boilerplate}
            onChange={(e) =>
              updateBrand({
                messaging: { ...brand.messaging, boilerplate: e.target.value },
              })
            }
          />
        </PanelBody>
      </Panel>

      {/* 5. Prohibited claims ---------------------------------------------- */}
      <Panel>
        <PanelHeader
          eyebrow="Section five"
          title="Prohibited claims"
          description="Phrases that must never appear. These produce critical findings."
        />
        <PanelBody>
          <ListEditor
            items={brand.prohibitedClaims}
            onChange={(prohibitedClaims) => updateBrand({ prohibitedClaims })}
            blank={() => ({ id: newId(), phrase: "", reason: "" })}
            addLabel="Add a prohibited claim"
            emptyLabel="No prohibited claims yet."
            renderRow={(item, update) => (
              <div className="space-y-3">
                <RowInput
                  label="Phrase"
                  mono
                  value={item.phrase}
                  placeholder="guaranteed returns"
                  onChange={(phrase) => update({ phrase })}
                />
                <RowInput
                  label="Reason"
                  value={item.reason}
                  placeholder="Why this is prohibited"
                  onChange={(reason) => update({ reason })}
                />
              </div>
            )}
          />
        </PanelBody>
      </Panel>

      {/* 6. Approved facts -------------------------------------------------- */}
      <Panel>
        <PanelHeader
          eyebrow="Section six"
          title="Approved facts"
          description="The only claims a writer may state as fact, each tied to a source."
        />
        <PanelBody>
          <ListEditor
            items={brand.approvedFacts}
            onChange={(approvedFacts) => updateBrand({ approvedFacts })}
            blank={() => ({ id: newId(), statement: "", source: "" })}
            addLabel="Add an approved fact"
            emptyLabel="No approved facts yet."
            renderRow={(item, update) => (
              <div className="space-y-3">
                <RowInput
                  label="Statement"
                  value={item.statement}
                  placeholder="Founded in 1998…"
                  onChange={(statement) => update({ statement })}
                />
                <RowInput
                  label="Source"
                  value={item.source}
                  placeholder="Corporate fact sheet, rev. 14"
                  onChange={(source) => update({ source })}
                />
              </div>
            )}
          />
        </PanelBody>
      </Panel>

      {/* 7. Approved visual assets ------------------------------------------ */}
      <Panel>
        <PanelHeader
          eyebrow="Section seven"
          title="Approved visual assets"
          description="The reference artwork every candidate asset is measured against in Visual Compliance."
          action={<DemoTag>Fictional sample brand</DemoTag>}
        />
        <PanelBody className="space-y-5">
          {APPROVED_ASSETS.map((asset) => (
            <div
              key={asset.id}
              className="flex flex-col gap-5 rounded-md border border-border bg-background-secondary p-5 sm:flex-row sm:items-center"
            >
              <div className="flex h-28 w-full shrink-0 items-center justify-center rounded border border-border bg-white p-3 sm:w-64">
                <Image
                  src={asset.src}
                  alt={asset.label}
                  width={1200}
                  height={420}
                  unoptimized
                  className="max-h-full w-auto object-contain"
                />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm text-foreground">{asset.label}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-foreground-muted">
                  {asset.caption}
                </p>
                <p className="mt-2 font-mono text-[0.7rem] text-foreground-muted/70">
                  {asset.src}
                </p>
              </div>
            </div>
          ))}
          <p className="text-xs leading-relaxed text-foreground-muted">
            Ships with the application, so it is always available.{" "}
            <Link
              href="/visual"
              className="text-accent underline decoration-dotted underline-offset-4"
            >
              Open Visual Compliance
            </Link>{" "}
            to compare artwork against it.
          </p>
        </PanelBody>
      </Panel>
    </div>
  );
}
