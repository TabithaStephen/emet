"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRightIcon, CloseIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  DEMO_STEPS,
  TOTAL_STEPS,
  clampStep,
  isFirstStep,
  isLastStep,
  progressPercent,
} from "@/lib/demo-nav";
import {
  DEFAULT_BRAND_TAB,
  StepApproval,
  StepAudit,
  StepBrandDna,
  StepComplete,
  StepFix,
  StepInsights,
  StepVisual,
  StepWelcome,
  type BrandTab,
  type Decision,
} from "@/components/demo/steps";

/**
 * The public guided demo.
 *
 * Entirely self-contained: every piece of state below lives in React and is
 * thrown away when the visitor leaves. It never reads or writes the brand
 * store, the audit store, or any localStorage key, so a visitor cannot touch a
 * signed-in user's data. It also makes no network calls — no Gemini request is
 * needed to walk through it.
 */

const STEPS = DEMO_STEPS;

export function GuidedDemo() {
  const [step, setStep] = useState(0);

  // Per-step interaction, kept here so going back and forward preserves it.
  const [brandTab, setBrandTab] = useState<BrandTab>(DEFAULT_BRAND_TAB);
  const [visualRevealed, setVisualRevealed] = useState(false);
  const [selectedFinding, setSelectedFinding] = useState<string | null>(null);
  const [fixApplied, setFixApplied] = useState(false);
  const [decision, setDecision] = useState<Decision>("pending");

  const total = TOTAL_STEPS;
  const current = STEPS[step];
  const isLast = isLastStep(step);

  const go = (next: number) => {
    setStep(clampStep(next));
    // Bring the new step into view on small screens.
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const restart = () => {
    setBrandTab(DEFAULT_BRAND_TAB);
    setVisualRevealed(false);
    setSelectedFinding(null);
    setFixApplied(false);
    setDecision("pending");
    go(0);
  };

  return (
    <div className="min-h-dvh bg-background">
      {/* Demo chrome: progress and exit, pinned above the content */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4 sm:px-8">
          <Link
            href="/welcome"
            className="font-display text-xl leading-none tracking-tight text-foreground"
          >
            êmet
          </Link>
          <span className="hidden text-[0.6rem] uppercase tracking-[0.16em] text-accent/70 sm:inline">
            Guided demo
          </span>

          <div className="order-last w-full sm:order-none sm:ml-auto sm:w-auto sm:flex-1 sm:max-w-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[0.65rem] uppercase tracking-[0.14em] text-foreground-muted">
                Step {step + 1} of {total}
              </span>
              <span className="text-[0.65rem] tabular-nums text-foreground-muted">
                {progressPercent(step)}%
              </span>
            </div>
            <div
              className="mt-2 h-1 w-full overflow-hidden rounded-full bg-surface-elevated"
              role="progressbar"
              aria-valuenow={step + 1}
              aria-valuemin={1}
              aria-valuemax={total}
              aria-label={`Guided demo progress: step ${step + 1} of ${total}`}
            >
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-500"
                style={{ width: `${progressPercent(step)}%` }}
              />
            </div>
          </div>

          <Link
            href="/welcome"
            className="inline-flex shrink-0 items-center gap-2 rounded-md border border-border px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.1em] text-foreground-muted transition-colors duration-200 hover:border-critical/40 hover:text-critical"
          >
            <CloseIcon width={12} height={12} />
            Exit demo
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-8 sm:py-14">
        {/* Step heading stays in place across every step */}
        <div className="pb-9">
          <p className="text-[0.65rem] font-medium uppercase tracking-[0.2em] text-accent/80">
            Step {step + 1}
          </p>
          <span aria-hidden className="mt-4 block h-px w-10 bg-accent/50" />
          <h1 className="mt-5 font-display text-3xl leading-tight tracking-tight text-foreground sm:text-4xl">
            {current.title}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-foreground-muted sm:text-base">
            {current.blurb}
          </p>
        </div>

        {step === 0 ? <StepWelcome /> : null}
        {step === 1 ? <StepBrandDna tab={brandTab} onTab={setBrandTab} /> : null}
        {step === 2 ? (
          <StepVisual revealed={visualRevealed} onReveal={() => setVisualRevealed(true)} />
        ) : null}
        {step === 3 ? (
          <StepAudit selectedId={selectedFinding} onSelect={setSelectedFinding} />
        ) : null}
        {step === 4 ? (
          <StepFix
            applied={fixApplied}
            onApply={() => setFixApplied(true)}
            onReset={() => setFixApplied(false)}
          />
        ) : null}
        {step === 5 ? <StepApproval decision={decision} onDecide={setDecision} /> : null}
        {step === 6 ? <StepInsights /> : null}
        {step === 7 ? <StepComplete onRestart={restart} /> : null}

        {/* Navigation */}
        <nav
          aria-label="Guided demo navigation"
          className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-7"
        >
          <Button
            variant="secondary"
            onClick={() => go(step - 1)}
            disabled={isFirstStep(step)}
          >
            Back
          </Button>

          <ol className="order-last flex w-full flex-wrap justify-center gap-1.5 sm:order-none sm:w-auto">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Go to step ${i + 1}: ${s.title}`}
                  aria-current={i === step ? "step" : undefined}
                  className={`h-1.5 rounded-full transition-all duration-200 ${
                    i === step
                      ? "w-6 bg-accent"
                      : i < step
                        ? "w-1.5 bg-accent/45 hover:bg-accent/70"
                        : "w-1.5 bg-surface-elevated hover:bg-silver/40"
                  }`}
                />
              </li>
            ))}
          </ol>

          {isLast ? (
            <Button onClick={restart}>Restart</Button>
          ) : (
            <Button onClick={() => go(step + 1)}>
              Next
              <ArrowRightIcon width={16} height={16} />
            </Button>
          )}
        </nav>

        <p className="mt-8 text-center text-xs leading-relaxed text-foreground-muted/70">
          NovaTech is a fictional brand. Every figure and finding in this
          walkthrough is sample data, and nothing here changes any real account.
        </p>
      </main>
    </div>
  );
}
