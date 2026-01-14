/**
 * GitHub integration plugin for repository linking.
 *
 * @remarks
 * Links eprints to GitHub repositories for supplementary materials,
 * code, and data. Fetches repository metadata via GitHub API.
 *
 * Features:
 * - Detects GitHub URLs in eprint supplementary links
 * - Fetches repository metadata (stars, forks, license, etc.)
 * - Caches metadata to reduce API calls
 * - Emits events for repository linking
 *
 * @packageDocumentation
 * @public
 * @since 0.1.0
 */

import { NotFoundError, RateLimitError, PluginError } from '../../types/errors.js';
import type { IPluginManifest } from '../../types/interfaces/plugin.interface.js';

import { BasePlugin } from './base-plugin.js';

/**
 * GitHub repository metadata.
 *
 * @public
 */
export interface GitHubRepoInfo {
  /**
   * Repository owner.
   */
  owner: string;

  /**
   * Repository name.
   */
  repo: string;

  /**
   * Star count.
   */
  stars: number;

  /**
   * Fork count.
   */
  forks: number;

  /**
   * Last updated timestamp.
   */
  lastUpdated: string;

  /**
   * SPDX license identifier or null.
   */
  license: string | null;

  /**
   * Primary programming language.
   */
  language: string | null;

  /**
   * Repository description.
   */
  description: string | null;

  /**
   * Repository topics.
   */
  topics: readonly string[];
}

/**
 * Eprint indexed event data.
 *
 * @internal
 */
interface EprintIndexedEvent {
  uri: string;
  title: string;
  supplementaryLinks?: readonly string[];
}

/**
 * GitHub API repository response structure.
 *
 * @internal
 */
interface GitHubApiResponse {
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
  license: { spdx_id: string } | null;
  language: string | null;
  description: string | null;
  topics: readonly string[];
}

/**
 * GitHub integration plugin.
 *
 * @remarks
 * Automatically links eprints to GitHub repositories when they
 * reference GitHub URLs in their supplementary materials.
 *
 * @example
 * ```typescript
 * const plugin = new GitHubIntegrationPlugin();
 * await manager.loadBuiltinPlugin(plugin, {
 *   githubToken: process.env.GITHUB_TOKEN, // Optional for higher rate limits
 * });
 * ```
 *
 * @public
 */
export class GitHubIntegrationPlugin extends BasePlugin {
  /**
   * Plugin ID.
   */
  readonly id = 'pub.chive.plugin.github';

  /**
   * Plugin manifest.
   */
  readonly manifest: IPluginManifest = {
    id: 'pub.chive.plugin.github',
    name: 'GitHub Integration',
    version: '0.1.0',
    description: 'Links eprints to GitHub repositories for code and supplementary materials',
    author: 'Aaron Steven White',
    license: 'MIT',
    permissions: {
      network: {
        allowedDomains: ['api.github.com'],
      },
      hooks: ['eprint.indexed', 'eprint.updated'],
      storage: {
        maxSize: 10 * 1024 * 1024, // 10MB for caching
      },
    },
    entrypoint: 'github-integration.js',
  };

  /**
   * Cache TTL in seconds (1 hour).
   */
  private readonly CACHE_TTL = 3600;

  /**
   * GitHub API token (optional, for higher rate limits).
   */
  private githubToken?: string;

  /**
   * Rate limit delay in milliseconds.
   */
  private readonly RATE_LIMIT_DELAY = 1000;

  /**
   * Last request timestamp.
   */
  private lastRequestTime = 0;

  /**
   * Initializes the plugin.
   */
  protected onInitialize(): Promise<void> {
    // Load optional GitHub token from config
    this.githubToken = this.getConfig<string>('githubToken');

    // Subscribe to eprint events
    this.context.eventBus.on('eprint.indexed', (...args: readonly unknown[]) => {
      void this.handleEprintIndexed(args[0] as EprintIndexedEvent);
    });
    this.context.eventBus.on('eprint.updated', (...args: readonly unknown[]) => {
      void this.handleEprintUpdated(args[0] as EprintIndexedEvent);
    });

    this.logger.info('GitHub integration initialized', {
      authenticated: !!this.githubToken,
    });

    return Promise.resolve();
  }

  /**
   * Handles eprint indexed events.
   */
  private async handleEprintIndexed(data: EprintIndexedEvent): Promise<void> {
    await this.processGitHubLinks(data.uri, data.supplementaryLinks);
  }

  /**
   * Handles eprint updated events.
   */
  private async handleEprintUpdated(data: EprintIndexedEvent): Promise<void> {
    await this.processGitHubLinks(data.uri, data.supplementaryLinks);
  }

  /**
   * Processes GitHub links from an eprint.
   */
  private async processGitHubLinks(eprintUri: string, links?: readonly string[]): Promise<void> {
    if (!links || links.length === 0) {
      return;
    }

    const githubLinks = links.filter((link) => this.isGitHubUrl(link));

    for (const link of githubLinks) {
      const repoInfo = this.parseGitHubUrl(link);
      if (!repoInfo) {
        continue;
      }

      try {
        const metadata = await this.fetchRepoMetadata(repoInfo.owner, repoInfo.repo);

        this.logger.info('GitHub repository linked', {
          eprintUri,
          repo: `${repoInfo.owner}/${repoInfo.repo}`,
          stars: metadata.stars,
          language: metadata.language,
        });

        // Record metrics
        this.recordCounter('repos_linked', { owner: repoInfo.owner });

        // Emit repository linked event
        this.context.eventBus.emit('github.repo.linked', {
          eprintUri,
          owner: repoInfo.owner,
          repo: repoInfo.repo,
          metadata,
        });
      } catch (err) {
        this.logger.warn('Failed to fetch GitHub repository', {
          error: (err as Error).message,
          repo: `${repoInfo.owner}/${repoInfo.repo}`,
        });

        this.recordCounter('fetch_errors', { type: 'github' });
      }
    }
  }

  /**
   * Checks if a URL is a GitHub URL.
   */
  private isGitHubUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.hostname === 'github.com' || parsed.hostname === 'www.github.com';
    } catch {
      return false;
    }
  }

  /**
   * Parses a GitHub URL to extract owner and repo.
   */
  private parseGitHubUrl(url: string): { owner: string; repo: string } | null {
    const match = /github\.com\/([^/]+)\/([^/?#]+)/.exec(url);
    if (!match || match.length < 3) {
      return null;
    }

    const owner = match[1];
    const repoWithExt = match[2];
    if (!owner || !repoWithExt) {
      return null;
    }

    return {
      owner,
      repo: repoWithExt.replace(/\.git$/, ''),
    };
  }

  /**
   * Fetches repository metadata from GitHub API.
   */
  private async fetchRepoMetadata(owner: string, repo: string): Promise<GitHubRepoInfo> {
    const cacheKey = `github:${owner}:${repo}`;

    // Check cache first
    const cached = await this.cache.get<GitHubRepoInfo>(cacheKey);
    if (cached) {
      this.logger.debug('GitHub repo from cache', { owner, repo });
      return cached;
    }

    // Rate limiting
    await this.rateLimit();

    // Fetch from GitHub API
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Chive-AppView/1.0 (https://chive.pub; contact@chive.pub)',
    };

    if (this.githubToken) {
      headers.Authorization = `token ${this.githubToken}`;
    }

    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });

    if (!response.ok) {
      if (response.status === 404) {
        throw new NotFoundError('GitHub Repository', `${owner}/${repo}`);
      }
      if (response.status === 403) {
        throw new RateLimitError(60);
      }
      throw new PluginError(this.id, 'EXECUTE', `GitHub API error: ${response.status}`);
    }

    const data = (await response.json()) as GitHubApiResponse;

    const metadata: GitHubRepoInfo = {
      owner,
      repo,
      stars: data.stargazers_count,
      forks: data.forks_count,
      lastUpdated: data.updated_at,
      license: data.license?.spdx_id ?? null,
      language: data.language,
      description: data.description,
      topics: data.topics ?? [],
    };

    // Cache the result
    await this.cache.set(cacheKey, metadata, this.CACHE_TTL);

    return metadata;
  }

  /**
   * Applies rate limiting between requests.
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;

    if (elapsed < this.RATE_LIMIT_DELAY) {
      const delay = this.RATE_LIMIT_DELAY - elapsed;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
  }
}

export default GitHubIntegrationPlugin;
