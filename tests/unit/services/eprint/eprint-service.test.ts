/**
 * Unit tests for EprintService.
 *
 * @remarks
 * Tests eprint indexing, retrieval, deletion, and rollback functionality.
 * Covers the saga pattern for multi-store transactions with compensation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { EprintService, type RecordMetadata } from '@/services/eprint/eprint-service.js';
import type { TagManager } from '@/storage/neo4j/tag-manager.js';
import type { AtUri, CID, DID, Timestamp } from '@/types/atproto.js';
import { DatabaseError } from '@/types/errors.js';
import type { IGraphDatabase, GraphNode } from '@/types/interfaces/graph.interface.js';
import type { IIdentityResolver } from '@/types/interfaces/identity.interface.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';
import type { IRepository } from '@/types/interfaces/repository.interface.js';
import type { ISearchEngine } from '@/types/interfaces/search.interface.js';
import type { IStorageBackend } from '@/types/interfaces/storage.interface.js';
import type { Eprint } from '@/types/models/eprint.js';

const createMockLogger = (): ILogger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
});

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const createMockStorage = () => ({
  storeEprint: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
  getEprint: vi.fn(),
  getEprintsByAuthor: vi.fn(),
  countEprintsByAuthor: vi.fn(),
  trackPDSSource: vi.fn().mockResolvedValue(undefined),
  getRecordsNotSyncedSince: vi.fn(),
  isStale: vi.fn(),
  listEprintUris: vi.fn(),
  findByExternalIds: vi.fn(),
  deleteEprint: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
});

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const createMockSearch = () => ({
  indexEprint: vi.fn().mockResolvedValue(undefined),
  deleteDocument: vi.fn().mockResolvedValue(undefined),
  search: vi.fn(),
  facetedSearch: vi.fn(),
  autocomplete: vi.fn(),
});

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const createMockRepository = () => ({
  getRecord: vi.fn(),
  listRecords: vi.fn(),
  getBlob: vi.fn(),
});

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const createMockIdentity = () => ({
  resolveDID: vi.fn().mockResolvedValue(undefined),
  resolveHandle: vi.fn(),
  getPDSEndpoint: vi.fn(),
});

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const createMockGraph = () => ({
  getNodesByIds: vi.fn(),
  getNodeByUri: vi.fn(),
  getNode: vi.fn(),
  upsertNode: vi.fn(),
  listNodes: vi.fn(),
  searchNodes: vi.fn(),
  createEdge: vi.fn(),
  getEdges: vi.fn(),
  findRelatedNodes: vi.fn(),
  getHierarchy: vi.fn(),
  queryByFacets: vi.fn(),
  aggregateFacets: vi.fn(),
  getProposalsForNode: vi.fn(),
  listProposals: vi.fn(),
  getProposal: vi.fn(),
  createVote: vi.fn(),
  getVotesForProposal: vi.fn(),
  calculateConsensus: vi.fn(),
  createProposal: vi.fn(),
  deleteNode: vi.fn(),
});

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const createMockTagManager = () => ({
  addTag: vi.fn().mockResolvedValue({ rawForm: 'test', normalizedForm: 'test', existed: false }),
  removeAllTagsForRecord: vi.fn().mockResolvedValue(0),
  removeTag: vi.fn(),
  getTag: vi.fn(),
  searchTags: vi.fn(),
  getTagsForRecord: vi.fn(),
  getRecordsWithTag: vi.fn(),
  getTrendingTags: vi.fn(),
  findFieldCandidates: vi.fn(),
  markAsSpam: vi.fn(),
  mergeTagVariants: vi.fn(),
  getTagSuggestions: vi.fn(),
  normalizeTag: vi.fn((tag: string) => tag.toLowerCase()),
  suggestFacetMapping: vi.fn(),
  setFacetHistoryRepository: vi.fn(),
});

const createMockEprint = (overrides?: Partial<Eprint>): Eprint => ({
  uri: 'at://did:plc:author123/pub.chive.eprint.submission/abc123' as AtUri,
  cid: 'bafyreigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi' as CID,
  title: 'Test Eprint Title',
  abstract: {
    type: 'RichText',
    items: [{ type: 'text', content: 'This is the abstract.' }],
    format: 'application/x-chive-gloss+json',
  },
  abstractPlainText: 'This is the abstract.',
  documentBlobRef: {
    $type: 'blob',
    ref: 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku' as CID,
    mimeType: 'application/pdf',
    size: 1024000,
  },
  documentFormat: 'pdf',
  authors: [
    {
      did: 'did:plc:author123' as DID,
      name: 'Test Author',
      order: 1,
      affiliations: [],
      contributions: [],
      isCorrespondingAuthor: true,
      isHighlighted: false,
    },
  ],
  submittedBy: 'did:plc:author123' as DID,
  createdAt: Date.now() as Timestamp,
  license: 'CC-BY-4.0',
  keywords: ['test', 'eprint'],
  facets: [],
  fields: undefined,
  version: 1,
  publicationStatus: 'eprint',
  ...overrides,
});

const createMockMetadata = (overrides?: Partial<RecordMetadata>): RecordMetadata => ({
  uri: 'at://did:plc:author123/pub.chive.eprint.submission/abc123' as AtUri,
  cid: 'bafyreigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi' as CID,
  pdsUrl: 'https://pds.example.com',
  indexedAt: new Date('2024-01-15T10:00:00Z'),
  ...overrides,
});

describe('EprintService', () => {
  let storage: ReturnType<typeof createMockStorage>;
  let search: ReturnType<typeof createMockSearch>;
  let repository: ReturnType<typeof createMockRepository>;
  let identity: ReturnType<typeof createMockIdentity>;
  let graph: ReturnType<typeof createMockGraph>;
  let tagManager: ReturnType<typeof createMockTagManager>;
  let logger: ILogger;
  let service: EprintService;

  beforeEach(() => {
    storage = createMockStorage();
    search = createMockSearch();
    repository = createMockRepository();
    identity = createMockIdentity();
    graph = createMockGraph();
    tagManager = createMockTagManager();
    logger = createMockLogger();

    service = new EprintService({
      storage: storage as unknown as IStorageBackend,
      search: search as unknown as ISearchEngine,
      repository: repository as unknown as IRepository,
      identity: identity as unknown as IIdentityResolver,
      logger,
      graph: graph as unknown as IGraphDatabase,
      tagManager: tagManager as unknown as TagManager,
    });
  });

  describe('indexEprint', () => {
    describe('success cases', () => {
      it('indexes an eprint without fields', async () => {
        const eprint = createMockEprint();
        const metadata = createMockMetadata();

        const result = await service.indexEprint(eprint, metadata);

        expect(result.ok).toBe(true);
        expect(storage.storeEprint).toHaveBeenCalledTimes(1);
        expect(search.indexEprint).toHaveBeenCalledTimes(1);
        expect(graph.getNodesByIds).not.toHaveBeenCalled();
      });

      it('resolves field labels from knowledge graph when fields are present', async () => {
        const fields = [
          {
            uri: 'e7f8a9b0-c1d2-3456-7890-abcdef123456',
            label: 'e7f8a9b0-c1d2-3456-7890-abcdef123456',
            id: 'e7f8a9b0-c1d2-3456-7890-abcdef123456',
          },
          {
            uri: 'f8a9b0c1-d2e3-4567-8901-bcdef1234567',
            label: 'f8a9b0c1-d2e3-4567-8901-bcdef1234567',
            id: 'f8a9b0c1-d2e3-4567-8901-bcdef1234567',
          },
        ];
        const eprint = createMockEprint({ fields });
        const metadata = createMockMetadata();

        // Mock graph to return resolved labels
        const nodeMap = new Map<string, GraphNode>();
        nodeMap.set('e7f8a9b0-c1d2-3456-7890-abcdef123456', {
          id: 'e7f8a9b0-c1d2-3456-7890-abcdef123456',
          uri: 'at://graph/field/1' as AtUri,
          kind: 'type',
          subkind: 'field',
          label: 'Computational Linguistics',
          status: 'established',
          createdAt: new Date(),
        });
        nodeMap.set('f8a9b0c1-d2e3-4567-8901-bcdef1234567', {
          id: 'f8a9b0c1-d2e3-4567-8901-bcdef1234567',
          uri: 'at://graph/field/2' as AtUri,
          kind: 'type',
          subkind: 'field',
          label: 'Natural Language Processing',
          status: 'established',
          createdAt: new Date(),
        });
        graph.getNodesByIds.mockResolvedValue(nodeMap);

        const result = await service.indexEprint(eprint, metadata);

        expect(result.ok).toBe(true);
        expect(graph.getNodesByIds).toHaveBeenCalledWith(
          ['e7f8a9b0-c1d2-3456-7890-abcdef123456', 'f8a9b0c1-d2e3-4567-8901-bcdef1234567'],
          'field'
        );

        // Verify storeEprint was called with resolved labels (URIs normalized)
        expect(storage.storeEprint).toHaveBeenCalledTimes(1);
        const storeCall = storage.storeEprint.mock.calls[0]?.[0] as { fields: unknown };
        expect(storeCall.fields).toEqual([
          {
            uri: 'at://did:plc:5wzpn4a4nbqtz3q45hyud6hd/pub.chive.graph.node/e7f8a9b0-c1d2-3456-7890-abcdef123456',
            label: 'Computational Linguistics',
            id: 'e7f8a9b0-c1d2-3456-7890-abcdef123456',
          },
          {
            uri: 'at://did:plc:5wzpn4a4nbqtz3q45hyud6hd/pub.chive.graph.node/f8a9b0c1-d2e3-4567-8901-bcdef1234567',
            label: 'Natural Language Processing',
            id: 'f8a9b0c1-d2e3-4567-8901-bcdef1234567',
          },
        ]);
      });

      it('falls back to URI as label when field not found in graph', async () => {
        const fields = [
          {
            uri: 'e7f8a9b0-c1d2-3456-7890-abcdef123456',
            label: 'e7f8a9b0-c1d2-3456-7890-abcdef123456',
            id: 'e7f8a9b0-c1d2-3456-7890-abcdef123456',
          },
          {
            uri: 'a9b0c1d2-e3f4-5678-9012-cdef12345678',
            label: 'a9b0c1d2-e3f4-5678-9012-cdef12345678',
            id: 'a9b0c1d2-e3f4-5678-9012-cdef12345678',
          },
        ];
        const eprint = createMockEprint({ fields });
        const metadata = createMockMetadata();

        // Mock graph to return only one field
        const nodeMap = new Map<string, GraphNode>();
        nodeMap.set('e7f8a9b0-c1d2-3456-7890-abcdef123456', {
          id: 'e7f8a9b0-c1d2-3456-7890-abcdef123456',
          uri: 'at://graph/field/1' as AtUri,
          kind: 'type',
          subkind: 'field',
          label: 'Computational Linguistics',
          status: 'established',
          createdAt: new Date(),
        });
        // a9b0c1d2-e3f4-5678-9012-cdef12345678 is NOT in the map
        graph.getNodesByIds.mockResolvedValue(nodeMap);

        const result = await service.indexEprint(eprint, metadata);

        expect(result.ok).toBe(true);

        // Verify storeEprint was called (found field gets resolved, unknown keeps normalized URI)
        expect(storage.storeEprint).toHaveBeenCalledTimes(1);
        const storeCall = storage.storeEprint.mock.calls[0]?.[0] as { fields: unknown };
        expect(storeCall.fields).toEqual([
          {
            uri: 'at://did:plc:5wzpn4a4nbqtz3q45hyud6hd/pub.chive.graph.node/e7f8a9b0-c1d2-3456-7890-abcdef123456',
            label: 'Computational Linguistics',
            id: 'e7f8a9b0-c1d2-3456-7890-abcdef123456',
          },
          {
            uri: 'at://did:plc:5wzpn4a4nbqtz3q45hyud6hd/pub.chive.graph.node/a9b0c1d2-e3f4-5678-9012-cdef12345678',
            label: 'a9b0c1d2-e3f4-5678-9012-cdef12345678',
            id: 'a9b0c1d2-e3f4-5678-9012-cdef12345678',
          },
        ]);
      });

      it('handles graph errors gracefully and falls back to URIs', async () => {
        const fields = [
          {
            uri: 'e7f8a9b0-c1d2-3456-7890-abcdef123456',
            label: 'e7f8a9b0-c1d2-3456-7890-abcdef123456',
            id: 'e7f8a9b0-c1d2-3456-7890-abcdef123456',
          },
        ];
        const eprint = createMockEprint({ fields });
        const metadata = createMockMetadata();

        // Mock graph to throw error
        graph.getNodesByIds.mockRejectedValue(new Error('Graph connection failed'));

        const result = await service.indexEprint(eprint, metadata);

        expect(result.ok).toBe(true);
        expect(logger.warn).toHaveBeenCalledWith(
          'Failed to resolve field labels, using URIs as fallback',
          expect.objectContaining({ fieldCount: 1 })
        );

        // Verify storeEprint was still called with normalized fields (URIs normalized even on error)
        expect(storage.storeEprint).toHaveBeenCalledTimes(1);
        const storeCall = storage.storeEprint.mock.calls[0]?.[0] as { fields: unknown };
        expect(storeCall.fields).toEqual([
          {
            uri: 'at://did:plc:5wzpn4a4nbqtz3q45hyud6hd/pub.chive.graph.node/e7f8a9b0-c1d2-3456-7890-abcdef123456',
            label: 'e7f8a9b0-c1d2-3456-7890-abcdef123456',
            id: 'e7f8a9b0-c1d2-3456-7890-abcdef123456',
          },
        ]);
      });

      it('works without graph service configured', async () => {
        // Create service without graph
        const serviceWithoutGraph = new EprintService({
          storage: storage as unknown as IStorageBackend,
          search: search as unknown as ISearchEngine,
          repository: repository as unknown as IRepository,
          identity: identity as unknown as IIdentityResolver,
          logger,
          tagManager: tagManager as unknown as TagManager,
          // no graph
        });

        const fields = [
          {
            uri: 'e7f8a9b0-c1d2-3456-7890-abcdef123456',
            label: 'e7f8a9b0-c1d2-3456-7890-abcdef123456',
            id: 'e7f8a9b0-c1d2-3456-7890-abcdef123456',
          },
        ];
        const eprint = createMockEprint({ fields });
        const metadata = createMockMetadata();

        const result = await serviceWithoutGraph.indexEprint(eprint, metadata);

        expect(result.ok).toBe(true);
        expect(graph.getNodesByIds).not.toHaveBeenCalled();

        // Fields should be stored as-is (no label resolution)
        expect(storage.storeEprint).toHaveBeenCalledTimes(1);
        const storeCall = storage.storeEprint.mock.calls[0]?.[0] as { fields: unknown };
        expect(storeCall.fields).toEqual(fields);
      });

      it('indexes tags from keywords when tagManager is provided', async () => {
        const eprint = createMockEprint({ keywords: ['machine learning', 'neural networks'] });
        const metadata = createMockMetadata();

        const result = await service.indexEprint(eprint, metadata);

        expect(result.ok).toBe(true);
        expect(tagManager.addTag).toHaveBeenCalledTimes(2);
        expect(tagManager.addTag).toHaveBeenCalledWith(
          metadata.uri,
          'machine learning',
          eprint.submittedBy
        );
        expect(tagManager.addTag).toHaveBeenCalledWith(
          metadata.uri,
          'neural networks',
          eprint.submittedBy
        );
      });

      it('skips empty or whitespace-only keywords', async () => {
        const eprint = createMockEprint({ keywords: ['valid', '', '   ', 'another'] });
        const metadata = createMockMetadata();

        const result = await service.indexEprint(eprint, metadata);

        expect(result.ok).toBe(true);
        expect(tagManager.addTag).toHaveBeenCalledTimes(2);
        expect(logger.warn).toHaveBeenCalledWith(
          'Skipped invalid keywords during tag indexing',
          expect.objectContaining({ skippedCount: 2 })
        );
      });

      it('logs success when all stages complete', async () => {
        const eprint = createMockEprint();
        const metadata = createMockMetadata();

        const result = await service.indexEprint(eprint, metadata);

        expect(result.ok).toBe(true);
        expect(logger.info).toHaveBeenCalledWith('Indexed eprint', { uri: metadata.uri });
      });
    });

    describe('saga pattern rollback', () => {
      it('returns error when PostgreSQL fails (no rollback needed)', async () => {
        const eprint = createMockEprint();
        const metadata = createMockMetadata();

        storage.storeEprint.mockResolvedValue({
          ok: false,
          error: { message: 'Database connection failed' },
        });

        const result = await service.indexEprint(eprint, metadata);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error?.message).toContain('Database connection failed');
        }
        // No rollback should occur because nothing was committed
        expect(storage.deleteEprint).not.toHaveBeenCalled();
        expect(search.deleteDocument).not.toHaveBeenCalled();
      });

      it('rolls back PostgreSQL when Elasticsearch fails', async () => {
        const eprint = createMockEprint();
        const metadata = createMockMetadata();

        // PostgreSQL succeeds
        storage.storeEprint.mockResolvedValue({ ok: true, value: undefined });
        // Elasticsearch fails
        search.indexEprint.mockRejectedValue(new Error('Elasticsearch cluster unavailable'));

        const result = await service.indexEprint(eprint, metadata);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error).toBeInstanceOf(DatabaseError);
          expect(result.error?.message).toContain('Elasticsearch indexing failed');
        }

        // Verify rollback was called
        expect(logger.error).toHaveBeenCalledWith(
          'Elasticsearch indexing failed, rolling back',
          expect.any(Error),
          { uri: metadata.uri }
        );
        expect(logger.info).toHaveBeenCalledWith('Rolling back indexing', {
          uri: metadata.uri,
          stages: ['postgres'],
        });
        // PostgreSQL should be rolled back
        expect(storage.deleteEprint).toHaveBeenCalledWith(metadata.uri);
        // Elasticsearch delete should NOT be called (it never succeeded)
        // Check that deleteDocument was only called during rollback of postgres stage
        expect(search.deleteDocument).not.toHaveBeenCalled();
      });

      it('rolls back PostgreSQL, Elasticsearch, and Neo4j tags when Neo4j fails', async () => {
        const eprint = createMockEprint({ keywords: ['test-keyword'] });
        const metadata = createMockMetadata();

        // PostgreSQL succeeds
        storage.storeEprint.mockResolvedValue({ ok: true, value: undefined });
        // Elasticsearch succeeds
        search.indexEprint.mockResolvedValue(undefined);
        // Neo4j fails
        tagManager.addTag.mockRejectedValue(new Error('Neo4j connection lost'));
        // Rollback of partial Neo4j tags succeeds
        tagManager.removeAllTagsForRecord.mockResolvedValue({ deleted: 0 });

        const result = await service.indexEprint(eprint, metadata);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error).toBeInstanceOf(DatabaseError);
          expect(result.error?.message).toContain('Neo4j tag indexing failed');
        }

        // Verify rollback was logged
        expect(logger.error).toHaveBeenCalledWith(
          'Neo4j tag indexing failed, rolling back',
          expect.any(Error),
          { uri: metadata.uri }
        );

        // Verify rollback occurred in reverse order
        // Note: neo4j is now in stages because it's marked at the start of tag indexing
        // to ensure partial tags get rolled back on failure
        expect(logger.info).toHaveBeenCalledWith('Rolling back indexing', {
          uri: metadata.uri,
          stages: ['postgres', 'elasticsearch', 'neo4j'],
        });

        // Neo4j rolled back first (reverse order)
        expect(tagManager.removeAllTagsForRecord).toHaveBeenCalledWith(metadata.uri);
        // Then Elasticsearch
        expect(search.deleteDocument).toHaveBeenCalledWith(metadata.uri);
        // Then PostgreSQL
        expect(storage.deleteEprint).toHaveBeenCalledWith(metadata.uri);
      });

      it('rollback is best-effort and continues if PostgreSQL rollback fails', async () => {
        const eprint = createMockEprint({ keywords: ['test-keyword'] });
        const metadata = createMockMetadata();

        // PostgreSQL succeeds
        storage.storeEprint.mockResolvedValue({ ok: true, value: undefined });
        // Elasticsearch succeeds
        search.indexEprint.mockResolvedValue(undefined);
        // Neo4j fails
        tagManager.addTag.mockRejectedValue(new Error('Neo4j connection lost'));
        // Rollback of Neo4j succeeds
        tagManager.removeAllTagsForRecord.mockResolvedValue({ deleted: 0 });
        // Rollback of Elasticsearch succeeds
        search.deleteDocument.mockResolvedValue(undefined);
        // Rollback of PostgreSQL fails
        storage.deleteEprint.mockRejectedValue(new Error('Rollback failed'));

        const result = await service.indexEprint(eprint, metadata);

        expect(result.ok).toBe(false);

        // Verify all rollback attempts were made despite PostgreSQL failure
        expect(tagManager.removeAllTagsForRecord).toHaveBeenCalledWith(metadata.uri);
        expect(search.deleteDocument).toHaveBeenCalledWith(metadata.uri);
        expect(storage.deleteEprint).toHaveBeenCalledWith(metadata.uri);

        // Verify error was logged for failed rollback
        expect(logger.error).toHaveBeenCalledWith(
          'Failed to rollback postgres',
          expect.any(Error),
          { uri: metadata.uri, stage: 'postgres' }
        );

        // Verify rollback completed despite errors
        // Note: neo4j is now in stages because it's marked at the start of tag indexing
        // to ensure partial tags get rolled back on failure
        expect(logger.info).toHaveBeenCalledWith('Rollback complete', {
          uri: metadata.uri,
          stages: ['postgres', 'elasticsearch', 'neo4j'],
        });
      });

      it('rollback is best-effort and continues if Elasticsearch rollback fails', async () => {
        const eprint = createMockEprint({ keywords: ['test-keyword'] });
        const metadata = createMockMetadata();

        // PostgreSQL succeeds
        storage.storeEprint.mockResolvedValue({ ok: true, value: undefined });
        // Elasticsearch succeeds
        search.indexEprint.mockResolvedValue(undefined);
        // Neo4j fails
        tagManager.addTag.mockRejectedValue(new Error('Neo4j connection lost'));
        // Rollback of Neo4j succeeds
        tagManager.removeAllTagsForRecord.mockResolvedValue({ deleted: 0 });
        // Rollback of Elasticsearch fails
        search.deleteDocument.mockRejectedValue(new Error('ES delete failed'));
        // Rollback of PostgreSQL succeeds
        storage.deleteEprint.mockResolvedValue({ ok: true, value: undefined });

        const result = await service.indexEprint(eprint, metadata);

        expect(result.ok).toBe(false);

        // Verify all rollback attempts were made
        expect(tagManager.removeAllTagsForRecord).toHaveBeenCalledWith(metadata.uri);
        expect(search.deleteDocument).toHaveBeenCalledWith(metadata.uri);
        expect(storage.deleteEprint).toHaveBeenCalledWith(metadata.uri);

        // Verify error was logged for failed Elasticsearch rollback
        expect(logger.error).toHaveBeenCalledWith(
          'Failed to rollback elasticsearch',
          expect.any(Error),
          { uri: metadata.uri, stage: 'elasticsearch' }
        );
      });

      it('rolls back Neo4j tags when later stage fails (if tags were indexed)', async () => {
        // Create a service that will have Neo4j tags indexed before failure
        const eprint = createMockEprint({ keywords: ['keyword1', 'keyword2'] });
        const metadata = createMockMetadata();

        // Set up a scenario where Neo4j partially succeeds then fails
        let callCount = 0;
        tagManager.addTag.mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            // First keyword succeeds
            return Promise.resolve({
              rawForm: 'keyword1',
              normalizedForm: 'keyword1',
              existed: false,
            });
          }
          // Second keyword fails
          return Promise.reject(new Error('Neo4j timeout'));
        });

        const result = await service.indexEprint(eprint, metadata);

        expect(result.ok).toBe(false);

        // Verify that after the Neo4j failure during keyword 2,
        // we rollback postgres and elasticsearch (stages completed before neo4j failure)
        expect(storage.deleteEprint).toHaveBeenCalledWith(metadata.uri);
        expect(search.deleteDocument).toHaveBeenCalledWith(metadata.uri);
      });

      it('handles unexpected errors during indexing and rolls back completed stages', async () => {
        const eprint = createMockEprint();
        const metadata = createMockMetadata();

        // PostgreSQL succeeds
        storage.storeEprint.mockResolvedValue({ ok: true, value: undefined });
        // trackPDSSource throws unexpected error
        storage.trackPDSSource.mockRejectedValue(new Error('Unexpected database error'));

        const result = await service.indexEprint(eprint, metadata);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error).toBeInstanceOf(DatabaseError);
        }

        // PostgreSQL should be rolled back
        expect(storage.deleteEprint).toHaveBeenCalledWith(metadata.uri);
      });
    });

    describe('error handling', () => {
      it('handles storage errors', async () => {
        const eprint = createMockEprint();
        const metadata = createMockMetadata();

        storage.storeEprint.mockResolvedValue({
          ok: false,
          error: { message: 'Database connection failed' },
        });

        const result = await service.indexEprint(eprint, metadata);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error?.message).toContain('Database connection failed');
        }
      });
    });
  });

  describe('indexEprintDelete', () => {
    it('deletes from all stores on success', async () => {
      const uri = 'at://did:plc:author123/pub.chive.eprint.submission/abc123' as AtUri;

      const result = await service.indexEprintDelete(uri);

      expect(result.ok).toBe(true);
      expect(storage.deleteEprint).toHaveBeenCalledWith(uri);
      expect(search.deleteDocument).toHaveBeenCalledWith(uri);
      expect(tagManager.removeAllTagsForRecord).toHaveBeenCalledWith(uri);
      expect(logger.info).toHaveBeenCalledWith('Deleted eprint from indexes', { uri });
    });

    it('continues Elasticsearch deletion even if PostgreSQL fails', async () => {
      const uri = 'at://did:plc:author123/pub.chive.eprint.submission/abc123' as AtUri;

      storage.deleteEprint.mockResolvedValue({
        ok: false,
        error: { message: 'Record not found' },
      });

      const result = await service.indexEprintDelete(uri);

      // Should still succeed overall (best-effort deletion)
      expect(result.ok).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith('PostgreSQL deletion failed', {
        uri,
        error: 'Record not found',
      });
      // Elasticsearch deletion should still be attempted
      expect(search.deleteDocument).toHaveBeenCalledWith(uri);
      // Tag cleanup should still be attempted
      expect(tagManager.removeAllTagsForRecord).toHaveBeenCalledWith(uri);
    });

    it('continues if Elasticsearch deletion fails', async () => {
      const uri = 'at://did:plc:author123/pub.chive.eprint.submission/abc123' as AtUri;

      search.deleteDocument.mockRejectedValue(new Error('Document not found'));

      const result = await service.indexEprintDelete(uri);

      // Should still succeed overall (PostgreSQL is source of truth)
      expect(result.ok).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith(
        'Elasticsearch deletion failed, PostgreSQL may already be deleted',
        {
          uri,
          error: 'Document not found',
        }
      );
      // Tag cleanup should still be attempted
      expect(tagManager.removeAllTagsForRecord).toHaveBeenCalledWith(uri);
    });

    it('continues if Neo4j tag cleanup fails', async () => {
      const uri = 'at://did:plc:author123/pub.chive.eprint.submission/abc123' as AtUri;

      tagManager.removeAllTagsForRecord.mockRejectedValue(new Error('Neo4j unavailable'));

      const result = await service.indexEprintDelete(uri);

      // Should still succeed overall (PostgreSQL is source of truth)
      expect(result.ok).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith(
        'Neo4j tag cleanup failed, PostgreSQL is source of truth',
        {
          uri,
          error: 'Neo4j unavailable',
        }
      );
    });

    it('logs removed tag count when tags are cleaned up', async () => {
      const uri = 'at://did:plc:author123/pub.chive.eprint.submission/abc123' as AtUri;

      tagManager.removeAllTagsForRecord.mockResolvedValue(5);

      const result = await service.indexEprintDelete(uri);

      expect(result.ok).toBe(true);
      expect(logger.debug).toHaveBeenCalledWith('Removed tag relationships from Neo4j', {
        uri,
        removedCount: 5,
      });
    });

    it('does not log tag removal when no tags existed', async () => {
      const uri = 'at://did:plc:author123/pub.chive.eprint.submission/abc123' as AtUri;

      tagManager.removeAllTagsForRecord.mockResolvedValue(0);

      const result = await service.indexEprintDelete(uri);

      expect(result.ok).toBe(true);
      // debug log should not be called for 0 removed tags
      expect(logger.debug).not.toHaveBeenCalledWith(
        'Removed tag relationships from Neo4j',
        expect.any(Object)
      );
    });

    it('works without tagManager configured', async () => {
      const serviceWithoutTags = new EprintService({
        storage: storage as unknown as IStorageBackend,
        search: search as unknown as ISearchEngine,
        repository: repository as unknown as IRepository,
        identity: identity as unknown as IIdentityResolver,
        logger,
        // no tagManager
      });

      const uri = 'at://did:plc:author123/pub.chive.eprint.submission/abc123' as AtUri;

      const result = await serviceWithoutTags.indexEprintDelete(uri);

      expect(result.ok).toBe(true);
      expect(storage.deleteEprint).toHaveBeenCalledWith(uri);
      expect(search.deleteDocument).toHaveBeenCalledWith(uri);
      // tagManager should not be called
      expect(tagManager.removeAllTagsForRecord).not.toHaveBeenCalled();
    });

    it('returns error on unexpected exception', async () => {
      const uri = 'at://did:plc:author123/pub.chive.eprint.submission/abc123' as AtUri;

      // Simulate unexpected error (not a normal failure result)
      storage.deleteEprint.mockImplementation(() => {
        throw new Error('Unexpected crash');
      });

      const result = await service.indexEprintDelete(uri);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(DatabaseError);
        expect(result.error?.message).toContain('Unexpected crash');
      }
      expect(logger.error).toHaveBeenCalledWith('Failed to delete eprint', expect.any(Error), {
        uri,
      });
    });
  });

  describe('getEprint', () => {
    it('returns null when eprint not found', async () => {
      storage.getEprint.mockResolvedValue(null);

      const result = await service.getEprint(
        'at://did:plc:notfound/pub.chive.eprint.submission/xyz' as AtUri
      );

      expect(result).toBeNull();
    });

    it('returns eprint with versions and metrics', async () => {
      const createdAt = new Date('2024-01-15T10:00:00Z');
      const storedEprint = {
        uri: 'at://did:plc:author123/pub.chive.eprint.submission/abc123' as AtUri,
        cid: 'bafyrei123' as CID,
        title: 'Test Eprint',
        abstract: { type: 'RichText', items: [], format: 'application/x-chive-gloss+json' },
        abstractPlainText: '',
        authors: [],
        submittedBy: 'did:plc:author123' as DID,
        license: 'CC-BY-4.0',
        documentBlobRef: {
          $type: 'blob',
          ref: 'bafkrei123',
          mimeType: 'application/pdf',
          size: 1000,
        },
        documentFormat: 'pdf',
        pdsUrl: 'https://pds.example.com',
        indexedAt: new Date(),
        createdAt,
        version: 1,
      };
      storage.getEprint.mockResolvedValue(storedEprint);

      const result = await service.getEprint(storedEprint.uri);

      expect(result).not.toBeNull();
      expect(result?.uri).toBe(storedEprint.uri);
      // Version manager generates a version entry from the stored eprint
      expect(result?.versions).toHaveLength(1);
      expect(result?.versions[0]).toMatchObject({
        uri: storedEprint.uri,
        cid: storedEprint.cid,
        versionNumber: 1,
      });
      expect(result?.metrics).toEqual({ views: 0, downloads: 0, endorsements: 0 });
    });
  });

  describe('getEprintsByAuthor', () => {
    it('returns eprints for author', async () => {
      const storedEprints = [
        {
          uri: 'at://did:plc:author123/pub.chive.eprint.submission/abc123' as AtUri,
          cid: 'bafyrei123' as CID,
          title: 'Test Eprint 1',
          authors: [],
          submittedBy: 'did:plc:author123' as DID,
          indexedAt: new Date(),
          createdAt: new Date(),
        },
        {
          uri: 'at://did:plc:author123/pub.chive.eprint.submission/def456' as AtUri,
          cid: 'bafyrei456' as CID,
          title: 'Test Eprint 2',
          authors: [],
          submittedBy: 'did:plc:author123' as DID,
          indexedAt: new Date(),
          createdAt: new Date(),
        },
      ];
      storage.getEprintsByAuthor.mockResolvedValue(storedEprints);

      const result = await service.getEprintsByAuthor('did:plc:author123' as DID);

      expect(result.eprints).toHaveLength(2);
      expect(result.total).toBe(2);
    });
  });
});
