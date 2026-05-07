/**
 * Unit tests for the Margin notes plugin.
 *
 * @remarks
 * Tests backlink tracking from Margin's `at.margin.note` records (W3C web
 * annotations) to Chive eprints. The single collection covers commenting,
 * highlighting, bookmarking, etc. via the W3C `motivation` field.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { MarginNotesPlugin } from '../../../../src/plugins/builtin/margin-annotations.js';
import type { FirehoseRecord } from '../../../../src/plugins/core/backlink-plugin.js';
import type { ILogger } from '../../../../src/types/interfaces/logger.interface.js';
import type {
  ICacheProvider,
  IMetrics,
  IPluginContext,
  IPluginEventBus,
  IBacklinkService,
} from '../../../../src/types/interfaces/plugin.interface.js';

// ============================================================================
// Mock Factories
// ============================================================================

const createMockLogger = (): ILogger => {
  const logger: ILogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => logger),
  };
  return logger;
};

const createMockCache = (): ICacheProvider => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
  exists: vi.fn().mockResolvedValue(false),
  expire: vi.fn().mockResolvedValue(undefined),
});

const createMockMetrics = (): IMetrics => ({
  incrementCounter: vi.fn(),
  setGauge: vi.fn(),
  observeHistogram: vi.fn(),
  startTimer: vi.fn().mockReturnValue(() => {}),
});

const createMockEventBus = (): IPluginEventBus => ({
  on: vi.fn(),
  once: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  emitAsync: vi.fn().mockResolvedValue(undefined),
  listenerCount: vi.fn().mockReturnValue(0),
  eventNames: vi.fn().mockReturnValue([]),
  removeAllListeners: vi.fn(),
});

const createMockBacklinkService = (): IBacklinkService => ({
  createBacklink: vi.fn().mockResolvedValue({
    id: 1,
    sourceUri: 'at://did:plc:user/at.margin.note/abc123',
    sourceType: 'margin.annotation',
    targetUri: 'at://did:plc:author/pub.chive.eprint.submission/xyz789',
    context: 'commenting: Great paper!',
    indexedAt: new Date(),
    deleted: false,
  }),
  deleteBacklink: vi.fn().mockResolvedValue(undefined),
  getBacklinks: vi.fn().mockResolvedValue({ backlinks: [], cursor: undefined }),
  getCounts: vi.fn().mockResolvedValue({
    cosmikCollections: 0,
    leafletLists: 0,
    whitewindBlogs: 0,
    blueskyPosts: 0,
    blueskyEmbeds: 0,
    total: 0,
  }),
  updateCounts: vi.fn().mockResolvedValue(undefined),
});

const createMockContext = (overrides?: Partial<IPluginContext>): IPluginContext => ({
  logger: createMockLogger(),
  cache: createMockCache(),
  metrics: createMockMetrics(),
  eventBus: createMockEventBus(),
  config: {
    backlinkService: createMockBacklinkService(),
  },
  ...overrides,
});

// ============================================================================
// MarginNotesPlugin Tests
// ============================================================================

describe('MarginNotesPlugin', () => {
  let plugin: MarginNotesPlugin;

  beforeEach(() => {
    plugin = new MarginNotesPlugin();
  });

  describe('handleFirehoseRecord', () => {
    it('creates a backlink for a comment targeting a Chive eprint', async () => {
      const context = createMockContext();
      await plugin.initialize(context);

      const backlinkService = context.config.backlinkService as IBacklinkService;

      const firehoseRecord: FirehoseRecord = {
        uri: 'at://did:plc:user/at.margin.note/abc',
        collection: 'at.margin.note',
        did: 'did:plc:user',
        rkey: 'abc',
        record: {
          $type: 'at.margin.note',
          motivation: 'commenting',
          target: {
            source:
              'https://chive.pub/eprints/at%3A%2F%2Fdid%3Aplc%3Aauthor%2Fpub.chive.eprint.submission%2Fxyz',
            sourceHash: 'abc123',
            title: 'An Important Paper',
          },
          body: {
            value: 'This is a well-written paper with novel results.',
            format: 'text/plain',
          },
          createdAt: '2026-01-01T00:00:00Z',
        },
        deleted: false,
        timestamp: new Date(),
      };

      await plugin.handleFirehoseRecord(firehoseRecord);

      expect(backlinkService.createBacklink).toHaveBeenCalledWith({
        sourceUri: 'at://did:plc:user/at.margin.note/abc',
        sourceType: 'margin.annotation',
        targetUri: expect.stringContaining('chive.pub/eprints/'),
        context: expect.stringContaining('commenting'),
      });
    });

    it('creates a backlink for a highlight (motivation: highlighting)', async () => {
      const context = createMockContext();
      await plugin.initialize(context);

      const backlinkService = context.config.backlinkService as IBacklinkService;

      await plugin.handleFirehoseRecord({
        uri: 'at://did:plc:user/at.margin.note/hl1',
        collection: 'at.margin.note',
        did: 'did:plc:user',
        rkey: 'hl1',
        record: {
          $type: 'at.margin.note',
          motivation: 'highlighting',
          target: {
            source:
              'https://chive.pub/eprints/at%3A%2F%2Fdid%3Aplc%3Aauthor%2Fpub.chive.eprint.submission%2Fxyz',
            selector: {
              type: 'TextQuoteSelector',
              exact: 'This is the key finding of our study.',
              prefix: 'In conclusion, ',
              suffix: ' We believe',
            },
          },
          color: '#ffeb3b',
          createdAt: '2026-01-01T00:00:00Z',
        },
        deleted: false,
        timestamp: new Date(),
      });

      expect(backlinkService.createBacklink).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceUri: 'at://did:plc:user/at.margin.note/hl1',
          targetUri: expect.stringContaining('chive.pub/eprints/'),
          context: expect.stringContaining('highlighting'),
        })
      );
      const call = (backlinkService.createBacklink as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
      expect(call?.context).toContain('#ffeb3b');
    });

    it('creates a backlink for a bookmark (motivation: bookmarking)', async () => {
      const context = createMockContext();
      await plugin.initialize(context);

      const backlinkService = context.config.backlinkService as IBacklinkService;

      await plugin.handleFirehoseRecord({
        uri: 'at://did:plc:user/at.margin.note/bm1',
        collection: 'at.margin.note',
        did: 'did:plc:user',
        rkey: 'bm1',
        record: {
          $type: 'at.margin.note',
          motivation: 'bookmarking',
          target: {
            source:
              'https://chive.pub/eprints/at%3A%2F%2Fdid%3Aplc%3Aauthor%2Fpub.chive.eprint.submission%2Fxyz',
            sourceHash: 'abc123',
            title: 'Important NLP Paper',
          },
          body: { value: 'A groundbreaking study on language models' },
          tags: ['nlp', 'language-models'],
          createdAt: '2026-01-01T00:00:00Z',
        },
        deleted: false,
        timestamp: new Date(),
      });

      expect(backlinkService.createBacklink).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceUri: 'at://did:plc:user/at.margin.note/bm1',
          context: expect.stringContaining('bookmarking'),
        })
      );
    });

    it('handles note deletions', async () => {
      const context = createMockContext();
      await plugin.initialize(context);

      const backlinkService = context.config.backlinkService as IBacklinkService;

      await plugin.handleFirehoseRecord({
        uri: 'at://did:plc:user/at.margin.note/abc',
        collection: 'at.margin.note',
        did: 'did:plc:user',
        rkey: 'abc',
        record: null,
        deleted: true,
        timestamp: new Date(),
      });

      expect(backlinkService.deleteBacklink).toHaveBeenCalledWith(
        'at://did:plc:user/at.margin.note/abc'
      );
    });

    it('skips notes targeting non-Chive URLs', async () => {
      const context = createMockContext();
      await plugin.initialize(context);

      const backlinkService = context.config.backlinkService as IBacklinkService;

      await plugin.handleFirehoseRecord({
        uri: 'at://did:plc:user/at.margin.note/abc',
        collection: 'at.margin.note',
        did: 'did:plc:user',
        rkey: 'abc',
        record: {
          $type: 'at.margin.note',
          motivation: 'commenting',
          target: { source: 'https://arxiv.org/abs/1234.5678' },
          body: { value: 'Nice paper' },
          createdAt: '2026-01-01T00:00:00Z',
        },
        deleted: false,
        timestamp: new Date(),
      });

      expect(backlinkService.createBacklink).not.toHaveBeenCalled();
    });
  });
});
