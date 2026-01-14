/**
 * Unit tests for XRPC endorsement handlers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { getSummaryHandler } from '@/api/handlers/xrpc/endorsement/getSummary.js';
import { getUserEndorsementHandler } from '@/api/handlers/xrpc/endorsement/getUserEndorsement.js';
import { listForEprintHandler } from '@/api/handlers/xrpc/endorsement/listForEprint.js';
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
  endorsementType: 'methods' | 'results' | 'overall';
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

  describe('listForEprintHandler', () => {
    it('returns paginated endorsements for an eprint', async () => {
      const endorsements: MockEndorsement[] = [
        {
          uri: 'at://did:plc:user1/pub.chive.review.endorsement/abc' as AtUri,
          eprintUri: 'at://did:plc:author/pub.chive.eprint.submission/xyz' as AtUri,
          endorser: 'did:plc:user1' as DID,
          endorsementType: 'methods',
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

      const result = await listForEprintHandler(
        mockContext as unknown as Parameters<typeof listForEprintHandler>[0],
        { eprintUri: 'at://did:plc:author/pub.chive.eprint.submission/xyz', limit: 20 }
      );

      expect(result.endorsements).toHaveLength(1);
      expect(result.summary).toMatchObject({
        total: 1,
        endorserCount: 1,
      });
      expect(result.hasMore).toBe(false);
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

      const result = await listForEprintHandler(
        mockContext as unknown as Parameters<typeof listForEprintHandler>[0],
        { eprintUri: 'at://did:plc:author/pub.chive.eprint.submission/xyz', limit: 10 }
      );

      expect(result.hasMore).toBe(true);
      expect(result.cursor).toBeDefined();
    });
  });

  describe('getSummaryHandler', () => {
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

      const result = await getSummaryHandler(
        mockContext as unknown as Parameters<typeof getSummaryHandler>[0],
        { eprintUri: 'at://did:plc:author/pub.chive.eprint.submission/xyz' }
      );

      expect(result.total).toBe(25);
      expect(result.endorserCount).toBe(20);
      expect(result.byType.methodological).toBe(15);
    });
  });

  describe('getUserEndorsementHandler', () => {
    it('returns user endorsement when exists', async () => {
      const endorsement: MockEndorsement = {
        uri: 'at://did:plc:user123/pub.chive.review.endorsement/abc' as AtUri,
        eprintUri: 'at://did:plc:author/pub.chive.eprint.submission/xyz' as AtUri,
        endorser: 'did:plc:user123' as DID,
        endorsementType: 'methods',
        comment: 'Excellent methodology',
        createdAt: new Date(),
      };
      mockReviewService.getEndorsementByUser.mockResolvedValue(endorsement);

      const result = await getUserEndorsementHandler(
        mockContext as unknown as Parameters<typeof getUserEndorsementHandler>[0],
        {
          eprintUri: 'at://did:plc:author/pub.chive.eprint.submission/xyz',
          userDid: 'did:plc:user123',
        }
      );

      expect(result).toBeDefined();
      expect(result.contributions).toContain('methodological');
    });

    it('throws NotFoundError when user has not endorsed', async () => {
      mockReviewService.getEndorsementByUser.mockResolvedValue(null);

      await expect(
        getUserEndorsementHandler(
          mockContext as unknown as Parameters<typeof getUserEndorsementHandler>[0],
          {
            eprintUri: 'at://did:plc:author/pub.chive.eprint.submission/xyz',
            userDid: 'did:plc:nonendorser',
          }
        )
      ).rejects.toThrow();
    });
  });
});
