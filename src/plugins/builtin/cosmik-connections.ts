/**
 * Cosmik connections tracking plugin.
 *
 * @remarks
 * Tracks `network.cosmik.connection` records from the firehose. Connections
 * represent edges between two entities (URLs or AT URIs) in the Semble graph.
 *
 * When a connection references a Chive eprint URL as either source or target,
 * this plugin creates a backlink for aggregation and discovery.
 *
 * ATProto Compliance:
 * - All backlinks indexed from firehose (rebuildable via replay)
 * - Tracks deletions to honor record removal
 * - Never writes to user PDSes
 *
 * @packageDocumentation
 * @public
 * @since 0.5.2
 */

import type {
  BacklinkSourceType,
  IPluginManifest,
} from '../../types/interfaces/plugin.interface.js';
import { BacklinkTrackingPlugin } from '../core/backlink-plugin.js';

/**
 * Cosmik connection record structure.
 *
 * @internal
 */
interface CosmikConnection {
  $type: 'network.cosmik.connection';
  source: string;
  target: string;
  connectionType?: string;
  note?: string;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Cosmik connections tracking plugin.
 *
 * @remarks
 * Tracks eprint references in Cosmik connection records via firehose.
 * Connections can reference eprints in either source or target fields.
 *
 * @public
 */
export class CosmikConnectionsPlugin extends BacklinkTrackingPlugin {
  readonly id = 'pub.chive.plugin.cosmik-connections';

  readonly trackedCollection = 'network.cosmik.connection';

  readonly sourceType: BacklinkSourceType = 'cosmik.connection';

  readonly manifest: IPluginManifest = {
    id: 'pub.chive.plugin.cosmik-connections',
    name: 'Cosmik Connections',
    version: '0.5.2',
    description: 'Tracks edges between entities referencing Chive eprints from Semble connections',
    author: 'Aaron Steven White',
    license: 'MIT',
    permissions: {
      hooks: ['firehose.network.cosmik.connection'],
      storage: {
        maxSize: 10 * 1024 * 1024,
      },
    },
    entrypoint: 'cosmik-connections.js',
  };

  /**
   * Extracts eprint AT-URIs or Chive URLs from a connection's source and target.
   *
   * @param record - Cosmik connection record
   * @returns Array of eprint references found in source/target
   */
  extractEprintRefs(record: unknown): string[] {
    const connection = record as CosmikConnection;
    const refs: string[] = [];

    if (this.isChiveEprintReference(connection.source)) {
      refs.push(connection.source);
    }
    if (this.isChiveEprintReference(connection.target)) {
      refs.push(connection.target);
    }

    return refs;
  }

  /**
   * Extracts context from a connection record.
   *
   * @param record - Connection record
   * @returns Connection type and note as context
   */
  protected override extractContext(record: unknown): string | undefined {
    const connection = record as CosmikConnection;
    const parts: string[] = [];
    if (connection.connectionType) parts.push(`type: ${connection.connectionType}`);
    if (connection.note) parts.push(connection.note);
    return parts.length > 0 ? parts.join(' - ') : undefined;
  }

  protected override shouldProcess(_record: unknown): boolean {
    return true;
  }

  /**
   * Checks if a string references a Chive eprint via AT-URI or web URL.
   */
  private isChiveEprintReference(value: string): boolean {
    // Check AT-URI format
    if (value.includes('pub.chive.eprint.submission')) return true;
    // Check for Chive web URLs: https://chive.pub/eprints/...
    if (value.includes('chive.pub/eprints/')) return true;
    return false;
  }
}

export default CosmikConnectionsPlugin;
