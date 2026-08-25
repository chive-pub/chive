/**
 * Unit tests for governance record timestamp provenance.
 *
 * @remarks
 * Proposals and votes were indexed with the AppView's ingest time rather than
 * the `createdAt` the record carries. Both values are sort keys — proposals
 * list `ORDER BY p.createdAt DESC`, ballots `ORDER BY v.createdAt` — so a
 * rebuild of the index from the firehose reordered governance history, which
 * the rebuildability rule forbids. Ingest time survives only as the fallback
 * for a record carrying no usable timestamp of its own.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { RecordMetadata } from '@/services/eprint/eprint-service.js';
import { KnowledgeGraphService } from '@/services/knowledge-graph/graph-service.js';
import type { AtUri, CID } from '@/types/atproto.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

const DID = 'did:plc:izttpdp3l6vss5crelt5kcux';
const RECORD_CREATED_AT = '2026-05-07T14:48:40.171Z';
const INDEXED_AT = new Date('2026-08-24T09:00:00.000Z');

const metadataFor = (collection: string): RecordMetadata => ({
  uri: `at://${DID}/${collection}/3mlbhk6h2ne2k` as AtUri,
  cid: 'bafyreiabc123' as CID,
  pdsUrl: 'https://pds.example.com',
  indexedAt: INDEXED_AT,
});

const createLogger = (): ILogger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
});

describe('KnowledgeGraphService governance record timestamps', () => {
  let graph: { createProposal: ReturnType<typeof vi.fn>; createVote: ReturnType<typeof vi.fn> };
  let service: KnowledgeGraphService;

  beforeEach(() => {
    vi.clearAllMocks();
    graph = {
      createProposal: vi.fn().mockResolvedValue(undefined),
      createVote: vi.fn().mockResolvedValue(undefined),
    };
    service = new KnowledgeGraphService({
      graph: graph as never,
      storage: {} as never,
      logger: createLogger(),
    });
  });

  describe('indexNodeProposal', () => {
    const nodeProposal = (createdAt?: string): Record<string, unknown> => ({
      proposalType: 'create',
      kind: 'type',
      subkind: 'field',
      proposedNode: { label: 'Semantics' },
      rationale: 'because',
      ...(createdAt === undefined ? {} : { createdAt }),
    });

    it("should store the record's own createdAt rather than ingest time", async () => {
      const result = await service.indexNodeProposal(
        nodeProposal(RECORD_CREATED_AT),
        metadataFor('pub.chive.graph.nodeProposal')
      );

      expect(result.ok).toBe(true);
      expect(graph.createProposal).toHaveBeenCalledWith(
        expect.objectContaining({ createdAt: new Date(RECORD_CREATED_AT) })
      );
    });

    it('should fall back to ingest time when the record carries no timestamp', async () => {
      await service.indexNodeProposal(nodeProposal(), metadataFor('pub.chive.graph.nodeProposal'));

      expect(graph.createProposal).toHaveBeenCalledWith(
        expect.objectContaining({ createdAt: INDEXED_AT })
      );
    });

    it('should fall back to ingest time when the timestamp does not parse', async () => {
      await service.indexNodeProposal(
        nodeProposal('not-a-timestamp'),
        metadataFor('pub.chive.graph.nodeProposal')
      );

      expect(graph.createProposal).toHaveBeenCalledWith(
        expect.objectContaining({ createdAt: INDEXED_AT })
      );
    });
  });

  describe('indexEdgeProposal', () => {
    const edgeProposal = (createdAt?: string): Record<string, unknown> => ({
      proposalType: 'create',
      proposedEdge: { sourceUri: `at://${DID}/pub.chive.graph.node/a`, relationSlug: 'broader' },
      rationale: 'because',
      ...(createdAt === undefined ? {} : { createdAt }),
    });

    it("should store the record's own createdAt rather than ingest time", async () => {
      const result = await service.indexEdgeProposal(
        edgeProposal(RECORD_CREATED_AT),
        metadataFor('pub.chive.graph.edgeProposal')
      );

      expect(result.ok).toBe(true);
      expect(graph.createProposal).toHaveBeenCalledWith(
        expect.objectContaining({ createdAt: new Date(RECORD_CREATED_AT) })
      );
    });

    it('should fall back to ingest time when the record carries no timestamp', async () => {
      await service.indexEdgeProposal(edgeProposal(), metadataFor('pub.chive.graph.edgeProposal'));

      expect(graph.createProposal).toHaveBeenCalledWith(
        expect.objectContaining({ createdAt: INDEXED_AT })
      );
    });
  });

  describe('indexVote', () => {
    const vote = (createdAt?: string): Record<string, unknown> => ({
      proposalUri: `at://${DID}/pub.chive.graph.nodeProposal/3mlbhk6h2ne2k`,
      vote: 'approve',
      ...(createdAt === undefined ? {} : { createdAt }),
    });

    it("should store the ballot's own createdAt rather than ingest time", async () => {
      const result = await service.indexVote(
        vote(RECORD_CREATED_AT),
        metadataFor('pub.chive.graph.vote')
      );

      expect(result.ok).toBe(true);
      expect(graph.createVote).toHaveBeenCalledWith(
        expect.objectContaining({ createdAt: new Date(RECORD_CREATED_AT) })
      );
    });

    it('should fall back to ingest time when the ballot carries no timestamp', async () => {
      await service.indexVote(vote(), metadataFor('pub.chive.graph.vote'));

      expect(graph.createVote).toHaveBeenCalledWith(
        expect.objectContaining({ createdAt: INDEXED_AT })
      );
    });
  });
});
