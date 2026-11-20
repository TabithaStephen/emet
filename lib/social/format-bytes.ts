/**
 * Human file size.
 *
 * Always in megabytes would read "0.0MB" for anything under about 50KB, which
 * looks like a failed measurement rather than a small file. The unit follows
 * the size.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
