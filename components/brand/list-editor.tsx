"use client";

import type { ReactNode } from "react";
import { PlusIcon, TrashIcon } from "@/components/icons";

interface Identifiable {
  id: string;
}

interface ListEditorProps<T extends Identifiable> {
  items: T[];
  onChange: (next: T[]) => void;
  /** Builds an empty row when the user adds one. */
  blank: () => T;
  addLabel: string;
  emptyLabel: string;
  /** Renders the editable fields for one row. */
  renderRow: (item: T, update: (patch: Partial<T>) => void) => ReactNode;
}

/**
 * Add / edit / remove rows. Shared by terminology, prohibited claims and
 * approved facts so all three behave identically.
 */
export function ListEditor<T extends Identifiable>({
  items,
  onChange,
  blank,
  addLabel,
  emptyLabel,
  renderRow,
}: ListEditorProps<T>) {
  const update = (id: string, patch: Partial<T>) =>
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  const remove = (id: string) => onChange(items.filter((item) => item.id !== id));

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-5 py-8 text-center text-sm text-foreground-muted">
          {emptyLabel}
        </p>
      ) : null}

      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="group rounded-md border border-border bg-background-secondary p-4 transition-colors duration-200 hover:border-silver/20"
          >
            <div className="flex items-start gap-4">
              <div className="min-w-0 flex-1">
                {renderRow(item, (patch) => update(item.id, patch))}
              </div>
              <button
                type="button"
                onClick={() => remove(item.id)}
                aria-label="Remove entry"
                className="mt-1 shrink-0 rounded-md p-2 text-foreground-muted transition-colors duration-200 hover:bg-critical/10 hover:text-critical"
              >
                <TrashIcon width={15} height={15} />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => onChange([...items, blank()])}
        className="inline-flex items-center gap-2 rounded-md border border-dashed border-border px-4 py-2.5 text-xs text-foreground-muted transition-colors duration-200 hover:border-accent/40 hover:text-foreground"
      >
        <PlusIcon width={14} height={14} />
        {addLabel}
      </button>
    </div>
  );
}

/** Compact inline input used inside list rows. */
export function RowInput({
  label,
  value,
  onChange,
  placeholder,
  mono = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[0.6rem] font-medium uppercase tracking-[0.14em] text-foreground-muted/80">
        {label}
      </span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded border border-transparent bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted/50 transition-colors duration-200 hover:border-border focus:border-accent/60 focus:outline-none ${
          mono ? "font-mono text-[0.8rem]" : ""
        }`}
      />
    </label>
  );
}
