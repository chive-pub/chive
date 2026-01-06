/**
 * Leaflet backlinks tracking plugin.
 *
 * @remarks
 * Tracks references to Chive preprints from Leaflet reading lists.
 * Leaflet (https://leaflet.app) is an ATProto-based reading list manager
 * that allows users to organize and share reading materials.
 *
 * When a Leaflet reading list includes a Chive preprint, this plugin
 * creates a backlink for aggregation and discovery.
 *
 * Reading list schema: xyz.leaflet.list
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
 * Leaflet reading list record structure.
 *
 * @internal
 */
interface LeafletList {
  $type: 'xyz.leaflet.list';
  name: string;
  description?: string;
  visibility: 'public' | 'private' | 'followers';
  items: LeafletListItem[];
  createdAt: string;
  updatedAt?: string;
  tags?: string[];
}

/**
 * Leaflet list item structure.
 *
 * @internal
 */
interface LeafletListItem {
  uri: string;
  addedAt: string;
  status?: 'unread' | 'reading' | 'read';
  notes?: string;
  rating?: number;
}

/**
 * Leaflet backlinks tracking plugin.
 *
 * @remarks
 * Tracks preprint references in Leaflet reading lists via firehose
 * and creates backlinks for discovery and aggregation.
 *
 * Only processes public reading lists to respect privacy.
 *
 * @example
 * ```typescript
 * const plugin = new LeafletBacklinksPlugin();
 * await manager.loadBuiltinPlugin(plugin);
 * ```
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
   */
  readonly trackedCollection = 'xyz.leaflet.list';

  /**
   * Backlink source type.
   */
  readonly sourceType: BacklinkSourceType = 'leaflet.list';

  /**
   * Plugin manifest.
   */
  readonly manifest: IPluginManifest = {
    id: 'pub.chive.plugin.leaflet-backlinks',
    name: 'Leaflet Backlinks',
    version: '0.1.0',
    description: 'Tracks references to Chive preprints from Leaflet reading lists',
    author: 'Aaron Steven White',
    license: 'MIT',
    permissions: {
      hooks: ['firehose.xyz.leaflet.list'],
      storage: {
        maxSize: 10 * 1024 * 1024, // 10MB
      },
    },
    entrypoint: 'leaflet-backlinks.js',
  };

  /**
   * Extracts preprint AT-URIs from a Leaflet reading list.
   *
   * @param record - Leaflet list record
   * @returns Array of preprint AT-URIs
   */
  extractPreprintRefs(record: unknown): string[] {
    const list = record as LeafletList;

    if (!list.items || !Array.isArray(list.items)) {
      return [];
    }

    return list.items.filter((item) => this.isPreprintUri(item.uri)).map((item) => item.uri);
  }

  /**
   * Extracts context from a Leaflet reading list.
   *
   * @param record - Leaflet list record
   * @returns List name and description
   */
  protected override extractContext(record: unknown): string | undefined {
    const list = record as LeafletList;

    if (list.name) {
      return list.description ? `${list.name}: ${list.description}` : list.name;
    }

    return undefined;
  }

  /**
   * Determines if a reading list should be processed.
   *
   * @param record - Leaflet list record
   * @returns True if the list is public
   */
  protected override shouldProcess(record: unknown): boolean {
    const list = record as LeafletList;

    // Only process public reading lists
    return list.visibility === 'public';
  }
}

export default LeafletBacklinksPlugin;
