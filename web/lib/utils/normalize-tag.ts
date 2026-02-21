/**
 * Normalizes a tag or keyword to its canonical URL-safe slug.
 *
 * @remarks
 * Mirrors the backend normalizeTag in src/utils/normalize-tag.ts.
 * Uses hyphens as word separators (matching Stack Overflow/WordPress convention).
 */
export function normalizeTag(raw: string): string {
  return raw
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .trim();
}
