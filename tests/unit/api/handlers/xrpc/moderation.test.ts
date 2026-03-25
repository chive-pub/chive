/**
 * Unit tests for XRPC moderation handlers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createReport } from '@/api/handlers/xrpc/moderation/createReport.js';
import { AuthenticationError, ValidationError } from '@/types/errors.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

import { TEST_USER_DIDS } from '../../../../test-constants.js';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const createMockLogger = (): ILogger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: () => createMockLogger(),
});

const USER_DID = TEST_USER_DIDS.USER_1;
const TARGET_URI = 'at://did:plc:author/pub.chive.eprint.submission/abc';
const TARGET_COLLECTION = 'pub.chive.eprint.submission';

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('XRPC Moderation Handlers', () => {
  let mockLogger: ILogger;
  let mockContentReportService: {
    createReport: ReturnType<typeof vi.fn>;
  };

  const authenticatedUser = { did: USER_DID, handle: 'user.test', isAdmin: false };

  function buildContext(user: typeof authenticatedUser | { did: undefined } | null): {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  } {
    return {
      get: vi.fn((key: string) => {
        switch (key) {
          case 'user':
            return user;
          case 'services':
            return {
              contentReport: mockContentReportService,
            };
          case 'logger':
            return mockLogger;
          default:
            return undefined;
        }
      }),
      set: vi.fn(),
    };
  }

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockContentReportService = {
      createReport: vi.fn().mockResolvedValue({ id: 1 }),
    };
  });

  // ---------------------------------------------------------------------------
  // createReport
  // ---------------------------------------------------------------------------

  describe('createReport', () => {
    const validInput = {
      targetUri: TARGET_URI,
      targetCollection: TARGET_COLLECTION,
      reason: 'spam' as const,
    };

    it('returns success with report ID on valid input', async () => {
      mockContentReportService.createReport.mockResolvedValueOnce({ id: 42 });
      const c = buildContext(authenticatedUser);

      const result = await createReport.handler({
        input: validInput,
        c: c as never,
        params: undefined as never,
        auth: null,
      });

      expect(result.encoding).toBe('application/json');
      expect(result.body.success).toBe(true);
      expect(result.body.id).toBe(42);
    });

    it('throws AuthenticationError when no user', async () => {
      const c = buildContext(null);

      await expect(
        createReport.handler({
          input: validInput,
          c: c as never,
          params: undefined as never,
          auth: null,
        })
      ).rejects.toThrow(AuthenticationError);
    });

    it('throws AuthenticationError when user has no DID', async () => {
      const c = buildContext({ did: undefined });

      await expect(
        createReport.handler({
          input: validInput,
          c: c as never,
          params: undefined as never,
          auth: null,
        })
      ).rejects.toThrow(AuthenticationError);
    });

    it('throws ValidationError when targetUri is missing', async () => {
      const c = buildContext(authenticatedUser);

      await expect(
        createReport.handler({
          input: { ...validInput, targetUri: '' } as never,
          c: c as never,
          params: undefined as never,
          auth: null,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError when targetCollection is missing', async () => {
      const c = buildContext(authenticatedUser);

      await expect(
        createReport.handler({
          input: { ...validInput, targetCollection: '' } as never,
          c: c as never,
          params: undefined as never,
          auth: null,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError when reason is missing', async () => {
      const c = buildContext(authenticatedUser);

      await expect(
        createReport.handler({
          input: { ...validInput, reason: '' } as never,
          c: c as never,
          params: undefined as never,
          auth: null,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError for invalid reason value', async () => {
      const c = buildContext(authenticatedUser);

      await expect(
        createReport.handler({
          input: { ...validInput, reason: 'invalid-reason' } as never,
          c: c as never,
          params: undefined as never,
          auth: null,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError when contentReport service is not configured', async () => {
      const c = {
        get: vi.fn((key: string) => {
          switch (key) {
            case 'user':
              return authenticatedUser;
            case 'services':
              return { contentReport: null };
            case 'logger':
              return mockLogger;
            default:
              return undefined;
          }
        }),
        set: vi.fn(),
      };

      await expect(
        createReport.handler({
          input: validInput,
          c: c as never,
          params: undefined as never,
          auth: null,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('passes correct fields to createReport service method', async () => {
      mockContentReportService.createReport.mockResolvedValueOnce({ id: 1 });
      const c = buildContext(authenticatedUser);

      await createReport.handler({
        input: validInput,
        c: c as never,
        params: undefined as never,
        auth: null,
      });

      expect(mockContentReportService.createReport).toHaveBeenCalledWith({
        reporterDid: USER_DID,
        targetUri: TARGET_URI,
        targetCollection: TARGET_COLLECTION,
        reason: 'spam',
        description: undefined,
      });
    });

    it('includes optional description when provided', async () => {
      mockContentReportService.createReport.mockResolvedValueOnce({ id: 1 });
      const c = buildContext(authenticatedUser);

      await createReport.handler({
        input: { ...validInput, description: 'Contains spam links' },
        c: c as never,
        params: undefined as never,
        auth: null,
      });

      expect(mockContentReportService.createReport).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Contains spam links',
        })
      );
    });

    it('omits description when not provided', async () => {
      mockContentReportService.createReport.mockResolvedValueOnce({ id: 1 });
      const c = buildContext(authenticatedUser);

      await createReport.handler({
        input: validInput,
        c: c as never,
        params: undefined as never,
        auth: null,
      });

      const callArgs = mockContentReportService.createReport.mock.calls[0]?.[0] as
        | Record<string, unknown>
        | undefined;
      expect(callArgs?.description).toBeUndefined();
    });
  });
});
