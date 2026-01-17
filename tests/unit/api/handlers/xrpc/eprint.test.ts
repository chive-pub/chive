/**
 * Unit tests for XRPC eprint handlers.
 *
 * @remarks
 * Tests getSubmission, searchSubmissions, and listByAuthor handlers.
 * Validates ATProto compliance (pdsUrl inclusion, BlobRef only).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { getSubmissionHandler } from '@/api/handlers/xrpc/eprint/getSubmission.js';
import { listByAuthorHandler } from '@/api/handlers/xrpc/eprint/listByAuthor.js';
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

const createMockEprint = (overrides?: Partial<EprintView>): EprintView => ({
  uri: 'at://did:plc:author123/pub.chive.eprint.submission/abc123' as AtUri,
  cid: 'bafyreiabc123' as CID,
  title: 'Quantum Computing Advances',
  abstract: createMockAbstract('This paper presents advances in quantum computing...'),
  abstractPlainText: 'This paper presents advances in quantum computing...',
  authors: [mockAuthor],
  submittedBy: 'did:plc:author123' as DID,
  license: 'CC-BY-4.0',
  pdsUrl: 'https://bsky.social',
  documentBlobRef: {
    $type: 'blob',
    ref: 'bafkreipdf123' as CID,
    mimeType: 'application/pdf',
    size: 1024000,
  },
  documentFormat: 'pdf',
  publicationStatus: 'eprint',
  createdAt: new Date('2024-01-15T10:00:00Z'),
  indexedAt: new Date('2024-01-15T10:05:00Z'),
  versions: [
    {
      uri: 'at://did:plc:author123/pub.chive.eprint.submission/abc123' as AtUri,
      versionNumber: 1,
      cid: 'bafyreiabc123' as CID,
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
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
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
            return undefined;
          default:
            return undefined;
        }
      }),
      set: vi.fn(),
    };
  });

  describe('getSubmissionHandler', () => {
    it('returns eprint with ATProto-compliant source information', async () => {
      const eprint = createMockEprint();
      mockEprintService.getEprint.mockResolvedValue(eprint);

      const result = await getSubmissionHandler(
        mockContext as unknown as Parameters<typeof getSubmissionHandler>[0],
        { uri: eprint.uri }
      );

      expect(result.uri).toBe(eprint.uri);
      expect(result.title).toBe(eprint.title);

      // Verify ATProto compliance: source field
      expect(result.source).toBeDefined();
      expect(result.source.pdsEndpoint).toBe('https://bsky.social');
      expect(result.source.recordUrl).toContain('com.atproto.repo.getRecord');
      expect(result.source.blobUrl).toContain('com.atproto.sync.getBlob');
      expect(result.source.lastVerifiedAt).toBeDefined();
      expect(typeof result.source.stale).toBe('boolean');
    });

    it('includes document as BlobRef, not inline data', async () => {
      const eprint = createMockEprint();
      mockEprintService.getEprint.mockResolvedValue(eprint);

      const result = await getSubmissionHandler(
        mockContext as unknown as Parameters<typeof getSubmissionHandler>[0],
        { uri: eprint.uri }
      );

      // Verify BlobRef structure
      expect(result.document).toMatchObject({
        $type: 'blob',
        ref: 'bafkreipdf123',
        mimeType: 'application/pdf',
        size: 1024000,
      });
    });

    it('includes version history', async () => {
      const eprint = createMockEprint();
      mockEprintService.getEprint.mockResolvedValue(eprint);

      const result = await getSubmissionHandler(
        mockContext as unknown as Parameters<typeof getSubmissionHandler>[0],
        { uri: eprint.uri }
      );

      expect(result.versions).toHaveLength(1);
      const firstVersion = result.versions?.[0];
      if (firstVersion) {
        expect(firstVersion).toMatchObject({
          version: 1,
          cid: 'bafyreiabc123',
          changelog: 'Initial submission',
        });
      }
    });

    it('includes metrics when available', async () => {
      const eprint = createMockEprint();
      mockEprintService.getEprint.mockResolvedValue(eprint);

      const result = await getSubmissionHandler(
        mockContext as unknown as Parameters<typeof getSubmissionHandler>[0],
        { uri: eprint.uri }
      );

      expect(result.metrics).toMatchObject({
        views: 150,
        downloads: 42,
        endorsements: 5,
      });
    });

    it('throws NotFoundError when eprint does not exist', async () => {
      mockEprintService.getEprint.mockResolvedValue(null);

      await expect(
        getSubmissionHandler(mockContext as unknown as Parameters<typeof getSubmissionHandler>[0], {
          uri: 'at://did:plc:notfound/pub.chive.eprint.submission/xyz' as AtUri,
        })
      ).rejects.toThrow(NotFoundError);
    });

    it('records view metric asynchronously', async () => {
      const eprint = createMockEprint();
      mockEprintService.getEprint.mockResolvedValue(eprint);

      await getSubmissionHandler(
        mockContext as unknown as Parameters<typeof getSubmissionHandler>[0],
        { uri: eprint.uri }
      );

      expect(mockMetricsService.recordView).toHaveBeenCalledWith(
        eprint.uri,
        undefined // user DID (anonymous)
      );
    });

    it('marks eprint as stale if indexed > 7 days ago', async () => {
      const eprint = createMockEprint({
        indexedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
      });
      mockEprintService.getEprint.mockResolvedValue(eprint);

      const result = await getSubmissionHandler(
        mockContext as unknown as Parameters<typeof getSubmissionHandler>[0],
        { uri: eprint.uri }
      );

      expect(result.source.stale).toBe(true);
    });

    it('marks eprint as fresh if indexed within 7 days', async () => {
      const eprint = createMockEprint({
        indexedAt: new Date(), // Now
      });
      mockEprintService.getEprint.mockResolvedValue(eprint);

      const result = await getSubmissionHandler(
        mockContext as unknown as Parameters<typeof getSubmissionHandler>[0],
        { uri: eprint.uri }
      );

      expect(result.source.stale).toBe(false);
    });
  });

  describe('listByAuthorHandler', () => {
    it('returns paginated list with ATProto-compliant source info', async () => {
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

      const result = await listByAuthorHandler(
        mockContext as unknown as Parameters<typeof listByAuthorHandler>[0],
        { did: 'did:plc:author123', limit: 20, sort: 'date' }
      );

      expect(result.eprints).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.hasMore).toBe(false);

      // Each eprint should have source info
      for (const p of result.eprints) {
        expect(p.source).toBeDefined();
        expect(p.source.pdsEndpoint).toBe('https://bsky.social');
      }
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

      const result = await listByAuthorHandler(
        mockContext as unknown as Parameters<typeof listByAuthorHandler>[0],
        { did: 'did:plc:author123', limit: 20, sort: 'date' }
      );

      expect(result.hasMore).toBe(true);
      expect(result.cursor).toBe('20');
    });

    it('truncates abstract to 500 characters', async () => {
      const longAbstract = 'A'.repeat(1000);
      const eprint = createMockEprint({
        abstract: createMockAbstract(longAbstract),
        abstractPlainText: longAbstract,
      });

      mockEprintService.getEprintsByAuthor.mockResolvedValue({
        eprints: [eprint],
        total: 1,
      });

      const result = await listByAuthorHandler(
        mockContext as unknown as Parameters<typeof listByAuthorHandler>[0],
        { did: 'did:plc:author123', limit: 20, sort: 'date' }
      );

      const firstEprint = result.eprints[0];
      if (firstEprint) {
        expect(firstEprint.abstract.length).toBe(500);
      }
    });
  });
});
