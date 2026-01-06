/**
 * Dryad integration plugin for research data linking.
 *
 * @remarks
 * Provides integration with Dryad (https://datadryad.org) for linking
 * preprints to their associated research data.
 *
 * Dryad is a curated, general-purpose research data repository that makes
 * datasets discoverable, freely reusable, and citable.
 *
 * Uses Dryad REST API v2:
 * - Base URL: https://datadryad.org/api/v2
 * - Rate limit: Not documented (be polite)
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
 * Dryad dataset metadata.
 *
 * @public
 */
export interface DryadDataset {
  /**
   * Dataset identifier.
   */
  id: string;

  /**
   * DOI.
   */
  doi: string;

  /**
   * Title.
   */
  title: string;

  /**
   * Abstract/description.
   */
  abstract?: string;

  /**
   * Authors.
   */
  authors: readonly {
    firstName?: string;
    lastName?: string;
    orcid?: string;
    affiliation?: string;
  }[];

  /**
   * Keywords.
   */
  keywords?: readonly string[];

  /**
   * Related publication.
   */
  relatedPublication?: {
    type: string;
    identifier: string;
    identifierType: string;
    title?: string;
  };

  /**
   * License.
   */
  license: string;

  /**
   * Total file size in bytes.
   */
  totalSize: number;

  /**
   * File count.
   */
  fileCount: number;

  /**
   * Version number.
   */
  versionNumber: number;

  /**
   * Publication date.
   */
  publicationDate?: string;

  /**
   * Last modification date.
   */
  lastModificationDate?: string;

  /**
   * Curation status.
   */
  curationStatus?: string;

  /**
   * Share link.
   */
  sharingLink: string;

  /**
   * Download statistics.
   */
  downloadCount?: number;

  /**
   * View statistics.
   */
  viewCount?: number;

  /**
   * Source of the metadata.
   */
  source: 'dryad';
}

/**
 * Dryad API dataset response.
 *
 * @internal
 */
interface DryadApiDataset {
  identifier?: string;
  id?: number;
  doi?: string;
  title?: string;
  abstract?: string;
  authors?: {
    firstName?: string;
    lastName?: string;
    orcid?: string;
    affiliation?: string;
  }[];
  keywords?: string[];
  relatedWorks?: {
    relationship?: string;
    identifierType?: string;
    identifier?: string;
  }[];
  license?: string;
  storageSize?: number;
  versionNumber?: number;
  publicationDate?: string;
  lastModificationDate?: string;
  curationStatus?: string;
  sharingLink?: string;
}

/**
 * Dryad search result.
 *
 * @internal
 */
interface DryadSearchResult {
  count: number;
  _embedded?: {
    'stash:datasets'?: DryadApiDataset[];
  };
  _links?: {
    next?: { href: string };
  };
}

/**
 * Dryad integration plugin.
 *
 * @remarks
 * Provides dataset lookup and linking for research data on Dryad.
 * Used to link preprints to their associated datasets.
 *
 * @example
 * ```typescript
 * const plugin = new DryadPlugin();
 * await manager.loadBuiltinPlugin(plugin);
 *
 * // Get dataset by DOI
 * const dataset = await plugin.getDatasetByDoi('10.5061/dryad.abc123');
 *
 * // Search for datasets
 * const results = await plugin.searchDatasets('climate change');
 * ```
 *
 * @public
 */
export class DryadPlugin extends BasePlugin {
  /**
   * Plugin ID.
   */
  readonly id = 'pub.chive.plugin.dryad';

  /**
   * Plugin manifest.
   */
  readonly manifest: IPluginManifest = {
    id: 'pub.chive.plugin.dryad',
    name: 'Dryad Integration',
    version: '0.1.0',
    description: 'Provides research data linking via Dryad',
    author: 'Aaron Steven White',
    license: 'MIT',
    permissions: {
      network: {
        allowedDomains: ['datadryad.org'],
      },
      storage: {
        maxSize: 30 * 1024 * 1024, // 30MB
      },
    },
    entrypoint: 'dryad.js',
  };

  /**
   * Dryad API base URL.
   */
  private readonly API_BASE_URL = 'https://datadryad.org/api/v2';

  /**
   * Cache TTL in seconds (1 day).
   */
  private readonly CACHE_TTL = 86400;

  /**
   * Minimum delay between requests (ms).
   */
  private rateLimitDelayMs = 500;

  /**
   * Last request timestamp.
   */
  private lastRequestTime = 0;

  /**
   * Initializes the plugin.
   */
  protected onInitialize(): Promise<void> {
    this.logger.info('Dryad plugin initialized', {
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
   * Gets dataset by ID.
   *
   * @param datasetId - Dryad dataset ID
   * @returns Dataset metadata or null
   *
   * @public
   */
  async getDataset(datasetId: string): Promise<DryadDataset | null> {
    const cacheKey = `dryad:dataset:${datasetId}`;
    const cached = await this.cache.get<DryadDataset>(cacheKey);
    if (cached) {
      return cached;
    }

    await this.rateLimit();

    try {
      const response = await fetch(`${this.API_BASE_URL}/datasets/${datasetId}`, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        this.logger.warn('Dryad API error', {
          datasetId,
          status: response.status,
        });
        return null;
      }

      const data = (await response.json()) as DryadApiDataset;
      const dataset = this.parseDataset(data);

      if (dataset) {
        await this.cache.set(cacheKey, dataset, this.CACHE_TTL);
      }

      return dataset;
    } catch (err) {
      this.logger.warn('Error fetching Dryad dataset', {
        datasetId,
        error: (err as Error).message,
      });
      return null;
    }
  }

  /**
   * Gets dataset by DOI.
   *
   * @param doi - Dryad DOI
   * @returns Dataset metadata or null
   *
   * @public
   */
  async getDatasetByDoi(doi: string): Promise<DryadDataset | null> {
    const normalizedDoi = this.normalizeDoi(doi);
    if (!normalizedDoi) {
      return null;
    }

    // Search by DOI
    const results = await this.searchDatasets(`doi:"${normalizedDoi}"`, { limit: 1 });
    return results[0] ?? null;
  }

  /**
   * Searches for datasets.
   *
   * @param query - Search query
   * @param options - Search options
   * @returns Matching datasets
   *
   * @public
   */
  async searchDatasets(
    query: string,
    options?: { limit?: number; page?: number }
  ): Promise<readonly DryadDataset[]> {
    await this.rateLimit();

    const limit = Math.min(options?.limit ?? 10, 100);
    const page = options?.page ?? 1;

    try {
      const params = new URLSearchParams({
        q: query,
        per_page: limit.toString(),
        page: page.toString(),
      });

      const response = await fetch(`${this.API_BASE_URL}/search?${params.toString()}`, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        this.logger.warn('Dryad search error', {
          query,
          status: response.status,
        });
        return [];
      }

      const data = (await response.json()) as DryadSearchResult;
      const datasets: DryadDataset[] = [];

      const hits = data._embedded?.['stash:datasets'] ?? [];
      for (const hit of hits) {
        const dataset = this.parseDataset(hit);
        if (dataset) {
          datasets.push(dataset);
        }
      }

      return datasets;
    } catch (err) {
      this.logger.warn('Error searching Dryad', {
        query,
        error: (err as Error).message,
      });
      return [];
    }
  }

  /**
   * Finds datasets related to a publication DOI.
   *
   * @param publicationDoi - DOI of the related publication
   * @returns Associated datasets
   *
   * @public
   */
  async findByPublicationDoi(publicationDoi: string): Promise<readonly DryadDataset[]> {
    return this.searchDatasets(`relatedWorks.identifier:"${publicationDoi}"`);
  }

  /**
   * Normalizes a DOI string.
   */
  private normalizeDoi(doi: string): string | null {
    let normalized = doi.trim();

    if (normalized.startsWith('https://doi.org/')) {
      normalized = normalized.slice(16);
    } else if (normalized.startsWith('http://doi.org/')) {
      normalized = normalized.slice(15);
    } else if (normalized.startsWith('doi:')) {
      normalized = normalized.slice(4);
    }

    if (!/^10\.\d{4,}\/\S+$/.test(normalized)) {
      return null;
    }

    return normalized;
  }

  /**
   * Parses API dataset to DryadDataset.
   */
  private parseDataset(data: DryadApiDataset): DryadDataset | null {
    if (!data.identifier && !data.doi) {
      return null;
    }

    // Find related publication
    const relatedPub = data.relatedWorks?.find(
      (r) => r.relationship === 'IsPrimaryPublicationOf' || r.relationship === 'IsSupplementTo'
    );

    return {
      id: data.identifier ?? data.doi ?? '',
      doi: data.doi ?? `10.5061/dryad.${data.identifier}`,
      title: data.title ?? 'Untitled Dataset',
      abstract: data.abstract,
      authors: (data.authors ?? []).map((a) => ({
        firstName: a.firstName,
        lastName: a.lastName,
        orcid: a.orcid,
        affiliation: a.affiliation,
      })),
      keywords: data.keywords,
      relatedPublication: relatedPub
        ? {
            type: relatedPub.relationship ?? '',
            identifier: relatedPub.identifier ?? '',
            identifierType: relatedPub.identifierType ?? 'DOI',
          }
        : undefined,
      license: data.license ?? 'CC0 1.0',
      totalSize: data.storageSize ?? 0,
      fileCount: 0, // API doesn't provide directly
      versionNumber: data.versionNumber ?? 1,
      publicationDate: data.publicationDate,
      lastModificationDate: data.lastModificationDate,
      curationStatus: data.curationStatus,
      sharingLink: data.sharingLink ?? `https://datadryad.org/stash/dataset/${data.identifier}`,
      source: 'dryad',
    };
  }
}

export default DryadPlugin;
