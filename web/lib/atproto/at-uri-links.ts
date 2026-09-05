/**
 * Turning AT-URIs and web URLs into something a reader can act on.
 *
 * @remarks
 * A paper on Chive is referred to from two kinds of place. Some of them are
 * ordinary web addresses -- a GitHub repository, an OSF project -- and some of
 * them are records in the atmosphere, which have no web address at all until
 * some application decides to render them. The link surfaces on an eprint page
 * have to handle both, and until now they handled them differently and badly:
 * a web URL was shown as its own href and nothing else, and a record was shown
 * as a guessed URL on the publishing app's domain.
 *
 * Two of those guesses were wrong. `cosmik.network/collection/{did}/{rkey}`
 * was built from a `network.cosmik.card`, which is not a collection, and 404s.
 * Every record link was built from `sourceType`, which the Leaflet plugin
 * assigns as `leaflet.document` for comments as well as documents.
 *
 * So this module keys off the collection NSID in the URI itself, which is the
 * one thing that cannot be wrong, and it distinguishes two levels of
 * confidence. An app link is offered only where the route was checked against
 * a live record. A record link -- the URI opened in a public record browser --
 * is offered for everything, because it always resolves.
 *
 * @packageDocumentation
 */

/** The three parts of an AT-URI that name a record. */
export interface AtUriParts {
  /** Repository the record lives in, as a DID or a handle. */
  readonly did: string;
  /** Collection NSID, e.g. `pub.leaflet.document`. */
  readonly collection: string;
  /** Record key. */
  readonly rkey: string;
}

/**
 * Splits an AT-URI into repository, collection, and record key.
 *
 * @param uri - An AT-URI naming a record
 * @returns Its parts, or `null` when the string is not one
 *
 * @public
 */
export function parseAtUri(uri: string): AtUriParts | null {
  const match = /^at:\/\/([^/]+)\/([^/]+)\/(.+)$/.exec(uri);
  if (!match) return null;
  const [, did, collection, rkey] = match;
  if (!did || !collection || !rkey) return null;
  return { did, collection, rkey };
}

/**
 * A public record browser that renders any AT-URI.
 *
 * @param uri - An AT-URI
 * @returns An address that shows the record itself
 *
 * @remarks
 * This is the link that is always correct. It reads the record from whichever
 * PDS holds it, so it works for a record type no application on the network
 * renders yet -- which, for a good deal of what references a paper, is the
 * situation.
 *
 * @public
 */
export function recordBrowserUrl(uri: string): string {
  return `https://pdsls.dev/${uri}`;
}

/**
 * What an application is called, and where it renders its records.
 */
interface AtmosphereApp {
  /** The application's name, as its own users would say it. */
  readonly name: string;
  /** What one of these records is, in one or two words. */
  readonly kind: string;
  /**
   * Builds the application's own address for a record.
   *
   * @remarks
   * Present only where the route was checked against a real record. Absent is
   * the honest answer for an app whose web routing is private or unsettled,
   * and it costs nothing: {@link recordBrowserUrl} still applies.
   */
  readonly webUrl?: (parts: AtUriParts) => string;
}

/**
 * The record types that reference a paper, by collection NSID.
 *
 * @remarks
 * Keyed on the NSID rather than on Chive's `sourceType` because the NSID is
 * carried in the URI and cannot disagree with the record, whereas `sourceType`
 * is assigned by whichever plugin indexed it and is coarser than the records
 * it covers.
 */
const APPS: Record<string, AtmosphereApp> = {
  'pub.leaflet.document': {
    name: 'Leaflet',
    kind: 'Document',
    webUrl: ({ did, rkey }) => `https://leaflet.pub/${did}/${rkey}`,
  },
  'pub.leaflet.comment': {
    name: 'Leaflet',
    kind: 'Comment',
  },
  'network.cosmik.card': {
    name: 'Cosmik',
    kind: 'Card',
  },
  'network.cosmik.connection': {
    name: 'Cosmik',
    kind: 'Connection',
  },
  'network.cosmik.collection': {
    name: 'Cosmik',
    kind: 'Collection',
  },
  'site.standard.document': {
    name: 'standard.site',
    kind: 'Document',
  },
  'site.standard.publication': {
    name: 'standard.site',
    kind: 'Publication',
  },
  // Verified against a live record: smokesignal.events renders a
  // `community.lexicon.calendar.event` at this address, titled from the event.
  'community.lexicon.calendar.event': {
    name: 'Smoke Signal',
    kind: 'Event',
    webUrl: ({ did, rkey }) => `https://smokesignal.events/${did}/${rkey}`,
  },
  'events.smokesignal.calendar.event': {
    name: 'Smoke Signal',
    kind: 'Event',
    webUrl: ({ did, rkey }) => `https://smokesignal.events/${did}/${rkey}`,
  },
  'at.margin.note': {
    name: 'Margin',
    kind: 'Note',
  },
  'at.margin.reply': {
    name: 'Margin',
    kind: 'Reply',
  },
  'app.bsky.feed.post': {
    name: 'Bluesky',
    kind: 'Post',
    webUrl: ({ did, rkey }) => `https://bsky.app/profile/${did}/post/${rkey}`,
  },
  'pub.layers.catalog.collection': {
    name: 'Layers',
    kind: 'Dataset',
  },
  'pub.layers.corpus.corpus': {
    name: 'Layers',
    kind: 'Corpus',
  },
  'pub.layers.eprint.dataLink': {
    name: 'Layers',
    kind: 'Data link',
  },
  'sh.tangled.repo': {
    name: 'Tangled',
    kind: 'Repository',
  },
};

/** How a record should be presented, and where it can be opened. */
export interface AtmosphereRecord extends AtUriParts {
  /** The publishing application's name, or the NSID when it is unknown. */
  readonly appName: string;
  /** What this record is, in one or two words. */
  readonly kind: string;
  /** The application's own address for it, when one is known to work. */
  readonly webUrl?: string;
  /** A record browser address, which always works. */
  readonly recordUrl: string;
}

/**
 * Describes a record named by an AT-URI.
 *
 * @param uri - An AT-URI
 * @returns How to name and open the record, or `null` if the URI is malformed
 *
 * @remarks
 * An unrecognized collection is not a failure. The NSID stands in for the
 * application's name and `Record` for the kind, and the record browser link is
 * unaffected -- a new app in the ecosystem shows up as a usable card the day it
 * first cites a paper, rather than waiting for Chive to learn its name.
 *
 * @public
 */
export function describeAtUri(uri: string): AtmosphereRecord | null {
  const parts = parseAtUri(uri);
  if (!parts) return null;
  const app = APPS[parts.collection];
  const webUrl = app?.webUrl?.(parts);
  return {
    ...parts,
    appName: app?.name ?? parts.collection,
    kind: app?.kind ?? 'Record',
    ...(webUrl ? { webUrl } : {}),
    recordUrl: recordBrowserUrl(uri),
  };
}

/**
 * The readable part of a web address.
 *
 * @param url - An absolute http(s) URL
 * @returns Host and path, with the noise removed, or `null` if it will not parse
 *
 * @remarks
 * A card headed "GitHub" says less than one headed "GitHub" over
 * `aaronstevenwhite/chive`, and the second costs nothing: the detail is
 * already in the URL, it was simply not being shown. The `www.` prefix, the
 * trailing slash and a `.git` suffix are dropped because they are never the
 * information a reader wanted.
 *
 * @public
 */
export function describeUrl(url: string): { host: string; path: string } | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    const host = parsed.hostname.replace(/^www\./, '');
    const path = parsed.pathname.replace(/\.git$/, '').replace(/\/$/, '');
    return { host, path: path === '/' ? '' : path };
  } catch {
    return null;
  }
}

/**
 * A one-line description of where a link goes.
 *
 * @param url - An absolute http(s) URL
 * @returns `host/path`, or the URL unchanged when it will not parse
 *
 * @public
 */
export function summarizeUrl(url: string): string {
  const parts = describeUrl(url);
  if (!parts) return url;
  return `${parts.host}${parts.path}`;
}
