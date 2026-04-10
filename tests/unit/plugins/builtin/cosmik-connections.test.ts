/**
 * Unit tests for CosmikConnectionsPlugin.
 *
 * @remarks
 * Tests backlink tracking from Cosmik connections to Chive eprints.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { CosmikConnectionsPlugin } from '../../../../src/plugins/builtin/cosmik-connections.js';
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
    sourceUri: 'at://did:plc:user/network.cosmik.connection/abc123',
    sourceType: 'cosmik.connection',
    targetUri: 'at://did:plc:author/pub.chive.eprint.submission/xyz789',
    context: 'type: cites',
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
// Tests
// ============================================================================

describe('CosmikConnectionsPlugin', () => {
  let plugin: CosmikConnectionsPlugin;

  beforeEach(() => {
    plugin = new CosmikConnectionsPlugin();
  });

  describe('extractEprintRefs', () => {
    it('extracts eprint AT-URI from source', () => {
      const record = {
        $type: 'network.cosmik.connection',
        source: 'at://did:plc:abc/pub.chive.eprint.submission/123',
        target: 'https://example.com',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };
      const refs = plugin.extractEprintRefs(record);
      expect(refs).toEqual(['at://did:plc:abc/pub.chive.eprint.submission/123']);
    });

    it('extracts eprint AT-URI from target', () => {
      const record = {
        $type: 'network.cosmik.connection',
        source: 'https://example.com',
        target: 'at://did:plc:abc/pub.chive.eprint.submission/456',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };
      const refs = plugin.extractEprintRefs(record);
      expect(refs).toEqual(['at://did:plc:abc/pub.chive.eprint.submission/456']);
    });

    it('extracts from both source and target', () => {
      const record = {
        $type: 'network.cosmik.connection',
        source: 'at://did:plc:abc/pub.chive.eprint.submission/123',
        target:
          'https://chive.pub/eprints/at%3A%2F%2Fdid%3Aplc%3Adef%2Fpub.chive.eprint.submission%2F456',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };
      const refs = plugin.extractEprintRefs(record);
      expect(refs).toHaveLength(2);
    });

    it('returns empty for non-Chive URLs', () => {
      const record = {
        $type: 'network.cosmik.connection',
        source: 'https://example.com/paper1',
        target: 'https://arxiv.org/abs/1234',
        connectionType: 'cites',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };
      const refs = plugin.extractEprintRefs(record);
      expect(refs).toHaveLength(0);
    });
  });

  describe('handleFirehoseRecord', () => {
    it('creates backlinks for records with eprint refs', async () => {
      const context = createMockContext();
      await plugin.initialize(context);

      const backlinkService = context.config.backlinkService as IBacklinkService;

      const firehoseRecord: FirehoseRecord = {
        uri: 'at://did:plc:user/network.cosmik.connection/abc',
        collection: 'network.cosmik.connection',
        did: 'did:plc:user',
        rkey: 'abc',
        record: {
          $type: 'network.cosmik.connection',
          source: 'at://did:plc:author/pub.chive.eprint.submission/xyz',
          target: 'https://example.com/paper',
          connectionType: 'cites',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
        deleted: false,
        timestamp: new Date(),
      };

      await plugin.handleFirehoseRecord(firehoseRecord);

      expect(backlinkService.createBacklink).toHaveBeenCalledWith({
        sourceUri: 'at://did:plc:user/network.cosmik.connection/abc',
        sourceType: 'cosmik.connection',
        targetUri: 'at://did:plc:author/pub.chive.eprint.submission/xyz',
        context: 'type: cites',
      });
    });

    it('handles deletions', async () => {
      const context = createMockContext();
      await plugin.initialize(context);

      const backlinkService = context.config.backlinkService as IBacklinkService;

      const firehoseRecord: FirehoseRecord = {
        uri: 'at://did:plc:user/network.cosmik.connection/abc',
        collection: 'network.cosmik.connection',
        did: 'did:plc:user',
        rkey: 'abc',
        record: null,
        deleted: true,
        timestamp: new Date(),
      };

      await plugin.handleFirehoseRecord(firehoseRecord);

      expect(backlinkService.deleteBacklink).toHaveBeenCalledWith(
        'at://did:plc:user/network.cosmik.connection/abc'
      );
    });

    it('skips records without eprint refs', async () => {
      const context = createMockContext();
      await plugin.initialize(context);

      const backlinkService = context.config.backlinkService as IBacklinkService;

      const firehoseRecord: FirehoseRecord = {
        uri: 'at://did:plc:user/network.cosmik.connection/abc',
        collection: 'network.cosmik.connection',
        did: 'did:plc:user',
        rkey: 'abc',
        record: {
          $type: 'network.cosmik.connection',
          source: 'https://example.com/a',
          target: 'https://example.com/b',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
        deleted: false,
        timestamp: new Date(),
      };

      await plugin.handleFirehoseRecord(firehoseRecord);

      expect(backlinkService.createBacklink).not.toHaveBeenCalled();
    });
  });
});
