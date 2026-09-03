/**
 * Leaflet backlinks plugin.
 *
 * @remarks
 * Leaflet (https://leaflet.pub) is an ATProto app for long-form rich documents.
 * When a Leaflet document or comment refers to a Chive eprint, this plugin
 * records a backlink so the reference surfaces on the eprint page.
 *
 * This was previously written against `xyz.leaflet.list`, an NSID Leaflet does
 * not publish, with an invented record shape — so it matched nothing however it
 * was wired up. The schemas it now parses are vendored under
 * `lexicons/pub/leaflet/`, taken from Leaflet's own lexicon repository
 * (`did:plc:btxrwcaeyodrap5mnjw2fvmz`).
 *
 * A Leaflet document reaches an eprint by four routes, and this plugin follows
 * all of them:
 *
 * 1. `pub.leaflet.comment.subject` — an at-uri, the direct case.
 * 2. `blocks.website.src` — an ordinary URL, so a link to a chive.pub eprint
 *    page counts.
 * 3. `blocks.text.facets[].features[]` — an inline richtext link, which is how
 *    a citation inside a paragraph appears.
 * 4. `blocks.standardSitePost.uri` — an at-uri to a `site.standard` document.
 *    Chive emits one of those for every eprint submitted with cross-platform
 *    discovery enabled, so a Leaflet document embedding a Chive standard.site
 *    post is referring to an eprint at one remove.
 *
 * Route 4 is resolved by shape rather than by fetching: a `site.standard`
 * at-uri is recorded as a backlink to the document, and mapping it back to the
 * eprint it wraps needs `content.uri` from the record itself. That second hop
 * is deliberately not done here — see the note on {@link extractEprintRefs}.
 *
 * @packageDocumentation
 */

import type { BacklinkSourceType } from '../../types/interfaces/plugin.interface.js';
import type { IPluginManifest } from '../../types/interfaces/plugin.interface.js';
import { BacklinkTrackingPlugin } from '../core/backlink-plugin.js';

/**
 * A richtext facet feature.
 *
 * @remarks
 * `pub.leaflet.richtext.facet#link` carries `uri`. The other features (bold,
 * code, mentions) carry no link and are ignored.
 *
 * @internal
 */
interface LeafletFacetFeature {
  $type?: string;
  uri?: string;
}

/**
 * A richtext facet.
 *
 * @internal
 */
interface LeafletFacet {
  features?: LeafletFacetFeature[];
}

/**
 * One block inside a linear document page.
 *
 * @remarks
 * `pub.leaflet.pages.linearDocument#block` wraps the block union in a `block`
 * property. Only the members that can carry a reference are typed here.
 *
 * @internal
 */
interface LeafletBlockWrapper {
  block?: {
    $type?: string;
    /** `blocks.website` */
    src?: string;
    /** `blocks.text` and `blocks.header` */
    facets?: LeafletFacet[];
    /** `blocks.standardSitePost` and `blocks.standardSitePublication` */
    uri?: string;
  };
}

/**
 * A page within a document.
 *
 * @internal
 */
interface LeafletPage {
  blocks?: LeafletBlockWrapper[];
}

/**
 * `pub.leaflet.document`.
 *
 * @internal
 */
interface LeafletDocument {
  $type?: 'pub.leaflet.document';
  title?: string;
  description?: string;
  author?: string;
  publication?: string;
  pages?: LeafletPage[];
}

/**
 * `pub.leaflet.comment`.
 *
 * @internal
 */
interface LeafletComment {
  $type?: 'pub.leaflet.comment';
  subject?: string;
  plaintext?: string;
  facets?: LeafletFacet[];
  attachment?: {
    document?: string;
  };
}

/**
 * Collections this plugin reads.
 *
 * @public
 */
export const LEAFLET_COLLECTIONS = ['pub.leaflet.document', 'pub.leaflet.comment'] as const;

/**
 * Tracks references to Chive eprints from Leaflet documents and comments.
 *
 * @public
 */
export class LeafletBacklinksPlugin extends BacklinkTrackingPlugin {
  /**
   * Plugin ID.
   */
  readonly id = 'pub.chive.plugin.leaflet-backlinks';

  /**
   * ATProto collection to track.
   *
   * @remarks
   * The base class subscribes to one collection. Comments are subscribed to
   * additionally in {@link onInitialize}, since both carry references and
   * splitting them into two plugins would duplicate the extraction.
   */
  readonly trackedCollection = 'pub.leaflet.document';

  /**
   * Backlink source type.
   */
  readonly sourceType: BacklinkSourceType = 'leaflet.document';

  /**
   * Plugin manifest.
   */
  readonly manifest: IPluginManifest = {
    id: 'pub.chive.plugin.leaflet-backlinks',
    name: 'Leaflet Backlinks',
    version: '0.5.0',
    description: 'Tracks references to Chive eprints from Leaflet documents and comments',
    author: 'Aaron Steven White',
    license: 'MIT',
    permissions: {
      hooks: [
        'firehose.pub.leaflet.document',
        'firehose.pub.leaflet.comment',
        // Emitted by BacklinkTrackingPlugin after a write; the bus enforces
        // emit permissions from this list, so an undeclared hook throws.
        'backlink.created',
        'backlink.deleted',
      ],
      storage: {
        maxSize: 10 * 1024 * 1024, // 10MB
      },
    },
    entrypoint: 'leaflet-backlinks.js',
  };

  /**
   * Subscribe to comments as well as documents.
   *
   * @remarks
   * `BacklinkTrackingPlugin` subscribes to `trackedCollection`; this adds the
   * second collection through the same handler, because a comment and a
   * document reach an eprint through the same extraction.
   */
  protected override onInitialize(): Promise<void> {
    this.context.eventBus.on('firehose.pub.leaflet.comment', (...args: readonly unknown[]) => {
      void this.handleFirehoseRecord(args[0] as Parameters<typeof this.handleFirehoseRecord>[0]);
    });
    return Promise.resolve();
  }

  /**
   * Extracts eprint AT-URIs from a Leaflet document or comment.
   *
   * @param record - `pub.leaflet.document` or `pub.leaflet.comment`
   * @returns Eprint AT-URIs the record refers to, deduplicated
   *
   * @remarks
   * A `site.standard` at-uri found in a `standardSitePost` block is *not*
   * returned. Chive emits a `site.standard.document` whose `content.uri` is the
   * eprint, so resolving one to an eprint means reading that record — a network
   * fetch per block, from a repository that may be unavailable. Recording a
   * backlink to the wrapper instead would attach it to the wrong subject.
   * Until Chive indexes the standard.site documents it emits (it does not
   * today), that route is better left unfollowed than followed wrongly.
   */
  extractEprintRefs(record: unknown): string[] {
    if (record === null || typeof record !== 'object') {
      return [];
    }

    const refs = new Set<string>();
    const value = record as LeafletDocument & LeafletComment;

    // A comment names its subject directly.
    if (this.isEprintUri(value.subject)) {
      refs.add(value.subject);
    }

    // A comment may quote a document, and carries its own facets.
    if (this.isEprintUri(value.attachment?.document)) {
      refs.add(value.attachment.document);
    }
    for (const uri of this.facetLinks(value.facets)) {
      refs.add(uri);
    }

    // A document carries its references inside its pages' blocks.
    for (const page of value.pages ?? []) {
      for (const wrapper of page.blocks ?? []) {
        const block = wrapper.block;
        if (!block) continue;

        // `blocks.website` — a plain URL.
        if (this.isEprintUri(block.src)) {
          refs.add(block.src);
        }

        // `blocks.standardSitePost` — an at-uri. Counted only when it points at
        // an eprint directly; see the remark above.
        if (this.isEprintUri(block.uri)) {
          refs.add(block.uri);
        }

        for (const uri of this.facetLinks(block.facets)) {
          refs.add(uri);
        }
      }
    }

    return [...refs];
  }

  /**
   * Collects eprint URIs from a richtext facet array.
   *
   * @param facets - Facets from a text block or comment
   * @returns Eprint AT-URIs found in link features
   *
   * @internal
   */
  private facetLinks(facets: LeafletFacet[] | undefined): string[] {
    const found: string[] = [];
    for (const facet of facets ?? []) {
      for (const feature of facet.features ?? []) {
        if (this.isEprintUri(feature.uri)) {
          found.push(feature.uri);
        }
      }
    }
    return found;
  }

  /**
   * Extracts context from a Leaflet record.
   *
   * @param record - Document or comment
   * @returns A title, or the opening of a comment
   */
  protected override extractContext(record: unknown): string | undefined {
    if (record === null || typeof record !== 'object') {
      return undefined;
    }
    const value = record as LeafletDocument & LeafletComment;

    if (value.title) {
      return value.description ? `${value.title}: ${value.description}` : value.title;
    }

    // Comments have no title; their opening line is the useful context.
    if (value.plaintext) {
      return value.plaintext.length > 200 ? `${value.plaintext.slice(0, 197)}...` : value.plaintext;
    }

    return undefined;
  }

  /**
   * Determines whether a record should be processed.
   *
   * @param record - Document or comment
   * @returns True when the record is one this plugin can read
   *
   * @remarks
   * The previous version filtered on `visibility === 'public'`, a field the
   * real lexicons do not have — so with the invented shape gone, every record
   * would have been skipped. Leaflet expresses membership limits inside a
   * document with a `membersOnlyDelimiter` block rather than a record-level
   * flag, and a record on the public firehose is public by construction.
   */
  protected override shouldProcess(record: unknown): boolean {
    return record !== null && typeof record === 'object';
  }
}

export default LeafletBacklinksPlugin;
