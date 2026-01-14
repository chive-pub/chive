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
