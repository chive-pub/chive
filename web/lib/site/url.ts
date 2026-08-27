/**
 * The public origin this deployment serves from.
 *
 * @remarks
 * Canonical links, Open Graph URLs and the client-metadata document all need an
 * absolute origin, and they were hard-coded to `https://chive.pub`. Staging
 * therefore emitted production canonicals: every staging page told search
 * engines that its content lived at the production URL, which is how a staging
 * host ends up displacing production in an index, or being crawled as a
 * duplicate of it.
 *
 * `NEXT_PUBLIC_SITE_URL` is read at build time, since the metadata it feeds is
 * generated during the build. The production origin remains the fallback so a
 * deployment that sets nothing behaves as it did.
 *
 * @packageDocumentation
 */

/** Origin used when `NEXT_PUBLIC_SITE_URL` is unset. */
const DEFAULT_SITE_URL = 'https://chive.pub';

/**
 * Absolute origin for this deployment, without a trailing slash.
 *
 * @returns The configured origin, or the production one when none is set
 *
 * @public
 */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configured) return DEFAULT_SITE_URL;
  return configured.replace(/\/+$/, '');
}

/**
 * Build an absolute URL for a path on this deployment.
 *
 * @param path - Path beginning with `/`
 * @returns The path resolved against {@link siteUrl}
 *
 * @public
 */
export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}
