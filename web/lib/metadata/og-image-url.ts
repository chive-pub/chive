/**
 * Building the OpenGraph card URL for an eprint.
 *
 * @remarks
 * The card renders from query parameters rather than fetching the eprint, so
 * whoever builds the URL decides what the card can show. Two callers need it —
 * the page's metadata, which is what a crawler reads, and the share dialog,
 * which uploads the image as a post thumbnail because Bluesky embeds a blob
 * rather than refetching the page.
 *
 * They were not the same URL. The share hardcoded `?type=default`, so a paper
 * shared from Chive carried the generic Chive card while the identical link
 * pasted into Bluesky carried the paper's own. One builder, so they cannot
 * drift again.
 *
 * @packageDocumentation
 */

/** The parts of an eprint the card can draw. */
export interface EprintOgInput {
  uri: string;
  title: string;
  /** Author display names, in order. */
  authorNames?: readonly (string | undefined)[];
  /** Plain-text abstract. */
  abstract?: string;
  /** Journal or venue, when published. */
  venue?: string;
  /** ISO date the record carries; the year is taken from it. */
  createdAt?: string;
  keywords?: readonly string[];
  publicationStatusSlug?: string;
}

/**
 * Builds the `/api/og` URL for an eprint card.
 *
 * @param eprint - The eprint's displayable parts
 * @returns A site-relative URL
 *
 * @public
 */
export function eprintOgImageUrl(eprint: EprintOgInput): string {
  const names = (eprint.authorNames ?? []).filter((n): n is string => Boolean(n));
  const params = new URLSearchParams({
    type: 'eprint',
    uri: eprint.uri,
    title: eprint.title.slice(0, 200),
    author: names[0] ?? 'Unknown Author',
  });

  const allAuthors = names.join('|');
  if (allAuthors) params.set('authors', allAuthors.slice(0, 400));
  if (eprint.abstract) params.set('abstract', eprint.abstract.slice(0, 400));
  if (eprint.venue) params.set('venue', eprint.venue.slice(0, 120));

  const year = eprint.createdAt ? new Date(eprint.createdAt).getUTCFullYear() : NaN;
  if (!Number.isNaN(year)) params.set('year', String(year));

  if (eprint.keywords && eprint.keywords.length > 0) {
    params.set('fields', eprint.keywords.slice(0, 3).join(','));
  }
  if (eprint.publicationStatusSlug) {
    params.set('status', eprint.publicationStatusSlug);
  }

  return `/api/og?${params.toString()}`;
}
