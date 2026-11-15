import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}

/** The opening block of every screen. Serif title, gold hairline, lots of air. */
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-6 pb-10">
      <div className="max-w-2xl">
        <p className="text-[0.65rem] font-medium uppercase tracking-[0.2em] text-accent/80">
          {eyebrow}
        </p>
        <span aria-hidden className="mt-4 block h-px w-10 bg-accent/50" />
        <h1 className="mt-5 font-display text-3xl leading-tight tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-foreground-muted sm:text-base">
          {description}
        </p>
      </div>
      {action ? <div className="shrink-0 pb-1">{action}</div> : null}
    </header>
  );
}
