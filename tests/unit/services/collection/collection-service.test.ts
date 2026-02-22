/**
 * Unit tests for CollectionService.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { CollectionService } from '../../../../src/services/collection/collection-service.js';
import type { RecordMetadata } from '../../../../src/services/eprint/eprint-service.js';
import type { AtUri, CID, DID } from '../../../../src/types/atproto.js';
import { DatabaseError, ValidationError } from '../../../../src/types/errors.js';
import type { ILogger } from '../../../../src/types/interfaces/logger.interface.js';
import { isErr, isOk } from '../../../../src/types/result.js';

// ============================================================================
// Mock Factories
// ============================================================================

const createMockLogger = (): ILogger => {
  const logger: ILogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => logger),
  };
  return logger;
};

interface MockDatabasePool {
  query: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
}

interface MockDatabaseClient {
  query: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
}

const createMockClient = (): MockDatabaseClient => ({
  query: vi.fn().mockResolvedValue({ rows: [] }),
  release: vi.fn(),
});

const createMockPool = (): MockDatabasePool => ({
  query: vi.fn().mockResolvedValue({ rows: [] }),
  connect: vi.fn().mockResolvedValue(createMockClient()),
});

// ============================================================================
// Sample Data (scholarly eprint collections)
// ============================================================================

const SAMPLE_DID = 'did:plc:aswhite' as DID;
const SAMPLE_COLLECTION_URI = 'at://did:plc:aswhite/pub.chive.graph.node/nlp-reading-list' as AtUri;
const SAMPLE_EPRINT_URI = 'at://did:plc:aswhite/pub.chive.eprint.submission/megaattitude' as AtUri;
const SAMPLE_CHILD_URI = 'at://did:plc:aswhite/pub.chive.graph.node/syntax-subcollection' as AtUri;
const SAMPLE_GRANDCHILD_URI =
  'at://did:plc:aswhite/pub.chive.graph.node/minimalism-papers' as AtUri;
const SAMPLE_PARENT_URI =
  'at://did:plc:aswhite/pub.chive.graph.node/linguistics-collection' as AtUri;

const SAMPLE_EDGE_URI = 'at://did:plc:aswhite/pub.chive.graph.edge/contains-megaattitude' as AtUri;
const SAMPLE_SUBCOLLECTION_EDGE_URI =
  'at://did:plc:aswhite/pub.chive.graph.edge/subcollection-syntax' as AtUri;

const SAMPLE_METADATA: RecordMetadata = {
  uri: SAMPLE_COLLECTION_URI,
  cid: 'bafyreiabc123def456' as CID,
  pdsUrl: 'https://pds.example.com',
  indexedAt: new Date('2025-06-15T10:00:00Z'),
};

const SAMPLE_NODE_RECORD = {
  $type: 'pub.chive.graph.node',
  id: 'nlp-reading-list',
  kind: 'object',
  subkind: 'collection',
  label: 'NLP Reading List',
  description: 'Curated papers on computational linguistics and NLP',
  createdAt: '2025-06-15T10:00:00Z',
  metadata: {
    visibility: 'public',
  },
};

const SAMPLE_CONTAINS_EDGE = {
  $type: 'pub.chive.graph.edge',
  sourceUri: SAMPLE_COLLECTION_URI,
  targetUri: SAMPLE_EPRINT_URI,
  relationSlug: 'contains',
  weight: 1.0,
  createdAt: '2025-06-15T10:00:00Z',
};

const SAMPLE_SUBCOLLECTION_EDGE = {
  $type: 'pub.chive.graph.edge',
  sourceUri: SAMPLE_CHILD_URI,
  targetUri: SAMPLE_COLLECTION_URI,
  relationSlug: 'subcollection-of',
  createdAt: '2025-06-15T10:00:00Z',
};

const SAMPLE_COLLECTION_ROW = {
  uri: SAMPLE_COLLECTION_URI,
  cid: 'bafyreiabc123def456',
  owner_did: SAMPLE_DID,
  label: 'NLP Reading List',
  description: 'Curated papers on computational linguistics and NLP',
  visibility: 'public',
  created_at: new Date('2025-06-15T10:00:00Z'),
  updated_at: null,
  item_count: '3',
};

// ============================================================================
// Tests
// ============================================================================

describe('CollectionService', () => {
  let service: CollectionService;
  let logger: ILogger;
  let pool: MockDatabasePool;

  beforeEach(() => {
    logger = createMockLogger();
    pool = createMockPool();
    service = new CollectionService({
      pool: pool as unknown as never,
      logger,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // indexCollection
  // ==========================================================================

  describe('indexCollection', () => {
    it('indexes a collection node with all fields', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.indexCollection(SAMPLE_NODE_RECORD, SAMPLE_METADATA);

      expect(isOk(result)).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO collections_index'),
        expect.arrayContaining([
          SAMPLE_COLLECTION_URI,
          'bafyreiabc123def456',
          SAMPLE_DID,
          'NLP Reading List',
        ])
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Indexed collection',
        expect.objectContaining({
          uri: SAMPLE_COLLECTION_URI,
          ownerDid: SAMPLE_DID,
          label: 'NLP Reading List',
          visibility: 'public',
        })
      );
    });

    it('returns validation error when label is missing', async () => {
      const recordMissingLabel = { ...SAMPLE_NODE_RECORD, label: '' };

      const result = await service.indexCollection(recordMissingLabel, SAMPLE_METADATA);

      expect(isErr(result)).toBe(true);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('label');
      }
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('handles upsert (ON CONFLICT) correctly', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await service.indexCollection(SAMPLE_NODE_RECORD, SAMPLE_METADATA);

      const queryArg = pool.query.mock.calls[0]?.[0] as string;
      expect(queryArg).toContain('ON CONFLICT (uri) DO UPDATE SET');
      expect(queryArg).toContain('cid = EXCLUDED.cid');
      expect(queryArg).toContain('label = EXCLUDED.label');
    });

    it('extracts owner DID from AT-URI correctly', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });
      const metadataWithDifferentDid = {
        ...SAMPLE_METADATA,
        uri: 'at://did:plc:jgrove/pub.chive.graph.node/semantics-papers' as AtUri,
      };

      await service.indexCollection(SAMPLE_NODE_RECORD, metadataWithDifferentDid);

      // Third parameter is the owner DID
      const params = pool.query.mock.calls[0]?.[1] as unknown[];
      expect(params?.[2]).toBe('did:plc:jgrove');
    });

    it('defaults visibility to private when metadata.visibility is missing', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });
      const recordNoVisibility = {
        ...SAMPLE_NODE_RECORD,
        metadata: {},
      };

      await service.indexCollection(recordNoVisibility, SAMPLE_METADATA);

      const params = pool.query.mock.calls[0]?.[1] as unknown[];
      // Visibility is the 6th parameter (index 5)
      expect(params?.[5]).toBe('private');
    });

    it('sets visibility to public when metadata.visibility is public', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await service.indexCollection(SAMPLE_NODE_RECORD, SAMPLE_METADATA);

      const params = pool.query.mock.calls[0]?.[1] as unknown[];
      expect(params?.[5]).toBe('public');
    });

    it('defaults visibility to private when metadata is undefined', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });
      const recordNoMetadata = {
        ...SAMPLE_NODE_RECORD,
        metadata: undefined,
      };

      await service.indexCollection(recordNoMetadata, SAMPLE_METADATA);

      const params = pool.query.mock.calls[0]?.[1] as unknown[];
      expect(params?.[5]).toBe('private');
    });

    it('returns database error on query failure', async () => {
      pool.query.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await service.indexCollection(SAMPLE_NODE_RECORD, SAMPLE_METADATA);

      expect(isErr(result)).toBe(true);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(DatabaseError);
        expect(result.error.message).toContain('Failed to index collection');
      }
    });
  });

  // ==========================================================================
  // indexCollectionEdge
  // ==========================================================================

  describe('indexCollectionEdge', () => {
    it('indexes a CONTAINS edge', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.indexCollectionEdge(SAMPLE_CONTAINS_EDGE, {
        ...SAMPLE_METADATA,
        uri: SAMPLE_EDGE_URI,
      });

      expect(isOk(result)).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO collection_edges_index'),
        expect.arrayContaining([
          SAMPLE_EDGE_URI,
          SAMPLE_COLLECTION_URI,
          SAMPLE_EPRINT_URI,
          'contains',
        ])
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Indexed collection edge',
        expect.objectContaining({
          relationSlug: 'contains',
        })
      );
    });

    it('indexes a SUBCOLLECTION_OF edge', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.indexCollectionEdge(SAMPLE_SUBCOLLECTION_EDGE, {
        ...SAMPLE_METADATA,
        uri: SAMPLE_SUBCOLLECTION_EDGE_URI,
      });

      expect(isOk(result)).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO collection_edges_index'),
        expect.arrayContaining([SAMPLE_CHILD_URI, SAMPLE_COLLECTION_URI, 'subcollection-of'])
      );
    });

    it('returns validation error when sourceUri is missing', async () => {
      const invalidEdge = { ...SAMPLE_CONTAINS_EDGE, sourceUri: '' };

      const result = await service.indexCollectionEdge(invalidEdge, SAMPLE_METADATA);

      expect(isErr(result)).toBe(true);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('sourceUri');
      }
    });

    it('returns validation error when targetUri is missing', async () => {
      const invalidEdge = { ...SAMPLE_CONTAINS_EDGE, targetUri: '' };

      const result = await service.indexCollectionEdge(invalidEdge, SAMPLE_METADATA);

      expect(isErr(result)).toBe(true);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(ValidationError);
      }
    });

    it('returns validation error when relationSlug is missing', async () => {
      const invalidEdge = { ...SAMPLE_CONTAINS_EDGE, relationSlug: '' };

      const result = await service.indexCollectionEdge(invalidEdge, SAMPLE_METADATA);

      expect(isErr(result)).toBe(true);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(ValidationError);
      }
    });

    it('handles upsert on conflict for edges', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await service.indexCollectionEdge(SAMPLE_CONTAINS_EDGE, {
        ...SAMPLE_METADATA,
        uri: SAMPLE_EDGE_URI,
      });

      const queryArg = pool.query.mock.calls[0]?.[0] as string;
      expect(queryArg).toContain('ON CONFLICT (uri) DO UPDATE SET');
    });

    it('returns database error on query failure', async () => {
      pool.query.mockRejectedValueOnce(new Error('Constraint violation'));

      const result = await service.indexCollectionEdge(SAMPLE_CONTAINS_EDGE, {
        ...SAMPLE_METADATA,
        uri: SAMPLE_EDGE_URI,
      });

      expect(isErr(result)).toBe(true);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(DatabaseError);
      }
    });
  });

  // ==========================================================================
  // deleteCollection (CASCADE LOGIC)
  // ==========================================================================

  describe('deleteCollection', () => {
    let mockClient: MockDatabaseClient;

    beforeEach(() => {
      mockClient = createMockClient();
      pool.connect.mockResolvedValue(mockClient);
    });

    it('deletes a simple collection with no children or parent', async () => {
      // Step 1: Find children (none)
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // Find children: none
        .mockResolvedValueOnce({ rows: [] }) // Find parent: none
        .mockResolvedValueOnce({ rows: [] }) // Delete CONTAINS edges
        .mockResolvedValueOnce({ rows: [] }) // Delete SUBCOLLECTION_OF from this
        .mockResolvedValueOnce({ rows: [] }) // Delete remaining edges
        .mockResolvedValueOnce({ rows: [] }) // Delete collection itself
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await service.deleteCollection(SAMPLE_COLLECTION_URI);

      expect(isOk(result)).toBe(true);
      expect(mockClient.release).toHaveBeenCalled();

      // Verify BEGIN
      expect(mockClient.query.mock.calls[0]?.[0]).toBe('BEGIN');

      // Verify collection deletion
      const deleteCollectionCall = mockClient.query.mock.calls[6];
      expect(deleteCollectionCall?.[0]).toContain('DELETE FROM collections_index');
      expect(deleteCollectionCall?.[1]).toEqual([SAMPLE_COLLECTION_URI]);

      // Verify COMMIT
      const lastCallIndex = mockClient.query.mock.calls.length - 1;
      expect(mockClient.query.mock.calls[lastCallIndex]?.[0]).toBe('COMMIT');
    });

    it('re-links grandchildren to parent when deleting intermediary collection', async () => {
      // Scenario: parent -> child (being deleted) -> grandchild
      const childEdgeUri = 'at://did:plc:aswhite/pub.chive.graph.edge/gc-subcollection';

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({
          // Find children: grandchild is a subcollection of this collection
          rows: [{ uri: childEdgeUri, source_uri: SAMPLE_GRANDCHILD_URI }],
        })
        .mockResolvedValueOnce({
          // Find parent: this collection is a subcollection of parent
          rows: [{ target_uri: SAMPLE_PARENT_URI }],
        })
        .mockResolvedValueOnce({ rows: [] }) // Re-link grandchild to parent (UPDATE)
        .mockResolvedValueOnce({ rows: [] }) // Delete CONTAINS edges
        .mockResolvedValueOnce({ rows: [] }) // Delete SUBCOLLECTION_OF from this
        .mockResolvedValueOnce({ rows: [] }) // Delete remaining edges
        .mockResolvedValueOnce({ rows: [] }) // Delete collection itself
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await service.deleteCollection(SAMPLE_CHILD_URI);

      expect(isOk(result)).toBe(true);

      // Verify the UPDATE that re-links grandchild to parent
      const relinkCall = mockClient.query.mock.calls[3];
      expect(relinkCall?.[0]).toContain('UPDATE collection_edges_index');
      expect(relinkCall?.[0]).toContain('SET target_uri = $1');
      expect(relinkCall?.[1]).toEqual([SAMPLE_PARENT_URI, childEdgeUri]);

      expect(logger.info).toHaveBeenCalledWith(
        'Re-linked subcollections to parent',
        expect.objectContaining({
          parentUri: SAMPLE_PARENT_URI,
          childCount: 1,
        })
      );
    });

    it('re-links multiple grandchildren to parent', async () => {
      const grandchild1EdgeUri = 'at://did:plc:aswhite/pub.chive.graph.edge/gc1-edge';
      const grandchild2EdgeUri = 'at://did:plc:aswhite/pub.chive.graph.edge/gc2-edge';
      const grandchild1Uri = 'at://did:plc:aswhite/pub.chive.graph.node/phonology-papers';
      const grandchild2Uri = 'at://did:plc:aswhite/pub.chive.graph.node/morphology-papers';

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({
          // Find children: two grandchildren
          rows: [
            { uri: grandchild1EdgeUri, source_uri: grandchild1Uri },
            { uri: grandchild2EdgeUri, source_uri: grandchild2Uri },
          ],
        })
        .mockResolvedValueOnce({
          // Find parent
          rows: [{ target_uri: SAMPLE_PARENT_URI }],
        })
        .mockResolvedValueOnce({ rows: [] }) // Re-link grandchild 1
        .mockResolvedValueOnce({ rows: [] }) // Re-link grandchild 2
        .mockResolvedValueOnce({ rows: [] }) // Delete CONTAINS edges
        .mockResolvedValueOnce({ rows: [] }) // Delete SUBCOLLECTION_OF from this
        .mockResolvedValueOnce({ rows: [] }) // Delete remaining edges
        .mockResolvedValueOnce({ rows: [] }) // Delete collection itself
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await service.deleteCollection(SAMPLE_CHILD_URI);

      expect(isOk(result)).toBe(true);

      // Verify both grandchildren re-linked
      const relink1 = mockClient.query.mock.calls[3];
      expect(relink1?.[1]).toEqual([SAMPLE_PARENT_URI, grandchild1EdgeUri]);

      const relink2 = mockClient.query.mock.calls[4];
      expect(relink2?.[1]).toEqual([SAMPLE_PARENT_URI, grandchild2EdgeUri]);

      expect(logger.info).toHaveBeenCalledWith(
        'Re-linked subcollections to parent',
        expect.objectContaining({ childCount: 2 })
      );
    });

    it('removes subcollection edges when deleted collection has no parent', async () => {
      const childEdgeUri = 'at://did:plc:aswhite/pub.chive.graph.edge/gc-edge';

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({
          // Find children: one grandchild
          rows: [{ uri: childEdgeUri, source_uri: SAMPLE_GRANDCHILD_URI }],
        })
        .mockResolvedValueOnce({ rows: [] }) // Find parent: none (root collection)
        .mockResolvedValueOnce({ rows: [] }) // Delete child SUBCOLLECTION_OF edges
        .mockResolvedValueOnce({ rows: [] }) // Delete CONTAINS edges
        .mockResolvedValueOnce({ rows: [] }) // Delete SUBCOLLECTION_OF from this
        .mockResolvedValueOnce({ rows: [] }) // Delete remaining edges
        .mockResolvedValueOnce({ rows: [] }) // Delete collection itself
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await service.deleteCollection(SAMPLE_COLLECTION_URI);

      expect(isOk(result)).toBe(true);

      // When no parent, children's SUBCOLLECTION_OF edges are deleted
      // (children become root collections)
      const deleteChildEdgesCall = mockClient.query.mock.calls[3];
      expect(deleteChildEdgesCall?.[0]).toContain(
        'DELETE FROM collection_edges_index WHERE uri = ANY($1)'
      );
      expect(deleteChildEdgesCall?.[1]).toEqual([[childEdgeUri]]);

      expect(logger.info).toHaveBeenCalledWith(
        'Removed subcollection edges for orphaned children',
        expect.objectContaining({ childCount: 1 })
      );
    });

    it('does not promote CONTAINS items to parent (only SUBCOLLECTION_OF is transitive)', async () => {
      // CONTAINS edges are deleted outright; items are not re-linked.
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // Find children (subcollections): none
        .mockResolvedValueOnce({
          // Find parent: exists
          rows: [{ target_uri: SAMPLE_PARENT_URI }],
        })
        .mockResolvedValueOnce({ rows: [] }) // Delete CONTAINS edges from this
        .mockResolvedValueOnce({ rows: [] }) // Delete SUBCOLLECTION_OF from this
        .mockResolvedValueOnce({ rows: [] }) // Delete remaining edges
        .mockResolvedValueOnce({ rows: [] }) // Delete collection itself
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await service.deleteCollection(SAMPLE_COLLECTION_URI);

      expect(isOk(result)).toBe(true);

      // Verify CONTAINS edges are deleted, not re-linked
      const containsDeleteCall = mockClient.query.mock.calls[3];
      expect(containsDeleteCall?.[0]).toContain("relation_slug = 'contains'");
      expect(containsDeleteCall?.[0]).toContain('DELETE FROM collection_edges_index');

      // No UPDATE call with 'contains' relation (no re-linking)
      const allQueries = mockClient.query.mock.calls.map((c) => c[0] as string);
      const updateQueries = allQueries.filter((q) => q.includes('UPDATE'));
      expect(updateQueries).toHaveLength(0);
    });

    it('rolls back transaction and returns error on failure', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockRejectedValueOnce(new Error('Deadlock detected')); // Find children fails

      const result = await service.deleteCollection(SAMPLE_COLLECTION_URI);

      expect(isErr(result)).toBe(true);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(DatabaseError);
        expect(result.error.message).toContain('Failed to delete collection');
      }

      // Verify ROLLBACK was called
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('releases the client even when an error occurs', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockRejectedValueOnce(new Error('Unexpected error'));

      await service.deleteCollection(SAMPLE_COLLECTION_URI);

      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // deleteCollectionEdge
  // ==========================================================================

  describe('deleteCollectionEdge', () => {
    it('deletes an edge by URI', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.deleteCollectionEdge(SAMPLE_EDGE_URI);

      expect(isOk(result)).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM collection_edges_index'),
        [SAMPLE_EDGE_URI]
      );
    });

    it('returns database error on failure', async () => {
      pool.query.mockRejectedValueOnce(new Error('Query failed'));

      const result = await service.deleteCollectionEdge(SAMPLE_EDGE_URI);

      expect(isErr(result)).toBe(true);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(DatabaseError);
      }
    });
  });

  // ==========================================================================
  // updateCollection
  // ==========================================================================

  describe('updateCollection', () => {
    it('delegates to indexCollection with overridden URI', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.updateCollection(
        SAMPLE_COLLECTION_URI,
        SAMPLE_NODE_RECORD,
        SAMPLE_METADATA
      );

      expect(isOk(result)).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO collections_index'),
        expect.arrayContaining([SAMPLE_COLLECTION_URI])
      );
    });
  });

  // ==========================================================================
  // getCollection
  // ==========================================================================

  describe('getCollection', () => {
    it('returns collection by URI', async () => {
      pool.query.mockResolvedValueOnce({ rows: [SAMPLE_COLLECTION_ROW] });

      const result = await service.getCollection(SAMPLE_COLLECTION_URI);

      expect(result).not.toBeNull();
      expect(result?.uri).toBe(SAMPLE_COLLECTION_URI);
      expect(result?.label).toBe('NLP Reading List');
      expect(result?.itemCount).toBe(3);
      expect(result?.visibility).toBe('public');
    });

    it('returns null for non-existent collection', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getCollection(
        'at://did:plc:unknown/pub.chive.graph.node/nonexistent' as AtUri
      );

      expect(result).toBeNull();
    });

    it('passes authDid for visibility filtering', async () => {
      pool.query.mockResolvedValueOnce({ rows: [SAMPLE_COLLECTION_ROW] });

      await service.getCollection(SAMPLE_COLLECTION_URI, SAMPLE_DID);

      const params = pool.query.mock.calls[0]?.[1] as unknown[];
      expect(params?.[0]).toBe(SAMPLE_COLLECTION_URI);
      expect(params?.[1]).toBe(SAMPLE_DID);
    });

    it('returns null when private collection is accessed by non-owner', async () => {
      // The SQL query filters by visibility OR owner_did, so an empty result
      // means the collection exists but is not visible to this user.
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getCollection(SAMPLE_COLLECTION_URI, 'did:plc:stranger' as DID);

      expect(result).toBeNull();
    });

    it('returns null on database error', async () => {
      pool.query.mockRejectedValueOnce(new Error('Query timeout'));

      const result = await service.getCollection(SAMPLE_COLLECTION_URI);

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get collection',
        expect.any(Error),
        expect.objectContaining({ uri: SAMPLE_COLLECTION_URI })
      );
    });

    it('converts row to IndexedCollection with correct types', async () => {
      const rowWithUpdatedAt = {
        ...SAMPLE_COLLECTION_ROW,
        updated_at: new Date('2025-07-01T12:00:00Z'),
      };
      pool.query.mockResolvedValueOnce({ rows: [rowWithUpdatedAt] });

      const result = await service.getCollection(SAMPLE_COLLECTION_URI);

      expect(result?.ownerDid).toBe(SAMPLE_DID);
      expect(result?.createdAt).toBeInstanceOf(Date);
      expect(result?.updatedAt).toBeInstanceOf(Date);
      expect(result?.description).toBe('Curated papers on computational linguistics and NLP');
    });
  });

  // ==========================================================================
  // listByOwner
  // ==========================================================================

  describe('listByOwner', () => {
    it('returns paginated collections for a DID', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ count: '2' }] }) // count
        .mockResolvedValueOnce({ rows: [SAMPLE_COLLECTION_ROW] }); // items

      const result = await service.listByOwner(SAMPLE_DID);

      expect(result.total).toBe(2);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.label).toBe('NLP Reading List');
      expect(result.hasMore).toBe(false);
    });

    it('returns correct cursor for pagination', async () => {
      // Return limit + 1 rows to indicate more results
      const manyRows = Array.from({ length: 3 }, (_, i) => ({
        ...SAMPLE_COLLECTION_ROW,
        uri: `at://did:plc:aswhite/pub.chive.graph.node/collection-${i}`,
        created_at: new Date(`2025-06-${15 - i}T10:00:00Z`),
      }));

      pool.query
        .mockResolvedValueOnce({ rows: [{ count: '10' }] }) // count
        .mockResolvedValueOnce({ rows: manyRows }); // items (3 rows, limit=2)

      const result = await service.listByOwner(SAMPLE_DID, { limit: 2 });

      expect(result.hasMore).toBe(true);
      expect(result.items).toHaveLength(2);
      expect(result.cursor).toBeDefined();
      expect(result.cursor).toContain('::');
    });

    it('returns empty result for unknown DID', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.listByOwner('did:plc:unknown' as DID);

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it('handles cursor-based pagination', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })
        .mockResolvedValueOnce({ rows: [SAMPLE_COLLECTION_ROW] });

      const cursor = '2025-06-15T10:00:00.000Z::at://did:plc:aswhite/pub.chive.graph.node/x';

      const result = await service.listByOwner(SAMPLE_DID, { cursor });

      // Verify the cursor was parsed and used in the query
      const queryArg = pool.query.mock.calls[1]?.[0] as string;
      expect(queryArg).toContain('(c.created_at, c.uri) <');
      expect(result.items).toHaveLength(1);
    });

    it('caps limit at 100', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      await service.listByOwner(SAMPLE_DID, { limit: 500 });

      // The LIMIT parameter should be 101 (capped limit + 1 for hasMore check)
      const params = pool.query.mock.calls[1]?.[1] as unknown[];
      const lastParam = params?.[params.length - 1];
      expect(lastParam).toBe(101); // 100 + 1
    });

    it('returns empty array on database error', async () => {
      pool.query.mockRejectedValueOnce(new Error('Connection lost'));

      const result = await service.listByOwner(SAMPLE_DID);

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // listPublic
  // ==========================================================================

  describe('listPublic', () => {
    it('returns only public collections', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [SAMPLE_COLLECTION_ROW] });

      const result = await service.listPublic();

      expect(result.items).toHaveLength(1);
      // Verify the query filters by visibility='public'
      const countQuery = pool.query.mock.calls[0]?.[0] as string;
      expect(countQuery).toContain("visibility = 'public'");
    });

    it('supports pagination', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ count: '50' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.listPublic({ limit: 10, cursor: undefined });

      expect(result.total).toBe(50);
    });
  });

  // ==========================================================================
  // searchCollections
  // ==========================================================================

  describe('searchCollections', () => {
    it('searches collections by text query', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [SAMPLE_COLLECTION_ROW] });

      const result = await service.searchCollections('linguistics');

      expect(result.items).toHaveLength(1);
      // Verify ILIKE pattern
      const params = pool.query.mock.calls[0]?.[1] as unknown[];
      expect(params?.[0]).toBe('%linguistics%');
    });

    it('filters by visibility when specified', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      await service.searchCollections('semantics', { visibility: 'public' });

      const countQuery = pool.query.mock.calls[0]?.[0] as string;
      expect(countQuery).toContain('visibility =');
    });

    it('filters by ownerDid when specified', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      await service.searchCollections('papers', { ownerDid: SAMPLE_DID });

      const countQuery = pool.query.mock.calls[0]?.[0] as string;
      expect(countQuery).toContain('owner_did =');
    });

    it('returns empty on database error', async () => {
      pool.query.mockRejectedValueOnce(new Error('Search failed'));

      const result = await service.searchCollections('query');

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  // ==========================================================================
  // getCollectionsContaining
  // ==========================================================================

  describe('getCollectionsContaining', () => {
    it('returns collections containing a specific item URI', async () => {
      pool.query.mockResolvedValueOnce({ rows: [SAMPLE_COLLECTION_ROW] });

      const result = await service.getCollectionsContaining(SAMPLE_EPRINT_URI);

      expect(result).toHaveLength(1);
      expect(result[0]?.label).toBe('NLP Reading List');
    });

    it('returns empty for item in no collections', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getCollectionsContaining(
        'at://did:plc:unknown/pub.chive.eprint.submission/orphan' as AtUri
      );

      expect(result).toEqual([]);
    });

    it('passes authDid for visibility filtering', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await service.getCollectionsContaining(SAMPLE_EPRINT_URI, SAMPLE_DID);

      const params = pool.query.mock.calls[0]?.[1] as unknown[];
      expect(params?.[1]).toBe(SAMPLE_DID);
    });

    it('returns empty on database error', async () => {
      pool.query.mockRejectedValueOnce(new Error('Connection error'));

      const result = await service.getCollectionsContaining(SAMPLE_EPRINT_URI);

      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // getSubcollections
  // ==========================================================================

  describe('getSubcollections', () => {
    it('returns subcollections of a given collection', async () => {
      const subcollectionRow = {
        ...SAMPLE_COLLECTION_ROW,
        uri: SAMPLE_CHILD_URI,
        label: 'Syntax Subcollection',
      };
      pool.query.mockResolvedValueOnce({ rows: [subcollectionRow] });

      const result = await service.getSubcollections(SAMPLE_COLLECTION_URI);

      expect(result).toHaveLength(1);
      expect(result[0]?.label).toBe('Syntax Subcollection');
    });

    it('returns empty for collection with no subcollections', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getSubcollections(SAMPLE_COLLECTION_URI);

      expect(result).toEqual([]);
    });

    it('returns empty on database error', async () => {
      pool.query.mockRejectedValueOnce(new Error('Query failed'));

      const result = await service.getSubcollections(SAMPLE_COLLECTION_URI);

      expect(result).toEqual([]);
    });
  });

  // ==========================================================================
  // getParentCollection
  // ==========================================================================

  describe('getParentCollection', () => {
    it('returns parent collection', async () => {
      const parentRow = {
        ...SAMPLE_COLLECTION_ROW,
        uri: SAMPLE_PARENT_URI,
        label: 'Linguistics Collection',
      };
      pool.query.mockResolvedValueOnce({ rows: [parentRow] });

      const result = await service.getParentCollection(SAMPLE_CHILD_URI);

      expect(result).not.toBeNull();
      expect(result?.uri).toBe(SAMPLE_PARENT_URI);
      expect(result?.label).toBe('Linguistics Collection');
    });

    it('returns null for root collection with no parent', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getParentCollection(SAMPLE_COLLECTION_URI);

      expect(result).toBeNull();
    });

    it('returns null on database error', async () => {
      pool.query.mockRejectedValueOnce(new Error('Timeout'));

      const result = await service.getParentCollection(SAMPLE_CHILD_URI);

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // getProfileConfig
  // ==========================================================================

  describe('getProfileConfig', () => {
    it('returns profile config for a DID', async () => {
      const profileRow = {
        did: SAMPLE_DID,
        uri: 'at://did:plc:aswhite/pub.chive.actor.profileConfig/self',
        profile_type: 'individual',
        sections: [
          { type: 'collections', visible: true, order: 1 },
          { type: 'eprints', visible: true, order: 2 },
        ],
        featured_collection_uri: SAMPLE_COLLECTION_URI,
      };
      pool.query.mockResolvedValueOnce({ rows: [profileRow] });

      const result = await service.getProfileConfig(SAMPLE_DID);

      expect(result).not.toBeNull();
      expect(result?.did).toBe(SAMPLE_DID);
      expect(result?.profileType).toBe('individual');
      expect(result?.sections).toHaveLength(2);
      expect(result?.featuredCollectionUri).toBe(SAMPLE_COLLECTION_URI);
    });

    it('returns null for DID with no config', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getProfileConfig('did:plc:noconfig' as DID);

      expect(result).toBeNull();
    });

    it('defaults profileType to individual when null', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            did: SAMPLE_DID,
            uri: 'at://did:plc:aswhite/pub.chive.actor.profileConfig/self',
            profile_type: null,
            sections: [],
            featured_collection_uri: null,
          },
        ],
      });

      const result = await service.getProfileConfig(SAMPLE_DID);

      expect(result?.profileType).toBe('individual');
    });

    it('handles JSONB sections as already-parsed objects', async () => {
      // pg driver returns JSONB as already-parsed JS objects
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            did: SAMPLE_DID,
            uri: 'at://did:plc:aswhite/pub.chive.actor.profileConfig/self',
            profile_type: 'individual',
            sections: [{ type: 'collections', visible: true, order: 1 }],
            featured_collection_uri: null,
          },
        ],
      });

      const result = await service.getProfileConfig(SAMPLE_DID);

      expect(result?.sections).toHaveLength(1);
      expect(result?.sections[0]?.type).toBe('collections');
    });

    it('returns null on database error', async () => {
      pool.query.mockRejectedValueOnce(new Error('Connection failed'));

      const result = await service.getProfileConfig(SAMPLE_DID);

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
