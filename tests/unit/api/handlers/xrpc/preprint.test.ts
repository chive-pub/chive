/**
 * Unit tests for XRPC preprint handlers.
 *
 * @remarks
 * Tests getSubmission, searchSubmissions, and listByAuthor handlers.
 * Validates ATProto compliance (pdsUrl inclusion, BlobRef only).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { getSubmissionHandler } from '@/api/handlers/xrpc/preprint/getSubmission.js';
import { listByAuthorHandler } from '@/api/handlers/xrpc/preprint/listByAuthor.js';
import type { PreprintView } from '@/services/preprint/preprint-service.js';
import type { AtUri, CID, DID, Timestamp } from '@/types/atproto.js';
import { NotFoundError } from '@/types/errors.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';
import type { PreprintAuthor } from '@/types/models/author.js';

const createMockLogger = (): ILogger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
});

const mockAuthor: PreprintAuthor = {
  did: 'did:plc:author123' as DID,
  name: 'Test Author',
  order: 1,
  affiliations: [],
  contributions: [],
  isCorrespondingAuthor: true,
  isHighlighted: false,
};

const createMockPreprint = (overrides?: Partial<PreprintView>): PreprintView => ({
  uri: 'at://did:plc:author123/pub.chive.preprint.submission/abc123' as AtUri,
  cid: 'bafyreiabc123' as CID,
  title: 'Quantum Computing Advances',
  abstract: 'This paper presents advances in quantum computing...',
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
  publicationStatus: 'preprint',
  createdAt: new Date('2024-01-15T10:00:00Z'),
  indexedAt: new Date('2024-01-15T10:05:00Z'),
  versions: [
    {
      uri: 'at://did:plc:author123/pub.chive.preprint.submission/abc123' as AtUri,
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

interface MockPreprintService {
  getPreprint: ReturnType<typeof vi.fn>;
  getPreprintsByAuthor: ReturnType<typeof vi.fn>;
}

interface MockMetricsService {
  recordView: ReturnType<typeof vi.fn>;
}

const createMockPreprintService = (): MockPreprintService => ({
  getPreprint: vi.fn(),
  getPreprintsByAuthor: vi.fn(),
});

const createMockMetricsService = (): MockMetricsService => ({
  recordView: vi.fn().mockResolvedValue(undefined),
});

describe('XRPC Preprint Handlers', () => {
  let mockLogger: ILogger;
  let mockPreprintService: MockPreprintService;
  let mockMetricsService: MockMetricsService;
  let mockContext: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockPreprintService = createMockPreprintService();
    mockMetricsService = createMockMetricsService();

    mockContext = {
      get: vi.fn((key: string) => {
        switch (key) {
          case 'services':
            return {
              preprint: mockPreprintService,
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
    it('returns preprint with ATProto-compliant source information', async () => {
      const preprint = createMockPreprint();
      mockPreprintService.getPreprint.mockResolvedValue(preprint);

      const result = await getSubmissionHandler(
        mockContext as unknown as Parameters<typeof getSubmissionHandler>[0],
        { uri: preprint.uri }
      );

      expect(result.uri).toBe(preprint.uri);
      expect(result.title).toBe(preprint.title);

      // Verify ATProto compliance: source field
      expect(result.source).toBeDefined();
      expect(result.source.pdsEndpoint).toBe('https://bsky.social');
      expect(result.source.recordUrl).toContain('com.atproto.repo.getRecord');
      expect(result.source.blobUrl).toContain('com.atproto.sync.getBlob');
      expect(result.source.lastVerifiedAt).toBeDefined();
      expect(typeof result.source.stale).toBe('boolean');
    });

    it('includes document as BlobRef, not inline data', async () => {
      const preprint = createMockPreprint();
      mockPreprintService.getPreprint.mockResolvedValue(preprint);

      const result = await getSubmissionHandler(
        mockContext as unknown as Parameters<typeof getSubmissionHandler>[0],
        { uri: preprint.uri }
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
      const preprint = createMockPreprint();
      mockPreprintService.getPreprint.mockResolvedValue(preprint);

      const result = await getSubmissionHandler(
        mockContext as unknown as Parameters<typeof getSubmissionHandler>[0],
        { uri: preprint.uri }
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
      const preprint = createMockPreprint();
      mockPreprintService.getPreprint.mockResolvedValue(preprint);

      const result = await getSubmissionHandler(
        mockContext as unknown as Parameters<typeof getSubmissionHandler>[0],
        { uri: preprint.uri }
      );

      expect(result.metrics).toMatchObject({
        views: 150,
        downloads: 42,
        endorsements: 5,
      });
    });

    it('throws NotFoundError when preprint does not exist', async () => {
      mockPreprintService.getPreprint.mockResolvedValue(null);

      await expect(
        getSubmissionHandler(mockContext as unknown as Parameters<typeof getSubmissionHandler>[0], {
          uri: 'at://did:plc:notfound/pub.chive.preprint.submission/xyz' as AtUri,
        })
      ).rejects.toThrow(NotFoundError);
    });

    it('records view metric asynchronously', async () => {
      const preprint = createMockPreprint();
      mockPreprintService.getPreprint.mockResolvedValue(preprint);

      await getSubmissionHandler(
        mockContext as unknown as Parameters<typeof getSubmissionHandler>[0],
        { uri: preprint.uri }
      );

      expect(mockMetricsService.recordView).toHaveBeenCalledWith(
        preprint.uri,
        undefined // user DID (anonymous)
      );
    });

    it('marks preprint as stale if indexed > 7 days ago', async () => {
      const preprint = createMockPreprint({
        indexedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
      });
      mockPreprintService.getPreprint.mockResolvedValue(preprint);

      const result = await getSubmissionHandler(
        mockContext as unknown as Parameters<typeof getSubmissionHandler>[0],
        { uri: preprint.uri }
      );

      expect(result.source.stale).toBe(true);
    });

    it('marks preprint as fresh if indexed within 7 days', async () => {
      const preprint = createMockPreprint({
        indexedAt: new Date(), // Now
      });
      mockPreprintService.getPreprint.mockResolvedValue(preprint);

      const result = await getSubmissionHandler(
        mockContext as unknown as Parameters<typeof getSubmissionHandler>[0],
        { uri: preprint.uri }
      );

      expect(result.source.stale).toBe(false);
    });
  });

  describe('listByAuthorHandler', () => {
    it('returns paginated list with ATProto-compliant source info', async () => {
      const preprints = [
        createMockPreprint(),
        createMockPreprint({
          uri: 'at://did:plc:author123/pub.chive.preprint.submission/def456' as AtUri,
          title: 'Another Paper',
        }),
      ];

      mockPreprintService.getPreprintsByAuthor.mockResolvedValue({
        preprints,
        total: 2,
      });

      const result = await listByAuthorHandler(
        mockContext as unknown as Parameters<typeof listByAuthorHandler>[0],
        { did: 'did:plc:author123', limit: 20, sort: 'date' }
      );

      expect(result.preprints).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.hasMore).toBe(false);

      // Each preprint should have source info
      for (const p of result.preprints) {
        expect(p.source).toBeDefined();
        expect(p.source.pdsEndpoint).toBe('https://bsky.social');
      }
    });

    it('handles pagination with cursor', async () => {
      const preprints = Array.from({ length: 20 }, (_, i) =>
        createMockPreprint({
          uri: `at://did:plc:author123/pub.chive.preprint.submission/item${i}` as AtUri,
          title: `Paper ${i}`,
        })
      );

      mockPreprintService.getPreprintsByAuthor.mockResolvedValue({
        preprints,
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
      const preprint = createMockPreprint({ abstract: longAbstract });

      mockPreprintService.getPreprintsByAuthor.mockResolvedValue({
        preprints: [preprint],
        total: 1,
      });

      const result = await listByAuthorHandler(
        mockContext as unknown as Parameters<typeof listByAuthorHandler>[0],
        { did: 'did:plc:author123', limit: 20, sort: 'date' }
      );

      const firstPreprint = result.preprints[0];
      if (firstPreprint) {
        expect(firstPreprint.abstract.length).toBe(500);
      }
    });
  });
});
