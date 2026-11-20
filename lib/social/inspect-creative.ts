"use client";

import { READABLE_IMAGE_TYPES } from "@/lib/social/check-creative";
import type { CreativeInspection } from "@/lib/types";

/**
 * Measures a creative in the browser.
 *
 * The file is read into an object URL purely to learn its pixel dimensions,
 * and that URL is revoked as soon as the measurement is taken. Only the few
 * numbers in `CreativeInspection` survive: name, type, byte count, width and
 * height. The image itself is never uploaded, never sent to Gemini and never
 * written to storage, so it cannot leak into a prompt or a saved record.
 */
export function inspectCreative(file: File): Promise<CreativeInspection> {
  return new Promise((resolve, reject) => {
    if (!READABLE_IMAGE_TYPES.includes(file.type)) {
      reject(
        new Error(
          `That file is ${file.type || "of an unknown type"}. Upload a JPEG, PNG, WebP or GIF image.`,
        ),
      );
      return;
    }
    if (file.size === 0) {
      reject(new Error("That file is empty."));
      return;
    }

    const url = URL.createObjectURL(file);
    const image = new Image();

    const done = (fn: () => void) => {
      URL.revokeObjectURL(url);
      fn();
    };

    image.onload = () =>
      done(() => {
        if (!image.naturalWidth || !image.naturalHeight) {
          reject(new Error("That image's dimensions could not be read."));
          return;
        }
        resolve({
          name: file.name,
          mimeType: file.type,
          bytes: file.size,
          width: image.naturalWidth,
          height: image.naturalHeight,
          aspectRatio: Number((image.naturalWidth / image.naturalHeight).toFixed(3)),
        });
      });

    image.onerror = () =>
      done(() =>
        reject(new Error("That file could not be read as an image. It may be corrupt.")),
      );

    image.src = url;
  });
}
