/**
 * Unit tests for SoftwareHeritagePlugin.
 *
 * @remarks
 * Tests Software Heritage API integration for code archival verification,
 * SWHID lookup, and SAVE API requests.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { SoftwareHeritagePlugin } from '../../../../src/plugins/builtin/software-heritage.js';
import type { ICacheProvider } from '../../../../src/types/interfaces/cache.interface.js';
import type { ILogger } from '../../../../src/types/interfaces/logger.interface.js';
import type { IMetrics } from '../../../../src/types/interfaces/metrics.interface.js';
import type {
  IPluginContext,
  IPluginEventBus,
} from '../../../../src/types/interfaces/plugin.interface.js';
import { PluginState } from '../../../../src/types/interfaces/plugin.interface.js';

// ============================================================================
// Test Subclass
// ============================================================================

/**
 * Testable SoftwareHeritagePlugin that exposes protected members for testing.
 */
class TestableSoftwareHeritagePlugin extends SoftwareHeritagePlugin {
  /** Disables rate limiting for fast tests. */
  disableRateLimiting(): void {
    this.rateLimitDelayMs = 0;
  }
}

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
// Sample Data: Real Software Heritage API Responses
// ============================================================================

/**
 * Sample origin response for a linguistics research repository.
 * Based on real Software Heritage API format for GitHub origins.
 */
const SAMPLE_ORIGIN_RESPONSE = {
  url: 'https://github.com/awhite-AFRL/MegaAttitude',
};

/**
 * Sample visits response for a repository.
 * Based on actual Software Heritage visit metadata.
 */
const SAMPLE_VISITS_RESPONSE = [
  {
    visit: 1,
    date: '2024-01-15T10:30:00.000000+00:00',
    status: 'full',
    type: 'git',
    snapshot: 'c7c108084bc0bf3d81436bf980b46e98bd338453',
  },
  {
    visit: 2,
    date: '2024-02-20T14:45:00.000000+00:00',
    status: 'full',
    type: 'git',
    snapshot: 'd8d209195cd1cg4e92547cg091c57f09ce449564',
  },
];

/**
 * Sample revision (commit) response.
 * Based on real Software Heritage revision metadata for linguistics research.
 */
const SAMPLE_REVISION_RESPONSE = {
  id: '3a4f5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a',
  message: 'Add MegaAttitude dataset with acceptability judgments for attitude predicates',
  author: {
    name: 'Aaron Steven White',
    email: 'aaron.white@rochester.edu',
  },
  committer: {
    name: 'Aaron Steven White',
    email: 'aaron.white@rochester.edu',
  },
  date: '2024-01-15T10:30:00.000000+00:00',
  directory: '5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f',
  parents: [{ id: '2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c' }],
};

/**
 * Sample SAVE API request response.
 * Based on actual Software Heritage SAVE API format.
 */
const SAMPLE_SAVE_REQUEST_RESPONSE = {
  origin_url: 'https://github.com/awhite-AFRL/MegaAcceptability',
  save_request_status: 'pending',
  save_task_status: 'not yet scheduled',
  visit_type: 'git',
  request_date: '2024-03-01T12:00:00.000000+00:00',
};

/**
 * Sample SAVE API status response (succeeded).
 */
const SAMPLE_SAVE_STATUS_SUCCEEDED = [
  {
    origin_url: 'https://github.com/awhite-AFRL/MegaAcceptability',
    save_request_status: 'succeeded',
    save_task_status: 'succeeded',
    visit_type: 'git',
    request_date: '2024-03-01T12:00:00.000000+00:00',
    visit_date: '2024-03-01T14:30:00.000000+00:00',
  },
];

/**
 * Sample SWHID resolve response.
 */
const SAMPLE_RESOLVE_RESPONSE = {
  browse_url:
    'https://archive.softwareheritage.org/browse/revision/3a4f5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a/',
};

// ============================================================================
// Tests
// ============================================================================

describe('SoftwareHeritagePlugin', () => {
  let plugin: TestableSoftwareHeritagePlugin;
  let context: IPluginContext;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    context = createMockContext();
    plugin = new TestableSoftwareHeritagePlugin();
    plugin.disableRateLimiting();
    originalFetch = global.fetch;
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
    global.fetch = originalFetch;
  });

  describe('manifest', () => {
    it('should have correct plugin ID', () => {
      expect(plugin.id).toBe('pub.chive.plugin.software-heritage');
    });

    it('should match ID in manifest', () => {
      expect(plugin.manifest.id).toBe('pub.chive.plugin.software-heritage');
    });

    it('should have correct plugin name', () => {
      expect(plugin.manifest.name).toBe('Software Heritage Integration');
    });

    it('should declare network permissions for archive.softwareheritage.org', () => {
      expect(plugin.manifest.permissions?.network?.allowedDomains).toContain(
        'archive.softwareheritage.org'
      );
    });

    it('should declare storage limit', () => {
      expect(plugin.manifest.permissions?.storage?.maxSize).toBe(20 * 1024 * 1024); // 20MB
    });

    it('should have correct version', () => {
      expect(plugin.manifest.version).toBe('0.1.0');
    });
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      await plugin.initialize(context);

      expect(plugin.getState()).toBe(PluginState.READY);
    });

    it('should log initialization info', async () => {
      await plugin.initialize(context);

      expect(context.logger.info).toHaveBeenCalledWith(
        'Software Heritage plugin initialized',
        expect.objectContaining({
          rateLimit: expect.any(String),
        })
      );
    });

    it('should transition from UNINITIALIZED to READY state', async () => {
      expect(plugin.getState()).toBe(PluginState.UNINITIALIZED);
      await plugin.initialize(context);
      expect(plugin.getState()).toBe(PluginState.READY);
    });
  });

  describe('getOrigin', () => {
    const repoUrl = 'https://github.com/awhite-AFRL/MegaAttitude';

    it('should fetch origin metadata from API', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(SAMPLE_ORIGIN_RESPONSE),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(SAMPLE_VISITS_RESPONSE),
        });

      await plugin.initialize(context);
      const origin = await plugin.getOrigin(repoUrl);

      expect(origin).toBeTruthy();
      expect(origin?.url).toBe(repoUrl);
      expect(origin?.source).toBe('softwareheritage');
      expect(origin?.visits).toHaveLength(2);
      expect(origin?.lastVisit).toBe('2024-02-20T14:45:00.000000+00:00');
    });

    it('should encode URL properly in API request', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_ORIGIN_RESPONSE),
      });

      await plugin.initialize(context);
      await plugin.getOrigin(repoUrl);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent(repoUrl)),
        expect.any(Object)
      );
    });

    it('should return null for 404 (not archived)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      await plugin.initialize(context);
      const origin = await plugin.getOrigin(repoUrl);

      expect(origin).toBeNull();
    });

    it('should return null for other API errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      await plugin.initialize(context);
      const origin = await plugin.getOrigin(repoUrl);

      expect(origin).toBeNull();
      expect(context.logger.warn).toHaveBeenCalledWith(
        'Software Heritage API error',
        expect.objectContaining({
          url: repoUrl,
          status: 500,
        })
      );
    });

    it('should handle fetch errors gracefully', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await plugin.initialize(context);
      const origin = await plugin.getOrigin(repoUrl);

      expect(origin).toBeNull();
      expect(context.logger.warn).toHaveBeenCalledWith(
        'Error fetching Software Heritage origin',
        expect.objectContaining({
          url: repoUrl,
          error: 'Network error',
        })
      );
    });

    it('should cache successful origin lookups', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(SAMPLE_ORIGIN_RESPONSE),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(SAMPLE_VISITS_RESPONSE),
        });

      await plugin.initialize(context);
      await plugin.getOrigin(repoUrl);

      expect(context.cache.set).toHaveBeenCalledWith(
        `swh:origin:${repoUrl}`,
        expect.objectContaining({
          url: repoUrl,
          source: 'softwareheritage',
        }),
        3600 // 1 hour TTL
      );
    });

    it('should return cached origin if available', async () => {
      const cachedOrigin = {
        url: repoUrl,
        visits: [],
        lastVisit: '2024-01-15T10:30:00.000000+00:00',
        source: 'softwareheritage' as const,
      };

      context.cache.get = vi.fn().mockResolvedValue(cachedOrigin);

      await plugin.initialize(context);
      const origin = await plugin.getOrigin(repoUrl);

      expect(origin).toEqual(cachedOrigin);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should include snapshot SWHID from latest visit', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(SAMPLE_ORIGIN_RESPONSE),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(SAMPLE_VISITS_RESPONSE),
        });

      await plugin.initialize(context);
      const origin = await plugin.getOrigin(repoUrl);

      expect(origin?.lastSnapshotSwhid).toBe('swh:1:snp:d8d209195cd1cg4e92547cg091c57f09ce449564');
    });
  });

  describe('getOriginVisits', () => {
    const repoUrl = 'https://github.com/awhite-AFRL/MegaAttitude';

    it('should fetch visits for an origin', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_VISITS_RESPONSE),
      });

      await plugin.initialize(context);
      const visits = await plugin.getOriginVisits(repoUrl);

      expect(visits).toHaveLength(2);
      expect(visits[0]?.visit).toBe(2); // Most recent first
      expect(visits[0]?.status).toBe('full');
      expect(visits[0]?.type).toBe('git');
    });

    it('should respect limit parameter', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_VISITS_RESPONSE),
      });

      await plugin.initialize(context);
      await plugin.getOriginVisits(repoUrl, { limit: 3 });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('per_page=3'),
        expect.any(Object)
      );
    });

    it('should default to 10 visits if no limit specified', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
      });

      await plugin.initialize(context);
      await plugin.getOriginVisits(repoUrl);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('per_page=10'),
        expect.any(Object)
      );
    });

    it('should sort visits by date descending', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_VISITS_RESPONSE),
      });

      await plugin.initialize(context);
      const visits = await plugin.getOriginVisits(repoUrl);

      expect(visits[0]?.date).toBe('2024-02-20T14:45:00.000000+00:00');
      expect(visits[1]?.date).toBe('2024-01-15T10:30:00.000000+00:00');
    });

    it('should build SWHIDs for snapshots', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_VISITS_RESPONSE),
      });

      await plugin.initialize(context);
      const visits = await plugin.getOriginVisits(repoUrl);

      expect(visits[0]?.snapshotSwhid).toBe('swh:1:snp:d8d209195cd1cg4e92547cg091c57f09ce449564');
      expect(visits[1]?.snapshotSwhid).toBe('swh:1:snp:c7c108084bc0bf3d81436bf980b46e98bd338453');
    });

    it('should return empty array for API errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      await plugin.initialize(context);
      const visits = await plugin.getOriginVisits(repoUrl);

      expect(visits).toEqual([]);
    });

    it('should filter out invalid visits', async () => {
      const invalidVisits = [
        { visit: 1, date: '2024-01-15', status: 'full', type: 'git' },
        { date: '2024-01-16', status: 'full', type: 'git' }, // Missing visit number
        { visit: 3, status: 'full', type: 'git' }, // Missing date
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(invalidVisits),
      });

      await plugin.initialize(context);
      const visits = await plugin.getOriginVisits(repoUrl);

      expect(visits).toHaveLength(1);
      expect(visits[0]?.visit).toBe(1);
    });
  });

  describe('getRevision', () => {
    const swhid = 'swh:1:rev:3a4f5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a';

    it('should fetch revision metadata by SWHID', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_REVISION_RESPONSE),
      });

      await plugin.initialize(context);
      const revision = await plugin.getRevision(swhid);

      expect(revision).toBeTruthy();
      expect(revision?.swhid).toBe(swhid);
      expect(revision?.message).toContain('MegaAttitude dataset');
      expect(revision?.author.name).toBe('Aaron Steven White');
      expect(revision?.author.email).toBe('aaron.white@rochester.edu');
      expect(revision?.source).toBe('softwareheritage');
    });

    it('should build SWHIDs for directory and parents', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_REVISION_RESPONSE),
      });

      await plugin.initialize(context);
      const revision = await plugin.getRevision(swhid);

      expect(revision?.directorySwhid).toBe('swh:1:dir:5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f');
      expect(revision?.parentSwhids).toHaveLength(1);
      expect(revision?.parentSwhids[0]).toBe('swh:1:rev:2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c');
    });

    it('should return null for invalid SWHID', async () => {
      await plugin.initialize(context);
      const revision = await plugin.getRevision('invalid-swhid');

      expect(revision).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should return null for non-revision SWHID', async () => {
      const dirSwhid = 'swh:1:dir:3a4f5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a';

      await plugin.initialize(context);
      const revision = await plugin.getRevision(dirSwhid);

      expect(revision).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should return null for 404 (not found)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      await plugin.initialize(context);
      const revision = await plugin.getRevision(swhid);

      expect(revision).toBeNull();
    });

    it('should handle revisions without parents', async () => {
      const initialCommit = { ...SAMPLE_REVISION_RESPONSE, parents: [] };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(initialCommit),
      });

      await plugin.initialize(context);
      const revision = await plugin.getRevision(swhid);

      expect(revision?.parentSwhids).toEqual([]);
    });

    it('should handle fetch errors gracefully', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await plugin.initialize(context);
      const revision = await plugin.getRevision(swhid);

      expect(revision).toBeNull();
    });
  });

  describe('requestArchival', () => {
    const repoUrl = 'https://github.com/awhite-AFRL/MegaAcceptability';

    it('should request archival via SAVE API', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_SAVE_REQUEST_RESPONSE),
      });

      await plugin.initialize(context);
      const status = await plugin.requestArchival(repoUrl);

      expect(status).toBeTruthy();
      expect(status?.originUrl).toBe(repoUrl);
      expect(status?.saveRequestStatus).toBe('pending');
      expect(status?.visitType).toBe('git');
    });

    it('should use POST method for SAVE request', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_SAVE_REQUEST_RESPONSE),
      });

      await plugin.initialize(context);
      await plugin.requestArchival(repoUrl);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should support custom visit types', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ...SAMPLE_SAVE_REQUEST_RESPONSE, visit_type: 'svn' }),
      });

      await plugin.initialize(context);
      const status = await plugin.requestArchival(repoUrl, 'svn');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/save/svn/url/'),
        expect.any(Object)
      );
      expect(status?.visitType).toBe('svn');
    });

    it('should default to git visit type', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_SAVE_REQUEST_RESPONSE),
      });

      await plugin.initialize(context);
      await plugin.requestArchival(repoUrl);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/save/git/url/'),
        expect.any(Object)
      );
    });

    it('should return null for API errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429, // Rate limit
      });

      await plugin.initialize(context);
      const status = await plugin.requestArchival(repoUrl);

      expect(status).toBeNull();
      expect(context.logger.warn).toHaveBeenCalledWith(
        'SAVE request failed',
        expect.objectContaining({
          url: repoUrl,
          status: 429,
        })
      );
    });

    it('should handle fetch errors gracefully', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

      await plugin.initialize(context);
      const status = await plugin.requestArchival(repoUrl);

      expect(status).toBeNull();
      expect(context.logger.warn).toHaveBeenCalledWith(
        'Error requesting SAVE',
        expect.objectContaining({
          url: repoUrl,
          error: 'Connection refused',
        })
      );
    });
  });

  describe('getSaveRequestStatus', () => {
    const repoUrl = 'https://github.com/awhite-AFRL/MegaAcceptability';

    it('should check status of SAVE request', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_SAVE_STATUS_SUCCEEDED),
      });

      await plugin.initialize(context);
      const status = await plugin.getSaveRequestStatus(repoUrl);

      expect(status).toBeTruthy();
      expect(status?.saveRequestStatus).toBe('succeeded');
      expect(status?.saveTaskStatus).toBe('succeeded');
      expect(status?.visitDate).toBe('2024-03-01T14:30:00.000000+00:00');
    });

    it('should use GET method for status check', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_SAVE_STATUS_SUCCEEDED),
      });

      await plugin.initialize(context);
      await plugin.getSaveRequestStatus(repoUrl);

      const fetchCall = vi.mocked(global.fetch).mock.calls[0];
      expect(fetchCall?.[1]?.method).toBeUndefined(); // GET is default
    });

    it('should return latest status when multiple requests exist', async () => {
      const multipleStatuses = [
        SAMPLE_SAVE_STATUS_SUCCEEDED[0],
        { ...SAMPLE_SAVE_STATUS_SUCCEEDED[0], save_request_status: 'pending' },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(multipleStatuses),
      });

      await plugin.initialize(context);
      const status = await plugin.getSaveRequestStatus(repoUrl);

      expect(status?.saveRequestStatus).toBe('succeeded');
    });

    it('should return null for 404 (no requests)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      await plugin.initialize(context);
      const status = await plugin.getSaveRequestStatus(repoUrl);

      expect(status).toBeNull();
    });

    it('should return null for API errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      await plugin.initialize(context);
      const status = await plugin.getSaveRequestStatus(repoUrl);

      expect(status).toBeNull();
    });

    it('should handle fetch errors gracefully', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Timeout'));

      await plugin.initialize(context);
      const status = await plugin.getSaveRequestStatus(repoUrl);

      expect(status).toBeNull();
    });
  });

  describe('resolveSwhid', () => {
    const swhid = 'swh:1:rev:3a4f5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a';

    it('should resolve SWHID to browse URL', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_RESOLVE_RESPONSE),
      });

      await plugin.initialize(context);
      const url = await plugin.resolveSwhid(swhid);

      expect(url).toBe(
        'https://archive.softwareheritage.org/browse/revision/3a4f5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a/'
      );
    });

    it('should call resolve API endpoint', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_RESOLVE_RESPONSE),
      });

      await plugin.initialize(context);
      await plugin.resolveSwhid(swhid);

      expect(global.fetch).toHaveBeenCalledWith(
        `https://archive.softwareheritage.org/api/1/resolve/${swhid}/`,
        expect.any(Object)
      );
    });

    it('should return null for invalid SWHID', async () => {
      await plugin.initialize(context);
      const url = await plugin.resolveSwhid('invalid-swhid');

      expect(url).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should return null for API errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      await plugin.initialize(context);
      const url = await plugin.resolveSwhid(swhid);

      expect(url).toBeNull();
    });

    it('should handle fetch errors gracefully', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('DNS error'));

      await plugin.initialize(context);
      const url = await plugin.resolveSwhid(swhid);

      expect(url).toBeNull();
    });

    it('should work with different SWHID types', async () => {
      const dirSwhid = 'swh:1:dir:5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f';

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ browse_url: 'https://example.com/dir/' }),
      });

      await plugin.initialize(context);
      const url = await plugin.resolveSwhid(dirSwhid);

      expect(url).toBe('https://example.com/dir/');
    });
  });

  describe('isArchived', () => {
    const repoUrl = 'https://github.com/awhite-AFRL/MegaAttitude';

    it('should return true for archived repositories', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(SAMPLE_ORIGIN_RESPONSE),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(SAMPLE_VISITS_RESPONSE),
        });

      await plugin.initialize(context);
      const isArchived = await plugin.isArchived(repoUrl);

      expect(isArchived).toBe(true);
    });

    it('should return false for unarchived repositories', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      await plugin.initialize(context);
      const isArchived = await plugin.isArchived(repoUrl);

      expect(isArchived).toBe(false);
    });

    it('should return false for repositories with no visits', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(SAMPLE_ORIGIN_RESPONSE),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve([]), // No visits
        });

      await plugin.initialize(context);
      const isArchived = await plugin.isArchived(repoUrl);

      expect(isArchived).toBe(false);
    });

    it('should use cached origin data', async () => {
      const cachedOrigin = {
        url: repoUrl,
        visits: SAMPLE_VISITS_RESPONSE.map((v) => ({
          visit: v.visit,
          date: v.date,
          status: v.status as 'full' | 'partial' | 'ongoing' | 'failed' | 'not_found',
          type: v.type,
        })),
        source: 'softwareheritage' as const,
      };

      context.cache.get = vi.fn().mockResolvedValue(cachedOrigin);

      await plugin.initialize(context);
      const isArchived = await plugin.isArchived(repoUrl);

      expect(isArchived).toBe(true);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('parseSwhid', () => {
    it('should parse valid revision SWHID', async () => {
      await plugin.initialize(context);
      const swhid = 'swh:1:rev:3a4f5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a';
      const parsed = plugin.parseSwhid(swhid);

      expect(parsed).toBeTruthy();
      expect(parsed?.swhid).toBe(swhid);
      expect(parsed?.type).toBe('rev');
      expect(parsed?.hash).toBe('3a4f5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a');
    });

    it('should parse content SWHID', async () => {
      await plugin.initialize(context);
      const swhid = 'swh:1:cnt:94a9ed024d3859793618152ea559a168bbcbb5e2';
      const parsed = plugin.parseSwhid(swhid);

      expect(parsed?.type).toBe('cnt');
      expect(parsed?.hash).toBe('94a9ed024d3859793618152ea559a168bbcbb5e2');
    });

    it('should parse directory SWHID', async () => {
      await plugin.initialize(context);
      const swhid = 'swh:1:dir:5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f';
      const parsed = plugin.parseSwhid(swhid);

      expect(parsed?.type).toBe('dir');
    });

    it('should parse release SWHID', async () => {
      await plugin.initialize(context);
      const swhid = 'swh:1:rel:1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b';
      const parsed = plugin.parseSwhid(swhid);

      expect(parsed?.type).toBe('rel');
    });

    it('should parse snapshot SWHID', async () => {
      await plugin.initialize(context);
      const swhid = 'swh:1:snp:c7c108084bc0bf3d81436bf980b46e98bd338453';
      const parsed = plugin.parseSwhid(swhid);

      expect(parsed?.type).toBe('snp');
    });

    it('should reject invalid SWHID format', async () => {
      await plugin.initialize(context);
      const parsed = plugin.parseSwhid('invalid-swhid');

      expect(parsed).toBeNull();
    });

    it('should reject wrong version number', async () => {
      await plugin.initialize(context);
      const parsed = plugin.parseSwhid('swh:2:rev:3a4f5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a');

      expect(parsed).toBeNull();
    });

    it('should reject invalid type', async () => {
      await plugin.initialize(context);
      const parsed = plugin.parseSwhid('swh:1:xyz:3a4f5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a');

      expect(parsed).toBeNull();
    });

    it('should reject invalid hash length', async () => {
      await plugin.initialize(context);
      const parsed = plugin.parseSwhid('swh:1:rev:abc123');

      expect(parsed).toBeNull();
    });

    it('should handle uppercase hash', async () => {
      await plugin.initialize(context);
      const swhid = 'swh:1:rev:3A4F5B6C7D8E9F0A1B2C3D4E5F6A7B8C9D0E1F2A';
      const parsed = plugin.parseSwhid(swhid);

      expect(parsed).toBeTruthy();
      expect(parsed?.hash).toBe('3A4F5B6C7D8E9F0A1B2C3D4E5F6A7B8C9D0E1F2A');
    });
  });

  describe('buildSwhid', () => {
    it('should build revision SWHID', async () => {
      await plugin.initialize(context);
      const swhid = plugin.buildSwhid('rev', '3a4f5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a');

      expect(swhid).toBe('swh:1:rev:3a4f5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a');
    });

    it('should build content SWHID', async () => {
      await plugin.initialize(context);
      const swhid = plugin.buildSwhid('cnt', '94a9ed024d3859793618152ea559a168bbcbb5e2');

      expect(swhid).toBe('swh:1:cnt:94a9ed024d3859793618152ea559a168bbcbb5e2');
    });

    it('should build directory SWHID', async () => {
      await plugin.initialize(context);
      const swhid = plugin.buildSwhid('dir', '5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f');

      expect(swhid).toBe('swh:1:dir:5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f');
    });

    it('should build release SWHID', async () => {
      await plugin.initialize(context);
      const swhid = plugin.buildSwhid('rel', '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b');

      expect(swhid).toBe('swh:1:rel:1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b');
    });

    it('should build snapshot SWHID', async () => {
      await plugin.initialize(context);
      const swhid = plugin.buildSwhid('snp', 'c7c108084bc0bf3d81436bf980b46e98bd338453');

      expect(swhid).toBe('swh:1:snp:c7c108084bc0bf3d81436bf980b46e98bd338453');
    });

    it('should round-trip with parseSwhid', async () => {
      await plugin.initialize(context);
      const original = 'swh:1:rev:3a4f5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a';
      const parsed = plugin.parseSwhid(original);
      expect(parsed).not.toBeNull();
      expect(parsed?.type).toBeDefined();
      expect(parsed?.hash).toBeDefined();
      const rebuilt = plugin.buildSwhid(parsed?.type ?? 'rev', parsed?.hash ?? '');

      expect(rebuilt).toBe(original);
    });
  });

  describe('rate limiting', () => {
    it('should enforce rate limiting between requests', async () => {
      // Re-enable rate limiting for this test
      const rateLimitedPlugin = new SoftwareHeritagePlugin();

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_ORIGIN_RESPONSE),
      });

      await rateLimitedPlugin.initialize(context);

      const start = Date.now();
      await rateLimitedPlugin.getOrigin('https://github.com/user/repo1');
      await rateLimitedPlugin.getOrigin('https://github.com/user/repo2');
      const elapsed = Date.now() - start;

      // Should take at least 1000ms due to rate limiting
      expect(elapsed).toBeGreaterThanOrEqual(900); // Allow 100ms margin
    });

    it('should not rate limit when disabled for testing', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_ORIGIN_RESPONSE),
      });

      await plugin.initialize(context);

      const start = Date.now();
      await plugin.getOrigin('https://github.com/user/repo1');
      await plugin.getOrigin('https://github.com/user/repo2');
      const elapsed = Date.now() - start;

      // Should be fast with rate limiting disabled
      expect(elapsed).toBeLessThan(100);
    });
  });

  describe('error scenarios', () => {
    it('should handle malformed JSON responses', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      await plugin.initialize(context);
      const origin = await plugin.getOrigin('https://github.com/user/repo');

      expect(origin).toBeNull();
      expect(context.logger.warn).toHaveBeenCalled();
    });

    it('should handle network timeouts', async () => {
      global.fetch = vi.fn().mockImplementation(
        () =>
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Timeout')), 100);
          })
      );

      await plugin.initialize(context);
      const origin = await plugin.getOrigin('https://github.com/user/repo');

      expect(origin).toBeNull();
    });

    it('should handle empty response bodies', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });

      await plugin.initialize(context);
      const origin = await plugin.getOrigin('https://github.com/user/repo');

      expect(origin).toBeTruthy(); // Should still create an origin object
    });
  });

  describe('ATProto compliance', () => {
    it('should never write to user PDSes', async () => {
      // This plugin only reads from Software Heritage API
      // Verify no write operations exist
      await plugin.initialize(context);

      // getOrigin is read-only
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_ORIGIN_RESPONSE),
      });

      await plugin.getOrigin('https://github.com/user/repo');

      const fetchCall = vi.mocked(global.fetch).mock.calls[0];
      expect(fetchCall?.[1]?.method).toBeUndefined(); // GET is default
    });

    it('should cache as ephemeral AppView data', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(SAMPLE_ORIGIN_RESPONSE),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(SAMPLE_VISITS_RESPONSE),
        });

      await plugin.initialize(context);
      await plugin.getOrigin('https://github.com/user/repo');

      // Cache should be used (TTL set)
      expect(context.cache.set).toHaveBeenCalledWith(expect.any(String), expect.any(Object), 3600);
    });

    it('should mark all data with source', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(SAMPLE_ORIGIN_RESPONSE),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(SAMPLE_VISITS_RESPONSE),
        });

      await plugin.initialize(context);
      const origin = await plugin.getOrigin('https://github.com/user/repo');

      expect(origin?.source).toBe('softwareheritage');

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_REVISION_RESPONSE),
      });

      const revision = await plugin.getRevision(
        'swh:1:rev:3a4f5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a'
      );

      expect(revision?.source).toBe('softwareheritage');
    });
  });
});
