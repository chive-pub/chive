/**
 * Unit tests for GitHubIntegrationPlugin.
 *
 * @remarks
 * Tests GitHub URL detection, repository linking, and API integration.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { GitHubIntegrationPlugin } from '@/plugins/builtin/github-integration.js';
import type { ICacheProvider } from '@/types/interfaces/cache.interface.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';
import type { IMetrics } from '@/types/interfaces/metrics.interface.js';
import type { IPluginContext, IPluginEventBus } from '@/types/interfaces/plugin.interface.js';
import { PluginState } from '@/types/interfaces/plugin.interface.js';

/**
 * Creates a mock logger for testing.
 *
 * @returns Mock logger instance
 */
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

/**
 * Creates a mock cache provider for testing.
 *
 * @returns Mock cache provider
 */
const createMockCache = (): ICacheProvider => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
  exists: vi.fn().mockResolvedValue(false),
  expire: vi.fn().mockResolvedValue(undefined),
});

/**
 * Creates a mock metrics provider for testing.
 *
 * @returns Mock metrics provider
 */
const createMockMetrics = (): IMetrics => ({
  incrementCounter: vi.fn(),
  setGauge: vi.fn(),
  observeHistogram: vi.fn(),
  startTimer: vi.fn().mockReturnValue(() => {
    // Timer end function (no-op for mock)
  }),
});

/**
 * Creates a mock event bus for testing.
 *
 * @returns Mock event bus with handlers storage
 */
const createMockEventBus = (): IPluginEventBus & {
  handlers: Map<string, ((...args: unknown[]) => void)[]>;
  trigger: (event: string, data: unknown) => Promise<void>;
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
    async trigger(event: string, data: unknown): Promise<void> {
      const eventHandlers = handlers.get(event) ?? [];
      for (const handler of eventHandlers) {
        await Promise.resolve(handler(data));
      }
    },
  };
};

/**
 * Creates a mock plugin context for testing.
 *
 * @param config - Plugin configuration
 * @returns Mock plugin context with event bus
 */
const createMockContext = (
  config: Record<string, unknown> = {}
): IPluginContext & { eventBus: ReturnType<typeof createMockEventBus> } => {
  return {
    logger: createMockLogger(),
    cache: createMockCache(),
    metrics: createMockMetrics(),
    eventBus: createMockEventBus(),
    config,
  };
};

describe('GitHubIntegrationPlugin', () => {
  let plugin: GitHubIntegrationPlugin;
  let context: ReturnType<typeof createMockContext>;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    plugin = new GitHubIntegrationPlugin();
    context = createMockContext();

    // Store original fetch
    originalFetch = global.fetch;

    // Mock fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          stargazers_count: 100,
          forks_count: 20,
          updated_at: '2024-01-01T00:00:00Z',
          license: { spdx_id: 'MIT' },
          language: 'TypeScript',
          description: 'Test repository',
          topics: ['testing', 'typescript'],
        }),
    });
  });

  afterEach(() => {
    // Restore fetch
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  describe('plugin properties', () => {
    it('should have correct id', () => {
      expect(plugin.id).toBe('pub.chive.plugin.github');
    });

    it('should have correct manifest', () => {
      expect(plugin.manifest.id).toBe('pub.chive.plugin.github');
      expect(plugin.manifest.name).toBe('GitHub Integration');
      expect(plugin.manifest.permissions.network?.allowedDomains).toContain('api.github.com');
    });
  });

  describe('initialize', () => {
    it('should initialize and register event handlers', async () => {
      await plugin.initialize(context);

      expect(plugin.getState()).toBe(PluginState.READY);
      expect(context.eventBus.on).toHaveBeenCalledWith('eprint.indexed', expect.any(Function));
      expect(context.eventBus.on).toHaveBeenCalledWith('eprint.updated', expect.any(Function));
    });

    it('should log initialization with authentication status', async () => {
      await plugin.initialize(context);

      expect(context.logger.info).toHaveBeenCalledWith(
        'GitHub integration initialized',
        expect.objectContaining({
          authenticated: false,
        })
      );
    });

    it('should use GitHub token from config', async () => {
      const contextWithToken = createMockContext({ githubToken: 'test-token' });
      await plugin.initialize(contextWithToken);

      expect(contextWithToken.logger.info).toHaveBeenCalledWith(
        'GitHub integration initialized',
        expect.objectContaining({
          authenticated: true,
        })
      );
    });
  });

  describe('eprint.indexed handler', () => {
    it('should process GitHub links from supplementary materials', async () => {
      await plugin.initialize(context);

      await context.eventBus.trigger('eprint.indexed', {
        uri: 'at://did:plc:test/pub.chive.eprint.submission/123',
        title: 'Test Eprint',
        supplementaryLinks: ['https://github.com/owner/repo'],
      });

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(global.fetch).toHaveBeenCalled();
      const fetchCall = vi.mocked(global.fetch).mock.calls[0];
      expect(fetchCall?.[0]).toBe('https://api.github.com/repos/owner/repo');
      const options = fetchCall?.[1];
      expect(options?.headers).toMatchObject({
        Accept: 'application/vnd.github.v3+json',
      });
    });

    it('should emit github.repo.linked event', async () => {
      await plugin.initialize(context);

      await context.eventBus.trigger('eprint.indexed', {
        uri: 'at://did:plc:test/pub.chive.eprint.submission/123',
        title: 'Test Eprint',
        supplementaryLinks: ['https://github.com/owner/repo'],
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(context.eventBus.emit).toHaveBeenCalledWith(
        'github.repo.linked',
        expect.objectContaining({
          owner: 'owner',
          repo: 'repo',
        })
      );
    });

    it('should skip non-GitHub links', async () => {
      await plugin.initialize(context);

      await context.eventBus.trigger('eprint.indexed', {
        uri: 'at://did:plc:test/pub.chive.eprint.submission/123',
        title: 'Test Eprint',
        supplementaryLinks: ['https://gitlab.com/owner/repo', 'https://example.com'],
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should handle eprints without supplementary links', async () => {
      await plugin.initialize(context);

      await context.eventBus.trigger('eprint.indexed', {
        uri: 'at://did:plc:test/pub.chive.eprint.submission/123',
        title: 'Test Eprint',
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('caching', () => {
    it('should return cached repo info when available', async () => {
      const cachedData = {
        owner: 'cached-owner',
        repo: 'cached-repo',
        stars: 500,
        forks: 100,
        lastUpdated: '2024-01-01T00:00:00Z',
        license: 'MIT',
        language: 'TypeScript',
        description: 'Cached description',
        topics: ['cached'],
      };

      context.cache.get = vi.fn().mockResolvedValue(cachedData);
      await plugin.initialize(context);

      await context.eventBus.trigger('eprint.indexed', {
        uri: 'at://did:plc:test/pub.chive.eprint.submission/123',
        title: 'Test Eprint',
        supplementaryLinks: ['https://github.com/cached-owner/cached-repo'],
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should not call fetch when cached
      expect(global.fetch).not.toHaveBeenCalled();
      expect(context.logger.debug).toHaveBeenCalledWith(
        'GitHub repo from cache',
        expect.objectContaining({
          owner: 'cached-owner',
          repo: 'cached-repo',
        })
      );
    });

    it('should cache fetched repo info', async () => {
      await plugin.initialize(context);

      await context.eventBus.trigger('eprint.indexed', {
        uri: 'at://did:plc:test/pub.chive.eprint.submission/123',
        title: 'Test Eprint',
        supplementaryLinks: ['https://github.com/owner/repo'],
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(context.cache.set).toHaveBeenCalledWith(
        'github:owner:repo',
        expect.objectContaining({
          owner: 'owner',
          repo: 'repo',
          stars: 100,
        }),
        3600
      );
    });
  });

  describe('error handling', () => {
    it('should handle 404 errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      await plugin.initialize(context);

      await context.eventBus.trigger('eprint.indexed', {
        uri: 'at://did:plc:test/pub.chive.eprint.submission/123',
        title: 'Test Eprint',
        supplementaryLinks: ['https://github.com/owner/nonexistent'],
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(context.logger.warn).toHaveBeenCalled();
      const warnCall = vi.mocked(context.logger.warn).mock.calls[0];
      expect(warnCall?.[0]).toBe('Failed to fetch GitHub repository');
      const errorArg = warnCall?.[1] as { error?: string } | undefined;
      expect(errorArg?.error).toContain('not found');
    });

    it('should handle rate limit errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
      });

      await plugin.initialize(context);

      await context.eventBus.trigger('eprint.indexed', {
        uri: 'at://did:plc:test/pub.chive.eprint.submission/123',
        title: 'Test Eprint',
        supplementaryLinks: ['https://github.com/owner/repo'],
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(context.logger.warn).toHaveBeenCalled();
      const warnCall = vi.mocked(context.logger.warn).mock.calls[0];
      expect(warnCall?.[0]).toBe('Failed to fetch GitHub repository');
      const errorArg = warnCall?.[1] as { error?: string } | undefined;
      expect(errorArg?.error?.toLowerCase()).toContain('rate limit');
    });

    it('should record error metrics', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      await plugin.initialize(context);

      await context.eventBus.trigger('eprint.indexed', {
        uri: 'at://did:plc:test/pub.chive.eprint.submission/123',
        title: 'Test Eprint',
        supplementaryLinks: ['https://github.com/owner/repo'],
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(context.metrics.incrementCounter).toHaveBeenCalledWith(
        'fetch_errors',
        { type: 'github' },
        undefined
      );
    });
  });

  describe('URL parsing', () => {
    it('should parse standard GitHub URLs', async () => {
      await plugin.initialize(context);

      await context.eventBus.trigger('eprint.indexed', {
        uri: 'at://did:plc:test/pub.chive.eprint.submission/123',
        title: 'Test',
        supplementaryLinks: ['https://github.com/microsoft/typescript'],
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/microsoft/typescript',
        expect.any(Object)
      );
    });

    it('should handle URLs with .git suffix', async () => {
      await plugin.initialize(context);

      await context.eventBus.trigger('eprint.indexed', {
        uri: 'at://did:plc:test/pub.chive.eprint.submission/123',
        title: 'Test',
        supplementaryLinks: ['https://github.com/owner/repo.git'],
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo',
        expect.any(Object)
      );
    });

    it('should handle URLs with query strings', async () => {
      await plugin.initialize(context);

      await context.eventBus.trigger('eprint.indexed', {
        uri: 'at://did:plc:test/pub.chive.eprint.submission/123',
        title: 'Test',
        supplementaryLinks: ['https://github.com/owner/repo?tab=readme'],
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo',
        expect.any(Object)
      );
    });

    it('should handle www.github.com URLs', async () => {
      await plugin.initialize(context);

      await context.eventBus.trigger('eprint.indexed', {
        uri: 'at://did:plc:test/pub.chive.eprint.submission/123',
        title: 'Test',
        supplementaryLinks: ['https://www.github.com/owner/repo'],
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo',
        expect.any(Object)
      );
    });
  });
});
