"use client";

import Image from "next/image";
import { useId } from "react";
import { CloseIcon, ImageIcon } from "@/components/icons";
import type { ImagePayload } from "@/lib/types";

interface ImageSlotProps {
  title: string;
  hint: string;
  image: ImagePayload | null;
  onPick: (file: File) => void;
  onClear: () => void;
  disabled?: boolean;
}

/** One image well: empty prompt, or a preview with a clear button. */
export function ImageSlot({
  title,
  hint,
  image,
  onPick,
  onClear,
  disabled,
}: ImageSlotProps) {
  const inputId = useId();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[0.7rem] font-medium uppercase tracking-[0.14em] text-foreground-muted">
          {title}
        </h3>
        {image ? (
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 text-[0.65rem] uppercase tracking-[0.1em] text-foreground-muted transition-colors duration-200 hover:text-critical disabled:opacity-40"
          >
            <CloseIcon width={11} height={11} />
            Clear
          </button>
        ) : null}
      </div>

      <div className="mt-3 flex-1 overflow-hidden rounded-md border border-border bg-background-secondary">
        {image ? (
          // White plate: artwork is designed for light backgrounds.
          <div className="flex h-44 items-center justify-center bg-white p-4">
            <Image
              src={image.previewUrl}
              alt={`${title}: ${image.name}`}
              width={1200}
              height={420}
              unoptimized
              className="max-h-full w-auto object-contain"
            />
          </div>
        ) : (
          <label
            htmlFor={inputId}
            className="flex h-44 cursor-pointer flex-col items-center justify-center gap-3 text-center transition-colors duration-200 hover:bg-surface-elevated/40"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-silver/60">
              <ImageIcon width={18} height={18} />
            </span>
            <span className="px-4 text-xs leading-relaxed text-foreground-muted">
              {hint}
            </span>
          </label>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-xs text-foreground-muted">
          {image ? image.name : "No image selected"}
        </p>
        <label
          htmlFor={inputId}
          className="shrink-0 cursor-pointer rounded-md border border-border px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.1em] text-foreground-muted transition-colors duration-200 hover:border-silver/30 hover:text-foreground"
        >
          {image ? "Replace" : "Upload"}
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={disabled}
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onPick(file);
            // Allow re-picking the same file.
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
