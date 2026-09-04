/**
 * Regression tests for non-string author names in paper suggestions.
 *
 * @remarks
 * The OpenReview API documents `content.authors.value` as an array of
 * strings, but large collaboration submissions return an array of objects
 * of the form `{ fullname, username }`. Those objects reached
 * `ClaimingService.scorePaperMatch`, where `name.toLowerCase()` threw a
 * TypeError and turned `pub.chive.claiming.getSuggestions` into a 500.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { OpenReviewPlugin } from '../../../../src/plugins/builtin/openreview.js';
import { ClaimingService } from '../../../../src/services/claiming/claiming-service.js';
import type { ExternalEprintWithSource } from '../../../../src/services/claiming/claiming-service.js';
import type { IIdentityResolver } from '../../../../src/types/interfaces/identity.interface.js';
import type { ILogger } from '../../../../src/types/interfaces/logger.interface.js';
import type {
  ExternalEprint,
  ExternalSearchQuery,
  ICacheProvider,
  IChivePlugin,
  IImportService,
  IMetrics,
  IPluginContext,
  IPluginEventBus,
  IPluginManager,
  SearchablePlugin,
} from '../../../../src/types/interfaces/plugin.interface.js';
import { PluginState } from '../../../../src/types/interfaces/plugin.interface.js';

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

interface MockDatabasePool {
  query: ReturnType<typeof vi.fn>;
}

const createMockDatabasePool = (): MockDatabasePool => ({
  query: vi.fn().mockResolvedValue({ rows: [] }),
});

const createMockImportService = (): IImportService => ({
  exists: vi.fn().mockResolvedValue(false),
  get: vi.fn().mockResolvedValue(null),
  getById: vi.fn().mockResolvedValue(null),
  create: vi.fn(),
  update: vi.fn().mockResolvedValue({}),
  search: vi.fn().mockResolvedValue({ eprints: [] }),
  markClaimed: vi.fn(),
});

const createMockIdentityResolver = (): IIdentityResolver => ({
  resolveDID: vi.fn().mockResolvedValue({
    id: 'did:plc:test',
    verificationMethod: [],
    alsoKnownAs: ['at://test.user'],
  }),
  resolveHandle: vi.fn().mockResolvedValue('did:plc:test'),
  getPDSEndpoint: vi.fn().mockResolvedValue('https://pds.example.com'),
});

const createMockSearchablePlugin = (
  id: string,
  searchFn: (query: ExternalSearchQuery) => Promise<ExternalEprint[]>
): SearchablePlugin => ({
  id,
  supportsSearch: true,
  search: searchFn,
  manifest: {
    id,
    name: `Mock ${id}`,
    version: '1.0.0',
    description: `Mock searchable plugin for ${id}`,
    author: 'Test',
    license: 'MIT',
    entrypoint: 'dist/index.js',
    permissions: {},
  },
  getState: vi.fn().mockReturnValue(PluginState.READY),
  initialize: vi.fn().mockResolvedValue(undefined),
  shutdown: vi.fn().mockResolvedValue(undefined),
});

const createMockPluginManager = (plugins: readonly IChivePlugin[]): IPluginManager => ({
  loadPlugin: vi.fn().mockResolvedValue(undefined),
  unloadPlugin: vi.fn().mockResolvedValue(undefined),
  reloadPlugin: vi.fn().mockResolvedValue(undefined),
  loadPluginsFromDirectory: vi.fn().mockResolvedValue(undefined),
  getPlugin: vi.fn().mockImplementation((id: string) => plugins.find((p) => p.id === id)),
  getAllPlugins: vi.fn().mockReturnValue(plugins),
  getPluginState: vi.fn().mockReturnValue(PluginState.READY),
  shutdownAll: vi.fn().mockResolvedValue(undefined),
});

const createMockPluginContext = (): IPluginContext =>
  ({
    logger: createMockLogger(),
    cache: {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      exists: vi.fn().mockResolvedValue(false),
      expire: vi.fn().mockResolvedValue(undefined),
    } satisfies ICacheProvider,
    metrics: {
      incrementCounter: vi.fn(),
      setGauge: vi.fn(),
      observeHistogram: vi.fn(),
      startTimer: vi.fn().mockReturnValue(() => {}),
    } satisfies IMetrics,
    eventBus: {
      on: vi.fn(),
      once: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      emitAsync: vi.fn().mockResolvedValue(undefined),
      listenerCount: vi.fn().mockReturnValue(0),
      eventNames: vi.fn().mockReturnValue([]),
      removeAllListeners: vi.fn(),
    } satisfies IPluginEventBus,
    config: {},
  }) as IPluginContext;

/**
 * Search response shaped like an OpenReview collaboration submission, where
 * `authors.value` holds objects rather than strings.
 */
const COLLABORATION_NOTES_RESPONSE = {
  notes: [
    {
      id: '0eIaLDD4zS',
      forum: '0eIaLDD4zS',
      invitation: 'ATLAS/-/Submission',
      signatures: [],
      readers: ['everyone'],
      writers: [],
      content: {
        title: { value: 'Search for single production of vector-like quarks' },
        abstract: { value: 'A search performed with the ATLAS detector.' },
        authors: {
          value: [
            { fullname: 'Georges Aad', username: 'http://orcid.org/0000-0002-6665-4934' },
            { fullname: 'Aaron White', username: 'http://orcid.org/0000-0003-0057-9246' },
          ],
        },
      },
      cdate: 1704067200000,
      mdate: 1704067200000,
    },
  ],
  count: 1,
};

// ============================================================================
// Tests
// ============================================================================

describe('OpenReviewPlugin author name normalization', () => {
  let plugin: OpenReviewPlugin;
  let originalFetch: typeof fetch;

  beforeEach(async () => {
    plugin = new OpenReviewPlugin();
    await plugin.initialize(createMockPluginContext());
    originalFetch = global.fetch;
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
    global.fetch = originalFetch;
  });

  it('flattens object-shaped author entries into name strings', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(COLLABORATION_NOTES_RESPONSE),
    } as Response);

    const results = await plugin.search({ author: 'Aaron White', limit: 5 });

    expect(results).toHaveLength(1);
    const authors = results[0]?.authors ?? [];
    expect(authors.map((a) => a.name)).toEqual(['Georges Aad', 'Aaron White']);
    for (const author of authors) {
      expect(typeof author.name).toBe('string');
    }
  });
});

describe('ClaimingService.getSuggestedPapers with malformed author names', () => {
  let service: ClaimingService;
  let db: MockDatabasePool;

  beforeEach(() => {
    db = createMockDatabasePool();
    service = new ClaimingService(
      createMockLogger(),
      db as never,
      createMockImportService(),
      createMockIdentityResolver()
    );

    vi.spyOn(
      service as unknown as { getUserProfile: () => unknown },
      'getUserProfile'
    ).mockResolvedValue({
      did: 'did:plc:aswhite',
      handle: 'aswhite.test',
      displayName: 'Aaron Steven White',
      researchKeywords: ['semantics'],
    });

    vi.spyOn(
      service as unknown as { getUserClaimedTopics: () => unknown },
      'getUserClaimedTopics'
    ).mockResolvedValue({
      concepts: [],
      topics: ['semantics'],
      keywords: ['semantics'],
      coauthorNames: ['kyle rawlins'],
    });

    vi.spyOn(
      service as unknown as { searchInternalPapers: () => unknown },
      'searchInternalPapers'
    ).mockResolvedValue([] as ExternalEprintWithSource[]);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('scores papers whose author names are not strings without throwing', async () => {
    const badPlugin = createMockSearchablePlugin(
      'pub.chive.plugin.openreview',
      vi.fn().mockResolvedValue([
        {
          externalId: '0eIaLDD4zS',
          url: 'https://openreview.net/forum?id=0eIaLDD4zS',
          title: 'Search for single production of vector-like quarks',
          abstract: 'A search performed with the ATLAS detector.',
          authors: [
            { name: { fullname: 'Aaron White' } as unknown as string },
            { name: 42 as unknown as string, affiliation: { city: 'Geneva' } as unknown as string },
          ],
          publicationDate: new Date('2024-01-01'),
        },
        {
          externalId: '0eIaLDD4zT',
          url: 'https://openreview.net/forum?id=0eIaLDD4zT',
          title: 'Decomposing semantics',
          abstract: 'A framework for semantics.',
          authors: [{ name: 'Aaron Steven White' }],
          publicationDate: new Date('2024-02-01'),
        },
      ])
    );
    service.setPluginManager(createMockPluginManager([badPlugin]));

    // dismissed_suggestions lookup
    db.query.mockResolvedValueOnce({ rows: [] });

    const result = await service.getSuggestedPapers('did:plc:aswhite', { limit: 20 });

    // The well-formed paper still scores; the malformed one is simply not matched.
    expect(result.papers.map((p) => p.externalId)).toEqual(['0eIaLDD4zT']);
  });
});
