/**
 * Unit tests for WikidataPlugin.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { WikidataPlugin } from '../../../../src/plugins/builtin/wikidata.js';
import type { ILogger } from '../../../../src/types/interfaces/logger.interface.js';
import type {
  ICacheProvider,
  IMetrics,
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

const createMockContext = (overrides?: Partial<IPluginContext>): IPluginContext => ({
  logger: createMockLogger(),
  cache: createMockCache(),
  metrics: createMockMetrics(),
  eventBus: createMockEventBus(),
  config: {},
  ...overrides,
});

// ============================================================================
// Sample Data (based on Wikidata API)
// ============================================================================

/**
 * Sample Wikidata entity response for Q82042 (generative grammar).
 *
 * Based on real Wikidata API response structure.
 */
const SAMPLE_ENTITY_RESPONSE = {
  entities: {
    Q82042: {
      id: 'Q82042',
      type: 'item',
      labels: {
        en: { value: 'generative grammar' },
        de: { value: 'generative Grammatik' },
        fr: { value: 'grammaire générative' },
      },
      descriptions: {
        en: { value: 'linguistic theory in linguistics' },
        de: { value: 'Theorie der Linguistik' },
        fr: { value: 'théorie linguistique' },
      },
      aliases: {
        en: [{ value: 'generative linguistics' }, { value: 'transformational grammar' }],
      },
      claims: {
        P31: [
          {
            id: 'Q82042$1',
            rank: 'normal',
            mainsnak: {
              property: 'P31',
              datatype: 'wikibase-item',
              datavalue: {
                type: 'wikibase-entityid',
                value: { id: 'Q17524285' },
              },
            },
          },
        ],
        P279: [
          {
            id: 'Q82042$2',
            rank: 'normal',
            mainsnak: {
              property: 'P279',
              datatype: 'wikibase-item',
              datavalue: {
                type: 'wikibase-entityid',
                value: { id: 'Q8366' },
              },
            },
          },
        ],
        P50: [
          {
            id: 'Q82042$3',
            rank: 'preferred',
            mainsnak: {
              property: 'P50',
              datatype: 'wikibase-item',
              datavalue: {
                type: 'wikibase-entityid',
                value: { id: 'Q9049' },
              },
            },
            qualifiers: {
              P580: [
                {
                  property: 'P580',
                  datatype: 'time',
                  datavalue: {
                    type: 'time',
                    value: { time: '+1957-00-00T00:00:00Z', precision: 9 },
                  },
                },
              ],
            },
          },
        ],
      },
      sitelinks: {
        enwiki: {
          site: 'enwiki',
          title: 'Generative grammar',
          url: 'https://en.wikipedia.org/wiki/Generative_grammar',
        },
        dewiki: {
          site: 'dewiki',
          title: 'Generative Grammatik',
          url: 'https://de.wikipedia.org/wiki/Generative_Grammatik',
        },
      },
      modified: '2024-03-15T10:30:00Z',
    },
  },
};

/**
 * Sample Wikidata entity response for Q9049 (Noam Chomsky).
 */
const SAMPLE_PERSON_ENTITY_RESPONSE = {
  entities: {
    Q9049: {
      id: 'Q9049',
      type: 'item',
      labels: {
        en: { value: 'Noam Chomsky' },
      },
      descriptions: {
        en: { value: 'American linguist and activist' },
      },
      aliases: {
        en: [{ value: 'Avram Noam Chomsky' }],
      },
      claims: {
        P496: [
          {
            id: 'Q9049$1',
            rank: 'normal',
            mainsnak: {
              property: 'P496',
              datatype: 'external-id',
              datavalue: {
                type: 'string',
                value: '0000-0003-2055-3207',
              },
            },
          },
        ],
      },
      sitelinks: {
        enwiki: {
          site: 'enwiki',
          title: 'Noam Chomsky',
          url: 'https://en.wikipedia.org/wiki/Noam_Chomsky',
        },
      },
      modified: '2024-03-10T08:00:00Z',
    },
  },
};

/**
 * Sample Wikidata search response.
 */
const SAMPLE_SEARCH_RESPONSE = {
  search: [
    {
      id: 'Q82042',
      label: 'generative grammar',
      description: 'linguistic theory in linguistics',
    },
    {
      id: 'Q8366',
      label: 'grammar',
      description: 'system of rules for a language',
    },
  ],
};

/**
 * Sample SPARQL query result.
 */
const SAMPLE_SPARQL_RESULT = {
  head: {
    vars: ['item', 'label'],
  },
  results: {
    bindings: [
      {
        item: {
          type: 'uri',
          value: 'http://www.wikidata.org/entity/Q82042',
        },
        label: {
          type: 'literal',
          value: 'generative grammar',
          'xml:lang': 'en',
        },
      },
    ],
  },
};

/**
 * Sample batch entity response.
 */
const SAMPLE_BATCH_ENTITY_RESPONSE = {
  entities: {
    Q82042: SAMPLE_ENTITY_RESPONSE.entities.Q82042,
    Q9049: SAMPLE_PERSON_ENTITY_RESPONSE.entities.Q9049,
  },
};

// ============================================================================
// Tests
// ============================================================================

describe('WikidataPlugin', () => {
  let plugin: WikidataPlugin;
  let context: IPluginContext;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    context = createMockContext();
    plugin = new WikidataPlugin();
    originalFetch = global.fetch;
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
    global.fetch = originalFetch;
  });

  describe('manifest', () => {
    it('should have correct plugin ID', () => {
      expect(plugin.id).toBe('pub.chive.plugin.wikidata');
    });

    it('should declare network permissions for Wikidata APIs', () => {
      expect(plugin.manifest.permissions?.network?.allowedDomains).toContain('www.wikidata.org');
      expect(plugin.manifest.permissions?.network?.allowedDomains).toContain('query.wikidata.org');
    });

    it('should declare storage permissions for caching', () => {
      expect(plugin.manifest.permissions?.storage?.maxSize).toBe(100 * 1024 * 1024);
    });
  });

  describe('initialize', () => {
    it('should log initialization info', async () => {
      await plugin.initialize(context);

      expect(context.logger.info).toHaveBeenCalledWith(
        'Wikidata plugin initialized',
        expect.objectContaining({
          rateLimit: expect.stringContaining('ms between requests'),
        })
      );
    });
  });

  describe('getEntity', () => {
    it('should return cached entity if available', async () => {
      await plugin.initialize(context);
      const cachedEntity = {
        id: 'Q82042',
        type: 'item' as const,
        labels: { en: 'Cached Entity' },
        descriptions: {},
        aliases: {},
        claims: {},
        source: 'wikidata' as const,
      };
      vi.mocked(context.cache.get).mockResolvedValueOnce(cachedEntity);

      const result = await plugin.getEntity('Q82042');

      expect(result).toEqual(cachedEntity);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should fetch from API if not cached', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_ENTITY_RESPONSE),
      } as Response);

      const result = await plugin.getEntity('Q82042');

      expect(result?.id).toBe('Q82042');
      expect(result?.labels.en).toBe('generative grammar');
      expect(result?.descriptions.en).toBe('linguistic theory in linguistics');
      expect(context.cache.set).toHaveBeenCalled();
    });

    it('should normalize ID by removing URL prefixes', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_ENTITY_RESPONSE),
      } as Response);

      await plugin.getEntity('https://www.wikidata.org/entity/Q82042');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('ids=Q82042'),
        expect.any(Object)
      );
    });

    it('should normalize ID to uppercase', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_ENTITY_RESPONSE),
      } as Response);

      await plugin.getEntity('q82042');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('ids=Q82042'),
        expect.any(Object)
      );
    });

    it('should return null for invalid ID format', async () => {
      await plugin.initialize(context);

      const result = await plugin.getEntity('not-a-valid-id');

      expect(result).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should return null on 404', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const result = await plugin.getEntity('Q999999999');

      expect(result).toBeNull();
    });

    it('should return null on API error', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const result = await plugin.getEntity('Q82042');

      expect(result).toBeNull();
      expect(context.logger.warn).toHaveBeenCalledWith('Wikidata API error', expect.any(Object));
    });

    it('should support multiple languages', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_ENTITY_RESPONSE),
      } as Response);

      await plugin.getEntity('Q82042', { languages: ['en', 'de', 'fr'] });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('languages=en%7Cde%7Cfr'),
        expect.any(Object)
      );
    });

    it('should parse labels correctly', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_ENTITY_RESPONSE),
      } as Response);

      const result = await plugin.getEntity('Q82042', { languages: ['en', 'de', 'fr'] });

      expect(result?.labels).toEqual({
        en: 'generative grammar',
        de: 'generative Grammatik',
        fr: 'grammaire générative',
      });
    });

    it('should parse descriptions correctly', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_ENTITY_RESPONSE),
      } as Response);

      const result = await plugin.getEntity('Q82042');

      expect(result?.descriptions.en).toBe('linguistic theory in linguistics');
    });

    it('should parse aliases correctly', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_ENTITY_RESPONSE),
      } as Response);

      const result = await plugin.getEntity('Q82042');

      expect(result?.aliases.en).toContain('generative linguistics');
      expect(result?.aliases.en).toContain('transformational grammar');
    });

    it('should parse claims correctly', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_ENTITY_RESPONSE),
      } as Response);

      const result = await plugin.getEntity('Q82042');

      expect(result?.claims.P31).toBeDefined();
      expect(result?.claims.P31?.[0]?.mainsnak.property).toBe('P31');
      expect(result?.claims.P31?.[0]?.rank).toBe('normal');
    });

    it('should parse entity ID values in claims', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_ENTITY_RESPONSE),
      } as Response);

      const result = await plugin.getEntity('Q82042');

      const instanceOfClaim = result?.claims.P31?.[0];
      expect(instanceOfClaim?.mainsnak.value).toEqual({ id: 'Q17524285' });
    });

    it('should parse qualifiers in claims', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_ENTITY_RESPONSE),
      } as Response);

      const result = await plugin.getEntity('Q82042');

      const authorClaim = result?.claims.P50?.[0];
      expect(authorClaim?.qualifiers?.P580).toBeDefined();
      expect(authorClaim?.qualifiers?.P580?.[0]?.property).toBe('P580');
    });

    it('should parse sitelinks correctly', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_ENTITY_RESPONSE),
      } as Response);

      const result = await plugin.getEntity('Q82042');

      expect(result?.sitelinks?.enwiki).toEqual({
        site: 'enwiki',
        title: 'Generative grammar',
        url: 'https://en.wikipedia.org/wiki/Generative_grammar',
      });
    });

    it('should use polite User-Agent', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_ENTITY_RESPONSE),
      } as Response);

      await plugin.getEntity('Q82042');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.stringContaining('Chive-AppView'),
          }),
        })
      );
    });
  });

  describe('getEntities', () => {
    it('should fetch multiple entities in batch', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_BATCH_ENTITY_RESPONSE),
      } as Response);

      const result = await plugin.getEntities(['Q82042', 'Q9049']);

      expect(result.size).toBe(2);
      expect(result.get('Q82042')?.labels.en).toBe('generative grammar');
      expect(result.get('Q9049')?.labels.en).toBe('Noam Chomsky');
    });

    it('should normalize IDs in batch', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_BATCH_ENTITY_RESPONSE),
      } as Response);

      await plugin.getEntities(['q82042', 'Q9049']);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('ids=Q82042%7CQ9049'),
        expect.any(Object)
      );
    });

    it('should filter out invalid IDs', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_BATCH_ENTITY_RESPONSE),
      } as Response);

      await plugin.getEntities(['Q82042', 'invalid', 'Q9049']);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('ids=Q82042%7CQ9049'),
        expect.any(Object)
      );
    });

    it('should handle API errors gracefully', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const result = await plugin.getEntities(['Q82042', 'Q9049']);

      expect(result.size).toBe(0);
      expect(context.logger.warn).toHaveBeenCalledWith(
        'Wikidata batch API error',
        expect.any(Object)
      );
    });

    it('should batch large requests', async () => {
      await plugin.initialize(context);
      const ids = Array.from({ length: 75 }, (_, i) => `Q${i + 1}`);

      // Mock two batches (50 + 25)
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ entities: {} }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ entities: {} }),
        } as Response);

      await plugin.getEntities(ids);

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('searchEntities', () => {
    it('should search for entities by query', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(SAMPLE_BATCH_ENTITY_RESPONSE),
        } as Response);

      const results = await plugin.searchEntities('generative grammar');

      expect(results).toHaveLength(2);
      expect(results[0]?.id).toBe('Q82042');
    });

    it('should respect limit option', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(SAMPLE_BATCH_ENTITY_RESPONSE),
        } as Response);

      await plugin.searchEntities('test', { limit: 20 });

      expect(global.fetch).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('limit=20'),
        expect.any(Object)
      );
    });

    it('should cap limit at 50', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(SAMPLE_BATCH_ENTITY_RESPONSE),
        } as Response);

      await plugin.searchEntities('test', { limit: 100 });

      expect(global.fetch).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('limit=50'),
        expect.any(Object)
      );
    });

    it('should support language option', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(SAMPLE_BATCH_ENTITY_RESPONSE),
        } as Response);

      await plugin.searchEntities('test', { language: 'de' });

      expect(global.fetch).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('language=de'),
        expect.any(Object)
      );
    });

    it('should support type option', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(SAMPLE_BATCH_ENTITY_RESPONSE),
        } as Response);

      await plugin.searchEntities('test', { type: 'property' });

      expect(global.fetch).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('type=property'),
        expect.any(Object)
      );
    });

    it('should return empty array on search error', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const results = await plugin.searchEntities('test');

      expect(results).toEqual([]);
      expect(context.logger.warn).toHaveBeenCalledWith('Wikidata search error', expect.any(Object));
    });

    it('should return empty array when no results found', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ search: [] }),
      } as Response);

      const results = await plugin.searchEntities('nonexistent');

      expect(results).toEqual([]);
    });
  });

  describe('sparqlQuery', () => {
    it('should execute SPARQL query', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_SPARQL_RESULT),
      } as Response);

      const result = await plugin.sparqlQuery('SELECT ?item WHERE { ?item wdt:P31 wd:Q82042 }');

      expect(result?.results?.bindings).toHaveLength(1);
      expect(result?.results?.bindings?.[0]?.item?.value).toContain('Q82042');
    });

    it('should send query as POST with correct headers', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_SPARQL_RESULT),
      } as Response);

      await plugin.sparqlQuery('SELECT ?item WHERE { ?item wdt:P31 wd:Q82042 }');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://query.wikidata.org/sparql',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/sparql-results+json',
          }),
        })
      );
    });

    it('should URL encode query', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_SPARQL_RESULT),
      } as Response);

      await plugin.sparqlQuery('SELECT ?item WHERE { ?item wdt:P31 wd:Q82042 }');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('query='),
        })
      );
    });

    it('should return null on query error', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const result = await plugin.sparqlQuery('INVALID QUERY');

      expect(result).toBeNull();
      expect(context.logger.warn).toHaveBeenCalledWith('SPARQL query error', expect.any(Object));
    });
  });

  describe('getEntityByExternalId', () => {
    it('should find entity by DOI', async () => {
      await plugin.initialize(context);

      // Mock SPARQL query response
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            head: { vars: ['item'] },
            results: {
              bindings: [
                {
                  item: {
                    type: 'uri',
                    value: 'http://www.wikidata.org/entity/Q82042',
                  },
                },
              ],
            },
          }),
      } as Response);

      // Mock getEntity call
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_ENTITY_RESPONSE),
      } as Response);

      const result = await plugin.getEntityByExternalId('P356', '10.5334/gjgl.1001');

      expect(result?.id).toBe('Q82042');
    });

    it('should find entity by ORCID', async () => {
      await plugin.initialize(context);

      // Mock SPARQL query response
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            head: { vars: ['item'] },
            results: {
              bindings: [
                {
                  item: {
                    type: 'uri',
                    value: 'http://www.wikidata.org/entity/Q9049',
                  },
                },
              ],
            },
          }),
      } as Response);

      // Mock getEntity call
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_PERSON_ENTITY_RESPONSE),
      } as Response);

      const result = await plugin.getEntityByExternalId(
        WikidataPlugin.PROPERTIES.ORCID,
        '0000-0003-2055-3207'
      );

      expect(result?.id).toBe('Q9049');
    });

    it('should return null when no entity found', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            head: { vars: ['item'] },
            results: { bindings: [] },
          }),
      } as Response);

      const result = await plugin.getEntityByExternalId('P356', 'nonexistent');

      expect(result).toBeNull();
    });

    it('should return null on SPARQL error', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const result = await plugin.getEntityByExternalId('P356', '10.5334/gjgl.1001');

      expect(result).toBeNull();
    });
  });

  describe('PROPERTIES', () => {
    it('should define common property IDs', () => {
      expect(WikidataPlugin.PROPERTIES.DOI).toBe('P356');
      expect(WikidataPlugin.PROPERTIES.ORCID).toBe('P496');
      expect(WikidataPlugin.PROPERTIES.VIAF).toBe('P214');
      expect(WikidataPlugin.PROPERTIES.ISNI).toBe('P213');
      expect(WikidataPlugin.PROPERTIES.ROR).toBe('P6782');
      expect(WikidataPlugin.PROPERTIES.ARXIV).toBe('P818');
      expect(WikidataPlugin.PROPERTIES.PUBMED).toBe('P698');
      expect(WikidataPlugin.PROPERTIES.INSTANCE_OF).toBe('P31');
      expect(WikidataPlugin.PROPERTIES.SUBCLASS_OF).toBe('P279');
    });
  });
});
