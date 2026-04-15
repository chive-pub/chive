/**
 * Collection service for user-curated collections of eprints.
 *
 * @remarks
 * Indexes collection records from the firehose. Collections are personal
 * nodes (subkind=collection) linked to eprints via CONTAINS edges and
 * organized hierarchically via SUBCOLLECTION_OF edges.
 *
 * **ATProto Compliance:**
 * - Read-only indexing from firehose events
 * - Never writes to user PDSes
 * - Tracks PDS source for staleness detection
 * - All indexes rebuildable from firehose
 *
 * **Cascade Deletion Rules:**
 * - SUBCOLLECTION_OF is transitive: deleting an intermediary re-links children to parent
 * - CONTAINS is NOT transitive: items in a deleted collection are removed, not promoted
 *
 * @packageDocumentation
 * @public
 */

import type { Pool } from 'pg';

import type { SectionConfig } from '../../lexicons/generated/types/pub/chive/actor/getProfileConfig.js';
import type {
  CollectionItemRef,
  FeedEventPayload,
} from '../../lexicons/generated/types/pub/chive/collection/defs.js';
import type { Main as EdgeRecord } from '../../lexicons/generated/types/pub/chive/graph/edge.js';
import type { Main as NodeRecord } from '../../lexicons/generated/types/pub/chive/graph/node.js';
import type { AtUri, DID } from '../../types/atproto.js';
import { DatabaseError, ValidationError } from '../../types/errors.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import { Err, Ok, type Result } from '../../types/result.js';
import type { RecordMetadata } from '../eprint/eprint-service.js';

/**
 * Extracts DID from an AT URI.
 *
 * @param uri - AT URI in format at://did:xxx/collection/rkey
 * @returns DID portion of the URI
 *
 * @internal
 */
function extractDidFromUri(uri: AtUri): DID {
  const parts = (uri as string).split('/');
  return parts[2] as DID;
}

/**
 * Pagination options for list queries.
 *
 * @public
 */
export interface PaginationOptions {
  readonly limit?: number;
  readonly cursor?: string;
}

/**
 * Paginated result wrapper.
 *
 * @public
 */
export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly cursor?: string;
  readonly hasMore: boolean;
  readonly total: number;
}

/**
 * Profile display configuration indexed from the firehose.
 *
 * @public
 */
export interface ProfileConfig {
  readonly did: DID;
  readonly uri: AtUri;
  readonly profileType: string;
  readonly sections: readonly ProfileSection[];
  readonly featuredCollectionUri?: AtUri;
}

/**
 * Profile section configuration.
 *
 * @public
 */
export interface ProfileSection {
  readonly type: string;
  readonly visible: boolean;
  readonly order: number;
  readonly config?: SectionConfig;
}

/**
 * Indexed collection view for display.
 *
 * @public
 */
export interface IndexedCollection {
  readonly uri: AtUri;
  readonly cid: string;
  readonly ownerDid: DID;
  readonly label: string;
  readonly description?: string;
  readonly visibility: 'listed' | 'unlisted';
  readonly itemCount: number;
  readonly createdAt: Date;
  readonly updatedAt?: Date;
  readonly parentCollectionUri?: string;
  readonly cosmikCollectionUri?: string;
  readonly cosmikCollectionCid?: string;
  readonly cosmikItems?: Record<
    string,
    { cardUri: string; cardCid: string; linkUri: string; linkCid: string }
  >;
}

/**
 * Collection item view as returned by getCollectionItems.
 *
 * @public
 */
export interface CollectionItem {
  readonly edgeUri: string;
  readonly itemUri: string;
  readonly itemType: string;
  readonly note?: string;
  readonly order: number;
  readonly addedAt: Date;
  readonly title?: string;
  readonly authors?: string[];
  readonly label?: string;
  readonly kind?: string;
  readonly subkind?: string;
  readonly description?: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Inter-item edge between two items within a collection.
 *
 * @public
 */
export interface InterItemEdge {
  readonly uri: string;
  readonly sourceUri: string;
  readonly targetUri: string;
  readonly relationSlug: string;
}

/**
 * A single event in the collection feed.
 *
 * @public
 */
export interface CollectionFeedEvent {
  type: string;
  eventUri: string;
  eventAt: Date;
  collectionItemUri: string;
  collectionItemSubkind: string;
  /** Collection items that triggered this event (label + URI pairs). */
  collectionItems: CollectionItemRef[];
  payload: FeedEventPayload;
}

/**
 * Paginated result from the collection feed query.
 *
 * @public
 */
export interface CollectionFeedResult {
  events: CollectionFeedEvent[];
  cursor?: string;
  hasMore: boolean;
}

/**
 * Collection service configuration.
 *
 * @public
 */
export interface CollectionServiceOptions {
  readonly pool: Pool;
  readonly logger: ILogger;
}

/**
 * Collection service for indexing and querying user-curated collections.
 *
 * @example
 * ```typescript
 * const service = new CollectionService({ pool, logger });
 *
 * // Index collection from firehose
 * await service.indexCollection(nodeRecord, metadata);
 *
 * // List a user's collections
 * const collections = await service.listByOwner(did);
 *
 * // Find collections containing a specific eprint
 * const containing = await service.getCollectionsContaining(eprintUri);
 * ```
 *
 * @public
 */
export class CollectionService {
  private readonly pool: Pool;
  private readonly logger: ILogger;

  constructor(options: CollectionServiceOptions) {
    this.pool = options.pool;
    this.logger = options.logger;
  }

  /**
   * Indexes a collection node from the firehose.
   *
   * @param nodeRecord - Node record with subkind=collection
   * @param metadata - Record metadata including URI, CID, and PDS source
   * @returns Result indicating success or failure
   *
   * @public
   */
  async indexCollection(
    nodeRecord: unknown,
    metadata: RecordMetadata
  ): Promise<Result<void, DatabaseError | ValidationError>> {
    const record = nodeRecord as NodeRecord;

    if (!record.label) {
      const validationError = new ValidationError(
        'Collection requires a label',
        'label',
        'required'
      );
      this.logger.warn('Invalid collection record: missing label', { uri: metadata.uri });
      return Err(validationError);
    }

    try {
      const ownerDid = extractDidFromUri(metadata.uri);
      // Determine visibility from metadata; default to unlisted
      const visibilityRaw =
        record.metadata && 'visibility' in record.metadata
          ? (record.metadata.visibility as string)
          : 'unlisted';
      const visibility =
        visibilityRaw === 'listed' || visibilityRaw === 'public' ? 'listed' : 'unlisted';

      // Extract tags from record metadata
      const tags =
        record.metadata && 'tags' in record.metadata && Array.isArray(record.metadata.tags)
          ? record.metadata.tags
          : [];

      await this.pool.query(
        `INSERT INTO collections_index (
          uri, cid, owner_did, label, description, visibility, tags,
          created_at, pds_url, indexed_at, last_synced_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, NOW(), NOW())
        ON CONFLICT (uri) DO UPDATE SET
          cid = EXCLUDED.cid,
          label = EXCLUDED.label,
          description = EXCLUDED.description,
          visibility = EXCLUDED.visibility,
          tags = EXCLUDED.tags,
          updated_at = NOW(),
          last_synced_at = NOW()`,
        [
          metadata.uri,
          metadata.cid,
          ownerDid,
          record.label,
          record.description ?? null,
          visibility,
          JSON.stringify(tags),
          record.createdAt ? new Date(record.createdAt) : metadata.indexedAt,
          metadata.pdsUrl,
        ]
      );

      // Sync itemOrder metadata to edge weights so the server-side query
      // returns items in the user-specified order.
      const itemOrder =
        record.metadata &&
        'itemOrder' in record.metadata &&
        Array.isArray(record.metadata.itemOrder)
          ? (record.metadata.itemOrder as string[])
          : null;

      if (itemOrder && itemOrder.length > 0) {
        await this.pool.query(
          `UPDATE collection_edges_index
           SET weight = data.new_weight
           FROM (
             SELECT uri, ord::real AS new_weight
             FROM unnest($1::text[]) WITH ORDINALITY AS t(uri, ord)
           ) data
           WHERE collection_edges_index.uri = data.uri
             AND collection_edges_index.source_uri = $2`,
          [itemOrder, metadata.uri]
        );
      }

      this.logger.info('Indexed collection', {
        uri: metadata.uri,
        ownerDid,
        label: record.label,
        visibility,
      });

      return Ok(undefined);
    } catch (error) {
      const dbError = new DatabaseError(
        'WRITE',
        `Failed to index collection: ${error instanceof Error ? error.message : String(error)}`
      );
      this.logger.error('Failed to index collection', dbError, { uri: metadata.uri });
      return Err(dbError);
    }
  }

  /**
   * Indexes a collection edge (CONTAINS or SUBCOLLECTION_OF) from the firehose.
   *
   * @param edgeRecord - Edge record linking collection to item or parent
   * @param metadata - Record metadata including URI, CID, and PDS source
   * @returns Result indicating success or failure
   *
   * @public
   */
  async indexCollectionEdge(
    edgeRecord: unknown,
    metadata: RecordMetadata
  ): Promise<Result<void, DatabaseError | ValidationError>> {
    const record = edgeRecord as EdgeRecord;

    if (!record.sourceUri || !record.targetUri || !record.relationSlug) {
      const validationError = new ValidationError(
        'Collection edge requires sourceUri, targetUri, and relationSlug',
        'record',
        'schema'
      );
      this.logger.warn('Invalid collection edge record', { uri: metadata.uri });
      return Err(validationError);
    }

    // Cycle detection for subcollection-of edges
    if (record.relationSlug === 'subcollection-of') {
      if (record.sourceUri === record.targetUri) {
        const validationError = new ValidationError(
          'Cannot create subcollection-of edge: self-loop detected',
          'sourceUri',
          'cycle'
        );
        this.logger.warn('Rejected subcollection-of self-loop', {
          uri: metadata.uri,
          sourceUri: record.sourceUri,
        });
        return Err(validationError);
      }

      const cycleDetected = await this.wouldCreateCycle(record.sourceUri, record.targetUri);
      if (cycleDetected) {
        const validationError = new ValidationError(
          'Cannot create subcollection-of edge: would create a cycle',
          'targetUri',
          'cycle'
        );
        this.logger.warn('Rejected subcollection-of edge that would create a cycle', {
          uri: metadata.uri,
          sourceUri: record.sourceUri,
          targetUri: record.targetUri,
        });
        return Err(validationError);
      }
    }

    try {
      const ownerDid = extractDidFromUri(metadata.uri);

      // Extract label from edge metadata if present
      const edgeLabel =
        record.metadata && typeof record.metadata === 'object' && 'label' in record.metadata
          ? (record.metadata as Record<string, unknown>).label
          : null;

      await this.pool.query(
        `INSERT INTO collection_edges_index (
          uri, cid, owner_did, source_uri, target_uri, relation_slug,
          weight, label, created_at, pds_url, indexed_at, last_synced_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
        ON CONFLICT (uri) DO UPDATE SET
          cid = EXCLUDED.cid,
          relation_slug = EXCLUDED.relation_slug,
          weight = EXCLUDED.weight,
          label = EXCLUDED.label,
          updated_at = NOW(),
          last_synced_at = NOW()`,
        [
          metadata.uri,
          metadata.cid,
          ownerDid,
          record.sourceUri,
          record.targetUri,
          record.relationSlug,
          record.weight ?? null,
          typeof edgeLabel === 'string' ? edgeLabel : null,
          record.createdAt ? new Date(record.createdAt) : metadata.indexedAt,
          metadata.pdsUrl,
        ]
      );

      this.logger.info('Indexed collection edge', {
        uri: metadata.uri,
        ownerDid,
        sourceUri: record.sourceUri,
        targetUri: record.targetUri,
        relationSlug: record.relationSlug,
      });

      return Ok(undefined);
    } catch (error) {
      const dbError = new DatabaseError(
        'WRITE',
        `Failed to index collection edge: ${error instanceof Error ? error.message : String(error)}`
      );
      this.logger.error('Failed to index collection edge', dbError, { uri: metadata.uri });
      return Err(dbError);
    }
  }

  /**
   * Updates an existing collection in the index.
   *
   * @param uri - AT URI of the collection to update
   * @param nodeRecord - Updated node record
   * @param metadata - Record metadata
   * @returns Result indicating success or failure
   *
   * @public
   */
  async updateCollection(
    uri: AtUri,
    nodeRecord: unknown,
    metadata: RecordMetadata
  ): Promise<Result<void, DatabaseError | ValidationError>> {
    return this.indexCollection(nodeRecord, { ...metadata, uri });
  }

  /**
   * Deletes a collection from the index with cascade logic.
   *
   * @remarks
   * Cascade behavior when deleting an intermediary collection in a
   * parent -> child -> grandchild chain:
   *
   * 1. SUBCOLLECTION_OF is transitive: grandchild subcollections are
   *    re-linked to the parent collection.
   * 2. CONTAINS is NOT transitive: items directly contained in the
   *    deleted collection are removed (edges deleted), not promoted
   *    to the parent.
   *
   * Steps:
   * 1. Find children (SUBCOLLECTION_OF edges where target = this collection)
   * 2. Find parent (SUBCOLLECTION_OF edge where source = this collection)
   * 3. Re-link children to parent (update SUBCOLLECTION_OF target)
   * 4. Delete all edges referencing this collection
   * 5. Delete the collection itself
   *
   * @param uri - AT URI of the collection to delete
   * @returns Result indicating success or failure
   *
   * @public
   */
  async deleteCollection(uri: AtUri): Promise<Result<void, DatabaseError>> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Step 1: Find children (subcollections whose SUBCOLLECTION_OF edge targets this collection).
      // These are edges where source_uri is the child and target_uri is this collection.
      const childrenResult = await client.query<{ uri: string; source_uri: string }>(
        `SELECT uri, source_uri
         FROM collection_edges_index
         WHERE target_uri = $1
           AND relation_slug = 'subcollection-of'`,
        [uri]
      );

      // Step 2: Find parent (SUBCOLLECTION_OF edge from this collection to its parent).
      // This is an edge where source_uri is this collection.
      const parentResult = await client.query<{ target_uri: string }>(
        `SELECT target_uri
         FROM collection_edges_index
         WHERE source_uri = $1
           AND relation_slug = 'subcollection-of'
         LIMIT 1`,
        [uri]
      );

      const parentUri = parentResult.rows[0]?.target_uri;

      // Step 3: Re-link children to parent (SUBCOLLECTION_OF is transitive).
      // If there is a parent, update each child's SUBCOLLECTION_OF edge to point to the parent.
      // If there is no parent (this was a root), simply delete the children's SUBCOLLECTION_OF edges.
      if (parentUri && childrenResult.rows.length > 0) {
        for (const child of childrenResult.rows) {
          await client.query(
            `UPDATE collection_edges_index
             SET target_uri = $1, updated_at = NOW()
             WHERE uri = $2`,
            [parentUri, child.uri]
          );
        }

        this.logger.info('Re-linked subcollections to parent', {
          deletedCollection: uri,
          parentUri,
          childCount: childrenResult.rows.length,
        });
      } else if (childrenResult.rows.length > 0) {
        // No parent: children become root collections, remove their SUBCOLLECTION_OF edges
        const childEdgeUris = childrenResult.rows.map((r) => r.uri);
        await client.query(`DELETE FROM collection_edges_index WHERE uri = ANY($1)`, [
          childEdgeUris,
        ]);

        this.logger.info('Removed subcollection edges for orphaned children', {
          deletedCollection: uri,
          childCount: childrenResult.rows.length,
        });
      }

      // Step 4: Delete all CONTAINS edges where source is this collection.
      // CONTAINS is NOT transitive, so items are simply removed.
      await client.query(
        `DELETE FROM collection_edges_index
         WHERE source_uri = $1 AND relation_slug = 'contains'`,
        [uri]
      );

      // Delete SUBCOLLECTION_OF edge from this collection to its parent (if any)
      await client.query(
        `DELETE FROM collection_edges_index
         WHERE source_uri = $1 AND relation_slug = 'subcollection-of'`,
        [uri]
      );

      // Delete any remaining edges referencing this collection as target
      // (e.g., other relation types)
      await client.query(
        `DELETE FROM collection_edges_index
         WHERE source_uri = $1 OR target_uri = $1`,
        [uri]
      );

      // Step 5: Delete the collection itself
      await client.query('DELETE FROM collections_index WHERE uri = $1', [uri]);

      // Step 6: Clean up personal graph rows referencing this collection
      await client.query(
        'DELETE FROM personal_graph_edges_index WHERE source_uri = $1 OR target_uri = $1',
        [uri]
      );
      await client.query('DELETE FROM personal_graph_nodes_index WHERE uri = $1', [uri]);

      await client.query('COMMIT');

      this.logger.info('Deleted collection with cascade', { uri });
      return Ok(undefined);
    } catch (error) {
      await client.query('ROLLBACK');

      const dbError = new DatabaseError(
        'DELETE',
        `Failed to delete collection: ${error instanceof Error ? error.message : String(error)}`
      );
      this.logger.error('Failed to delete collection', dbError, { uri });
      return Err(dbError);
    } finally {
      client.release();
    }
  }

  /**
   * Deletes a collection edge from the index.
   *
   * @param edgeUri - AT URI of the edge to delete
   * @returns Result indicating success or failure
   *
   * @public
   */
  async deleteCollectionEdge(edgeUri: AtUri): Promise<Result<void, DatabaseError>> {
    try {
      await this.pool.query('DELETE FROM collection_edges_index WHERE uri = $1', [edgeUri]);

      this.logger.info('Deleted collection edge', { uri: edgeUri });
      return Ok(undefined);
    } catch (error) {
      const dbError = new DatabaseError(
        'DELETE',
        `Failed to delete collection edge: ${error instanceof Error ? error.message : String(error)}`
      );
      this.logger.error('Failed to delete collection edge', dbError, { uri: edgeUri });
      return Err(dbError);
    }
  }

  /**
   * Retrieves a collection by URI with item count.
   *
   * @param uri - AT URI of the collection
   * @param authDid - Authenticated user DID (for visibility filtering)
   * @returns IndexedCollection or null if not found or not authorized
   *
   * @public
   */
  async getCollection(uri: AtUri, authDid?: DID): Promise<IndexedCollection | null> {
    try {
      const result = await this.pool.query<{
        uri: string;
        cid: string;
        owner_did: string;
        label: string;
        description: string | null;
        visibility: string;
        created_at: Date;
        updated_at: Date | null;
        item_count: string;
        parent_collection_uri: string | null;
        cosmik_collection_uri: string | null;
        cosmik_collection_cid: string | null;
        cosmik_items: Record<string, unknown> | null;
      }>(
        `SELECT c.uri, c.cid, c.owner_did, c.label, c.description, c.visibility,
                c.created_at, c.updated_at,
                COUNT(e.uri)::text AS item_count,
                parent_edge.target_uri AS parent_collection_uri,
                pgn.metadata->>'cosmikCollectionUri' AS cosmik_collection_uri,
                pgn.metadata->>'cosmikCollectionCid' AS cosmik_collection_cid,
                pgn.metadata->'cosmikItems' AS cosmik_items
         FROM collections_index c
         LEFT JOIN collection_edges_index e
           ON e.source_uri = c.uri AND e.relation_slug = 'contains'
         LEFT JOIN collection_edges_index parent_edge
           ON parent_edge.source_uri = c.uri AND parent_edge.relation_slug = 'subcollection-of'
         LEFT JOIN personal_graph_nodes_index pgn
           ON pgn.uri = c.uri
         WHERE c.uri = $1
           AND (c.visibility = 'listed' OR c.owner_did = $2)
         GROUP BY c.uri, c.cid, c.owner_did, c.label, c.description,
                  c.visibility, c.created_at, c.updated_at,
                  parent_edge.target_uri, pgn.metadata`,
        [uri, authDid ?? '']
      );

      const row = result.rows[0];
      if (!row) {
        return null;
      }

      return this.rowToIndexedCollection(row);
    } catch (error) {
      this.logger.error('Failed to get collection', error instanceof Error ? error : undefined, {
        uri,
      });
      return null;
    }
  }

  /**
   * Retrieves all items in a collection, with resolved metadata for eprints.
   *
   * @param collectionUri - AT URI of the collection
   * @returns Ordered list of collection items
   *
   * @public
   */
  async getCollectionItems(
    collectionUri: AtUri,
    options?: { excludeSubcollectionItems?: boolean }
  ): Promise<Result<CollectionItem[], DatabaseError>> {
    try {
      let sql = `SELECT e.uri, e.target_uri, e.weight, e.label AS edge_label, e.created_at,
                pgn.label AS node_label, pgn.kind AS node_kind,
                pgn.subkind AS node_subkind, pgn.description AS node_description,
                pgn.metadata AS node_metadata
         FROM collection_edges_index e
         INNER JOIN personal_graph_nodes_index pgn ON pgn.uri = e.target_uri
         WHERE e.source_uri = $1 AND e.relation_slug = 'contains'`;

      if (options?.excludeSubcollectionItems) {
        sql += `
           AND e.target_uri NOT IN (
             SELECT sub_items.target_uri
             FROM collection_edges_index sub_rel
             JOIN collection_edges_index sub_items
               ON sub_items.source_uri = sub_rel.source_uri AND sub_items.relation_slug = 'contains'
             WHERE sub_rel.target_uri = $1 AND sub_rel.relation_slug = 'subcollection-of'
           )`;
      }

      sql += ` ORDER BY COALESCE(e.weight, 999999), e.created_at ASC`;

      const result = await this.pool.query<{
        uri: string;
        target_uri: string;
        weight: number | null;
        edge_label: string | null;
        created_at: Date;
        node_label: string | null;
        node_kind: string | null;
        node_subkind: string | null;
        node_description: string | null;
        node_metadata: Record<string, unknown> | null;
      }>(sql, [collectionUri]);

      return Ok(
        result.rows.map((row, index) => {
          const nodeMetadata = row.node_metadata ?? {};
          const authors = Array.isArray(nodeMetadata.authors)
            ? (nodeMetadata.authors as string[])
            : undefined;

          return {
            edgeUri: row.uri,
            itemUri: row.target_uri,
            itemType: row.node_subkind ?? row.node_kind ?? 'unknown',
            order: row.weight ?? index + 1,
            addedAt: new Date(row.created_at),
            title: row.edge_label ?? row.node_label ?? undefined,
            label: row.edge_label ?? row.node_label ?? undefined,
            authors,
            kind: row.node_kind ?? undefined,
            subkind: row.node_subkind ?? undefined,
            description: row.node_description ?? undefined,
            metadata: nodeMetadata,
          };
        })
      );
    } catch (error) {
      const dbError = new DatabaseError(
        'READ',
        `Failed to get collection items: ${error instanceof Error ? error.message : String(error)}`
      );
      this.logger.error('Failed to get collection items', dbError, { collectionUri });
      return Err(dbError);
    }
  }

  /**
   * Retrieves inter-item edges between items within a collection.
   *
   * @remarks
   * Finds edges in `personal_graph_edges_index` where both source and target
   * are items in the given collection. Excludes `contains` and `subcollection-of`
   * edges which are structural, not semantic.
   *
   * @param collectionUri - AT URI of the collection
   * @returns Edges between items in the collection
   *
   * @public
   */
  async getInterItemEdges(collectionUri: AtUri): Promise<InterItemEdge[]> {
    try {
      const result = await this.pool.query<{
        uri: string;
        source_uri: string;
        target_uri: string;
        relation_slug: string;
      }>(
        `SELECT pge.uri, pge.source_uri, pge.target_uri, pge.relation_slug
         FROM personal_graph_edges_index pge
         WHERE pge.source_uri IN (
           SELECT ce.target_uri FROM collection_edges_index ce
           WHERE ce.source_uri = $1 AND ce.relation_slug = 'contains'
         )
         AND pge.target_uri IN (
           SELECT ce.target_uri FROM collection_edges_index ce
           WHERE ce.source_uri = $1 AND ce.relation_slug = 'contains'
         )
         AND pge.relation_slug NOT IN ('contains', 'subcollection-of')`,
        [collectionUri]
      );

      return result.rows.map((row) => ({
        uri: row.uri,
        sourceUri: row.source_uri,
        targetUri: row.target_uri,
        relationSlug: row.relation_slug,
      }));
    } catch (error) {
      this.logger.error(
        'Failed to get inter-item edges',
        error instanceof Error ? error : undefined,
        { collectionUri }
      );
      return [];
    }
  }

  /**
   * Lists collections owned by a user.
   *
   * @param did - DID of the collection owner
   * @param options - Pagination options
   * @returns Paginated list of collections
   *
   * @public
   */
  async listByOwner(
    did: DID,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<IndexedCollection>> {
    const limit = Math.min(options.limit ?? 50, 100);

    try {
      const countResult = await this.pool.query<{ count: string }>(
        'SELECT COUNT(*)::text AS count FROM collections_index WHERE owner_did = $1',
        [did]
      );
      const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

      let query = `SELECT c.uri, c.cid, c.owner_did, c.label, c.description, c.visibility,
                          c.created_at, c.updated_at,
                          COUNT(e.uri)::text AS item_count,
                          parent_edge.target_uri AS parent_collection_uri,
                          pgn.metadata->>'cosmikCollectionUri' AS cosmik_collection_uri,
                          pgn.metadata->>'cosmikCollectionCid' AS cosmik_collection_cid
                   FROM collections_index c
                   LEFT JOIN collection_edges_index e
                     ON e.source_uri = c.uri AND e.relation_slug = 'contains'
                   LEFT JOIN collection_edges_index parent_edge
                     ON parent_edge.source_uri = c.uri AND parent_edge.relation_slug = 'subcollection-of'
                   LEFT JOIN personal_graph_nodes_index pgn
                     ON pgn.uri = c.uri
                   WHERE c.owner_did = $1`;
      const params: unknown[] = [did];

      if (options.cursor) {
        const parts = options.cursor.split('::');
        const timestamp = parts[0] ?? new Date().toISOString();
        const cursorUri = parts[1] ?? '';
        query += ` AND (c.created_at, c.uri) < ($2, $3)`;
        params.push(new Date(timestamp), cursorUri);
      }

      query += ` GROUP BY c.uri, c.cid, c.owner_did, c.label, c.description,
                          c.visibility, c.created_at, c.updated_at,
                          parent_edge.target_uri, pgn.metadata
                 ORDER BY c.created_at DESC, c.uri DESC
                 LIMIT $${params.length + 1}`;
      params.push(limit + 1);

      const result = await this.pool.query<{
        uri: string;
        cid: string;
        owner_did: string;
        label: string;
        description: string | null;
        visibility: string;
        created_at: Date;
        updated_at: Date | null;
        item_count: string;
        parent_collection_uri: string | null;
        cosmik_collection_uri: string | null;
        cosmik_collection_cid: string | null;
      }>(query, params);

      const hasMore = result.rows.length > limit;
      const items = result.rows.slice(0, limit);

      let cursor: string | undefined;
      const lastItem = items[items.length - 1];
      if (hasMore && lastItem) {
        cursor = `${lastItem.created_at.toISOString()}::${lastItem.uri}`;
      }

      return {
        items: items.map((row) => this.rowToIndexedCollection(row)),
        cursor,
        hasMore,
        total,
      };
    } catch (error) {
      this.logger.error(
        'Failed to list collections by owner',
        error instanceof Error ? error : undefined,
        { did }
      );
      return { items: [], hasMore: false, total: 0 };
    }
  }

  /**
   * Lists public collections across all users, with optional tag filtering.
   *
   * @param options - Pagination and tag filter options
   * @returns Paginated list of public collections
   *
   * @public
   */
  async listPublic(
    options: PaginationOptions & { tag?: string } = {}
  ): Promise<PaginatedResult<IndexedCollection>> {
    const limit = Math.min(options.limit ?? 50, 100);

    try {
      let countSql = `SELECT COUNT(*)::text AS count FROM collections_index WHERE visibility = 'listed'`;
      const countParams: unknown[] = [];

      if (options.tag) {
        countSql += ` AND tags @> $${countParams.length + 1}::jsonb`;
        countParams.push(JSON.stringify([options.tag]));
      }

      const countResult = await this.pool.query<{ count: string }>(countSql, countParams);
      const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

      let query = `SELECT c.uri, c.cid, c.owner_did, c.label, c.description, c.visibility,
                          c.created_at, c.updated_at,
                          COUNT(e.uri)::text AS item_count,
                          parent_edge.target_uri AS parent_collection_uri,
                          pgn.metadata->>'cosmikCollectionUri' AS cosmik_collection_uri,
                          pgn.metadata->>'cosmikCollectionCid' AS cosmik_collection_cid
                   FROM collections_index c
                   LEFT JOIN collection_edges_index e
                     ON e.source_uri = c.uri AND e.relation_slug = 'contains'
                   LEFT JOIN collection_edges_index parent_edge
                     ON parent_edge.source_uri = c.uri AND parent_edge.relation_slug = 'subcollection-of'
                   LEFT JOIN personal_graph_nodes_index pgn
                     ON pgn.uri = c.uri
                   WHERE c.visibility = 'listed'`;
      const params: unknown[] = [];

      if (options.tag) {
        params.push(JSON.stringify([options.tag]));
        query += ` AND c.tags @> $${params.length}::jsonb`;
      }

      if (options.cursor) {
        const parts = options.cursor.split('::');
        const timestamp = parts[0] ?? new Date().toISOString();
        const cursorUri = parts[1] ?? '';
        query += ` AND (c.created_at, c.uri) < ($${params.length + 1}, $${params.length + 2})`;
        params.push(new Date(timestamp), cursorUri);
      }

      query += ` GROUP BY c.uri, c.cid, c.owner_did, c.label, c.description,
                          c.visibility, c.created_at, c.updated_at,
                          parent_edge.target_uri, pgn.metadata
                 ORDER BY c.created_at DESC, c.uri DESC
                 LIMIT $${params.length + 1}`;
      params.push(limit + 1);

      const result = await this.pool.query<{
        uri: string;
        cid: string;
        owner_did: string;
        label: string;
        description: string | null;
        visibility: string;
        created_at: Date;
        updated_at: Date | null;
        item_count: string;
        parent_collection_uri: string | null;
        cosmik_collection_uri: string | null;
        cosmik_collection_cid: string | null;
      }>(query, params);

      const hasMore = result.rows.length > limit;
      const items = result.rows.slice(0, limit);

      let cursor: string | undefined;
      const lastItem = items[items.length - 1];
      if (hasMore && lastItem) {
        cursor = `${lastItem.created_at.toISOString()}::${lastItem.uri}`;
      }

      return {
        items: items.map((row) => this.rowToIndexedCollection(row)),
        cursor,
        hasMore,
        total,
      };
    } catch (error) {
      this.logger.error(
        'Failed to list public collections',
        error instanceof Error ? error : undefined
      );
      return { items: [], hasMore: false, total: 0 };
    }
  }

  /**
   * Searches collections by text query across label and description.
   *
   * @param query - Text search query
   * @param options - Pagination options plus optional visibility and owner filters
   * @returns Paginated list of matching collections
   *
   * @public
   */
  async searchCollections(
    query: string,
    options: PaginationOptions & { visibility?: 'listed' | 'unlisted'; ownerDid?: DID } = {}
  ): Promise<PaginatedResult<IndexedCollection>> {
    const limit = Math.min(options.limit ?? 50, 100);
    const searchPattern = `%${query}%`;

    try {
      // Count total matches
      let countSql = `SELECT COUNT(*)::text AS count
                      FROM collections_index
                      WHERE (label ILIKE $1 OR description ILIKE $1)`;
      const countParams: unknown[] = [searchPattern];

      if (options.visibility) {
        countSql += ` AND visibility = $${countParams.length + 1}`;
        countParams.push(options.visibility);
      }
      if (options.ownerDid) {
        countSql += ` AND owner_did = $${countParams.length + 1}`;
        countParams.push(options.ownerDid);
      }

      const countResult = await this.pool.query<{ count: string }>(countSql, countParams);
      const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

      // Build main query
      let sql = `SELECT c.uri, c.cid, c.owner_did, c.label, c.description, c.visibility,
                        c.created_at, c.updated_at,
                        COUNT(e.uri)::text AS item_count,
                        parent_edge.target_uri AS parent_collection_uri,
                        pgn.metadata->>'cosmikCollectionUri' AS cosmik_collection_uri,
                        pgn.metadata->>'cosmikCollectionCid' AS cosmik_collection_cid
                 FROM collections_index c
                 LEFT JOIN collection_edges_index e
                   ON e.source_uri = c.uri AND e.relation_slug = 'contains'
                 LEFT JOIN collection_edges_index parent_edge
                   ON parent_edge.source_uri = c.uri AND parent_edge.relation_slug = 'subcollection-of'
                 LEFT JOIN personal_graph_nodes_index pgn
                   ON pgn.uri = c.uri
                 WHERE (c.label ILIKE $1 OR c.description ILIKE $1)`;
      const params: unknown[] = [searchPattern];

      if (options.visibility) {
        sql += ` AND c.visibility = $${params.length + 1}`;
        params.push(options.visibility);
      }
      if (options.ownerDid) {
        sql += ` AND c.owner_did = $${params.length + 1}`;
        params.push(options.ownerDid);
      }

      if (options.cursor) {
        const parts = options.cursor.split('::');
        const timestamp = parts[0] ?? new Date().toISOString();
        const cursorUri = parts[1] ?? '';
        sql += ` AND (c.created_at, c.uri) < ($${params.length + 1}, $${params.length + 2})`;
        params.push(new Date(timestamp), cursorUri);
      }

      sql += ` GROUP BY c.uri, c.cid, c.owner_did, c.label, c.description,
                        c.visibility, c.created_at, c.updated_at,
                        parent_edge.target_uri, pgn.metadata
               ORDER BY c.created_at DESC, c.uri DESC
               LIMIT $${params.length + 1}`;
      params.push(limit + 1);

      const result = await this.pool.query<{
        uri: string;
        cid: string;
        owner_did: string;
        label: string;
        description: string | null;
        visibility: string;
        created_at: Date;
        updated_at: Date | null;
        item_count: string;
        parent_collection_uri: string | null;
        cosmik_collection_uri: string | null;
        cosmik_collection_cid: string | null;
      }>(sql, params);

      const hasMore = result.rows.length > limit;
      const items = result.rows.slice(0, limit);

      let cursor: string | undefined;
      const lastItem = items[items.length - 1];
      if (hasMore && lastItem) {
        cursor = `${lastItem.created_at.toISOString()}::${lastItem.uri}`;
      }

      return {
        items: items.map((row) => this.rowToIndexedCollection(row)),
        cursor,
        hasMore,
        total,
      };
    } catch (error) {
      this.logger.error(
        'Failed to search collections',
        error instanceof Error ? error : undefined,
        { query }
      );
      return { items: [], hasMore: false, total: 0 };
    }
  }

  /**
   * Finds all collections containing a given item URI.
   *
   * @param itemUri - AT URI of the item (e.g., eprint submission)
   * @param authDid - Authenticated user DID (for visibility filtering)
   * @returns Collections containing the item
   *
   * @public
   */
  async getCollectionsContaining(itemUri: AtUri, authDid?: DID): Promise<IndexedCollection[]> {
    try {
      const result = await this.pool.query<{
        uri: string;
        cid: string;
        owner_did: string;
        label: string;
        description: string | null;
        visibility: string;
        created_at: Date;
        updated_at: Date | null;
        item_count: string;
        parent_collection_uri: string | null;
        cosmik_collection_uri: string | null;
        cosmik_collection_cid: string | null;
      }>(
        `SELECT c.uri, c.cid, c.owner_did, c.label, c.description, c.visibility,
                c.created_at, c.updated_at,
                COUNT(e2.uri)::text AS item_count,
                parent_edge.target_uri AS parent_collection_uri,
                pgn.metadata->>'cosmikCollectionUri' AS cosmik_collection_uri,
                pgn.metadata->>'cosmikCollectionCid' AS cosmik_collection_cid
         FROM collections_index c
         INNER JOIN collection_edges_index e
           ON e.source_uri = c.uri AND e.target_uri = $1 AND e.relation_slug = 'contains'
         LEFT JOIN collection_edges_index e2
           ON e2.source_uri = c.uri AND e2.relation_slug = 'contains'
         LEFT JOIN collection_edges_index parent_edge
           ON parent_edge.source_uri = c.uri AND parent_edge.relation_slug = 'subcollection-of'
         LEFT JOIN personal_graph_nodes_index pgn
           ON pgn.uri = c.uri
         WHERE (c.visibility = 'listed' OR c.owner_did = $2)
         GROUP BY c.uri, c.cid, c.owner_did, c.label, c.description,
                  c.visibility, c.created_at, c.updated_at,
                  parent_edge.target_uri, pgn.metadata
         ORDER BY c.created_at DESC`,
        [itemUri, authDid ?? '']
      );

      return result.rows.map((row) => this.rowToIndexedCollection(row));
    } catch (error) {
      this.logger.error(
        'Failed to get collections containing item',
        error instanceof Error ? error : undefined,
        { itemUri }
      );
      return [];
    }
  }

  /**
   * Retrieves subcollections of a given collection.
   *
   * @param collectionUri - AT URI of the parent collection
   * @param authDid - Authenticated user DID (for visibility filtering)
   * @returns Subcollections linked via SUBCOLLECTION_OF edges
   *
   * @remarks
   * Finds collections where a SUBCOLLECTION_OF edge has source_uri = child
   * and target_uri = collectionUri. Private subcollections are only visible
   * to their owner.
   *
   * @public
   */
  async getSubcollections(collectionUri: AtUri, authDid?: DID): Promise<IndexedCollection[]> {
    try {
      const result = await this.pool.query<{
        uri: string;
        cid: string;
        owner_did: string;
        label: string;
        description: string | null;
        visibility: string;
        created_at: Date;
        updated_at: Date | null;
        item_count: string;
        cosmik_collection_uri: string | null;
        cosmik_collection_cid: string | null;
        cosmik_items: Record<string, unknown> | null;
      }>(
        `SELECT c.uri, c.cid, c.owner_did, c.label, c.description, c.visibility,
                c.created_at, c.updated_at,
                COUNT(e2.uri)::text AS item_count,
                pgn.metadata->>'cosmikCollectionUri' AS cosmik_collection_uri,
                pgn.metadata->>'cosmikCollectionCid' AS cosmik_collection_cid,
                pgn.metadata->'cosmikItems' AS cosmik_items
         FROM collections_index c
         INNER JOIN collection_edges_index e
           ON e.source_uri = c.uri AND e.target_uri = $1 AND e.relation_slug = 'subcollection-of'
         LEFT JOIN collection_edges_index e2
           ON e2.source_uri = c.uri AND e2.relation_slug = 'contains'
         LEFT JOIN personal_graph_nodes_index pgn
           ON pgn.uri = c.uri
         WHERE (c.visibility = 'listed' OR c.owner_did = $2)
         GROUP BY c.uri, c.cid, c.owner_did, c.label, c.description,
                  c.visibility, c.created_at, c.updated_at,
                  pgn.metadata
         ORDER BY c.label ASC`,
        [collectionUri, authDid ?? '']
      );

      return result.rows.map((row) => this.rowToIndexedCollection(row));
    } catch (error) {
      this.logger.error(
        'Failed to get subcollections',
        error instanceof Error ? error : undefined,
        { collectionUri }
      );
      return [];
    }
  }

  /**
   * Retrieves the parent collection of a given collection.
   *
   * @param collectionUri - AT URI of the child collection
   * @param authDid - Authenticated user DID (for visibility filtering)
   * @returns Parent collection or null if this is a root collection or not authorized
   *
   * @public
   */
  async getParentCollection(
    collectionUri: AtUri,
    authDid?: DID
  ): Promise<IndexedCollection | null> {
    try {
      const result = await this.pool.query<{
        uri: string;
        cid: string;
        owner_did: string;
        label: string;
        description: string | null;
        visibility: string;
        created_at: Date;
        updated_at: Date | null;
        item_count: string;
        cosmik_collection_uri: string | null;
        cosmik_collection_cid: string | null;
        cosmik_items: Record<string, unknown> | null;
      }>(
        `SELECT c.uri, c.cid, c.owner_did, c.label, c.description, c.visibility,
                c.created_at, c.updated_at,
                COUNT(e2.uri)::text AS item_count,
                pgn.metadata->>'cosmikCollectionUri' AS cosmik_collection_uri,
                pgn.metadata->>'cosmikCollectionCid' AS cosmik_collection_cid,
                pgn.metadata->'cosmikItems' AS cosmik_items
         FROM collections_index c
         INNER JOIN collection_edges_index e
           ON e.target_uri = c.uri AND e.source_uri = $1 AND e.relation_slug = 'subcollection-of'
         LEFT JOIN collection_edges_index e2
           ON e2.source_uri = c.uri AND e2.relation_slug = 'contains'
         LEFT JOIN personal_graph_nodes_index pgn
           ON pgn.uri = c.uri
         WHERE (c.visibility = 'listed' OR c.owner_did = $2)
         GROUP BY c.uri, c.cid, c.owner_did, c.label, c.description,
                  c.visibility, c.created_at, c.updated_at,
                  pgn.metadata
         LIMIT 1`,
        [collectionUri, authDid ?? '']
      );

      const row = result.rows[0];
      if (!row) {
        return null;
      }

      return this.rowToIndexedCollection(row);
    } catch (error) {
      this.logger.error(
        'Failed to get parent collection',
        error instanceof Error ? error : undefined,
        { collectionUri }
      );
      return null;
    }
  }

  /**
   * Retrieves profile display configuration for a user.
   *
   * @param did - DID of the user
   * @returns ProfileConfig or null if no configuration exists
   *
   * @public
   */
  async getProfileConfig(did: DID): Promise<ProfileConfig | null> {
    try {
      const result = await this.pool.query<{
        did: string;
        uri: string;
        profile_type: string | null;
        sections: unknown;
        featured_collection_uri: string | null;
      }>(
        `SELECT did, uri, profile_type, sections, featured_collection_uri
         FROM profile_config
         WHERE did = $1`,
        [did]
      );

      const row = result.rows[0];
      if (!row) {
        return null;
      }

      const parseJsonb = <T>(val: unknown): T | undefined => {
        if (val == null) return undefined;
        if (typeof val === 'string') return JSON.parse(val) as T;
        return val as T;
      };

      return {
        did: row.did as DID,
        uri: row.uri as AtUri,
        profileType: row.profile_type ?? 'individual',
        sections: parseJsonb<ProfileSection[]>(row.sections) ?? [],
        featuredCollectionUri: row.featured_collection_uri
          ? (row.featured_collection_uri as AtUri)
          : undefined,
      };
    } catch (error) {
      this.logger.error(
        'Failed to get profile config',
        error instanceof Error ? error : undefined,
        { did }
      );
      return null;
    }
  }

  /**
   * Checks whether adding a subcollection-of edge from sourceUri to
   * targetUri would create a cycle in the hierarchy.
   *
   * @remarks
   * Walks the ancestor chain starting from targetUri using a recursive CTE.
   * If sourceUri appears among the ancestors of targetUri, adding this edge
   * would create a cycle.
   *
   * @param sourceUri - The child collection URI
   * @param targetUri - The proposed parent collection URI
   * @returns True if a cycle would be created
   *
   * @internal
   */
  private async wouldCreateCycle(sourceUri: string, targetUri: string): Promise<boolean> {
    const result = await this.pool.query<{ found: number }>(
      `WITH RECURSIVE ancestors AS (
        SELECT target_uri FROM collection_edges_index
          WHERE source_uri = $1 AND relation_slug = 'subcollection-of'
        UNION
        SELECT e.target_uri FROM collection_edges_index e
          INNER JOIN ancestors a ON a.target_uri = e.source_uri
          WHERE e.relation_slug = 'subcollection-of'
      ) SELECT 1 AS found FROM ancestors WHERE target_uri = $2 LIMIT 1`,
      [targetUri, sourceUri]
    );
    return result.rows.length > 0;
  }

  /**
   * Returns a chronological activity feed for a collection.
   *
   * @param collectionUri - AT-URI of the collection
   * @param options - pagination options (limit, cursor)
   * @returns paginated feed events or DatabaseError
   */
  async getCollectionFeed(
    collectionUri: AtUri,
    options: { limit?: number; cursor?: string } = {}
  ): Promise<Result<CollectionFeedResult, DatabaseError>> {
    const limit = Math.min(options.limit ?? 30, 100);
    const innerLimit = Math.max(limit * 5, 200);

    try {
      // Parse compound cursor: "{ISO-8601}::{eventUri}"
      let cursorTs: Date | null = null;
      let cursorUri: string | null = null;
      if (options.cursor) {
        const sep = options.cursor.indexOf('::');
        if (sep > 0) {
          cursorTs = new Date(options.cursor.slice(0, sep));
          cursorUri = options.cursor.slice(sep + 2);
        }
      }

      const params: unknown[] = [collectionUri];
      let paramIdx = 1;

      const nextParam = (value: unknown): string => {
        paramIdx++;
        params.push(value);
        return `$${paramIdx}`;
      };

      // CTE: materialize collection items once
      const cte = `
        WITH collection_items AS (
          SELECT
            cei.target_uri AS item_uri,
            pgn.subkind,
            pgn.node_id,
            pgn.label,
            pgn.metadata,
            cei.created_at AS added_at
          FROM collection_edges_index cei
          JOIN personal_graph_nodes_index pgn ON cei.target_uri = pgn.uri
          WHERE cei.source_uri = $1
            AND cei.relation_slug = 'contains'
        )`;

      // Branch 2: eprint_by_author
      const b2 = `
        (SELECT 'eprint_by_author' AS type,
               e.uri AS event_uri,
               e.created_at AS event_at,
               ci.item_uri AS collection_item_uri,
               'person' AS collection_item_subkind,
               ci.label AS collection_item_label,
               jsonb_build_object(
                 'eprintUri', e.uri,
                 'eprintTitle', e.title,
                 'authorNames', (SELECT jsonb_agg(a->>'name') FROM jsonb_array_elements(e.authors) a)
               ) AS payload
        FROM collection_items ci
        JOIN eprints_index e ON e.authors @> jsonb_build_array(jsonb_build_object('did', ci.metadata->>'did'))
        WHERE ci.subkind = 'person'
          AND ci.metadata->>'did' IS NOT NULL
          AND e.deleted_at IS NULL
        ORDER BY e.created_at DESC
        LIMIT ${innerLimit})`;

      // Branch 3: review_on_eprint
      const b3 = `
        (SELECT 'review_on_eprint' AS type,
               r.uri AS event_uri,
               r.created_at AS event_at,
               ci.item_uri AS collection_item_uri,
               'eprint' AS collection_item_subkind,
               ci.label AS collection_item_label,
               jsonb_build_object(
                 'reviewerDid', r.reviewer_did,
                 'eprintTitle', ci.label,
                 'snippet', LEFT((r.body->0->>'content'), 200)
               ) AS payload
        FROM collection_items ci
        JOIN reviews_index r ON r.eprint_uri = ci.metadata->>'eprintUri'
        WHERE ci.subkind = 'eprint'
          AND ci.metadata->>'eprintUri' IS NOT NULL
          AND r.deleted_at IS NULL
          AND r.parent_comment IS NULL
        ORDER BY r.created_at DESC
        LIMIT ${innerLimit})`;

      // Branch 4: endorsement_on_eprint
      const b4 = `
        (SELECT 'endorsement_on_eprint' AS type,
               en.uri AS event_uri,
               en.created_at AS event_at,
               ci.item_uri AS collection_item_uri,
               'eprint' AS collection_item_subkind,
               ci.label AS collection_item_label,
               jsonb_build_object(
                 'endorserDid', en.endorser_did,
                 'eprintTitle', ci.label,
                 'contributions', to_jsonb(en.contributions)
               ) AS payload
        FROM collection_items ci
        JOIN endorsements_index en ON en.eprint_uri = ci.metadata->>'eprintUri'
        WHERE ci.subkind = 'eprint'
          AND ci.metadata->>'eprintUri' IS NOT NULL
          AND en.deleted_at IS NULL
        ORDER BY en.created_at DESC
        LIMIT ${innerLimit})`;

      // Branch 5: annotation_on_eprint
      const b5 = `
        (SELECT 'annotation_on_eprint' AS type,
               an.uri AS event_uri,
               an.created_at AS event_at,
               ci.item_uri AS collection_item_uri,
               'eprint' AS collection_item_subkind,
               ci.label AS collection_item_label,
               jsonb_build_object(
                 'annotatorDid', an.annotator_did,
                 'eprintTitle', ci.label,
                 'snippet', LEFT((an.body->0->>'content'), 200)
               ) AS payload
        FROM collection_items ci
        JOIN annotations_index an ON an.eprint_uri = ci.metadata->>'eprintUri'
        WHERE ci.subkind = 'eprint'
          AND ci.metadata->>'eprintUri' IS NOT NULL
          AND an.deleted_at IS NULL
          AND an.parent_annotation IS NULL
        ORDER BY an.created_at DESC
        LIMIT ${innerLimit})`;

      // Branch 6: review_by_author
      const b6 = `
        (SELECT 'review_by_author' AS type,
               r.uri AS event_uri,
               r.created_at AS event_at,
               ci.item_uri AS collection_item_uri,
               'person' AS collection_item_subkind,
               ci.label AS collection_item_label,
               jsonb_build_object(
                 'reviewerDid', r.reviewer_did,
                 'eprintTitle', (SELECT title FROM eprints_index WHERE uri = r.eprint_uri),
                 'snippet', LEFT((r.body->0->>'content'), 200)
               ) AS payload
        FROM collection_items ci
        JOIN reviews_index r ON r.reviewer_did = ci.metadata->>'did'
        WHERE ci.subkind = 'person'
          AND ci.metadata->>'did' IS NOT NULL
          AND r.deleted_at IS NULL
          AND r.parent_comment IS NULL
        ORDER BY r.created_at DESC
        LIMIT ${innerLimit})`;

      // Branch 7: endorsement_by_author
      const b7 = `
        (SELECT 'endorsement_by_author' AS type,
               en.uri AS event_uri,
               en.created_at AS event_at,
               ci.item_uri AS collection_item_uri,
               'person' AS collection_item_subkind,
               ci.label AS collection_item_label,
               jsonb_build_object(
                 'endorserDid', en.endorser_did,
                 'eprintTitle', (SELECT title FROM eprints_index WHERE uri = en.eprint_uri),
                 'contributions', to_jsonb(en.contributions)
               ) AS payload
        FROM collection_items ci
        JOIN endorsements_index en ON en.endorser_did = ci.metadata->>'did'
        WHERE ci.subkind = 'person'
          AND ci.metadata->>'did' IS NOT NULL
          AND en.deleted_at IS NULL
        ORDER BY en.created_at DESC
        LIMIT ${innerLimit})`;

      // Branch 8: eprint_in_field
      const b8 = `
        (SELECT 'eprint_in_field' AS type,
               e.uri AS event_uri,
               e.created_at AS event_at,
               ci.item_uri AS collection_item_uri,
               'field' AS collection_item_subkind,
               ci.label AS collection_item_label,
               jsonb_build_object(
                 'fieldLabel', ci.label,
                 'eprintTitle', e.title,
                 'authorNames', (SELECT jsonb_agg(a->>'name') FROM jsonb_array_elements(e.authors) a)
               ) AS payload
        FROM collection_items ci
        JOIN eprints_index e ON e.fields @> jsonb_build_array(jsonb_build_object('uri', ci.metadata->>'clonedFrom'))
        WHERE ci.subkind = 'field'
          AND ci.metadata->>'clonedFrom' IS NOT NULL
          AND e.deleted_at IS NULL
        ORDER BY e.created_at DESC
        LIMIT ${innerLimit})`;

      // Branch 9: eprint_by_institution (dual: institutionUri OR rorId)
      const b9 = `
        (SELECT 'eprint_by_institution' AS type,
               e.uri AS event_uri,
               e.created_at AS event_at,
               ci.item_uri AS collection_item_uri,
               'institution' AS collection_item_subkind,
               ci.label AS collection_item_label,
               jsonb_build_object(
                 'institutionLabel', ci.label,
                 'eprintTitle', e.title,
                 'authorNames', (SELECT jsonb_agg(a->>'name') FROM jsonb_array_elements(e.authors) a)
               ) AS payload
        FROM collection_items ci
        JOIN eprints_index e ON (
          (ci.metadata->>'clonedFrom' IS NOT NULL AND e.authors @> jsonb_build_array(jsonb_build_object('affiliations', jsonb_build_array(jsonb_build_object('institutionUri', ci.metadata->>'clonedFrom')))))
          OR
          (ci.metadata->>'rorId' IS NOT NULL AND e.authors @> jsonb_build_array(jsonb_build_object('affiliations', jsonb_build_array(jsonb_build_object('rorId', ci.metadata->>'rorId')))))
        )
        WHERE ci.subkind = 'institution'
          AND e.deleted_at IS NULL
        ORDER BY e.created_at DESC
        LIMIT ${innerLimit})`;

      // Branch 10: eprint_at_event (dual: conferenceUri OR conferenceName)
      const b10 = `
        (SELECT 'eprint_at_event' AS type,
               e.uri AS event_uri,
               e.created_at AS event_at,
               ci.item_uri AS collection_item_uri,
               'event' AS collection_item_subkind,
               ci.label AS collection_item_label,
               jsonb_build_object(
                 'eventLabel', ci.label,
                 'eprintTitle', e.title,
                 'authorNames', (SELECT jsonb_agg(a->>'name') FROM jsonb_array_elements(e.authors) a)
               ) AS payload
        FROM collection_items ci
        JOIN eprints_index e ON (
          (ci.metadata->>'clonedFrom' IS NOT NULL AND e.conference_presentation->>'conferenceUri' = ci.metadata->>'clonedFrom')
          OR
          (ci.metadata->>'conferenceName' IS NOT NULL AND e.conference_presentation->>'conferenceName' = ci.metadata->>'conferenceName')
        )
        WHERE ci.subkind = 'event'
          AND e.conference_presentation IS NOT NULL
          AND e.deleted_at IS NULL
        ORDER BY e.created_at DESC
        LIMIT ${innerLimit})`;

      // Branch 11: eprint_referencing_person (via entity links)
      const b11 = `
        (SELECT 'eprint_referencing_person' AS type,
               el.uri AS event_uri,
               el.created_at AS event_at,
               ci.item_uri AS collection_item_uri,
               'person' AS collection_item_subkind,
               ci.label AS collection_item_label,
               jsonb_build_object(
                 'personLabel', ci.label,
                 'eprintUri', el.eprint_uri,
                 'entityLabel', el.entity_label
               ) AS payload
        FROM collection_items ci
        JOIN entity_links_index el ON (
          (ci.metadata->>'did' IS NOT NULL AND el.entity_data->>'did' = ci.metadata->>'did')
          OR
          (ci.metadata->>'clonedFrom' IS NOT NULL AND el.entity_data->>'uri' = ci.metadata->>'clonedFrom' AND el.entity_data->>'type' = 'graphNode')
        )
        WHERE ci.subkind = 'person'
          AND el.deleted_at IS NULL
        ORDER BY el.created_at DESC
        LIMIT ${innerLimit})`;

      // Assemble UNION ALL
      const unionBranches = [b2, b3, b4, b5, b6, b7, b8, b9, b10, b11].join(
        '\n        UNION ALL\n'
      );

      let outerWhere = '';
      if (cursorTs && cursorUri) {
        const tsParam = nextParam(cursorTs);
        const uriParam = nextParam(cursorUri);
        outerWhere = `WHERE (event_at, event_uri) < (${tsParam}, ${uriParam})`;
      }

      const limitParam = nextParam(limit + 1);

      // Deduplicate: a paper co-authored by two tracked people should appear once,
      // with all matching collection item labels aggregated into an array.
      // Note: MAX(jsonb) is not supported, so we use (array_agg(payload))[1] to
      // pick one payload (they're identical for the same event).
      const sql = `
        ${cte}
        SELECT * FROM (
          SELECT type, event_uri,
                 MAX(event_at) AS event_at,
                 MAX(collection_item_uri) AS collection_item_uri,
                 MAX(collection_item_subkind) AS collection_item_subkind,
                 jsonb_agg(jsonb_build_object('label', collection_item_label, 'uri', collection_item_uri) ORDER BY collection_item_label) AS collection_items,
                 (array_agg(payload))[1] AS payload
          FROM (
            ${unionBranches}
          ) raw_feed
          GROUP BY type, event_uri
        ) feed
        ${outerWhere}
        ORDER BY event_at DESC, event_uri DESC
        LIMIT ${limitParam}
      `;

      const result = await this.pool.query<{
        type: string;
        event_uri: string;
        event_at: Date;
        collection_item_uri: string;
        collection_item_subkind: string;
        collection_items: { label: string; uri: string }[];
        payload: Record<string, unknown>;
      }>(sql, params);

      const hasMore = result.rows.length > limit;
      const rows = result.rows.slice(0, limit);

      let cursor: string | undefined;
      const lastRow = rows[rows.length - 1];
      if (hasMore && lastRow) {
        cursor = `${lastRow.event_at.toISOString()}::${lastRow.event_uri}`;
      }

      const events: CollectionFeedEvent[] = rows.map((row) => ({
        type: row.type,
        eventUri: row.event_uri,
        eventAt: new Date(row.event_at),
        collectionItemUri: row.collection_item_uri,
        collectionItemSubkind: row.collection_item_subkind,
        collectionItems: (row.collection_items ?? []) as CollectionItemRef[],
        payload: (row.payload ?? {}) as FeedEventPayload,
      }));

      return Ok({ events, cursor, hasMore });
    } catch (error) {
      const dbError = new DatabaseError(
        'FEED_QUERY',
        `Failed to get collection feed: ${error instanceof Error ? error.message : String(error)}`
      );
      this.logger.error('Failed to get collection feed', dbError, { collectionUri });
      return Err(dbError);
    }
  }

  /**
   * Finds the CONTAINS edge between a collection and a specific item.
   *
   * @param collectionUri - AT URI of the collection
   * @param itemUri - AT URI of the item (personal graph node)
   * @returns Edge URI and metadata, or null if not found
   *
   * @public
   */
  async findContainsEdge(
    collectionUri: AtUri,
    itemUri: string
  ): Promise<{
    edgeUri: string;
    parentCollectionUri?: string;
    cosmikItems?: Record<
      string,
      { cardUri: string; cardCid: string; linkUri: string; linkCid: string }
    >;
  } | null> {
    try {
      const result = await this.pool.query<{
        edge_uri: string;
        parent_collection_uri: string | null;
        cosmik_items: Record<string, unknown> | null;
      }>(
        `SELECT e.uri AS edge_uri,
                parent_edge.target_uri AS parent_collection_uri,
                pgn.metadata->'cosmikItems' AS cosmik_items
         FROM collection_edges_index e
         LEFT JOIN personal_graph_nodes_index pgn
           ON pgn.uri = e.source_uri
         LEFT JOIN collection_edges_index parent_edge
           ON parent_edge.source_uri = e.source_uri AND parent_edge.relation_slug = 'subcollection-of'
         WHERE e.source_uri = $1
           AND e.target_uri = $2
           AND e.relation_slug = 'contains'
         LIMIT 1`,
        [collectionUri, itemUri]
      );

      const row = result.rows[0];
      if (!row) return null;

      return {
        edgeUri: row.edge_uri,
        parentCollectionUri: row.parent_collection_uri ?? undefined,
        cosmikItems: row.cosmik_items as
          | Record<string, { cardUri: string; cardCid: string; linkUri: string; linkCid: string }>
          | undefined,
      };
    } catch (error) {
      this.logger.error(
        'Failed to find contains edge',
        error instanceof Error ? error : undefined,
        { collectionUri, itemUri }
      );
      return null;
    }
  }

  // =========================================================================
  // COSMIK CONNECTIONS (edges between links)
  // =========================================================================

  /**
   * Retrieves Cosmik connections that reference items in a collection.
   *
   * @param collectionUri - AT URI of the collection
   * @returns Connections where source or target is an item in the collection
   *
   * @public
   */
  async getCosmikConnections(collectionUri: AtUri): Promise<
    {
      uri: string;
      sourceEntity: string;
      targetEntity: string;
      connectionType?: string;
      note?: string;
      chiveEdgeUri?: string;
    }[]
  > {
    try {
      const result = await this.pool.query<{
        uri: string;
        source_entity: string;
        target_entity: string;
        connection_type: string | null;
        note: string | null;
        chive_edge_uri: string | null;
      }>(
        `SELECT cc.uri, cc.source_entity, cc.target_entity,
                cc.connection_type, cc.note, cc.chive_edge_uri
         FROM cosmik_connections_index cc
         WHERE cc.chive_edge_uri IN (
           SELECT pge.uri FROM personal_graph_edges_index pge
           WHERE pge.source_uri IN (
             SELECT ce.target_uri FROM collection_edges_index ce
             WHERE ce.source_uri = $1 AND ce.relation_slug = 'contains'
           )
           AND pge.target_uri IN (
             SELECT ce.target_uri FROM collection_edges_index ce
             WHERE ce.source_uri = $1 AND ce.relation_slug = 'contains'
           )
           AND pge.relation_slug NOT IN ('contains', 'subcollection-of')
         )`,
        [collectionUri]
      );

      return result.rows.map((row) => ({
        uri: row.uri,
        sourceEntity: row.source_entity,
        targetEntity: row.target_entity,
        connectionType: row.connection_type ?? undefined,
        note: row.note ?? undefined,
        chiveEdgeUri: row.chive_edge_uri ?? undefined,
      }));
    } catch (error) {
      this.logger.error(
        'Failed to get Cosmik connections',
        error instanceof Error ? error : undefined,
        { collectionUri }
      );
      return [];
    }
  }

  /**
   * Indexes a Cosmik connection record from the firehose.
   *
   * @param record - Parsed connection record
   * @param metadata - Record metadata
   * @returns Result indicating success or failure
   *
   * @public
   */
  async indexCosmikConnection(
    record: {
      source: string;
      target: string;
      connectionType?: string;
      note?: string;
      /** Resolved Chive relation slug when the connectionType maps to one of our relations. */
      chiveRelationSlug?: string;
      /** AT-URI of the resolved Chive relation node. */
      chiveRelationUri?: string;
    },
    metadata: RecordMetadata
  ): Promise<Result<void, DatabaseError>> {
    try {
      const ownerDid = extractDidFromUri(metadata.uri);

      await this.pool.query(
        `INSERT INTO cosmik_connections_index (
          uri, cid, owner_did, source_entity, target_entity,
          connection_type, note, chive_relation_slug, chive_relation_uri,
          created_at, pds_url, indexed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        ON CONFLICT (uri) DO UPDATE SET
          cid = EXCLUDED.cid,
          source_entity = EXCLUDED.source_entity,
          target_entity = EXCLUDED.target_entity,
          connection_type = EXCLUDED.connection_type,
          note = EXCLUDED.note,
          chive_relation_slug = EXCLUDED.chive_relation_slug,
          chive_relation_uri = EXCLUDED.chive_relation_uri,
          updated_at = NOW()`,
        [
          metadata.uri,
          metadata.cid,
          ownerDid,
          record.source,
          record.target,
          record.connectionType ?? null,
          record.note ?? null,
          record.chiveRelationSlug ?? null,
          record.chiveRelationUri ?? null,
          metadata.indexedAt,
          metadata.pdsUrl,
        ]
      );

      return Ok(undefined);
    } catch (error) {
      const dbError = new DatabaseError(
        'WRITE',
        `Failed to index Cosmik connection: ${error instanceof Error ? error.message : String(error)}`
      );
      this.logger.error('Failed to index Cosmik connection', dbError, { uri: metadata.uri });
      return Err(dbError);
    }
  }

  /**
   * Deletes a Cosmik connection from the index.
   *
   * @param uri - AT URI of the connection
   * @returns Result indicating success or failure
   *
   * @public
   */
  async deleteCosmikConnection(uri: AtUri): Promise<Result<void, DatabaseError>> {
    try {
      await this.pool.query('DELETE FROM cosmik_connections_index WHERE uri = $1', [uri]);
      return Ok(undefined);
    } catch (error) {
      const dbError = new DatabaseError(
        'DELETE',
        `Failed to delete Cosmik connection: ${error instanceof Error ? error.message : String(error)}`
      );
      return Err(dbError);
    }
  }

  // =========================================================================
  // COSMIK FOLLOWS
  // =========================================================================

  /**
   * Gets the follower count for a collection.
   *
   * @param collectionUri - AT URI of the collection (as a Cosmik subject)
   * @returns Number of followers
   *
   * @public
   */
  async getFollowerCount(collectionUri: AtUri): Promise<number> {
    try {
      const result = await this.pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM cosmik_follows_index
         WHERE subject = $1 AND subject_type = 'collection'`,
        [collectionUri]
      );
      return parseInt(result.rows[0]?.count ?? '0', 10);
    } catch (error) {
      this.logger.error(
        'Failed to get follower count',
        error instanceof Error ? error : undefined,
        { collectionUri }
      );
      return 0;
    }
  }

  /**
   * Checks if a user follows a collection.
   *
   * @param followerDid - DID of the follower
   * @param subject - AT URI of the collection
   * @returns Follow URI if following, null otherwise
   *
   * @public
   */
  async getFollowStatus(followerDid: DID, subject: string): Promise<string | null> {
    try {
      const result = await this.pool.query<{ uri: string }>(
        `SELECT uri FROM cosmik_follows_index
         WHERE follower_did = $1 AND subject = $2
         LIMIT 1`,
        [followerDid, subject]
      );
      return result.rows[0]?.uri ?? null;
    } catch (error) {
      this.logger.error('Failed to get follow status', error instanceof Error ? error : undefined, {
        followerDid,
        subject,
      });
      return null;
    }
  }

  /**
   * Indexes a Cosmik follow record from the firehose.
   *
   * @param record - Parsed follow record
   * @param metadata - Record metadata
   * @returns Result indicating success or failure
   *
   * @public
   */
  async indexCosmikFollow(
    record: { subject: string; createdAt: string },
    metadata: RecordMetadata
  ): Promise<Result<void, DatabaseError>> {
    try {
      const followerDid = extractDidFromUri(metadata.uri);
      const subjectType = record.subject.startsWith('did:') ? 'user' : 'collection';

      await this.pool.query(
        `INSERT INTO cosmik_follows_index (
          uri, cid, follower_did, subject, subject_type, created_at, pds_url, indexed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (uri) DO NOTHING`,
        [
          metadata.uri,
          metadata.cid,
          followerDid,
          record.subject,
          subjectType,
          new Date(record.createdAt),
          metadata.pdsUrl,
        ]
      );

      return Ok(undefined);
    } catch (error) {
      const dbError = new DatabaseError(
        'WRITE',
        `Failed to index Cosmik follow: ${error instanceof Error ? error.message : String(error)}`
      );
      this.logger.error('Failed to index Cosmik follow', dbError, { uri: metadata.uri });
      return Err(dbError);
    }
  }

  /**
   * Deletes a Cosmik follow from the index.
   *
   * @param uri - AT URI of the follow record
   * @returns Result indicating success or failure
   *
   * @public
   */
  async deleteCosmikFollow(uri: AtUri): Promise<Result<void, DatabaseError>> {
    try {
      await this.pool.query('DELETE FROM cosmik_follows_index WHERE uri = $1', [uri]);
      return Ok(undefined);
    } catch (error) {
      const dbError = new DatabaseError(
        'DELETE',
        `Failed to delete Cosmik follow: ${error instanceof Error ? error.message : String(error)}`
      );
      return Err(dbError);
    }
  }

  // =========================================================================
  // MARGIN ANNOTATIONS
  // =========================================================================

  /**
   * Retrieves Margin annotations targeting a specific eprint.
   *
   * @param eprintUri - AT URI of the eprint
   * @param options - Pagination options
   * @returns Paginated list of Margin annotations
   *
   * @public
   */
  async getMarginAnnotationsForEprint(
    eprintUri: AtUri,
    options: PaginationOptions = {}
  ): Promise<
    PaginatedResult<{
      uri: string;
      authorDid: string;
      recordType: string;
      motivation?: string;
      body?: string;
      bodyFormat?: string;
      pageTitle?: string;
      selectorJson?: Record<string, unknown>;
      color?: string;
      tags?: string[];
      createdAt: Date;
    }>
  > {
    const limit = Math.min(options.limit ?? 50, 100);

    try {
      const countResult = await this.pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM margin_annotations_index WHERE eprint_uri = $1`,
        [eprintUri]
      );
      const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

      let sql = `SELECT uri, author_did, record_type, motivation, body, body_format,
                        page_title, selector_json, color, tags, created_at
                 FROM margin_annotations_index
                 WHERE eprint_uri = $1`;
      const params: unknown[] = [eprintUri];

      if (options.cursor) {
        const parts = options.cursor.split('::');
        const timestamp = parts[0] ?? new Date().toISOString();
        const cursorUri = parts[1] ?? '';
        sql += ` AND (created_at, uri) < ($2, $3)`;
        params.push(new Date(timestamp), cursorUri);
      }

      sql += ` ORDER BY created_at DESC, uri DESC LIMIT $${params.length + 1}`;
      params.push(limit + 1);

      const result = await this.pool.query<{
        uri: string;
        author_did: string;
        record_type: string;
        motivation: string | null;
        body: string | null;
        body_format: string | null;
        page_title: string | null;
        selector_json: Record<string, unknown> | null;
        color: string | null;
        tags: string[] | null;
        created_at: Date;
      }>(sql, params);

      const hasMore = result.rows.length > limit;
      const items = result.rows.slice(0, limit);

      let cursor: string | undefined;
      const lastItem = items[items.length - 1];
      if (hasMore && lastItem) {
        cursor = `${lastItem.created_at.toISOString()}::${lastItem.uri}`;
      }

      return {
        items: items.map((row) => ({
          uri: row.uri,
          authorDid: row.author_did,
          recordType: row.record_type,
          motivation: row.motivation ?? undefined,
          body: row.body ?? undefined,
          bodyFormat: row.body_format ?? undefined,
          pageTitle: row.page_title ?? undefined,
          selectorJson: row.selector_json ?? undefined,
          color: row.color ?? undefined,
          tags: row.tags ?? undefined,
          createdAt: new Date(row.created_at),
        })),
        cursor,
        hasMore,
        total,
      };
    } catch (error) {
      this.logger.error(
        'Failed to get Margin annotations for eprint',
        error instanceof Error ? error : undefined,
        { eprintUri }
      );
      return { items: [], hasMore: false, total: 0 };
    }
  }

  /**
   * Indexes a Margin annotation or highlight record from the firehose.
   *
   * @param record - Parsed annotation/highlight record
   * @param metadata - Record metadata
   * @returns Result indicating success or failure
   *
   * @public
   */
  async indexMarginAnnotation(
    record: {
      recordType: 'annotation' | 'highlight';
      sourceUrl: string;
      sourceHash?: string;
      motivation?: string;
      body?: string;
      bodyFormat?: string;
      pageTitle?: string;
      selectorJson?: Record<string, unknown>;
      color?: string;
      tags?: string[];
      eprintUri?: string;
    },
    metadata: RecordMetadata
  ): Promise<Result<void, DatabaseError>> {
    try {
      const authorDid = extractDidFromUri(metadata.uri);

      await this.pool.query(
        `INSERT INTO margin_annotations_index (
          uri, cid, author_did, source_url, source_hash, record_type,
          motivation, body, body_format, page_title, selector_json,
          color, tags, eprint_uri, created_at, pds_url, indexed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13::jsonb, $14, $15, $16, NOW())
        ON CONFLICT (uri) DO UPDATE SET
          cid = EXCLUDED.cid,
          body = EXCLUDED.body,
          body_format = EXCLUDED.body_format,
          tags = EXCLUDED.tags`,
        [
          metadata.uri,
          metadata.cid,
          authorDid,
          record.sourceUrl,
          record.sourceHash ?? null,
          record.recordType,
          record.motivation ?? null,
          record.body ?? null,
          record.bodyFormat ?? null,
          record.pageTitle ?? null,
          record.selectorJson ? JSON.stringify(record.selectorJson) : null,
          record.color ?? null,
          record.tags ? JSON.stringify(record.tags) : null,
          record.eprintUri ?? null,
          metadata.indexedAt,
          metadata.pdsUrl,
        ]
      );

      return Ok(undefined);
    } catch (error) {
      const dbError = new DatabaseError(
        'WRITE',
        `Failed to index Margin annotation: ${error instanceof Error ? error.message : String(error)}`
      );
      this.logger.error('Failed to index Margin annotation', dbError, { uri: metadata.uri });
      return Err(dbError);
    }
  }

  /**
   * Deletes a Margin annotation from the index.
   *
   * @param uri - AT URI of the annotation
   * @returns Result indicating success or failure
   *
   * @public
   */
  async deleteMarginAnnotation(uri: AtUri): Promise<Result<void, DatabaseError>> {
    try {
      await this.pool.query('DELETE FROM margin_annotations_index WHERE uri = $1', [uri]);
      return Ok(undefined);
    } catch (error) {
      const dbError = new DatabaseError(
        'DELETE',
        `Failed to delete Margin annotation: ${error instanceof Error ? error.message : String(error)}`
      );
      return Err(dbError);
    }
  }

  /**
   * Indexes a Margin bookmark record from the firehose.
   *
   * @param record - Parsed bookmark record
   * @param metadata - Record metadata
   * @returns Result indicating success or failure
   *
   * @public
   */
  async indexMarginBookmark(
    record: {
      sourceUrl: string;
      sourceHash?: string;
      title?: string;
      description?: string;
      tags?: string[];
      eprintUri?: string;
    },
    metadata: RecordMetadata
  ): Promise<Result<void, DatabaseError>> {
    try {
      const authorDid = extractDidFromUri(metadata.uri);

      await this.pool.query(
        `INSERT INTO margin_bookmarks_index (
          uri, cid, author_did, source_url, source_hash, title,
          description, tags, eprint_uri, created_at, pds_url, indexed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, NOW())
        ON CONFLICT (uri) DO UPDATE SET
          cid = EXCLUDED.cid,
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          tags = EXCLUDED.tags`,
        [
          metadata.uri,
          metadata.cid,
          authorDid,
          record.sourceUrl,
          record.sourceHash ?? null,
          record.title ?? null,
          record.description ?? null,
          record.tags ? JSON.stringify(record.tags) : null,
          record.eprintUri ?? null,
          metadata.indexedAt,
          metadata.pdsUrl,
        ]
      );

      return Ok(undefined);
    } catch (error) {
      const dbError = new DatabaseError(
        'WRITE',
        `Failed to index Margin bookmark: ${error instanceof Error ? error.message : String(error)}`
      );
      this.logger.error('Failed to index Margin bookmark', dbError, { uri: metadata.uri });
      return Err(dbError);
    }
  }

  /**
   * Deletes a Margin bookmark from the index.
   *
   * @param uri - AT URI of the bookmark
   * @returns Result indicating success or failure
   *
   * @public
   */
  async deleteMarginBookmark(uri: AtUri): Promise<Result<void, DatabaseError>> {
    try {
      await this.pool.query('DELETE FROM margin_bookmarks_index WHERE uri = $1', [uri]);
      return Ok(undefined);
    } catch (error) {
      const dbError = new DatabaseError(
        'DELETE',
        `Failed to delete Margin bookmark: ${error instanceof Error ? error.message : String(error)}`
      );
      return Err(dbError);
    }
  }

  /**
   * Converts a database row to an IndexedCollection.
   *
   * @param row - Database row with collection fields
   * @returns IndexedCollection representation
   *
   * @internal
   */
  private rowToIndexedCollection(row: {
    uri: string;
    cid: string;
    owner_did: string;
    label: string;
    description: string | null;
    visibility: string;
    created_at: Date;
    updated_at: Date | null;
    item_count: string;
    parent_collection_uri?: string | null;
    cosmik_collection_uri?: string | null;
    cosmik_collection_cid?: string | null;
    cosmik_items?: Record<string, unknown> | null;
  }): IndexedCollection {
    return {
      uri: row.uri as AtUri,
      cid: row.cid,
      ownerDid: row.owner_did as DID,
      label: row.label,
      description: row.description ?? undefined,
      visibility:
        row.visibility === 'listed' || row.visibility === 'public' ? 'listed' : 'unlisted',
      itemCount: parseInt(row.item_count, 10),
      createdAt: new Date(row.created_at),
      updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
      parentCollectionUri: row.parent_collection_uri ?? undefined,
      cosmikCollectionUri: row.cosmik_collection_uri ?? undefined,
      cosmikCollectionCid: row.cosmik_collection_cid ?? undefined,
      cosmikItems: row.cosmik_items as IndexedCollection['cosmikItems'],
    };
  }
}
