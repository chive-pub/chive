/**
 * Unit tests for the pub.chive.collection.getFeed XRPC handler.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { getFeed } from '../../../../src/api/handlers/xrpc/collection/getFeed.js';
import type { IndexedCollection } from '../../../../src/services/collection/collection-service.js';
import type { AtUri, DID } from '../../../../src/types/atproto.js';
import {
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from '../../../../src/types/errors.js';
import type { ILogger } from '../../../../src/types/interfaces/logger.interface.js';

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
  getCollectionFeed: ReturnType<typeof vi.fn>;
}

const createMockCollectionService = (): MockCollectionService => ({
  getCollection: vi.fn().mockResolvedValue(null),
  getCollectionFeed: vi.fn().mockResolvedValue({
    ok: true,
    value: { events: [], cursor: undefined, hasMore: false },
  }),
});

// ============================================================================
// Sample Data
// ============================================================================

const SAMPLE_DID = 'did:plc:aswhite' as DID;
const SAMPLE_COLLECTION_URI = 'at://did:plc:aswhite/pub.chive.graph.node/nlp-reading-list' as AtUri;

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

describe('XRPC collection.getFeed handler', () => {
  let mockLogger: ILogger;
  let mockCollectionService: MockCollectionService;
  let mockContext: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  };

  const mockOwner = {
    did: SAMPLE_DID,
    handle: 'aswhite.bsky.social',
  };

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockCollectionService = createMockCollectionService();

    mockContext = {
      get: vi.fn((key: string) => {
        switch (key) {
          case 'services':
            return { collection: mockCollectionService };
          case 'logger':
            return mockLogger;
          case 'user':
            return mockOwner;
          default:
            return undefined;
        }
      }),
      set: vi.fn(),
    };
  });

  it('throws ValidationError when uri param is missing', async () => {
    await expect(
      getFeed.handler({
        params: { uri: '', limit: 30 },
        input: undefined,
        auth: null,
        c: mockContext as never,
      })
    ).rejects.toThrow(ValidationError);
  });

  it('throws NotFoundError when collection does not exist', async () => {
    mockCollectionService.getCollection.mockResolvedValue(null);

    await expect(
      getFeed.handler({
        params: { uri: SAMPLE_COLLECTION_URI as string, limit: 30 },
        input: undefined,
        auth: null,
        c: mockContext as never,
      })
    ).rejects.toThrow(NotFoundError);
  });

  it('throws AuthorizationError for non-owner accessing private collection feed', async () => {
    const privateCollection = createSampleCollection({ visibility: 'private' });
    mockCollectionService.getCollection.mockResolvedValue(privateCollection);

    const strangerContext = {
      get: vi.fn((key: string) => {
        switch (key) {
          case 'services':
            return { collection: mockCollectionService };
          case 'logger':
            return mockLogger;
          case 'user':
            return { did: 'did:plc:stranger' as DID, handle: 'stranger.bsky.social' };
          default:
            return undefined;
        }
      }),
      set: vi.fn(),
    };

    await expect(
      getFeed.handler({
        params: { uri: SAMPLE_COLLECTION_URI as string, limit: 30 },
        input: undefined,
        auth: null,
        c: strangerContext as never,
      })
    ).rejects.toThrow(AuthorizationError);
  });

  it('throws AuthorizationError for unauthenticated user accessing private collection feed', async () => {
    const privateCollection = createSampleCollection({ visibility: 'private' });
    mockCollectionService.getCollection.mockResolvedValue(privateCollection);

    const unauthContext = {
      get: vi.fn((key: string) => {
        switch (key) {
          case 'services':
            return { collection: mockCollectionService };
          case 'logger':
            return mockLogger;
          case 'user':
            return null;
          default:
            return undefined;
        }
      }),
      set: vi.fn(),
    };

    await expect(
      getFeed.handler({
        params: { uri: SAMPLE_COLLECTION_URI as string, limit: 30 },
        input: undefined,
        auth: null,
        c: unauthContext as never,
      })
    ).rejects.toThrow(AuthorizationError);
  });

  it('allows owner to access private collection feed', async () => {
    const privateCollection = createSampleCollection({ visibility: 'private' });
    mockCollectionService.getCollection.mockResolvedValue(privateCollection);
    mockCollectionService.getCollectionFeed.mockResolvedValue({
      ok: true,
      value: { events: [], cursor: undefined, hasMore: false },
    });

    const result = await getFeed.handler({
      params: { uri: SAMPLE_COLLECTION_URI as string, limit: 30 },
      input: undefined,
      auth: null,
      c: mockContext as never,
    });

    expect(result.body.events).toEqual([]);
    expect(result.body.hasMore).toBe(false);
  });

  it('maps eventAt to ISO string format in the response', async () => {
    const eventDate = new Date('2025-06-20T14:30:00.000Z');
    const collection = createSampleCollection();
    mockCollectionService.getCollection.mockResolvedValue(collection);
    mockCollectionService.getCollectionFeed.mockResolvedValue({
      ok: true,
      value: {
        events: [
          {
            type: 'eprint_by_author',
            eventUri: 'at://did:plc:author/pub.chive.eprint.submission/ep-a',
            eventAt: eventDate,
            collectionItemUri: 'at://did:plc:aswhite/pub.chive.graph.node/person-a',
            collectionItemSubkind: 'person',
            payload: { eprintTitle: 'Paper A' },
          },
        ],
        cursor: undefined,
        hasMore: false,
      },
    });

    const result = await getFeed.handler({
      params: { uri: SAMPLE_COLLECTION_URI as string, limit: 30 },
      input: undefined,
      auth: null,
      c: mockContext as never,
    });

    expect(result.body.events).toHaveLength(1);
    const event = result.body.events[0];
    expect(event?.eventAt).toBe('2025-06-20T14:30:00.000Z');
    expect(typeof event?.eventAt).toBe('string');
  });

  it('returns correctly shaped events array', async () => {
    const collection = createSampleCollection();
    mockCollectionService.getCollection.mockResolvedValue(collection);
    mockCollectionService.getCollectionFeed.mockResolvedValue({
      ok: true,
      value: {
        events: [
          {
            type: 'review_on_eprint',
            eventUri: 'at://did:plc:reviewer/pub.chive.review.comment/r1',
            eventAt: new Date('2025-06-20T13:00:00Z'),
            collectionItemUri: 'at://did:plc:aswhite/pub.chive.graph.node/item-b',
            collectionItemSubkind: 'eprint',
            payload: { reviewerDid: 'did:plc:reviewer', snippet: 'Thorough analysis' },
          },
          {
            type: 'eprint_by_author',
            eventUri: 'at://did:plc:author/pub.chive.eprint.submission/new-paper',
            eventAt: new Date('2025-06-19T10:00:00Z'),
            collectionItemUri: 'at://did:plc:aswhite/pub.chive.graph.node/tracked-author',
            collectionItemSubkind: 'person',
            payload: { eprintTitle: 'New Paper', authorNames: ['Test Author'] },
          },
        ],
        cursor:
          '2025-06-19T10:00:00.000Z::at://did:plc:author/pub.chive.eprint.submission/new-paper',
        hasMore: true,
      },
    });

    const result = await getFeed.handler({
      params: { uri: SAMPLE_COLLECTION_URI as string, limit: 2 },
      input: undefined,
      auth: null,
      c: mockContext as never,
    });

    expect(result.encoding).toBe('application/json');
    expect(result.body.events).toHaveLength(2);
    expect(result.body.hasMore).toBe(true);
    expect(result.body.cursor).toBeDefined();

    const reviewEvent = result.body.events[0];
    expect(reviewEvent?.type).toBe('review_on_eprint');
    expect(reviewEvent?.eventUri).toBe('at://did:plc:reviewer/pub.chive.review.comment/r1');
    expect(reviewEvent?.collectionItemUri).toBe('at://did:plc:aswhite/pub.chive.graph.node/item-b');
    expect(reviewEvent?.collectionItemSubkind).toBe('eprint');
    expect(reviewEvent?.payload).toEqual({
      reviewerDid: 'did:plc:reviewer',
      snippet: 'Thorough analysis',
    });

    const authorEvent = result.body.events[1];
    expect(authorEvent?.type).toBe('eprint_by_author');
    expect(authorEvent?.collectionItemSubkind).toBe('person');
  });

  it('throws NotFoundError when feed query returns an error result', async () => {
    const collection = createSampleCollection();
    mockCollectionService.getCollection.mockResolvedValue(collection);
    mockCollectionService.getCollectionFeed.mockResolvedValue({
      ok: false,
      error: new Error('Database connection lost'),
    });

    await expect(
      getFeed.handler({
        params: { uri: SAMPLE_COLLECTION_URI as string, limit: 30 },
        input: undefined,
        auth: null,
        c: mockContext as never,
      })
    ).rejects.toThrow(NotFoundError);
  });

  it('passes limit and cursor params through to the service', async () => {
    const collection = createSampleCollection();
    mockCollectionService.getCollection.mockResolvedValue(collection);

    await getFeed.handler({
      params: {
        uri: SAMPLE_COLLECTION_URI as string,
        limit: 15,
        cursor: 'some-cursor-value',
      },
      input: undefined,
      auth: null,
      c: mockContext as never,
    });

    expect(mockCollectionService.getCollectionFeed).toHaveBeenCalledWith(SAMPLE_COLLECTION_URI, {
      limit: 15,
      cursor: 'some-cursor-value',
    });
  });

  it('throws NotFoundError when collection service is not configured', async () => {
    const noServiceContext = {
      get: vi.fn((key: string) => {
        switch (key) {
          case 'services':
            return { collection: null };
          case 'logger':
            return mockLogger;
          case 'user':
            return mockOwner;
          default:
            return undefined;
        }
      }),
      set: vi.fn(),
    };

    await expect(
      getFeed.handler({
        params: { uri: SAMPLE_COLLECTION_URI as string, limit: 30 },
        input: undefined,
        auth: null,
        c: noServiceContext as never,
      })
    ).rejects.toThrow(NotFoundError);
  });
});
