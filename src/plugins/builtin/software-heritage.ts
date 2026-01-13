/**
 * Software Heritage integration plugin for code archival.
 *
 * @remarks
 * Provides integration with Software Heritage (https://www.softwareheritage.org)
 * for permanent, intrinsic identification of source code.
 *
 * Software Heritage is a non-profit initiative to collect, preserve, and share
 * all publicly available source code. It provides:
 * - Permanent archival of source code
 * - Intrinsic identifiers (SWHIDs) based on content hashes
 * - SAVE API for requesting archival of new repositories
 *
 * Uses Software Heritage API:
 * - Base URL: https://archive.softwareheritage.org/api/1
 * - Rate limit: 60 requests/minute (unauthenticated)
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
 * Software Heritage identifier (SWHID).
 *
 * @remarks
 * SWHIDs are intrinsic identifiers based on content hashes.
 * Format: swh:1:{type}:{hash} where type is:
 * - cnt: content (file)
 * - dir: directory
 * - rev: revision (commit)
 * - rel: release
 * - snp: snapshot
 *
 * @public
 */
export interface SoftwareHeritageSwhid {
  /**
   * Full SWHID string.
   */
  swhid: string;

  /**
   * Object type.
   */
  type: 'cnt' | 'dir' | 'rev' | 'rel' | 'snp';

  /**
   * Object hash.
   */
  hash: string;
}

/**
 * Software Heritage origin (repository) metadata.
 *
 * @public
 */
export interface SoftwareHeritageOrigin {
  /**
   * Origin URL.
   */
  url: string;

  /**
   * Origin visits.
   */
  visits?: readonly SoftwareHeritageVisit[];

  /**
   * Last visit date.
   */
  lastVisit?: string;

  /**
   * Last snapshot SWHID.
   */
  lastSnapshotSwhid?: string;

  /**
   * Source of the metadata.
   */
  source: 'softwareheritage';
}

/**
 * Software Heritage visit metadata.
 *
 * @public
 */
export interface SoftwareHeritageVisit {
  /**
   * Visit ID.
   */
  visit: number;

  /**
   * Visit date.
   */
  date: string;

  /**
   * Visit status.
   */
  status: 'full' | 'partial' | 'ongoing' | 'not_found' | 'failed';

  /**
   * Visit type.
   */
  type: string;

  /**
   * Snapshot SWHID.
   */
  snapshotSwhid?: string;
}

/**
 * Software Heritage revision (commit) metadata.
 *
 * @public
 */
export interface SoftwareHeritageRevision {
  /**
   * Revision SWHID.
   */
  swhid: string;

  /**
   * Commit message.
   */
  message: string;

  /**
   * Author information.
   */
  author: {
    name?: string;
    email?: string;
  };

  /**
   * Committer information.
   */
  committer: {
    name?: string;
    email?: string;
  };

  /**
   * Commit date.
   */
  date: string;

  /**
   * Directory SWHID.
   */
  directorySwhid: string;

  /**
   * Parent revision SWHIDs.
   */
  parentSwhids: readonly string[];

  /**
   * Source of the metadata.
   */
  source: 'softwareheritage';
}

/**
 * SAVE request status.
 *
 * @public
 */
export interface SaveRequestStatus {
  /**
   * Origin URL.
   */
  originUrl: string;

  /**
   * Request status.
   */
  saveRequestStatus: 'pending' | 'scheduled' | 'running' | 'succeeded' | 'failed' | 'rejected';

  /**
   * Task status.
   */
  saveTaskStatus?: 'not yet scheduled' | 'scheduled' | 'running' | 'succeeded' | 'failed';

  /**
   * Visit type.
   */
  visitType: string;

  /**
   * Request date.
   */
  requestDate?: string;

  /**
   * Visit date.
   */
  visitDate?: string;
}

/**
 * Software Heritage API origin response.
 *
 * @internal
 */
interface SwhApiOrigin {
  url?: string;
}

/**
 * Software Heritage API visit response.
 *
 * @internal
 */
interface SwhApiVisit {
  visit?: number;
  date?: string;
  status?: string;
  type?: string;
  snapshot?: string;
}

/**
 * Software Heritage API revision response.
 *
 * @internal
 */
interface SwhApiRevision {
  id?: string;
  message?: string;
  author?: { name?: string; email?: string };
  committer?: { name?: string; email?: string };
  date?: string;
  directory?: string;
  parents?: { id?: string }[];
}

/**
 * Software Heritage API SAVE response.
 *
 * @internal
 */
interface SwhApiSaveResponse {
  origin_url?: string;
  save_request_status?: string;
  save_task_status?: string;
  visit_type?: string;
  request_date?: string;
  visit_date?: string;
}

/**
 * Software Heritage integration plugin.
 *
 * @remarks
 * Provides code archival verification and SWHID lookup.
 * Used to verify that eprint code is permanently archived.
 *
 * @example
 * ```typescript
 * const plugin = new SoftwareHeritagePlugin();
 * await manager.loadBuiltinPlugin(plugin);
 *
 * // Check if repository is archived
 * const origin = await plugin.getOrigin('https://github.com/user/repo');
 *
 * // Request archival via SAVE API
 * const status = await plugin.requestArchival('https://github.com/user/repo');
 * ```
 *
 * @public
 */
export class SoftwareHeritagePlugin extends BasePlugin {
  /**
   * Plugin ID.
   */
  readonly id = 'pub.chive.plugin.software-heritage';

  /**
   * Plugin manifest.
   */
  readonly manifest: IPluginManifest = {
    id: 'pub.chive.plugin.software-heritage',
    name: 'Software Heritage Integration',
    version: '0.1.0',
    description: 'Provides code archival verification via Software Heritage',
    author: 'Aaron Steven White',
    license: 'MIT',
    permissions: {
      network: {
        allowedDomains: ['archive.softwareheritage.org'],
      },
      storage: {
        maxSize: 20 * 1024 * 1024, // 20MB
      },
    },
    entrypoint: 'software-heritage.js',
  };

  /**
   * Software Heritage API base URL.
   */
  private readonly API_BASE_URL = 'https://archive.softwareheritage.org/api/1';

  /**
   * Cache TTL in seconds (1 hour - archival status can change).
   */
  private readonly CACHE_TTL = 3600;

  /**
   * Minimum delay between requests (ms) - 60 requests/minute.
   */
  protected rateLimitDelayMs = 1000;

  /**
   * Last request timestamp.
   */
  private lastRequestTime = 0;

  /**
   * Initializes the plugin.
   */
  protected onInitialize(): Promise<void> {
    this.logger.info('Software Heritage plugin initialized', {
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
   * Gets origin (repository) metadata.
   *
   * @param url - Repository URL
   * @returns Origin metadata or null if not archived
   *
   * @public
   */
  async getOrigin(url: string): Promise<SoftwareHeritageOrigin | null> {
    const cacheKey = `swh:origin:${url}`;
    const cached = await this.cache.get<SoftwareHeritageOrigin>(cacheKey);
    if (cached) {
      return cached;
    }

    await this.rateLimit();

    try {
      const encodedUrl = encodeURIComponent(url);
      const response = await fetch(`${this.API_BASE_URL}/origin/${encodedUrl}/get/`, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        this.logger.warn('Software Heritage API error', {
          url,
          status: response.status,
        });
        return null;
      }

      const data = (await response.json()) as SwhApiOrigin;

      // Fetch visits for this origin
      const visits = await this.getOriginVisits(url, { limit: 5 });

      const origin: SoftwareHeritageOrigin = {
        url: data.url ?? url,
        visits: visits.length > 0 ? visits : undefined,
        lastVisit: visits[0]?.date,
        lastSnapshotSwhid: visits[0]?.snapshotSwhid,
        source: 'softwareheritage',
      };

      await this.cache.set(cacheKey, origin, this.CACHE_TTL);
      return origin;
    } catch (err) {
      this.logger.warn('Error fetching Software Heritage origin', {
        url,
        error: (err as Error).message,
      });
      return null;
    }
  }

  /**
   * Gets visits for an origin.
   *
   * @param url - Repository URL
   * @param options - Query options
   * @returns Array of visits
   *
   * @public
   */
  async getOriginVisits(
    url: string,
    options?: { limit?: number }
  ): Promise<readonly SoftwareHeritageVisit[]> {
    await this.rateLimit();

    const limit = options?.limit ?? 10;

    try {
      const encodedUrl = encodeURIComponent(url);
      const response = await fetch(
        `${this.API_BASE_URL}/origin/${encodedUrl}/visits/?last_visit=true&per_page=${limit}`,
        {
          headers: {
            Accept: 'application/json',
          },
        }
      );

      if (!response.ok) {
        return [];
      }

      const data = (await response.json()) as SwhApiVisit[];
      return data
        .map((v) => this.parseVisit(v))
        .filter((v): v is SoftwareHeritageVisit => v !== null)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch {
      return [];
    }
  }

  /**
   * Gets revision (commit) metadata by SWHID.
   *
   * @param swhid - Revision SWHID
   * @returns Revision metadata or null
   *
   * @public
   */
  async getRevision(swhid: string): Promise<SoftwareHeritageRevision | null> {
    const parsed = this.parseSwhid(swhid);
    if (parsed?.type !== 'rev') {
      return null;
    }

    await this.rateLimit();

    try {
      const response = await fetch(`${this.API_BASE_URL}/revision/${parsed.hash}/`, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as SwhApiRevision;
      return this.parseRevision(data);
    } catch {
      return null;
    }
  }

  /**
   * Requests archival of a repository via SAVE API.
   *
   * @remarks
   * This triggers Software Heritage to archive the repository.
   * The archival is asynchronous - use getSaveRequestStatus to check progress.
   *
   * @param url - Repository URL to archive
   * @param visitType - Type of repository (git, svn, hg, etc.)
   * @returns Request status
   *
   * @public
   */
  async requestArchival(url: string, visitType = 'git'): Promise<SaveRequestStatus | null> {
    await this.rateLimit();

    try {
      const response = await fetch(
        `${this.API_BASE_URL}/origin/save/${visitType}/url/${encodeURIComponent(url)}/`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
          },
        }
      );

      if (!response.ok) {
        this.logger.warn('SAVE request failed', {
          url,
          status: response.status,
        });
        return null;
      }

      const data = (await response.json()) as SwhApiSaveResponse;
      return this.parseSaveResponse(data);
    } catch (err) {
      this.logger.warn('Error requesting SAVE', {
        url,
        error: (err as Error).message,
      });
      return null;
    }
  }

  /**
   * Gets status of a SAVE request.
   *
   * @param url - Repository URL
   * @param visitType - Type of repository
   * @returns Request status or null
   *
   * @public
   */
  async getSaveRequestStatus(url: string, visitType = 'git'): Promise<SaveRequestStatus | null> {
    await this.rateLimit();

    try {
      const response = await fetch(
        `${this.API_BASE_URL}/origin/save/${visitType}/url/${encodeURIComponent(url)}/`,
        {
          headers: {
            Accept: 'application/json',
          },
        }
      );

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as SwhApiSaveResponse[];
      const latest = data[0];
      return latest ? this.parseSaveResponse(latest) : null;
    } catch {
      return null;
    }
  }

  /**
   * Resolves a SWHID to get object details.
   *
   * @param swhid - SWHID to resolve
   * @returns Object URL or null
   *
   * @public
   */
  async resolveSwhid(swhid: string): Promise<string | null> {
    const parsed = this.parseSwhid(swhid);
    if (!parsed) {
      return null;
    }

    await this.rateLimit();

    try {
      const response = await fetch(`${this.API_BASE_URL}/resolve/${swhid}/`, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as { browse_url?: string };
      return data.browse_url ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Checks if a repository is archived.
   *
   * @param url - Repository URL
   * @returns True if archived
   *
   * @public
   */
  async isArchived(url: string): Promise<boolean> {
    const origin = await this.getOrigin(url);
    return origin !== null && (origin.visits?.length ?? 0) > 0;
  }

  /**
   * Parses a SWHID string.
   *
   * @param swhid - SWHID string
   * @returns Parsed SWHID or null
   */
  parseSwhid(swhid: string): SoftwareHeritageSwhid | null {
    // Format: swh:1:{type}:{hash}
    const match = /^swh:1:(cnt|dir|rev|rel|snp):([a-f0-9]{40})$/i.exec(swhid);
    if (!match) {
      return null;
    }

    return {
      swhid,
      type: match[1] as SoftwareHeritageSwhid['type'],
      hash: match[2] ?? '',
    };
  }

  /**
   * Builds a SWHID from components.
   *
   * @param type - Object type
   * @param hash - Object hash
   * @returns SWHID string
   */
  buildSwhid(type: SoftwareHeritageSwhid['type'], hash: string): string {
    return `swh:1:${type}:${hash}`;
  }

  /**
   * Parses API visit to SoftwareHeritageVisit.
   */
  private parseVisit(data: SwhApiVisit): SoftwareHeritageVisit | null {
    if (data.visit === undefined || !data.date || !data.status) {
      return null;
    }

    return {
      visit: data.visit,
      date: data.date,
      status: data.status as SoftwareHeritageVisit['status'],
      type: data.type ?? 'git',
      snapshotSwhid: data.snapshot ? this.buildSwhid('snp', data.snapshot) : undefined,
    };
  }

  /**
   * Parses API revision to SoftwareHeritageRevision.
   */
  private parseRevision(data: SwhApiRevision): SoftwareHeritageRevision | null {
    if (!data.id) {
      return null;
    }

    return {
      swhid: this.buildSwhid('rev', data.id),
      message: data.message ?? '',
      author: {
        name: data.author?.name,
        email: data.author?.email,
      },
      committer: {
        name: data.committer?.name,
        email: data.committer?.email,
      },
      date: data.date ?? '',
      directorySwhid: data.directory ? this.buildSwhid('dir', data.directory) : '',
      parentSwhids: (data.parents ?? [])
        .filter((p): p is { id: string } => p.id !== undefined)
        .map((p) => this.buildSwhid('rev', p.id)),
      source: 'softwareheritage',
    };
  }

  /**
   * Parses API SAVE response.
   */
  private parseSaveResponse(data: SwhApiSaveResponse): SaveRequestStatus {
    return {
      originUrl: data.origin_url ?? '',
      saveRequestStatus: (data.save_request_status ??
        'pending') as SaveRequestStatus['saveRequestStatus'],
      saveTaskStatus: data.save_task_status as SaveRequestStatus['saveTaskStatus'],
      visitType: data.visit_type ?? 'git',
      requestDate: data.request_date,
      visitDate: data.visit_date,
    };
  }
}

export default SoftwareHeritagePlugin;
