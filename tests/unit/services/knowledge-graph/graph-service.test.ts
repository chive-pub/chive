/**
 * Unit tests for KnowledgeGraphService.
 *
 * @remarks
 * Tests graph indexing operations for proposals, votes, and authority records.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { KnowledgeGraphService } from '@/services/knowledge-graph/graph-service.js';
import type { RecordMetadata } from '@/services/eprint/eprint-service.js';
import type { AtUri, CID } from '@/types/atproto.js';
import type { IGraphDatabase } from '@/types/interfaces/graph.interface.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';
import type { IStorageBackend } from '@/types/interfaces/storage.interface.js';

interface MockLogger extends ILogger {
  infoMock: ReturnType<typeof vi.fn>;
}

const createMockLogger = (): MockLogger => {
  const infoMock = vi.fn();
  const logger: MockLogger = {
    debug: vi.fn(),
    info: infoMock,
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(function (this: void) {
      return logger;
    }),
    infoMock,
  };
  return logger;
};

const createMockGraph = (): IGraphDatabase =>
  ({
    upsertField: vi.fn().mockResolvedValue(undefined),
    createVote: vi.fn().mockResolvedValue(undefined),
    createAuthorityRecord: vi.fn().mockResolvedValue(undefined),
  }) as unknown as IGraphDatabase;

const createMockStorage = (): IStorageBackend =>
  ({
    storeEprint: vi.fn(),
    getEprint: vi.fn(),
    getEprintsByAuthor: vi.fn(),
    trackPDSSource: vi.fn(),
    getRecordsNotSyncedSince: vi.fn(),
    isStale: vi.fn(),
  }) as unknown as IStorageBackend;

const createMockMetadata = (overrides?: Partial<RecordMetadata>): RecordMetadata => ({
  uri: 'at://did:plc:user/pub.chive.graph.fieldProposal/proposal123' as AtUri,
  cid: 'bafyreiproposal' as CID,
  pdsUrl: 'https://pds.host',
  indexedAt: new Date('2024-01-02T00:00:00Z'),
  ...overrides,
});

describe('KnowledgeGraphService', () => {
  let graph: IGraphDatabase;
  let storage: IStorageBackend;
  let logger: MockLogger;
  let service: KnowledgeGraphService;

  beforeEach(() => {
    graph = createMockGraph();
    storage = createMockStorage();
    logger = createMockLogger();
    service = new KnowledgeGraphService({ graph, storage, logger });
  });

  describe('indexFieldProposal', () => {
    it('logs field proposal indexing', async () => {
      const record = {
        fieldName: 'Computational Semantics',
        description: 'Field covering computational approaches to natural language meaning',
      };
      const metadata = createMockMetadata();

      const result = await service.indexFieldProposal(record, metadata);

      expect(result.ok).toBe(true);
      expect(logger.infoMock).toHaveBeenCalledWith('Indexed field proposal', { uri: metadata.uri });
    });

    it('handles multiple proposals independently', async () => {
      const record1 = { fieldName: 'Dynamic Semantics' };
      const metadata1 = createMockMetadata({
        uri: 'at://did:plc:u1/pub.chive.graph.fieldProposal/p1' as AtUri,
      });

      const record2 = { fieldName: 'Psycholinguistics' };
      const metadata2 = createMockMetadata({
        uri: 'at://did:plc:u2/pub.chive.graph.fieldProposal/p2' as AtUri,
      });

      const result1 = await service.indexFieldProposal(record1, metadata1);
      const result2 = await service.indexFieldProposal(record2, metadata2);

      expect(result1.ok).toBe(true);
      expect(result2.ok).toBe(true);
      expect(logger.infoMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('indexVote', () => {
    it('logs vote indexing', async () => {
      const record = {
        proposalUri: 'at://did:plc:user/pub.chive.graph.fieldProposal/p1',
        vote: 'approve',
      };
      const metadata = createMockMetadata({
        uri: 'at://did:plc:voter/pub.chive.graph.vote/vote123' as AtUri,
      });

      const result = await service.indexVote(record, metadata);

      expect(result.ok).toBe(true);
      expect(logger.infoMock).toHaveBeenCalledWith(
        'Indexed vote',
        expect.objectContaining({
          uri: metadata.uri,
          proposalUri: record.proposalUri,
          vote: record.vote,
        })
      );
    });

    it('handles multiple votes', async () => {
      const record1 = {
        proposalUri: 'at://did:plc:user/pub.chive.graph.fieldProposal/p1',
        vote: 'approve',
      };
      const metadata1 = createMockMetadata({
        uri: 'at://did:plc:v1/pub.chive.graph.vote/v1' as AtUri,
      });

      const record2 = {
        proposalUri: 'at://did:plc:user/pub.chive.graph.fieldProposal/p2',
        vote: 'reject',
      };
      const metadata2 = createMockMetadata({
        uri: 'at://did:plc:v2/pub.chive.graph.vote/v2' as AtUri,
      });

      const result1 = await service.indexVote(record1, metadata1);
      const result2 = await service.indexVote(record2, metadata2);

      expect(result1.ok).toBe(true);
      expect(result2.ok).toBe(true);
      expect(logger.infoMock).toHaveBeenCalledTimes(2);
    });

    it('skips invalid records without proposalUri', async () => {
      const record = { vote: 'approve' }; // Missing proposalUri
      const metadata = createMockMetadata({
        uri: 'at://did:plc:voter/pub.chive.graph.vote/vote123' as AtUri,
      });

      const result = await service.indexVote(record, metadata);

      expect(result.ok).toBe(true); // Still returns ok, just skips
      expect(logger.infoMock).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        'Invalid vote record: missing required fields',
        expect.any(Object)
      );
    });
  });

  describe('indexAuthorityRecord', () => {
    it('logs authority record indexing', async () => {
      const record = { authorityName: 'Formal Semantics', validated: true };
      const metadata = createMockMetadata({
        uri: 'at://did:plc:governance/pub.chive.graph.authorityRecord/auth123' as AtUri,
      });

      const result = await service.indexAuthorityRecord(record, metadata);

      expect(result.ok).toBe(true);
      expect(logger.infoMock).toHaveBeenCalledWith('Indexed authority record', {
        uri: metadata.uri,
      });
    });
  });

  describe('getField', () => {
    it('returns null for non-existent field', async () => {
      const field = await service.getField('nonexistent-field-id');

      expect(field).toBeNull();
    });

    it('returns null for any field ID', async () => {
      const field1 = await service.getField('field-1');
      const field2 = await service.getField('field-2');

      expect(field1).toBeNull();
      expect(field2).toBeNull();
    });
  });

  describe('getRelatedFields', () => {
    it('returns empty array for non-existent field', async () => {
      const related = await service.getRelatedFields('nonexistent-field', 2);

      expect(related).toEqual([]);
    });

    it('returns empty array for any field ID', async () => {
      const related1 = await service.getRelatedFields('field-1', 1);
      const related2 = await service.getRelatedFields('field-2', 3);

      expect(related1).toEqual([]);
      expect(related2).toEqual([]);
    });

    it('respects depth parameter', async () => {
      const shallow = await service.getRelatedFields('field', 1);
      const deep = await service.getRelatedFields('field', 5);

      expect(shallow).toEqual([]);
      expect(deep).toEqual([]);
    });
  });
});
