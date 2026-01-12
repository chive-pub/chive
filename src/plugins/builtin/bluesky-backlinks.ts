/**
 * Bluesky backlinks tracking plugin.
 *
 * @remarks
 * Tracks references to Chive eprints from Bluesky posts.
 * Bluesky (https://bsky.app) is the flagship ATProto social application
 * where users share and discuss content.
 *
 * When a Bluesky post embeds or links to a Chive eprint,
 * this plugin creates a backlink for aggregation and discovery.
 *
 * Post schema: app.bsky.feed.post
 *
 * ATProto Compliance:
 * - All backlinks indexed from firehose (rebuildable via replay)
 * - Tracks deletions to honor record removal
 * - Never writes to user PDSes
 *
 * @packageDocumentation
 * @public
 * @since 0.1.0
 */

import type {
  BacklinkSourceType,
  IPluginManifest,
} from '../../types/interfaces/plugin.interface.js';
import { BacklinkTrackingPlugin } from '../core/backlink-plugin.js';

/**
 * Bluesky post record structure.
 *
 * @remarks
 * Simplified schema focusing on fields relevant to backlink tracking.
 *
 * @internal
 */
interface BlueskyPost {
  $type: 'app.bsky.feed.post';
  text: string;
  createdAt: string;
  embed?: BlueskyEmbed;
  facets?: BlueskyFacet[];
  reply?: {
    root: { uri: string; cid: string };
    parent: { uri: string; cid: string };
  };
}

/**
 * Bluesky embed types.
 *
 * @internal
 */
type BlueskyEmbed =
  | BlueskyRecordEmbed
  | BlueskyRecordWithMediaEmbed
  | BlueskyExternalEmbed
  | BlueskyImagesEmbed;

/**
 * Bluesky record embed (quote post or embedded record).
 *
 * @internal
 */
interface BlueskyRecordEmbed {
  $type: 'app.bsky.embed.record';
  record: {
    uri: string;
    cid: string;
  };
}

/**
 * Bluesky record with media embed.
 *
 * @internal
 */
interface BlueskyRecordWithMediaEmbed {
  $type: 'app.bsky.embed.recordWithMedia';
  record: {
    record: {
      uri: string;
      cid: string;
    };
  };
  media: BlueskyImagesEmbed | BlueskyExternalEmbed;
}

/**
 * Bluesky external link embed.
 *
 * @internal
 */
interface BlueskyExternalEmbed {
  $type: 'app.bsky.embed.external';
  external: {
    uri: string;
    title?: string;
    description?: string;
  };
}

/**
 * Bluesky images embed.
 *
 * @internal
 */
interface BlueskyImagesEmbed {
  $type: 'app.bsky.embed.images';
  images: {
    alt?: string;
    image: { $type: 'blob' };
  }[];
}

/**
 * Bluesky rich text facet.
 *
 * @internal
 */
interface BlueskyFacet {
  index: {
    byteStart: number;
    byteEnd: number;
  };
  features: BlueskyFacetFeature[];
}

/**
 * Bluesky facet feature types.
 *
 * @internal
 */
type BlueskyFacetFeature =
  | { $type: 'app.bsky.richtext.facet#link'; uri: string }
  | { $type: 'app.bsky.richtext.facet#mention'; did: string }
  | { $type: 'app.bsky.richtext.facet#tag'; tag: string };

/**
 * Bluesky backlinks tracking plugin.
 *
 * @remarks
 * Tracks eprint references in Bluesky posts via firehose
 * and creates backlinks for discovery and aggregation.
 *
 * Extracts references from:
 * - Record embeds (embedded eprint records)
 * - External link embeds (chive.pub URLs)
 * - Rich text facets (links in post text)
 * - Plain text AT-URIs
 *
 * @example
 * ```typescript
 * const plugin = new BlueskyBacklinksPlugin();
 * await manager.loadBuiltinPlugin(plugin);
 * ```
 *
 * @public
 */
export class BlueskyBacklinksPlugin extends BacklinkTrackingPlugin {
  /**
   * Plugin ID.
   */
  readonly id = 'pub.chive.plugin.bluesky-backlinks';

  /**
   * ATProto collection to track.
   */
  readonly trackedCollection = 'app.bsky.feed.post';

  /**
   * Backlink source type.
   */
  readonly sourceType: BacklinkSourceType = 'bluesky.post';

  /**
   * Plugin manifest.
   */
  readonly manifest: IPluginManifest = {
    id: 'pub.chive.plugin.bluesky-backlinks',
    name: 'Bluesky Backlinks',
    version: '0.1.0',
    description: 'Tracks references to Chive eprints from Bluesky posts',
    author: 'Aaron Steven White',
    license: 'MIT',
    permissions: {
      hooks: ['firehose.app.bsky.feed.post'],
      storage: {
        maxSize: 50 * 1024 * 1024, // 50MB (high volume)
      },
    },
    entrypoint: 'bluesky-backlinks.js',
  };

  /**
   * Chive domain for URL matching.
   */
  private readonly CHIVE_DOMAIN = 'chive.pub';

  /**
   * Extracts eprint AT-URIs from a Bluesky post.
   *
   * @param record - Bluesky post record
   * @returns Array of eprint AT-URIs
   */
  extractEprintRefs(record: unknown): string[] {
    const post = record as BlueskyPost;
    const refs: string[] = [];

    // Extract from embeds
    if (post.embed) {
      refs.push(...this.extractFromEmbed(post.embed));
    }

    // Extract from rich text facets
    if (post.facets) {
      refs.push(...this.extractFromFacets(post.facets));
    }

    // Extract AT-URIs from plain text
    if (post.text) {
      refs.push(...this.extractUrisFromText(post.text));
    }

    // Deduplicate
    return [...new Set(refs)];
  }

  /**
   * Extracts eprint references from embed.
   *
   * @param embed - Bluesky embed
   * @returns Array of eprint AT-URIs
   */
  private extractFromEmbed(embed: BlueskyEmbed): string[] {
    const refs: string[] = [];

    if (embed.$type === 'app.bsky.embed.record') {
      // Direct record embed
      if (this.isEprintUri(embed.record.uri)) {
        refs.push(embed.record.uri);
      }
    } else if (embed.$type === 'app.bsky.embed.recordWithMedia') {
      // Record with media
      if (this.isEprintUri(embed.record.record.uri)) {
        refs.push(embed.record.record.uri);
      }
    } else if (embed.$type === 'app.bsky.embed.external') {
      // External link: check if it's a Chive URL
      const atUri = this.chiveUrlToAtUri(embed.external.uri);
      if (atUri) {
        refs.push(atUri);
      }
    }

    return refs;
  }

  /**
   * Extracts eprint references from rich text facets.
   *
   * @param facets - Bluesky facets
   * @returns Array of eprint AT-URIs
   */
  private extractFromFacets(facets: BlueskyFacet[]): string[] {
    const refs: string[] = [];

    for (const facet of facets) {
      for (const feature of facet.features) {
        if (feature.$type === 'app.bsky.richtext.facet#link') {
          // Check if it's an AT-URI
          if (this.isEprintUri(feature.uri)) {
            refs.push(feature.uri);
          }
          // Check if it's a Chive URL
          const atUri = this.chiveUrlToAtUri(feature.uri);
          if (atUri) {
            refs.push(atUri);
          }
        }
      }
    }

    return refs;
  }

  /**
   * Converts a Chive web URL to an AT-URI.
   *
   * @param url - Web URL
   * @returns AT-URI or null if not a valid Chive URL
   *
   * @remarks
   * Handles URLs like:
   * - https://chive.pub/eprint/did:plc:xxx/abc123
   * - https://chive.pub/paper/did:plc:xxx/abc123
   */
  private chiveUrlToAtUri(url: string): string | null {
    try {
      const parsed = new URL(url);

      if (!parsed.hostname.endsWith(this.CHIVE_DOMAIN)) {
        return null;
      }

      // Match /eprint/{did}/{rkey} or /paper/{did}/{rkey}
      const match = /^\/(eprint|paper)\/(did:[a-z]+:[a-zA-Z0-9]+)\/([a-zA-Z0-9]+)/.exec(
        parsed.pathname
      );
      if (match) {
        const did = match[2];
        const rkey = match[3];
        return `at://${did}/pub.chive.eprint.submission/${rkey}`;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Extracts context from a Bluesky post.
   *
   * @param record - Bluesky post record
   * @returns Post text (truncated)
   */
  protected override extractContext(record: unknown): string | undefined {
    const post = record as BlueskyPost;

    if (post.text) {
      // Truncate long posts
      return post.text.length > 200 ? `${post.text.slice(0, 197)}...` : post.text;
    }

    return undefined;
  }
}

export default BlueskyBacklinksPlugin;
