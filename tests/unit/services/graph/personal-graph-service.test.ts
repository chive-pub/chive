/**
 * Unit tests for PersonalGraphService.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { RecordMetadata } from '../../../../src/services/eprint/eprint-service.js';
import { PersonalGraphService } from '../../../../src/services/graph/personal-graph-service.js';
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
}

const createMockPool = (): MockDatabasePool => ({
  query: vi.fn().mockResolvedValue({ rows: [] }),
});

// ============================================================================
// Sample Data (scholarly graph nodes and edges)
// ============================================================================

const SAMPLE_DID = 'did:plc:aswhite' as DID;
const SAMPLE_NODE_URI = 'at://did:plc:aswhite/pub.chive.graph.node/formal-semantics-list' as AtUri;
const SAMPLE_EDGE_URI = 'at://did:plc:aswhite/pub.chive.graph.edge/contains-megaattitude' as AtUri;
const SAMPLE_EPRINT_URI = 'at://did:plc:aswhite/pub.chive.eprint.submission/megaattitude' as AtUri;

const SAMPLE_METADATA: RecordMetadata = {
  uri: SAMPLE_NODE_URI,
  cid: 'bafyreiabc123def456' as CID,
  pdsUrl: 'https://pds.example.com',
  indexedAt: new Date('2025-06-15T10:00:00Z'),
};

const SAMPLE_NODE_RECORD = {
  $type: 'pub.chive.graph.node',
  id: 'formal-semantics-list',
  kind: 'object',
  subkind: 'collection',
  label: 'Formal Semantics Reading List',
  alternateLabels: ['Model-Theoretic Semantics Papers'],
  description: 'Papers on formal and model-theoretic semantics',
  status: 'established',
  createdAt: '2025-06-15T10:00:00Z',
};

const SAMPLE_EDGE_RECORD = {
  $type: 'pub.chive.graph.edge',
  id: 'contains-megaattitude',
  sourceUri: SAMPLE_NODE_URI,
  targetUri: SAMPLE_EPRINT_URI,
  relationSlug: 'contains',
  weight: 1.0,
  status: 'established',
  createdAt: '2025-06-15T10:00:00Z',
};

const SAMPLE_NODE_ROW = {
  uri: SAMPLE_NODE_URI,
  node_id: 'formal-semantics-list',
  kind: 'object',
  subkind: 'collection',
  label: 'Formal Semantics Reading List',
  alternate_labels: JSON.stringify(['Model-Theoretic Semantics Papers']),
  description: 'Papers on formal and model-theoretic semantics',
  status: 'established',
  created_at: new Date('2025-06-15T10:00:00Z'),
};

// ============================================================================
// Tests
// ============================================================================

describe('PersonalGraphService', () => {
  let service: PersonalGraphService;
  let logger: ILogger;
  let pool: MockDatabasePool;

  beforeEach(() => {
    logger = createMockLogger();
    pool = createMockPool();
    service = new PersonalGraphService({
      pool: pool as unknown as never,
      logger,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // indexNode
  // ==========================================================================

  describe('indexNode', () => {
    it('indexes a personal graph node', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.indexNode(SAMPLE_NODE_RECORD, SAMPLE_METADATA);

      expect(isOk(result)).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO personal_graph_nodes_index'),
        expect.arrayContaining([
          SAMPLE_NODE_URI,
          'bafyreiabc123def456',
          SAMPLE_DID,
          'formal-semantics-list',
          'object',
          'collection',
          'Formal Semantics Reading List',
        ])
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Indexed personal graph node',
        expect.objectContaining({
          uri: SAMPLE_NODE_URI,
          ownerDid: SAMPLE_DID,
          kind: 'object',
          subkind: 'collection',
        })
      );
    });

    it('upserts on conflict', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await service.indexNode(SAMPLE_NODE_RECORD, SAMPLE_METADATA);

      const queryArg = pool.query.mock.calls[0]?.[0] as string;
      expect(queryArg).toContain('ON CONFLICT (uri) DO UPDATE SET');
      expect(queryArg).toContain('label = EXCLUDED.label');
      expect(queryArg).toContain('description = EXCLUDED.description');
    });

    it('returns validation error when label is missing', async () => {
      const invalidRecord = { ...SAMPLE_NODE_RECORD, label: '' };

      const result = await service.indexNode(invalidRecord, SAMPLE_METADATA);

      expect(isErr(result)).toBe(true);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('label');
      }
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('returns validation error when kind is missing', async () => {
      const invalidRecord = { ...SAMPLE_NODE_RECORD, kind: '' };

      const result = await service.indexNode(invalidRecord, SAMPLE_METADATA);

      expect(isErr(result)).toBe(true);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(ValidationError);
      }
    });

    it('serializes alternateLabels as JSON', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await service.indexNode(SAMPLE_NODE_RECORD, SAMPLE_METADATA);

      const params = pool.query.mock.calls[0]?.[1] as unknown[];
      // alternateLabels is the 8th parameter (index 7)
      expect(params?.[7]).toBe(JSON.stringify(['Model-Theoretic Semantics Papers']));
    });

    it('defaults status to established when not specified', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });
      const recordNoStatus = { ...SAMPLE_NODE_RECORD, status: undefined };

      await service.indexNode(recordNoStatus, SAMPLE_METADATA);

      const params = pool.query.mock.calls[0]?.[1] as unknown[];
      // status is the 10th parameter (index 9)
      expect(params?.[9]).toBe('established');
    });

    it('returns database error on query failure', async () => {
      pool.query.mockRejectedValueOnce(new Error('Disk full'));

      const result = await service.indexNode(SAMPLE_NODE_RECORD, SAMPLE_METADATA);

      expect(isErr(result)).toBe(true);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(DatabaseError);
        expect(result.error.message).toContain('Failed to index personal graph node');
      }
    });

    it('extracts owner DID from AT-URI', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });
      const metadata = {
        ...SAMPLE_METADATA,
        uri: 'at://did:plc:jgrove/pub.chive.graph.node/my-list' as AtUri,
      };

      await service.indexNode(SAMPLE_NODE_RECORD, metadata);

      const params = pool.query.mock.calls[0]?.[1] as unknown[];
      expect(params?.[2]).toBe('did:plc:jgrove');
    });
  });

  // ==========================================================================
  // indexEdge
  // ==========================================================================

  describe('indexEdge', () => {
    it('indexes a personal graph edge', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.indexEdge(SAMPLE_EDGE_RECORD, {
        ...SAMPLE_METADATA,
        uri: SAMPLE_EDGE_URI,
      });

      expect(isOk(result)).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO personal_graph_edges_index'),
        expect.arrayContaining([SAMPLE_EDGE_URI, SAMPLE_NODE_URI, SAMPLE_EPRINT_URI, 'contains'])
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Indexed personal graph edge',
        expect.objectContaining({
          relationSlug: 'contains',
        })
      );
    });

    it('upserts on conflict for edges', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await service.indexEdge(SAMPLE_EDGE_RECORD, {
        ...SAMPLE_METADATA,
        uri: SAMPLE_EDGE_URI,
      });

      const queryArg = pool.query.mock.calls[0]?.[0] as string;
      expect(queryArg).toContain('ON CONFLICT (uri) DO UPDATE SET');
      expect(queryArg).toContain('relation_slug = EXCLUDED.relation_slug');
    });

    it('returns validation error when sourceUri is missing', async () => {
      const invalidEdge = { ...SAMPLE_EDGE_RECORD, sourceUri: '' };

      const result = await service.indexEdge(invalidEdge, SAMPLE_METADATA);

      expect(isErr(result)).toBe(true);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('sourceUri');
      }
    });

    it('returns validation error when targetUri is missing', async () => {
      const invalidEdge = { ...SAMPLE_EDGE_RECORD, targetUri: '' };

      const result = await service.indexEdge(invalidEdge, SAMPLE_METADATA);

      expect(isErr(result)).toBe(true);
    });

    it('returns validation error when relationSlug is missing', async () => {
      const invalidEdge = { ...SAMPLE_EDGE_RECORD, relationSlug: '' };

      const result = await service.indexEdge(invalidEdge, SAMPLE_METADATA);

      expect(isErr(result)).toBe(true);
    });

    it('returns database error on query failure', async () => {
      pool.query.mockRejectedValueOnce(new Error('Constraint violation'));

      const result = await service.indexEdge(SAMPLE_EDGE_RECORD, {
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
  // updateNode / updateEdge
  // ==========================================================================

  describe('updateNode', () => {
    it('delegates to indexNode with overridden URI', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.updateNode(SAMPLE_NODE_URI, SAMPLE_NODE_RECORD, SAMPLE_METADATA);

      expect(isOk(result)).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO personal_graph_nodes_index'),
        expect.arrayContaining([SAMPLE_NODE_URI])
      );
    });
  });

  describe('updateEdge', () => {
    it('delegates to indexEdge with overridden URI', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.updateEdge(SAMPLE_EDGE_URI, SAMPLE_EDGE_RECORD, {
        ...SAMPLE_METADATA,
        uri: SAMPLE_EDGE_URI,
      });

      expect(isOk(result)).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO personal_graph_edges_index'),
        expect.arrayContaining([SAMPLE_EDGE_URI])
      );
    });
  });

  // ==========================================================================
  // deleteNode
  // ==========================================================================

  describe('deleteNode', () => {
    it('deletes node from index', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.deleteNode(SAMPLE_NODE_URI);

      expect(isOk(result)).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM personal_graph_nodes_index'),
        [SAMPLE_NODE_URI]
      );
      expect(logger.info).toHaveBeenCalledWith('Deleted personal graph node', {
        uri: SAMPLE_NODE_URI,
      });
    });

    it('returns database error on failure', async () => {
      pool.query.mockRejectedValueOnce(new Error('Permission denied'));

      const result = await service.deleteNode(SAMPLE_NODE_URI);

      expect(isErr(result)).toBe(true);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(DatabaseError);
        expect(result.error.message).toContain('Failed to delete personal graph node');
      }
    });
  });

  // ==========================================================================
  // deleteEdge
  // ==========================================================================

  describe('deleteEdge', () => {
    it('deletes edge from index', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.deleteEdge(SAMPLE_EDGE_URI);

      expect(isOk(result)).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM personal_graph_edges_index'),
        [SAMPLE_EDGE_URI]
      );
      expect(logger.info).toHaveBeenCalledWith('Deleted personal graph edge', {
        uri: SAMPLE_EDGE_URI,
      });
    });

    it('returns database error on failure', async () => {
      pool.query.mockRejectedValueOnce(new Error('FK constraint'));

      const result = await service.deleteEdge(SAMPLE_EDGE_URI);

      expect(isErr(result)).toBe(true);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(DatabaseError);
      }
    });
  });

  // ==========================================================================
  // listPersonalNodeTypes
  // ==========================================================================

  describe('listPersonalNodeTypes', () => {
    it('returns distinct subkinds for a DID', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ subkind: 'collection' }, { subkind: 'reading-list' }, { subkind: 'tag-group' }],
      });

      const result = await service.listPersonalNodeTypes(SAMPLE_DID);

      expect(result).toEqual(['collection', 'reading-list', 'tag-group']);
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('SELECT DISTINCT subkind'), [
        SAMPLE_DID,
      ]);
    });

    it('returns empty array for user with no personal nodes', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.listPersonalNodeTypes('did:plc:newuser' as DID);

      expect(result).toEqual([]);
    });

    it('returns empty array on database error', async () => {
      pool.query.mockRejectedValueOnce(new Error('Query failed'));

      const result = await service.listPersonalNodeTypes(SAMPLE_DID);

      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // listPersonalRelationTypes
  // ==========================================================================

  describe('listPersonalRelationTypes', () => {
    it('returns distinct relation slugs for a DID', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ relation_slug: 'contains' }, { relation_slug: 'subcollection-of' }],
      });

      const result = await service.listPersonalRelationTypes(SAMPLE_DID);

      expect(result).toEqual(['contains', 'subcollection-of']);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT DISTINCT relation_slug'),
        [SAMPLE_DID]
      );
    });

    it('returns empty array for user with no edges', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.listPersonalRelationTypes('did:plc:newuser' as DID);

      expect(result).toEqual([]);
    });

    it('returns empty array on database error', async () => {
      pool.query.mockRejectedValueOnce(new Error('Timeout'));

      const result = await service.listPersonalRelationTypes(SAMPLE_DID);

      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // searchPersonalNodes
  // ==========================================================================

  describe('searchPersonalNodes', () => {
    it('returns nodes matching search query', async () => {
      pool.query.mockResolvedValueOnce({ rows: [SAMPLE_NODE_ROW] });

      const result = await service.searchPersonalNodes(SAMPLE_DID, 'semantics');

      expect(result).toHaveLength(1);
      expect(result[0]?.label).toBe('Formal Semantics Reading List');
      expect(result[0]?.id).toBe('formal-semantics-list');
      expect(result[0]?.kind).toBe('object');

      // Verify ILIKE pattern
      const params = pool.query.mock.calls[0]?.[1] as unknown[];
      expect(params?.[1]).toBe('%semantics%');
    });

    it('returns empty for no matches', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.searchPersonalNodes(SAMPLE_DID, 'quantum physics');

      expect(result).toEqual([]);
    });

    it('filters by subkind when specified', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await service.searchPersonalNodes(SAMPLE_DID, 'list', { subkind: 'collection' });

      const queryArg = pool.query.mock.calls[0]?.[0] as string;
      expect(queryArg).toContain('subkind = $3');
      const params = pool.query.mock.calls[0]?.[1] as unknown[];
      expect(params?.[2]).toBe('collection');
    });

    it('caps limit at 100', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await service.searchPersonalNodes(SAMPLE_DID, 'papers', { limit: 500 });

      const params = pool.query.mock.calls[0]?.[1] as unknown[];
      const lastParam = params?.[params.length - 1];
      expect(lastParam).toBe(100);
    });

    it('defaults limit to 50', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await service.searchPersonalNodes(SAMPLE_DID, 'papers');

      const params = pool.query.mock.calls[0]?.[1] as unknown[];
      const lastParam = params?.[params.length - 1];
      expect(lastParam).toBe(50);
    });

    it('parses alternateLabels from JSONB string', async () => {
      pool.query.mockResolvedValueOnce({ rows: [SAMPLE_NODE_ROW] });

      const result = await service.searchPersonalNodes(SAMPLE_DID, 'semantics');

      expect(result[0]?.alternateLabels).toEqual(['Model-Theoretic Semantics Papers']);
    });

    it('handles null alternateLabels', async () => {
      const rowNoAlternates = { ...SAMPLE_NODE_ROW, alternate_labels: null };
      pool.query.mockResolvedValueOnce({ rows: [rowNoAlternates] });

      const result = await service.searchPersonalNodes(SAMPLE_DID, 'semantics');

      expect(result[0]?.alternateLabels).toBeUndefined();
    });

    it('returns empty array on database error', async () => {
      pool.query.mockRejectedValueOnce(new Error('Search timeout'));

      const result = await service.searchPersonalNodes(SAMPLE_DID, 'papers');

      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to search personal nodes',
        expect.any(Error),
        expect.objectContaining({ did: SAMPLE_DID, query: 'papers' })
      );
    });
  });
});
