/**
 * Unit tests for PersonalGraphService.expandSubgraph.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { PersonalGraphService } from '../../../../src/services/graph/personal-graph-service.js';
import { DatabaseError } from '../../../../src/types/errors.js';
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
// Sample Data
// ============================================================================

const ROOT_URI = 'at://did:plc:aswhite/pub.chive.graph.node/semantics-list';
const NEIGHBOR_URI_A = 'at://did:plc:aswhite/pub.chive.eprint.submission/paper-a';
const NEIGHBOR_URI_B = 'at://did:plc:aswhite/pub.chive.eprint.submission/paper-b';
const DEPTH_2_URI = 'at://did:plc:aswhite/pub.chive.graph.node/syntax-list';

const EDGE_1_URI = 'at://did:plc:aswhite/pub.chive.graph.edge/edge-1';
const EDGE_2_URI = 'at://did:plc:aswhite/pub.chive.graph.edge/edge-2';
const EDGE_3_URI = 'at://did:plc:aswhite/pub.chive.graph.edge/edge-3';
const COLLECTION_EDGE_URI = 'at://did:plc:aswhite/pub.chive.graph.edge/col-edge-1';

// ============================================================================
// Tests
// ============================================================================

describe('PersonalGraphService.expandSubgraph', () => {
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
  // BFS from single root, depth 1
  // ==========================================================================

  describe('single root, depth 1', () => {
    it('returns root and immediate neighbors', async () => {
      // First call: personal_graph_edges_index for frontier [ROOT_URI]
      pool.query
        .mockResolvedValueOnce({
          rows: [
            {
              uri: EDGE_1_URI,
              source_uri: ROOT_URI,
              target_uri: NEIGHBOR_URI_A,
              relation_slug: 'contains',
              weight: null,
            },
          ],
        })
        // Second call: collection_edges_index for frontier [ROOT_URI]
        .mockResolvedValueOnce({ rows: [] })
        // Third call: personal_graph_nodes_index for all URIs
        .mockResolvedValueOnce({
          rows: [
            {
              uri: ROOT_URI,
              label: 'Semantics List',
              kind: 'object',
              subkind: 'collection',
              description: 'A reading list',
              metadata: null,
            },
          ],
        });

      const result = await service.expandSubgraph([ROOT_URI], { depth: 1 });

      expect(isOk(result)).toBe(true);
      if (!result.ok) return;

      expect(result.value.nodes).toHaveLength(2);
      expect(result.value.edges).toHaveLength(1);
      expect(result.value.truncated).toBe(false);

      // Verify root node has metadata
      const rootNode = result.value.nodes.find((n) => n.uri === ROOT_URI);
      expect(rootNode?.label).toBe('Semantics List');
      expect(rootNode?.kind).toBe('object');

      // Verify neighbor is a stub (not in personal_graph_nodes_index)
      const neighborNode = result.value.nodes.find((n) => n.uri === NEIGHBOR_URI_A);
      expect(neighborNode?.kind).toBe('unknown');
    });
  });

  // ==========================================================================
  // BFS from single root, depth 2
  // ==========================================================================

  describe('single root, depth 2', () => {
    it('returns two levels of traversal', async () => {
      // Depth 0: edges from ROOT_URI
      pool.query
        .mockResolvedValueOnce({
          rows: [
            {
              uri: EDGE_1_URI,
              source_uri: ROOT_URI,
              target_uri: NEIGHBOR_URI_A,
              relation_slug: 'contains',
              weight: null,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] })
        // Depth 1: edges from NEIGHBOR_URI_A
        .mockResolvedValueOnce({
          rows: [
            {
              uri: EDGE_2_URI,
              source_uri: NEIGHBOR_URI_A,
              target_uri: DEPTH_2_URI,
              relation_slug: 'related-to',
              weight: null,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] })
        // Final node fetch
        .mockResolvedValueOnce({
          rows: [
            {
              uri: ROOT_URI,
              label: 'Semantics List',
              kind: 'object',
              subkind: null,
              description: null,
              metadata: null,
            },
            {
              uri: DEPTH_2_URI,
              label: 'Syntax List',
              kind: 'object',
              subkind: null,
              description: null,
              metadata: null,
            },
          ],
        });

      const result = await service.expandSubgraph([ROOT_URI], { depth: 2 });

      expect(isOk(result)).toBe(true);
      if (!result.ok) return;

      // ROOT_URI, NEIGHBOR_URI_A, DEPTH_2_URI
      expect(result.value.nodes).toHaveLength(3);
      expect(result.value.edges).toHaveLength(2);
      expect(result.value.truncated).toBe(false);
    });
  });

  // ==========================================================================
  // Multiple roots
  // ==========================================================================

  describe('multiple roots', () => {
    it('starts BFS from multiple URIs', async () => {
      const ROOT_2 = 'at://did:plc:aswhite/pub.chive.graph.node/phonology-list';

      // Depth 0: edges from both roots
      pool.query
        .mockResolvedValueOnce({
          rows: [
            {
              uri: EDGE_1_URI,
              source_uri: ROOT_URI,
              target_uri: NEIGHBOR_URI_A,
              relation_slug: 'contains',
              weight: null,
            },
            {
              uri: EDGE_2_URI,
              source_uri: ROOT_2,
              target_uri: NEIGHBOR_URI_B,
              relation_slug: 'contains',
              weight: null,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] })
        // Node fetch
        .mockResolvedValueOnce({
          rows: [
            {
              uri: ROOT_URI,
              label: 'Semantics',
              kind: 'object',
              subkind: null,
              description: null,
              metadata: null,
            },
            {
              uri: ROOT_2,
              label: 'Phonology',
              kind: 'object',
              subkind: null,
              description: null,
              metadata: null,
            },
          ],
        });

      const result = await service.expandSubgraph([ROOT_URI, ROOT_2], { depth: 1 });

      expect(isOk(result)).toBe(true);
      if (!result.ok) return;

      // Both roots + both neighbors
      expect(result.value.nodes).toHaveLength(4);
      expect(result.value.edges).toHaveLength(2);
    });
  });

  // ==========================================================================
  // Edge type filtering
  // ==========================================================================

  describe('edge type filtering', () => {
    it('only returns edges matching specified relation slugs', async () => {
      pool.query
        .mockResolvedValueOnce({
          rows: [
            {
              uri: EDGE_1_URI,
              source_uri: ROOT_URI,
              target_uri: NEIGHBOR_URI_A,
              relation_slug: 'contains',
              weight: null,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [
            {
              uri: ROOT_URI,
              label: 'Root',
              kind: 'object',
              subkind: null,
              description: null,
              metadata: null,
            },
          ],
        });

      const result = await service.expandSubgraph([ROOT_URI], {
        depth: 1,
        edgeTypes: ['contains'],
      });

      expect(isOk(result)).toBe(true);
      if (!result.ok) return;

      // Verify the SQL includes the edge type filter
      const firstCall = pool.query.mock.calls[0];
      const sql = firstCall?.[0] as string;
      expect(sql).toContain('relation_slug = ANY($2)');

      const params = firstCall?.[1] as unknown[];
      expect(params?.[1]).toEqual(['contains']);
    });
  });

  // ==========================================================================
  // maxNodes capping
  // ==========================================================================

  describe('maxNodes capping', () => {
    it('stops when node cap is reached and sets truncated to true', async () => {
      // Return many edges that would expand beyond maxNodes=3
      pool.query
        .mockResolvedValueOnce({
          rows: [
            {
              uri: EDGE_1_URI,
              source_uri: ROOT_URI,
              target_uri: NEIGHBOR_URI_A,
              relation_slug: 'contains',
              weight: null,
            },
            {
              uri: EDGE_2_URI,
              source_uri: ROOT_URI,
              target_uri: NEIGHBOR_URI_B,
              relation_slug: 'contains',
              weight: null,
            },
            {
              uri: EDGE_3_URI,
              source_uri: ROOT_URI,
              target_uri: DEPTH_2_URI,
              relation_slug: 'contains',
              weight: null,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] })
        // Node fetch for discovered URIs
        .mockResolvedValueOnce({
          rows: [
            {
              uri: ROOT_URI,
              label: 'Root',
              kind: 'object',
              subkind: null,
              description: null,
              metadata: null,
            },
          ],
        });

      // maxNodes=3 means root + 2 neighbors max; the third should be cut off
      const result = await service.expandSubgraph([ROOT_URI], { depth: 1, maxNodes: 3 });

      expect(isOk(result)).toBe(true);
      if (!result.ok) return;

      expect(result.value.nodes.length).toBeLessThanOrEqual(3);
      expect(result.value.truncated).toBe(true);
    });
  });

  // ==========================================================================
  // Disconnected node (no edges)
  // ==========================================================================

  describe('disconnected node', () => {
    it('returns just the root with no edges', async () => {
      // No edges found
      pool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        // Node fetch
        .mockResolvedValueOnce({
          rows: [
            {
              uri: ROOT_URI,
              label: 'Lonely Node',
              kind: 'object',
              subkind: 'collection',
              description: 'No connections',
              metadata: null,
            },
          ],
        });

      const result = await service.expandSubgraph([ROOT_URI], { depth: 2 });

      expect(isOk(result)).toBe(true);
      if (!result.ok) return;

      expect(result.value.nodes).toHaveLength(1);
      expect(result.value.nodes[0]?.uri).toBe(ROOT_URI);
      expect(result.value.nodes[0]?.label).toBe('Lonely Node');
      expect(result.value.edges).toHaveLength(0);
      expect(result.value.truncated).toBe(false);
    });
  });

  // ==========================================================================
  // Edge deduplication across tables
  // ==========================================================================

  describe('edge deduplication', () => {
    it('deduplicates edges across personal and collection tables', async () => {
      const sharedEdgeUri = EDGE_1_URI;

      pool.query
        // personal_graph_edges_index
        .mockResolvedValueOnce({
          rows: [
            {
              uri: sharedEdgeUri,
              source_uri: ROOT_URI,
              target_uri: NEIGHBOR_URI_A,
              relation_slug: 'contains',
              weight: null,
            },
          ],
        })
        // collection_edges_index returns same URI
        .mockResolvedValueOnce({
          rows: [
            {
              uri: sharedEdgeUri,
              source_uri: ROOT_URI,
              target_uri: NEIGHBOR_URI_A,
              relation_slug: 'contains',
              label: 'Custom Label',
              weight: null,
            },
            {
              uri: COLLECTION_EDGE_URI,
              source_uri: ROOT_URI,
              target_uri: NEIGHBOR_URI_B,
              relation_slug: 'contains',
              label: null,
              weight: null,
            },
          ],
        })
        // Node fetch
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.expandSubgraph([ROOT_URI], { depth: 1 });

      expect(isOk(result)).toBe(true);
      if (!result.ok) return;

      // Shared edge counted once, plus the unique collection edge
      expect(result.value.edges).toHaveLength(2);
      const edgeUris = result.value.edges.map((e) => e.uri);
      expect(edgeUris).toContain(sharedEdgeUri);
      expect(edgeUris).toContain(COLLECTION_EDGE_URI);
    });
  });

  // ==========================================================================
  // Database error handling
  // ==========================================================================

  describe('database error', () => {
    it('returns Err result on query failure', async () => {
      pool.query.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await service.expandSubgraph([ROOT_URI]);

      expect(isErr(result)).toBe(true);
      if (result.ok) return;

      expect(result.error).toBeInstanceOf(DatabaseError);
      expect(result.error.message).toContain('Failed to expand subgraph');
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to expand subgraph',
        expect.any(DatabaseError),
        expect.objectContaining({ rootUris: [ROOT_URI] })
      );
    });
  });

  // ==========================================================================
  // Default options
  // ==========================================================================

  describe('default options', () => {
    it('uses depth 2 and maxNodes 100 when not specified', async () => {
      // Depth 0: no edges
      pool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        // Node fetch
        .mockResolvedValueOnce({
          rows: [
            {
              uri: ROOT_URI,
              label: 'Root',
              kind: 'object',
              subkind: null,
              description: null,
              metadata: null,
            },
          ],
        });

      const result = await service.expandSubgraph([ROOT_URI]);

      expect(isOk(result)).toBe(true);
      if (!result.ok) return;

      // Even though depth=2, no edges means only root node
      expect(result.value.nodes).toHaveLength(1);
      expect(result.value.truncated).toBe(false);
    });
  });

  // ==========================================================================
  // Clamps depth and maxNodes
  // ==========================================================================

  describe('parameter clamping', () => {
    it('clamps depth to range [1, 5]', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      // depth=0 should be clamped to 1
      await service.expandSubgraph([ROOT_URI], { depth: 0 });

      // With depth clamped to 1, we should have exactly one round of
      // edge queries (2 queries: personal + collection) then the node fetch
      expect(pool.query).toHaveBeenCalledTimes(3);
    });

    it('clamps maxNodes to range [1, 200]', async () => {
      // Many edges to test the cap
      const manyEdges = Array.from({ length: 250 }, (_, i) => ({
        uri: `at://did:plc:aswhite/pub.chive.graph.edge/edge-${i}`,
        source_uri: ROOT_URI,
        target_uri: `at://did:plc:aswhite/pub.chive.eprint.submission/paper-${i}`,
        relation_slug: 'contains',
        weight: null,
      }));

      pool.query
        .mockResolvedValueOnce({ rows: manyEdges })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      // maxNodes=999 should be clamped to 200
      const result = await service.expandSubgraph([ROOT_URI], {
        depth: 1,
        maxNodes: 999,
      });

      expect(isOk(result)).toBe(true);
      if (!result.ok) return;

      // Should have at most 200 nodes (root + 199 neighbors)
      expect(result.value.nodes.length).toBeLessThanOrEqual(200);
    });
  });

  // ==========================================================================
  // Metadata parsing
  // ==========================================================================

  describe('metadata handling', () => {
    it('parses JSONB metadata from nodes', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [
            {
              uri: ROOT_URI,
              label: 'Root',
              kind: 'object',
              subkind: 'collection',
              description: 'Test node',
              metadata: { eprintUri: 'at://test', color: 'blue' },
            },
          ],
        });

      const result = await service.expandSubgraph([ROOT_URI], { depth: 1 });

      expect(isOk(result)).toBe(true);
      if (!result.ok) return;

      const node = result.value.nodes.find((n) => n.uri === ROOT_URI);
      expect(node?.metadata).toEqual({ eprintUri: 'at://test', color: 'blue' });
    });
  });
});
