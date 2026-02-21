/**
 * Shared tag normalization utility.
 *
 * @remarks
 * Single source of truth for tag/keyword normalization across all storage
 * backends and handlers. The output is URL-safe and can be used directly
 * as a slug (hyphens as word separators).
 *
 * @packageDocumentation
 * @public
 */

/**
 * Normalizes a tag or keyword to its canonical form.
 *
 * @param raw - Raw tag string from user input or database
 * @returns Normalized, URL-safe slug
 *
 * @example
 * ```typescript
 * normalizeTag('Montague Semantics')  // 'montague-semantics'
 * normalizeTag('montague-semantics')  // 'montague-semantics'
 * normalizeTag('Neural Networks!')    // 'neural-networks'
 * normalizeTag('  Deep   Learning  ') // 'deep-learning'
 * ```
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
