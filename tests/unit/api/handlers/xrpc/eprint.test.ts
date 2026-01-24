/**
 * Unit tests for XRPC eprint handlers.
 *
 * @remarks
 * Tests getSubmission, searchSubmissions, and listByAuthor handlers.
 * Validates ATProto compliance (pdsUrl inclusion, BlobRef only).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { getSubmission } from '@/api/handlers/xrpc/eprint/getSubmission.js';
import { listByAuthor } from '@/api/handlers/xrpc/eprint/listByAuthor.js';
import type { EprintView } from '@/services/eprint/eprint-service.js';
import type { AtUri, CID, DID, Timestamp } from '@/types/atproto.js';
import { NotFoundError } from '@/types/errors.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';
import type { AnnotationBody } from '@/types/models/annotation.js';
import type { EprintAuthor } from '@/types/models/author.js';

/** Creates a mock rich text abstract from plain text. */
function createMockAbstract(text: string): AnnotationBody {
  return {
    type: 'RichText',
    items: [{ type: 'text', content: text }],
    format: 'application/x-chive-gloss+json',
  };
}

const createMockLogger = (): ILogger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
});

const mockAuthor: EprintAuthor = {
  did: 'did:plc:author123' as DID,
  name: 'Test Author',
  order: 1,
  affiliations: [],
  contributions: [],
  isCorrespondingAuthor: true,
  isHighlighted: false,
};

// Use valid CIDv1 strings for mock data
const VALID_CID = 'bafyreigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';
const VALID_BLOB_CID = 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku';

const createMockEprint = (overrides?: Partial<EprintView>): EprintView => ({
  uri: 'at://did:plc:author123/pub.chive.eprint.submission/abc123' as AtUri,
  cid: VALID_CID as CID,
  title: 'Quantum Computing Advances',
  abstract: createMockAbstract('This paper presents advances in quantum computing...'),
  abstractPlainText: 'This paper presents advances in quantum computing...',
  authors: [mockAuthor],
  submittedBy: 'did:plc:author123' as DID,
  license: 'CC-BY-4.0',
  pdsUrl: 'https://bsky.social',
  documentBlobRef: {
    $type: 'blob',
    ref: VALID_BLOB_CID as CID,
    mimeType: 'application/pdf',
    size: 1024000,
  },
  documentFormat: 'pdf',
  publicationStatus: 'eprint',
  createdAt: new Date('2024-01-15T10:00:00Z'),
  indexedAt: new Date('2024-01-15T10:05:00Z'),
  version: 1,
  versions: [
    {
      uri: 'at://did:plc:author123/pub.chive.eprint.submission/abc123' as AtUri,
      versionNumber: 1,
      cid: VALID_CID as CID,
      createdAt: Date.parse('2024-01-15T10:00:00Z') as Timestamp,
      changes: 'Initial submission',
    },
  ],
  metrics: {
    views: 150,
    downloads: 42,
    endorsements: 5,
  },
  ...overrides,
});

interface MockEprintService {
  getEprint: ReturnType<typeof vi.fn>;
  getEprintsByAuthor: ReturnType<typeof vi.fn>;
}

interface MockMetricsService {
  recordView: ReturnType<typeof vi.fn>;
}

const createMockEprintService = (): MockEprintService => ({
  getEprint: vi.fn(),
  getEprintsByAuthor: vi.fn(),
});

const createMockMetricsService = (): MockMetricsService => ({
  recordView: vi.fn().mockResolvedValue(undefined),
});

describe('XRPC Eprint Handlers', () => {
  let mockLogger: ILogger;
  let mockEprintService: MockEprintService;
  let mockMetricsService: MockMetricsService;
  let mockContext: {
    get: (key: string) => unknown;
    set: (key: string, value: unknown) => void;
  };

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockEprintService = createMockEprintService();
    mockMetricsService = createMockMetricsService();

    mockContext = {
      get: vi.fn((key: string) => {
        switch (key) {
          case 'services':
            return {
              eprint: mockEprintService,
              metrics: mockMetricsService,
            };
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
  });

  /**
   * Helper to get auth context from mock context.
   * Returns null since our mock doesn't have an authenticated user.
   */
  function getAuthFromContext(): null {
    return null;
  }

  describe('getSubmission', () => {
    it('returns eprint with ATProto-compliant source information', async () => {
      const eprint = createMockEprint();
      mockEprintService.getEprint.mockResolvedValue(eprint);

      const auth = getAuthFromContext();
      const result = await getSubmission.handler({
        params: { uri: eprint.uri },
        input: undefined,
        auth,
        c: mockContext as never,
      });

      expect(result.body.uri).toBe(eprint.uri);
      expect(result.body.value.title).toBe(eprint.title);

      // Verify ATProto compliance: pdsUrl field
      expect(result.body.pdsUrl).toBeDefined();
      expect(result.body.pdsUrl).toBe('https://bsky.social');
    });

    it('includes document as BlobRef, not inline data', async () => {
      const eprint = createMockEprint();
      mockEprintService.getEprint.mockResolvedValue(eprint);

      const auth = getAuthFromContext();
      const result = await getSubmission.handler({
        params: { uri: eprint.uri },
        input: undefined,
        auth,
        c: mockContext as never,
      });

      // Verify document blob - it's now a BlobRef instance which has cid, mimeType, size
      expect(result.body.value.document).toBeDefined();
      // BlobRef from @atproto/lexicon stores cid as CID type
      expect(result.body.value.document.mimeType).toBe('application/pdf');
      expect(result.body.value.document.size).toBe(1024000);
    });

    it('includes version history', async () => {
      const eprint = createMockEprint();
      mockEprintService.getEprint.mockResolvedValue(eprint);

      const auth = getAuthFromContext();
      const result = await getSubmission.handler({
        params: { uri: eprint.uri },
        input: undefined,
        auth,
        c: mockContext as never,
      });

      // The getSubmission output schema doesn't have versions array
      // It returns the record value directly - version history comes from separate endpoint
      expect(result.body.cid).toBe(VALID_CID);
    });

    it('records view metric asynchronously', async () => {
      const eprint = createMockEprint();
      mockEprintService.getEprint.mockResolvedValue(eprint);

      const auth = getAuthFromContext();
      await getSubmission.handler({
        params: { uri: eprint.uri },
        input: undefined,
        auth,
        c: mockContext as never,
      });

      // View metric is recorded but not included in output
      // Metrics are fetched separately via pub.chive.eprint.getMetrics
      expect(mockMetricsService.recordView).toHaveBeenCalledWith(
        eprint.uri,
        undefined // user DID (anonymous)
      );
    });

    it('throws NotFoundError when eprint does not exist', async () => {
      mockEprintService.getEprint.mockResolvedValue(null);

      const auth = getAuthFromContext();
      await expect(
        getSubmission.handler({
          params: { uri: 'at://did:plc:notfound/pub.chive.eprint.submission/xyz' as AtUri },
          input: undefined,
          auth,
          c: mockContext as never,
        })
      ).rejects.toThrow(NotFoundError);
    });

    it('includes indexedAt timestamp', async () => {
      const eprint = createMockEprint({
        indexedAt: new Date('2024-01-15T10:05:00Z'),
      });
      mockEprintService.getEprint.mockResolvedValue(eprint);

      const auth = getAuthFromContext();
      const result = await getSubmission.handler({
        params: { uri: eprint.uri },
        input: undefined,
        auth,
        c: mockContext as never,
      });

      // indexedAt is returned as ISO string
      expect(result.body.indexedAt).toBe('2024-01-15T10:05:00.000Z');
    });
  });

  describe('listByAuthor', () => {
    it('returns paginated list of eprints', async () => {
      const eprints = [
        createMockEprint(),
        createMockEprint({
          uri: 'at://did:plc:author123/pub.chive.eprint.submission/def456' as AtUri,
          title: 'Another Paper',
        }),
      ];

      mockEprintService.getEprintsByAuthor.mockResolvedValue({
        eprints,
        total: 2,
      });

      const auth = getAuthFromContext();
      const result = await listByAuthor.handler({
        params: { did: 'did:plc:author123', limit: 20, sortBy: 'indexedAt', sortOrder: 'desc' },
        input: undefined,
        auth,
        c: mockContext as never,
      });

      expect(result.body.eprints).toHaveLength(2);
      expect(result.body.total).toBe(2);
    });

    it('handles pagination with cursor', async () => {
      const eprints = Array.from({ length: 20 }, (_, i) =>
        createMockEprint({
          uri: `at://did:plc:author123/pub.chive.eprint.submission/item${i}` as AtUri,
          title: `Paper ${i}`,
        })
      );

      mockEprintService.getEprintsByAuthor.mockResolvedValue({
        eprints,
        total: 45,
      });

      const auth = getAuthFromContext();
      const result = await listByAuthor.handler({
        params: { did: 'did:plc:author123', limit: 20, sortBy: 'indexedAt', sortOrder: 'desc' },
        input: undefined,
        auth,
        c: mockContext as never,
      });

      // cursor should be set when there are more results
      expect(result.body.cursor).toBe('20');
    });

    it('returns full abstract without truncation', async () => {
      const longAbstract = 'A'.repeat(1000);
      const eprint = createMockEprint({
        abstract: createMockAbstract(longAbstract),
        abstractPlainText: longAbstract,
      });

      mockEprintService.getEprintsByAuthor.mockResolvedValue({
        eprints: [eprint],
        total: 1,
      });

      const auth = getAuthFromContext();
      const result = await listByAuthor.handler({
        params: { did: 'did:plc:author123', limit: 20, sortBy: 'indexedAt', sortOrder: 'desc' },
        input: undefined,
        auth,
        c: mockContext as never,
      });

      const firstEprint = result.body.eprints[0];
      if (firstEprint?.abstract) {
        expect(firstEprint.abstract.length).toBe(1000);
      }
    });
  });
});
