/**
 * Zenodo integration plugin for software and data archival.
 *
 * @remarks
 * Provides integration with Zenodo (https://zenodo.org) for archiving
 * research software, datasets, and other research outputs.
 *
 * This plugin is used to:
 * - Link preprints to archived software/data on Zenodo
 * - Verify DOI ownership for datasets
 * - Track citation metrics
 *
 * Uses Zenodo REST API:
 * - Base URL: https://zenodo.org/api
 * - Rate limit: 60 requests/minute (public), 100/minute (authenticated)
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
 * Zenodo record metadata.
 *
 * @public
 */
export interface ZenodoRecord {
  /**
   * Record ID.
   */
  id: number;

  /**
   * Concept record ID (version-independent).
   */
  conceptRecId: number;

  /**
   * DOI.
   */
  doi: string;

  /**
   * Concept DOI (version-independent).
   */
  conceptDoi?: string;

  /**
   * Title.
   */
  title: string;

  /**
   * Description.
   */
  description?: string;

  /**
   * Resource type.
   */
  resourceType: {
    type: string;
    subtype?: string;
  };

  /**
   * Creators.
   */
  creators: readonly {
    name: string;
    orcid?: string;
    affiliation?: string;
  }[];

  /**
   * Publication date.
   */
  publicationDate: string;

  /**
   * Keywords.
   */
  keywords?: readonly string[];

  /**
   * License.
   */
  license?: {
    id: string;
    title: string;
    url: string;
  };

  /**
   * Related identifiers (links to papers, code, etc.).
   */
  relatedIdentifiers?: readonly {
    identifier: string;
    relation: string;
    resourceType?: string;
    scheme?: string;
  }[];

  /**
   * Access rights.
   */
  accessRight: 'open' | 'embargoed' | 'restricted' | 'closed';

  /**
   * Files.
   */
  files?: readonly {
    key: string;
    size: number;
    checksum: string;
    links: {
      self: string;
    };
  }[];

  /**
   * Statistics.
   */
  stats?: {
    downloads: number;
    uniqueDownloads: number;
    views: number;
    uniqueViews: number;
    version_downloads: number;
    version_unique_downloads: number;
    version_views: number;
    version_unique_views: number;
  };

  /**
   * Links.
   */
  links: {
    self: string;
    html: string;
    doi: string;
    latest?: string;
    latest_html?: string;
  };

  /**
   * Version string.
   */
  version?: string;

  /**
   * Publication state.
   */
  state: 'done' | 'inprogress' | 'error' | 'unsubmitted';

  /**
   * Creation timestamp.
   */
  created: string;

  /**
   * Last update timestamp.
   */
  updated: string;

  /**
   * Source of the metadata.
   */
  source: 'zenodo';
}

/**
 * Zenodo API record response.
 *
 * @internal
 */
interface ZenodoApiRecord {
  id?: number;
  conceptrecid?: number;
  doi?: string;
  conceptdoi?: string;
  metadata?: {
    title?: string;
    description?: string;
    resource_type?: {
      type?: string;
      subtype?: string;
    };
    creators?: {
      name?: string;
      orcid?: string;
      affiliation?: string;
    }[];
    publication_date?: string;
    keywords?: string[];
    license?: {
      id?: string;
      title?: string;
      url?: string;
    };
    related_identifiers?: {
      identifier?: string;
      relation?: string;
      resource_type?: string;
      scheme?: string;
    }[];
    access_right?: string;
    version?: string;
  };
  files?: {
    key?: string;
    size?: number;
    checksum?: string;
    links?: { self?: string };
  }[];
  stats?: {
    downloads?: number;
    unique_downloads?: number;
    views?: number;
    unique_views?: number;
    version_downloads?: number;
    version_unique_downloads?: number;
    version_views?: number;
    version_unique_views?: number;
  };
  links?: {
    self?: string;
    html?: string;
    doi?: string;
    latest?: string;
    latest_html?: string;
  };
  state?: string;
  created?: string;
  updated?: string;
}

/**
 * Zenodo search result.
 *
 * @internal
 */
interface ZenodoSearchResult {
  hits: {
    total: number;
    hits: ZenodoApiRecord[];
  };
}

/**
 * Zenodo integration plugin.
 *
 * @remarks
 * Provides record lookup and linking for software/data archival on Zenodo.
 * Used to link preprints to their associated code and data deposits.
 *
 * @example
 * ```typescript
 * const plugin = new ZenodoIntegrationPlugin();
 * await manager.loadBuiltinPlugin(plugin);
 *
 * // Get record by DOI
 * const record = await plugin.getRecordByDoi('10.5281/zenodo.123456');
 *
 * // Search for software
 * const results = await plugin.searchRecords('machine learning', {
 *   type: 'software'
 * });
 * ```
 *
 * @public
 */
export class ZenodoIntegrationPlugin extends BasePlugin {
  /**
   * Plugin ID.
   */
  readonly id = 'pub.chive.plugin.zenodo';

  /**
   * Plugin manifest.
   */
  readonly manifest: IPluginManifest = {
    id: 'pub.chive.plugin.zenodo',
    name: 'Zenodo Integration',
    version: '0.1.0',
    description: 'Provides software and data archival linking via Zenodo',
    author: 'Aaron Steven White',
    license: 'MIT',
    permissions: {
      network: {
        allowedDomains: ['zenodo.org'],
      },
      storage: {
        maxSize: 50 * 1024 * 1024, // 50MB
      },
    },
    entrypoint: 'zenodo-integration.js',
  };

  /**
   * Zenodo API base URL.
   */
  private readonly API_BASE_URL = 'https://zenodo.org/api';

  /**
   * Cache TTL in seconds (1 day).
   */
  private readonly CACHE_TTL = 86400;

  /**
   * Minimum delay between requests (ms) - 60 requests/minute.
   */
  private rateLimitDelayMs = 1000;

  /**
   * Last request timestamp.
   */
  private lastRequestTime = 0;

  /**
   * Initializes the plugin.
   */
  protected onInitialize(): Promise<void> {
    this.logger.info('Zenodo plugin initialized', {
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
   * Gets record by ID.
   *
   * @param recordId - Zenodo record ID
   * @returns Record metadata or null
   *
   * @public
   */
  async getRecord(recordId: number): Promise<ZenodoRecord | null> {
    const cacheKey = `zenodo:record:${recordId}`;
    const cached = await this.cache.get<ZenodoRecord>(cacheKey);
    if (cached) {
      return cached;
    }

    await this.rateLimit();

    try {
      const response = await fetch(`${this.API_BASE_URL}/records/${recordId}`, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        this.logger.warn('Zenodo API error', {
          recordId,
          status: response.status,
        });
        return null;
      }

      const data = (await response.json()) as ZenodoApiRecord;
      const record = this.parseRecord(data);

      if (record) {
        await this.cache.set(cacheKey, record, this.CACHE_TTL);
      }

      return record;
    } catch (err) {
      this.logger.warn('Error fetching Zenodo record', {
        recordId,
        error: (err as Error).message,
      });
      return null;
    }
  }

  /**
   * Gets record by DOI.
   *
   * @param doi - Zenodo DOI
   * @returns Record metadata or null
   *
   * @public
   */
  async getRecordByDoi(doi: string): Promise<ZenodoRecord | null> {
    // Extract record ID from Zenodo DOI
    const recordId = this.extractRecordIdFromDoi(doi);
    if (recordId) {
      return this.getRecord(recordId);
    }

    // Fallback to search by DOI
    const results = await this.searchRecords(`doi:${doi}`, { limit: 1 });
    return results[0] ?? null;
  }

  /**
   * Searches for records.
   *
   * @param query - Search query
   * @param options - Search options
   * @returns Matching records
   *
   * @public
   */
  async searchRecords(
    query: string,
    options?: { limit?: number; type?: string; subtype?: string; sort?: string }
  ): Promise<readonly ZenodoRecord[]> {
    await this.rateLimit();

    const limit = Math.min(options?.limit ?? 10, 100);
    const params = new URLSearchParams({
      q: query,
      size: limit.toString(),
    });

    if (options?.type) {
      params.set('type', options.type);
    }
    if (options?.subtype) {
      params.set('subtype', options.subtype);
    }
    if (options?.sort) {
      params.set('sort', options.sort);
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/records?${params.toString()}`, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        this.logger.warn('Zenodo search error', {
          query,
          status: response.status,
        });
        return [];
      }

      const data = (await response.json()) as ZenodoSearchResult;
      const records: ZenodoRecord[] = [];

      for (const hit of data.hits.hits) {
        const record = this.parseRecord(hit);
        if (record) {
          records.push(record);
        }
      }

      return records;
    } catch (err) {
      this.logger.warn('Error searching Zenodo', {
        query,
        error: (err as Error).message,
      });
      return [];
    }
  }

  /**
   * Gets all versions of a record (via concept ID).
   *
   * @param conceptRecId - Concept record ID
   * @returns All versions of the record
   *
   * @public
   */
  async getVersions(conceptRecId: number): Promise<readonly ZenodoRecord[]> {
    return this.searchRecords(`conceptrecid:${conceptRecId}`, {
      sort: '-version',
      limit: 100,
    });
  }

  /**
   * Searches for software records.
   *
   * @param query - Search query
   * @param options - Search options
   * @returns Matching software records
   *
   * @public
   */
  async searchSoftware(
    query: string,
    options?: { limit?: number }
  ): Promise<readonly ZenodoRecord[]> {
    return this.searchRecords(query, {
      ...options,
      type: 'software',
    });
  }

  /**
   * Searches for dataset records.
   *
   * @param query - Search query
   * @param options - Search options
   * @returns Matching dataset records
   *
   * @public
   */
  async searchDatasets(
    query: string,
    options?: { limit?: number }
  ): Promise<readonly ZenodoRecord[]> {
    return this.searchRecords(query, {
      ...options,
      type: 'dataset',
    });
  }

  /**
   * Extracts record ID from Zenodo DOI.
   *
   * @param doi - DOI string
   * @returns Record ID or null
   */
  private extractRecordIdFromDoi(doi: string): number | null {
    // Zenodo DOIs: 10.5281/zenodo.{recordId}
    const match = /10\.5281\/zenodo\.(\d+)/.exec(doi);
    if (match?.[1]) {
      return parseInt(match[1], 10);
    }
    return null;
  }

  /**
   * Parses API record to ZenodoRecord.
   */
  private parseRecord(data: ZenodoApiRecord): ZenodoRecord | null {
    if (!data.id || !data.metadata?.title || !data.doi) {
      return null;
    }

    const metadata = data.metadata;

    return {
      id: data.id,
      conceptRecId: data.conceptrecid ?? data.id,
      doi: data.doi,
      conceptDoi: data.conceptdoi,
      title: metadata.title ?? 'Untitled',
      description: metadata.description,
      resourceType: {
        type: metadata.resource_type?.type ?? 'other',
        subtype: metadata.resource_type?.subtype,
      },
      creators: (metadata.creators ?? []).map((c) => ({
        name: c.name ?? 'Unknown',
        orcid: c.orcid,
        affiliation: c.affiliation,
      })),
      publicationDate: metadata.publication_date ?? '',
      keywords: metadata.keywords,
      license: metadata.license?.id
        ? {
            id: metadata.license.id,
            title: metadata.license.title ?? metadata.license.id,
            url: metadata.license.url ?? '',
          }
        : undefined,
      relatedIdentifiers: metadata.related_identifiers?.map((r) => ({
        identifier: r.identifier ?? '',
        relation: r.relation ?? '',
        resourceType: r.resource_type,
        scheme: r.scheme,
      })),
      accessRight: (metadata.access_right ?? 'open') as ZenodoRecord['accessRight'],
      files: data.files?.map((f) => ({
        key: f.key ?? '',
        size: f.size ?? 0,
        checksum: f.checksum ?? '',
        links: {
          self: f.links?.self ?? '',
        },
      })),
      stats: data.stats
        ? {
            downloads: data.stats.downloads ?? 0,
            uniqueDownloads: data.stats.unique_downloads ?? 0,
            views: data.stats.views ?? 0,
            uniqueViews: data.stats.unique_views ?? 0,
            version_downloads: data.stats.version_downloads ?? 0,
            version_unique_downloads: data.stats.version_unique_downloads ?? 0,
            version_views: data.stats.version_views ?? 0,
            version_unique_views: data.stats.version_unique_views ?? 0,
          }
        : undefined,
      links: {
        self: data.links?.self ?? '',
        html: data.links?.html ?? '',
        doi: data.links?.doi ?? '',
        latest: data.links?.latest,
        latest_html: data.links?.latest_html,
      },
      version: metadata.version,
      state: (data.state ?? 'done') as ZenodoRecord['state'],
      created: data.created ?? '',
      updated: data.updated ?? '',
      source: 'zenodo',
    };
  }
}

export default ZenodoIntegrationPlugin;
