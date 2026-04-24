/**
 * Cosmik connections tracking plugin.
 *
 * @remarks
 * Tracks `network.cosmik.connection` records from the firehose. Each
 * connection is an edge between two entities (URLs or AT URIs) in the
 * Semble graph. This plugin performs two jobs:
 *
 * 1. **Backlink tracking.** When either endpoint references a Chive eprint
 *    URL, create a backlink for aggregation and discovery on the eprint
 *    detail page.
 * 2. **Graph mirroring.** Index the connection into `cosmik_connections_index`
 *    with a reverse-resolved Chive relation slug (via the relation node's
 *    `externalIds` entries) so Chive UIs can render it as a native-looking
 *    graph edge.
 *
 * **ATProto Compliance:**
 * - All data sourced from firehose (rebuildable via replay)
 * - Tracks deletions to honor record removal
 * - Never writes to user PDSes
 *
 * @packageDocumentation
 * @public
 * @since 0.5.2
 */

import type { CollectionService } from '../../services/collection/collection-service.js';
import type { NodeService } from '../../services/governance/node-service.js';
import type { AtUri, CID } from '../../types/atproto.js';
import type {
  BacklinkSourceType,
  IPluginContext,
  IPluginManifest,
} from '../../types/interfaces/plugin.interface.js';
import type { FirehoseRecord } from '../core/backlink-plugin.js';
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
 * @public
 */
export class CosmikConnectionsPlugin extends BacklinkTrackingPlugin {
  readonly id = 'pub.chive.plugin.cosmik-connections';

  readonly trackedCollection = 'network.cosmik.connection';

  readonly sourceType: BacklinkSourceType = 'cosmik.connection';

  readonly manifest: IPluginManifest = {
    id: 'pub.chive.plugin.cosmik-connections',
    name: 'Cosmik Connections',
    version: '0.5.3',
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
   * Collection service for writing to `cosmik_connections_index`.
   */
  private collectionService?: CollectionService;

  /**
   * Node service for resolving `connectionType` to Chive relation slugs.
   */
  private nodeService?: NodeService;

  /**
   * In-process cache of `(system, identifier)` → relation node lookups.
   *
   * @remarks
   * Relation nodes are effectively immutable once published; caching avoids
   * a graph query per indexed connection. Cleared by `onInitialize`.
   *
   * @internal
   */
  private readonly relationCache = new Map<string, { slug: string; uri: string } | null>();

  override async initialize(context: IPluginContext): Promise<void> {
    await super.initialize(context);
    this.collectionService = context.config.collectionService as CollectionService | undefined;
    this.nodeService = context.config.nodeService as NodeService | undefined;
  }

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
   * Override the base handler so we can index the connection in addition
   * to creating backlinks.
   *
   * @param record - Firehose record
   */
  override async handleFirehoseRecord(record: FirehoseRecord): Promise<void> {
    // Run backlink tracking from the base class first
    await super.handleFirehoseRecord(record);

    // Index the connection into cosmik_connections_index with reverse-mapped
    // Chive relation slug, regardless of whether an eprint is referenced.
    if (record.deleted) {
      await this.deleteConnection(record.uri as AtUri);
      return;
    }

    if (!record.record || !this.collectionService) return;
    const connection = record.record as unknown as CosmikConnection;
    const { slug, uri } = await this.resolveChiveRelation(connection.connectionType);

    await this.collectionService.indexCosmikConnection(
      {
        source: connection.source,
        target: connection.target,
        connectionType: connection.connectionType,
        note: connection.note,
        chiveRelationSlug: slug ?? undefined,
        chiveRelationUri: uri ?? undefined,
      },
      {
        uri: record.uri as AtUri,
        cid: (record.cid ?? '') as unknown as CID,
        indexedAt: record.timestamp,
        pdsUrl: '',
      }
    );
  }

  /**
   * Resolves a Cosmik `connectionType` to a Chive relation slug via the
   * relation node's `externalIds`.
   *
   * @param connectionType - Cosmik `connectionType` value, or undefined
   * @returns Chive relation slug and URI, or null/null if unresolvable
   */
  private async resolveChiveRelation(
    connectionType: string | undefined
  ): Promise<{ slug: string | null; uri: string | null }> {
    if (!connectionType || !this.nodeService) return { slug: null, uri: null };

    const cacheKey = `cosmik::${connectionType}`;
    if (this.relationCache.has(cacheKey)) {
      const cached = this.relationCache.get(cacheKey) ?? null;
      return { slug: cached?.slug ?? null, uri: cached?.uri ?? null };
    }

    try {
      const node = await this.nodeService.findRelationByExternalId('cosmik', connectionType);
      if (!node) {
        this.relationCache.set(cacheKey, null);
        return { slug: null, uri: null };
      }
      // Relation nodes store their slug either in metadata.slug or derivable
      // from the label.
      let metadataSlug = '';
      if (node.metadata && typeof node.metadata === 'object' && 'slug' in node.metadata) {
        const rawSlug = (node.metadata as { slug?: unknown }).slug;
        if (typeof rawSlug === 'string') {
          metadataSlug = rawSlug;
        }
      }
      const slug = metadataSlug || node.label.toLowerCase().replace(/\s+/g, '-');
      const result = { slug, uri: node.uri };
      this.relationCache.set(cacheKey, result);
      return { slug, uri: node.uri };
    } catch (err) {
      this.logger.warn('Failed to resolve Chive relation for Cosmik connectionType', {
        connectionType,
        error: (err as Error).message,
      });
      return { slug: null, uri: null };
    }
  }

  /**
   * Removes a connection from the index (firehose delete event).
   */
  private async deleteConnection(uri: AtUri): Promise<void> {
    if (!this.collectionService) return;
    await this.collectionService.deleteCosmikConnection(uri);
  }

  /**
   * Checks if a string references a Chive eprint via AT-URI or web URL.
   */
  private isChiveEprintReference(value: string): boolean {
    if (value.includes('pub.chive.eprint.submission')) return true;
    if (value.includes('chive.pub/eprints/')) return true;
    return false;
  }
}

export default CosmikConnectionsPlugin;
