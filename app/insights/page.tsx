"use client";

import { HBarChart } from "@/components/charts/h-bar-chart";
import { LineChart } from "@/components/charts/line-chart";
import { ScoreDial } from "@/components/charts/score-dial";
import { SeverityDistribution } from "@/components/charts/severity-distribution";
import { DemoTag, StatTile } from "@/components/ui/data";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import {
  CHANNEL_TONES,
  DEMO_SCORE_TREND,
  deriveSeverityTotals,
  totalFindings,
  trendDelta,
} from "@/lib/analytics-data";
import {
  DEMO_AUDITS,
  DEMO_CHANNEL_HEALTH,
  DEMO_ISSUE_TRENDS,
} from "@/lib/demo-data";
import type { ChartTone } from "@/components/charts/sparkline";
import { useAudits } from "@/lib/audit-store";
import { buildHistoryInsights } from "@/lib/history/insights";
import { ButtonLink } from "@/components/ui/button";
import Link from "next/link";
import { useMemo } from "react";
import { SEVERITY_ORDER, type Severity } from "@/lib/types";

/** Short written read beneath a visualisation. */
function Interpretation({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 flex gap-4 border-t border-border pt-5">
      <span aria-hidden className="mt-2.5 h-px w-5 shrink-0 bg-accent/50" />
      <p className="text-sm leading-relaxed text-foreground-muted">{children}</p>
    </div>
  );
}

/** One hue per guideline, bound to the guideline itself rather than its rank. */
const GUIDELINE_TONES: Record<string, ChartTone> = {
  "Unsupported performance claims": "coral",
  "Superlatives without evidence": "gold",
  "Off-list terminology": "sapphire",
  "Urgency and hype punctuation": "amethyst",
  "Vendor-category language": "emerald",
};

/** One hue per channel, bound to the channel so sorting never repaints it. */
const FALLBACK_TONE: ChartTone = "silver";

export default function InsightsPage() {
  const audits = useAudits();
  const hasReal = audits.length > 0;

  /*
   * Improvement figures measured from stored audits.
   *
   * This section used to be illustrative sample history, because nothing
   * recorded how a piece of content changed between reviews. Audit history now
   * does, so the real numbers replace the sample as soon as any content has
   * been audited more than once — and until then the section says exactly what
   * is missing rather than showing a demo series dressed as measurement.
   */
  const history = useMemo(() => buildHistoryInsights(audits), [audits]);
  const hasProgress = history.progress.length > 0;

  // ---- figures derived from YOUR saved audits --------------------------
  const realSeverity = SEVERITY_ORDER.reduce(
    (acc, severity) => {
      acc[severity] = audits.reduce(
        (sum, a) => sum + (a.outcome.counts[severity] ?? 0),
        0,
      );
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0 } as Record<Severity, number>,
  );
  const realFindingTotal = SEVERITY_ORDER.reduce(
    (sum, s) => sum + realSeverity[s],
    0,
  );
  const realAverage = hasReal
    ? Math.round(audits.reduce((sum, a) => sum + a.outcome.score, 0) / audits.length)
    : 0;
  const realCriticalShare =
    realFindingTotal > 0
      ? Math.round((realSeverity.critical / realFindingTotal) * 100)
      : 0;
  const realApproved = hasReal
    ? Math.round(
        (audits.filter((a) => a.status === "approved").length / audits.length) * 100,
      )
    : 0;

  // Guideline counts, grouped by the reference each finding cited.
  const realGuidelines = Object.entries(
    audits
      .flatMap((a) => a.outcome.findings)
      .reduce<Record<string, number>>((acc, finding) => {
        acc[finding.guidelineRef] = (acc[finding.guidelineRef] ?? 0) + 1;
        return acc;
      }, {}),
  )
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  // Channel rollup: volume and mean score per channel actually used.
  const realChannels = Object.entries(
    audits.reduce<Record<string, { total: number; count: number }>>((acc, a) => {
      const row = acc[a.channel] ?? { total: 0, count: 0 };
      row.total += a.outcome.score;
      row.count += 1;
      acc[a.channel] = row;
      return acc;
    }, {}),
  ).map(([channel, { total, count }]) => ({
    channel,
    audits: count,
    averageScore: Math.round(total / count),
  }));

  // Every figure below is arithmetic on the demo sets — nothing is typed in, so
  // the prose and the charts cannot drift apart.
  const totalAudits = DEMO_CHANNEL_HEALTH.reduce((sum, c) => sum + c.audits, 0);
  const approvedShare = Math.round(
    (DEMO_AUDITS.filter((a) => a.status === "approved").length /
      DEMO_AUDITS.length) *
      100,
  );

  const severityTotals = deriveSeverityTotals();
  const findingTotal = totalFindings(severityTotals);
  const criticalShare = Math.round((severityTotals.critical / findingTotal) * 100);

  const latestScore = DEMO_SCORE_TREND[DEMO_SCORE_TREND.length - 1].value;
  const previousScore = DEMO_SCORE_TREND[DEMO_SCORE_TREND.length - 2].value;
  const periodChange = latestScore - previousScore;
  const sinceStart = trendDelta(DEMO_SCORE_TREND);
  const peakScore = Math.max(...DEMO_SCORE_TREND.map((d) => d.value));

  const issues = [...DEMO_ISSUE_TRENDS].sort((a, b) => b.count - a.count);
  const channelsByScore = [...DEMO_CHANNEL_HEALTH].sort(
    (a, b) => b.averageScore - a.averageScore,
  );
  const channelsByVolume = [...DEMO_CHANNEL_HEALTH].sort(
    (a, b) => b.audits - a.audits,
  );
  const channelGap =
    channelsByScore[0].averageScore -
    channelsByScore[channelsByScore.length - 1].averageScore;

  // The "what is improving" section now measures real audit history, so the
  // sample period-on-period deltas it used to read are no longer computed.

  return (
    <div className="space-y-12">
      <PageHeader
        eyebrow="Insights"
        title="Where the brand drifts, and how often."
        description="Patterns across every audit run in this workspace. All figures on this page are illustrative sample data for the Phase 1 prototype, not measured performance."
        action={<DemoTag />}
      />

      {/* A. Compliance overview ---------------------------------------------- */}
      <Panel>
        <PanelHeader
          eyebrow="Compliance"
          title="Overall compliance"
          description={
            hasReal
              ? "Your saved audits, plus an illustrative twelve-week series for context."
              : "Weighted across every audit in the period."
          }
          action={<DemoTag>Demo history</DemoTag>}
        />
        <PanelBody>
          <div className="flex flex-col gap-10 xl:flex-row xl:items-center">
            <div className="flex flex-col items-center gap-5 xl:items-start">
              <ScoreDial
                score={hasReal ? realAverage : latestScore}
                verdict={`Compliance score ${hasReal ? realAverage : latestScore} out of 100.`}
                size={196}
              />
              {hasReal ? (
                <p className="max-w-56 text-center text-xs leading-relaxed text-foreground-muted xl:text-left">
                  Mean score across your {audits.length} saved audit
                  {audits.length === 1 ? "" : "s"}. A period-on-period comparison
                  needs audit history over time, which arrives once audits are
                  stored server-side.
                </p>
              ) : (
              <dl className="grid w-full grid-cols-2 gap-x-8 gap-y-3 text-center xl:text-left">
                <div>
                  <dt className="text-[0.6rem] uppercase tracking-[0.14em] text-foreground-muted">
                    vs previous week
                  </dt>
                  <dd
                    className={`mt-1 text-lg font-semibold ${
                      periodChange > 0
                        ? "text-positive"
                        : periodChange < 0
                          ? "text-critical"
                          : "text-foreground-muted"
                    }`}
                  >
                    {periodChange > 0 ? "+" : ""}
                    {periodChange} pts
                  </dd>
                </div>
                <div>
                  <dt className="text-[0.6rem] uppercase tracking-[0.14em] text-foreground-muted">
                    since week one
                  </dt>
                  <dd className="mt-1 text-lg font-semibold text-positive">
                    +{sinceStart}%
                  </dd>
                </div>
              </dl>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <LineChart
                points={DEMO_SCORE_TREND}
                ariaLabel={`Compliance score by week over twelve weeks, from ${DEMO_SCORE_TREND[0].value} to ${latestScore} out of 100.`}
                columns={["Week", "Score"]}
                min={50}
                max={100}
                tickEvery={2}
                footnote="Illustrative sample data, not measured performance."
              />
            </div>
          </div>

          <Interpretation>
            The twelve-week series rises from {DEMO_SCORE_TREND[0].value} to{" "}
            {latestScore}, a gain of {sinceStart}%, with a peak of {peakScore}. The
            most recent week is {Math.abs(periodChange)}{" "}
            {Math.abs(periodChange) === 1 ? "point" : "points"}{" "}
            {periodChange < 0 ? "below" : "above"} the week before, so the trend is
            upward overall but not monotonic. These are sample figures; no causes can
            be inferred from them.
          </Interpretation>
        </PanelBody>
      </Panel>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Audits run"
          accent="sapphire"
          value={hasReal ? audits.length : totalAudits}
          caption={
            hasReal
              ? "Your saved audits."
              : "Sample figure across all channels this period."
          }
        />
        <StatTile
          label="Approved"
          accent="emerald"
          value={`${hasReal ? realApproved : approvedShare}%`}
          caption={
            hasReal ? "Of your saved audits." : "Sample: cleared without rework."
          }
        />
        <StatTile
          label="Critical share"
          accent="coral"
          value={`${hasReal ? realCriticalShare : criticalShare}%`}
          caption={
            hasReal
              ? `${realSeverity.critical} of ${realFindingTotal} of your findings are critical.`
              : `Sample: ${severityTotals.critical} of ${findingTotal} findings.`
          }
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* B. Severity distribution ----------------------------------------- */}
        <Panel>
          <PanelHeader
            eyebrow="Composition"
            title="Findings by severity"
            description={
              hasReal
                ? `${realFindingTotal} findings across your saved audits.`
                : `Sample data: ${findingTotal} findings recorded across the period.`
            }
            action={hasReal ? null : <DemoTag />}
          />
          <PanelBody>
            <SeverityDistribution
              counts={hasReal ? realSeverity : severityTotals}
              noun="violations"
            />
            <Interpretation>
              {hasReal ? (
                realFindingTotal === 0 ? (
                  <>No findings recorded across your audits yet.</>
                ) : (
                  <>
                    Critical findings are {realCriticalShare}% of the{" "}
                    {realFindingTotal} findings in your saved audits. The most
                    serious category should be the rarest, so a high share here is
                    worth attention: prohibited claims are a compliance exposure
                    rather than a stylistic preference.
                  </>
                )
              ) : (
                <>
                  In this sample data, critical findings are {criticalShare}% of the
                  total — the largest single band. That is the wrong shape: the most
                  serious category should be the rarest.
                </>
              )}
            </Interpretation>
          </PanelBody>
        </Panel>

        {/* C. Most violated guidelines -------------------------------------- */}
        <Panel>
          <PanelHeader
            eyebrow="Patterns"
            title="Most violated guidelines"
            description={
              hasReal
                ? "Guidelines cited by your audits, highest first."
                : "Sample counts of findings per rule, highest first."
            }
            action={hasReal ? null : <DemoTag />}
          />
          <PanelBody>
            {hasReal && realGuidelines.length === 0 ? (
              <p className="py-10 text-center text-sm text-foreground-muted">
                No findings recorded yet, so there is nothing to rank.
              </p>
            ) : (
              <HBarChart
                data={
                  hasReal
                    ? realGuidelines.map((g, i) => ({
                        label: g.label,
                        value: g.value,
                        colour:
                          (
                            [
                              "coral",
                              "gold",
                              "sapphire",
                              "amethyst",
                              "emerald",
                              "turquoise",
                            ] as ChartTone[]
                          )[i] ?? FALLBACK_TONE,
                      }))
                    : issues.map((issue) => ({
                        label: issue.label,
                        value: issue.count,
                        severity: issue.severity,
                        colour: GUIDELINE_TONES[issue.label] ?? FALLBACK_TONE,
                      }))
                }
                ariaLabel={
                  hasReal
                    ? `Guidelines cited by your audits: ${realGuidelines
                        .map((g) => `${g.label} ${g.value}`)
                        .join(", ")}.`
                    : `Most violated guidelines: ${issues
                        .map((i) => `${i.label} ${i.count}`)
                        .join(", ")}.`
                }
                columns={["Guideline", "Findings"]}
                metaColumn={hasReal ? undefined : "Severity"}
              />
            )}
            <Interpretation>
              {hasReal ? (
                realGuidelines.length === 0 ? (
                  <>Run an audit to see which guidelines your drafts breach most.</>
                ) : (
                  <>
                    {realGuidelines[0].label} is cited most often, in{" "}
                    {realGuidelines[0].value} of {realFindingTotal} findings
                    {realGuidelines.length > 1 ? (
                      <>
                        , followed by {realGuidelines[1].label} at{" "}
                        {realGuidelines[1].value}
                      </>
                    ) : null}
                    . Counts come from the guideline each finding cited.
                  </>
                )
              ) : (
                <>
                  In this sample data the top two rules account for{" "}
                  {Math.round(
                    ((issues[0].count + issues[1].count) / findingTotal) * 100,
                  )}
                  % of all findings between them.
                </>
              )}
            </Interpretation>
          </PanelBody>
        </Panel>
      </div>

      {/* D. Channel analysis ------------------------------------------------- */}
      <Panel>
        <PanelHeader
          eyebrow="Channels"
          title="Channel analysis"
          description={
            hasReal
              ? "Your audits by channel. Compliance and volume side by side, each channel keeping its own colour."
              : "Sample data. Compliance and volume side by side, each channel keeping its own colour."
          }
          action={hasReal ? null : <DemoTag />}
        />
        <PanelBody>
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <h3 className="mb-5 text-[0.65rem] font-medium uppercase tracking-[0.18em] text-accent/80">
                Average score, out of 100
              </h3>
              <HBarChart
                data={(hasReal
                  ? [...realChannels].sort((a, b) => b.averageScore - a.averageScore)
                  : channelsByScore
                ).map((c) => ({
                  label: c.channel,
                  value: c.averageScore,
                  colour: CHANNEL_TONES[c.channel] ?? FALLBACK_TONE,
                }))}
                ariaLabel={`Average compliance score by channel: ${channelsByScore
                  .map((c) => `${c.channel} ${c.averageScore}`)
                  .join(", ")}, out of 100.`}
                columns={["Channel", "Score"]}
                max={100}
              />
            </div>
            <div>
              <h3 className="mb-5 text-[0.65rem] font-medium uppercase tracking-[0.18em] text-accent/80">
                Audit volume
              </h3>
              <HBarChart
                data={(hasReal
                  ? [...realChannels].sort((a, b) => b.audits - a.audits)
                  : channelsByVolume
                ).map((c) => ({
                  label: c.channel,
                  value: c.audits,
                  colour: CHANNEL_TONES[c.channel] ?? FALLBACK_TONE,
                }))}
                ariaLabel={`Audit volume by channel: ${channelsByVolume
                  .map((c) => `${c.channel} ${c.audits}`)
                  .join(", ")}.`}
                columns={["Channel", "Audits"]}
              />
            </div>
          </div>

          <Interpretation>
            {hasReal ? (
              <>
                Across your {audits.length} saved audit
                {audits.length === 1 ? "" : "s"},{" "}
                {realChannels.length === 1
                  ? `${realChannels[0].channel} is the only channel used so far, averaging ${realChannels[0].averageScore}.`
                  : `${[...realChannels].sort((a, b) => a.averageScore - b.averageScore)[0].channel} scores lowest. Channel comparisons get more meaningful as volume builds.`}
              </>
            ) : (
              <>
            {channelsByScore[channelsByScore.length - 1].channel} scores lowest at{" "}
            {channelsByScore[channelsByScore.length - 1].averageScore}, {channelGap}{" "}
            points below {channelsByScore[0].channel} at{" "}
            {channelsByScore[0].averageScore}, on{" "}
            {channelsByScore[channelsByScore.length - 1].audits} audits.{" "}
            {channelsByVolume[0].channel} carries the highest volume at{" "}
            {channelsByVolume[0].audits}. The data shows the gap but not its cause; a
            pre-publish check on the weakest channel would be the cheapest way to test
            whether review timing explains it.
              </>
            )}
          </Interpretation>
        </PanelBody>
      </Panel>

      {/* E. Improvement insights -------------------------------------------- */}
      <Panel>
        <PanelHeader
          eyebrow="Direction of travel"
          title="What is improving"
          description={
            hasProgress
              ? "Measured from your own audit history: the first and latest audited version of each piece of content."
              : "Comparing each piece of content against its own earlier versions."
          }
          action={
            hasProgress ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-positive/35 bg-positive/10 px-2.5 py-1 text-[0.6rem] font-medium uppercase tracking-[0.14em] text-positive">
                <span className="h-1.5 w-1.5 rounded-full bg-positive" />
                Your audits
              </span>
            ) : (
              <DemoTag>Demo history</DemoTag>
            )
          }
        />
        <PanelBody>
          {hasProgress ? (
            <>
              <ul className="divide-y divide-border">
                {history.progress.map((row) => (
                  <li
                    key={row.lineageId}
                    className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-4 first:pt-0 last:pb-0"
                  >
                    <span className="min-w-0 flex-1 basis-56">
                      <span className="block truncate text-sm text-foreground">
                        {row.title}
                      </span>
                      <span className="mt-1 block text-xs text-foreground-muted">
                        {row.versions} versions · {row.resolved} resolved ·{" "}
                        {row.persistent} still present · {row.introduced} new
                        {row.attributable
                          ? ""
                          : " · brand rules changed between versions"}
                      </span>
                    </span>
                    <span className="text-xs tabular-nums text-foreground-muted">
                      {row.firstScore} → {row.latestScore}
                    </span>
                    <span
                      className={`flex w-24 items-center justify-end gap-1.5 text-sm tabular-nums ${
                        !row.attributable
                          ? "text-foreground-muted"
                          : row.delta > 0
                            ? "text-positive"
                            : row.delta < 0
                              ? "text-critical"
                              : "text-foreground-muted"
                      }`}
                    >
                      {row.attributable ? (
                        <>
                          <span aria-hidden>
                            {row.delta > 0 ? "▲" : row.delta < 0 ? "▼" : "—"}
                          </span>
                          {row.delta > 0 ? "+" : ""}
                          {row.delta}
                        </>
                      ) : (
                        "n/a"
                      )}
                    </span>
                  </li>
                ))}
              </ul>

              <Interpretation>
                {history.improved} of {history.improved + history.regressed + history.unchanged}{" "}
                revised {history.improved + history.regressed + history.unchanged === 1 ? "piece" : "pieces"}{" "}
                improved, {history.regressed} regressed
                {history.meanDelta !== null ? (
                  <>
                    , a mean change of {history.meanDelta > 0 ? "+" : ""}
                    {history.meanDelta} points
                  </>
                ) : null}
                .{" "}
                {history.unattributable > 0 ? (
                  <>
                    {history.unattributable}{" "}
                    {history.unattributable === 1 ? "piece is" : "pieces are"}{" "}
                    excluded from those figures because the Brand DNA changed
                    between versions, so the score moved for reasons other than
                    the writing.{" "}
                  </>
                ) : null}
                Every number here is counted from audits stored in this browser.
              </Interpretation>
            </>
          ) : (
            <div className="space-y-4 py-6">
              <p className="text-sm leading-relaxed text-foreground">
                {hasReal
                  ? `No content has been audited more than once yet, so there is nothing to measure improvement against. You have ${history.totalAudits} audit${history.totalAudits === 1 ? "" : "s"}, each of a different piece.`
                  : "No audits have been run in this browser yet."}
              </p>
              <p className="text-sm leading-relaxed text-foreground-muted">
                To track improvement, revise a draft and run a second audit with{" "}
                <span className="text-accent">Content version</span> set to “New
                version of…”. êmet will then compare the two and show what was
                resolved, what persists and what was introduced.
              </p>
              <ButtonLink href="/audit" variant="secondary" size="sm">
                Go to the Audit Studio
              </ButtonLink>
            </div>
          )}
        </PanelBody>
      </Panel>

      {/* F. Recurring violations, measured ----------------------------------- */}
      {history.recurring.length > 0 ? (
        <Panel>
          <PanelHeader
            eyebrow="Repeat offenders"
            title="Violations that keep coming back"
            description="Rules breached in more than one separate audit, counted from your history. A rule broken twice in a single draft is not counted here."
            action={
              <span className="inline-flex items-center gap-2 rounded-full border border-positive/35 bg-positive/10 px-2.5 py-1 text-[0.6rem] font-medium uppercase tracking-[0.14em] text-positive">
                <span className="h-1.5 w-1.5 rounded-full bg-positive" />
                Your audits
              </span>
            }
          />
          <PanelBody>
            <ul className="divide-y divide-border">
              {history.recurring.slice(0, 8).map((row) => (
                <li
                  key={`${row.guideline}-${row.rule}`}
                  className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3.5 first:pt-0 last:pb-0"
                >
                  <span className="min-w-0 flex-1 basis-56">
                    <span className="block truncate text-sm text-foreground">
                      {row.rule}
                    </span>
                    <span className="mt-1 block text-xs text-foreground-muted">
                      {row.guideline}
                    </span>
                  </span>
                  <span className="text-xs tabular-nums text-foreground-muted">
                    {row.audits} audits · {row.occurrences} occurrences
                  </span>
                </li>
              ))}
            </ul>
            <Interpretation>
              {history.recurring[0].rule} appears in {history.recurring[0].audits}{" "}
              separate audits, the most of any rule. A rule that keeps returning
              is usually worth fixing at the source — in the Brand DNA wording,
              or in the brief given to writers — rather than one draft at a time.{" "}
              <Link
                href="/history"
                className="text-accent underline decoration-dotted underline-offset-4"
              >
                Review the audits
              </Link>
              .
            </Interpretation>
          </PanelBody>
        </Panel>
      ) : null}

    </div>
  );
}
