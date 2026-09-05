/**
 * Unit tests for Neo4j citation graph storage.
 *
 * @remarks
 * Tests the CitationGraph implementation that manages CITES relationships
 * between Chive eprints. Uses mocked Neo4jConnection to test query
 * generation and result mapping without requiring a real database.
 */

import 'reflect-metadata';

import { Integer } from 'neo4j-driver';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

import { CitationGraph } from '@/storage/neo4j/citation-graph.js';
import type { Neo4jConnection } from '@/storage/neo4j/connection.js';
import type { AtUri } from '@/types/atproto.js';
import type { CitationRelationship } from '@/types/interfaces/discovery.interface.js';

/**
 * Extracts the numeric value from a Neo4j Integer or returns the number as-is.
 */
function toNumber(value: unknown): number {
  if (Integer.isInteger(value)) {
    return value.toInt();
  }
  return value as number;
}

interface MockRecord {
  get: (key: string) => unknown;
}

interface MockQueryResult {
  records: MockRecord[];
  summary: Record<string, unknown>;
}

/**
 * Creates a mock Neo4j record that mimics the driver's Record interface.
 */
function createMockRecord(data: Record<string, unknown>): MockRecord {
  return {
    get: (key: string): unknown => data[key],
  };
}

/**
 * Creates a mock Neo4jConnection with configurable query behavior.
 */
function createMockConnection(): Neo4jConnection & { executeQuery: Mock } {
  return {
    executeQuery: vi.fn(),
    executeTransaction: vi.fn(),
    getSession: vi.fn(),
    healthCheck: vi.fn(),
    isConnectionHealthy: vi.fn(),
    close: vi.fn(),
  } as unknown as Neo4jConnection & { executeQuery: Mock };
}

describe('CitationGraph', () => {
  let citationGraph: CitationGraph;
  let mockConnection: ReturnType<typeof createMockConnection>;

  beforeEach(() => {
    mockConnection = createMockConnection();
    citationGraph = new CitationGraph(mockConnection);
  });

  describe('upsertCitationsBatch', () => {
    it('should skip empty citation batches', async () => {
      await citationGraph.upsertCitationsBatch([]);

      expect(mockConnection.executeQuery).not.toHaveBeenCalled();
    });

    it('should batch upsert citations using UNWIND', async () => {
      const citations: CitationRelationship[] = [
        {
          citingUri: 'at://did:plc:abc/pub.chive.eprint.submission/1' as AtUri,
          citedUri: 'at://did:plc:xyz/pub.chive.eprint.submission/2' as AtUri,
          isInfluential: true,
          source: 'semantic-scholar',
        },
        {
          citingUri: 'at://did:plc:abc/pub.chive.eprint.submission/1' as AtUri,
          citedUri: 'at://did:plc:def/pub.chive.eprint.submission/3' as AtUri,
          source: 'openalex',
        },
      ];

      mockConnection.executeQuery.mockResolvedValue({ records: [], summary: {} });

      await citationGraph.upsertCitationsBatch(citations);

      expect(mockConnection.executeQuery).toHaveBeenCalledTimes(1);

      const callArgs = mockConnection.executeQuery.mock.calls[0] as [
        string,
        {
          citations: {
            citingUri: AtUri;
            citedUri: AtUri;
            isInfluential: boolean;
            source: string;
          }[];
        },
      ];
      const query = callArgs[0];
      const params = callArgs[1];

      expect(query).toContain('UNWIND $citations AS citation');
      expect(query).toContain('MERGE (citing)-[r:CITES]->(cited)');
      expect(params.citations).toHaveLength(2);
      const firstCitation = params.citations[0];
      const secondCitation = params.citations[1];
      expect(firstCitation).toBeDefined();
      expect(secondCitation).toBeDefined();
      expect(firstCitation?.isInfluential).toBe(true);
      expect(secondCitation?.isInfluential).toBe(false); // Default
    });

    it('should throw DatabaseError on query failure', async () => {
      mockConnection.executeQuery.mockRejectedValue(new Error('Connection failed'));

      const citations: CitationRelationship[] = [
        {
          citingUri: 'at://did:plc:abc/pub.chive.eprint.submission/1' as AtUri,
          citedUri: 'at://did:plc:xyz/pub.chive.eprint.submission/2' as AtUri,
          source: 'semantic-scholar',
        },
      ];

      await expect(citationGraph.upsertCitationsBatch(citations)).rejects.toThrow(
        'Failed to upsert citations'
      );
    });
  });

  describe('getCitingPapers', () => {
    it('should return papers citing a given eprint', async () => {
      const paperUri = 'at://did:plc:abc/pub.chive.eprint.submission/1' as AtUri;

      const citationRecord: MockQueryResult = {
        records: [
          createMockRecord({
            citingUri: 'at://did:plc:xyz/pub.chive.eprint.submission/2',
            citedUri: paperUri,
            isInfluential: true,
            source: 'semantic-scholar',
            discoveredAt: '2024-01-15T10:00:00Z',
          }),
        ],
        summary: {},
      };
      const countRecord: MockQueryResult = {
        records: [createMockRecord({ total: 1 })],
        summary: {},
      };

      mockConnection.executeQuery
        .mockResolvedValueOnce(citationRecord)
        .mockResolvedValueOnce(countRecord);

      const result = await citationGraph.getCitingPapers(paperUri);

      expect(result.citations).toHaveLength(1);
      const citation = result.citations[0];
      expect(citation).toBeDefined();
      expect(citation?.citingUri).toBe('at://did:plc:xyz/pub.chive.eprint.submission/2');
      expect(citation?.isInfluential).toBe(true);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
    });

    it('should apply onlyInfluential filter', async () => {
      const paperUri = 'at://did:plc:abc/pub.chive.eprint.submission/1' as AtUri;

      mockConnection.executeQuery
        .mockResolvedValueOnce({ records: [], summary: {} })
        .mockResolvedValueOnce({ records: [createMockRecord({ total: 0 })], summary: {} });

      await citationGraph.getCitingPapers(paperUri, { onlyInfluential: true });

      const query = (mockConnection.executeQuery.mock.calls[0] as [string])[0];
      expect(query).toContain('AND r.isInfluential = true');
    });

    it('should handle pagination with offset and limit', async () => {
      const paperUri = 'at://did:plc:abc/pub.chive.eprint.submission/1' as AtUri;

      const citationRecord: MockQueryResult = {
        records: [
          createMockRecord({
            citingUri: 'at://did:plc:xyz/pub.chive.eprint.submission/2',
            citedUri: paperUri,
            isInfluential: false,
            source: 'openalex',
            discoveredAt: null,
          }),
        ],
        summary: {},
      };

      mockConnection.executeQuery
        .mockResolvedValueOnce(citationRecord)
        .mockResolvedValueOnce({ records: [createMockRecord({ total: 10 })], summary: {} });

      const result = await citationGraph.getCitingPapers(paperUri, { limit: 5, offset: 5 });

      expect(result.hasMore).toBe(true);

      const params = (
        mockConnection.executeQuery.mock.calls[0] as [string, { limit: unknown; offset: unknown }]
      )[1];
      expect(toNumber(params.limit)).toBe(5);
      expect(toNumber(params.offset)).toBe(5);
    });
  });

  describe('getReferences', () => {
    it('should return papers that an eprint cites', async () => {
      const paperUri = 'at://did:plc:abc/pub.chive.eprint.submission/1' as AtUri;

      const refRecord: MockQueryResult = {
        records: [
          createMockRecord({
            citingUri: paperUri,
            citedUri: 'at://did:plc:xyz/pub.chive.eprint.submission/2',
            isInfluential: false,
            source: 'openalex',
            discoveredAt: '2024-01-15T10:00:00Z',
          }),
        ],
        summary: {},
      };

      mockConnection.executeQuery
        .mockResolvedValueOnce(refRecord)
        .mockResolvedValueOnce({ records: [createMockRecord({ total: 1 })], summary: {} });

      const result = await citationGraph.getReferences(paperUri);

      expect(result.citations).toHaveLength(1);
      const citation = result.citations[0];
      expect(citation).toBeDefined();
      expect(citation?.citedUri).toBe('at://did:plc:xyz/pub.chive.eprint.submission/2');
      expect(result.total).toBe(1);
    });
  });

  describe('findCoCitedPapers', () => {
    it('should return co-cited papers with strength scores', async () => {
      const paperUri = 'at://did:plc:abc/pub.chive.eprint.submission/1' as AtUri;

      const coCitedRecord: MockQueryResult = {
        records: [
          createMockRecord({
            uri: 'at://did:plc:xyz/pub.chive.eprint.submission/2',
            title: 'Related Paper',
            abstract: 'An abstract',
            categories: ['cs.AI', 'cs.LG'],
            publicationDate: '2024-01-15',
            coCitationCount: 5,
            strength: 0.75,
          }),
        ],
        summary: {},
      };

      mockConnection.executeQuery.mockResolvedValue(coCitedRecord);

      const result = await citationGraph.findCoCitedPapers(paperUri, 3);

      expect(result).toHaveLength(1);
      const coCited = result[0];
      expect(coCited).toBeDefined();
      expect(coCited?.uri).toBe('at://did:plc:xyz/pub.chive.eprint.submission/2');
      expect(coCited?.title).toBe('Related Paper');
      expect(coCited?.coCitationCount).toBe(5);
      expect(coCited?.strength).toBe(0.75);
      expect(coCited?.categories).toEqual(['cs.AI', 'cs.LG']);

      const params = (
        mockConnection.executeQuery.mock.calls[0] as [string, { minCoCitations: unknown }]
      )[1];
      expect(toNumber(params.minCoCitations)).toBe(3);
    });

    it('should use default minCoCitations of 2', async () => {
      const paperUri = 'at://did:plc:abc/pub.chive.eprint.submission/1' as AtUri;

      mockConnection.executeQuery.mockResolvedValue({ records: [], summary: {} });

      await citationGraph.findCoCitedPapers(paperUri);

      const params = (
        mockConnection.executeQuery.mock.calls[0] as [string, { minCoCitations: unknown }]
      )[1];
      expect(toNumber(params.minCoCitations)).toBe(2);
    });

    it('should handle null optional fields in co-cited papers', async () => {
      const paperUri = 'at://did:plc:abc/pub.chive.eprint.submission/1' as AtUri;

      const minimalRecord: MockQueryResult = {
        records: [
          createMockRecord({
            uri: 'at://did:plc:xyz/pub.chive.eprint.submission/2',
            title: 'Minimal Paper',
            abstract: null,
            categories: null,
            publicationDate: null,
            coCitationCount: 2,
            strength: 0.5,
          }),
        ],
        summary: {},
      };

      mockConnection.executeQuery.mockResolvedValue(minimalRecord);

      const result = await citationGraph.findCoCitedPapers(paperUri);

      expect(result).toHaveLength(1);
      const coCited = result[0];
      expect(coCited).toBeDefined();
      expect(coCited?.abstract).toBeUndefined();
      expect(coCited?.categories).toBeUndefined();
      expect(coCited?.publicationDate).toBeUndefined();
    });
  });

  describe('getCitationCounts', () => {
    it('should return citation statistics', async () => {
      const paperUri = 'at://did:plc:abc/pub.chive.eprint.submission/1' as AtUri;

      const countsRecord: MockQueryResult = {
        records: [
          createMockRecord({
            citedByCount: 10,
            referencesCount: 25,
            influentialCitedByCount: 3,
          }),
        ],
        summary: {},
      };

      mockConnection.executeQuery.mockResolvedValue(countsRecord);

      const counts = await citationGraph.getCitationCounts(paperUri);

      expect(counts.citedByCount).toBe(10);
      expect(counts.referencesCount).toBe(25);
      expect(counts.influentialCitedByCount).toBe(3);
    });

    it('should return zeros when paper not found', async () => {
      const paperUri = 'at://did:plc:abc/pub.chive.eprint.submission/unknown' as AtUri;

      mockConnection.executeQuery.mockResolvedValue({ records: [], summary: {} });

      const counts = await citationGraph.getCitationCounts(paperUri);

      expect(counts.citedByCount).toBe(0);
      expect(counts.referencesCount).toBe(0);
      expect(counts.influentialCitedByCount).toBe(0);
    });
  });

  describe('deleteCitationsForPaper', () => {
    it('should delete all citation edges for a paper', async () => {
      const paperUri = 'at://did:plc:abc/pub.chive.eprint.submission/1' as AtUri;

      mockConnection.executeQuery.mockResolvedValue({ records: [], summary: {} });

      await citationGraph.deleteCitationsForPaper(paperUri);

      expect(mockConnection.executeQuery).toHaveBeenCalledTimes(1);
      const callArgs = mockConnection.executeQuery.mock.calls[0] as [string, { paperUri: AtUri }];
      expect(callArgs[0]).toContain('DELETE r');
      expect(callArgs[1].paperUri).toBe(paperUri);
    });

    it('should throw DatabaseError on delete failure', async () => {
      mockConnection.executeQuery.mockRejectedValue(new Error('Delete failed'));

      const paperUri = 'at://did:plc:abc/pub.chive.eprint.submission/1' as AtUri;

      await expect(citationGraph.deleteCitationsForPaper(paperUri)).rejects.toThrow(
        'Failed to delete citations for paper'
      );
    });
  });

  describe('record mapping', () => {
    it('should correctly map citation record with all fields', async () => {
      const paperUri = 'at://did:plc:abc/pub.chive.eprint.submission/1' as AtUri;

      const fullRecord: MockQueryResult = {
        records: [
          createMockRecord({
            citingUri: 'at://did:plc:xyz/pub.chive.eprint.submission/2',
            citedUri: paperUri,
            isInfluential: true,
            source: 'semantic-scholar',
            discoveredAt: '2024-01-15T10:00:00.000Z',
          }),
        ],
        summary: {},
      };

      mockConnection.executeQuery
        .mockResolvedValueOnce(fullRecord)
        .mockResolvedValueOnce({ records: [createMockRecord({ total: 1 })], summary: {} });

      const result = await citationGraph.getCitingPapers(paperUri);

      expect(result.citations).toHaveLength(1);
      const citation = result.citations[0];
      expect(citation).toBeDefined();
      expect(citation?.source).toBe('semantic-scholar');
      expect(citation?.isInfluential).toBe(true);
      expect(citation?.discoveredAt).toEqual(new Date('2024-01-15T10:00:00.000Z'));
    });

    it('should handle null isInfluential as undefined', async () => {
      const paperUri = 'at://did:plc:abc/pub.chive.eprint.submission/1' as AtUri;

      const nullFieldsRecord: MockQueryResult = {
        records: [
          createMockRecord({
            citingUri: 'at://did:plc:xyz/pub.chive.eprint.submission/2',
            citedUri: paperUri,
            isInfluential: null,
            source: 'user-provided',
            discoveredAt: null,
          }),
        ],
        summary: {},
      };

      mockConnection.executeQuery
        .mockResolvedValueOnce(nullFieldsRecord)
        .mockResolvedValueOnce({ records: [createMockRecord({ total: 1 })], summary: {} });

      const result = await citationGraph.getCitingPapers(paperUri);

      expect(result.citations).toHaveLength(1);
      const citation = result.citations[0];
      expect(citation).toBeDefined();
      expect(citation?.isInfluential).toBeUndefined();
      expect(citation?.discoveredAt).toBeUndefined();
    });
  });
});

describe('CitationGraph.getCitationNetwork', () => {
  let citationGraph: CitationGraph;
  let mockConnection: ReturnType<typeof createMockConnection>;

  const FOCUS = 'at://did:plc:a/pub.chive.eprint.submission/focus' as AtUri;

  /** One row as the driver would hand it back. */
  function edgeRecord(citingUri: string, citedUri: string, isInfluential = false): MockRecord {
    return createMockRecord({
      citingUri,
      citedUri,
      isInfluential,
      source: 'semantic-scholar',
      discoveredAt: '2026-01-01T00:00:00Z',
    });
  }

  function result(records: MockRecord[]): MockQueryResult {
    return { records, summary: {} };
  }

  beforeEach(() => {
    mockConnection = createMockConnection();
    citationGraph = new CitationGraph(mockConnection);
  });

  it('reads the whole network when no paper is focused', async () => {
    mockConnection.executeQuery
      .mockResolvedValueOnce(result([createMockRecord({ total: 2 })]))
      .mockResolvedValueOnce(result([edgeRecord('a', 'b'), edgeRecord('b', 'c')]));

    const network = await citationGraph.getCitationNetwork({ limit: 100 });

    expect(network.citations).toHaveLength(2);
    expect(network.total).toBe(2);
    expect(network.truncated).toBe(false);
    // Two queries: the count, then the edges. No focus query.
    expect(mockConnection.executeQuery).toHaveBeenCalledTimes(2);
  });

  it("reads the focused paper's own edges before anyone else's", async () => {
    // The guarantee the caller cannot recover for itself: a truncated network
    // still contains the paper the reader asked about.
    mockConnection.executeQuery
      .mockResolvedValueOnce(result([createMockRecord({ total: 50 })]))
      .mockResolvedValueOnce(result([edgeRecord(FOCUS, 'b'), edgeRecord('c', FOCUS)]))
      .mockResolvedValueOnce(result([edgeRecord('d', 'e')]));

    const network = await citationGraph.getCitationNetwork({ focusUri: FOCUS, limit: 3 });

    expect(network.citations.map((c) => `${c.citingUri}->${c.citedUri}`)).toEqual([
      `${FOCUS}->b`,
      `c->${FOCUS}`,
      'd->e',
    ]);
    expect(network.truncated).toBe(true);

    const [, focusCall, restCall] = mockConnection.executeQuery.mock.calls as [
      unknown,
      [string, Record<string, unknown>],
      [string, Record<string, unknown>],
    ];
    expect(focusCall[0]).toContain('citing.uri = $focusUri OR cited.uri = $focusUri');
    expect(restCall[0]).toContain('NOT (citing.uri = $focusUri OR cited.uri = $focusUri)');
    // The rest of the network only gets the budget the focus did not use.
    expect(toNumber(restCall[1].limit)).toBe(1);
  });

  it('does not ask for the rest of the network when the focus filled the budget', async () => {
    mockConnection.executeQuery
      .mockResolvedValueOnce(result([createMockRecord({ total: 9 })]))
      .mockResolvedValueOnce(result([edgeRecord(FOCUS, 'b'), edgeRecord('c', FOCUS)]));

    const network = await citationGraph.getCitationNetwork({ focusUri: FOCUS, limit: 2 });

    expect(network.citations).toHaveLength(2);
    expect(mockConnection.executeQuery).toHaveBeenCalledTimes(2);
  });

  it('constrains both ends of every edge to eprints', async () => {
    // The graph holds other node kinds. A CITES edge reaching one would put a
    // non-paper into a paper network.
    mockConnection.executeQuery
      .mockResolvedValueOnce(result([createMockRecord({ total: 0 })]))
      .mockResolvedValueOnce(result([]));

    await citationGraph.getCitationNetwork({});

    for (const call of mockConnection.executeQuery.mock.calls as [string, unknown][]) {
      expect(call[0]).toContain("citing.subkind = 'eprint'");
      expect(call[0]).toContain("cited.subkind = 'eprint'");
    }
  });

  it('restricts to influential citations when asked', async () => {
    mockConnection.executeQuery
      .mockResolvedValueOnce(result([createMockRecord({ total: 1 })]))
      .mockResolvedValueOnce(result([edgeRecord('a', 'b', true)]));

    await citationGraph.getCitationNetwork({ onlyInfluential: true });

    for (const call of mockConnection.executeQuery.mock.calls as [string, unknown][]) {
      expect(call[0]).toContain('r.isInfluential = true');
    }
  });

  it('reports an empty network rather than failing', async () => {
    mockConnection.executeQuery
      .mockResolvedValueOnce(result([createMockRecord({ total: 0 })]))
      .mockResolvedValueOnce(result([]));

    const network = await citationGraph.getCitationNetwork({});

    expect(network).toEqual({ citations: [], total: 0, truncated: false });
  });

  it('surfaces a query failure as a database error', async () => {
    mockConnection.executeQuery.mockRejectedValueOnce(new Error('neo4j is down'));

    await expect(citationGraph.getCitationNetwork({})).rejects.toThrow(/citation network/i);
  });
});
