/**
 * Unit tests for BlueskyBacklinksPlugin.
 *
 * @remarks
 * Tests Bluesky post tracking, AT-URI extraction from various embed types,
 * Chive URL conversion, and backlink creation.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { BlueskyBacklinksPlugin } from '../../../../src/plugins/builtin/bluesky-backlinks.js';
import type { FirehoseRecord } from '../../../../src/plugins/core/backlink-plugin.js';
import type { ICacheProvider } from '../../../../src/types/interfaces/cache.interface.js';
import type { ILogger } from '../../../../src/types/interfaces/logger.interface.js';
import type { IMetrics } from '../../../../src/types/interfaces/metrics.interface.js';
import type {
  Backlink,
  IBacklinkService,
  IPluginContext,
  IPluginEventBus,
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

const createMockEventBus = (): IPluginEventBus & {
  handlers: Map<string, ((...args: unknown[]) => void)[]>;
  trigger: (event: string, ...args: unknown[]) => Promise<void>;
} => {
  const handlers = new Map<string, ((...args: unknown[]) => void)[]>();

  return {
    handlers,
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      const existing = handlers.get(event) ?? [];
      existing.push(handler);
      handlers.set(event, existing);
    }),
    once: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    emitAsync: vi.fn().mockResolvedValue(undefined),
    listenerCount: vi.fn().mockReturnValue(0),
    eventNames: vi.fn().mockReturnValue([]),
    removeAllListeners: vi.fn(),
    async trigger(event: string, ...args: unknown[]): Promise<void> {
      const eventHandlers = handlers.get(event) ?? [];
      for (const handler of eventHandlers) {
        await Promise.resolve(handler(...args));
      }
    },
  };
};

const createMockBacklinkService = (): IBacklinkService => ({
  createBacklink: vi.fn().mockResolvedValue({
    id: 1,
    sourceUri: 'at://did:plc:test/app.bsky.feed.post/abc123',
    sourceType: 'bluesky.post',
    targetUri: 'at://did:plc:author/pub.chive.preprint.submission/paper1',
    indexedAt: new Date(),
    deleted: false,
  } as Backlink),
  deleteBacklink: vi.fn().mockResolvedValue(undefined),
  getBacklinks: vi.fn().mockResolvedValue({ backlinks: [], cursor: undefined }),
  getCounts: vi.fn().mockResolvedValue({
    sembleCollections: 0,
    leafletLists: 0,
    whitewindBlogs: 0,
    blueskyShares: 0,
    total: 0,
    updatedAt: new Date(),
  }),
  updateCounts: vi.fn().mockResolvedValue(undefined),
});

const createMockContext = (
  config: Record<string, unknown> = {}
): IPluginContext & { eventBus: ReturnType<typeof createMockEventBus> } => {
  const eventBus = createMockEventBus();
  return {
    logger: createMockLogger(),
    cache: createMockCache(),
    metrics: createMockMetrics(),
    eventBus,
    config,
  };
};

// ============================================================================
// Testable Subclass
// ============================================================================

/**
 * Testable subclass that exposes protected methods for testing.
 */
class TestableBlueskyBacklinksPlugin extends BlueskyBacklinksPlugin {
  /** Exposes protected extractContext for testing. */
  extractContext(record: unknown): string | undefined {
    return super.extractContext(record);
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('BlueskyBacklinksPlugin', () => {
  let plugin: TestableBlueskyBacklinksPlugin;
  let context: ReturnType<typeof createMockContext>;
  let backlinkService: IBacklinkService;

  beforeEach(() => {
    plugin = new TestableBlueskyBacklinksPlugin();
    backlinkService = createMockBacklinkService();
    context = createMockContext({ backlinkService });
  });

  afterEach(() => {
    vi.clearAllMocks();
    context.eventBus.removeAllListeners();
  });

  describe('plugin properties', () => {
    it('should have correct plugin ID', () => {
      expect(plugin.id).toBe('pub.chive.plugin.bluesky-backlinks');
    });

    it('should track app.bsky.feed.post collection', () => {
      expect(plugin.trackedCollection).toBe('app.bsky.feed.post');
    });

    it('should have correct source type', () => {
      expect(plugin.sourceType).toBe('bluesky.post');
    });

    it('should have correct manifest properties', () => {
      expect(plugin.manifest.id).toBe('pub.chive.plugin.bluesky-backlinks');
      expect(plugin.manifest.name).toBe('Bluesky Backlinks');
      expect(plugin.manifest.version).toBe('0.1.0');
      expect(plugin.manifest.author).toBe('Aaron Steven White');
      expect(plugin.manifest.license).toBe('MIT');
    });

    it('should declare correct permissions', () => {
      expect(plugin.manifest.permissions.hooks).toContain('firehose.app.bsky.feed.post');
      expect(plugin.manifest.permissions.storage?.maxSize).toBe(50 * 1024 * 1024);
    });
  });

  describe('initialize', () => {
    it('should initialize and subscribe to firehose events', async () => {
      await plugin.initialize(context);

      expect(context.eventBus.on).toHaveBeenCalledWith(
        'firehose.app.bsky.feed.post',
        expect.any(Function)
      );
      expect(context.logger.info).toHaveBeenCalledWith(
        'Backlink tracking initialized',
        expect.objectContaining({
          collection: 'app.bsky.feed.post',
          sourceType: 'bluesky.post',
        })
      );
    });
  });

  describe('extractPreprintRefs - record embeds', () => {
    it('should extract AT-URI from app.bsky.embed.record', () => {
      const post = {
        $type: 'app.bsky.feed.post',
        text: 'Check out this paper!',
        createdAt: '2024-01-01T00:00:00Z',
        embed: {
          $type: 'app.bsky.embed.record',
          record: {
            uri: 'at://did:plc:abc123/pub.chive.preprint.submission/rkey456',
            cid: 'bafyreiabc123',
          },
        },
      };

      const refs = plugin.extractPreprintRefs(post);

      expect(refs).toEqual(['at://did:plc:abc123/pub.chive.preprint.submission/rkey456']);
    });

    it('should skip non-preprint record embeds', () => {
      const post = {
        $type: 'app.bsky.feed.post',
        text: 'Quote posting something else',
        createdAt: '2024-01-01T00:00:00Z',
        embed: {
          $type: 'app.bsky.embed.record',
          record: {
            uri: 'at://did:plc:other/app.bsky.feed.post/xyz',
            cid: 'bafyreiabc123',
          },
        },
      };

      const refs = plugin.extractPreprintRefs(post);

      expect(refs).toEqual([]);
    });
  });

  describe('extractPreprintRefs - record with media embeds', () => {
    it('should extract AT-URI from app.bsky.embed.recordWithMedia', () => {
      const post = {
        $type: 'app.bsky.feed.post',
        text: 'Paper with image!',
        createdAt: '2024-01-01T00:00:00Z',
        embed: {
          $type: 'app.bsky.embed.recordWithMedia',
          record: {
            record: {
              uri: 'at://did:plc:def789/pub.chive.preprint.submission/paper2',
              cid: 'bafyreiabc456',
            },
          },
          media: {
            $type: 'app.bsky.embed.images',
            images: [
              {
                alt: 'Figure 1',
                image: { $type: 'blob' },
              },
            ],
          },
        },
      };

      const refs = plugin.extractPreprintRefs(post);

      expect(refs).toEqual(['at://did:plc:def789/pub.chive.preprint.submission/paper2']);
    });

    it('should skip non-preprint recordWithMedia embeds', () => {
      const post = {
        $type: 'app.bsky.feed.post',
        text: 'Sharing with media',
        createdAt: '2024-01-01T00:00:00Z',
        embed: {
          $type: 'app.bsky.embed.recordWithMedia',
          record: {
            record: {
              uri: 'at://did:plc:other/some.other.collection/xyz',
              cid: 'bafyreiabc456',
            },
          },
          media: {
            $type: 'app.bsky.embed.external',
            external: {
              uri: 'https://example.com',
              title: 'Example',
            },
          },
        },
      };

      const refs = plugin.extractPreprintRefs(post);

      expect(refs).toEqual([]);
    });
  });

  describe('extractPreprintRefs - external embeds', () => {
    it('should extract AT-URI from Chive URL in external embed', () => {
      const post = {
        $type: 'app.bsky.feed.post',
        text: 'Interesting paper',
        createdAt: '2024-01-01T00:00:00Z',
        embed: {
          $type: 'app.bsky.embed.external',
          external: {
            uri: 'https://chive.pub/preprint/did:plc:xyz123/paperkey',
            title: 'Paper Title',
            description: 'Paper description',
          },
        },
      };

      const refs = plugin.extractPreprintRefs(post);

      expect(refs).toEqual(['at://did:plc:xyz123/pub.chive.preprint.submission/paperkey']);
    });

    it('should handle /paper/ path prefix in Chive URLs', () => {
      const post = {
        $type: 'app.bsky.feed.post',
        text: 'Check this out',
        createdAt: '2024-01-01T00:00:00Z',
        embed: {
          $type: 'app.bsky.embed.external',
          external: {
            uri: 'https://chive.pub/paper/did:plc:abc789/key123',
            title: 'Paper',
          },
        },
      };

      const refs = plugin.extractPreprintRefs(post);

      expect(refs).toEqual(['at://did:plc:abc789/pub.chive.preprint.submission/key123']);
    });

    it('should skip non-Chive external URLs', () => {
      const post = {
        $type: 'app.bsky.feed.post',
        text: 'Link to other site',
        createdAt: '2024-01-01T00:00:00Z',
        embed: {
          $type: 'app.bsky.embed.external',
          external: {
            uri: 'https://arxiv.org/abs/2401.00000',
            title: 'ArXiv Paper',
          },
        },
      };

      const refs = plugin.extractPreprintRefs(post);

      expect(refs).toEqual([]);
    });

    it('should skip images-only embeds', () => {
      const post = {
        $type: 'app.bsky.feed.post',
        text: 'Just some images',
        createdAt: '2024-01-01T00:00:00Z',
        embed: {
          $type: 'app.bsky.embed.images',
          images: [
            {
              alt: 'An image',
              image: { $type: 'blob' },
            },
          ],
        },
      };

      const refs = plugin.extractPreprintRefs(post);

      expect(refs).toEqual([]);
    });
  });

  describe('extractPreprintRefs - rich text facets', () => {
    it('should extract AT-URI from facet links', () => {
      const post = {
        $type: 'app.bsky.feed.post',
        text: 'Check out this paper!',
        createdAt: '2024-01-01T00:00:00Z',
        facets: [
          {
            index: { byteStart: 10, byteEnd: 20 },
            features: [
              {
                $type: 'app.bsky.richtext.facet#link',
                uri: 'at://did:plc:facet123/pub.chive.preprint.submission/paper3',
              },
            ],
          },
        ],
      };

      const refs = plugin.extractPreprintRefs(post);

      expect(refs).toEqual(['at://did:plc:facet123/pub.chive.preprint.submission/paper3']);
    });

    it('should extract Chive URLs from facet links', () => {
      const post = {
        $type: 'app.bsky.feed.post',
        text: 'Link to paper',
        createdAt: '2024-01-01T00:00:00Z',
        facets: [
          {
            index: { byteStart: 0, byteEnd: 10 },
            features: [
              {
                $type: 'app.bsky.richtext.facet#link',
                uri: 'https://chive.pub/preprint/did:plc:link456/paper4',
              },
            ],
          },
        ],
      };

      const refs = plugin.extractPreprintRefs(post);

      expect(refs).toEqual(['at://did:plc:link456/pub.chive.preprint.submission/paper4']);
    });

    it('should handle multiple facets', () => {
      const post = {
        $type: 'app.bsky.feed.post',
        text: 'Multiple papers referenced',
        createdAt: '2024-01-01T00:00:00Z',
        facets: [
          {
            index: { byteStart: 0, byteEnd: 5 },
            features: [
              {
                $type: 'app.bsky.richtext.facet#link',
                uri: 'at://did:plc:multi1/pub.chive.preprint.submission/p1',
              },
            ],
          },
          {
            index: { byteStart: 10, byteEnd: 15 },
            features: [
              {
                $type: 'app.bsky.richtext.facet#link',
                uri: 'https://chive.pub/preprint/did:plc:multi2/p2',
              },
            ],
          },
        ],
      };

      const refs = plugin.extractPreprintRefs(post);

      expect(refs).toHaveLength(2);
      expect(refs).toContain('at://did:plc:multi1/pub.chive.preprint.submission/p1');
      expect(refs).toContain('at://did:plc:multi2/pub.chive.preprint.submission/p2');
    });

    it('should skip mention and tag facets', () => {
      const post = {
        $type: 'app.bsky.feed.post',
        text: 'Hey @user #science',
        createdAt: '2024-01-01T00:00:00Z',
        facets: [
          {
            index: { byteStart: 4, byteEnd: 9 },
            features: [
              {
                $type: 'app.bsky.richtext.facet#mention',
                did: 'did:plc:user123',
              },
            ],
          },
          {
            index: { byteStart: 10, byteEnd: 18 },
            features: [
              {
                $type: 'app.bsky.richtext.facet#tag',
                tag: 'science',
              },
            ],
          },
        ],
      };

      const refs = plugin.extractPreprintRefs(post);

      expect(refs).toEqual([]);
    });

    it('should skip non-preprint and non-Chive links in facets', () => {
      const post = {
        $type: 'app.bsky.feed.post',
        text: 'External links',
        createdAt: '2024-01-01T00:00:00Z',
        facets: [
          {
            index: { byteStart: 0, byteEnd: 10 },
            features: [
              {
                $type: 'app.bsky.richtext.facet#link',
                uri: 'https://example.com',
              },
            ],
          },
          {
            index: { byteStart: 11, byteEnd: 20 },
            features: [
              {
                $type: 'app.bsky.richtext.facet#link',
                uri: 'at://did:plc:other/some.collection/xyz',
              },
            ],
          },
        ],
      };

      const refs = plugin.extractPreprintRefs(post);

      expect(refs).toEqual([]);
    });
  });

  describe('extractPreprintRefs - plain text AT-URIs', () => {
    it('should extract AT-URIs from plain text', () => {
      const post = {
        $type: 'app.bsky.feed.post',
        text: 'Check this: at://did:plc:text123/pub.chive.preprint.submission/paper5',
        createdAt: '2024-01-01T00:00:00Z',
      };

      const refs = plugin.extractPreprintRefs(post);

      expect(refs).toEqual(['at://did:plc:text123/pub.chive.preprint.submission/paper5']);
    });

    it('should extract multiple AT-URIs from text', () => {
      const post = {
        $type: 'app.bsky.feed.post',
        text: 'Papers: at://did:plc:a/pub.chive.preprint.submission/p1 and at://did:plc:b/pub.chive.preprint.submission/p2',
        createdAt: '2024-01-01T00:00:00Z',
      };

      const refs = plugin.extractPreprintRefs(post);

      expect(refs).toHaveLength(2);
      expect(refs).toContain('at://did:plc:a/pub.chive.preprint.submission/p1');
      expect(refs).toContain('at://did:plc:b/pub.chive.preprint.submission/p2');
    });

    it('should filter out non-preprint AT-URIs from text', () => {
      const post = {
        $type: 'app.bsky.feed.post',
        text: 'URIs: at://did:plc:x/pub.chive.preprint.submission/p1 at://did:plc:y/app.bsky.feed.post/z',
        createdAt: '2024-01-01T00:00:00Z',
      };

      const refs = plugin.extractPreprintRefs(post);

      expect(refs).toEqual(['at://did:plc:x/pub.chive.preprint.submission/p1']);
    });
  });

  describe('extractPreprintRefs - deduplication', () => {
    it('should deduplicate references from multiple sources', () => {
      const duplicateUri = 'at://did:plc:dup/pub.chive.preprint.submission/same';
      const post = {
        $type: 'app.bsky.feed.post',
        text: `Duplicate: ${duplicateUri}`,
        createdAt: '2024-01-01T00:00:00Z',
        embed: {
          $type: 'app.bsky.embed.record',
          record: {
            uri: duplicateUri,
            cid: 'bafyreiabc',
          },
        },
        facets: [
          {
            index: { byteStart: 0, byteEnd: 10 },
            features: [
              {
                $type: 'app.bsky.richtext.facet#link',
                uri: duplicateUri,
              },
            ],
          },
        ],
      };

      const refs = plugin.extractPreprintRefs(post);

      expect(refs).toEqual([duplicateUri]);
      expect(refs).toHaveLength(1);
    });
  });

  describe('extractPreprintRefs - edge cases', () => {
    it('should handle post with no embeds, facets, or URIs', () => {
      const post = {
        $type: 'app.bsky.feed.post',
        text: 'Just a regular post',
        createdAt: '2024-01-01T00:00:00Z',
      };

      const refs = plugin.extractPreprintRefs(post);

      expect(refs).toEqual([]);
    });

    it('should handle post with empty text', () => {
      const post = {
        $type: 'app.bsky.feed.post',
        text: '',
        createdAt: '2024-01-01T00:00:00Z',
      };

      const refs = plugin.extractPreprintRefs(post);

      expect(refs).toEqual([]);
    });

    it('should handle post with null/undefined fields gracefully', () => {
      const post = {
        $type: 'app.bsky.feed.post',
        text: 'Text only',
        createdAt: '2024-01-01T00:00:00Z',
        embed: undefined,
        facets: undefined,
      };

      const refs = plugin.extractPreprintRefs(post);

      expect(refs).toEqual([]);
    });
  });

  describe('chiveUrlToAtUri - URL conversion', () => {
    it('should convert valid /preprint/ URL', () => {
      const post = {
        $type: 'app.bsky.feed.post',
        text: 'Link',
        createdAt: '2024-01-01T00:00:00Z',
        embed: {
          $type: 'app.bsky.embed.external',
          external: {
            uri: 'https://chive.pub/preprint/did:plc:test123/rkey789',
          },
        },
      };

      const refs = plugin.extractPreprintRefs(post);

      expect(refs).toEqual(['at://did:plc:test123/pub.chive.preprint.submission/rkey789']);
    });

    it('should convert valid /paper/ URL with simple DID', () => {
      const post = {
        $type: 'app.bsky.feed.post',
        text: 'Link',
        createdAt: '2024-01-01T00:00:00Z',
        embed: {
          $type: 'app.bsky.embed.external',
          external: {
            uri: 'https://chive.pub/paper/did:plc:abc789/key456',
          },
        },
      };

      const refs = plugin.extractPreprintRefs(post);

      expect(refs).toEqual(['at://did:plc:abc789/pub.chive.preprint.submission/key456']);
    });

    it('should handle DIDs with colons', () => {
      const post = {
        $type: 'app.bsky.feed.post',
        text: 'Link',
        createdAt: '2024-01-01T00:00:00Z',
        embed: {
          $type: 'app.bsky.embed.external',
          external: {
            uri: 'https://chive.pub/preprint/did:plc:abcdef123456/rkey',
          },
        },
      };

      const refs = plugin.extractPreprintRefs(post);

      expect(refs).toEqual(['at://did:plc:abcdef123456/pub.chive.preprint.submission/rkey']);
    });

    it('should return empty array for non-Chive domains', () => {
      const post = {
        $type: 'app.bsky.feed.post',
        text: 'Link',
        createdAt: '2024-01-01T00:00:00Z',
        embed: {
          $type: 'app.bsky.embed.external',
          external: {
            uri: 'https://example.com/preprint/did:plc:test/rkey',
          },
        },
      };

      const refs = plugin.extractPreprintRefs(post);

      expect(refs).toEqual([]);
    });

    it('should return empty array for invalid URL format', () => {
      const post = {
        $type: 'app.bsky.feed.post',
        text: 'Link',
        createdAt: '2024-01-01T00:00:00Z',
        embed: {
          $type: 'app.bsky.embed.external',
          external: {
            uri: 'https://chive.pub/other/path',
          },
        },
      };

      const refs = plugin.extractPreprintRefs(post);

      expect(refs).toEqual([]);
    });

    it('should return empty array for invalid URL syntax', () => {
      const post = {
        $type: 'app.bsky.feed.post',
        text: 'Link',
        createdAt: '2024-01-01T00:00:00Z',
        facets: [
          {
            index: { byteStart: 0, byteEnd: 10 },
            features: [
              {
                $type: 'app.bsky.richtext.facet#link',
                uri: 'not-a-valid-url',
              },
            ],
          },
        ],
      };

      const refs = plugin.extractPreprintRefs(post);

      expect(refs).toEqual([]);
    });
  });

  describe('extractContext', () => {
    it('should extract post text as context', () => {
      const post = {
        $type: 'app.bsky.feed.post',
        text: 'This is an interesting paper about AI.',
        createdAt: '2024-01-01T00:00:00Z',
        embed: {
          $type: 'app.bsky.embed.record',
          record: {
            uri: 'at://did:plc:test/pub.chive.preprint.submission/paper',
            cid: 'bafyreiabc',
          },
        },
      };

      const context = plugin.extractContext(post);

      expect(context).toBe('This is an interesting paper about AI.');
    });

    it('should truncate long posts to 200 characters', () => {
      const longText = 'a'.repeat(250);
      const post = {
        $type: 'app.bsky.feed.post',
        text: longText,
        createdAt: '2024-01-01T00:00:00Z',
      };

      const context = plugin.extractContext(post);

      expect(context).toHaveLength(200);
      expect(context).toBe('a'.repeat(197) + '...');
    });

    it('should not truncate posts shorter than 200 characters', () => {
      const post = {
        $type: 'app.bsky.feed.post',
        text: 'Short post.',
        createdAt: '2024-01-01T00:00:00Z',
      };

      const context = plugin.extractContext(post);

      expect(context).toBe('Short post.');
    });

    it('should return undefined for post without text', () => {
      const post = {
        $type: 'app.bsky.feed.post',
        text: '',
        createdAt: '2024-01-01T00:00:00Z',
      };

      const context = plugin.extractContext(post);

      expect(context).toBeUndefined();
    });

    it('should truncate exactly at 200 characters', () => {
      const post = {
        $type: 'app.bsky.feed.post',
        text: 'a'.repeat(201),
        createdAt: '2024-01-01T00:00:00Z',
      };

      const context = plugin.extractContext(post);

      expect(context).toBe('a'.repeat(197) + '...');
      expect(context).toHaveLength(200);
    });
  });

  describe('firehose event handling', () => {
    beforeEach(async () => {
      await plugin.initialize(context);
    });

    it('should create backlinks when post references preprint', async () => {
      const record: FirehoseRecord = {
        uri: 'at://did:plc:poster/app.bsky.feed.post/postkey',
        collection: 'app.bsky.feed.post',
        did: 'did:plc:poster',
        rkey: 'postkey',
        record: {
          $type: 'app.bsky.feed.post',
          text: 'Check out: at://did:plc:author/pub.chive.preprint.submission/paper',
          createdAt: '2024-01-01T00:00:00Z',
        },
        deleted: false,
        timestamp: new Date(),
      };

      await context.eventBus.trigger('firehose.app.bsky.feed.post', record);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(backlinkService.createBacklink).toHaveBeenCalledWith({
        sourceUri: 'at://did:plc:poster/app.bsky.feed.post/postkey',
        sourceType: 'bluesky.post',
        targetUri: 'at://did:plc:author/pub.chive.preprint.submission/paper',
        context: 'Check out: at://did:plc:author/pub.chive.preprint.submission/paper',
      });
    });

    it('should handle post deletion', async () => {
      const record: FirehoseRecord = {
        uri: 'at://did:plc:poster/app.bsky.feed.post/deleted',
        collection: 'app.bsky.feed.post',
        did: 'did:plc:poster',
        rkey: 'deleted',
        record: null,
        deleted: true,
        timestamp: new Date(),
      };

      await context.eventBus.trigger('firehose.app.bsky.feed.post', record);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(backlinkService.deleteBacklink).toHaveBeenCalledWith(
        'at://did:plc:poster/app.bsky.feed.post/deleted'
      );
    });

    it('should skip posts without preprint references', async () => {
      const record: FirehoseRecord = {
        uri: 'at://did:plc:poster/app.bsky.feed.post/regular',
        collection: 'app.bsky.feed.post',
        did: 'did:plc:poster',
        rkey: 'regular',
        record: {
          $type: 'app.bsky.feed.post',
          text: 'Just a regular post about life',
          createdAt: '2024-01-01T00:00:00Z',
        },
        deleted: false,
        timestamp: new Date(),
      };

      await context.eventBus.trigger('firehose.app.bsky.feed.post', record);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(backlinkService.createBacklink).not.toHaveBeenCalled();
    });

    it('should handle posts with multiple preprint references', async () => {
      const record: FirehoseRecord = {
        uri: 'at://did:plc:poster/app.bsky.feed.post/multi',
        collection: 'app.bsky.feed.post',
        did: 'did:plc:poster',
        rkey: 'multi',
        record: {
          $type: 'app.bsky.feed.post',
          text: 'Papers: at://did:plc:a/pub.chive.preprint.submission/p1',
          createdAt: '2024-01-01T00:00:00Z',
          embed: {
            $type: 'app.bsky.embed.record',
            record: {
              uri: 'at://did:plc:b/pub.chive.preprint.submission/p2',
              cid: 'bafyreiabc',
            },
          },
        },
        deleted: false,
        timestamp: new Date(),
      };

      await context.eventBus.trigger('firehose.app.bsky.feed.post', record);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(backlinkService.createBacklink).toHaveBeenCalledTimes(2);
    });

    it('should emit backlink.created event', async () => {
      const record: FirehoseRecord = {
        uri: 'at://did:plc:poster/app.bsky.feed.post/test',
        collection: 'app.bsky.feed.post',
        did: 'did:plc:poster',
        rkey: 'test',
        record: {
          $type: 'app.bsky.feed.post',
          text: 'at://did:plc:author/pub.chive.preprint.submission/paper',
          createdAt: '2024-01-01T00:00:00Z',
        },
        deleted: false,
        timestamp: new Date(),
      };

      await context.eventBus.trigger('firehose.app.bsky.feed.post', record);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(context.eventBus.emit).toHaveBeenCalledWith('backlink.created', {
        sourceUri: 'at://did:plc:poster/app.bsky.feed.post/test',
        sourceType: 'bluesky.post',
        targetUri: 'at://did:plc:author/pub.chive.preprint.submission/paper',
      });
    });

    it('should record metrics for backlink creation', async () => {
      const record: FirehoseRecord = {
        uri: 'at://did:plc:poster/app.bsky.feed.post/metrics',
        collection: 'app.bsky.feed.post',
        did: 'did:plc:poster',
        rkey: 'metrics',
        record: {
          $type: 'app.bsky.feed.post',
          text: 'at://did:plc:author/pub.chive.preprint.submission/paper',
          createdAt: '2024-01-01T00:00:00Z',
        },
        deleted: false,
        timestamp: new Date(),
      };

      await context.eventBus.trigger('firehose.app.bsky.feed.post', record);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(context.metrics.incrementCounter).toHaveBeenCalledWith(
        'backlinks_created',
        { source_type: 'bluesky.post' },
        undefined
      );
    });
  });
});
