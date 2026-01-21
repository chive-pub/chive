/**
 * Unit tests for XRPC sync handlers.
 *
 * @remarks
 * Tests registerPDS and indexRecord handlers.
 */

import type { Context } from 'hono';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { indexRecord } from '@/api/handlers/xrpc/sync/indexRecord.js';
import { registerPDS } from '@/api/handlers/xrpc/sync/registerPDS.js';
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

interface MockPDSRegistry {
  registerPDS: ReturnType<typeof vi.fn>;
  getPDS: ReturnType<typeof vi.fn>;
}

interface MockPDSScanner {
  scanDID: ReturnType<typeof vi.fn>;
}

interface MockEprintService {
  indexEprint: ReturnType<typeof vi.fn>;
}

const createMockPDSRegistry = (): MockPDSRegistry => ({
  registerPDS: vi.fn().mockResolvedValue(undefined),
  getPDS: vi.fn().mockResolvedValue(null),
});

const createMockPDSScanner = (): MockPDSScanner => ({
  scanDID: vi.fn().mockResolvedValue(0),
});

const createMockEprintService = (): MockEprintService => ({
  indexEprint: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
});

// =============================================================================
// Tests: registerPDS
// =============================================================================

describe('XRPC Sync Handlers', () => {
  let mockLogger: ILogger;
  let mockPDSRegistry: MockPDSRegistry;
  let mockPDSScanner: MockPDSScanner;
  let mockEprintService: MockEprintService;
  let mockContext: Context<ChiveEnv>;

  const mockUser = {
    did: 'did:plc:user123' as DID,
    handle: 'user.test',
    isAdmin: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogger = createMockLogger();
    mockPDSRegistry = createMockPDSRegistry();
    mockPDSScanner = createMockPDSScanner();
    mockEprintService = createMockEprintService();

    mockContext = {
      get: vi.fn((key: string) => {
        switch (key) {
          case 'services':
            return {
              pdsRegistry: mockPDSRegistry,
              pdsScanner: mockPDSScanner,
              eprint: mockEprintService,
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

    // Mock global fetch for PDS validation
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({}),
    });
  });

  describe('registerPDS', () => {
    it('registers a new PDS successfully', async () => {
      const result = await registerPDS.handler({
        params: undefined,
        input: { pdsUrl: 'https://custom-pds.example.com' },
        auth: null,
        c: mockContext,
      });

      expect(result.body.registered).toBe(true);
      expect(result.body.pdsUrl).toBe('https://custom-pds.example.com');
      expect(mockPDSRegistry.registerPDS).toHaveBeenCalledWith(
        'https://custom-pds.example.com',
        'user_registration'
      );
    });

    it('normalizes PDS URL by removing trailing slash', async () => {
      await registerPDS.handler({
        params: undefined,
        input: { pdsUrl: 'https://custom-pds.example.com/' },
        auth: null,
        c: mockContext,
      });

      expect(mockPDSRegistry.registerPDS).toHaveBeenCalledWith(
        'https://custom-pds.example.com',
        'user_registration'
      );
    });

    it('scans user DID when authenticated and PDS is new', async () => {
      mockPDSScanner.scanDID.mockResolvedValue(5);

      const result = await registerPDS.handler({
        params: undefined,
        input: { pdsUrl: 'https://custom-pds.example.com' },
        auth: null,
        c: mockContext,
      });

      expect(mockPDSScanner.scanDID).toHaveBeenCalledWith(
        'https://custom-pds.example.com',
        'did:plc:user123'
      );
      expect(result.body.status).toBe('scanned');
      expect(result.body.message).toContain('5 record(s) indexed');
    });

    it('returns already_exists status for existing PDS', async () => {
      mockPDSRegistry.getPDS.mockResolvedValue({
        pdsUrl: 'https://existing-pds.example.com',
        status: 'active',
      });

      const result = await registerPDS.handler({
        params: undefined,
        input: { pdsUrl: 'https://existing-pds.example.com' },
        auth: null,
        c: mockContext,
      });

      expect(result.body.status).toBe('already_exists');
      expect(mockPDSRegistry.registerPDS).not.toHaveBeenCalled();
    });

    it('still scans user DID for existing PDS', async () => {
      mockPDSRegistry.getPDS.mockResolvedValue({
        pdsUrl: 'https://existing-pds.example.com',
        status: 'active',
      });
      mockPDSScanner.scanDID.mockResolvedValue(3);

      const result = await registerPDS.handler({
        params: undefined,
        input: { pdsUrl: 'https://existing-pds.example.com' },
        auth: null,
        c: mockContext,
      });

      expect(mockPDSScanner.scanDID).toHaveBeenCalled();
      expect(result.body.status).toBe('scanned');
    });

    it('throws ServiceUnavailableError when registry is not available', async () => {
      const noRegistryContext = {
        get: vi.fn((key: string) => {
          switch (key) {
            case 'services':
              return { pdsRegistry: null };
            case 'logger':
              return mockLogger;
            default:
              return undefined;
          }
        }),
        set: vi.fn(),
      } as unknown as Context<ChiveEnv>;

      await expect(
        registerPDS.handler({
          params: undefined,
          input: { pdsUrl: 'https://pds.example.com' },
          auth: null,
          c: noRegistryContext,
        })
      ).rejects.toThrow('PDS registration is not currently available');
    });

    it('validates PDS is reachable', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });

      await expect(
        registerPDS.handler({
          params: undefined,
          input: { pdsUrl: 'https://unreachable-pds.example.com' },
          auth: null,
          c: mockContext,
        })
      ).rejects.toThrow('PDS does not appear to be reachable');
    });

    it('handles network errors during validation', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(
        registerPDS.handler({
          params: undefined,
          input: { pdsUrl: 'https://pds.example.com' },
          auth: null,
          c: mockContext,
        })
      ).rejects.toThrow('Could not connect to PDS');
    });
  });

  describe('indexRecord', () => {
    const validUri = 'at://did:plc:user123/pub.chive.eprint.submission/abc123' as AtUri;

    beforeEach(() => {
      // Mock fetch for DID resolution and record fetching
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
                    serviceEndpoint: 'https://user-pds.example.com',
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
                uri: validUri,
                cid: 'bafytest123',
                value: {
                  $type: 'pub.chive.eprint.submission',
                  title: 'Test Paper',
                  abstract: { text: 'Test abstract', facets: [] },
                  authors: [{ did: 'did:plc:user123', name: 'Test Author' }],
                  document: {
                    $type: 'blob',
                    ref: { $link: 'bafyblob123' },
                    mimeType: 'application/pdf',
                    size: 1000,
                  },
                  documentFormat: 'pdf',
                  license: 'cc-by-4.0',
                  createdAt: new Date().toISOString(),
                },
              }),
          });
        }
        return Promise.resolve({ ok: false });
      });
    });

    it('indexes a record successfully', async () => {
      const result = await indexRecord.handler({
        params: undefined,
        input: { uri: validUri },
        auth: null,
        c: mockContext,
      });

      expect(result.body.indexed).toBe(true);
      expect(result.body.uri).toBe(validUri);
    });

    it('requires authentication', async () => {
      const noUserContext = {
        get: vi.fn((key: string) => {
          switch (key) {
            case 'services':
              return { eprint: mockEprintService };
            case 'logger':
              return mockLogger;
            case 'user':
              return null; // No user
            default:
              return undefined;
          }
        }),
        set: vi.fn(),
      } as unknown as Context<ChiveEnv>;

      await expect(
        indexRecord.handler({
          params: undefined,
          input: { uri: validUri },
          auth: null,
          c: noUserContext,
        })
      ).rejects.toThrow('Authentication required');
    });

    it('only allows users to index their own records', async () => {
      const otherUserUri = 'at://did:plc:other456/pub.chive.eprint.submission/abc123' as AtUri;

      await expect(
        indexRecord.handler({
          params: undefined,
          input: { uri: otherUserUri },
          auth: null,
          c: mockContext,
        })
      ).rejects.toThrow('Can only index your own records');
    });

    it('allows admins to index any record', async () => {
      const adminContext = {
        get: vi.fn((key: string) => {
          switch (key) {
            case 'services':
              return { eprint: mockEprintService, pdsRegistry: mockPDSRegistry };
            case 'logger':
              return mockLogger;
            case 'user':
              return { ...mockUser, isAdmin: true };
            default:
              return undefined;
          }
        }),
        set: vi.fn(),
      } as unknown as Context<ChiveEnv>;

      const otherUserUri = 'at://did:plc:other456/pub.chive.eprint.submission/abc123' as AtUri;

      // Should not throw (would fail later due to fetch mock, but auth passes)
      // The test verifies the auth check passes
      try {
        await indexRecord.handler({
          params: undefined,
          input: { uri: otherUserUri },
          auth: null,
          c: adminContext,
        });
      } catch (error) {
        // Expected to fail at PDS resolution, not auth
        expect((error as Error).message).not.toContain('Can only index your own records');
      }
    });

    it('rejects non-eprint collections', async () => {
      const nonEprintUri = 'at://did:plc:user123/app.bsky.feed.post/abc123' as AtUri;

      await expect(
        indexRecord.handler({
          params: undefined,
          input: { uri: nonEprintUri },
          auth: null,
          c: mockContext,
        })
      ).rejects.toThrow('not supported for manual indexing');
    });

    it('returns error result when indexing fails', async () => {
      mockEprintService.indexEprint.mockResolvedValue({
        ok: false,
        error: new Error('Validation failed'),
      });

      const result = await indexRecord.handler({
        params: undefined,
        input: { uri: validUri },
        auth: null,
        c: mockContext,
      });

      expect(result.body.indexed).toBe(false);
      expect(result.body.error).toBe('Validation failed');
    });

    it('throws ValidationError for invalid AT URI', async () => {
      await expect(
        indexRecord.handler({
          params: undefined,
          input: { uri: 'not-a-valid-uri' as AtUri },
          auth: null,
          c: mockContext,
        })
      ).rejects.toThrow('Invalid AT URI format');
    });
  });
});
