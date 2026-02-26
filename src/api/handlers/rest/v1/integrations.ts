/**
 * REST API v1 integration endpoints.
 *
 * @remarks
 * Provides aggregated plugin integration data for eprints.
 * Returns cached data from external integrations (GitHub, GitLab, Zenodo, etc.).
 *
 * Integration data is populated by the plugin system when eprints are indexed.
 * The plugins detect external URLs in eprint supplementary materials and fetch
 * metadata from external APIs, caching the results in Redis.
 *
 * When no cached data exists (cache expired or plugin never processed the eprint),
 * this endpoint fetches live data from the public APIs as a fallback, then caches
 * the result so subsequent requests are fast.
 *
 * **Architecture Flow:**
 * 1. Eprint indexed -> `eprint.indexed` event emitted
 * 2. Integration plugins (GitHub, GitLab, etc.) listen for this event
 * 3. Plugins detect URLs in `supplementaryLinks` field
 * 4. Plugins fetch metadata from external APIs
 * 5. Plugins cache metadata with keys like `plugin:{pluginId}:github:{owner}:{repo}`
 * 6. This endpoint aggregates from individual plugin caches
 * 7. On cache miss, this endpoint fetches live data from public APIs as a fallback
 *
 * **ATProto Compliance:**
 * - All data is AppView cache (ephemeral, rebuildable)
 * - Never writes to user PDSes
 * - Metadata can be rebuilt by re-processing eprint events
 *
 * @packageDocumentation
 * @public
 */

import type { Context, Hono } from 'hono';
import { z } from 'zod';

import type { AtUri } from '../../../../types/atproto.js';
import type { ILogger } from '../../../../types/interfaces/logger.interface.js';
import { REST_PATH_PREFIX } from '../../../config.js';
import { validateParams } from '../../../middleware/validation.js';
import type { ChiveEnv } from '../../../types/context.js';

/**
 * GitHub repository integration data.
 *
 * @remarks
 * Matches the GitHubRepoInfo interface from github-integration plugin.
 */
interface GitHubIntegration {
  type: 'github';
  owner: string;
  repo: string;
  url: string;
  stars: number;
  forks: number;
  language: string | null;
  description: string | null;
  license: string | null;
  lastUpdated: string;
  topics: readonly string[];
}

/**
 * GitLab project integration data.
 *
 * @remarks
 * Matches the GitLabProject interface from gitlab-integration plugin.
 */
interface GitLabIntegration {
  type: 'gitlab';
  pathWithNamespace: string;
  name: string;
  url: string;
  stars: number;
  forks: number;
  description: string | null;
  visibility: string;
  topics: readonly string[];
  lastActivityAt: string;
}

/**
 * Zenodo record integration data.
 *
 * @remarks
 * Matches the ZenodoRecord interface from zenodo-integration plugin.
 */
interface ZenodoIntegration {
  type: 'zenodo';
  doi: string;
  conceptDoi?: string;
  title: string;
  url: string;
  resourceType: string;
  accessRight: string;
  version?: string;
  stats?: {
    downloads: number;
    views: number;
  };
}

/**
 * Software Heritage integration data.
 *
 * @remarks
 * Matches the SoftwareHeritageOrigin interface from software-heritage plugin.
 */
interface SoftwareHeritageIntegration {
  type: 'software-heritage';
  originUrl: string;
  archived: boolean;
  lastVisit?: string;
  lastSnapshotSwhid?: string;
  browseUrl?: string;
}

/**
 * Dataset integration data (Figshare, Dryad, OSF).
 */
interface DatasetIntegration {
  type: 'figshare' | 'dryad' | 'osf';
  doi?: string;
  title: string;
  url: string;
  description?: string;
}

/**
 * Combined integration data response.
 */
interface IntegrationsResponse {
  eprintUri: string;
  github?: GitHubIntegration[];
  gitlab?: GitLabIntegration[];
  zenodo?: ZenodoIntegration[];
  softwareHeritage?: SoftwareHeritageIntegration[];
  datasets?: DatasetIntegration[];
  lastUpdated: string;
}

/**
 * URI path parameter schema.
 */
const uriPathParamSchema = z.object({
  uri: z.string().describe('URL-encoded AT URI'),
});

/**
 * Parses GitHub URL to extract owner and repo.
 */
function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = /github\.com\/([^/]+)\/([^/?#]+)/.exec(url);
  if (!match || match.length < 3 || !match[1] || !match[2]) {
    return null;
  }
  return {
    owner: match[1],
    repo: match[2].replace(/\.git$/, ''),
  };
}

/**
 * Parses GitLab URL to extract project path.
 */
function parseGitLabUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const pathMatch = /^\/([^/]+\/[^/]+)/.exec(parsed.pathname);
    return pathMatch?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * Extracts Zenodo record ID from URL or DOI.
 */
function parseZenodoUrl(url: string): number | null {
  const urlMatch = /zenodo\.org\/records?\/(\d+)/.exec(url);
  if (urlMatch?.[1]) {
    return parseInt(urlMatch[1], 10);
  }
  const doiMatch = /10\.5281\/zenodo\.(\d+)/.exec(url);
  if (doiMatch?.[1]) {
    return parseInt(doiMatch[1], 10);
  }
  return null;
}

/**
 * Categorizes URLs by integration type.
 */
function categorizeUrls(urls: readonly string[]): {
  github: { url: string; owner: string; repo: string }[];
  gitlab: { url: string; path: string }[];
  zenodo: { url: string; recordId: number }[];
  softwareHeritage: string[];
  figshare: string[];
  dryad: string[];
  osf: string[];
} {
  const result = {
    github: [] as { url: string; owner: string; repo: string }[],
    gitlab: [] as { url: string; path: string }[],
    zenodo: [] as { url: string; recordId: number }[],
    softwareHeritage: [] as string[],
    figshare: [] as string[],
    dryad: [] as string[],
    osf: [] as string[],
  };

  for (const url of urls) {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase();

      if (hostname === 'github.com' || hostname === 'www.github.com') {
        const info = parseGitHubUrl(url);
        if (info) {
          result.github.push({ url, ...info });
        }
      } else if (hostname === 'gitlab.com' || hostname.endsWith('.gitlab.com')) {
        const path = parseGitLabUrl(url);
        if (path) {
          result.gitlab.push({ url, path });
        }
      } else if (hostname === 'zenodo.org' || hostname === 'www.zenodo.org') {
        const recordId = parseZenodoUrl(url);
        if (recordId) {
          result.zenodo.push({ url, recordId });
        }
      } else if (
        hostname === 'archive.softwareheritage.org' ||
        hostname === 'softwareheritage.org'
      ) {
        result.softwareHeritage.push(url);
      } else if (hostname === 'figshare.com' || hostname.endsWith('.figshare.com')) {
        result.figshare.push(url);
      } else if (hostname === 'datadryad.org' || hostname === 'www.datadryad.org') {
        result.dryad.push(url);
      } else if (hostname === 'osf.io' || hostname.endsWith('.osf.io')) {
        result.osf.push(url);
      }
    } catch {
      // Invalid URL, skip
    }
  }

  return result;
}

/**
 * Cache TTL in seconds for live-fetched integration data (1 hour).
 */
const LIVE_FETCH_CACHE_TTL = 3600;

/**
 * GitHub API response for a public repository.
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
  topics: string[];
}

/**
 * GitLab API project response for a public project.
 *
 * @internal
 */
interface GitLabApiProjectResponse {
  path_with_namespace?: string;
  name?: string;
  description?: string;
  visibility?: string;
  web_url?: string;
  star_count?: number;
  forks_count?: number;
  topics?: string[];
  last_activity_at?: string;
}

/**
 * Zenodo API record response for a public record.
 *
 * @internal
 */
interface ZenodoApiRecordResponse {
  doi?: string;
  conceptdoi?: string;
  metadata?: {
    title?: string;
    resource_type?: { type?: string };
    access_right?: string;
    version?: string;
  };
  stats?: {
    downloads?: number;
    views?: number;
  };
  links?: {
    html?: string;
  };
}

/**
 * Software Heritage API visit response.
 *
 * @internal
 */
interface SwhApiVisitResponse {
  date?: string;
  snapshot?: string;
  status?: string;
}

/**
 * Fetches GitHub repository data from the public API and caches the result.
 *
 * Falls back to placeholder data if the fetch fails.
 *
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param url - Original GitHub URL from the eprint
 * @param redis - Redis client for caching
 * @param logger - Logger instance
 * @returns GitHub integration data
 */
async function fetchGitHubLive(
  owner: string,
  repo: string,
  url: string,
  redis: import('ioredis').Redis,
  logger: ILogger
): Promise<GitHubIntegration> {
  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Chive-AppView/1.0 (https://chive.pub; contact@chive.pub)',
      },
    });

    if (!response.ok) {
      logger.debug('GitHub API returned non-OK status during live fetch', {
        owner,
        repo,
        status: response.status,
      });
      return makeGitHubPlaceholder(owner, repo, url);
    }

    const data = (await response.json()) as GitHubApiResponse;

    const cacheValue = {
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

    // Cache using the same key pattern as the plugin
    const cacheKey = `plugin:pub.chive.plugin.github:github:${owner}:${repo}`;
    await redis.set(cacheKey, JSON.stringify(cacheValue), 'EX', LIVE_FETCH_CACHE_TTL);

    return {
      type: 'github',
      owner,
      repo,
      url: `https://github.com/${owner}/${repo}`,
      stars: cacheValue.stars,
      forks: cacheValue.forks,
      language: cacheValue.language,
      description: cacheValue.description,
      license: cacheValue.license,
      lastUpdated: cacheValue.lastUpdated,
      topics: cacheValue.topics,
    };
  } catch (err) {
    logger.warn('Live GitHub API fetch failed', {
      error: (err as Error).message,
      owner,
      repo,
    });
    return makeGitHubPlaceholder(owner, repo, url);
  }
}

/**
 * Creates placeholder GitHub integration data when no cache or live data is available.
 *
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param url - Original GitHub URL
 * @returns Placeholder integration data with zero stats
 */
function makeGitHubPlaceholder(owner: string, repo: string, url: string): GitHubIntegration {
  return {
    type: 'github',
    owner,
    repo,
    url,
    stars: 0,
    forks: 0,
    language: null,
    description: null,
    license: null,
    lastUpdated: '',
    topics: [],
  };
}

/**
 * Fetches GitLab project data from the public API and caches the result.
 *
 * Falls back to placeholder data if the fetch fails.
 *
 * @param path - Project path (namespace/project)
 * @param url - Original GitLab URL from the eprint
 * @param redis - Redis client for caching
 * @param logger - Logger instance
 * @returns GitLab integration data
 */
async function fetchGitLabLive(
  path: string,
  url: string,
  redis: import('ioredis').Redis,
  logger: ILogger
): Promise<GitLabIntegration> {
  try {
    const encodedPath = encodeURIComponent(path);
    const response = await fetch(`https://gitlab.com/api/v4/projects/${encodedPath}`, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      logger.debug('GitLab API returned non-OK status during live fetch', {
        path,
        status: response.status,
      });
      return makeGitLabPlaceholder(path, url);
    }

    const data = (await response.json()) as GitLabApiProjectResponse;

    const cacheValue = {
      pathWithNamespace: data.path_with_namespace ?? path,
      name: data.name ?? path.split('/')[1] ?? path,
      description: data.description,
      visibility: data.visibility ?? 'public',
      webUrl: data.web_url ?? url,
      starCount: data.star_count ?? 0,
      forksCount: data.forks_count ?? 0,
      topics: data.topics ?? [],
      lastActivityAt: data.last_activity_at ?? '',
    };

    // Cache using the same key pattern as the plugin
    const cacheKey = `plugin:pub.chive.plugin.gitlab:gitlab:project:https://gitlab.com/api/v4:${path}`;
    await redis.set(cacheKey, JSON.stringify(cacheValue), 'EX', LIVE_FETCH_CACHE_TTL);

    return {
      type: 'gitlab',
      pathWithNamespace: cacheValue.pathWithNamespace,
      name: cacheValue.name,
      url: cacheValue.webUrl,
      stars: cacheValue.starCount,
      forks: cacheValue.forksCount,
      description: cacheValue.description ?? null,
      visibility: cacheValue.visibility,
      topics: cacheValue.topics,
      lastActivityAt: cacheValue.lastActivityAt,
    };
  } catch (err) {
    logger.warn('Live GitLab API fetch failed', {
      error: (err as Error).message,
      path,
    });
    return makeGitLabPlaceholder(path, url);
  }
}

/**
 * Creates placeholder GitLab integration data when no cache or live data is available.
 *
 * @param path - Project path
 * @param url - Original GitLab URL
 * @returns Placeholder integration data with zero stats
 */
function makeGitLabPlaceholder(path: string, url: string): GitLabIntegration {
  return {
    type: 'gitlab',
    pathWithNamespace: path,
    name: path.split('/')[1] ?? path,
    url,
    stars: 0,
    forks: 0,
    description: null,
    visibility: 'unknown',
    topics: [],
    lastActivityAt: '',
  };
}

/**
 * Fetches Zenodo record data from the public API and caches the result.
 *
 * Falls back to placeholder data if the fetch fails.
 *
 * @param recordId - Zenodo record ID
 * @param url - Original Zenodo URL from the eprint
 * @param redis - Redis client for caching
 * @param logger - Logger instance
 * @returns Zenodo integration data
 */
async function fetchZenodoLive(
  recordId: number,
  url: string,
  redis: import('ioredis').Redis,
  logger: ILogger
): Promise<ZenodoIntegration> {
  try {
    const response = await fetch(`https://zenodo.org/api/records/${recordId}`, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      logger.debug('Zenodo API returned non-OK status during live fetch', {
        recordId,
        status: response.status,
      });
      return makeZenodoPlaceholder(recordId, url);
    }

    const data = (await response.json()) as ZenodoApiRecordResponse;

    const cacheValue = {
      doi: data.doi ?? `10.5281/zenodo.${recordId}`,
      conceptDoi: data.conceptdoi,
      title: data.metadata?.title ?? 'Zenodo Record',
      resourceType: { type: data.metadata?.resource_type?.type ?? 'unknown' },
      accessRight: data.metadata?.access_right ?? 'unknown',
      version: data.metadata?.version,
      stats: data.stats
        ? { downloads: data.stats.downloads ?? 0, views: data.stats.views ?? 0 }
        : undefined,
      links: { html: data.links?.html ?? url },
    };

    // Cache using the same key pattern as the plugin
    const cacheKey = `plugin:pub.chive.plugin.zenodo:zenodo:record:${recordId}`;
    await redis.set(cacheKey, JSON.stringify(cacheValue), 'EX', LIVE_FETCH_CACHE_TTL);

    return {
      type: 'zenodo',
      doi: cacheValue.doi,
      conceptDoi: cacheValue.conceptDoi,
      title: cacheValue.title,
      url: cacheValue.links.html,
      resourceType: cacheValue.resourceType.type,
      accessRight: cacheValue.accessRight,
      version: cacheValue.version,
      stats: cacheValue.stats,
    };
  } catch (err) {
    logger.warn('Live Zenodo API fetch failed', {
      error: (err as Error).message,
      recordId,
    });
    return makeZenodoPlaceholder(recordId, url);
  }
}

/**
 * Creates placeholder Zenodo integration data when no cache or live data is available.
 *
 * @param recordId - Zenodo record ID
 * @param url - Original Zenodo URL
 * @returns Placeholder integration data
 */
function makeZenodoPlaceholder(recordId: number, url: string): ZenodoIntegration {
  return {
    type: 'zenodo',
    doi: `10.5281/zenodo.${recordId}`,
    title: 'Zenodo Record',
    url,
    resourceType: 'unknown',
    accessRight: 'unknown',
  };
}

/**
 * Fetches Software Heritage origin data from the public API and caches the result.
 *
 * Falls back to placeholder data if the fetch fails. Also fetches the latest
 * visit to determine snapshot SWHID.
 *
 * @param repoUrl - Repository URL to check archival status for
 * @param redis - Redis client for caching
 * @param logger - Logger instance
 * @returns Software Heritage integration data
 */
async function fetchSoftwareHeritageLive(
  repoUrl: string,
  redis: import('ioredis').Redis,
  logger: ILogger
): Promise<SoftwareHeritageIntegration> {
  try {
    const encodedUrl = encodeURIComponent(repoUrl);
    const response = await fetch(
      `https://archive.softwareheritage.org/api/1/origin/${encodedUrl}/get/`,
      { headers: { Accept: 'application/json' } }
    );

    if (response.status === 404) {
      // Not archived
      return { type: 'software-heritage', originUrl: repoUrl, archived: false };
    }

    if (!response.ok) {
      logger.debug('Software Heritage API returned non-OK status during live fetch', {
        repoUrl,
        status: response.status,
      });
      return { type: 'software-heritage', originUrl: repoUrl, archived: false };
    }

    // Origin exists; consume the response body, then fetch visit info
    await response.json();
    let lastVisit: string | undefined;
    let lastSnapshotSwhid: string | undefined;

    try {
      const visitResponse = await fetch(
        `https://archive.softwareheritage.org/api/1/origin/${encodedUrl}/visit/latest/`,
        { headers: { Accept: 'application/json' } }
      );

      if (visitResponse.ok) {
        const visitData = (await visitResponse.json()) as SwhApiVisitResponse;
        lastVisit = visitData.date;
        if (visitData.snapshot) {
          lastSnapshotSwhid = `swh:1:snp:${visitData.snapshot}`;
        }
      }
    } catch {
      // Visit fetch failed; proceed without visit data
    }

    const cacheValue = {
      url: repoUrl,
      lastVisit,
      lastSnapshotSwhid,
    };

    // Cache using the same key pattern as the plugin
    const cacheKey = `plugin:pub.chive.plugin.software-heritage:swh:origin:${repoUrl}`;
    await redis.set(cacheKey, JSON.stringify(cacheValue), 'EX', LIVE_FETCH_CACHE_TTL);

    return {
      type: 'software-heritage',
      originUrl: repoUrl,
      archived: true,
      lastVisit,
      lastSnapshotSwhid,
      browseUrl: `https://archive.softwareheritage.org/browse/origin/directory/?origin_url=${encodeURIComponent(repoUrl)}`,
    };
  } catch (err) {
    logger.warn('Live Software Heritage API fetch failed', {
      error: (err as Error).message,
      repoUrl,
    });
    return { type: 'software-heritage', originUrl: repoUrl, archived: false };
  }
}

/**
 * Handler for GET /api/v1/eprints/:uri/integrations
 *
 * @remarks
 * Aggregates integration data from plugin caches based on the eprint's
 * supplementary links. Each plugin caches metadata with keys like:
 * - `plugin:pub.chive.plugin.github:github:{owner}:{repo}`
 * - `plugin:pub.chive.plugin.gitlab:gitlab:project:https://gitlab.com/api/v4:{path}`
 * - `plugin:pub.chive.plugin.zenodo:zenodo:record:{id}`
 * - `plugin:pub.chive.plugin.software-heritage:swh:origin:{url}`
 *
 * This endpoint:
 * 1. Fetches the eprint to get supplementary links
 * 2. Categorizes URLs by integration type
 * 3. Looks up cached metadata from each plugin's scoped cache
 * 4. Aggregates and returns the data
 */
async function getIntegrationsHandler(c: Context<ChiveEnv>): Promise<Response> {
  const pathParams = c.get('validatedInput') as z.infer<typeof uriPathParamSchema>;
  const decodedUri = decodeURIComponent(pathParams.uri);
  const redis = c.get('redis');
  const services = c.get('services');
  const logger = c.get('logger');

  // Get the eprint to access supplementary links
  const eprint = await services.eprint.getEprint(decodedUri as AtUri);
  if (!eprint) {
    return c.json({ error: 'Eprint not found' }, 404);
  }

  // Get supplementary links from eprint repositories field
  const supplementaryLinks: string[] = [];

  // Extract URLs from repositories field (new structured format)
  if (eprint.repositories) {
    // Code repositories
    if (eprint.repositories.code) {
      for (const repo of eprint.repositories.code) {
        if (repo.url) supplementaryLinks.push(repo.url);
        if (repo.archiveUrl) supplementaryLinks.push(repo.archiveUrl);
      }
    }
    // Data repositories
    if (eprint.repositories.data) {
      for (const repo of eprint.repositories.data) {
        if (repo.url) supplementaryLinks.push(repo.url);
      }
    }
    // Pre-registration
    if (eprint.repositories.preregistration?.url) {
      supplementaryLinks.push(eprint.repositories.preregistration.url);
    }
    // Protocols
    if (eprint.repositories.protocols) {
      for (const protocol of eprint.repositories.protocols) {
        if (protocol.url) supplementaryLinks.push(protocol.url);
      }
    }
    // Materials
    if (eprint.repositories.materials) {
      for (const material of eprint.repositories.materials) {
        if (material.url) supplementaryLinks.push(material.url);
      }
    }
  }

  // If no supplementary links, return empty response
  if (supplementaryLinks.length === 0) {
    return c.json({
      eprintUri: decodedUri,
      lastUpdated: new Date().toISOString(),
    } satisfies IntegrationsResponse);
  }

  // Categorize URLs by integration type
  const categorized = categorizeUrls(supplementaryLinks);

  const response: IntegrationsResponse = {
    eprintUri: decodedUri,
    lastUpdated: new Date().toISOString(),
  };

  // Aggregate GitHub data from plugin cache
  if (categorized.github.length > 0) {
    const githubIntegrations: GitHubIntegration[] = [];

    for (const { url, owner, repo } of categorized.github) {
      try {
        // Plugin caches with key: plugin:pub.chive.plugin.github:github:{owner}:{repo}
        const cacheKey = `plugin:pub.chive.plugin.github:github:${owner}:${repo}`;
        const cachedJson = await redis.get(cacheKey);

        if (cachedJson) {
          const cached = JSON.parse(cachedJson) as {
            owner: string;
            repo: string;
            stars: number;
            forks: number;
            lastUpdated: string;
            license: string | null;
            language: string | null;
            description: string | null;
            topics: readonly string[];
          };

          githubIntegrations.push({
            type: 'github',
            owner: cached.owner,
            repo: cached.repo,
            url: `https://github.com/${cached.owner}/${cached.repo}`,
            stars: cached.stars,
            forks: cached.forks,
            language: cached.language,
            description: cached.description,
            license: cached.license,
            lastUpdated: cached.lastUpdated,
            topics: cached.topics,
          });
        } else {
          // No cached data; fetch live from GitHub public API
          const liveData = await fetchGitHubLive(owner, repo, url, redis, logger);
          githubIntegrations.push(liveData);
        }
      } catch (err) {
        logger.warn('Failed to fetch GitHub integration cache', {
          error: (err as Error).message,
          owner,
          repo,
        });
      }
    }

    if (githubIntegrations.length > 0) {
      response.github = githubIntegrations;
    }
  }

  // Aggregate GitLab data from plugin cache
  if (categorized.gitlab.length > 0) {
    const gitlabIntegrations: GitLabIntegration[] = [];

    for (const { url, path } of categorized.gitlab) {
      try {
        // Plugin caches with key: plugin:pub.chive.plugin.gitlab:gitlab:project:https://gitlab.com/api/v4:{path}
        const cacheKey = `plugin:pub.chive.plugin.gitlab:gitlab:project:https://gitlab.com/api/v4:${path}`;
        const cachedJson = await redis.get(cacheKey);

        if (cachedJson) {
          const cached = JSON.parse(cachedJson) as {
            pathWithNamespace: string;
            name: string;
            description?: string;
            visibility: string;
            webUrl: string;
            starCount: number;
            forksCount: number;
            topics: readonly string[];
            lastActivityAt: string;
          };

          gitlabIntegrations.push({
            type: 'gitlab',
            pathWithNamespace: cached.pathWithNamespace,
            name: cached.name,
            url: cached.webUrl,
            stars: cached.starCount,
            forks: cached.forksCount,
            description: cached.description ?? null,
            visibility: cached.visibility,
            topics: cached.topics,
            lastActivityAt: cached.lastActivityAt,
          });
        } else {
          // No cached data; fetch live from GitLab public API
          const liveData = await fetchGitLabLive(path, url, redis, logger);
          gitlabIntegrations.push(liveData);
        }
      } catch (err) {
        logger.warn('Failed to fetch GitLab integration cache', {
          error: (err as Error).message,
          path,
        });
      }
    }

    if (gitlabIntegrations.length > 0) {
      response.gitlab = gitlabIntegrations;
    }
  }

  // Aggregate Zenodo data from plugin cache
  if (categorized.zenodo.length > 0) {
    const zenodoIntegrations: ZenodoIntegration[] = [];

    for (const { url, recordId } of categorized.zenodo) {
      try {
        // Plugin caches with key: plugin:pub.chive.plugin.zenodo:zenodo:record:{id}
        const cacheKey = `plugin:pub.chive.plugin.zenodo:zenodo:record:${recordId}`;
        const cachedJson = await redis.get(cacheKey);

        if (cachedJson) {
          const cached = JSON.parse(cachedJson) as {
            doi: string;
            conceptDoi?: string;
            title: string;
            resourceType: { type: string };
            accessRight: string;
            version?: string;
            stats?: { downloads: number; views: number };
            links: { html: string };
          };

          zenodoIntegrations.push({
            type: 'zenodo',
            doi: cached.doi,
            conceptDoi: cached.conceptDoi,
            title: cached.title,
            url: cached.links.html,
            resourceType: cached.resourceType.type,
            accessRight: cached.accessRight,
            version: cached.version,
            stats: cached.stats,
          });
        } else {
          // No cached data; fetch live from Zenodo public API
          const liveData = await fetchZenodoLive(recordId, url, redis, logger);
          zenodoIntegrations.push(liveData);
        }
      } catch (err) {
        logger.warn('Failed to fetch Zenodo integration cache', {
          error: (err as Error).message,
          recordId,
        });
      }
    }

    if (zenodoIntegrations.length > 0) {
      response.zenodo = zenodoIntegrations;
    }
  }

  // Aggregate Software Heritage data from plugin cache
  // Also check GitHub repos for archival status
  const repoUrlsToCheck = [
    ...categorized.softwareHeritage,
    ...categorized.github.map(({ owner, repo }) => `https://github.com/${owner}/${repo}`),
  ];

  if (repoUrlsToCheck.length > 0) {
    const swhIntegrations: SoftwareHeritageIntegration[] = [];

    for (const repoUrl of repoUrlsToCheck) {
      try {
        // Plugin caches with key: plugin:pub.chive.plugin.software-heritage:swh:origin:{url}
        const cacheKey = `plugin:pub.chive.plugin.software-heritage:swh:origin:${repoUrl}`;
        const cachedJson = await redis.get(cacheKey);

        if (cachedJson) {
          const cached = JSON.parse(cachedJson) as {
            url: string;
            lastVisit?: string;
            lastSnapshotSwhid?: string;
          };

          swhIntegrations.push({
            type: 'software-heritage',
            originUrl: repoUrl,
            archived: true,
            lastVisit: cached.lastVisit,
            lastSnapshotSwhid: cached.lastSnapshotSwhid,
            browseUrl: `https://archive.softwareheritage.org/browse/origin/directory/?origin_url=${encodeURIComponent(repoUrl)}`,
          });
        } else {
          // No cached data; fetch live from Software Heritage public API
          const liveData = await fetchSoftwareHeritageLive(repoUrl, redis, logger);
          swhIntegrations.push(liveData);
        }
      } catch (err) {
        logger.warn('Failed to fetch Software Heritage integration cache', {
          error: (err as Error).message,
          repoUrl,
        });
      }
    }

    if (swhIntegrations.length > 0) {
      response.softwareHeritage = swhIntegrations;
    }
  }

  // Collect dataset links (these are simpler, just URL categorization)
  const datasets: DatasetIntegration[] = [];

  for (const link of categorized.figshare) {
    datasets.push({
      type: 'figshare',
      title: 'Figshare Dataset',
      url: link,
    });
  }

  for (const link of categorized.dryad) {
    datasets.push({
      type: 'dryad',
      title: 'Dryad Dataset',
      url: link,
    });
  }

  for (const link of categorized.osf) {
    datasets.push({
      type: 'osf',
      title: 'OSF Project',
      url: link,
    });
  }

  if (datasets.length > 0) {
    response.datasets = datasets;
  }

  return c.json(response);
}

/**
 * Registers REST v1 integration routes.
 *
 * @param app - Hono application
 *
 * @remarks
 * Routes:
 * - `GET /api/v1/eprints/:uri/integrations` - Get integrations for an eprint
 *
 * @public
 */
export function registerIntegrationRoutes(app: Hono<ChiveEnv>): void {
  const basePath = `${REST_PATH_PREFIX}/eprints`;

  // GET /api/v1/eprints/:uri/integrations: Get integrations for an eprint
  app.get(
    `${basePath}/:uri/integrations`,
    validateParams(uriPathParamSchema),
    getIntegrationsHandler
  );
}
