/**
 * Unit tests for LeafletBacklinksPlugin.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { LeafletBacklinksPlugin } from '../../../../src/plugins/builtin/leaflet-backlinks.js';
import type { ILogger } from '../../../../src/types/interfaces/logger.interface.js';
import type {
  ICacheProvider,
  IMetrics,
  IPluginContext,
  IPluginEventBus,
  IBacklinkService,
  Backlink,
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
    sourceUri: 'at://did:plc:user/pub.leaflet.document/abc123',
    sourceType: 'leaflet.document',
    targetUri: 'at://did:plc:author/pub.chive.eprint.submission/xyz789',
    indexedAt: new Date(),
    deleted: false,
  } as Backlink),
  deleteBacklink: vi.fn().mockResolvedValue(undefined),
  getBacklinks: vi.fn().mockResolvedValue({ backlinks: [], cursor: undefined }),
  getCounts: vi.fn().mockResolvedValue({
    cosmikCollections: 0,
    leafletLists: 0,
    whitewindBlogs: 0,
    blueskyShares: 0,
    total: 0,
    updatedAt: new Date(),
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
// Sample Data
//
// Shaped to the vendored lexicons under `lexicons/pub/leaflet/`, which come
// from Leaflet's own repository. The previous fixtures were built on
// `xyz.leaflet.list`, an NSID Leaflet does not publish.
// ============================================================================

const EPRINT_A = 'at://did:plc:author1/pub.chive.eprint.submission/abc123';
const EPRINT_B = 'at://did:plc:author2/pub.chive.eprint.submission/def456';

/** A document whose text block links an eprint through a richtext facet. */
const DOCUMENT_WITH_FACET_LINK = {
  $type: 'pub.leaflet.document',
  title: 'Notes on quantifier scope',
  description: 'Reading notes',
  author: 'reader.example.com',
  pages: [
    {
      $type: 'pub.leaflet.pages.linearDocument',
      blocks: [
        {
          block: {
            $type: 'pub.leaflet.blocks.text',
            plaintext: 'The clearest treatment is in this paper.',
            facets: [
              {
                index: { byteStart: 30, byteEnd: 39 },
                features: [{ $type: 'pub.leaflet.richtext.facet#link', uri: EPRINT_A }],
              },
            ],
          },
        },
      ],
    },
  ],
};

/** A document embedding an eprint as a website block. */
const DOCUMENT_WITH_WEBSITE_BLOCK = {
  $type: 'pub.leaflet.document',
  title: 'Linked reading',
  pages: [
    {
      blocks: [{ block: { $type: 'pub.leaflet.blocks.website', src: EPRINT_B, title: 'A paper' } }],
    },
  ],
};

/** A comment whose subject is an eprint. */
const COMMENT_ON_EPRINT = {
  $type: 'pub.leaflet.comment',
  subject: EPRINT_A,
  plaintext: 'This replicates the 2019 result almost exactly.',
  createdAt: '2026-08-31T10:00:00Z',
};

/**
 * The protected surface these tests exercise.
 *
 * @remarks
 * `extractContext` and `shouldProcess` are protected. Accessing them through a
 * narrow named type keeps the tests readable and stops `dot-notation` from
 * rewriting bracket access into a member access that does not compile.
 */
interface PluginInternals {
  extractContext(record: unknown): string | undefined;
  shouldProcess(record: unknown): boolean;
}

const internals = (p: LeafletBacklinksPlugin): PluginInternals => p as unknown as PluginInternals;

// ============================================================================
// Tests
// ============================================================================

describe('LeafletBacklinksPlugin', () => {
  let plugin: LeafletBacklinksPlugin;

  beforeEach(() => {
    plugin = new LeafletBacklinksPlugin();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('identity', () => {
    it('tracks the collection Leaflet actually publishes', () => {
      // The whole reason this plugin indexed nothing: `xyz.leaflet.list` does
      // not exist, so it matched no record in any repository.
      expect(plugin.trackedCollection).toBe('pub.leaflet.document');
    });

    it('declares hooks for both Leaflet collections', () => {
      // Subscribing to the document alone would miss comments, which reach an
      // eprint by the same route. The list also carries the hooks the base
      // class emits, asserted in backlink-plugins-declare-emitted-hooks.
      expect(plugin.manifest.permissions?.hooks).toEqual(
        expect.arrayContaining(['firehose.pub.leaflet.document', 'firehose.pub.leaflet.comment'])
      );
    });

    it('reports a source type that names a real record type', () => {
      expect(plugin.sourceType).toBe('leaflet.document');
    });
  });

  describe('subscription', () => {
    it('subscribes to comments as well as documents', async () => {
      const context = createMockContext();
      await plugin.initialize(context);

      const subscribed = (context.eventBus.on as ReturnType<typeof vi.fn>).mock.calls.map(
        (c) => c[0] as string
      );
      expect(subscribed).toContain('firehose.pub.leaflet.document');
      expect(subscribed).toContain('firehose.pub.leaflet.comment');
    });
  });

  describe('extractEprintRefs', () => {
    it('finds an eprint linked from a richtext facet', () => {
      // A citation inside a paragraph, which is the ordinary way a document
      // refers to a paper.
      expect(plugin.extractEprintRefs(DOCUMENT_WITH_FACET_LINK)).toEqual([EPRINT_A]);
    });

    it('finds an eprint embedded as a website block', () => {
      expect(plugin.extractEprintRefs(DOCUMENT_WITH_WEBSITE_BLOCK)).toEqual([EPRINT_B]);
    });

    it('finds the subject of a comment', () => {
      expect(plugin.extractEprintRefs(COMMENT_ON_EPRINT)).toEqual([EPRINT_A]);
    });

    it('finds a quoted document in a comment attachment', () => {
      const comment = {
        $type: 'pub.leaflet.comment',
        subject: 'at://did:plc:other/pub.leaflet.document/xyz',
        plaintext: 'Quoting this',
        attachment: { document: EPRINT_B },
      };
      expect(plugin.extractEprintRefs(comment)).toEqual([EPRINT_B]);
    });

    it('finds a standardSitePost block pointing straight at an eprint', () => {
      const doc = {
        $type: 'pub.leaflet.document',
        pages: [
          { blocks: [{ block: { $type: 'pub.leaflet.blocks.standardSitePost', uri: EPRINT_A } }] },
        ],
      };
      expect(plugin.extractEprintRefs(doc)).toEqual([EPRINT_A]);
    });

    it('collects references across several pages and blocks', () => {
      const doc = {
        $type: 'pub.leaflet.document',
        pages: [
          { blocks: [{ block: { $type: 'pub.leaflet.blocks.website', src: EPRINT_A } }] },
          { blocks: [{ block: { $type: 'pub.leaflet.blocks.website', src: EPRINT_B } }] },
        ],
      };
      expect(plugin.extractEprintRefs(doc).sort()).toEqual([EPRINT_A, EPRINT_B].sort());
    });

    it('reports each eprint once however many times it is referenced', () => {
      const doc = {
        $type: 'pub.leaflet.document',
        pages: [
          {
            blocks: [
              { block: { $type: 'pub.leaflet.blocks.website', src: EPRINT_A } },
              {
                block: {
                  $type: 'pub.leaflet.blocks.text',
                  plaintext: 'again',
                  facets: [{ features: [{ uri: EPRINT_A }] }],
                },
              },
            ],
          },
        ],
      };
      expect(plugin.extractEprintRefs(doc)).toEqual([EPRINT_A]);
    });

    it('ignores links that are not eprints', () => {
      const doc = {
        $type: 'pub.leaflet.document',
        pages: [
          {
            blocks: [
              { block: { $type: 'pub.leaflet.blocks.website', src: 'https://example.com/blog' } },
              {
                block: {
                  $type: 'pub.leaflet.blocks.standardSitePost',
                  uri: 'at://did:plc:someone/site.standard.document/abc',
                },
              },
            ],
          },
        ],
      };
      expect(plugin.extractEprintRefs(doc)).toEqual([]);
    });

    it('ignores facet features that carry no link', () => {
      const doc = {
        $type: 'pub.leaflet.document',
        pages: [
          {
            blocks: [
              {
                block: {
                  $type: 'pub.leaflet.blocks.text',
                  plaintext: 'bold text',
                  facets: [{ features: [{ $type: 'pub.leaflet.richtext.facet#bold' }] }],
                },
              },
            ],
          },
        ],
      };
      expect(plugin.extractEprintRefs(doc)).toEqual([]);
    });

    it('survives a document with no pages', () => {
      expect(plugin.extractEprintRefs({ $type: 'pub.leaflet.document', title: 'Empty' })).toEqual(
        []
      );
    });

    it('survives a page with no blocks and a block with no content', () => {
      const doc = { $type: 'pub.leaflet.document', pages: [{}, { blocks: [{}] }] };
      expect(plugin.extractEprintRefs(doc)).toEqual([]);
    });

    it('survives values that are not records at all', () => {
      for (const value of [null, undefined, 'a string', 42]) {
        expect(plugin.extractEprintRefs(value)).toEqual([]);
      }
    });
  });

  describe('extractContext', () => {
    it('uses a document title and description', () => {
      expect(internals(plugin).extractContext(DOCUMENT_WITH_FACET_LINK)).toBe(
        'Notes on quantifier scope: Reading notes'
      );
    });

    it('uses the title alone when there is no description', () => {
      expect(internals(plugin).extractContext(DOCUMENT_WITH_WEBSITE_BLOCK)).toBe('Linked reading');
    });

    it('falls back to a comment body, which has no title', () => {
      expect(internals(plugin).extractContext(COMMENT_ON_EPRINT)).toBe(
        'This replicates the 2019 result almost exactly.'
      );
    });

    it('truncates a long comment rather than storing the whole thing', () => {
      const long = { $type: 'pub.leaflet.comment', plaintext: 'x'.repeat(500) };
      const context = internals(plugin).extractContext(long);
      expect(context).toHaveLength(200);
      expect(context?.endsWith('...')).toBe(true);
    });

    it('returns nothing for a record with neither', () => {
      expect(internals(plugin).extractContext({ $type: 'pub.leaflet.document' })).toBeUndefined();
    });
  });

  describe('shouldProcess', () => {
    it('accepts a document', () => {
      expect(internals(plugin).shouldProcess(DOCUMENT_WITH_FACET_LINK)).toBe(true);
    });

    it('accepts a comment', () => {
      // The previous version required `visibility === 'public'`, a field the
      // real lexicons do not have — so every record would have been skipped.
      expect(internals(plugin).shouldProcess(COMMENT_ON_EPRINT)).toBe(true);
    });

    it('rejects a non-record', () => {
      expect(internals(plugin).shouldProcess(null)).toBe(false);
      expect(internals(plugin).shouldProcess('nope')).toBe(false);
    });
  });
});
