/**
 * Cursor pagination for endpoints whose callers want the whole set.
 *
 * @remarks
 * The endpoints are cursor-paginated, so a user with more than a hundred
 * collections, mutes or personal graph nodes simply stopped seeing them at a
 * hundred, with nothing in the UI saying so. This module follows the cursor
 * instead, and when it does hit a ceiling it says so rather than presenting a
 * truncated list as a complete one.
 *
 * @packageDocumentation
 */

import { logger } from '@/lib/observability';

/** One page of a cursor-paginated response. */
export interface Page<T> {
  items: T[];
  cursor?: string;
}

/** What {@link fetchAllPages} returns. */
export interface AllPages<T> {
  /** Every item fetched, in page order */
  items: T[];
  /** Whether the ceiling stopped the walk before the cursor ran out */
  truncated: boolean;
}

/**
 * The default ceiling, in pages.
 *
 * @remarks
 * At the usual page size of 100 this is 5,000 items — far past any real
 * collection list, and low enough that a server returning a cursor forever
 * cannot hang a page.
 */
const DEFAULT_MAX_PAGES = 50;

/**
 * Walk a cursor-paginated endpoint to the end.
 *
 * @param fetchPage - Fetches one page, given the previous page's cursor
 * @param options - Ceiling and a label for the warning log
 * @returns Every item, and whether the ceiling cut the walk short
 *
 * @remarks
 * Stops when the endpoint returns no cursor, returns the same cursor twice (a
 * server bug that would otherwise loop forever), or returns an empty page. A
 * walk cut short by the ceiling logs a warning naming the label, because a cap
 * nobody can see is indistinguishable from complete data.
 *
 * @example
 * ```typescript
 * const { items, truncated } = await fetchAllPages(async (cursor) => {
 *   const response = await api.pub.chive.collection.listByOwner({ did, limit: 100, cursor });
 *   return { items: response.data.collections, cursor: response.data.cursor };
 * }, { label: 'collections' });
 * ```
 *
 * @public
 */
export async function fetchAllPages<T>(
  fetchPage: (cursor: string | undefined) => Promise<Page<T>>,
  options?: { maxPages?: number; label?: string }
): Promise<AllPages<T>> {
  const maxPages = options?.maxPages ?? DEFAULT_MAX_PAGES;
  const items: T[] = [];
  const seenCursors = new Set<string>();

  let cursor: string | undefined;
  let pages = 0;

  while (pages < maxPages) {
    const page = await fetchPage(cursor);
    pages += 1;
    items.push(...page.items);

    if (!page.cursor || page.items.length === 0) {
      return { items, truncated: false };
    }

    // A server that hands back the cursor it was given would otherwise loop
    // until the ceiling, fetching the same page every time.
    if (seenCursors.has(page.cursor)) {
      return { items, truncated: false };
    }
    seenCursors.add(page.cursor);
    cursor = page.cursor;
  }

  logger.warn('Pagination ceiling reached; results are incomplete', {
    label: options?.label ?? 'unknown',
    pages,
    items: items.length,
  });

  return { items, truncated: true };
}
