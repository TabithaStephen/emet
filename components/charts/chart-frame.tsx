"use client";

import { useId, useState, type ReactNode } from "react";

interface ChartFrameProps {
  children: ReactNode;
  /** Column headings for the table twin. */
  columns: string[];
  /** Every value in the chart, so nothing is reachable only by hovering. */
  rows: Array<Array<string | number>>;
  footnote?: string;
}

/**
 * Wraps every chart with a table view holding the same numbers, so no value is
 * reachable only by hovering.
 *
 * Deliberately adds no `role="img"` wrapper: that role makes its subtree
 * presentational, which would hide both the keyboard layer and the button below
 * from assistive technology. Each chart names itself instead.
 */
export function ChartFrame({
  children,
  columns,
  rows,
  footnote,
}: ChartFrameProps) {
  const [open, setOpen] = useState(false);
  const tableId = useId();

  return (
    <div className="space-y-4">
      {children}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {footnote ? (
          <p className="text-xs leading-relaxed text-foreground-muted">{footnote}</p>
        ) : (
          <span />
        )}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={tableId}
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 rounded-md border border-border px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.12em] text-foreground-muted transition-colors duration-200 hover:border-silver/30 hover:text-foreground"
        >
          {open ? "Hide data" : "Show data"}
        </button>
      </div>

      {open ? (
        <div id={tableId} className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-border">
                {columns.map((column, i) => (
                  <th
                    key={column}
                    scope="col"
                    className={`py-2.5 pr-4 font-medium uppercase tracking-[0.1em] text-foreground-muted ${
                      i > 0 ? "text-right" : ""
                    }`}
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r} className="border-b border-border/60 last:border-0">
                  {row.map((cell, c) => (
                    <td
                      key={c}
                      className={`py-2.5 pr-4 ${
                        c > 0
                          ? "text-right tabular-nums text-foreground"
                          : "text-foreground-muted"
                      }`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

/** Floating readout shared by the hover and keyboard layers. */
export function ChartTooltip({
  x,
  title,
  value,
}: {
  x: number;
  title: string;
  value: string;
}) {
  return (
    <div
      className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-md border border-border bg-surface-elevated px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
      style={{ left: `${x}px` }}
    >
      <p className="whitespace-nowrap text-[0.65rem] uppercase tracking-[0.1em] text-foreground-muted">
        {title}
      </p>
      <p className="mt-0.5 whitespace-nowrap text-sm tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}
