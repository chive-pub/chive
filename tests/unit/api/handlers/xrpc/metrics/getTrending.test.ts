/**
 * Unit tests for pub.chive.metrics.getTrending handler.
 *
 * @remarks
 * Tests the trending handler, focusing on field-based personalization (WS4).
 *
 * Key scenarios:
 * - Without fieldUris: returns entries without inUserFields flag
 * - With fieldUris: entries matching user's fields get inUserFields=true
 * - With fieldUris: in-field entries sorted before global entries
 * - Rank numbers re-assigned after sorting
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { getTrending } from '@/api/handlers/xrpc/metrics/getTrending.js';
import type { EprintView } from '@/services/eprint/eprint-service.js';
import type { AtUri, BlobRef, CID, DID, Timestamp } from '@/types/atproto.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

import { TEST_GRAPH_PDS_DID } from '../../../../../test-constants.js';

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

interface MockMetricsService {
  getTrending: ReturnType<typeof vi.fn>;
}

interface MockEprintService {
  getEprint: ReturnType<typeof vi.fn<(uri: string) => Promise<EprintView | null>>>;
}

const createMockMetricsService = (): MockMetricsService => ({
  getTrending: vi.fn().mockResolvedValue([]),
});

const createMockEprintService = (): MockEprintService => ({
  getEprint: vi.fn().mockResolvedValue(null),
});

interface MockContext {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
}

const createMockContext = (options: {
  metricsService: MockMetricsService;
  eprintService: MockEprintService;
  graphAlgorithmCache?: unknown;
  logger?: ILogger;
}): MockContext => {
  const logger = options.logger ?? createMockLogger();

  return {
    get: vi.fn((key: string) => {
      switch (key) {
        case 'services':
          return {
            metrics: options.metricsService,
            eprint: options.eprintService,
            graphAlgorithmCache: options.graphAlgorithmCache ?? undefined,
          };
        case 'logger':
          return logger;
        case 'user':
          return null;
        default:
          return undefined;
      }
    }),
    set: vi.fn(),
  };
};

const FIELD_ML_URI = `at://${TEST_GRAPH_PDS_DID}/pub.chive.graph.node/f39a6280-d70a-5e59-9022-1ce485cc5bf4`;
const FIELD_NEURO_URI = `at://${TEST_GRAPH_PDS_DID}/pub.chive.graph.node/17c7f1fa-28cc-582e-a9fa-74de0d7bb636`;

const MOCK_BLOB_REF: BlobRef = {
  $type: 'blob',
  ref: 'bafyreigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi' as CID,
  mimeType: 'application/pdf',
  size: 1024000,
};

const createMockEprintView = (overrides: Partial<EprintView> = {}): EprintView => ({
  uri: 'at://did:plc:test/pub.chive.eprint.submission/abc' as AtUri,
  cid: 'bafyreigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi' as CID,
  title: 'Test Paper',
  abstract: {
    type: 'RichText',
    items: [{ type: 'text', content: 'Abstract text.' }],
    format: 'application/x-chive-gloss+json',
  },
  abstractPlainText: 'Abstract text.',
  documentBlobRef: MOCK_BLOB_REF,
  documentFormat: 'pdf',
  authors: [
    {
      did: 'did:plc:test' as DID,
      name: 'Test Author',
      order: 1,
      affiliations: [],
      contributions: [],
      isCorrespondingAuthor: true,
      isHighlighted: false,
    },
  ],
  submittedBy: 'did:plc:test' as DID,
  license: 'CC-BY-4.0',
  pdsUrl: 'https://bsky.social',
  publicationStatus: 'eprint',
  createdAt: new Date('2024-01-15T10:00:00Z'),
  indexedAt: new Date('2024-01-15T10:05:00Z'),
  version: 1,
  versions: [
    {
      uri: 'at://did:plc:test/pub.chive.eprint.submission/abc' as AtUri,
      versionNumber: 1,
      cid: 'bafyreigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi' as CID,
      createdAt: Date.parse('2024-01-15T10:00:00Z') as Timestamp,
      changes: 'Initial',
    },
  ],
  metrics: { views: 100, downloads: 20, endorsements: 5 },
  ...overrides,
});

// =============================================================================
// TESTS
// =============================================================================

describe('getTrending', () => {
  let mockMetricsService: MockMetricsService;
  let mockEprintService: MockEprintService;
  let mockLogger: ILogger;

  beforeEach(() => {
    vi.clearAllMocks();
    mockMetricsService = createMockMetricsService();
    mockEprintService = createMockEprintService();
    mockLogger = createMockLogger();

    // Mock global fetch for avatar fetching
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ profiles: [] }),
      })
    );
  });

  describe('without fieldUris', () => {
    it('returns entries without inUserFields flag', async () => {
      mockMetricsService.getTrending.mockResolvedValue([
        { uri: 'at://did:plc:t1/pub.chive.eprint.submission/1', score: 500, velocity: 0.15 },
        { uri: 'at://did:plc:t2/pub.chive.eprint.submission/2', score: 300, velocity: 0.1 },
      ]);

      mockEprintService.getEprint.mockImplementation((uri: string) => {
        if (uri.includes('/1')) {
          return Promise.resolve(
            createMockEprintView({
              uri: 'at://did:plc:t1/pub.chive.eprint.submission/1' as AtUri,
              title: 'Paper 1',
              fields: [{ id: 'ml', uri: FIELD_ML_URI, label: 'Machine Learning' }],
            })
          );
        }
        if (uri.includes('/2')) {
          return Promise.resolve(
            createMockEprintView({
              uri: 'at://did:plc:t2/pub.chive.eprint.submission/2' as AtUri,
              title: 'Paper 2',
              fields: [{ id: 'neuro', uri: FIELD_NEURO_URI, label: 'Neuroscience' }],
            })
          );
        }
        return Promise.resolve(null);
      });

      const mockContext = createMockContext({
        metricsService: mockMetricsService,
        eprintService: mockEprintService,
        logger: mockLogger,
      });

      const result = await getTrending.handler({
        params: { window: '7d', limit: 20 },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      expect(result.body.trending).toHaveLength(2);
      // Without fieldUris, inUserFields should be undefined
      expect(result.body.trending[0]?.inUserFields).toBeUndefined();
      expect(result.body.trending[1]?.inUserFields).toBeUndefined();
      // Ranks should be sequential
      expect(result.body.trending[0]?.rank).toBe(1);
      expect(result.body.trending[1]?.rank).toBe(2);
    });
  });

  describe('with fieldUris', () => {
    it('flags entries matching user fields with inUserFields=true', async () => {
      mockMetricsService.getTrending.mockResolvedValue([
        { uri: 'at://did:plc:t1/pub.chive.eprint.submission/1', score: 500 },
        { uri: 'at://did:plc:t2/pub.chive.eprint.submission/2', score: 300 },
        { uri: 'at://did:plc:t3/pub.chive.eprint.submission/3', score: 200 },
      ]);

      mockEprintService.getEprint.mockImplementation((uri: string) => {
        if (uri.includes('/1')) {
          return Promise.resolve(
            createMockEprintView({
              uri: 'at://did:plc:t1/pub.chive.eprint.submission/1' as AtUri,
              title: 'ML Paper',
              fields: [{ id: 'ml', uri: FIELD_ML_URI, label: 'Machine Learning' }],
            })
          );
        }
        if (uri.includes('/2')) {
          return Promise.resolve(
            createMockEprintView({
              uri: 'at://did:plc:t2/pub.chive.eprint.submission/2' as AtUri,
              title: 'Neuro Paper',
              fields: [{ id: 'neuro', uri: FIELD_NEURO_URI, label: 'Neuroscience' }],
            })
          );
        }
        if (uri.includes('/3')) {
          return Promise.resolve(
            createMockEprintView({
              uri: 'at://did:plc:t3/pub.chive.eprint.submission/3' as AtUri,
              title: 'Another ML Paper',
              fields: [{ id: 'ml', uri: FIELD_ML_URI, label: 'Machine Learning' }],
            })
          );
        }
        return Promise.resolve(null);
      });

      const mockContext = createMockContext({
        metricsService: mockMetricsService,
        eprintService: mockEprintService,
        logger: mockLogger,
      });

      const result = await getTrending.handler({
        params: { window: '7d', limit: 20, fieldUris: [FIELD_ML_URI] },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      expect(result.body.trending).toHaveLength(3);

      // ML papers should have inUserFields=true
      const mlEntries = result.body.trending.filter((e) => e.inUserFields === true);
      expect(mlEntries).toHaveLength(2);

      // Neuro paper should have inUserFields=false
      const nonFieldEntries = result.body.trending.filter((e) => e.inUserFields === false);
      expect(nonFieldEntries).toHaveLength(1);
    });

    it('sorts in-field entries before global entries', async () => {
      // Entry order from metrics: global(500) > global(400) > in-field(300) > in-field(200)
      mockMetricsService.getTrending.mockResolvedValue([
        { uri: 'at://did:plc:t1/pub.chive.eprint.submission/1', score: 500 },
        { uri: 'at://did:plc:t2/pub.chive.eprint.submission/2', score: 400 },
        { uri: 'at://did:plc:t3/pub.chive.eprint.submission/3', score: 300 },
        { uri: 'at://did:plc:t4/pub.chive.eprint.submission/4', score: 200 },
      ]);

      mockEprintService.getEprint.mockImplementation((uri: string) => {
        if (uri.includes('/1')) {
          return Promise.resolve(
            createMockEprintView({
              uri: 'at://did:plc:t1/pub.chive.eprint.submission/1' as AtUri,
              title: 'Global Paper 1',
              fields: [{ id: 'neuro', uri: FIELD_NEURO_URI, label: 'Neuroscience' }],
            })
          );
        }
        if (uri.includes('/2')) {
          return Promise.resolve(
            createMockEprintView({
              uri: 'at://did:plc:t2/pub.chive.eprint.submission/2' as AtUri,
              title: 'Global Paper 2',
              fields: [{ id: 'neuro', uri: FIELD_NEURO_URI, label: 'Neuroscience' }],
            })
          );
        }
        if (uri.includes('/3')) {
          return Promise.resolve(
            createMockEprintView({
              uri: 'at://did:plc:t3/pub.chive.eprint.submission/3' as AtUri,
              title: 'In-Field Paper 1',
              fields: [{ id: 'ml', uri: FIELD_ML_URI, label: 'Machine Learning' }],
            })
          );
        }
        if (uri.includes('/4')) {
          return Promise.resolve(
            createMockEprintView({
              uri: 'at://did:plc:t4/pub.chive.eprint.submission/4' as AtUri,
              title: 'In-Field Paper 2',
              fields: [{ id: 'ml', uri: FIELD_ML_URI, label: 'Machine Learning' }],
            })
          );
        }
        return Promise.resolve(null);
      });

      const mockContext = createMockContext({
        metricsService: mockMetricsService,
        eprintService: mockEprintService,
        logger: mockLogger,
      });

      const result = await getTrending.handler({
        params: { window: '7d', limit: 20, fieldUris: [FIELD_ML_URI] },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      expect(result.body.trending).toHaveLength(4);

      // First two should be in-field entries (sorted before global)
      expect(result.body.trending[0]?.inUserFields).toBe(true);
      expect(result.body.trending[1]?.inUserFields).toBe(true);
      // Last two should be global entries
      expect(result.body.trending[2]?.inUserFields).toBe(false);
      expect(result.body.trending[3]?.inUserFields).toBe(false);
    });

    it('re-assigns rank numbers after sorting', async () => {
      mockMetricsService.getTrending.mockResolvedValue([
        { uri: 'at://did:plc:t1/pub.chive.eprint.submission/1', score: 500 },
        { uri: 'at://did:plc:t2/pub.chive.eprint.submission/2', score: 300 },
      ]);

      mockEprintService.getEprint.mockImplementation((uri: string) => {
        if (uri.includes('/1')) {
          return Promise.resolve(
            createMockEprintView({
              uri: 'at://did:plc:t1/pub.chive.eprint.submission/1' as AtUri,
              title: 'Global Paper',
              fields: [{ id: 'neuro', uri: FIELD_NEURO_URI, label: 'Neuroscience' }],
            })
          );
        }
        if (uri.includes('/2')) {
          return Promise.resolve(
            createMockEprintView({
              uri: 'at://did:plc:t2/pub.chive.eprint.submission/2' as AtUri,
              title: 'In-Field Paper',
              fields: [{ id: 'ml', uri: FIELD_ML_URI, label: 'Machine Learning' }],
            })
          );
        }
        return Promise.resolve(null);
      });

      const mockContext = createMockContext({
        metricsService: mockMetricsService,
        eprintService: mockEprintService,
        logger: mockLogger,
      });

      const result = await getTrending.handler({
        params: { window: '7d', limit: 20, fieldUris: [FIELD_ML_URI] },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      // After sorting, in-field paper should be rank 1 even though it had lower score
      expect(result.body.trending[0]?.rank).toBe(1);
      expect(result.body.trending[0]?.inUserFields).toBe(true);
      expect(result.body.trending[1]?.rank).toBe(2);
      expect(result.body.trending[1]?.inUserFields).toBe(false);
    });
  });

  describe('general behavior', () => {
    it('skips eprints that are no longer indexed', async () => {
      mockMetricsService.getTrending.mockResolvedValue([
        { uri: 'at://did:plc:t1/pub.chive.eprint.submission/1', score: 500 },
        { uri: 'at://did:plc:t2/pub.chive.eprint.submission/missing', score: 300 },
      ]);

      mockEprintService.getEprint.mockImplementation((uri: string) => {
        if (uri.includes('/1')) {
          return Promise.resolve(
            createMockEprintView({
              uri: 'at://did:plc:t1/pub.chive.eprint.submission/1' as AtUri,
              title: 'Existing Paper',
            })
          );
        }
        return Promise.resolve(null);
      });

      const mockContext = createMockContext({
        metricsService: mockMetricsService,
        eprintService: mockEprintService,
        logger: mockLogger,
      });

      const result = await getTrending.handler({
        params: { window: '7d', limit: 20 },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      expect(result.body.trending).toHaveLength(1);
      expect(result.body.trending[0]?.title).toBe('Existing Paper');
    });

    it('uses graph algorithm cache when available', async () => {
      const mockCache = {
        getTrending: vi
          .fn()
          .mockResolvedValue([
            { uri: 'at://did:plc:t1/pub.chive.eprint.submission/cached', viewCount: 999 },
          ]),
      };

      mockEprintService.getEprint.mockResolvedValue(
        createMockEprintView({
          uri: 'at://did:plc:t1/pub.chive.eprint.submission/cached' as AtUri,
          title: 'Cached Paper',
        })
      );

      const mockContext = createMockContext({
        metricsService: mockMetricsService,
        eprintService: mockEprintService,
        graphAlgorithmCache: mockCache,
        logger: mockLogger,
      });

      const result = await getTrending.handler({
        params: { window: '7d', limit: 20 },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      expect(mockCache.getTrending).toHaveBeenCalledWith('7d');
      // Should not fall back to metrics service
      expect(mockMetricsService.getTrending).not.toHaveBeenCalled();
      expect(result.body.trending).toHaveLength(1);
    });

    it('falls back to metrics service when cache is empty', async () => {
      const mockCache = {
        getTrending: vi.fn().mockResolvedValue([]),
      };

      mockMetricsService.getTrending.mockResolvedValue([
        { uri: 'at://did:plc:t1/pub.chive.eprint.submission/1', score: 100 },
      ]);

      mockEprintService.getEprint.mockResolvedValue(
        createMockEprintView({
          uri: 'at://did:plc:t1/pub.chive.eprint.submission/1' as AtUri,
        })
      );

      const mockContext = createMockContext({
        metricsService: mockMetricsService,
        eprintService: mockEprintService,
        graphAlgorithmCache: mockCache,
        logger: mockLogger,
      });

      await getTrending.handler({
        params: { window: '24h', limit: 20 },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      expect(mockMetricsService.getTrending).toHaveBeenCalledWith('24h', 20);
    });
  });
});
