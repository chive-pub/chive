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
  readonly config?: Record<string, unknown>;
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
  readonly visibility: 'public' | 'private';
  readonly itemCount: number;
  readonly createdAt: Date;
  readonly updatedAt?: Date;
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
      // Determine visibility from metadata; default to private
      const visibility =
        record.metadata && 'visibility' in record.metadata
          ? (record.metadata.visibility as string) === 'public'
            ? 'public'
            : 'private'
          : 'private';

      await this.pool.query(
        `INSERT INTO collections_index (
          uri, cid, owner_did, label, description, visibility,
          created_at, pds_url, indexed_at, last_synced_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        ON CONFLICT (uri) DO UPDATE SET
          cid = EXCLUDED.cid,
          label = EXCLUDED.label,
          description = EXCLUDED.description,
          visibility = EXCLUDED.visibility,
          updated_at = NOW(),
          last_synced_at = NOW()`,
        [
          metadata.uri,
          metadata.cid,
          ownerDid,
          record.label,
          record.description ?? null,
          visibility,
          record.createdAt ? new Date(record.createdAt) : metadata.indexedAt,
          metadata.pdsUrl,
        ]
      );

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

    try {
      const ownerDid = extractDidFromUri(metadata.uri);

      await this.pool.query(
        `INSERT INTO collection_edges_index (
          uri, cid, owner_did, source_uri, target_uri, relation_slug,
          weight, created_at, pds_url, indexed_at, last_synced_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        ON CONFLICT (uri) DO UPDATE SET
          cid = EXCLUDED.cid,
          relation_slug = EXCLUDED.relation_slug,
          weight = EXCLUDED.weight,
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
      }>(
        `SELECT c.uri, c.cid, c.owner_did, c.label, c.description, c.visibility,
                c.created_at, c.updated_at,
                COUNT(e.uri)::text AS item_count
         FROM collections_index c
         LEFT JOIN collection_edges_index e
           ON e.source_uri = c.uri AND e.relation_slug = 'contains'
         WHERE c.uri = $1
           AND (c.visibility = 'public' OR c.owner_did = $2)
         GROUP BY c.uri, c.cid, c.owner_did, c.label, c.description,
                  c.visibility, c.created_at, c.updated_at`,
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
                          COUNT(e.uri)::text AS item_count
                   FROM collections_index c
                   LEFT JOIN collection_edges_index e
                     ON e.source_uri = c.uri AND e.relation_slug = 'contains'
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
                          c.visibility, c.created_at, c.updated_at
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
   * Lists public collections across all users.
   *
   * @param options - Pagination options
   * @returns Paginated list of public collections
   *
   * @public
   */
  async listPublic(options: PaginationOptions = {}): Promise<PaginatedResult<IndexedCollection>> {
    const limit = Math.min(options.limit ?? 50, 100);

    try {
      const countResult = await this.pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM collections_index WHERE visibility = 'public'`
      );
      const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

      let query = `SELECT c.uri, c.cid, c.owner_did, c.label, c.description, c.visibility,
                          c.created_at, c.updated_at,
                          COUNT(e.uri)::text AS item_count
                   FROM collections_index c
                   LEFT JOIN collection_edges_index e
                     ON e.source_uri = c.uri AND e.relation_slug = 'contains'
                   WHERE c.visibility = 'public'`;
      const params: unknown[] = [];

      if (options.cursor) {
        const parts = options.cursor.split('::');
        const timestamp = parts[0] ?? new Date().toISOString();
        const cursorUri = parts[1] ?? '';
        query += ` AND (c.created_at, c.uri) < ($1, $2)`;
        params.push(new Date(timestamp), cursorUri);
      }

      query += ` GROUP BY c.uri, c.cid, c.owner_did, c.label, c.description,
                          c.visibility, c.created_at, c.updated_at
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
    options: PaginationOptions & { visibility?: 'public' | 'private'; ownerDid?: DID } = {}
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
                        COUNT(e.uri)::text AS item_count
                 FROM collections_index c
                 LEFT JOIN collection_edges_index e
                   ON e.source_uri = c.uri AND e.relation_slug = 'contains'
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
                        c.visibility, c.created_at, c.updated_at
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
      }>(
        `SELECT c.uri, c.cid, c.owner_did, c.label, c.description, c.visibility,
                c.created_at, c.updated_at,
                COUNT(e2.uri)::text AS item_count
         FROM collections_index c
         INNER JOIN collection_edges_index e
           ON e.source_uri = c.uri AND e.target_uri = $1 AND e.relation_slug = 'contains'
         LEFT JOIN collection_edges_index e2
           ON e2.source_uri = c.uri AND e2.relation_slug = 'contains'
         WHERE (c.visibility = 'public' OR c.owner_did = $2)
         GROUP BY c.uri, c.cid, c.owner_did, c.label, c.description,
                  c.visibility, c.created_at, c.updated_at
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
   * @returns Subcollections linked via SUBCOLLECTION_OF edges
   *
   * @remarks
   * Finds collections where a SUBCOLLECTION_OF edge has source_uri = child
   * and target_uri = collectionUri.
   *
   * @public
   */
  async getSubcollections(collectionUri: AtUri): Promise<IndexedCollection[]> {
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
      }>(
        `SELECT c.uri, c.cid, c.owner_did, c.label, c.description, c.visibility,
                c.created_at, c.updated_at,
                COUNT(e2.uri)::text AS item_count
         FROM collections_index c
         INNER JOIN collection_edges_index e
           ON e.source_uri = c.uri AND e.target_uri = $1 AND e.relation_slug = 'subcollection-of'
         LEFT JOIN collection_edges_index e2
           ON e2.source_uri = c.uri AND e2.relation_slug = 'contains'
         GROUP BY c.uri, c.cid, c.owner_did, c.label, c.description,
                  c.visibility, c.created_at, c.updated_at
         ORDER BY c.label ASC`,
        [collectionUri]
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
   * @returns Parent collection or null if this is a root collection
   *
   * @public
   */
  async getParentCollection(collectionUri: AtUri): Promise<IndexedCollection | null> {
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
      }>(
        `SELECT c.uri, c.cid, c.owner_did, c.label, c.description, c.visibility,
                c.created_at, c.updated_at,
                COUNT(e2.uri)::text AS item_count
         FROM collections_index c
         INNER JOIN collection_edges_index e
           ON e.target_uri = c.uri AND e.source_uri = $1 AND e.relation_slug = 'subcollection-of'
         LEFT JOIN collection_edges_index e2
           ON e2.source_uri = c.uri AND e2.relation_slug = 'contains'
         GROUP BY c.uri, c.cid, c.owner_did, c.label, c.description,
                  c.visibility, c.created_at, c.updated_at
         LIMIT 1`,
        [collectionUri]
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
  }): IndexedCollection {
    return {
      uri: row.uri as AtUri,
      cid: row.cid,
      ownerDid: row.owner_did as DID,
      label: row.label,
      description: row.description ?? undefined,
      visibility: row.visibility === 'public' ? 'public' : 'private',
      itemCount: parseInt(row.item_count, 10),
      createdAt: new Date(row.created_at),
      updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
    };
  }
}
