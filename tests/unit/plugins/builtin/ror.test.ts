/**
 * Unit tests for RorPlugin.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { RorPlugin } from '../../../../src/plugins/builtin/ror.js';
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
// Sample Data (based on ROR API)
// ============================================================================

/**
 * Sample ROR organization response for University of Rochester.
 *
 * Based on real ROR API response structure for https://ror.org/022kthw22.
 */
const SAMPLE_ROCHESTER_RESPONSE = {
  id: 'https://ror.org/022kthw22',
  name: 'University of Rochester',
  aliases: [],
  acronyms: ['UR'],
  labels: [
    {
      label: 'Universidad de Rochester',
      iso639: 'es',
    },
    {
      label: 'Université de Rochester',
      iso639: 'fr',
    },
  ],
  types: ['Education'],
  country: {
    country_code: 'US',
    country_name: 'United States',
  },
  addresses: [
    {
      city: 'Rochester',
      state: 'New York',
      state_code: 'US-NY',
      lat: 43.12839,
      lng: -77.62666,
    },
  ],
  external_ids: {
    GRID: {
      preferred: 'grid.270240.3',
      all: ['grid.270240.3'],
    },
    ISNI: {
      preferred: '0000 0004 1936 9916',
      all: ['0000 0004 1936 9916'],
    },
    Wikidata: {
      preferred: 'Q149990',
      all: ['Q149990'],
    },
    FundRef: {
      preferred: '100006204',
      all: ['100006204'],
    },
  },
  relationships: [
    {
      type: 'Related',
      id: 'https://ror.org/00hx57361',
      label: 'University of Rochester Medical Center',
    },
  ],
  links: ['https://www.rochester.edu/'],
  wikipedia_url: 'https://en.wikipedia.org/wiki/University_of_Rochester',
  status: 'active',
  established: 1850,
};

/**
 * Sample ROR organization response for Johns Hopkins University.
 *
 * Based on real ROR API response structure for https://ror.org/00za53h95.
 */
const SAMPLE_HOPKINS_RESPONSE = {
  id: 'https://ror.org/00za53h95',
  name: 'Johns Hopkins University',
  aliases: ['JHU'],
  acronyms: [],
  labels: [
    {
      label: 'Universidad Johns Hopkins',
      iso639: 'es',
    },
  ],
  types: ['Education'],
  country: {
    country_code: 'US',
    country_name: 'United States',
  },
  addresses: [
    {
      city: 'Baltimore',
      state: 'Maryland',
      state_code: 'US-MD',
      lat: 39.32995,
      lng: -76.62009,
    },
  ],
  external_ids: {
    GRID: {
      preferred: 'grid.21107.35',
      all: ['grid.21107.35'],
    },
    ISNI: {
      preferred: '0000 0001 2171 9311',
      all: ['0000 0001 2171 9311'],
    },
    Wikidata: {
      preferred: 'Q193727',
      all: ['Q193727'],
    },
  },
  relationships: [
    {
      type: 'Child',
      id: 'https://ror.org/04j198w64',
      label: 'Johns Hopkins University Applied Physics Laboratory',
    },
  ],
  links: ['https://www.jhu.edu/'],
  wikipedia_url: 'https://en.wikipedia.org/wiki/Johns_Hopkins_University',
  status: 'active',
  established: 1876,
};

/**
 * Sample ROR search response.
 */
const SAMPLE_SEARCH_RESPONSE = {
  number_of_results: 2,
  time_taken: 123,
  items: [SAMPLE_ROCHESTER_RESPONSE, SAMPLE_HOPKINS_RESPONSE],
};

// ============================================================================
// Tests
// ============================================================================

describe('RorPlugin', () => {
  let plugin: RorPlugin;
  let context: IPluginContext;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    context = createMockContext();
    plugin = new RorPlugin();
    originalFetch = global.fetch;
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
    global.fetch = originalFetch;
  });

  describe('manifest', () => {
    it('should have correct plugin ID', () => {
      expect(plugin.id).toBe('pub.chive.plugin.ror');
    });

    it('should declare network permissions for ROR API', () => {
      expect(plugin.manifest.permissions?.network?.allowedDomains).toContain('api.ror.org');
    });

    it('should have correct plugin name', () => {
      expect(plugin.manifest.name).toBe('ROR Integration');
    });

    it('should have correct version', () => {
      expect(plugin.manifest.version).toBe('0.1.0');
    });

    it('should declare storage permissions for caching', () => {
      expect(plugin.manifest.permissions?.storage?.maxSize).toBe(50 * 1024 * 1024);
    });
  });

  describe('initialize', () => {
    it('should log initialization info', async () => {
      await plugin.initialize(context);

      expect(context.logger.info).toHaveBeenCalledWith(
        'ROR plugin initialized',
        expect.objectContaining({
          rateLimit: '200ms between requests',
        })
      );
    });
  });

  describe('getOrganization', () => {
    it('should return cached organization if available', async () => {
      await plugin.initialize(context);
      const cachedOrg = {
        id: 'https://ror.org/022kthw22',
        name: 'Cached University',
        aliases: [],
        acronyms: [],
        labels: [],
        types: ['Education'] as const,
        country: { countryCode: 'US', countryName: 'United States' },
        addresses: [],
        externalIds: {},
        relationships: [],
        links: [],
        status: 'active' as const,
        source: 'ror' as const,
      };
      vi.mocked(context.cache.get).mockResolvedValueOnce(cachedOrg);

      const result = await plugin.getOrganization('022kthw22');

      expect(result).toEqual(cachedOrg);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should fetch from API if not cached', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_ROCHESTER_RESPONSE),
      } as Response);

      const result = await plugin.getOrganization('022kthw22');

      expect(result?.id).toBe('https://ror.org/022kthw22');
      expect(result?.name).toBe('University of Rochester');
      expect(context.cache.set).toHaveBeenCalled();
    });

    it('should normalize ROR ID with https://ror.org/ prefix', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_ROCHESTER_RESPONSE),
      } as Response);

      await plugin.getOrganization('https://ror.org/022kthw22');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('022kthw22'),
        expect.any(Object)
      );
    });

    it('should normalize ROR ID with http://ror.org/ prefix', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_ROCHESTER_RESPONSE),
      } as Response);

      await plugin.getOrganization('http://ror.org/022kthw22');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('022kthw22'),
        expect.any(Object)
      );
    });

    it('should return null for invalid ROR ID format', async () => {
      await plugin.initialize(context);

      const result = await plugin.getOrganization('invalid-ror-id');

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

      const result = await plugin.getOrganization('022kthw22');

      expect(result).toBeNull();
    });

    it('should return null on API error', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const result = await plugin.getOrganization('022kthw22');

      expect(result).toBeNull();
      expect(context.logger.warn).toHaveBeenCalledWith('ROR API error', expect.any(Object));
    });

    it('should parse organization types correctly', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_ROCHESTER_RESPONSE),
      } as Response);

      const result = await plugin.getOrganization('022kthw22');

      expect(result?.types).toEqual(['Education']);
    });

    it('should parse external IDs correctly', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_ROCHESTER_RESPONSE),
      } as Response);

      const result = await plugin.getOrganization('022kthw22');

      expect(result?.externalIds.GRID).toBe('grid.270240.3');
      expect(result?.externalIds.ISNI).toEqual(['0000 0004 1936 9916']);
      expect(result?.externalIds.Wikidata).toBe('Q149990');
      expect(result?.externalIds.FundRef).toEqual(['100006204']);
    });

    it('should parse relationships correctly', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_ROCHESTER_RESPONSE),
      } as Response);

      const result = await plugin.getOrganization('022kthw22');

      expect(result?.relationships).toHaveLength(1);
      expect(result?.relationships[0]).toMatchObject({
        type: 'Related',
        id: 'https://ror.org/00hx57361',
        label: 'University of Rochester Medical Center',
      });
    });

    it('should parse labels correctly', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_ROCHESTER_RESPONSE),
      } as Response);

      const result = await plugin.getOrganization('022kthw22');

      expect(result?.labels).toHaveLength(2);
      expect(result?.labels[0]).toMatchObject({
        label: 'Universidad de Rochester',
        iso639: 'es',
      });
    });

    it('should include established year', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_ROCHESTER_RESPONSE),
      } as Response);

      const result = await plugin.getOrganization('022kthw22');

      expect(result?.established).toBe(1850);
    });

    it('should set source to "ror"', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_ROCHESTER_RESPONSE),
      } as Response);

      const result = await plugin.getOrganization('022kthw22');

      expect(result?.source).toBe('ror');
    });

    it('should handle network errors gracefully', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

      const result = await plugin.getOrganization('022kthw22');

      expect(result).toBeNull();
      expect(context.logger.warn).toHaveBeenCalledWith(
        'Error fetching ROR organization',
        expect.objectContaining({
          rorId: '022kthw22',
          error: 'Network error',
        })
      );
    });
  });

  describe('searchOrganizations', () => {
    it('should search organizations by query', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE),
      } as Response);

      const results = await plugin.searchOrganizations('Rochester');

      expect(results).toHaveLength(2);
      expect(results[0]?.name).toBe('University of Rochester');
      expect(results[1]?.name).toBe('Johns Hopkins University');
    });

    it('should respect limit option', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE),
      } as Response);

      const results = await plugin.searchOrganizations('test', { limit: 1 });

      expect(results).toHaveLength(1);
    });

    it('should use default limit of 20', async () => {
      await plugin.initialize(context);
      const manyResults = {
        number_of_results: 30,
        time_taken: 100,
        items: Array(30).fill(SAMPLE_ROCHESTER_RESPONSE),
      };
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(manyResults),
      } as Response);

      const results = await plugin.searchOrganizations('test');

      expect(results.length).toBeLessThanOrEqual(20);
    });

    it('should include filter if provided', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE),
      } as Response);

      await plugin.searchOrganizations('test', { filter: 'country.country_code:US' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('filter=country.country_code%3AUS'),
        expect.any(Object)
      );
    });

    it('should return empty array on API error', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const results = await plugin.searchOrganizations('test');

      expect(results).toEqual([]);
      expect(context.logger.warn).toHaveBeenCalledWith('ROR search error', expect.any(Object));
    });

    it('should handle network errors gracefully', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

      const results = await plugin.searchOrganizations('test');

      expect(results).toEqual([]);
      expect(context.logger.warn).toHaveBeenCalledWith(
        'Error searching ROR',
        expect.objectContaining({
          query: 'test',
          error: 'Network error',
        })
      );
    });

    it('should filter out malformed organizations', async () => {
      await plugin.initialize(context);
      const responseWithBadData = {
        number_of_results: 2,
        time_taken: 100,
        items: [
          SAMPLE_ROCHESTER_RESPONSE,
          { id: null, name: null }, // Missing required fields
        ],
      };
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(responseWithBadData),
      } as Response);

      const results = await plugin.searchOrganizations('test');

      expect(results).toHaveLength(1);
      expect(results[0]?.name).toBe('University of Rochester');
    });
  });

  describe('findByEmailDomain', () => {
    it('should find organizations by email domain', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE),
      } as Response);

      const results = await plugin.findByEmailDomain('rochester.edu');

      expect(results.length).toBeGreaterThan(0);
      const rochester = results.find((org) => org.name === 'University of Rochester');
      expect(rochester).toBeDefined();
    });

    it('should extract root domain from subdomain', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE),
      } as Response);

      await plugin.findByEmailDomain('cs.rochester.edu');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('rochester.edu'),
        expect.any(Object)
      );
    });

    it('should filter results by link domain match', async () => {
      await plugin.initialize(context);
      const responseWithMismatch = {
        number_of_results: 2,
        time_taken: 100,
        items: [
          SAMPLE_ROCHESTER_RESPONSE,
          {
            ...SAMPLE_HOPKINS_RESPONSE,
            links: ['https://example.com/'], // Doesn't match rochester.edu
          },
        ],
      };
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(responseWithMismatch),
      } as Response);

      const results = await plugin.findByEmailDomain('rochester.edu');

      expect(results).toHaveLength(1);
      expect(results[0]?.name).toBe('University of Rochester');
    });

    it('should handle malformed URLs in links gracefully', async () => {
      await plugin.initialize(context);
      const responseWithBadUrl = {
        number_of_results: 1,
        time_taken: 100,
        items: [
          {
            ...SAMPLE_ROCHESTER_RESPONSE,
            links: ['not-a-valid-url', 'https://www.rochester.edu/'],
          },
        ],
      };
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(responseWithBadUrl),
      } as Response);

      const results = await plugin.findByEmailDomain('rochester.edu');

      expect(results).toHaveLength(1);
    });
  });

  describe('verifyEmailDomain', () => {
    it('should return first matching organization', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE),
      } as Response);

      const result = await plugin.verifyEmailDomain('rochester.edu');

      expect(result).not.toBeNull();
      expect(result?.name).toBe('University of Rochester');
    });

    it('should return null if no matches found', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            number_of_results: 0,
            time_taken: 50,
            items: [],
          }),
      } as Response);

      const result = await plugin.verifyEmailDomain('nonexistent.edu');

      expect(result).toBeNull();
    });
  });

  describe('getByExternalId', () => {
    it('should find organization by GRID ID', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            number_of_results: 1,
            time_taken: 100,
            items: [SAMPLE_ROCHESTER_RESPONSE],
          }),
      } as Response);

      const result = await plugin.getByExternalId('GRID', 'grid.270240.3');

      expect(result?.name).toBe('University of Rochester');
      // URL will contain filter with grid identifier (URL-encoded)
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/filter.*grid.*270240/),
        expect.any(Object)
      );
    });

    it('should find organization by ISNI', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            number_of_results: 1,
            time_taken: 100,
            items: [SAMPLE_ROCHESTER_RESPONSE],
          }),
      } as Response);

      const result = await plugin.getByExternalId('ISNI', '0000 0004 1936 9916');

      expect(result?.name).toBe('University of Rochester');
      // URL will contain filter with isni identifier (URL-encoded)
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/filter.*isni/i),
        expect.any(Object)
      );
    });

    it('should find organization by Wikidata ID', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            number_of_results: 1,
            time_taken: 100,
            items: [SAMPLE_ROCHESTER_RESPONSE],
          }),
      } as Response);

      const result = await plugin.getByExternalId('Wikidata', 'Q149990');

      expect(result?.name).toBe('University of Rochester');
      // URL will contain filter with wikidata identifier (URL-encoded)
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/filter.*wikidata.*Q149990/i),
        expect.any(Object)
      );
    });

    it('should find organization by FundRef ID', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            number_of_results: 1,
            time_taken: 100,
            items: [SAMPLE_ROCHESTER_RESPONSE],
          }),
      } as Response);

      const result = await plugin.getByExternalId('FundRef', '100006204');

      expect(result?.name).toBe('University of Rochester');
    });

    it('should return null if no matches found', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            number_of_results: 0,
            time_taken: 50,
            items: [],
          }),
      } as Response);

      const result = await plugin.getByExternalId('GRID', 'nonexistent');

      expect(result).toBeNull();
    });

    it('should return null on API error', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const result = await plugin.getByExternalId('GRID', 'grid.270240.3');

      expect(result).toBeNull();
      expect(context.logger.warn).toHaveBeenCalledWith(
        'ROR external ID lookup error',
        expect.any(Object)
      );
    });

    it('should handle network errors gracefully', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

      const result = await plugin.getByExternalId('GRID', 'grid.270240.3');

      expect(result).toBeNull();
      expect(context.logger.warn).toHaveBeenCalledWith(
        'Error looking up ROR by external ID',
        expect.objectContaining({
          type: 'GRID',
          id: 'grid.270240.3',
          error: 'Network error',
        })
      );
    });
  });
});
