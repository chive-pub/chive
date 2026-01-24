/**
 * Unit tests for EprintService.
 *
 * @remarks
 * Tests eprint indexing, retrieval, and field label resolution functionality.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { EprintService, type RecordMetadata } from '@/services/eprint/eprint-service.js';
import type { AtUri, CID, DID, Timestamp } from '@/types/atproto.js';
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
});

const createMockSearch = () => ({
  indexEprint: vi.fn().mockResolvedValue(undefined),
  deleteDocument: vi.fn().mockResolvedValue(undefined),
  search: vi.fn(),
});

const createMockRepository = () => ({
  getRecord: vi.fn(),
  listRecords: vi.fn(),
  getBlob: vi.fn(),
});

const createMockIdentity = () => ({
  resolveDID: vi.fn().mockResolvedValue(undefined),
  resolveHandle: vi.fn(),
  getPDSEndpoint: vi.fn(),
});

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
  let logger: ILogger;
  let service: EprintService;

  beforeEach(() => {
    storage = createMockStorage();
    search = createMockSearch();
    repository = createMockRepository();
    identity = createMockIdentity();
    graph = createMockGraph();
    logger = createMockLogger();

    service = new EprintService({
      storage: storage as unknown as IStorageBackend,
      search: search as unknown as ISearchEngine,
      repository: repository as unknown as IRepository,
      identity: identity as unknown as IIdentityResolver,
      logger,
      graph: graph as unknown as IGraphDatabase,
    });
  });

  describe('indexEprint', () => {
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
        { uri: 'field-uuid-1', label: 'field-uuid-1', id: 'field-uuid-1' },
        { uri: 'field-uuid-2', label: 'field-uuid-2', id: 'field-uuid-2' },
      ];
      const eprint = createMockEprint({ fields });
      const metadata = createMockMetadata();

      // Mock graph to return resolved labels
      const nodeMap = new Map<string, GraphNode>();
      nodeMap.set('field-uuid-1', {
        id: 'field-uuid-1',
        uri: 'at://graph/field/1' as AtUri,
        kind: 'type',
        subkind: 'field',
        label: 'Computational Linguistics',
        status: 'established',
        createdAt: new Date(),
      });
      nodeMap.set('field-uuid-2', {
        id: 'field-uuid-2',
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
      expect(graph.getNodesByIds).toHaveBeenCalledWith(['field-uuid-1', 'field-uuid-2'], 'field');

      // Verify storeEprint was called with resolved labels
      expect(storage.storeEprint).toHaveBeenCalledTimes(1);
      const storeCall = storage.storeEprint.mock.calls[0]?.[0] as { fields: unknown };
      expect(storeCall.fields).toEqual([
        { uri: 'field-uuid-1', label: 'Computational Linguistics', id: 'field-uuid-1' },
        { uri: 'field-uuid-2', label: 'Natural Language Processing', id: 'field-uuid-2' },
      ]);
    });

    it('falls back to URI as label when field not found in graph', async () => {
      const fields = [
        { uri: 'field-uuid-1', label: 'field-uuid-1', id: 'field-uuid-1' },
        { uri: 'field-uuid-unknown', label: 'field-uuid-unknown', id: 'field-uuid-unknown' },
      ];
      const eprint = createMockEprint({ fields });
      const metadata = createMockMetadata();

      // Mock graph to return only one field
      const nodeMap = new Map<string, GraphNode>();
      nodeMap.set('field-uuid-1', {
        id: 'field-uuid-1',
        uri: 'at://graph/field/1' as AtUri,
        kind: 'type',
        subkind: 'field',
        label: 'Computational Linguistics',
        status: 'established',
        createdAt: new Date(),
      });
      // field-uuid-unknown is NOT in the map
      graph.getNodesByIds.mockResolvedValue(nodeMap);

      const result = await service.indexEprint(eprint, metadata);

      expect(result.ok).toBe(true);

      // Verify storeEprint was called - found field gets resolved, unknown keeps URI
      expect(storage.storeEprint).toHaveBeenCalledTimes(1);
      const storeCall = storage.storeEprint.mock.calls[0]?.[0] as { fields: unknown };
      expect(storeCall.fields).toEqual([
        { uri: 'field-uuid-1', label: 'Computational Linguistics', id: 'field-uuid-1' },
        { uri: 'field-uuid-unknown', label: 'field-uuid-unknown', id: 'field-uuid-unknown' },
      ]);
    });

    it('handles graph errors gracefully and falls back to URIs', async () => {
      const fields = [{ uri: 'field-uuid-1', label: 'field-uuid-1', id: 'field-uuid-1' }];
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

      // Verify storeEprint was still called with original fields
      expect(storage.storeEprint).toHaveBeenCalledTimes(1);
      const storeCall = storage.storeEprint.mock.calls[0]?.[0] as { fields: unknown };
      expect(storeCall.fields).toEqual(fields);
    });

    it('works without graph service configured', async () => {
      // Create service without graph
      const serviceWithoutGraph = new EprintService({
        storage: storage as unknown as IStorageBackend,
        search: search as unknown as ISearchEngine,
        repository: repository as unknown as IRepository,
        identity: identity as unknown as IIdentityResolver,
        logger,
        // no graph
      });

      const fields = [{ uri: 'field-uuid-1', label: 'field-uuid-1', id: 'field-uuid-1' }];
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
