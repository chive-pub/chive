/**
 * standard.site backlinks plugin.
 *
 * @remarks
 * `site.standard.document` is the ATProto publishing ecosystem's shared record
 * for "a document on the web". Chive emits one for every eprint submitted with
 * cross-platform discovery enabled, and so does every other standard.site
 * publisher — which means a document written anywhere may point at a Chive
 * eprint.
 *
 * This plugin records that reference as a backlink. A document identifies the
 * work it describes by `site` + `path`, so a Chive eprint's document carries a
 * `path` of `/eprints/<encoded at-uri>`; documents written before that was
 * fixed carry the eprint in `content.uri` instead, and both are read here.
 *
 * Why it matters beyond the backlink itself: several references into Chive
 * arrive addressed to a *document* rather than to an eprint —
 * `site.standard.graph.recommend` names a document, and a Leaflet
 * `standardSitePost` block embeds one. Resolving those to the eprint they
 * describe needs a document-to-eprint mapping, and this is where that mapping
 * comes from. Without it, following such a reference means fetching the
 * document record over the network, from a repository that may be unavailable.
 *
 * @packageDocumentation
 */

import type { BacklinkSourceType } from '../../types/interfaces/plugin.interface.js';
import type { IPluginManifest } from '../../types/interfaces/plugin.interface.js';
import { BacklinkTrackingPlugin } from '../core/backlink-plugin.js';

/**
 * The path prefix under which Chive serves eprint pages.
 *
 * @remarks
 * Mirrors the frontend route and `eprintPath` in the web record creator. A
 * document whose `path` begins with this names an eprint in its remainder.
 */
const EPRINT_PATH_PREFIX = '/eprints/';

/**
 * The collection every eprint AT-URI contains.
 */
const EPRINT_COLLECTION = 'pub.chive.eprint.submission';

/**
 * `site.standard.document`, in the parts this plugin reads.
 *
 * @internal
 */
interface StandardDocument {
  $type?: string;
  title?: string;
  description?: string;
  /** Path under `site`, where a Chive document names its eprint */
  path?: string;
  /** Pre-revision shape: the eprint URI lived here */
  content?: { uri?: string };
}

/**
 * Tracks references to Chive eprints from standard.site documents.
 *
 * @public
 */
export class StandardSiteBacklinksPlugin extends BacklinkTrackingPlugin {
  /**
   * Plugin ID.
   */
  readonly id = 'pub.chive.plugin.standard-site-backlinks';

  /**
   * ATProto collection to track.
   */
  readonly trackedCollection = 'site.standard.document';

  /**
   * Backlink source type.
   */
  readonly sourceType: BacklinkSourceType = 'standard.document';

  /**
   * Plugin manifest.
   */
  readonly manifest: IPluginManifest = {
    id: 'pub.chive.plugin.standard-site-backlinks',
    name: 'standard.site Backlinks',
    version: '0.1.0',
    description: 'Tracks references to Chive eprints from standard.site documents',
    author: 'Aaron Steven White',
    license: 'MIT',
    permissions: {
      hooks: ['firehose.site.standard.document'],
      storage: {
        maxSize: 10 * 1024 * 1024, // 10MB
      },
    },
    entrypoint: 'standard-site-backlinks.js',
  };

  /**
   * Extracts the eprint a standard.site document describes.
   *
   * @param record - A `site.standard.document`
   * @returns The eprint AT-URI, or an empty array
   *
   * @remarks
   * Two different things can make a document about an eprint, and both count.
   *
   * A document Chive itself wrote *is* the eprint: `path` carries the eprint's
   * AT-URI, and `content.uri` is where documents written before the schema was
   * corrected put it. Dropping the legacy branch would make every
   * already-published Chive document invisible.
   *
   * A document anyone else wrote may *reference* an eprint somewhere in its
   * body — a link in a paragraph, a website block, an embed. `content` is an
   * open union: `site.standard` does not enumerate block types, and each
   * publisher brings its own (pckt writes `blog.pckt.block.*`, others write
   * their own). There is no shape to match against, so rather than special-case
   * one publisher this walks the record and collects every eprint reference it
   * finds, whether written as an AT-URI or as a link to the eprint's page.
   */
  extractEprintRefs(record: unknown): string[] {
    if (record === null || typeof record !== 'object') {
      return [];
    }

    const document = record as StandardDocument;

    // A document that *is* an eprint names exactly one, and that identity beats
    // anything its body happens to link to.
    const fromPath = eprintUriFromPath(document.path);
    if (this.isEprintUri(fromPath)) {
      return [fromPath];
    }

    if (this.isEprintUri(document.content?.uri)) {
      return [document.content.uri];
    }

    return collectEprintRefs(record);
  }

  /**
   * Extracts context from a standard.site document.
   *
   * @param record - A `site.standard.document`
   * @returns The document's title, with its description when there is one
   */
  protected override extractContext(record: unknown): string | undefined {
    if (record === null || typeof record !== 'object') {
      return undefined;
    }
    const document = record as StandardDocument;

    if (!document.title) {
      return undefined;
    }

    return document.description
      ? `${document.title}: ${document.description.slice(0, 200)}`
      : document.title;
  }
}

/**
 * Collects every eprint reference in a document's body.
 *
 * @param value - Any part of a `site.standard.document`
 * @returns Eprint AT-URIs, deduplicated and in the order found
 *
 * @remarks
 * `site.standard.document.content` is an open union — the schema does not say
 * what a block looks like, and every publisher on the format brings its own
 * block types. Matching a fixed shape would support whichever publisher was
 * read at the time and silently miss the rest, so this walks the structure
 * instead and treats any string that names an eprint as a reference.
 *
 * Both forms count. A blogger writing prose links the eprint's page, so a
 * `chive.pub/eprints/...` URL is normalised back to the AT-URI it encodes; a
 * tool writing records links the AT-URI directly.
 *
 * The walk is depth-limited because the input comes from another repository
 * and nothing guarantees it is shallow.
 *
 * @public
 */
export function collectEprintRefs(value: unknown, depth = 0): string[] {
  if (depth > 12 || value === null || typeof value !== 'object') {
    return [];
  }

  const found: string[] = [];

  for (const entry of Array.isArray(value) ? value : Object.values(value)) {
    if (typeof entry === 'string') {
      const uri = eprintUriFrom(entry);
      if (uri) found.push(uri);
      continue;
    }
    found.push(...collectEprintRefs(entry, depth + 1));
  }

  return [...new Set(found)];
}

/**
 * Reads an eprint AT-URI out of a string, however it was written.
 *
 * @param value - A candidate URI or URL
 * @returns The eprint AT-URI, or undefined when the string names no eprint
 *
 * @remarks
 * A backlink is keyed on the AT-URI, so a link to the eprint's page has to be
 * resolved back to one — otherwise the same work accumulates references under
 * two identities.
 *
 * The page is served at `/eprints/<at-uri>` and answers whether or not the
 * AT-URI is percent-encoded, so both forms are in circulation: a link built by
 * a tool is encoded, while one copied from a browser's address bar generally is
 * not. Anchoring on the `/eprints/` segment and decoding whatever follows
 * handles both, where taking the last path segment only ever handled the
 * encoded form. Query strings, fragments and a trailing slash are stripped.
 */
function eprintUriFrom(value: string): string | undefined {
  if (!value.includes(EPRINT_COLLECTION)) {
    return undefined;
  }

  if (value.startsWith('at://')) {
    return trimTrailing(value);
  }

  const marker = value.indexOf(EPRINT_PATH_PREFIX);
  if (marker < 0) {
    return undefined;
  }

  const tail = value.slice(marker + EPRINT_PATH_PREFIX.length).split(/[?#]/)[0];
  if (!tail) {
    return undefined;
  }

  // Decoding an already-decoded AT-URI is a no-op, so one pass covers both
  // forms. A malformed encoding throws and means "not an eprint reference".
  let decoded: string;
  try {
    decoded = decodeURIComponent(tail);
  } catch {
    return undefined;
  }

  return decoded.startsWith('at://') && decoded.includes(EPRINT_COLLECTION)
    ? trimTrailing(decoded)
    : undefined;
}

/**
 * Drops a trailing slash, which changes the URL but not the record it names.
 */
function trimTrailing(uri: string): string {
  return uri.endsWith('/') ? uri.slice(0, -1) : uri;
}

/**
 * Recovers an eprint AT-URI from a document path.
 *
 * @param path - The document's `path`, such as `/eprints/at%3A%2F%2F...`
 * @returns The decoded AT-URI, or undefined when the path names no eprint
 *
 * @remarks
 * A malformed percent-encoding throws from `decodeURIComponent`, and a path
 * arriving from another repository is not something to trust — so the failure
 * is caught and treated as "this document is not about an eprint" rather than
 * allowed to abort processing the record.
 *
 * @public
 */
export function eprintUriFromPath(path: string | undefined): string | undefined {
  if (!path?.startsWith(EPRINT_PATH_PREFIX)) {
    return undefined;
  }

  const encoded = path.slice(EPRINT_PATH_PREFIX.length);
  if (!encoded) {
    return undefined;
  }

  try {
    return decodeURIComponent(encoded);
  } catch {
    return undefined;
  }
}

export default StandardSiteBacklinksPlugin;
