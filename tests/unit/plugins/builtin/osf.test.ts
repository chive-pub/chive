/**
 * Unit tests for OsfPlugin.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  OsfPlugin,
  type OsfProject,
  type OsfRegistration,
} from '../../../../src/plugins/builtin/osf.js';
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
// Sample Data
// ============================================================================

/**
 * Sample OSF node API response (full fields).
 * Based on the MegaAttitude project.
 */
const SAMPLE_NODE_RESPONSE = {
  data: {
    id: 'abcde',
    attributes: {
      title: 'MegaAttitude: Clause-Embedding Predicate Acceptability',
      description:
        'Acceptability judgments for 1,000 clause-embedding predicates across 50 syntactic frames',
      category: 'project',
      public: true,
      date_created: '2020-01-15T00:00:00Z',
      date_modified: '2020-06-01T00:00:00Z',
      tags: ['linguistics', 'semantics', 'acceptability', 'clause-embedding'],
      registration: false,
    },
    relationships: {
      license: { data: { id: 'MIT', type: 'licenses' } },
      affiliated_institutions: { data: [{ id: 'inst-123' }] },
    },
    links: {
      html: 'https://osf.io/abcde',
      self: 'https://api.osf.io/v2/nodes/abcde/',
    },
  },
};

/**
 * Sample OSF node API response (minimal fields).
 */
const SAMPLE_MINIMAL_NODE_RESPONSE = {
  data: {
    id: 'xyz12',
    attributes: {
      title: 'Decomp Toolkit Data',
    },
  },
};

/**
 * Sample OSF registration API response (full fields).
 * Based on psycholinguistics pre-registration patterns.
 */
const SAMPLE_REGISTRATION_RESPONSE = {
  data: {
    id: 'reg99',
    attributes: {
      title: 'Pre-Registration: Quantifier Processing in English',
      description:
        'Pre-registered study design for investigating the mental representation of universal quantifiers',
      category: 'project',
      public: true,
      date_created: '2022-01-15T00:00:00Z',
      date_modified: '2022-06-01T00:00:00Z',
      date_registered: '2022-02-01T00:00:00Z',
      tags: ['pre-registration', 'psycholinguistics', 'quantifiers'],
      registration: true,
      registration_supplement: 'Open-Ended Registration',
      withdrawn: false,
      embargo_end_date: '2024-12-31T00:00:00Z',
    },
    relationships: {
      license: { data: { id: 'CC-BY-4.0', type: 'licenses' } },
      affiliated_institutions: { data: [] },
    },
    links: {
      html: 'https://osf.io/registrations/reg99',
      self: 'https://api.osf.io/v2/registrations/reg99/',
    },
  },
};

/**
 * Sample OSF contributors API response.
 */
const SAMPLE_CONTRIBUTORS_RESPONSE = {
  data: [
    {
      id: 'contrib-1',
      embeds: {
        users: {
          data: {
            id: 'user-123',
            attributes: {
              full_name: 'Aaron Steven White',
            },
          },
        },
      },
      attributes: {
        bibliographic: true,
      },
    },
    {
      id: 'contrib-2',
      embeds: {
        users: {
          data: {
            id: 'user-456',
            attributes: {
              full_name: 'Kyle Rawlins',
            },
          },
        },
      },
      attributes: {
        bibliographic: false,
      },
    },
  ],
};

/**
 * Sample OSF search results.
 */
const SAMPLE_SEARCH_RESPONSE = {
  data: [
    {
      id: 'search1',
      attributes: {
        title: 'MegaAcceptability Replication Materials',
        category: 'project',
        public: true,
        date_created: '2020-01-01T00:00:00Z',
        date_modified: '2020-01-02T00:00:00Z',
        tags: ['linguistics', 'semantics'],
        registration: false,
      },
      links: {
        html: 'https://osf.io/search1',
      },
    },
    {
      id: 'search2',
      attributes: {
        title: 'Universal Decompositional Semantics Dataset',
        category: 'project',
        public: true,
        date_created: '2020-02-01T00:00:00Z',
        date_modified: '2020-02-02T00:00:00Z',
        tags: [],
        registration: false,
      },
      links: {
        html: 'https://osf.io/search2',
      },
    },
  ],
  meta: {
    total: 2,
  },
};

// ============================================================================
// Testable Subclass (disables rate limiting for tests)
// ============================================================================

/**
 * Testable OsfPlugin that disables rate limiting.
 */
class TestableOsfPlugin extends OsfPlugin {
  constructor() {
    super();
    // Disable rate limiting for tests by setting to 0
    this.rateLimitDelayMs = 0;
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('OsfPlugin', () => {
  let plugin: TestableOsfPlugin;
  let context: IPluginContext;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    context = createMockContext();
    plugin = new TestableOsfPlugin();
    originalFetch = global.fetch;
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
    global.fetch = originalFetch;
  });

  describe('manifest', () => {
    it('should have correct plugin ID', () => {
      expect(plugin.id).toBe('pub.chive.plugin.osf');
    });

    it('should have correct manifest properties', () => {
      expect(plugin.manifest).toMatchObject({
        id: 'pub.chive.plugin.osf',
        name: 'OSF Integration',
        version: '0.1.0',
        description: 'Provides project and registration linking via OSF',
        author: 'Aaron Steven White',
        license: 'MIT',
      });
    });

    it('should declare network permissions for OSF domains', () => {
      expect(plugin.manifest.permissions?.network?.allowedDomains).toContain('api.osf.io');
      expect(plugin.manifest.permissions?.network?.allowedDomains).toContain('osf.io');
    });

    it('should declare storage permissions', () => {
      expect(plugin.manifest.permissions?.storage?.maxSize).toBe(50 * 1024 * 1024);
    });

    it('should have correct entrypoint', () => {
      expect(plugin.manifest.entrypoint).toBe('osf.js');
    });
  });

  describe('initialize', () => {
    it('should log initialization info', async () => {
      await plugin.initialize(context);

      expect(context.logger.info).toHaveBeenCalledWith(
        'OSF plugin initialized',
        expect.objectContaining({
          rateLimit: expect.stringContaining('ms between requests'),
        })
      );
    });

    it('should complete successfully', async () => {
      await expect(plugin.initialize(context)).resolves.toBeUndefined();
    });
  });

  describe('getProject', () => {
    it('should return project from cache if available', async () => {
      await plugin.initialize(context);
      const cachedProject: OsfProject = {
        id: 'abcde',
        title: 'MegaAttitude: Clause-Embedding Predicate Acceptability',
        category: 'project',
        public: true,
        url: 'https://osf.io/abcde',
        tags: [],
        contributors: [],
        dateCreated: '2020-01-15T00:00:00Z',
        dateModified: '2020-06-01T00:00:00Z',
        registration: false,
        affiliatedInstitutions: [],
        source: 'osf',
      };
      vi.mocked(context.cache.get).mockResolvedValueOnce(cachedProject);

      const result = await plugin.getProject('abcde');

      expect(result).toEqual(cachedProject);
      expect(context.cache.get).toHaveBeenCalledWith('osf:node:abcde');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should fetch project from API if not cached', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(SAMPLE_NODE_RESPONSE),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(SAMPLE_CONTRIBUTORS_RESPONSE),
        } as Response);

      const result = await plugin.getProject('abcde');

      expect(result).toMatchObject({
        id: 'abcde',
        title: 'MegaAttitude: Clause-Embedding Predicate Acceptability',
        description:
          'Acceptability judgments for 1,000 clause-embedding predicates across 50 syntactic frames',
        category: 'project',
        public: true,
        source: 'osf',
      });
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.osf.io/v2/nodes/abcde/',
        expect.objectContaining({
          headers: { Accept: 'application/vnd.api+json' },
        })
      );
    });

    it('should cache fetched project', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(SAMPLE_NODE_RESPONSE),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(SAMPLE_CONTRIBUTORS_RESPONSE),
        } as Response);

      await plugin.getProject('abcde');

      expect(context.cache.set).toHaveBeenCalledWith(
        'osf:node:abcde',
        expect.objectContaining({ id: 'abcde' }),
        86400 // 1 day TTL
      );
    });

    it('should include contributors in project data', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(SAMPLE_NODE_RESPONSE),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(SAMPLE_CONTRIBUTORS_RESPONSE),
        } as Response);

      const result = await plugin.getProject('abcde');

      expect(result?.contributors).toHaveLength(2);
      expect(result?.contributors[0]).toMatchObject({
        id: 'user-123',
        fullName: 'Aaron Steven White',
        bibliographic: true,
      });
      expect(result?.contributors[1]).toMatchObject({
        id: 'user-456',
        fullName: 'Kyle Rawlins',
        bibliographic: false,
      });
    });

    it('should return null when project not found (404)', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const result = await plugin.getProject('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null on API error', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const result = await plugin.getProject('abcde');

      expect(result).toBeNull();
      expect(context.logger.warn).toHaveBeenCalledWith(
        'OSF API error',
        expect.objectContaining({
          projectId: 'abcde',
          status: 500,
        })
      );
    });

    it('should return null on exception', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

      const result = await plugin.getProject('abcde');

      expect(result).toBeNull();
      expect(context.logger.warn).toHaveBeenCalledWith(
        'Error fetching OSF project',
        expect.objectContaining({
          projectId: 'abcde',
          error: 'Network error',
        })
      );
    });

    it('should parse project with all fields', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(SAMPLE_NODE_RESPONSE),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: [] }),
        } as Response);

      const result = await plugin.getProject('abcde');

      expect(result).toMatchObject({
        id: 'abcde',
        title: 'MegaAttitude: Clause-Embedding Predicate Acceptability',
        description:
          'Acceptability judgments for 1,000 clause-embedding predicates across 50 syntactic frames',
        category: 'project',
        public: true,
        url: 'https://osf.io/abcde',
        tags: ['linguistics', 'semantics', 'acceptability', 'clause-embedding'],
        license: { id: 'MIT', name: 'MIT' },
        dateCreated: '2020-01-15T00:00:00Z',
        dateModified: '2020-06-01T00:00:00Z',
        registration: false,
        affiliatedInstitutions: ['inst-123'],
        source: 'osf',
      });
    });

    it('should parse project with minimal fields', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(SAMPLE_MINIMAL_NODE_RESPONSE),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: [] }),
        } as Response);

      const result = await plugin.getProject('xyz12');

      expect(result).toMatchObject({
        id: 'xyz12',
        title: 'Decomp Toolkit Data',
        category: 'project',
        public: false,
        tags: [],
        contributors: [],
        registration: false,
        affiliatedInstitutions: [],
        source: 'osf',
      });
    });

    it('should handle contributors fetch failure gracefully', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(SAMPLE_NODE_RESPONSE),
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        } as Response);

      const result = await plugin.getProject('abcde');

      expect(result).toMatchObject({
        id: 'abcde',
        contributors: [],
      });
    });
  });

  describe('getRegistration', () => {
    it('should return registration from cache if available', async () => {
      await plugin.initialize(context);
      const cachedReg: OsfRegistration = {
        id: 'reg99',
        title: 'Pre-Registration: Quantifier Processing in English',
        category: 'project',
        public: true,
        url: 'https://osf.io/registrations/reg99',
        tags: [],
        contributors: [],
        dateCreated: '2022-01-15T00:00:00Z',
        dateModified: '2022-06-01T00:00:00Z',
        registration: true,
        registrationType: 'Open-Ended Registration',
        dateRegistered: '2022-02-01T00:00:00Z',
        withdrawn: false,
        affiliatedInstitutions: [],
        source: 'osf',
      };
      vi.mocked(context.cache.get).mockResolvedValueOnce(cachedReg);

      const result = await plugin.getRegistration('reg99');

      expect(result).toEqual(cachedReg);
      expect(context.cache.get).toHaveBeenCalledWith('osf:registration:reg99');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should fetch registration from API if not cached', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(SAMPLE_REGISTRATION_RESPONSE),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: [] }),
        } as Response);

      const result = await plugin.getRegistration('reg99');

      expect(result).toMatchObject({
        id: 'reg99',
        title: 'Pre-Registration: Quantifier Processing in English',
        registration: true,
        registrationType: 'Open-Ended Registration',
        source: 'osf',
      });
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.osf.io/v2/registrations/reg99/',
        expect.objectContaining({
          headers: { Accept: 'application/vnd.api+json' },
        })
      );
    });

    it('should cache fetched registration', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(SAMPLE_REGISTRATION_RESPONSE),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: [] }),
        } as Response);

      await plugin.getRegistration('reg99');

      expect(context.cache.set).toHaveBeenCalledWith(
        'osf:registration:reg99',
        expect.objectContaining({ id: 'reg99' }),
        86400 // 1 day TTL
      );
    });

    it('should return null when registration not found (404)', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const result = await plugin.getRegistration('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null on API error', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const result = await plugin.getRegistration('reg99');

      expect(result).toBeNull();
      expect(context.logger.warn).toHaveBeenCalledWith(
        'OSF API error',
        expect.objectContaining({
          registrationId: 'reg99',
          status: 500,
        })
      );
    });

    it('should return null on exception', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

      const result = await plugin.getRegistration('reg99');

      expect(result).toBeNull();
      expect(context.logger.warn).toHaveBeenCalledWith(
        'Error fetching OSF registration',
        expect.objectContaining({
          registrationId: 'reg99',
          error: 'Network error',
        })
      );
    });

    it('should parse registration with all fields', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(SAMPLE_REGISTRATION_RESPONSE),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(SAMPLE_CONTRIBUTORS_RESPONSE),
        } as Response);

      const result = await plugin.getRegistration('reg99');

      expect(result).toMatchObject({
        id: 'reg99',
        title: 'Pre-Registration: Quantifier Processing in English',
        description:
          'Pre-registered study design for investigating the mental representation of universal quantifiers',
        category: 'project',
        public: true,
        url: 'https://osf.io/registrations/reg99',
        tags: ['pre-registration', 'psycholinguistics', 'quantifiers'],
        license: { id: 'CC-BY-4.0', name: 'CC-BY-4.0' },
        dateCreated: '2022-01-15T00:00:00Z',
        dateModified: '2022-06-01T00:00:00Z',
        registration: true,
        registrationType: 'Open-Ended Registration',
        dateRegistered: '2022-02-01T00:00:00Z',
        withdrawn: false,
        embargoEndDate: '2024-12-31T00:00:00Z',
        affiliatedInstitutions: [],
        source: 'osf',
        contributors: expect.arrayContaining([
          expect.objectContaining({ fullName: 'Aaron Steven White' }),
          expect.objectContaining({ fullName: 'Kyle Rawlins' }),
        ]),
      });
    });

    it('should handle contributors fetch failure gracefully', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(SAMPLE_REGISTRATION_RESPONSE),
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        } as Response);

      const result = await plugin.getRegistration('reg99');

      expect(result).toMatchObject({
        id: 'reg99',
        contributors: [],
      });
    });
  });

  describe('searchProjects', () => {
    it('should search for projects by title', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE),
      } as Response);

      const results = await plugin.searchProjects('test');

      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({
        id: 'search1',
        title: 'MegaAcceptability Replication Materials',
        source: 'osf',
      });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('filter%5Btitle%5D=test'),
        expect.any(Object)
      );
    });

    it('should use correct API endpoint for project search', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: [] }),
      } as Response);

      await plugin.searchProjects('query');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('api.osf.io/v2/nodes/'),
        expect.objectContaining({
          headers: { Accept: 'application/vnd.api+json' },
        })
      );
    });

    it('should filter for public projects only', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: [] }),
      } as Response);

      await plugin.searchProjects('test');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('filter%5Bpublic%5D=true'),
        expect.any(Object)
      );
    });

    it('should respect limit option', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: [] }),
      } as Response);

      await plugin.searchProjects('test', { limit: 5 });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('page%5Bsize%5D=5'),
        expect.any(Object)
      );
    });

    it('should cap limit at 100', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: [] }),
      } as Response);

      await plugin.searchProjects('test', { limit: 200 });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('page%5Bsize%5D=100'),
        expect.any(Object)
      );
    });

    it('should default to limit of 10', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: [] }),
      } as Response);

      await plugin.searchProjects('test');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('page%5Bsize%5D=10'),
        expect.any(Object)
      );
    });

    it('should return empty array on API error', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const results = await plugin.searchProjects('test');

      expect(results).toEqual([]);
      expect(context.logger.warn).toHaveBeenCalledWith(
        'OSF search error',
        expect.objectContaining({
          query: 'test',
          status: 500,
        })
      );
    });

    it('should return empty array on exception', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

      const results = await plugin.searchProjects('test');

      expect(results).toEqual([]);
      expect(context.logger.warn).toHaveBeenCalledWith(
        'Error searching OSF',
        expect.objectContaining({
          query: 'test',
          error: 'Network error',
        })
      );
    });

    it('should skip invalid nodes in search results', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            data: [
              { id: 'valid', attributes: { title: 'Valid Project' } },
              { id: 'invalid' }, // Missing title
              { attributes: { title: 'No ID' } }, // Missing id
            ],
          }),
      } as Response);

      const results = await plugin.searchProjects('test');

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({ id: 'valid', title: 'Valid Project' });
    });
  });

  describe('searchRegistrations', () => {
    it('should search for registrations by title', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE),
      } as Response);

      const results = await plugin.searchRegistrations('test');

      expect(results).toHaveLength(2);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('api.osf.io/v2/registrations/'),
        expect.any(Object)
      );
    });

    it('should filter for public registrations only', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: [] }),
      } as Response);

      await plugin.searchRegistrations('test');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('filter%5Bpublic%5D=true'),
        expect.any(Object)
      );
    });

    it('should respect limit option', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: [] }),
      } as Response);

      await plugin.searchRegistrations('test', { limit: 20 });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('page%5Bsize%5D=20'),
        expect.any(Object)
      );
    });

    it('should return empty array on API error', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const results = await plugin.searchRegistrations('test');

      expect(results).toEqual([]);
      expect(context.logger.warn).toHaveBeenCalledWith(
        'OSF registration search error',
        expect.objectContaining({
          query: 'test',
          status: 500,
        })
      );
    });

    it('should return empty array on exception', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

      const results = await plugin.searchRegistrations('test');

      expect(results).toEqual([]);
      expect(context.logger.warn).toHaveBeenCalledWith(
        'Error searching OSF registrations',
        expect.objectContaining({
          query: 'test',
          error: 'Network error',
        })
      );
    });
  });

  describe('parseOsfUrl', () => {
    it('should parse node URL', async () => {
      await plugin.initialize(context);

      const result = plugin.parseOsfUrl('https://osf.io/abcde');

      expect(result).toEqual({ type: 'node', id: 'abcde' });
    });

    it('should parse node URL with trailing slash', async () => {
      await plugin.initialize(context);

      const result = plugin.parseOsfUrl('https://osf.io/abcde/');

      expect(result).toEqual({ type: 'node', id: 'abcde' });
    });

    it('should parse registration URL', async () => {
      await plugin.initialize(context);

      const result = plugin.parseOsfUrl('https://osf.io/registrations/reg99');

      expect(result).toEqual({ type: 'registration', id: 'reg99' });
    });

    it('should parse registration URL with trailing slash', async () => {
      await plugin.initialize(context);

      const result = plugin.parseOsfUrl('https://osf.io/registrations/reg99/');

      expect(result).toEqual({ type: 'registration', id: 'reg99' });
    });

    it('should handle uppercase IDs', async () => {
      await plugin.initialize(context);

      const result = plugin.parseOsfUrl('https://osf.io/ABC12');

      expect(result).toEqual({ type: 'node', id: 'ABC12' });
    });

    it('should return null for non-OSF domain', async () => {
      await plugin.initialize(context);

      const result = plugin.parseOsfUrl('https://example.com/abcde');

      expect(result).toBeNull();
    });

    it('should return null for invalid path', async () => {
      await plugin.initialize(context);

      const result = plugin.parseOsfUrl('https://osf.io/invalid/path/abcde');

      expect(result).toBeNull();
    });

    it('should return null for invalid URL', async () => {
      await plugin.initialize(context);

      const result = plugin.parseOsfUrl('not-a-url');

      expect(result).toBeNull();
    });

    it('should return null for wrong ID length', async () => {
      await plugin.initialize(context);

      const result = plugin.parseOsfUrl('https://osf.io/abc'); // Too short

      expect(result).toBeNull();
    });
  });

  describe('rate limiting', () => {
    it('should enforce rate limiting between requests', async () => {
      // Use real OsfPlugin to test rate limiting
      const realPlugin = new OsfPlugin();
      await realPlugin.initialize(context);

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE),
      } as Response);

      const start = Date.now();
      await realPlugin.searchProjects('test1');
      await realPlugin.searchProjects('test2');
      const elapsed = Date.now() - start;

      // Should have waited at least 600ms between requests
      expect(elapsed).toBeGreaterThanOrEqual(600);
    });

    it('should log rate limit in initialization', async () => {
      await plugin.initialize(context);

      expect(context.logger.info).toHaveBeenCalledWith(
        'OSF plugin initialized',
        expect.objectContaining({
          rateLimit: expect.stringContaining('ms between requests'),
        })
      );
    });
  });
});
