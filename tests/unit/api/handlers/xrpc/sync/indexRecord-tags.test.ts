/**
 * Unit tests for userTag, citation, and relatedWork handling in indexRecord.
 *
 * @remarks
 * Tests the collection-specific branches of the pub.chive.sync.indexRecord
 * XRPC handler: userTag indexing, citation indexing, relatedWork indexing,
 * unsupported collection rejection, and missing input handling.
 */

import type { Context } from 'hono';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { indexRecord } from '@/api/handlers/xrpc/sync/indexRecord.js';
import type { ChiveEnv } from '@/api/types/context.js';
import type { AtUri, DID } from '@/types/atproto.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

// =============================================================================
// Mocks
// =============================================================================

const createMockLogger = (): ILogger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
});

interface MockEprintService {
  indexEprint: ReturnType<typeof vi.fn>;
  indexTag: ReturnType<typeof vi.fn>;
  indexCitation: ReturnType<typeof vi.fn>;
  indexRelatedWork: ReturnType<typeof vi.fn>;
}

interface MockPDSRegistry {
  registerPDS: ReturnType<typeof vi.fn>;
}

const createMockEprintService = (): MockEprintService => ({
  indexEprint: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
  indexTag: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
  indexCitation: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
  indexRelatedWork: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
});

const createMockPDSRegistry = (): MockPDSRegistry => ({
  registerPDS: vi.fn().mockResolvedValue(undefined),
});

// =============================================================================
// Helpers
// =============================================================================

const TEST_DID = 'did:plc:user123' as DID;
const TEST_PDS_URL = 'https://user-pds.example.com';

const mockUser = {
  did: TEST_DID,
  handle: 'user.test',
  isAdmin: false,
};

/**
 * Sets up global.fetch to resolve DID to PDS and return a record value.
 */
function setupFetchMocks(recordValue: unknown, uri: string): void {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.includes('plc.directory')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            service: [
              {
                id: '#atproto_pds',
                type: 'AtprotoPersonalDataServer',
                serviceEndpoint: TEST_PDS_URL,
              },
            ],
          }),
      });
    }
    if (url.includes('getRecord')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            uri,
            cid: 'bafytest456',
            value: recordValue,
          }),
      });
    }
    return Promise.resolve({ ok: false });
  });
}

// =============================================================================
// Tests
// =============================================================================

describe('indexRecord - tag, citation, and relatedWork handling', () => {
  let mockLogger: ILogger;
  let mockEprintService: MockEprintService;
  let mockPDSRegistry: MockPDSRegistry;
  let mockContext: Context<ChiveEnv>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogger = createMockLogger();
    mockEprintService = createMockEprintService();
    mockPDSRegistry = createMockPDSRegistry();

    mockContext = {
      get: vi.fn((key: string) => {
        switch (key) {
          case 'services':
            return {
              eprint: mockEprintService,
              pdsRegistry: mockPDSRegistry,
            };
          case 'logger':
            return mockLogger;
          case 'user':
            return mockUser;
          default:
            return undefined;
        }
      }),
      set: vi.fn(),
    } as unknown as Context<ChiveEnv>;
  });

  // ---------------------------------------------------------------------------
  // userTag indexing
  // ---------------------------------------------------------------------------

  describe('userTag indexing', () => {
    const tagUri = `at://${TEST_DID}/pub.chive.eprint.userTag/tag123` as AtUri;

    const tagRecord = {
      $type: 'pub.chive.eprint.userTag',
      eprintUri: `at://${TEST_DID}/pub.chive.eprint.submission/abc`,
      tag: 'machine learning',
      createdAt: new Date().toISOString(),
    };

    it('indexes a userTag record successfully', async () => {
      setupFetchMocks(tagRecord, tagUri);

      const result = await indexRecord.handler({
        params: undefined,
        input: { uri: tagUri },
        auth: null,
        c: mockContext,
      });

      expect(result.body.indexed).toBe(true);
      expect(result.body.uri).toBe(tagUri);
      expect(mockEprintService.indexTag).toHaveBeenCalledWith(
        tagRecord,
        expect.objectContaining({
          uri: tagUri,
          cid: 'bafytest456',
          pdsUrl: TEST_PDS_URL,
        })
      );
    });

    it('returns indexed: false when indexTag returns an error', async () => {
      setupFetchMocks(tagRecord, tagUri);
      mockEprintService.indexTag.mockResolvedValue({
        ok: false,
        error: new Error('Tag validation failed'),
      });

      const result = await indexRecord.handler({
        params: undefined,
        input: { uri: tagUri },
        auth: null,
        c: mockContext,
      });

      expect(result.body.indexed).toBe(false);
      expect(result.body.error).toBe('Tag validation failed');
    });
  });

  // ---------------------------------------------------------------------------
  // Citation indexing
  // ---------------------------------------------------------------------------

  describe('citation indexing', () => {
    const citationUri = `at://${TEST_DID}/pub.chive.eprint.citation/cit123` as AtUri;

    const citationRecord = {
      $type: 'pub.chive.eprint.citation',
      eprintUri: `at://${TEST_DID}/pub.chive.eprint.submission/abc`,
      citedWork: {
        title: 'A Cited Paper',
        doi: '10.1234/test',
      },
      context: 'Relevant prior work',
      createdAt: new Date().toISOString(),
    };

    it('indexes a citation record successfully', async () => {
      setupFetchMocks(citationRecord, citationUri);

      const result = await indexRecord.handler({
        params: undefined,
        input: { uri: citationUri },
        auth: null,
        c: mockContext,
      });

      expect(result.body.indexed).toBe(true);
      expect(result.body.uri).toBe(citationUri);
      expect(mockEprintService.indexCitation).toHaveBeenCalledWith(
        citationRecord,
        expect.objectContaining({
          uri: citationUri,
          cid: 'bafytest456',
          pdsUrl: TEST_PDS_URL,
        })
      );
    });

    it('returns indexed: false when indexCitation returns an error', async () => {
      setupFetchMocks(citationRecord, citationUri);
      mockEprintService.indexCitation.mockResolvedValue({
        ok: false,
        error: new Error('Citation indexing failed'),
      });

      const result = await indexRecord.handler({
        params: undefined,
        input: { uri: citationUri },
        auth: null,
        c: mockContext,
      });

      expect(result.body.indexed).toBe(false);
      expect(result.body.error).toBe('Citation indexing failed');
    });
  });

  // ---------------------------------------------------------------------------
  // relatedWork indexing
  // ---------------------------------------------------------------------------

  describe('relatedWork indexing', () => {
    const relatedWorkUri = `at://${TEST_DID}/pub.chive.eprint.relatedWork/rw123` as AtUri;

    const relatedWorkRecord = {
      $type: 'pub.chive.eprint.relatedWork',
      eprintUri: `at://${TEST_DID}/pub.chive.eprint.submission/abc`,
      relatedUri: `at://${TEST_DID}/pub.chive.eprint.submission/def`,
      relationType: 'extends',
      description: 'Extends the framework from the related work',
      createdAt: new Date().toISOString(),
    };

    it('indexes a relatedWork record successfully', async () => {
      setupFetchMocks(relatedWorkRecord, relatedWorkUri);

      const result = await indexRecord.handler({
        params: undefined,
        input: { uri: relatedWorkUri },
        auth: null,
        c: mockContext,
      });

      expect(result.body.indexed).toBe(true);
      expect(result.body.uri).toBe(relatedWorkUri);
      expect(mockEprintService.indexRelatedWork).toHaveBeenCalledWith(
        relatedWorkRecord,
        expect.objectContaining({
          uri: relatedWorkUri,
          cid: 'bafytest456',
          pdsUrl: TEST_PDS_URL,
        })
      );
    });

    it('returns indexed: false when indexRelatedWork returns an error', async () => {
      setupFetchMocks(relatedWorkRecord, relatedWorkUri);
      mockEprintService.indexRelatedWork.mockResolvedValue({
        ok: false,
        error: new Error('Related work indexing failed'),
      });

      const result = await indexRecord.handler({
        params: undefined,
        input: { uri: relatedWorkUri },
        auth: null,
        c: mockContext,
      });

      expect(result.body.indexed).toBe(false);
      expect(result.body.error).toBe('Related work indexing failed');
    });
  });

  // ---------------------------------------------------------------------------
  // Unsupported collection rejection
  // ---------------------------------------------------------------------------

  describe('unsupported collections', () => {
    it('rejects collections outside the supported list', async () => {
      const unsupportedUri = `at://${TEST_DID}/app.bsky.feed.post/abc123` as AtUri;

      await expect(
        indexRecord.handler({
          params: undefined,
          input: { uri: unsupportedUri },
          auth: null,
          c: mockContext,
        })
      ).rejects.toThrow('not supported for manual indexing');
    });

    it('rejects a custom unsupported pub.chive collection', async () => {
      const unsupportedUri = `at://${TEST_DID}/pub.chive.unsupported.type/abc` as AtUri;

      await expect(
        indexRecord.handler({
          params: undefined,
          input: { uri: unsupportedUri },
          auth: null,
          c: mockContext,
        })
      ).rejects.toThrow('not supported for manual indexing');
    });
  });

  // ---------------------------------------------------------------------------
  // Missing input handling
  // ---------------------------------------------------------------------------

  describe('missing input', () => {
    it('throws ValidationError when input is null', async () => {
      await expect(
        indexRecord.handler({
          params: undefined,
          input: null as never,
          auth: null,
          c: mockContext,
        })
      ).rejects.toThrow('Input required');
    });

    it('throws ValidationError when input is undefined', async () => {
      await expect(
        indexRecord.handler({
          params: undefined,
          input: undefined as never,
          auth: null,
          c: mockContext,
        })
      ).rejects.toThrow('Input required');
    });

    it('throws ValidationError for invalid AT URI format', async () => {
      await expect(
        indexRecord.handler({
          params: undefined,
          input: { uri: 'not-an-at-uri' as AtUri },
          auth: null,
          c: mockContext,
        })
      ).rejects.toThrow('Invalid AT URI format');
    });
  });

  // ---------------------------------------------------------------------------
  // Authentication checks for tag/citation/relatedWork
  // ---------------------------------------------------------------------------

  describe('authentication and ownership', () => {
    it('requires authentication', async () => {
      const noUserContext = {
        get: vi.fn((key: string) => {
          switch (key) {
            case 'services':
              return { eprint: mockEprintService };
            case 'logger':
              return mockLogger;
            case 'user':
              return null;
            default:
              return undefined;
          }
        }),
        set: vi.fn(),
      } as unknown as Context<ChiveEnv>;

      const tagUri = `at://${TEST_DID}/pub.chive.eprint.userTag/tag1` as AtUri;

      await expect(
        indexRecord.handler({
          params: undefined,
          input: { uri: tagUri },
          auth: null,
          c: noUserContext,
        })
      ).rejects.toThrow('Authentication required');
    });

    it('prevents indexing records from other users', async () => {
      const otherDid = 'did:plc:other456' as DID;
      const otherUri = `at://${otherDid}/pub.chive.eprint.userTag/tag1` as AtUri;

      await expect(
        indexRecord.handler({
          params: undefined,
          input: { uri: otherUri },
          auth: null,
          c: mockContext,
        })
      ).rejects.toThrow('Can only index your own records');
    });
  });
});
