/**
 * Unit tests for OpenReviewPlugin.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { OpenReviewPlugin } from '../../../../src/plugins/builtin/openreview.js';
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
// Sample Data (based on OpenReview API v2)
// ============================================================================

/**
 * Sample OpenReview notes response.
 *
 * Uses real structure from OpenReview API v2.
 */
const SAMPLE_NOTES_RESPONSE = {
  notes: [
    {
      id: 'abc123xyz',
      forum: 'abc123xyz',
      invitation: 'ICLR.cc/2024/Conference/-/Submission',
      signatures: ['~Jane_Doe1'],
      readers: ['everyone'],
      writers: ['ICLR.cc/2024/Conference'],
      content: {
        title: { value: 'Algebraic Effects for Extensible Dynamic Semantics' },
        abstract: {
          value: 'We propose a framework for dynamic semantics based on algebraic effects.',
        },
        authors: { value: ['Julian Grove', 'Jean-Philippe Bernardy'] },
        authorids: { value: ['~Julian_Grove1', '~Jean-Philippe_Bernardy1'] },
        keywords: { value: ['semantics', 'algebraic effects', 'monads'] },
        venue: { value: 'ICLR 2024' },
        venueid: { value: 'ICLR.cc/2024/Conference' },
        pdf: { value: '/pdf?id=abc123xyz' },
      },
      cdate: 1704067200000, // 2024-01-01
      mdate: 1704153600000, // 2024-01-02
      pdate: 1704067200000,
    },
  ],
  count: 1,
};

/**
 * Sample OpenReview profile response.
 */
const SAMPLE_PROFILE_RESPONSE = {
  profiles: [
    {
      id: '~Julian_Grove1',
      content: {
        names: [{ first: 'Julian', last: 'Grove', fullname: 'Julian Grove', preferred: true }],
        emails: ['julian@example.edu'],
        emailsConfirmed: ['julian@example.edu'],
        homepage: 'https://juliangrove.github.io',
        orcid: '0000-0001-2345-6789',
        semanticScholar: 'S2Author:12345',
        dblp: 'juliangrove',
      },
      state: 'Active',
    },
  ],
};

// ============================================================================
// Tests
// ============================================================================

describe('OpenReviewPlugin', () => {
  let plugin: OpenReviewPlugin;
  let context: IPluginContext;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    context = createMockContext();
    plugin = new OpenReviewPlugin();
    originalFetch = global.fetch;
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
    global.fetch = originalFetch;
  });

  describe('manifest', () => {
    it('should have correct plugin ID', () => {
      expect(plugin.id).toBe('pub.chive.plugin.openreview');
    });

    it('should have correct source', () => {
      expect(plugin.source).toBe('openreview');
    });

    it('should declare network permissions for OpenReview domains', () => {
      expect(plugin.manifest.permissions?.network?.allowedDomains).toContain('openreview.net');
      expect(plugin.manifest.permissions?.network?.allowedDomains).toContain('api2.openreview.net');
    });
  });

  describe('initialize', () => {
    it('should log initialization info', async () => {
      await plugin.initialize(context);

      expect(context.logger.info).toHaveBeenCalledWith(
        'OpenReview plugin initialized (search-based)',
        expect.objectContaining({
          apiVersion: 'v2',
          rateLimit: '600ms between requests',
        })
      );
    });
  });

  describe('buildPreprintUrl', () => {
    it('should build correct OpenReview forum URL', async () => {
      await plugin.initialize(context);

      const url = plugin.buildPreprintUrl('abc123xyz');

      expect(url).toBe('https://openreview.net/forum?id=abc123xyz');
    });
  });

  describe('buildPdfUrl', () => {
    it('should build correct PDF URL', async () => {
      await plugin.initialize(context);

      const url = plugin.buildPdfUrl('abc123xyz');

      expect(url).toBe('https://openreview.net/pdf?id=abc123xyz');
    });
  });

  describe('parseExternalId', () => {
    it('should parse forum URL', async () => {
      await plugin.initialize(context);

      const id = plugin.parseExternalId('https://openreview.net/forum?id=abc123xyz');

      expect(id).toBe('abc123xyz');
    });

    it('should parse PDF URL', async () => {
      await plugin.initialize(context);

      const id = plugin.parseExternalId('https://openreview.net/pdf?id=abc123xyz');

      expect(id).toBe('abc123xyz');
    });

    it('should return null for invalid URL', async () => {
      await plugin.initialize(context);

      const id = plugin.parseExternalId('https://example.com/paper');

      expect(id).toBeNull();
    });
  });

  describe('fetchPreprints', () => {
    it('should fetch submissions from OpenReview API', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(SAMPLE_NOTES_RESPONSE),
      } as Response);

      const papers: unknown[] = [];
      for await (const paper of plugin.fetchPreprints({ limit: 1 })) {
        papers.push(paper);
      }

      expect(papers).toHaveLength(1);
      expect(papers[0]).toMatchObject({
        externalId: 'abc123xyz',
        title: 'Algebraic Effects for Extensible Dynamic Semantics',
      });
    });

    it('should include author IDs in preprint data', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(SAMPLE_NOTES_RESPONSE),
      } as Response);

      const papers: unknown[] = [];
      for await (const paper of plugin.fetchPreprints({ limit: 1 })) {
        papers.push(paper);
      }

      expect(papers[0]).toMatchObject({
        authors: expect.arrayContaining([
          expect.objectContaining({
            name: 'Julian Grove',
            externalId: '~Julian_Grove1',
          }),
        ]),
      });
    });

    it('should include venue and keywords', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(SAMPLE_NOTES_RESPONSE),
      } as Response);

      const papers: unknown[] = [];
      for await (const paper of plugin.fetchPreprints({ limit: 1 })) {
        papers.push(paper);
      }

      expect(papers[0]).toMatchObject({
        categories: expect.arrayContaining(['semantics', 'algebraic effects']),
      });
    });

    it('should skip notes without title', async () => {
      await plugin.initialize(context);
      const responseWithoutTitle = {
        notes: [
          {
            ...SAMPLE_NOTES_RESPONSE.notes[0],
            content: {
              ...SAMPLE_NOTES_RESPONSE.notes[0]?.content,
              title: undefined,
            },
          },
        ],
        count: 1,
      };
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(responseWithoutTitle),
      } as Response);

      const papers: unknown[] = [];
      for await (const paper of plugin.fetchPreprints({ limit: 10 })) {
        papers.push(paper);
      }

      expect(papers).toHaveLength(0);
    });

    it('should handle API error gracefully', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 503,
      } as Response);

      const papers: unknown[] = [];
      for await (const paper of plugin.fetchPreprints({ limit: 1 })) {
        papers.push(paper);
      }

      // Should not throw, just return empty
      expect(papers).toHaveLength(0);
      expect(context.logger.warn).toHaveBeenCalledWith('OpenReview API error', expect.any(Object));
    });
  });

  describe('getAuthorProfile', () => {
    it('should return cached profile if available', async () => {
      await plugin.initialize(context);
      const cachedAuthor = {
        profileId: '~Julian_Grove1',
        name: 'Julian Grove',
        confirmedEmails: ['julian@example.edu'],
        orcid: '0000-0001-2345-6789',
      };
      vi.mocked(context.cache.get).mockResolvedValueOnce(cachedAuthor);

      const result = await plugin.getAuthorProfile('~Julian_Grove1');

      expect(result).toEqual(cachedAuthor);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should fetch profile from API if not cached', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_PROFILE_RESPONSE),
      } as Response);

      const result = await plugin.getAuthorProfile('~Julian_Grove1');

      expect(result).toMatchObject({
        profileId: '~Julian_Grove1',
        name: 'Julian Grove',
        orcid: '0000-0001-2345-6789',
      });
      expect(context.cache.set).toHaveBeenCalled();
    });

    it('should include linked identifiers', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_PROFILE_RESPONSE),
      } as Response);

      const result = await plugin.getAuthorProfile('~Julian_Grove1');

      expect(result).toMatchObject({
        semanticScholarId: 'S2Author:12345',
        dblpId: 'juliangrove',
      });
    });

    it('should return null on API error', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const result = await plugin.getAuthorProfile('~Nonexistent1');

      expect(result).toBeNull();
      expect(context.logger.warn).toHaveBeenCalledWith(
        'Failed to fetch OpenReview profile',
        expect.any(Object)
      );
    });
  });

  describe('findAuthorByEmail', () => {
    it('should find author by confirmed email', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_PROFILE_RESPONSE),
      } as Response);

      const result = await plugin.findAuthorByEmail('julian@example.edu');

      expect(result).toMatchObject({
        profileId: '~Julian_Grove1',
        name: 'Julian Grove',
      });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('confirmedEmails=julian%40example.edu'),
        expect.any(Object)
      );
    });

    it('should return null if no profile found', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ profiles: [] }),
      } as Response);

      const result = await plugin.findAuthorByEmail('unknown@example.com');

      expect(result).toBeNull();
    });
  });

  describe('getAuthorSubmissions', () => {
    it('should fetch submissions by author profile ID', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_NOTES_RESPONSE),
      } as Response);

      const results = await plugin.getAuthorSubmissions('~Julian_Grove1');

      expect(results).toHaveLength(1);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('content.authorids=~Julian_Grove1'),
        expect.any(Object)
      );
    });

    it('should return empty array on error', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const results = await plugin.getAuthorSubmissions('~Test1');

      expect(results).toEqual([]);
      expect(context.logger.warn).toHaveBeenCalledWith(
        'Failed to fetch author submissions',
        expect.any(Object)
      );
    });
  });

  describe('verifyAuthorship', () => {
    it('should return true if profile is an author', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_NOTES_RESPONSE),
      } as Response);

      const result = await plugin.verifyAuthorship('~Julian_Grove1', 'abc123xyz');

      expect(result).toBe(true);
    });

    it('should return false if profile is not an author', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_NOTES_RESPONSE),
      } as Response);

      const result = await plugin.verifyAuthorship('~Other_Person1', 'abc123xyz');

      expect(result).toBe(false);
    });

    it('should return false on API error', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const result = await plugin.verifyAuthorship('~Test1', 'abc123xyz');

      expect(result).toBe(false);
    });
  });

  describe('fetchSubmissionDetails', () => {
    it('should return cached submission if available', async () => {
      await plugin.initialize(context);
      const cachedPaper = {
        id: 'abc123xyz',
        forumId: 'abc123xyz',
        title: 'Cached Paper',
        authors: ['Author'],
        authorIds: ['~Author1'],
        url: 'https://openreview.net/forum?id=abc123xyz',
        createdAt: 1704067200000,
        source: 'openreview' as const,
      };
      vi.mocked(context.cache.get).mockResolvedValueOnce(cachedPaper);

      const result = await plugin.fetchSubmissionDetails('abc123xyz');

      expect(result).toEqual(cachedPaper);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should fetch from API if not cached', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_NOTES_RESPONSE),
      } as Response);

      const result = await plugin.fetchSubmissionDetails('abc123xyz');

      expect(result).toMatchObject({
        id: 'abc123xyz',
        title: 'Algebraic Effects for Extensible Dynamic Semantics',
      });
      expect(context.cache.set).toHaveBeenCalled();
    });

    it('should return null on API error', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const result = await plugin.fetchSubmissionDetails('nonexistent');

      expect(result).toBeNull();
      expect(context.logger.warn).toHaveBeenCalledWith(
        'Failed to fetch submission details',
        expect.any(Object)
      );
    });
  });

  describe('getPaper', () => {
    it('should return paper from cache', async () => {
      await plugin.initialize(context);
      const cachedPaper = {
        id: 'abc123xyz',
        forumId: 'abc123xyz',
        title: 'Test Paper',
        authors: ['Author'],
        authorIds: ['~Author1'],
        url: 'https://openreview.net/forum?id=abc123xyz',
        createdAt: 1704067200000,
        source: 'openreview' as const,
      };
      vi.mocked(context.cache.get).mockResolvedValueOnce(cachedPaper);

      const result = await plugin.getPaper('abc123xyz');

      expect(result).toEqual(cachedPaper);
      expect(context.cache.get).toHaveBeenCalledWith('openreview:abc123xyz');
    });

    it('should return null if not in cache', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);

      const result = await plugin.getPaper('abc123xyz');

      expect(result).toBeNull();
    });
  });
});
