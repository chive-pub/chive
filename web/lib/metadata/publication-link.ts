/**
 * Resolving the standard.site publication that a Chive page belongs to.
 *
 * @remarks
 * Bluesky's integration guidance requires an article page to advertise both its
 * `site.standard.document` and the `site.standard.publication` that document
 * belongs to, and requires a publication's own home page to advertise the
 * publication. Without the second link, no enhanced card is rendered — which is
 * the whole subscribe affordance.
 *
 * Chive cannot read either from its own index: publications written before the
 * standard.site graph began indexing are not there, and the index is not the
 * source of truth in any case. Both are read from the author's repository.
 *
 * @packageDocumentation
 */

/** Where a Chive author's publication lives, as `publicationUrlFor` builds it. */
export function chivePublicationUrl(did: string, origin = 'https://chive.pub'): string {
  return `${origin.replace(/\/+$/, '')}/authors/${did}`;
}

/**
 * Finds a DID's PDS endpoint.
 *
 * @param did - The repository owner
 * @returns The PDS origin, or undefined when it cannot be resolved
 */
async function pdsFor(did: string): Promise<string | undefined> {
  try {
    const res = await fetch(`https://plc.directory/${did}`, { next: { revalidate: 86400 } });
    if (!res.ok) return undefined;
    const doc = (await res.json()) as { service?: { id?: string; serviceEndpoint?: string }[] };
    return doc.service?.find((s) => s.id === '#atproto_pds')?.serviceEndpoint;
  } catch {
    return undefined;
  }
}

/**
 * The AT-URI of an author's Chive publication, read from their repository.
 *
 * @param did - The author
 * @param origin - Site origin, for non-production deployments
 * @returns The publication AT-URI, or undefined when they hold none
 *
 * @remarks
 * Matched on `url` rather than on name, for the same reason the writer matches
 * on it: a name is the author's to change, and an author may hold publications
 * for other sites entirely.
 *
 * @public
 */
export async function resolveChivePublication(
  did: string,
  origin = 'https://chive.pub'
): Promise<string | undefined> {
  const pds = await pdsFor(did);
  if (!pds) return undefined;

  const wanted = chivePublicationUrl(did, origin);
  try {
    const res = await fetch(
      `${pds}/xrpc/com.atproto.repo.listRecords` +
        `?repo=${encodeURIComponent(did)}&collection=site.standard.publication&limit=100`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return undefined;
    const body = (await res.json()) as {
      records?: { uri: string; value?: { url?: string } }[];
    };
    return body.records?.find((r) => r.value?.url === wanted)?.uri;
  } catch {
    return undefined;
  }
}
