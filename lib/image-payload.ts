"use client";

import type { ImagePayload } from "@/lib/types";

/** Strips the `data:…;base64,` prefix that FileReader adds. */
function stripPrefix(dataUrl: string): string {
  const comma = dataUrl.indexOf(",");
  return comma === -1 ? dataUrl : dataUrl.slice(comma + 1);
}

/** Reads a picked file into the shape the audit endpoint expects. */
export function fileToPayload(file: File): Promise<ImagePayload> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) {
        reject(new Error("That file appeared to be empty."));
        return;
      }
      resolve({
        data: stripPrefix(result),
        mimeType: file.type || "image/png",
        name: file.name,
        previewUrl: result,
      });
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Loads one of the bundled demo images. The file is served from `public/`, so
 * it is always present — nothing is cached in storage and a refresh re-fetches
 * it from disk.
 */
export async function assetToPayload(
  src: string,
  name: string,
  mimeType: string,
): Promise<ImagePayload> {
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error(`Could not load ${name} (HTTP ${response.status}).`);
  }
  const blob = await response.blob();
  const buffer = await blob.arrayBuffer();

  // Chunked, so a large image cannot blow the call stack.
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }

  return {
    data: btoa(binary),
    mimeType: blob.type || mimeType,
    name,
    previewUrl: src,
  };
}
