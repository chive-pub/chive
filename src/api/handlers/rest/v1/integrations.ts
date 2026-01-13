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
 * **Architecture Flow:**
 * 1. Eprint indexed → `eprint.indexed` event emitted
 * 2. Integration plugins (GitHub, GitLab, etc.) listen for this event
 * 3. Plugins detect URLs in `supplementaryLinks` field
 * 4. Plugins fetch metadata from external APIs
 * 5. Plugins cache metadata with keys like `plugin:{pluginId}:github:{owner}:{repo}`
 * 6. This endpoint aggregates from individual plugin caches
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
          // No cached data yet; return basic info
          // The plugin will populate cache when it processes the eprint event
          githubIntegrations.push({
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
          });
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
          // No cached data yet
          gitlabIntegrations.push({
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
          });
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
          // No cached data yet
          zenodoIntegrations.push({
            type: 'zenodo',
            doi: `10.5281/zenodo.${recordId}`,
            title: 'Zenodo Record',
            url,
            resourceType: 'unknown',
            accessRight: 'unknown',
          });
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
          // Not yet checked or not archived
          swhIntegrations.push({
            type: 'software-heritage',
            originUrl: repoUrl,
            archived: false,
          });
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
 * - `GET /api/v1/eprints/:uri/integrations` - Get integrations for a eprint
 *
 * @public
 */
export function registerIntegrationRoutes(app: Hono<ChiveEnv>): void {
  const basePath = `${REST_PATH_PREFIX}/eprints`;

  // GET /api/v1/eprints/:uri/integrations: Get integrations for a eprint
  app.get(
    `${basePath}/:uri/integrations`,
    validateParams(uriPathParamSchema),
    getIntegrationsHandler
  );
}
