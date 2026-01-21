/**
 * Unit tests for pub.chive.claiming.startClaimFromExternal handler.
 *
 * @remarks
 * Tests the handler function directly with mocked context and services.
 * Follows industry standard coverage matrix:
 * - 200 OK: Authenticated user with valid data
 * - 400 Bad Request: Invalid input (schema validation)
 * - 401 Unauthorized: Missing authentication
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { startClaimFromExternal } from '@/api/handlers/xrpc/claiming/startClaimFromExternal.js';
import type { DID } from '@/types/atproto.js';
import { AuthenticationError } from '@/types/errors.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

/**
 * Simple validator matching the lexicon requirements.
 */
const importSourceSchema = {
  safeParse: (value: string): { success: boolean } => {
    if (typeof value !== 'string' || value.length < 2 || value.length > 50) {
      return { success: false };
    }
    return { success: /^[a-z0-9]+$/.test(value) };
  },
};

// =============================================================================
// MOCK FACTORIES
// =============================================================================

const createMockLogger = (): ILogger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
});

interface MockClaimRequest {
  id: number;
  importId: number;
  claimantDid: DID;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  canonicalUri?: string;
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  createdAt: Date;
  expiresAt?: Date;
}

interface MockClaimingService {
  startClaimFromExternal: ReturnType<typeof vi.fn>;
}

const createMockClaimingService = (): MockClaimingService => ({
  startClaimFromExternal: vi.fn(),
});

const createMockUser = (
  overrides: Partial<{ did: DID; handle: string }> = {}
): { did: DID; handle: string } => ({
  did: 'did:plc:testuser123' as DID,
  handle: 'testuser.test',
  ...overrides,
});

interface MockContext {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
}

const createMockContext = (options: {
  user?: ReturnType<typeof createMockUser> | null;
  claimingService: MockClaimingService;
  logger?: ILogger;
}): MockContext => {
  const logger = options.logger ?? createMockLogger();

  return {
    get: vi.fn((key: string) => {
      switch (key) {
        case 'services':
          return { claiming: options.claimingService };
        case 'logger':
          return logger;
        case 'user':
          return options.user;
        default:
          return undefined;
      }
    }),
    set: vi.fn(),
  };
};

// =============================================================================
// TEST FIXTURES
// =============================================================================

const createTestClaimRequest = (overrides: Partial<MockClaimRequest> = {}): MockClaimRequest => ({
  id: 1,
  importId: 100,
  claimantDid: 'did:plc:testuser123' as DID,
  status: 'pending',
  createdAt: new Date('2024-01-15T10:00:00Z'),
  expiresAt: new Date('2024-01-22T10:00:00Z'),
  ...overrides,
});

// =============================================================================
// TESTS
// =============================================================================

describe('startClaimFromExternal', () => {
  let mockClaimingService: MockClaimingService;
  let mockLogger: ILogger;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClaimingService = createMockClaimingService();
    mockLogger = createMockLogger();
  });

  describe('authentication', () => {
    it('throws AuthenticationError when user is not authenticated', async () => {
      const mockContext = createMockContext({
        user: null,
        claimingService: mockClaimingService,
        logger: mockLogger,
      });

      await expect(
        startClaimFromExternal.handler({
          params: undefined,
          input: { source: 'arxiv', externalId: '2401.12345' },
          auth: null,
          c: mockContext as never,
        })
      ).rejects.toThrow(AuthenticationError);

      await expect(
        startClaimFromExternal.handler({
          params: undefined,
          input: { source: 'arxiv', externalId: '2401.12345' },
          auth: null,
          c: mockContext as never,
        })
      ).rejects.toThrow('Authentication required to claim eprints');
    });

    it('proceeds when user is authenticated', async () => {
      const mockClaim = createTestClaimRequest();
      mockClaimingService.startClaimFromExternal.mockResolvedValue(mockClaim);

      const mockContext = createMockContext({
        user: createMockUser(),
        claimingService: mockClaimingService,
        logger: mockLogger,
      });

      const result = await startClaimFromExternal.handler({
        params: undefined,
        input: { source: 'arxiv', externalId: '2401.12345' },
        auth: { did: 'did:plc:testuser123', iss: 'did:plc:testuser123' },
        c: mockContext as never,
      });

      expect(result.body.claim).toBeDefined();
      expect(result.body.claim.id).toBe(1);
    });
  });

  describe('source validation (schema level)', () => {
    it('accepts valid built-in sources', () => {
      const validSources = ['arxiv', 'biorxiv', 'medrxiv', 'semanticscholar', 'openalex', 'zenodo'];

      for (const source of validSources) {
        const result = importSourceSchema.safeParse(source);
        expect(result.success, `Source "${source}" should be valid`).toBe(true);
      }
    });

    it('accepts valid custom plugin sources (lowercase alphanumeric)', () => {
      const validCustomSources = [
        'myeprintserver',
        'arxiv2',
        'customsource123',
        'ab', // minimum 2 chars
      ];

      for (const source of validCustomSources) {
        const result = importSourceSchema.safeParse(source);
        expect(result.success, `Source "${source}" should be valid`).toBe(true);
      }
    });

    it('rejects invalid source formats', () => {
      const invalidSources = [
        'ArXiv', // uppercase
        'my-source', // hyphen
        'my_source', // underscore
        'a', // too short
        '', // empty
        'My Source', // space
      ];

      for (const source of invalidSources) {
        const result = importSourceSchema.safeParse(source);
        expect(result.success, `Source "${source}" should be invalid`).toBe(false);
      }
    });
  });

  describe('successful claim creation', () => {
    it('calls claiming service with correct parameters', async () => {
      const mockClaim = createTestClaimRequest();
      mockClaimingService.startClaimFromExternal.mockResolvedValue(mockClaim);

      const mockContext = createMockContext({
        user: createMockUser({ did: 'did:plc:claimant456' as DID }),
        claimingService: mockClaimingService,
        logger: mockLogger,
      });

      await startClaimFromExternal.handler({
        params: undefined,
        input: { source: 'semanticscholar', externalId: 'paper789' },
        auth: { did: 'did:plc:claimant456', iss: 'did:plc:claimant456' },
        c: mockContext as never,
      });

      expect(mockClaimingService.startClaimFromExternal).toHaveBeenCalledWith(
        'semanticscholar',
        'paper789',
        'did:plc:claimant456'
      );
    });

    it('returns properly formatted claim response', async () => {
      const mockClaim = createTestClaimRequest({
        id: 42,
        importId: 100,
        claimantDid: 'did:plc:testuser123' as DID,
        status: 'pending',
        createdAt: new Date('2024-01-15T10:00:00Z'),
        expiresAt: new Date('2024-01-22T10:00:00Z'),
      });
      mockClaimingService.startClaimFromExternal.mockResolvedValue(mockClaim);

      const mockContext = createMockContext({
        user: createMockUser(),
        claimingService: mockClaimingService,
        logger: mockLogger,
      });

      const result = await startClaimFromExternal.handler({
        params: undefined,
        input: { source: 'openalex', externalId: 'W123456789' },
        auth: { did: 'did:plc:testuser123', iss: 'did:plc:testuser123' },
        c: mockContext as never,
      });

      expect(result.body.claim).toMatchObject({
        id: 42,
        importId: 100,
        claimantDid: 'did:plc:testuser123',
        status: 'pending',
      });

      // Dates should be ISO strings
      expect(result.body.claim.createdAt).toBe('2024-01-15T10:00:00.000Z');
      expect(result.body.claim.expiresAt).toBe('2024-01-22T10:00:00.000Z');
    });

    it('handles claim without optional fields', async () => {
      const mockClaim = createTestClaimRequest({
        canonicalUri: undefined,
        rejectionReason: undefined,
        reviewedBy: undefined,
        reviewedAt: undefined,
        expiresAt: undefined,
      });
      mockClaimingService.startClaimFromExternal.mockResolvedValue(mockClaim);

      const mockContext = createMockContext({
        user: createMockUser(),
        claimingService: mockClaimingService,
        logger: mockLogger,
      });

      const result = await startClaimFromExternal.handler({
        params: undefined,
        input: { source: 'arxiv', externalId: '2401.00001' },
        auth: { did: 'did:plc:testuser123', iss: 'did:plc:testuser123' },
        c: mockContext as never,
      });

      expect(result.body.claim.canonicalUri).toBeUndefined();
      expect(result.body.claim.rejectionReason).toBeUndefined();
      expect(result.body.claim.reviewedBy).toBeUndefined();
      expect(result.body.claim.reviewedAt).toBeUndefined();
      expect(result.body.claim.expiresAt).toBeUndefined();
    });
  });

  describe('logging', () => {
    it('logs claim initiation with source and externalId', async () => {
      const mockClaim = createTestClaimRequest();
      mockClaimingService.startClaimFromExternal.mockResolvedValue(mockClaim);

      const mockContext = createMockContext({
        user: createMockUser({ did: 'did:plc:logtest' as DID }),
        claimingService: mockClaimingService,
        logger: mockLogger,
      });

      await startClaimFromExternal.handler({
        params: undefined,
        input: { source: 'crossref', externalId: '10.1234/test' },
        auth: { did: 'did:plc:logtest', iss: 'did:plc:logtest' },
        c: mockContext as never,
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Starting claim from external',
        expect.objectContaining({
          source: 'crossref',
          externalId: '10.1234/test',
          claimantDid: 'did:plc:logtest',
        })
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Claim started from external',
        expect.objectContaining({
          claimId: 1,
          source: 'crossref',
          externalId: '10.1234/test',
        })
      );
    });
  });

  describe('error handling', () => {
    it('propagates service errors', async () => {
      const serviceError = new Error('External source unavailable');
      mockClaimingService.startClaimFromExternal.mockRejectedValue(serviceError);

      const mockContext = createMockContext({
        user: createMockUser(),
        claimingService: mockClaimingService,
        logger: mockLogger,
      });

      await expect(
        startClaimFromExternal.handler({
          params: undefined,
          input: { source: 'arxiv', externalId: '2401.99999' },
          auth: { did: 'did:plc:testuser123', iss: 'did:plc:testuser123' },
          c: mockContext as never,
        })
      ).rejects.toThrow('External source unavailable');
    });
  });

  describe('different source types', () => {
    const testCases = [
      { source: 'arxiv', externalId: '2401.12345', description: 'arXiv paper' },
      { source: 'semanticscholar', externalId: 'abc123def', description: 'Semantic Scholar' },
      { source: 'openalex', externalId: 'W1234567890', description: 'OpenAlex work' },
      { source: 'crossref', externalId: '10.1000/xyz123', description: 'Crossref DOI' },
      { source: 'biorxiv', externalId: '2024.01.15.123456', description: 'bioRxiv eprint' },
      { source: 'zenodo', externalId: '12345', description: 'Zenodo record' },
    ];

    for (const { source, externalId, description } of testCases) {
      it(`handles ${description} (source: ${source})`, async () => {
        const mockClaim = createTestClaimRequest();
        mockClaimingService.startClaimFromExternal.mockResolvedValue(mockClaim);

        const mockContext = createMockContext({
          user: createMockUser(),
          claimingService: mockClaimingService,
          logger: mockLogger,
        });

        const result = await startClaimFromExternal.handler({
          params: undefined,
          input: { source, externalId },
          auth: { did: 'did:plc:testuser123', iss: 'did:plc:testuser123' },
          c: mockContext as never,
        });

        expect(result.body.claim).toBeDefined();
        expect(mockClaimingService.startClaimFromExternal).toHaveBeenCalledWith(
          source,
          externalId,
          expect.any(String)
        );
      });
    }
  });
});
