"use client";

import Link from "next/link";
import { ColumnChart } from "@/components/charts/column-chart";
import { LineChart } from "@/components/charts/line-chart";
import { WelcomeHeader } from "@/components/home/welcome-header";
import { ArrowRightIcon } from "@/components/icons";
import { ButtonLink } from "@/components/ui/button";
import { DemoTag, Meter, StatTile } from "@/components/ui/data";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { SeverityBadge } from "@/components/ui/severity";
import { SEVERITY_ORDER } from "@/lib/types";
import { StatusPill } from "@/components/ui/status";
import {
  DEMO_AUDIT_ACTIVITY,
  DEMO_SCORE_TREND,
  trendDelta,
} from "@/lib/analytics-data";
import { timeAgo, useAudits } from "@/lib/audit-store";
import { useBrand } from "@/lib/brand-store";
import { DEMO_APPROVALS, DEMO_AUDITS } from "@/lib/demo-data";

export default function CommandCentrePage() {
  const audits = useAudits();
  const { brand } = useBrand();

  // Real audits take over as soon as there are any. Until then the demo set
  // fills the screen, tagged as demo so it is never mistaken for live data.
  const hasReal = audits.length > 0;

  const realPending = audits.filter((a) => a.status === "in-review");
  const realCritical = realPending.reduce(
    (sum, a) => sum + a.outcome.counts.critical,
    0,
  );
  const realAverage = hasReal
    ? Math.round(audits.reduce((sum, a) => sum + a.outcome.score, 0) / audits.length)
    : 0;

  const pending = DEMO_APPROVALS.filter((item) => item.decision === "pending");
  const criticalOpen = DEMO_AUDITS.filter(
    (a) => a.topSeverity === "critical" && a.status !== "approved",
  ).length;
  const scoreDelta = trendDelta(DEMO_SCORE_TREND);
  const totalActivity = DEMO_AUDIT_ACTIVITY.reduce((sum, d) => sum + d.value, 0);

  // Each tile reads from a single series, so its figure, sparkline and delta
  // can never disagree with one another.
  const scorePoints = DEMO_SCORE_TREND.map((d) => d.value);
  const activityPoints = DEMO_AUDIT_ACTIVITY.map((d) => d.value);
  const scoreNow = scorePoints[scorePoints.length - 1];
  const auditsNow = activityPoints[activityPoints.length - 1];
  const auditsPrev = activityPoints[activityPoints.length - 2];
  const auditsDelta = Math.round(((auditsNow - auditsPrev) / auditsPrev) * 100);

  return (
    <div className="space-y-12">
      <WelcomeHeader
        status={
          hasReal
            ? `Everything published under ${brand.identity.name} passes through here. ${audits.length} audit${audits.length === 1 ? "" : "s"} saved in this browser.`
            : `Everything published under ${brand.identity.name} passes through here. Run your first audit to replace the sample figures below.`
        }
        action={
          <ButtonLink href="/audit">
            Start a new audit
            <ArrowRightIcon width={16} height={16} />
          </ButtonLink>
        }
      />

      {/* Workspace overview ------------------------------------------------ */}
      <section aria-labelledby="overview-heading" className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <h2
            id="overview-heading"
            className="text-[0.65rem] font-medium uppercase tracking-[0.2em] text-foreground-muted"
          >
            Brand workspace
          </h2>
          {hasReal ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-positive/35 bg-positive/10 px-2.5 py-1 text-[0.6rem] font-medium uppercase tracking-[0.14em] text-positive">
              <span className="h-1.5 w-1.5 rounded-full bg-positive" />
              Your audits
            </span>
          ) : (
            <DemoTag />
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label={hasReal ? "Audits saved" : "Audits this week"}
            value={hasReal ? audits.length : auditsNow}
            accent="sapphire"
            series={hasReal ? undefined : activityPoints}
            delta={hasReal ? undefined : { value: auditsDelta, period: "vs last week" }}
            marker={
              hasReal
                ? { state: "neutral", label: "Stored in this browser" }
                : undefined
            }
            caption={
              hasReal
                ? "Every audit you have submitted for review."
                : "Sample figure — run an audit to replace it."
            }
          />
          <StatTile
            label={hasReal ? "Average score" : "Score this week"}
            value={hasReal ? realAverage : scoreNow}
            accent="gold"
            series={hasReal ? undefined : scorePoints}
            delta={hasReal ? undefined : { value: scoreDelta, period: "since week one" }}
            marker={
              hasReal
                ? { state: "neutral", label: "Across your saved audits" }
                : undefined
            }
            caption="Compliance against the current Brand DNA."
          />
          <StatTile
            label="Awaiting approval"
            value={hasReal ? realPending.length : pending.length}
            accent="amethyst"
            marker={{
              state: "neutral",
              label: hasReal ? "In the approval queue" : "Oldest waiting 2 hours",
            }}
            caption="Human sign-off still required."
          />
          <StatTile
            label="Critical findings"
            value={hasReal ? realCritical : criticalOpen}
            accent="coral"
            marker={{ state: "critical", label: "Prohibited claims unresolved" }}
            caption={
              hasReal
                ? "Across audits awaiting approval."
                : "Open across the recent audits below."
            }
          />
        </div>
      </section>

      {/* Trends ------------------------------------------------------------- */}
      <section aria-labelledby="trends-heading" className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <h2
            id="trends-heading"
            className="text-[0.65rem] font-medium uppercase tracking-[0.2em] text-foreground-muted"
          >
            Twelve-week view
          </h2>
          <DemoTag>Demo history</DemoTag>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Panel>
            <PanelHeader
              eyebrow="Compliance"
              title="Average score by week"
              description={`Weighted across every audit. ${
                scoreDelta >= 0 ? "Up" : "Down"
              } ${Math.abs(scoreDelta)}% since week one.`}
            />
            <PanelBody>
              <LineChart
                points={DEMO_SCORE_TREND}
                ariaLabel={`Average compliance score by week, weeks one to twelve, rising from ${DEMO_SCORE_TREND[0].value} to ${DEMO_SCORE_TREND[DEMO_SCORE_TREND.length - 1].value} out of 100.`}
                columns={["Week", "Score"]}
                min={50}
                max={100}
                footnote="Illustrative sample data, not measured performance."
              />
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              eyebrow="Throughput"
              title="Audits submitted by week"
              description={`${totalActivity} submissions across the period. Sapphire through turquoise across the weeks, with the current week in champagne gold.`}
            />
            <PanelBody>
              <ColumnChart
                data={DEMO_AUDIT_ACTIVITY}
                ariaLabel={`Audits submitted per week, weeks one to twelve, ranging from ${Math.min(
                  ...DEMO_AUDIT_ACTIVITY.map((d) => d.value),
                )} to ${Math.max(...DEMO_AUDIT_ACTIVITY.map((d) => d.value))}.`}
                columns={["Week", "Audits"]}
                footnote="Illustrative sample data, not measured performance."
              />
            </PanelBody>
          </Panel>
        </div>
      </section>

      {/* Recent activity ---------------------------------------------------- */}
      <Panel>
        <PanelHeader
          eyebrow="Activity"
          title="Recent audits"
          description={
            hasReal
              ? "Audits you have run, most recent first."
              : "Sample submissions, shown until you run your first audit."
          }
          action={hasReal ? null : <DemoTag />}
        />
        <div className="divide-y divide-border">
          {hasReal
            ? audits.slice(0, 5).map((audit) => {
                const top = SEVERITY_ORDER.find((s) => audit.outcome.counts[s] > 0);
                return (
                  <article
                    key={audit.id}
                    className="flex flex-wrap items-center gap-x-6 gap-y-4 px-6 py-5 transition-colors duration-200 hover:bg-surface-elevated/40 sm:px-8"
                  >
                    <div className="min-w-0 flex-1 basis-64">
                      <h3 className="truncate text-sm text-foreground">
                        {audit.title}
                      </h3>
                      <p className="mt-1.5 text-xs text-foreground-muted">
                        {audit.channel} ·{" "}
                        {audit.outcome.engine === "gemini" ? "Gemini" : "Local check"}{" "}
                        · {timeAgo(audit.createdAt)}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      {top ? <SeverityBadge severity={top} /> : null}
                      <span className="text-xs text-foreground-muted">
                        {audit.outcome.findings.length} finding
                        {audit.outcome.findings.length === 1 ? "" : "s"}
                      </span>
                    </div>

                    <div className="w-28 shrink-0">
                      <div className="flex items-baseline justify-between">
                        <span className="text-[0.65rem] uppercase tracking-[0.14em] text-foreground-muted">
                          Score
                        </span>
                        <span className="text-sm tabular-nums text-foreground">
                          {audit.outcome.score}
                        </span>
                      </div>
                      <Meter value={audit.outcome.score} className="mt-2" />
                    </div>

                    <div className="shrink-0">
                      <StatusPill
                        status={
                          audit.status === "approved"
                            ? "approved"
                            : audit.status === "changes-requested"
                              ? "changes-requested"
                              : "in-review"
                        }
                      />
                    </div>
                  </article>
                );
              })
            : DEMO_AUDITS.map((audit) => (
                <article
                  key={audit.id}
                  className="flex flex-wrap items-center gap-x-6 gap-y-4 px-6 py-5 transition-colors duration-200 hover:bg-surface-elevated/40 sm:px-8"
                >
                  <div className="min-w-0 flex-1 basis-64">
                    <h3 className="truncate text-sm text-foreground">{audit.title}</h3>
                    <p className="mt-1.5 text-xs text-foreground-muted">
                      {audit.channel} · {audit.owner} · {audit.submittedAt}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    {audit.topSeverity ? (
                      <SeverityBadge severity={audit.topSeverity} />
                    ) : null}
                    <span className="text-xs text-foreground-muted">
                      {audit.findingCount} finding
                      {audit.findingCount === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div className="w-28 shrink-0">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[0.65rem] uppercase tracking-[0.14em] text-foreground-muted">
                        Score
                      </span>
                      <span className="text-sm tabular-nums text-foreground">
                        {audit.score}
                      </span>
                    </div>
                    <Meter value={audit.score} className="mt-2" />
                  </div>

                  <div className="shrink-0">
                    <StatusPill status={audit.status} />
                  </div>
                </article>
              ))}
        </div>
      </Panel>

      {/* Pending review ----------------------------------------------------- */}
      <Panel>
        <PanelHeader
          eyebrow="Approval queue"
          title="Pending your review"
          description={
            hasReal
              ? "Audits you submitted, waiting for a decision."
              : "Sample queue, shown until you submit your first audit."
          }
          action={
            <Link
              href="/approvals"
              className="inline-flex items-center gap-2 text-sm text-accent transition-colors duration-200 hover:text-accent/75"
            >
              Open workspace
              <ArrowRightIcon width={15} height={15} />
            </Link>
          }
        />
        <PanelBody className="space-y-4">
          {hasReal && realPending.length === 0 ? (
            <p className="py-6 text-center text-sm text-foreground-muted">
              Nothing awaiting review. Every saved audit has a decision.
            </p>
          ) : null}

          {hasReal
            ? realPending.map((audit) => {
                const top = SEVERITY_ORDER.find((sv) => audit.outcome.counts[sv] > 0);
                return (
                  <Link
                    key={audit.id}
                    href="/approvals"
                    className="block rounded-md border border-border bg-background-secondary px-5 py-4 transition-colors duration-200 hover:border-silver/25"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm text-foreground">
                          {audit.title}
                        </h3>
                        <p className="mt-1 text-xs text-foreground-muted">
                          {audit.channel} ·{" "}
                          {audit.outcome.engine === "gemini"
                            ? "Gemini"
                            : "Local check"}{" "}
                          · {timeAgo(audit.createdAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-4">
                        {top ? <SeverityBadge severity={top} /> : null}
                        <span className="text-sm tabular-nums text-foreground-muted">
                          {audit.outcome.score}
                        </span>
                      </div>
                    </div>
                    <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-foreground-muted/90">
                      “{audit.text}”
                    </p>
                  </Link>
                );
              })
            : pending.map((item) => (
                <Link
                  key={item.id}
                  href="/approvals"
                  className="block rounded-md border border-border bg-background-secondary px-5 py-4 transition-colors duration-200 hover:border-silver/25"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm text-foreground">
                        {item.title}
                      </h3>
                      <p className="mt-1 text-xs text-foreground-muted">
                        {item.channel} · {item.owner} · {item.submittedAt}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-4">
                      {item.counts.critical > 0 ? (
                        <SeverityBadge severity="critical" />
                      ) : (
                        <SeverityBadge severity="medium" />
                      )}
                      <span className="text-sm tabular-nums text-foreground-muted">
                        {item.score}
                      </span>
                    </div>
                  </div>
                  <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-foreground-muted/90">
                    “{item.excerpt}”
                  </p>
                </Link>
              ))}
        </PanelBody>
      </Panel>
    </div>
  );
}
