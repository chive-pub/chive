/**
 * Semble backlinks tracking plugin.
 *
 * @remarks
 * Tracks references to Chive eprints from Semble collections.
 * Semble (https://semble.app) is an ATProto-based collection manager
 * that allows users to curate research collections.
 *
 * When a Semble collection includes a Chive eprint, this plugin
 * creates a backlink for aggregation and discovery.
 *
 * Collection schema: xyz.semble.collection
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
 * Semble collection record structure.
 *
 * @internal
 */
interface SembleCollection {
  $type: 'xyz.semble.collection';
  title: string;
  description?: string;
  visibility: 'public' | 'private' | 'unlisted';
  items: SembleCollectionItem[];
  createdAt: string;
  updatedAt?: string;
}

/**
 * Semble collection item structure.
 *
 * @internal
 */
interface SembleCollectionItem {
  uri: string;
  addedAt: string;
  note?: string;
}

/**
 * Semble backlinks tracking plugin.
 *
 * @remarks
 * Tracks eprint references in Semble collections via firehose
 * and creates backlinks for discovery and aggregation.
 *
 * Only processes public and unlisted collections to respect privacy.
 *
 * @example
 * ```typescript
 * const plugin = new SembleBacklinksPlugin();
 * await manager.loadBuiltinPlugin(plugin);
 * ```
 *
 * @public
 */
export class SembleBacklinksPlugin extends BacklinkTrackingPlugin {
  /**
   * Plugin ID.
   */
  readonly id = 'pub.chive.plugin.semble-backlinks';

  /**
   * ATProto collection to track.
   */
  readonly trackedCollection = 'xyz.semble.collection';

  /**
   * Backlink source type.
   */
  readonly sourceType: BacklinkSourceType = 'semble.collection';

  /**
   * Plugin manifest.
   */
  readonly manifest: IPluginManifest = {
    id: 'pub.chive.plugin.semble-backlinks',
    name: 'Semble Backlinks',
    version: '0.1.0',
    description: 'Tracks references to Chive eprints from Semble collections',
    author: 'Aaron Steven White',
    license: 'MIT',
    permissions: {
      hooks: ['firehose.xyz.semble.collection'],
      storage: {
        maxSize: 10 * 1024 * 1024, // 10MB
      },
    },
    entrypoint: 'semble-backlinks.js',
  };

  /**
   * Extracts eprint AT-URIs from a Semble collection.
   *
   * @param record - Semble collection record
   * @returns Array of eprint AT-URIs
   */
  extractEprintRefs(record: unknown): string[] {
    const collection = record as SembleCollection;

    if (!collection.items || !Array.isArray(collection.items)) {
      return [];
    }

    return collection.items.filter((item) => this.isEprintUri(item.uri)).map((item) => item.uri);
  }

  /**
   * Extracts context from a Semble collection.
   *
   * @param record - Semble collection record
   * @returns Collection title and description
   */
  protected override extractContext(record: unknown): string | undefined {
    const collection = record as SembleCollection;

    if (collection.title) {
      return collection.description
        ? `${collection.title}: ${collection.description}`
        : collection.title;
    }

    return undefined;
  }

  /**
   * Determines if a collection should be processed.
   *
   * @param record - Semble collection record
   * @returns True if the collection is public or unlisted
   */
  protected override shouldProcess(record: unknown): boolean {
    const collection = record as SembleCollection;

    // Only process public and unlisted collections
    return collection.visibility !== 'private';
  }
}

export default SembleBacklinksPlugin;
