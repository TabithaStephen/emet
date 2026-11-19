"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { DiffView } from "@/components/history/diff-view";
import { AlertIcon, CheckIcon, DocumentIcon } from "@/components/icons";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { SeverityBadge } from "@/components/ui/severity";
import { StatusPill } from "@/components/ui/status";
import { timeAgo, useAudits } from "@/lib/audit-store";
import { COMPARABILITY_COPY, compareAudits } from "@/lib/history/compare";
import { lineagesOf, versionOf } from "@/lib/history/lineage";
import { SEVERITY_ORDER, type SavedAudit } from "@/lib/types";

/**
 * Side-by-side comparison of two audited versions.
 *
 * Which two is always the caller's explicit choice — through the pickers here
 * or the link from an audit record — never a guess. Everything shown is
 * computed from the two stored records; where the records cannot support a
 * conclusion, the page says so instead of filling the gap.
 */

const selectClass =
  "w-full rounded-md border border-border bg-background-secondary px-3.5 py-2.5 text-sm text-foreground transition-colors duration-200 hover:border-silver/25 focus:border-accent/60 focus:outline-none";

function VersionPicker({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: SavedAudit[];
  onChange: (id: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[0.7rem] font-medium uppercase tracking-[0.14em] text-foreground-muted">
        {label}
      </span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            v{versionOf(option)} · {option.title} · scored {option.outcome.score} ·{" "}
            {timeAgo(option.createdAt)}
          </option>
        ))}
      </select>
    </label>
  );
}

function CompareInner() {
  const audits = useAudits();
  const router = useRouter();
  const params = useSearchParams();

  const beforeId = params.get("before") ?? "";
  const afterId = params.get("after") ?? "";

  const before = audits.find((a) => a.id === beforeId);
  const after = audits.find((a) => a.id === afterId);

  /** Lineages with something to compare. */
  const comparable = useMemo(
    () => lineagesOf(audits).filter((l) => l.comparable),
    [audits],
  );

  const comparison = useMemo(
    () => (before && after ? compareAudits(before, after) : null),
    [before, after],
  );

  const setPair = (nextBefore: string, nextAfter: string) =>
    router.replace(`/history/compare?before=${nextBefore}&after=${nextAfter}`);

  /* ---- nothing to compare -------------------------------------------- */
  if (!before || !after) {
    return (
      <div className="space-y-10">
        <PageHeader
          eyebrow="Compare versions"
          title="Choose two versions to compare."
          description="Comparisons run between two audits of the same content, linked when the audit was created."
        />
        {comparable.length === 0 ? (
          <Panel>
            <PanelBody className="flex flex-col items-center gap-4 py-16 text-center">
              <DocumentIcon width={26} height={26} className="text-silver/50" />
              <h2 className="font-display text-xl text-foreground">
                No content has more than one version yet
              </h2>
              <p className="max-w-lg text-sm leading-relaxed text-foreground-muted">
                A comparison needs two audits of the same piece. In the Audit
                Studio, set <span className="text-accent">Content version</span>{" "}
                to “New version of…” before running the second audit, and the two
                will be linked.
              </p>
              <ButtonLink href="/history" variant="secondary" size="sm">
                Back to Audit History
              </ButtonLink>
            </PanelBody>
          </Panel>
        ) : (
          <Panel>
            <PanelHeader
              eyebrow="Pick a lineage"
              title="Content with more than one version"
            />
            <PanelBody>
              <ul className="divide-y divide-border">
                {comparable.map((lineage) => {
                  const ordered = [...lineage.versions].reverse();
                  const a = ordered[ordered.length - 2];
                  const b = ordered[ordered.length - 1];
                  return (
                    <li key={lineage.id}>
                      <Link
                        href={`/history/compare?before=${a.id}&after=${b.id}`}
                        className="flex flex-wrap items-center justify-between gap-4 px-1 py-4 transition-colors duration-200 hover:bg-surface-elevated/40"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-foreground">
                            {lineage.title}
                          </span>
                          <span className="mt-1 block text-xs text-foreground-muted">
                            {lineage.versions.length} versions · latest scored{" "}
                            {lineage.latest.outcome.score}
                          </span>
                        </span>
                        <span className="text-xs text-accent">
                          Compare v{versionOf(a)} → v{versionOf(b)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </PanelBody>
          </Panel>
        )}
      </div>
    );
  }

  const c = comparison!;
  const lineageVersions = lineagesOf(audits).find(
    (l) => l.versions.some((v) => v.id === before.id),
  )?.versions ?? [before, after];
  const options = [...lineageVersions].sort((x, y) => versionOf(x) - versionOf(y));

  const scoreTone =
    !c.attributable
      ? "text-foreground-muted"
      : c.scoreDelta > 0
        ? "text-positive"
        : c.scoreDelta < 0
          ? "text-critical"
          : "text-foreground-muted";

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Compare versions"
        title={after.title}
        description={`Version ${versionOf(before)} compared with version ${versionOf(after)}.`}
      />

      <Link
        href="/history"
        className="inline-flex items-center gap-2 text-xs text-accent transition-colors duration-200 hover:text-accent/75"
      >
        ← All audits
      </Link>

      {/* Which two */}
      <Panel>
        <PanelBody className="grid gap-5 sm:grid-cols-2">
          <VersionPicker
            label="Earlier version"
            value={before.id}
            options={options}
            onChange={(id) => setPair(id, after.id)}
          />
          <VersionPicker
            label="Later version"
            value={after.id}
            options={options}
            onChange={(id) => setPair(before.id, id)}
          />
        </PanelBody>
      </Panel>

      {/* Anything that weakens the comparison, stated before the figures */}
      {c.issues.length > 0 ? (
        <Panel className={c.attributable ? "border-accent/30" : "border-critical/40"}>
          <PanelBody className="space-y-2.5">
            {c.issues.map((issue) => (
              <p
                key={issue}
                className={`flex items-start gap-3 text-sm leading-relaxed ${
                  issue === "different-brand" ? "text-critical" : "text-accent"
                }`}
              >
                <AlertIcon width={16} height={16} className="mt-0.5 shrink-0" />
                {COMPARABILITY_COPY[issue]}
              </p>
            ))}
          </PanelBody>
        </Panel>
      ) : null}

      {/* Verdict */}
      <Panel>
        <PanelHeader eyebrow="Outcome" title="What changed" />
        <PanelBody className="space-y-7">
          <p className="text-sm leading-relaxed text-foreground">{c.summary}</p>

          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-4">
            <div className="bg-surface px-4 py-3.5">
              <dt className="text-[0.6rem] uppercase tracking-[0.12em] text-foreground-muted">
                Score
              </dt>
              <dd className="mt-1.5 text-lg font-semibold leading-none text-foreground">
                {before.outcome.score} → {after.outcome.score}
              </dd>
              <dd className={`mt-1.5 text-xs ${scoreTone}`}>
                {c.attributable
                  ? `${c.scoreDelta > 0 ? "+" : ""}${c.scoreDelta} points`
                  : "not attributable"}
              </dd>
            </div>
            <div className="bg-surface px-4 py-3.5">
              <dt className="text-[0.6rem] uppercase tracking-[0.12em] text-foreground-muted">
                Resolved
              </dt>
              <dd className="mt-1.5 text-lg font-semibold leading-none text-positive">
                {c.resolved.length}
              </dd>
            </div>
            <div className="bg-surface px-4 py-3.5">
              <dt className="text-[0.6rem] uppercase tracking-[0.12em] text-foreground-muted">
                Still present
              </dt>
              <dd className="mt-1.5 text-lg font-semibold leading-none text-foreground">
                {c.persistent.length}
              </dd>
            </div>
            <div className="bg-surface px-4 py-3.5">
              <dt className="text-[0.6rem] uppercase tracking-[0.12em] text-foreground-muted">
                Newly introduced
              </dt>
              <dd className="mt-1.5 text-lg font-semibold leading-none text-critical">
                {c.introduced.length}
              </dd>
            </div>
          </dl>

          <div>
            <h3 className="mb-4 text-[0.65rem] font-medium uppercase tracking-[0.18em] text-accent/80">
              Findings by severity
            </h3>
            <ul className="divide-y divide-border">
              {SEVERITY_ORDER.map((severity) => {
                const was = before.outcome.counts[severity] ?? 0;
                const now = after.outcome.counts[severity] ?? 0;
                const delta = c.severityDeltas[severity];
                if (was === 0 && now === 0) return null;
                return (
                  <li
                    key={severity}
                    className="flex items-center justify-between gap-4 py-3"
                  >
                    <SeverityBadge severity={severity} />
                    <span className="flex items-center gap-4 text-sm tabular-nums">
                      <span className="text-foreground-muted">
                        {was} → {now}
                      </span>
                      <span
                        className={`w-14 text-right ${
                          delta < 0
                            ? "text-positive"
                            : delta > 0
                              ? "text-critical"
                              : "text-foreground-muted"
                        }`}
                      >
                        {delta > 0 ? "+" : ""}
                        {delta}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </PanelBody>
      </Panel>

      {/* Finding lifecycle */}
      <div className="grid gap-6 xl:grid-cols-3">
        <FindingColumn
          title="Resolved"
          description="Present in the earlier version, gone from the later one."
          tone="positive"
          items={c.resolved.map((f) => ({ key: f.id + f.phrase, finding: f }))}
          emptyLabel="Nothing was resolved between these versions."
        />
        <FindingColumn
          title="Still present"
          description="Raised against both versions."
          tone="neutral"
          items={c.persistent.map((p) => ({
            key: p.after.id + p.after.phrase,
            finding: p.after,
            note: p.severityChanged
              ? `Severity changed from ${p.before.severity} to ${p.after.severity}.`
              : p.samePhrase
                ? undefined
                : "The wording changed but the same rule is still breached.",
          }))}
          emptyLabel="No finding carried over."
        />
        <FindingColumn
          title="Newly introduced"
          description="Absent from the earlier version."
          tone="critical"
          items={c.introduced.map((f) => ({ key: f.id + f.phrase, finding: f }))}
          emptyLabel="The revision introduced nothing new."
        />
      </div>

      {/* Content diff */}
      <Panel>
        <PanelHeader
          eyebrow="Content"
          title="What changed in the text"
          description="Word by word, from the earlier version to the later one."
        />
        <PanelBody>
          <DiffView diff={c.diff} />
        </PanelBody>
      </Panel>

      {/* Provenance */}
      <Panel>
        <PanelHeader eyebrow="Records" title="The two audits being compared" />
        <PanelBody>
          <ul className="divide-y divide-border">
            {[before, after].map((record, index) => (
              <li
                key={record.id}
                className="flex flex-wrap items-center justify-between gap-4 py-3.5"
              >
                <span className="min-w-0">
                  <Link
                    href={`/history/record?id=${record.id}`}
                    className="truncate text-sm text-accent transition-colors duration-200 hover:text-accent/75"
                  >
                    v{versionOf(record)} · {record.title}
                  </Link>
                  <span className="mt-1 block text-xs text-foreground-muted">
                    {index === 0 ? "Earlier" : "Later"} · {record.channel} ·{" "}
                    {record.outcome.engine === "gemini"
                      ? `Gemini ${record.outcome.model ?? ""}`
                      : "Built-in rule check"}{" "}
                    · {timeAgo(record.createdAt)}
                    {record.brandHash ? "" : " · Brand DNA at the time not recorded"}
                  </span>
                </span>
                <StatusPill status={record.status} />
              </li>
            ))}
          </ul>
        </PanelBody>
      </Panel>
    </div>
  );
}

function FindingColumn({
  title,
  description,
  tone,
  items,
  emptyLabel,
}: {
  title: string;
  description: string;
  tone: "positive" | "critical" | "neutral";
  items: Array<{ key: string; finding: import("@/lib/types").Finding; note?: string }>;
  emptyLabel: string;
}) {
  const accent =
    tone === "positive"
      ? "text-positive"
      : tone === "critical"
        ? "text-critical"
        : "text-foreground";

  return (
    <Panel>
      <PanelHeader
        eyebrow={`${items.length}`}
        title={title}
        description={description}
      />
      <PanelBody>
        {items.length === 0 ? (
          <p className="py-6 text-center text-xs leading-relaxed text-foreground-muted">
            {emptyLabel}
          </p>
        ) : (
          <ul className="space-y-4">
            {items.map(({ key, finding, note }) => (
              <li key={key} className="space-y-2 border-l-2 border-border pl-4">
                <div className="flex flex-wrap items-center gap-2.5">
                  <SeverityBadge severity={finding.severity} />
                  {tone === "positive" ? (
                    <CheckIcon width={14} height={14} className="text-positive" />
                  ) : null}
                </div>
                <p className={`text-sm leading-relaxed ${accent}`}>{finding.rule}</p>
                {finding.phrase ? (
                  <p className="font-mono text-[0.7rem] text-foreground-muted">
                    “{finding.phrase}”
                  </p>
                ) : null}
                <p className="text-xs text-foreground-muted">{finding.guidelineRef}</p>
                {note ? <p className="text-xs text-accent">{note}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </PanelBody>
    </Panel>
  );
}

export default function ComparePage() {
  // useSearchParams needs a Suspense boundary during prerender.
  return (
    <Suspense
      fallback={
        <div className="space-y-10">
          <PageHeader
            eyebrow="Compare versions"
            title="Loading…"
            description="Reading the two audits from this browser."
          />
        </div>
      }
    >
      <CompareInner />
    </Suspense>
  );
}
