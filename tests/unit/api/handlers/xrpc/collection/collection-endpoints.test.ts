/**
 * Unit tests for XRPC collection handlers.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DIDResolver before importing the handler
const mockGetAtprotoData = vi.fn().mockResolvedValue({ handle: 'aswhite.bsky.social' });
vi.mock('../../../../../../src/auth/did/did-resolver.js', () => {
  return {
    DIDResolver: class MockDIDResolver {
      getAtprotoData = mockGetAtprotoData;
    },
  };
});

import { get } from '../../../../../../src/api/handlers/xrpc/collection/get.js';
import { getContaining } from '../../../../../../src/api/handlers/xrpc/collection/getContaining.js';
import { getParent } from '../../../../../../src/api/handlers/xrpc/collection/getParent.js';
import { getSubcollections } from '../../../../../../src/api/handlers/xrpc/collection/getSubcollections.js';
import { listByOwner } from '../../../../../../src/api/handlers/xrpc/collection/listByOwner.js';
import { listPublic } from '../../../../../../src/api/handlers/xrpc/collection/listPublic.js';
import { search } from '../../../../../../src/api/handlers/xrpc/collection/search.js';
import type { IndexedCollection } from '../../../../../../src/services/collection/collection-service.js';
import type { AtUri, DID } from '../../../../../../src/types/atproto.js';
import type { ILogger } from '../../../../../../src/types/interfaces/logger.interface.js';

// ============================================================================
// Mock Factories
// ============================================================================

const createMockLogger = (): ILogger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
});

interface MockCollectionService {
  getCollection: ReturnType<typeof vi.fn>;
  getCollectionItems: ReturnType<typeof vi.fn>;
  getInterItemEdges: ReturnType<typeof vi.fn>;
  listByOwner: ReturnType<typeof vi.fn>;
  listPublic: ReturnType<typeof vi.fn>;
  searchCollections: ReturnType<typeof vi.fn>;
  getCollectionsContaining: ReturnType<typeof vi.fn>;
  getParentCollection: ReturnType<typeof vi.fn>;
  getSubcollections: ReturnType<typeof vi.fn>;
}

const createMockCollectionService = (): MockCollectionService => ({
  getCollection: vi.fn().mockResolvedValue(null),
  getCollectionItems: vi.fn().mockResolvedValue({ ok: true, value: [] }),
  getInterItemEdges: vi.fn().mockResolvedValue([]),
  listByOwner: vi
    .fn()
    .mockResolvedValue({ items: [], cursor: undefined, hasMore: false, total: 0 }),
  listPublic: vi.fn().mockResolvedValue({ items: [], cursor: undefined, hasMore: false, total: 0 }),
  searchCollections: vi
    .fn()
    .mockResolvedValue({ items: [], cursor: undefined, hasMore: false, total: 0 }),
  getCollectionsContaining: vi.fn().mockResolvedValue([]),
  getParentCollection: vi.fn().mockResolvedValue(null),
  getSubcollections: vi.fn().mockResolvedValue([]),
});

// ============================================================================
// Sample Data
// ============================================================================

const SAMPLE_DID = 'did:plc:aswhite' as DID;
const SAMPLE_COLLECTION_URI = 'at://did:plc:aswhite/pub.chive.graph.node/nlp-reading-list' as AtUri;
const SAMPLE_EPRINT_URI = 'at://did:plc:aswhite/pub.chive.eprint.submission/megaattitude' as AtUri;
const SAMPLE_PARENT_URI =
  'at://did:plc:aswhite/pub.chive.graph.node/linguistics-collection' as AtUri;
const SAMPLE_CHILD_URI = 'at://did:plc:aswhite/pub.chive.graph.node/syntax-subcollection' as AtUri;

const createSampleCollection = (overrides?: Partial<IndexedCollection>): IndexedCollection => ({
  uri: SAMPLE_COLLECTION_URI,
  cid: 'bafyreiabc123def456',
  ownerDid: SAMPLE_DID,
  label: 'NLP Reading List',
  description: 'Curated papers on computational linguistics and NLP',
  visibility: 'public',
  itemCount: 5,
  createdAt: new Date('2025-06-15T10:00:00Z'),
  updatedAt: undefined,
  ...overrides,
});

// ============================================================================
// Tests
// ============================================================================

describe('XRPC Collection Handlers', () => {
  let mockLogger: ILogger;
  let mockCollectionService: MockCollectionService;
  let mockRedis: Record<string, ReturnType<typeof vi.fn>>;
  let mockContext: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  };

  const mockOwner = {
    did: SAMPLE_DID,
    handle: 'aswhite.bsky.social',
  };

  const mockStranger = {
    did: 'did:plc:stranger' as DID,
    handle: 'stranger.bsky.social',
  };

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockCollectionService = createMockCollectionService();
    mockRedis = { get: vi.fn(), set: vi.fn() };

    mockContext = {
      get: vi.fn((key: string) => {
        switch (key) {
          case 'services':
            return { collection: mockCollectionService };
          case 'logger':
            return mockLogger;
          case 'redis':
            return mockRedis;
          case 'user':
            return mockOwner;
          default:
            return undefined;
        }
      }),
      set: vi.fn(),
    };
  });

  // ==========================================================================
  // get
  // ==========================================================================

  describe('get', () => {
    it('returns collection by URI with ownerHandle', async () => {
      const collection = createSampleCollection();
      mockCollectionService.getCollection.mockResolvedValue(collection);

      const result = await get.handler({
        params: { uri: SAMPLE_COLLECTION_URI as string },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      expect(result.body.collection).toBeDefined();
      expect(result.body.collection.uri).toBe(SAMPLE_COLLECTION_URI);
      expect(result.body.collection.label).toBe('NLP Reading List');
      expect(result.body.collection.itemCount).toBe(5);
      expect(result.body.collection.ownerHandle).toBe('aswhite.bsky.social');
    });

    it('returns items with label, kind, subkind, and description fields', async () => {
      const collection = createSampleCollection();
      mockCollectionService.getCollection.mockResolvedValue(collection);
      mockCollectionService.getCollectionItems.mockResolvedValue({
        ok: true,
        value: [
          {
            edgeUri: 'at://did:plc:aswhite/pub.chive.graph.edge/e1',
            itemUri: 'at://did:plc:aswhite/pub.chive.graph.node/syntax-primer',
            itemType: 'concept',
            order: 1,
            addedAt: new Date('2025-06-15T10:00:00Z'),
            label: 'Syntax Primer',
            kind: 'object',
            subkind: 'concept',
            description: 'An intro to syntax',
            metadata: {},
          },
          {
            edgeUri: 'at://did:plc:aswhite/pub.chive.graph.edge/e2',
            itemUri: 'at://did:plc:aswhite/pub.chive.graph.node/megaattitude-clone',
            itemType: 'eprint',
            order: 2,
            addedAt: new Date('2025-06-16T10:00:00Z'),
            title: 'MegaAttitude',
            label: 'MegaAttitude',
            kind: 'object',
            subkind: 'eprint',
            metadata: { eprintUri: SAMPLE_EPRINT_URI, authors: ['Aaron Steven White'] },
          },
        ],
      });

      const result = await get.handler({
        params: { uri: SAMPLE_COLLECTION_URI as string },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      expect(result.body.items).toHaveLength(2);

      const graphNodeItem = result.body.items[0];
      expect(graphNodeItem?.label).toBe('Syntax Primer');
      expect(graphNodeItem?.kind).toBe('object');
      expect(graphNodeItem?.subkind).toBe('concept');
      expect(graphNodeItem?.description).toBe('An intro to syntax');
      expect(graphNodeItem?.itemType).toBe('concept');
      expect((graphNodeItem as unknown as Record<string, unknown>)?.source).toBe('personal');

      const eprintItem = result.body.items[1];
      expect(eprintItem?.title).toBe('MegaAttitude');
      expect(eprintItem?.authors).toEqual(['Aaron Steven White']);
      expect(eprintItem?.itemType).toBe('eprint');
      expect((eprintItem as unknown as Record<string, unknown>)?.source).toBe('personal');
    });

    it('returns interItemEdges array in response', async () => {
      const collection = createSampleCollection();
      mockCollectionService.getCollection.mockResolvedValue(collection);
      mockCollectionService.getInterItemEdges.mockResolvedValue([
        {
          uri: 'at://did:plc:aswhite/pub.chive.graph.edge/cites1',
          sourceUri: SAMPLE_EPRINT_URI,
          targetUri: 'at://did:plc:aswhite/pub.chive.graph.node/syntax-primer',
          relationSlug: 'cites',
        },
      ]);

      const result = await get.handler({
        params: { uri: SAMPLE_COLLECTION_URI as string },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      expect(result.body.interItemEdges).toHaveLength(1);
      expect(result.body.interItemEdges[0]?.sourceUri).toBe(SAMPLE_EPRINT_URI);
      expect(result.body.interItemEdges[0]?.relationSlug).toBe('cites');
    });

    it('returns 404 for non-existent collection', async () => {
      mockCollectionService.getCollection.mockResolvedValue(null);

      await expect(
        get.handler({
          params: { uri: 'at://did:plc:unknown/pub.chive.graph.node/nonexistent' },
          input: undefined,
          auth: null,
          c: mockContext as never,
        })
      ).rejects.toThrow('not found');
    });

    it('returns 404 for private collection when not owner', async () => {
      // The service returns null when visibility check fails
      mockCollectionService.getCollection.mockResolvedValue(null);

      // Use a stranger user context
      const strangerContext = {
        get: vi.fn((key: string) => {
          switch (key) {
            case 'services':
              return { collection: mockCollectionService };
            case 'logger':
              return mockLogger;
            case 'redis':
              return mockRedis;
            case 'user':
              return mockStranger;
            default:
              return undefined;
          }
        }),
        set: vi.fn(),
      };

      await expect(
        get.handler({
          params: { uri: SAMPLE_COLLECTION_URI as string },
          input: undefined,
          auth: null,
          c: strangerContext as never,
        })
      ).rejects.toThrow('not found');
    });

    it('allows owner to see private collection', async () => {
      const privateCollection = createSampleCollection({ visibility: 'private' });
      mockCollectionService.getCollection.mockResolvedValue(privateCollection);

      const result = await get.handler({
        params: { uri: SAMPLE_COLLECTION_URI as string },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      expect(result.body.collection.visibility).toBe('private');
    });

    it('passes authenticated user DID to service for visibility check', async () => {
      mockCollectionService.getCollection.mockResolvedValue(createSampleCollection());

      await get.handler({
        params: { uri: SAMPLE_COLLECTION_URI as string },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      expect(mockCollectionService.getCollection).toHaveBeenCalledWith(
        SAMPLE_COLLECTION_URI,
        SAMPLE_DID
      );
    });

    it('throws ValidationError when uri parameter is missing', async () => {
      await expect(
        get.handler({
          params: { uri: '' },
          input: undefined,
          auth: null,
          c: mockContext as never,
        })
      ).rejects.toThrow('Missing required parameter');
    });

    it('formats dates as ISO 8601 strings in response', async () => {
      const collection = createSampleCollection({
        updatedAt: new Date('2025-07-01T14:30:00Z'),
      });
      mockCollectionService.getCollection.mockResolvedValue(collection);

      const result = await get.handler({
        params: { uri: SAMPLE_COLLECTION_URI as string },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      expect(result.body.collection.createdAt).toBe('2025-06-15T10:00:00.000Z');
      expect(result.body.collection.updatedAt).toBe('2025-07-01T14:30:00.000Z');
    });
  });

  // ==========================================================================
  // listByOwner
  // ==========================================================================

  describe('listByOwner', () => {
    it('returns paginated collections', async () => {
      const collections = [
        createSampleCollection(),
        createSampleCollection({
          uri: 'at://did:plc:aswhite/pub.chive.graph.node/syntax-list' as AtUri,
          label: 'Syntax Papers',
        }),
      ];
      mockCollectionService.listByOwner.mockResolvedValue({
        items: collections,
        cursor: undefined,
        hasMore: false,
        total: 2,
      });

      const result = await listByOwner.handler({
        params: { did: SAMPLE_DID as string, limit: 50 },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      expect(result.body.collections).toHaveLength(2);
      expect(result.body.total).toBe(2);
      expect(result.body.hasMore).toBe(false);
    });

    it('filters private collections for unauthenticated users', async () => {
      const publicCollection = createSampleCollection({ visibility: 'public' });
      const privateCollection = createSampleCollection({
        uri: 'at://did:plc:aswhite/pub.chive.graph.node/private-list' as AtUri,
        visibility: 'private',
        label: 'Private Papers',
      });
      mockCollectionService.listByOwner.mockResolvedValue({
        items: [publicCollection, privateCollection],
        cursor: undefined,
        hasMore: false,
        total: 2,
      });

      // Use unauthenticated context (no user)
      const unauthContext = {
        get: vi.fn((key: string) => {
          switch (key) {
            case 'services':
              return { collection: mockCollectionService };
            case 'logger':
              return mockLogger;
            case 'redis':
              return mockRedis;
            case 'user':
              return null;
            default:
              return undefined;
          }
        }),
        set: vi.fn(),
      };

      const result = await listByOwner.handler({
        params: { did: SAMPLE_DID as string, limit: 50 },
        input: undefined,
        auth: null,
        c: unauthContext as never,
      });

      // Only public collection should be returned
      expect(result.body.collections).toHaveLength(1);
      expect(result.body.collections[0]?.label).toBe('NLP Reading List');
    });

    it('shows all collections (including private) to owner', async () => {
      const publicCollection = createSampleCollection({ visibility: 'public' });
      const privateCollection = createSampleCollection({
        uri: 'at://did:plc:aswhite/pub.chive.graph.node/private-list' as AtUri,
        visibility: 'private',
        label: 'Private Papers',
      });
      mockCollectionService.listByOwner.mockResolvedValue({
        items: [publicCollection, privateCollection],
        cursor: undefined,
        hasMore: false,
        total: 2,
      });

      const result = await listByOwner.handler({
        params: { did: SAMPLE_DID as string, limit: 50 },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      expect(result.body.collections).toHaveLength(2);
    });

    it('throws ValidationError when did parameter is missing', async () => {
      await expect(
        listByOwner.handler({
          params: { did: '', limit: 50 },
          input: undefined,
          auth: null,
          c: mockContext as never,
        })
      ).rejects.toThrow('Missing required parameter');
    });

    it('handles pagination cursor', async () => {
      mockCollectionService.listByOwner.mockResolvedValue({
        items: [createSampleCollection()],
        cursor: '2025-06-15T10:00:00.000Z::at://...',
        hasMore: true,
        total: 50,
      });

      const result = await listByOwner.handler({
        params: { did: SAMPLE_DID as string, limit: 10, cursor: 'prev-cursor' },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      expect(result.body.hasMore).toBe(true);
      expect(result.body.cursor).toBeDefined();

      expect(mockCollectionService.listByOwner).toHaveBeenCalledWith(SAMPLE_DID, {
        limit: 10,
        cursor: 'prev-cursor',
      });
    });
  });

  // ==========================================================================
  // listPublic
  // ==========================================================================

  describe('listPublic', () => {
    it('returns only public collections', async () => {
      const publicCollection = createSampleCollection({ visibility: 'public' });
      mockCollectionService.listPublic.mockResolvedValue({
        items: [publicCollection],
        cursor: undefined,
        hasMore: false,
        total: 1,
      });

      const result = await listPublic.handler({
        params: { limit: 50 },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      expect(result.body.collections).toHaveLength(1);
      expect(result.body.collections[0]?.visibility).toBe('public');
    });

    it('returns empty when no collection service is configured', async () => {
      const noServiceContext = {
        get: vi.fn((key: string) => {
          switch (key) {
            case 'services':
              return { collection: null };
            case 'logger':
              return mockLogger;
            default:
              return undefined;
          }
        }),
        set: vi.fn(),
      };

      const result = await listPublic.handler({
        params: { limit: 50 },
        input: undefined,
        auth: null,
        c: noServiceContext as never,
      });

      expect(result.body.collections).toEqual([]);
      expect(result.body.total).toBe(0);
    });

    it('supports pagination with limit and cursor', async () => {
      mockCollectionService.listPublic.mockResolvedValue({
        items: [],
        cursor: undefined,
        hasMore: false,
        total: 0,
      });

      await listPublic.handler({
        params: { limit: 25, cursor: 'some-cursor' },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      expect(mockCollectionService.listPublic).toHaveBeenCalledWith({
        limit: 25,
        cursor: 'some-cursor',
      });
    });
  });

  // ==========================================================================
  // search
  // ==========================================================================

  describe('search', () => {
    it('returns matching collections', async () => {
      const collection = createSampleCollection();
      mockCollectionService.searchCollections.mockResolvedValue({
        items: [collection],
        cursor: undefined,
        hasMore: false,
        total: 1,
      });

      const result = await search.handler({
        params: { query: 'linguistics', limit: 50 },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      expect(result.body.collections).toHaveLength(1);
      expect(result.body.total).toBe(1);
    });

    it('filters by public visibility', async () => {
      mockCollectionService.searchCollections.mockResolvedValue({
        items: [],
        cursor: undefined,
        hasMore: false,
        total: 0,
      });

      await search.handler({
        params: { query: 'semantics', limit: 50 },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      expect(mockCollectionService.searchCollections).toHaveBeenCalledWith('semantics', {
        limit: 50,
        cursor: undefined,
        visibility: 'public',
      });
    });

    it('throws ValidationError when query is missing', async () => {
      await expect(
        search.handler({
          params: { query: '', limit: 50 },
          input: undefined,
          auth: null,
          c: mockContext as never,
        })
      ).rejects.toThrow('Missing required parameter');
    });

    it('returns empty when no collection service is configured', async () => {
      const noServiceContext = {
        get: vi.fn((key: string) => {
          switch (key) {
            case 'services':
              return { collection: null };
            case 'logger':
              return mockLogger;
            default:
              return undefined;
          }
        }),
        set: vi.fn(),
      };

      const result = await search.handler({
        params: { query: 'test', limit: 50 },
        input: undefined,
        auth: null,
        c: noServiceContext as never,
      });

      expect(result.body.collections).toEqual([]);
    });
  });

  // ==========================================================================
  // getContaining
  // ==========================================================================

  describe('getContaining', () => {
    it('returns collections containing an item', async () => {
      const collection = createSampleCollection();
      mockCollectionService.getCollectionsContaining.mockResolvedValue([collection]);

      const result = await getContaining.handler({
        params: { itemUri: SAMPLE_EPRINT_URI as string, limit: 50 },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      expect(result.body.collections).toHaveLength(1);
      expect(result.body.collections[0]?.label).toBe('NLP Reading List');
    });

    it('returns empty for item in no collections', async () => {
      mockCollectionService.getCollectionsContaining.mockResolvedValue([]);

      const result = await getContaining.handler({
        params: { itemUri: 'at://did:plc:unknown/pub.chive.eprint.submission/orphan', limit: 50 },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      expect(result.body.collections).toEqual([]);
    });

    it('passes authenticated user DID for visibility filtering', async () => {
      mockCollectionService.getCollectionsContaining.mockResolvedValue([]);

      await getContaining.handler({
        params: { itemUri: SAMPLE_EPRINT_URI as string, limit: 50 },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      expect(mockCollectionService.getCollectionsContaining).toHaveBeenCalledWith(
        SAMPLE_EPRINT_URI,
        SAMPLE_DID
      );
    });

    it('throws ValidationError when itemUri is missing', async () => {
      await expect(
        getContaining.handler({
          params: { itemUri: '', limit: 50 },
          input: undefined,
          auth: null,
          c: mockContext as never,
        })
      ).rejects.toThrow('Missing required parameter');
    });
  });

  // ==========================================================================
  // getParent
  // ==========================================================================

  describe('getParent', () => {
    it('returns parent collection', async () => {
      const parentCollection = createSampleCollection({
        uri: SAMPLE_PARENT_URI,
        label: 'Linguistics Collection',
      });
      mockCollectionService.getParentCollection.mockResolvedValue(parentCollection);

      const result = await getParent.handler({
        params: { uri: SAMPLE_CHILD_URI as string },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      expect(result.body.parent).toBeDefined();
      expect(result.body.parent?.label).toBe('Linguistics Collection');
    });

    it('returns undefined parent for top-level collection', async () => {
      mockCollectionService.getParentCollection.mockResolvedValue(null);

      const result = await getParent.handler({
        params: { uri: SAMPLE_COLLECTION_URI as string },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      expect(result.body.parent).toBeUndefined();
    });

    it('throws ValidationError when uri is missing', async () => {
      await expect(
        getParent.handler({
          params: { uri: '' },
          input: undefined,
          auth: null,
          c: mockContext as never,
        })
      ).rejects.toThrow('Missing required parameter');
    });

    it('passes authenticated user DID for visibility filtering', async () => {
      mockCollectionService.getParentCollection.mockResolvedValue(null);

      await getParent.handler({
        params: { uri: SAMPLE_CHILD_URI as string },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      expect(mockCollectionService.getParentCollection).toHaveBeenCalledWith(
        SAMPLE_CHILD_URI,
        SAMPLE_DID
      );
    });
  });

  // ==========================================================================
  // getSubcollections
  // ==========================================================================

  describe('getSubcollections', () => {
    it('returns child collections', async () => {
      const childCollection = createSampleCollection({
        uri: SAMPLE_CHILD_URI,
        label: 'Syntax Subcollection',
      });
      mockCollectionService.getSubcollections.mockResolvedValue([childCollection]);

      const result = await getSubcollections.handler({
        params: { uri: SAMPLE_COLLECTION_URI as string },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      expect(result.body.subcollections).toHaveLength(1);
      expect(result.body.subcollections[0]?.label).toBe('Syntax Subcollection');
    });

    it('returns empty for collection with no subcollections', async () => {
      mockCollectionService.getSubcollections.mockResolvedValue([]);

      const result = await getSubcollections.handler({
        params: { uri: SAMPLE_COLLECTION_URI as string },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      expect(result.body.subcollections).toEqual([]);
    });

    it('throws ValidationError when uri is missing', async () => {
      await expect(
        getSubcollections.handler({
          params: { uri: '' },
          input: undefined,
          auth: null,
          c: mockContext as never,
        })
      ).rejects.toThrow('Missing required parameter');
    });

    it('returns empty when no collection service is configured', async () => {
      const noServiceContext = {
        get: vi.fn((key: string) => {
          switch (key) {
            case 'services':
              return { collection: null };
            case 'logger':
              return mockLogger;
            default:
              return undefined;
          }
        }),
        set: vi.fn(),
      };

      const result = await getSubcollections.handler({
        params: { uri: SAMPLE_COLLECTION_URI as string },
        input: undefined,
        auth: null,
        c: noServiceContext as never,
      });

      expect(result.body.subcollections).toEqual([]);
    });

    it('passes authenticated user DID for visibility filtering', async () => {
      mockCollectionService.getSubcollections.mockResolvedValue([]);

      await getSubcollections.handler({
        params: { uri: SAMPLE_COLLECTION_URI as string },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      expect(mockCollectionService.getSubcollections).toHaveBeenCalledWith(
        SAMPLE_COLLECTION_URI,
        SAMPLE_DID
      );
    });
  });
});
