/**
 * GitLab integration plugin for code repository linking.
 *
 * @remarks
 * Provides repository metadata and code linking via the GitLab API.
 * GitLab (https://gitlab.com) is a DevOps platform that provides
 * source code management, CI/CD, and more.
 *
 * This plugin is used to:
 * - Link eprints to GitLab repositories
 * - Verify repository ownership for claiming
 * - Track releases and commits
 *
 * Uses GitLab REST API v4:
 * - Base URL: https://gitlab.com/api/v4
 * - Supports both gitlab.com and self-hosted instances
 * - Rate limit: 2000 requests/hour (authenticated)
 *
 * ATProto Compliance:
 * - All data is AppView cache (ephemeral, rebuildable)
 * - Never writes to user PDSes
 *
 * @packageDocumentation
 * @public
 * @since 0.1.0
 */

import type { IPluginManifest } from '../../types/interfaces/plugin.interface.js';

import { BasePlugin } from './base-plugin.js';

/**
 * GitLab project metadata.
 *
 * @public
 */
export interface GitLabProject {
  /**
   * Project ID.
   */
  id: number;

  /**
   * Project path (namespace/project).
   */
  pathWithNamespace: string;

  /**
   * Project name.
   */
  name: string;

  /**
   * Description.
   */
  description?: string;

  /**
   * Default branch.
   */
  defaultBranch: string;

  /**
   * Visibility level.
   */
  visibility: 'public' | 'internal' | 'private';

  /**
   * Web URL.
   */
  webUrl: string;

  /**
   * Clone URLs.
   */
  cloneUrls: {
    http: string;
    ssh?: string;
  };

  /**
   * Star count.
   */
  starCount: number;

  /**
   * Fork count.
   */
  forksCount: number;

  /**
   * Open issues count.
   */
  openIssuesCount: number;

  /**
   * Programming languages.
   */
  languages?: Record<string, number>;

  /**
   * Topics/tags.
   */
  topics: readonly string[];

  /**
   * License.
   */
  license?: {
    key: string;
    name: string;
  };

  /**
   * Owner information.
   */
  owner?: {
    id: number;
    username: string;
    name: string;
  };

  /**
   * Last activity date.
   */
  lastActivityAt: string;

  /**
   * Creation date.
   */
  createdAt: string;

  /**
   * Source of the metadata.
   */
  source: 'gitlab';
}

/**
 * GitLab release metadata.
 *
 * @public
 */
export interface GitLabRelease {
  /**
   * Release name.
   */
  name: string;

  /**
   * Tag name.
   */
  tagName: string;

  /**
   * Description/release notes.
   */
  description?: string;

  /**
   * Release date.
   */
  releasedAt: string;

  /**
   * Author information.
   */
  author?: {
    id: number;
    username: string;
    name: string;
  };

  /**
   * Assets (files, links).
   */
  assets?: {
    sources: readonly { format: string; url: string }[];
    links: readonly { name: string; url: string }[];
  };
}

/**
 * GitLab API project response.
 *
 * @internal
 */
interface GitLabApiProject {
  id?: number;
  path_with_namespace?: string;
  name?: string;
  description?: string;
  default_branch?: string;
  visibility?: string;
  web_url?: string;
  http_url_to_repo?: string;
  ssh_url_to_repo?: string;
  star_count?: number;
  forks_count?: number;
  open_issues_count?: number;
  topics?: string[];
  license?: { key?: string; name?: string };
  owner?: { id?: number; username?: string; name?: string };
  last_activity_at?: string;
  created_at?: string;
}

/**
 * GitLab API release response.
 *
 * @internal
 */
interface GitLabApiRelease {
  name?: string;
  tag_name?: string;
  description?: string;
  released_at?: string;
  author?: { id?: number; username?: string; name?: string };
  assets?: {
    sources?: { format?: string; url?: string }[];
    links?: { name?: string; url?: string }[];
  };
}

/**
 * GitLab integration plugin.
 *
 * @remarks
 * Provides repository metadata lookup and code linking for eprints.
 * Supports both gitlab.com and self-hosted GitLab instances.
 *
 * @example
 * ```typescript
 * const plugin = new GitLabIntegrationPlugin();
 * await manager.loadBuiltinPlugin(plugin);
 *
 * // Get project by path
 * const project = await plugin.getProject('user/repo');
 *
 * // Get releases
 * const releases = await plugin.getReleases('user/repo');
 * ```
 *
 * @public
 */
export class GitLabIntegrationPlugin extends BasePlugin {
  /**
   * Plugin ID.
   */
  readonly id = 'pub.chive.plugin.gitlab';

  /**
   * Plugin manifest.
   */
  readonly manifest: IPluginManifest = {
    id: 'pub.chive.plugin.gitlab',
    name: 'GitLab Integration',
    version: '0.1.0',
    description: 'Provides repository linking and code verification via GitLab',
    author: 'Aaron Steven White',
    license: 'MIT',
    permissions: {
      network: {
        allowedDomains: ['gitlab.com', '*.gitlab.com'],
      },
      storage: {
        maxSize: 50 * 1024 * 1024, // 50MB
      },
    },
    entrypoint: 'gitlab-integration.js',
  };

  /**
   * Default GitLab API base URL.
   */
  private readonly DEFAULT_API_URL = 'https://gitlab.com/api/v4';

  /**
   * Cache TTL in seconds (1 day).
   */
  private readonly CACHE_TTL = 86400;

  /**
   * Minimum delay between requests (ms).
   *
   * @remarks
   * Protected to allow test subclasses to disable rate limiting.
   */
  protected rateLimitDelayMs = 100;

  /**
   * Last request timestamp.
   */
  private lastRequestTime = 0;

  /**
   * Initializes the plugin.
   */
  protected onInitialize(): Promise<void> {
    this.logger.info('GitLab plugin initialized', {
      rateLimit: `${this.rateLimitDelayMs}ms between requests`,
    });

    return Promise.resolve();
  }

  /**
   * Enforces rate limiting.
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;

    if (elapsed < this.rateLimitDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, this.rateLimitDelayMs - elapsed));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Gets project by path.
   *
   * @param projectPath - Project path (namespace/project)
   * @param options - API options
   * @returns Project metadata or null
   *
   * @public
   */
  async getProject(
    projectPath: string,
    options?: { baseUrl?: string }
  ): Promise<GitLabProject | null> {
    const baseUrl = options?.baseUrl ?? this.DEFAULT_API_URL;
    const cacheKey = `gitlab:project:${baseUrl}:${projectPath}`;
    const cached = await this.cache.get<GitLabProject>(cacheKey);
    if (cached) {
      return cached;
    }

    await this.rateLimit();

    try {
      const encodedPath = encodeURIComponent(projectPath);
      const response = await fetch(`${baseUrl}/projects/${encodedPath}`, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        this.logger.warn('GitLab API error', {
          projectPath,
          status: response.status,
        });
        return null;
      }

      const data = (await response.json()) as GitLabApiProject;
      const project = this.parseProject(data);

      if (project) {
        await this.cache.set(cacheKey, project, this.CACHE_TTL);
      }

      return project;
    } catch (err) {
      this.logger.warn('Error fetching GitLab project', {
        projectPath,
        error: (err as Error).message,
      });
      return null;
    }
  }

  /**
   * Gets project languages.
   *
   * @param projectPath - Project path
   * @param options - API options
   * @returns Language percentages
   *
   * @public
   */
  async getProjectLanguages(
    projectPath: string,
    options?: { baseUrl?: string }
  ): Promise<Record<string, number> | null> {
    const baseUrl = options?.baseUrl ?? this.DEFAULT_API_URL;

    await this.rateLimit();

    try {
      const encodedPath = encodeURIComponent(projectPath);
      const response = await fetch(`${baseUrl}/projects/${encodedPath}/languages`, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        return null;
      }

      return (await response.json()) as Record<string, number>;
    } catch (err) {
      this.logger.warn('Error fetching GitLab languages', {
        projectPath,
        error: (err as Error).message,
      });
      return null;
    }
  }

  /**
   * Gets project releases.
   *
   * @param projectPath - Project path
   * @param options - API options
   * @returns Array of releases
   *
   * @public
   */
  async getReleases(
    projectPath: string,
    options?: { baseUrl?: string; limit?: number }
  ): Promise<readonly GitLabRelease[]> {
    const baseUrl = options?.baseUrl ?? this.DEFAULT_API_URL;
    const limit = options?.limit ?? 10;

    await this.rateLimit();

    try {
      const encodedPath = encodeURIComponent(projectPath);
      const response = await fetch(
        `${baseUrl}/projects/${encodedPath}/releases?per_page=${limit}`,
        {
          headers: {
            Accept: 'application/json',
          },
        }
      );

      if (!response.ok) {
        this.logger.warn('GitLab releases API error', {
          projectPath,
          status: response.status,
        });
        return [];
      }

      const data = (await response.json()) as GitLabApiRelease[];
      return data.map((r) => this.parseRelease(r)).filter(Boolean) as GitLabRelease[];
    } catch (err) {
      this.logger.warn('Error fetching GitLab releases', {
        projectPath,
        error: (err as Error).message,
      });
      return [];
    }
  }

  /**
   * Parses GitLab URL to extract project path.
   *
   * @param url - GitLab URL
   * @returns Project path or null
   *
   * @public
   */
  parseProjectPath(url: string): string | null {
    try {
      const parsed = new URL(url);

      // Match gitlab.com/namespace/project or self-hosted
      const pathMatch = /^\/([^/]+\/[^/]+)/.exec(parsed.pathname);
      if (pathMatch?.[1]) {
        return pathMatch[1];
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Parses API project to GitLabProject.
   */
  private parseProject(data: GitLabApiProject): GitLabProject | null {
    if (!data.id || !data.path_with_namespace || !data.name) {
      return null;
    }

    return {
      id: data.id,
      pathWithNamespace: data.path_with_namespace,
      name: data.name,
      description: data.description,
      defaultBranch: data.default_branch ?? 'main',
      visibility: (data.visibility ?? 'private') as GitLabProject['visibility'],
      webUrl: data.web_url ?? '',
      cloneUrls: {
        http: data.http_url_to_repo ?? '',
        ssh: data.ssh_url_to_repo,
      },
      starCount: data.star_count ?? 0,
      forksCount: data.forks_count ?? 0,
      openIssuesCount: data.open_issues_count ?? 0,
      topics: data.topics ?? [],
      license: data.license?.key
        ? { key: data.license.key, name: data.license.name ?? data.license.key }
        : undefined,
      owner: data.owner?.id
        ? {
            id: data.owner.id,
            username: data.owner.username ?? '',
            name: data.owner.name ?? '',
          }
        : undefined,
      lastActivityAt: data.last_activity_at ?? '',
      createdAt: data.created_at ?? '',
      source: 'gitlab',
    };
  }

  /**
   * Parses API release to GitLabRelease.
   */
  private parseRelease(data: GitLabApiRelease): GitLabRelease | null {
    if (!data.tag_name) {
      return null;
    }

    return {
      name: data.name ?? data.tag_name,
      tagName: data.tag_name,
      description: data.description,
      releasedAt: data.released_at ?? '',
      author: data.author?.id
        ? {
            id: data.author.id,
            username: data.author.username ?? '',
            name: data.author.name ?? '',
          }
        : undefined,
      assets: data.assets
        ? {
            sources: (data.assets.sources ?? []).map((s) => ({
              format: s.format ?? '',
              url: s.url ?? '',
            })),
            links: (data.assets.links ?? []).map((l) => ({
              name: l.name ?? '',
              url: l.url ?? '',
            })),
          }
        : undefined,
    };
  }
}

export default GitLabIntegrationPlugin;
