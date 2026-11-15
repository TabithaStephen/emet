"use client";

import { useState } from "react";
import { CloseIcon, PlusIcon } from "@/components/icons";

interface TagInputProps {
  label: string;
  hint?: string;
  values: string[];
  placeholder?: string;
  onChange: (next: string[]) => void;
}

/** Chip list with add/remove. Used for voice traits and messaging pillars. */
export function TagInput({
  label,
  hint,
  values,
  placeholder = "Add an entry",
  onChange,
}: TagInputProps) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const value = draft.trim();
    if (!value || values.includes(value)) {
      setDraft("");
      return;
    }
    onChange([...values, value]);
    setDraft("");
  };

  return (
    <div className="space-y-3">
      <p className="text-[0.7rem] font-medium uppercase tracking-[0.14em] text-foreground-muted">
        {label}
      </p>

      <ul className="flex flex-wrap gap-2">
        {values.map((value) => (
          <li key={value}>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated py-1.5 pl-3.5 pr-2 text-xs text-foreground">
              {value}
              <button
                type="button"
                onClick={() => onChange(values.filter((v) => v !== value))}
                aria-label={`Remove ${value}`}
                className="rounded-full p-0.5 text-foreground-muted transition-colors duration-200 hover:text-critical"
              >
                <CloseIcon width={12} height={12} />
              </button>
            </span>
          </li>
        ))}
        {values.length === 0 ? (
          <li className="text-xs italic text-foreground-muted/70">Nothing added yet.</li>
        ) : null}
      </ul>

      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="w-full max-w-xs rounded-md border border-border bg-background-secondary px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted/60 transition-colors duration-200 hover:border-silver/25 focus:border-accent/60 focus:outline-none"
        />
        <button
          type="button"
          onClick={add}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface-elevated px-3 text-xs text-foreground transition-colors duration-200 hover:border-silver/30"
        >
          <PlusIcon width={14} height={14} />
          Add
        </button>
      </div>

      {hint ? <p className="text-xs leading-relaxed text-foreground-muted/80">{hint}</p> : null}
    </div>
  );
}
