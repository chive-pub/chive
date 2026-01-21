/**
 * Unit tests for XRPC endorsement handlers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { getSummary } from '@/api/handlers/xrpc/endorsement/getSummary.js';
import { getUserEndorsement } from '@/api/handlers/xrpc/endorsement/getUserEndorsement.js';
import { listForEprint } from '@/api/handlers/xrpc/endorsement/listForEprint.js';
import type { AtUri, DID } from '@/types/atproto.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

const createMockLogger = (): ILogger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
});

interface MockEndorsement {
  uri: AtUri;
  eprintUri: AtUri;
  endorser: DID;
  contributions: readonly string[];
  comment?: string;
  createdAt: Date;
}

interface MockEndorsementSummary {
  total: number;
  endorserCount: number;
  byType: Record<string, number>;
}

interface MockReviewService {
  getEndorsementSummary: ReturnType<typeof vi.fn>;
  getEndorsementByUser: ReturnType<typeof vi.fn>;
  listEndorsementsForEprint: ReturnType<typeof vi.fn>;
}

const createMockReviewService = (): MockReviewService => ({
  getEndorsementSummary: vi.fn(),
  getEndorsementByUser: vi.fn(),
  listEndorsementsForEprint: vi.fn(),
});

describe('XRPC Endorsement Handlers', () => {
  let mockLogger: ILogger;
  let mockReviewService: MockReviewService;
  let mockContext: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  };

  const mockUser = {
    did: 'did:plc:user123' as DID,
    handle: 'user.test',
  };

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockReviewService = createMockReviewService();

    mockContext = {
      get: vi.fn((key: string) => {
        switch (key) {
          case 'services':
            return {
              review: mockReviewService,
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
    };
  });

  describe('listForEprint', () => {
    it('returns paginated endorsements for an eprint', async () => {
      const endorsements: MockEndorsement[] = [
        {
          uri: 'at://did:plc:user1/pub.chive.review.endorsement/abc' as AtUri,
          eprintUri: 'at://did:plc:author/pub.chive.eprint.submission/xyz' as AtUri,
          endorser: 'did:plc:user1' as DID,
          contributions: ['methodological'],
          createdAt: new Date(),
        },
      ];

      const summary: MockEndorsementSummary = {
        total: 1,
        endorserCount: 1,
        byType: { methodological: 1, analytical: 1 },
      };

      mockReviewService.listEndorsementsForEprint.mockResolvedValue({
        items: endorsements,
        hasMore: false,
        total: 1,
      });
      mockReviewService.getEndorsementSummary.mockResolvedValue(summary);

      const result = await listForEprint.handler({
        params: { eprintUri: 'at://did:plc:author/pub.chive.eprint.submission/xyz', limit: 20 },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      expect(result.body.endorsements).toHaveLength(1);
      expect(result.body.summary).toMatchObject({
        total: 1,
        endorserCount: 1,
      });
      expect(result.body.hasMore).toBe(false);
    });

    it('handles pagination with cursor', async () => {
      mockReviewService.listEndorsementsForEprint.mockResolvedValue({
        items: [],
        hasMore: true,
        total: 50,
        cursor: '2024-01-15::at://...',
      });
      mockReviewService.getEndorsementSummary.mockResolvedValue({
        total: 50,
        endorserCount: 45,
        byType: {},
      });

      const result = await listForEprint.handler({
        params: { eprintUri: 'at://did:plc:author/pub.chive.eprint.submission/xyz', limit: 10 },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      expect(result.body.hasMore).toBe(true);
      expect(result.body.cursor).toBeDefined();
    });
  });

  describe('getSummary', () => {
    it('returns aggregated endorsement summary', async () => {
      const summary: MockEndorsementSummary = {
        total: 25,
        endorserCount: 20,
        byType: {
          methodological: 15,
          analytical: 10,
          theoretical: 8,
        },
      };
      mockReviewService.getEndorsementSummary.mockResolvedValue(summary);

      const result = await getSummary.handler({
        params: { eprintUri: 'at://did:plc:author/pub.chive.eprint.submission/xyz' },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      expect(result.body.total).toBe(25);
      expect(result.body.endorserCount).toBe(20);
      expect((result.body.byType as Record<string, number>).methodological).toBe(15);
    });
  });

  describe('getUserEndorsement', () => {
    it('returns user endorsement when exists', async () => {
      const endorsement: MockEndorsement = {
        uri: 'at://did:plc:user123/pub.chive.review.endorsement/abc' as AtUri,
        eprintUri: 'at://did:plc:author/pub.chive.eprint.submission/xyz' as AtUri,
        endorser: 'did:plc:user123' as DID,
        contributions: ['methodological'],
        comment: 'Excellent methodology',
        createdAt: new Date(),
      };
      mockReviewService.getEndorsementByUser.mockResolvedValue(endorsement);

      const result = await getUserEndorsement.handler({
        params: {
          eprintUri: 'at://did:plc:author/pub.chive.eprint.submission/xyz',
          userDid: 'did:plc:user123',
        },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      expect(result.body).toBeDefined();
      expect(result.body.contributions).toContain('methodological');
    });

    it('throws NotFoundError when user has not endorsed', async () => {
      mockReviewService.getEndorsementByUser.mockResolvedValue(null);

      await expect(
        getUserEndorsement.handler({
          params: {
            eprintUri: 'at://did:plc:author/pub.chive.eprint.submission/xyz',
            userDid: 'did:plc:nonendorser',
          },
          input: undefined,
          auth: null,
          c: mockContext as never,
        })
      ).rejects.toThrow();
    });
  });
});
