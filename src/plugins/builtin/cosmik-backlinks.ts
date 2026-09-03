/**
 * Cosmik backlinks tracking plugin.
 *
 * @remarks
 * Tracks references to Chive eprints from Cosmik cards.
 * Cosmik (https://cosmik.network) is an ATProto-based collection manager
 * that allows users to curate research collections.
 *
 * When a Cosmik card references a Chive eprint URL, this plugin
 * creates a backlink for aggregation and discovery.
 *
 * Card schema: network.cosmik.card
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
 * Cosmik card record structure.
 *
 * @internal
 */
interface CosmikCard {
  $type: 'network.cosmik.card';
  type: 'URL';
  url: string;
  content?: {
    $type?: string;
    url?: string;
    metadata?: {
      title?: string;
      description?: string;
    };
  };
  createdAt: string;
}

/**
 * Cosmik backlinks tracking plugin.
 *
 * @remarks
 * Tracks eprint references in Cosmik cards via firehose
 * and creates backlinks for discovery and aggregation.
 *
 * @example
 * ```typescript
 * const plugin = new CosmikBacklinksPlugin();
 * await manager.loadBuiltinPlugin(plugin);
 * ```
 *
 * @public
 */
export class CosmikBacklinksPlugin extends BacklinkTrackingPlugin {
  /**
   * Plugin ID.
   */
  readonly id = 'pub.chive.plugin.cosmik-backlinks';

  /**
   * ATProto collection to track.
   */
  readonly trackedCollection = 'network.cosmik.card';

  /**
   * Backlink source type.
   */
  readonly sourceType: BacklinkSourceType = 'cosmik.collection';

  /**
   * Plugin manifest.
   */
  readonly manifest: IPluginManifest = {
    id: 'pub.chive.plugin.cosmik-backlinks',
    name: 'Cosmik Backlinks',
    version: '0.4.0',
    description: 'Tracks references to Chive eprints from Cosmik cards',
    author: 'Aaron Steven White',
    license: 'MIT',
    permissions: {
      hooks: [
        'firehose.network.cosmik.card',
        // Emitted by BacklinkTrackingPlugin after a write; the bus enforces
        // emit permissions from this list, so an undeclared hook throws.
        'backlink.created',
        'backlink.deleted',
      ],
      storage: {
        maxSize: 10 * 1024 * 1024, // 10MB
      },
    },
    entrypoint: 'cosmik-backlinks.js',
  };

  /**
   * Extracts eprint AT-URIs from a Cosmik card.
   *
   * @param record - Cosmik card record
   * @returns Array of eprint AT-URIs found in the card's URL fields
   */
  extractEprintRefs(record: unknown): string[] {
    const card = record as CosmikCard;
    const refs: string[] = [];

    // A card is a link card: both fields hold a web address, so every
    // reference here has to be normalised to the eprint's AT-URI. Pushed as
    // written, the backlink is stored under a URL no eprint can be looked up
    // by, and points at nothing.
    for (const candidate of [card.url, card.content?.url]) {
      const uri = this.toEprintUri(candidate);
      if (uri && !refs.includes(uri)) {
        refs.push(uri);
      }
    }

    return refs;
  }

  /**
   * Extracts context from a Cosmik card.
   *
   * @param record - Cosmik card record
   * @returns Card title from content metadata, if available
   */
  protected override extractContext(record: unknown): string | undefined {
    const card = record as CosmikCard;
    return card.content?.metadata?.title || undefined; // eslint-disable-line @typescript-eslint/prefer-nullish-coalescing -- intentionally coerces empty string to undefined
  }

  /**
   * All cards are processable (no visibility filter at card level).
   *
   * @returns Always true
   */
  protected override shouldProcess(_record: unknown): boolean {
    return true;
  }
}

export default CosmikBacklinksPlugin;
