import type { ReactNode } from "react";

interface PanelProps {
  children: ReactNode;
  className?: string;
}

/** The single card surface used across êmet. One border, one radius, no gradients. */
export function Panel({ children, className = "" }: PanelProps) {
  return (
    <section
      className={`rounded-lg border border-border bg-surface shadow-[0_1px_0_0_rgba(243,240,232,0.03)_inset] ${className}`}
    >
      {children}
    </section>
  );
}

interface PanelHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function PanelHeader({
  eyebrow,
  title,
  description,
  action,
}: PanelHeaderProps) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-6 py-5 sm:px-8 sm:py-6">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-2 text-[0.65rem] font-medium uppercase tracking-[0.18em] text-accent/80">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="font-display text-xl tracking-tight text-foreground sm:text-2xl">
          {title}
        </h2>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground-muted">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function PanelBody({ children, className = "" }: PanelProps) {
  return <div className={`px-6 py-6 sm:px-8 sm:py-7 ${className}`}>{children}</div>;
}
