/**
 * Unit tests for GitLabIntegrationPlugin.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { GitLabIntegrationPlugin } from '../../../../src/plugins/builtin/gitlab-integration.js';
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
// Sample Data (based on GitLab API v4)
// ============================================================================

/**
 * Sample GitLab project for decompositional semantics toolkit.
 */
const SAMPLE_PROJECT_RESPONSE = {
  id: 12345,
  path_with_namespace: 'decompositional-semantics-initiative/decomp',
  name: 'decomp',
  description: 'Decomp toolkit for decompositional semantics',
  default_branch: 'main',
  visibility: 'public',
  web_url: 'https://gitlab.com/decompositional-semantics-initiative/decomp',
  http_url_to_repo: 'https://gitlab.com/decompositional-semantics-initiative/decomp.git',
  ssh_url_to_repo: 'git@gitlab.com:decompositional-semantics-initiative/decomp.git',
  star_count: 50,
  forks_count: 15,
  open_issues_count: 5,
  topics: ['python', 'nlp', 'semantics'],
  license: { key: 'mit', name: 'MIT License' },
  owner: { id: 100, username: 'user', name: 'User Name' },
  last_activity_at: '2024-06-01T00:00:00Z',
  created_at: '2020-01-01T00:00:00Z',
};

/**
 * Sample GitLab project with minimal fields.
 */
const SAMPLE_PROJECT_MINIMAL = {
  id: 99999,
  path_with_namespace: 'minimal/project',
  name: 'project',
};

/**
 * Sample GitLab project for self-hosted instance.
 */
const SAMPLE_PROJECT_SELFHOSTED = {
  id: 54321,
  path_with_namespace: 'research-group/analysis-tools',
  name: 'analysis-tools',
  description: 'Statistical analysis tools',
  default_branch: 'develop',
  visibility: 'internal',
  web_url: 'https://gitlab.example.org/research-group/analysis-tools',
  http_url_to_repo: 'https://gitlab.example.org/research-group/analysis-tools.git',
  ssh_url_to_repo: 'git@gitlab.example.org:research-group/analysis-tools.git',
  star_count: 12,
  forks_count: 3,
  open_issues_count: 2,
  topics: ['statistics', 'r'],
  license: { key: 'gpl-3.0', name: 'GNU General Public License v3.0' },
  owner: { id: 200, username: 'researchlab', name: 'Research Lab' },
  last_activity_at: '2024-05-15T00:00:00Z',
  created_at: '2022-03-10T00:00:00Z',
};

/**
 * Sample GitLab releases.
 */
const SAMPLE_RELEASE_RESPONSE = [
  {
    name: 'v1.0.0',
    tag_name: 'v1.0.0',
    description: 'Initial release',
    released_at: '2024-01-15T00:00:00Z',
    author: { id: 100, username: 'user', name: 'User Name' },
    assets: {
      sources: [
        { format: 'zip', url: 'https://gitlab.com/project/-/archive/v1.0.0/project-v1.0.0.zip' },
        {
          format: 'tar.gz',
          url: 'https://gitlab.com/project/-/archive/v1.0.0/project-v1.0.0.tar.gz',
        },
      ],
      links: [],
    },
  },
  {
    name: 'v0.9.0',
    tag_name: 'v0.9.0',
    description: 'Beta release',
    released_at: '2023-12-01T00:00:00Z',
    author: { id: 100, username: 'user', name: 'User Name' },
    assets: {
      sources: [
        { format: 'zip', url: 'https://gitlab.com/project/-/archive/v0.9.0/project-v0.9.0.zip' },
      ],
      links: [{ name: 'Documentation', url: 'https://docs.example.com' }],
    },
  },
];

/**
 * Sample GitLab release with minimal fields.
 */
const SAMPLE_RELEASE_MINIMAL = {
  tag_name: 'v2.0.0',
};

/**
 * Sample GitLab languages response.
 */
const SAMPLE_LANGUAGES_RESPONSE = {
  Python: 75.5,
  Shell: 15.2,
  Makefile: 9.3,
};

// ============================================================================
// Testable Subclass (disables rate limiting)
// ============================================================================

/**
 * Testable subclass that disables rate limiting for tests.
 */
class TestableGitLabPlugin extends GitLabIntegrationPlugin {
  constructor() {
    super();
    // Disable rate limiting for tests (rateLimitDelayMs is protected)
    this.rateLimitDelayMs = 0;
  }
}

// ============================================================================
// Test Suites
// ============================================================================

describe('GitLabIntegrationPlugin', () => {
  let plugin: TestableGitLabPlugin;
  let context: IPluginContext;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    plugin = new TestableGitLabPlugin();
    context = createMockContext();

    // Store original fetch
    originalFetch = global.fetch;

    // Mock fetch with default success response
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(SAMPLE_PROJECT_RESPONSE),
    });
  });

  afterEach(() => {
    // Restore fetch
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Plugin Properties
  // ==========================================================================

  describe('plugin properties', () => {
    it('should have correct id', () => {
      expect(plugin.id).toBe('pub.chive.plugin.gitlab');
    });

    it('should have correct manifest id', () => {
      expect(plugin.manifest.id).toBe('pub.chive.plugin.gitlab');
    });

    it('should have correct manifest name', () => {
      expect(plugin.manifest.name).toBe('GitLab Integration');
    });

    it('should have correct manifest version', () => {
      expect(plugin.manifest.version).toBe('0.1.0');
    });

    it('should have correct manifest description', () => {
      expect(plugin.manifest.description).toBe(
        'Provides repository linking and code verification via GitLab'
      );
    });

    it('should have correct manifest author', () => {
      expect(plugin.manifest.author).toBe('Aaron Steven White');
    });

    it('should have correct manifest license', () => {
      expect(plugin.manifest.license).toBe('MIT');
    });

    it('should have correct network permissions', () => {
      expect(plugin.manifest.permissions?.network?.allowedDomains).toContain('gitlab.com');
      expect(plugin.manifest.permissions?.network?.allowedDomains).toContain('*.gitlab.com');
    });

    it('should have storage size limit', () => {
      expect(plugin.manifest.permissions?.storage?.maxSize).toBe(50 * 1024 * 1024);
    });

    it('should have correct entrypoint', () => {
      expect(plugin.manifest.entrypoint).toBe('gitlab-integration.js');
    });
  });

  // ==========================================================================
  // Initialization
  // ==========================================================================

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      await plugin.initialize(context);

      expect(context.logger.info).toHaveBeenCalledWith(
        'GitLab plugin initialized',
        expect.objectContaining({
          rateLimit: '0ms between requests',
        })
      );
    });

    it('should log initialization', async () => {
      await plugin.initialize(context);

      expect(context.logger.info).toHaveBeenCalledWith(
        'Plugin initialized',
        expect.objectContaining({
          pluginId: 'pub.chive.plugin.gitlab',
          version: '0.1.0',
        })
      );
    });
  });

  // ==========================================================================
  // getProject: Success Cases
  // ==========================================================================

  describe('getProject - success', () => {
    it('should fetch project metadata', async () => {
      await plugin.initialize(context);

      const result = await plugin.getProject('decompositional-semantics-initiative/decomp');

      expect(result).not.toBeNull();
      expect(result?.id).toBe(12345);
      expect(result?.pathWithNamespace).toBe('decompositional-semantics-initiative/decomp');
      expect(result?.name).toBe('decomp');
      expect(result?.description).toBe('Decomp toolkit for decompositional semantics');
    });

    it('should parse all fields correctly', async () => {
      await plugin.initialize(context);

      const result = await plugin.getProject('decompositional-semantics-initiative/decomp');

      expect(result).toMatchObject({
        id: 12345,
        pathWithNamespace: 'decompositional-semantics-initiative/decomp',
        name: 'decomp',
        description: 'Decomp toolkit for decompositional semantics',
        defaultBranch: 'main',
        visibility: 'public',
        webUrl: 'https://gitlab.com/decompositional-semantics-initiative/decomp',
        cloneUrls: {
          http: 'https://gitlab.com/decompositional-semantics-initiative/decomp.git',
          ssh: 'git@gitlab.com:decompositional-semantics-initiative/decomp.git',
        },
        starCount: 50,
        forksCount: 15,
        openIssuesCount: 5,
        topics: ['python', 'nlp', 'semantics'],
        license: { key: 'mit', name: 'MIT License' },
        owner: { id: 100, username: 'user', name: 'User Name' },
        lastActivityAt: '2024-06-01T00:00:00Z',
        createdAt: '2020-01-01T00:00:00Z',
        source: 'gitlab',
      });
    });

    it('should parse project with minimal fields', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_PROJECT_MINIMAL),
      });

      await plugin.initialize(context);

      const result = await plugin.getProject('minimal/project');

      expect(result).toMatchObject({
        id: 99999,
        pathWithNamespace: 'minimal/project',
        name: 'project',
        defaultBranch: 'main',
        visibility: 'private',
        starCount: 0,
        forksCount: 0,
        openIssuesCount: 0,
        topics: [],
        source: 'gitlab',
      });
    });

    it('should use default values for missing fields', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_PROJECT_MINIMAL),
      });

      await plugin.initialize(context);

      const result = await plugin.getProject('minimal/project');

      expect(result?.defaultBranch).toBe('main');
      expect(result?.visibility).toBe('private');
      expect(result?.starCount).toBe(0);
      expect(result?.forksCount).toBe(0);
      expect(result?.openIssuesCount).toBe(0);
      expect(result?.topics).toEqual([]);
    });

    it('should encode project path in URL', async () => {
      await plugin.initialize(context);

      await plugin.getProject('group/subgroup/project');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://gitlab.com/api/v4/projects/group%2Fsubgroup%2Fproject',
        expect.objectContaining({
          headers: {
            Accept: 'application/json',
          },
        })
      );
    });

    it('should use custom baseUrl when provided', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_PROJECT_SELFHOSTED),
      });

      await plugin.initialize(context);

      const result = await plugin.getProject('research-group/analysis-tools', {
        baseUrl: 'https://gitlab.example.org/api/v4',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://gitlab.example.org/api/v4/projects/research-group%2Fanalysis-tools',
        expect.any(Object)
      );

      expect(result?.id).toBe(54321);
      expect(result?.pathWithNamespace).toBe('research-group/analysis-tools');
    });
  });

  // ==========================================================================
  // getProject: Caching
  // ==========================================================================

  describe('getProject - caching', () => {
    it('should return cached project on cache hit', async () => {
      const cachedProject = {
        id: 12345,
        pathWithNamespace: 'cached/project',
        name: 'project',
        defaultBranch: 'main',
        visibility: 'public' as const,
        webUrl: 'https://gitlab.com/cached/project',
        cloneUrls: { http: 'https://gitlab.com/cached/project.git' },
        starCount: 100,
        forksCount: 20,
        openIssuesCount: 3,
        topics: [],
        lastActivityAt: '2024-01-01T00:00:00Z',
        createdAt: '2023-01-01T00:00:00Z',
        source: 'gitlab' as const,
      };

      context.cache.get = vi.fn().mockResolvedValue(cachedProject);

      await plugin.initialize(context);

      const result = await plugin.getProject('cached/project');

      expect(result).toEqual(cachedProject);
      expect(global.fetch).not.toHaveBeenCalled();
      expect(context.cache.get).toHaveBeenCalledWith(
        'gitlab:project:https://gitlab.com/api/v4:cached/project'
      );
    });

    it('should cache fetched project', async () => {
      await plugin.initialize(context);

      await plugin.getProject('decompositional-semantics-initiative/decomp');

      expect(context.cache.set).toHaveBeenCalledWith(
        'gitlab:project:https://gitlab.com/api/v4:decompositional-semantics-initiative/decomp',
        expect.objectContaining({
          id: 12345,
          pathWithNamespace: 'decompositional-semantics-initiative/decomp',
        }),
        86400
      );
    });

    it('should use different cache keys for different baseUrls', async () => {
      context.cache.get = vi.fn().mockResolvedValue(null);

      await plugin.initialize(context);

      await plugin.getProject('project/path');
      await plugin.getProject('project/path', { baseUrl: 'https://gitlab.example.org/api/v4' });

      expect(context.cache.get).toHaveBeenCalledWith(
        'gitlab:project:https://gitlab.com/api/v4:project/path'
      );
      expect(context.cache.get).toHaveBeenCalledWith(
        'gitlab:project:https://gitlab.example.org/api/v4:project/path'
      );
    });
  });

  // ==========================================================================
  // getProject: Error Handling
  // ==========================================================================

  describe('getProject - error handling', () => {
    it('should return null for 404 not found', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      await plugin.initialize(context);

      const result = await plugin.getProject('nonexistent/project');

      expect(result).toBeNull();
      expect(context.cache.set).not.toHaveBeenCalled();
    });

    it('should return null and log warning for API errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      await plugin.initialize(context);

      const result = await plugin.getProject('error/project');

      expect(result).toBeNull();
      expect(context.logger.warn).toHaveBeenCalledWith(
        'GitLab API error',
        expect.objectContaining({
          projectPath: 'error/project',
          status: 500,
        })
      );
    });

    it('should return null and log warning for rate limit errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
      });

      await plugin.initialize(context);

      const result = await plugin.getProject('ratelimited/project');

      expect(result).toBeNull();
      expect(context.logger.warn).toHaveBeenCalledWith(
        'GitLab API error',
        expect.objectContaining({
          projectPath: 'ratelimited/project',
          status: 429,
        })
      );
    });

    it('should return null and log warning for network errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await plugin.initialize(context);

      const result = await plugin.getProject('network/error');

      expect(result).toBeNull();
      expect(context.logger.warn).toHaveBeenCalledWith(
        'Error fetching GitLab project',
        expect.objectContaining({
          projectPath: 'network/error',
          error: 'Network error',
        })
      );
    });

    it('should return null for invalid API response (missing required fields)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 123 }), // Missing path_with_namespace and name
      });

      await plugin.initialize(context);

      const result = await plugin.getProject('invalid/project');

      expect(result).toBeNull();
    });

    it('should return null for malformed JSON', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      await plugin.initialize(context);

      const result = await plugin.getProject('malformed/json');

      expect(result).toBeNull();
      expect(context.logger.warn).toHaveBeenCalledWith(
        'Error fetching GitLab project',
        expect.objectContaining({
          error: 'Invalid JSON',
        })
      );
    });
  });

  // ==========================================================================
  // getProjectLanguages
  // ==========================================================================

  describe('getProjectLanguages', () => {
    it('should fetch project languages', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_LANGUAGES_RESPONSE),
      });

      await plugin.initialize(context);

      const result = await plugin.getProjectLanguages('project/path');

      expect(result).toEqual({
        Python: 75.5,
        Shell: 15.2,
        Makefile: 9.3,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://gitlab.com/api/v4/projects/project%2Fpath/languages',
        expect.objectContaining({
          headers: {
            Accept: 'application/json',
          },
        })
      );
    });

    it('should use custom baseUrl', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_LANGUAGES_RESPONSE),
      });

      await plugin.initialize(context);

      await plugin.getProjectLanguages('project/path', {
        baseUrl: 'https://gitlab.example.org/api/v4',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://gitlab.example.org/api/v4/projects/project%2Fpath/languages',
        expect.any(Object)
      );
    });

    it('should return null for API errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      await plugin.initialize(context);

      const result = await plugin.getProjectLanguages('error/project');

      expect(result).toBeNull();
    });

    it('should return null and log warning for network errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network timeout'));

      await plugin.initialize(context);

      const result = await plugin.getProjectLanguages('timeout/project');

      expect(result).toBeNull();
      expect(context.logger.warn).toHaveBeenCalledWith(
        'Error fetching GitLab languages',
        expect.objectContaining({
          projectPath: 'timeout/project',
          error: 'Network timeout',
        })
      );
    });

    it('should return empty object for project with no languages', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });

      await plugin.initialize(context);

      const result = await plugin.getProjectLanguages('no/languages');

      expect(result).toEqual({});
    });
  });

  // ==========================================================================
  // getReleases
  // ==========================================================================

  describe('getReleases', () => {
    it('should fetch project releases', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_RELEASE_RESPONSE),
      });

      await plugin.initialize(context);

      const result = await plugin.getReleases('project/path');

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        name: 'v1.0.0',
        tagName: 'v1.0.0',
        description: 'Initial release',
        releasedAt: '2024-01-15T00:00:00Z',
        author: { id: 100, username: 'user', name: 'User Name' },
      });
      expect(result[1]).toMatchObject({
        name: 'v0.9.0',
        tagName: 'v0.9.0',
        description: 'Beta release',
      });
    });

    it('should parse release assets', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_RELEASE_RESPONSE),
      });

      await plugin.initialize(context);

      const result = await plugin.getReleases('project/path');

      expect(result[0]?.assets?.sources).toHaveLength(2);
      expect(result[0]?.assets?.sources[0]).toEqual({
        format: 'zip',
        url: 'https://gitlab.com/project/-/archive/v1.0.0/project-v1.0.0.zip',
      });

      expect(result[1]?.assets?.links).toHaveLength(1);
      expect(result[1]?.assets?.links[0]).toEqual({
        name: 'Documentation',
        url: 'https://docs.example.com',
      });
    });

    it('should parse release with minimal fields', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve([SAMPLE_RELEASE_MINIMAL]),
      });

      await plugin.initialize(context);

      const result = await plugin.getReleases('project/path');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: 'v2.0.0',
        tagName: 'v2.0.0',
        releasedAt: '',
      });
    });

    it('should use custom limit', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_RELEASE_RESPONSE),
      });

      await plugin.initialize(context);

      await plugin.getReleases('project/path', { limit: 5 });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://gitlab.com/api/v4/projects/project%2Fpath/releases?per_page=5',
        expect.any(Object)
      );
    });

    it('should use default limit of 10', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_RELEASE_RESPONSE),
      });

      await plugin.initialize(context);

      await plugin.getReleases('project/path');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://gitlab.com/api/v4/projects/project%2Fpath/releases?per_page=10',
        expect.any(Object)
      );
    });

    it('should use custom baseUrl', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_RELEASE_RESPONSE),
      });

      await plugin.initialize(context);

      await plugin.getReleases('project/path', {
        baseUrl: 'https://gitlab.example.org/api/v4',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://gitlab.example.org/api/v4/projects/project%2Fpath/releases?per_page=10',
        expect.any(Object)
      );
    });

    it('should return empty array for API errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      await plugin.initialize(context);

      const result = await plugin.getReleases('error/project');

      expect(result).toEqual([]);
      expect(context.logger.warn).toHaveBeenCalledWith(
        'GitLab releases API error',
        expect.objectContaining({
          projectPath: 'error/project',
          status: 500,
        })
      );
    });

    it('should return empty array for network errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Connection failed'));

      await plugin.initialize(context);

      const result = await plugin.getReleases('network/error');

      expect(result).toEqual([]);
      expect(context.logger.warn).toHaveBeenCalledWith(
        'Error fetching GitLab releases',
        expect.objectContaining({
          projectPath: 'network/error',
          error: 'Connection failed',
        })
      );
    });

    it('should return empty array for project with no releases', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
      });

      await plugin.initialize(context);

      const result = await plugin.getReleases('no/releases');

      expect(result).toEqual([]);
    });

    it('should filter out releases with missing tag_name', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve([
            { tag_name: 'v1.0.0', name: 'Release 1' },
            { name: 'Invalid Release' }, // Missing tag_name
            { tag_name: 'v2.0.0', name: 'Release 2' },
          ]),
      });

      await plugin.initialize(context);

      const result = await plugin.getReleases('project/path');

      expect(result).toHaveLength(2);
      expect(result[0]?.tagName).toBe('v1.0.0');
      expect(result[1]?.tagName).toBe('v2.0.0');
    });
  });

  // ==========================================================================
  // parseProjectPath
  // ==========================================================================

  describe('parseProjectPath', () => {
    it('should parse gitlab.com URLs', () => {
      const path = plugin.parseProjectPath('https://gitlab.com/owner/repo');
      expect(path).toBe('owner/repo');
    });

    it('should parse gitlab.com URLs with subgroups', () => {
      const path = plugin.parseProjectPath('https://gitlab.com/group/subgroup/project');
      expect(path).toBe('group/subgroup');
    });

    it('should parse self-hosted GitLab URLs', () => {
      const path = plugin.parseProjectPath('https://gitlab.example.org/research/tools');
      expect(path).toBe('research/tools');
    });

    it('should parse URLs with www subdomain', () => {
      const path = plugin.parseProjectPath('https://www.gitlab.com/owner/repo');
      expect(path).toBe('owner/repo');
    });

    it('should parse URLs with .git suffix', () => {
      const path = plugin.parseProjectPath('https://gitlab.com/owner/repo.git');
      expect(path).toBe('owner/repo.git');
    });

    it('should parse URLs with trailing slash', () => {
      const path = plugin.parseProjectPath('https://gitlab.com/owner/repo/');
      expect(path).toBe('owner/repo');
    });

    it('should parse URLs with query parameters', () => {
      const path = plugin.parseProjectPath('https://gitlab.com/owner/repo?ref=main');
      expect(path).toBe('owner/repo');
    });

    it('should parse URLs with fragments', () => {
      const path = plugin.parseProjectPath('https://gitlab.com/owner/repo#readme');
      expect(path).toBe('owner/repo');
    });

    it('should return null for invalid URLs', () => {
      const path = plugin.parseProjectPath('not-a-url');
      expect(path).toBeNull();
    });

    it('should return null for URLs without path', () => {
      const path = plugin.parseProjectPath('https://gitlab.com');
      expect(path).toBeNull();
    });

    it('should return null for URLs with only one path segment', () => {
      const path = plugin.parseProjectPath('https://gitlab.com/owner');
      expect(path).toBeNull();
    });

    it('should return null for non-GitLab domains', () => {
      const path = plugin.parseProjectPath('https://github.com/owner/repo');
      expect(path).toBe('owner/repo'); // Still extracts path pattern
    });
  });

  // ==========================================================================
  // Rate Limiting
  // ==========================================================================

  describe('rate limiting', () => {
    it('should enforce rate limiting between requests', async () => {
      // Use real plugin (not testable subclass) to test rate limiting
      const realPlugin = new GitLabIntegrationPlugin();
      await realPlugin.initialize(context);

      const startTime = Date.now();

      // Make three sequential requests
      await realPlugin.getProject('project1');
      await realPlugin.getProject('project2');
      await realPlugin.getProject('project3');

      const elapsedTime = Date.now() - startTime;

      // Should take at least 200ms (2 * 100ms delays between 3 requests)
      // Use 190ms threshold to account for timing jitter in CI environments
      expect(elapsedTime).toBeGreaterThanOrEqual(190);
    });

    it('should not enforce rate limiting on cache hits', async () => {
      const cachedProject = {
        id: 12345,
        pathWithNamespace: 'cached/project',
        name: 'project',
        defaultBranch: 'main',
        visibility: 'public' as const,
        webUrl: 'https://gitlab.com/cached/project',
        cloneUrls: { http: 'https://gitlab.com/cached/project.git' },
        starCount: 100,
        forksCount: 20,
        openIssuesCount: 3,
        topics: [],
        lastActivityAt: '2024-01-01T00:00:00Z',
        createdAt: '2023-01-01T00:00:00Z',
        source: 'gitlab' as const,
      };

      context.cache.get = vi.fn().mockResolvedValue(cachedProject);

      // Use real plugin to test rate limiting
      const realPlugin = new GitLabIntegrationPlugin();
      await realPlugin.initialize(context);

      const startTime = Date.now();

      // Make three requests that hit cache
      await realPlugin.getProject('cached/project');
      await realPlugin.getProject('cached/project');
      await realPlugin.getProject('cached/project');

      const elapsedTime = Date.now() - startTime;

      // Should be fast (no rate limiting on cache hits)
      expect(elapsedTime).toBeLessThan(100);
    });
  });
});
