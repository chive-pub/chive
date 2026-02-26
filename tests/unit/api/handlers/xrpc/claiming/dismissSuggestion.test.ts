/**
 * Unit tests for pub.chive.claiming.dismissSuggestion handler.
 *
 * @remarks
 * Tests the handler function directly with mocked context and services.
 * Follows industry standard coverage matrix:
 * - 200 OK: Authenticated user with valid input
 * - 400 Bad Request: Missing required fields
 * - 401 Unauthorized: Missing authentication
 * - 500 Internal Server Error: Service failure
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { dismissSuggestion } from '@/api/handlers/xrpc/claiming/dismissSuggestion.js';
import type { DID } from '@/types/atproto.js';
import { AuthenticationError, ValidationError } from '@/types/errors.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

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

interface MockClaimingService {
  dismissSuggestion: ReturnType<typeof vi.fn>;
}

const createMockClaimingService = (): MockClaimingService => ({
  dismissSuggestion: vi.fn().mockResolvedValue(undefined),
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
// TESTS
// =============================================================================

describe('dismissSuggestion', () => {
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
        dismissSuggestion.handler({
          params: undefined,
          input: { source: 'arxiv', externalId: '2401.12345' },
          auth: null,
          c: mockContext as never,
        })
      ).rejects.toThrow(AuthenticationError);

      await expect(
        dismissSuggestion.handler({
          params: undefined,
          input: { source: 'arxiv', externalId: '2401.12345' },
          auth: null,
          c: mockContext as never,
        })
      ).rejects.toThrow('Authentication required to dismiss suggestions');
    });
  });

  describe('input validation', () => {
    it('throws ValidationError when input is missing', async () => {
      const mockContext = createMockContext({
        user: createMockUser(),
        claimingService: mockClaimingService,
        logger: mockLogger,
      });

      await expect(
        dismissSuggestion.handler({
          params: undefined,
          input: undefined as never,
          auth: { did: 'did:plc:testuser123', iss: 'did:plc:testuser123' },
          c: mockContext as never,
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        dismissSuggestion.handler({
          params: undefined,
          input: undefined as never,
          auth: { did: 'did:plc:testuser123', iss: 'did:plc:testuser123' },
          c: mockContext as never,
        })
      ).rejects.toThrow('Input is required');
    });

    it('throws ValidationError when source is missing', async () => {
      const mockContext = createMockContext({
        user: createMockUser(),
        claimingService: mockClaimingService,
        logger: mockLogger,
      });

      await expect(
        dismissSuggestion.handler({
          params: undefined,
          input: { source: '', externalId: '2401.12345' },
          auth: { did: 'did:plc:testuser123', iss: 'did:plc:testuser123' },
          c: mockContext as never,
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        dismissSuggestion.handler({
          params: undefined,
          input: { source: '', externalId: '2401.12345' },
          auth: { did: 'did:plc:testuser123', iss: 'did:plc:testuser123' },
          c: mockContext as never,
        })
      ).rejects.toThrow('Both source and externalId are required');
    });

    it('throws ValidationError when externalId is missing', async () => {
      const mockContext = createMockContext({
        user: createMockUser(),
        claimingService: mockClaimingService,
        logger: mockLogger,
      });

      await expect(
        dismissSuggestion.handler({
          params: undefined,
          input: { source: 'arxiv', externalId: '' },
          auth: { did: 'did:plc:testuser123', iss: 'did:plc:testuser123' },
          c: mockContext as never,
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        dismissSuggestion.handler({
          params: undefined,
          input: { source: 'arxiv', externalId: '' },
          auth: { did: 'did:plc:testuser123', iss: 'did:plc:testuser123' },
          c: mockContext as never,
        })
      ).rejects.toThrow('Both source and externalId are required');
    });
  });

  describe('successful dismissal', () => {
    it('calls claimingService.dismissSuggestion with correct params', async () => {
      const mockContext = createMockContext({
        user: createMockUser({ did: 'did:plc:caller789' as DID }),
        claimingService: mockClaimingService,
        logger: mockLogger,
      });

      await dismissSuggestion.handler({
        params: undefined,
        input: { source: 'semanticscholar', externalId: 'paper456' },
        auth: { did: 'did:plc:caller789', iss: 'did:plc:caller789' },
        c: mockContext as never,
      });

      expect(mockClaimingService.dismissSuggestion).toHaveBeenCalledWith(
        'did:plc:caller789',
        'semanticscholar',
        'paper456'
      );
    });

    it('returns { success: true } on successful dismissal', async () => {
      const mockContext = createMockContext({
        user: createMockUser(),
        claimingService: mockClaimingService,
        logger: mockLogger,
      });

      const result = await dismissSuggestion.handler({
        params: undefined,
        input: { source: 'arxiv', externalId: '2401.12345' },
        auth: { did: 'did:plc:testuser123', iss: 'did:plc:testuser123' },
        c: mockContext as never,
      });

      expect(result.encoding).toBe('application/json');
      expect(result.body).toEqual({ success: true });
    });
  });

  describe('logging', () => {
    it('logs debug message before dismissal and info after', async () => {
      const mockContext = createMockContext({
        user: createMockUser({ did: 'did:plc:logtest' as DID }),
        claimingService: mockClaimingService,
        logger: mockLogger,
      });

      await dismissSuggestion.handler({
        params: undefined,
        input: { source: 'biorxiv', externalId: '2024.01.15.123456' },
        auth: { did: 'did:plc:logtest', iss: 'did:plc:logtest' },
        c: mockContext as never,
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Dismissing suggestion',
        expect.objectContaining({
          did: 'did:plc:logtest',
          source: 'biorxiv',
          externalId: '2024.01.15.123456',
        })
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Suggestion dismissed',
        expect.objectContaining({
          did: 'did:plc:logtest',
          source: 'biorxiv',
          externalId: '2024.01.15.123456',
        })
      );
    });
  });

  describe('error handling', () => {
    it('propagates service errors', async () => {
      const serviceError = new Error('Database connection lost');
      mockClaimingService.dismissSuggestion.mockRejectedValue(serviceError);

      const mockContext = createMockContext({
        user: createMockUser(),
        claimingService: mockClaimingService,
        logger: mockLogger,
      });

      await expect(
        dismissSuggestion.handler({
          params: undefined,
          input: { source: 'arxiv', externalId: '2401.99999' },
          auth: { did: 'did:plc:testuser123', iss: 'did:plc:testuser123' },
          c: mockContext as never,
        })
      ).rejects.toThrow('Database connection lost');
    });
  });

  describe('different source types', () => {
    const testCases = [
      { source: 'arxiv', externalId: '2401.12345', description: 'arXiv paper' },
      { source: 'semanticscholar', externalId: 'abc123def', description: 'Semantic Scholar' },
      { source: 'openalex', externalId: 'W1234567890', description: 'OpenAlex work' },
      { source: 'biorxiv', externalId: '2024.01.15.123456', description: 'bioRxiv eprint' },
    ];

    for (const { source, externalId, description } of testCases) {
      it(`handles ${description} (source: ${source})`, async () => {
        const mockContext = createMockContext({
          user: createMockUser(),
          claimingService: mockClaimingService,
          logger: mockLogger,
        });

        const result = await dismissSuggestion.handler({
          params: undefined,
          input: { source, externalId },
          auth: { did: 'did:plc:testuser123', iss: 'did:plc:testuser123' },
          c: mockContext as never,
        });

        expect(result.body.success).toBe(true);
        expect(mockClaimingService.dismissSuggestion).toHaveBeenCalledWith(
          'did:plc:testuser123',
          source,
          externalId
        );
      });
    }
  });
});
