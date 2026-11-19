"use client";

import { MAX_PDF_BYTES, PDF_MIME } from "@/lib/pdf/inspect-pdf";

/**
 * Reads a picked PDF into the shape `/api/brand-doc` expects.
 *
 * The checks here are a courtesy, not the security boundary: they stop an
 * obviously wrong file before it is read into memory and posted. The server
 * revalidates everything regardless, because anything the browser sends is
 * untrusted by the time it arrives.
 */

export interface PdfPayload {
  /** Base64 WITHOUT the data: prefix. */
  data: string;
  mimeType: string;
  name: string;
  bytes: number;
}

/** Strips the `data:…;base64,` prefix that FileReader adds. */
function stripPrefix(dataUrl: string): string {
  const comma = dataUrl.indexOf(",");
  return comma === -1 ? dataUrl : dataUrl.slice(comma + 1);
}

export function pdfFileToPayload(file: File): Promise<PdfPayload> {
  return new Promise((resolve, reject) => {
    /*
     * Some browsers report an empty type for a file dragged from certain
     * places, so fall back to the extension rather than rejecting a real PDF.
     */
    const looksPdf =
      file.type === PDF_MIME || (!file.type && /\.pdf$/i.test(file.name));
    if (!looksPdf) {
      reject(
        new Error(
          `That file is ${file.type || "of an unknown type"}. Only PDF documents can be imported.`,
        ),
      );
      return;
    }
    if (file.size === 0) {
      reject(new Error("That file is empty."));
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      reject(
        new Error(
          `That PDF is ${(file.size / 1024 / 1024).toFixed(1)}MB; the limit is ${MAX_PDF_BYTES / 1024 / 1024}MB.`,
        ),
      );
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("That file could not be read."));
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) {
        reject(new Error("That file appeared to be empty."));
        return;
      }
      resolve({
        data: stripPrefix(result),
        mimeType: PDF_MIME,
        name: file.name,
        bytes: file.size,
      });
    };
    reader.readAsDataURL(file);
  });
}
