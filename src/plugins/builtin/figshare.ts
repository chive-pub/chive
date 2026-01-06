/**
 * Figshare integration plugin for research data linking.
 *
 * @remarks
 * Provides integration with Figshare (https://figshare.com) for linking
 * preprints to their associated research outputs (datasets, figures,
 * presentations, posters, code, etc.).
 *
 * Figshare is a repository where users can make their research outputs
 * available in a citable, shareable, and discoverable manner.
 *
 * Uses Figshare REST API v2:
 * - Base URL: https://api.figshare.com/v2
 * - Rate limit: ~100 requests/minute
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
 * Figshare article (item) metadata.
 *
 * @public
 */
export interface FigshareArticle {
  /**
   * Article ID.
   */
  id: number;

  /**
   * DOI.
   */
  doi: string;

  /**
   * Title.
   */
  title: string;

  /**
   * Description.
   */
  description?: string;

  /**
   * Article type.
   */
  type: string;

  /**
   * Authors.
   */
  authors: readonly {
    id: number;
    fullName: string;
    orcid?: string;
  }[];

  /**
   * Categories.
   */
  categories: readonly {
    id: number;
    title: string;
  }[];

  /**
   * Tags.
   */
  tags: readonly string[];

  /**
   * License.
   */
  license: {
    id: number;
    name: string;
    url: string;
  };

  /**
   * Files.
   */
  files?: readonly {
    id: number;
    name: string;
    size: number;
    downloadUrl: string;
    mimeType?: string;
  }[];

  /**
   * Funding information.
   */
  funding?: readonly string[];

  /**
   * References (related identifiers).
   */
  references?: readonly string[];

  /**
   * Public URL.
   */
  url: string;

  /**
   * Publication date.
   */
  publishedDate: string;

  /**
   * Modification date.
   */
  modifiedDate: string;

  /**
   * View count.
   */
  viewCount: number;

  /**
   * Download count.
   */
  downloadCount: number;

  /**
   * Version number.
   */
  version: number;

  /**
   * Source of the metadata.
   */
  source: 'figshare';
}

/**
 * Figshare API article response.
 *
 * @internal
 */
interface FigshareApiArticle {
  id?: number;
  doi?: string;
  title?: string;
  description?: string;
  defined_type_name?: string;
  authors?: {
    id?: number;
    full_name?: string;
    orcid_id?: string;
  }[];
  categories?: {
    id?: number;
    title?: string;
  }[];
  tags?: string[];
  license?: {
    value?: number;
    name?: string;
    url?: string;
  };
  files?: {
    id?: number;
    name?: string;
    size?: number;
    download_url?: string;
    mimetype?: string;
  }[];
  funding?: string[];
  references?: string[];
  url?: string;
  published_date?: string;
  modified_date?: string;
  views?: number;
  downloads?: number;
  version?: number;
}

/**
 * Figshare search result.
 *
 * @internal
 */
type FigshareSearchResult = FigshareApiArticle[];

/**
 * Figshare integration plugin.
 *
 * @remarks
 * Provides research output lookup and linking via Figshare.
 * Used to link preprints to their associated datasets, figures, and code.
 *
 * @example
 * ```typescript
 * const plugin = new FigsharePlugin();
 * await manager.loadBuiltinPlugin(plugin);
 *
 * // Get article by ID
 * const article = await plugin.getArticle(12345678);
 *
 * // Search for datasets
 * const results = await plugin.searchArticles('climate change', {
 *   type: 'dataset'
 * });
 * ```
 *
 * @public
 */
export class FigsharePlugin extends BasePlugin {
  /**
   * Plugin ID.
   */
  readonly id = 'pub.chive.plugin.figshare';

  /**
   * Plugin manifest.
   */
  readonly manifest: IPluginManifest = {
    id: 'pub.chive.plugin.figshare',
    name: 'Figshare Integration',
    version: '0.1.0',
    description: 'Provides research output linking via Figshare',
    author: 'Aaron Steven White',
    license: 'MIT',
    permissions: {
      network: {
        allowedDomains: ['api.figshare.com', 'figshare.com'],
      },
      storage: {
        maxSize: 30 * 1024 * 1024, // 30MB
      },
    },
    entrypoint: 'figshare.js',
  };

  /**
   * Figshare API base URL.
   */
  private readonly API_BASE_URL = 'https://api.figshare.com/v2';

  /**
   * Cache TTL in seconds (1 day).
   */
  private readonly CACHE_TTL = 86400;

  /**
   * Minimum delay between requests (ms).
   */
  private rateLimitDelayMs = 600;

  /**
   * Last request timestamp.
   */
  private lastRequestTime = 0;

  /**
   * Initializes the plugin.
   */
  protected onInitialize(): Promise<void> {
    this.logger.info('Figshare plugin initialized', {
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
   * Gets article by ID.
   *
   * @param articleId - Figshare article ID
   * @returns Article metadata or null
   *
   * @public
   */
  async getArticle(articleId: number): Promise<FigshareArticle | null> {
    const cacheKey = `figshare:article:${articleId}`;
    const cached = await this.cache.get<FigshareArticle>(cacheKey);
    if (cached) {
      return cached;
    }

    await this.rateLimit();

    try {
      const response = await fetch(`${this.API_BASE_URL}/articles/${articleId}`, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        this.logger.warn('Figshare API error', {
          articleId,
          status: response.status,
        });
        return null;
      }

      const data = (await response.json()) as FigshareApiArticle;
      const article = this.parseArticle(data);

      if (article) {
        await this.cache.set(cacheKey, article, this.CACHE_TTL);
      }

      return article;
    } catch (err) {
      this.logger.warn('Error fetching Figshare article', {
        articleId,
        error: (err as Error).message,
      });
      return null;
    }
  }

  /**
   * Gets article by DOI.
   *
   * @param doi - Figshare DOI
   * @returns Article metadata or null
   *
   * @public
   */
  async getArticleByDoi(doi: string): Promise<FigshareArticle | null> {
    const normalizedDoi = this.normalizeDoi(doi);
    if (!normalizedDoi) {
      return null;
    }

    // Search by DOI
    const results = await this.searchArticles(`doi:"${normalizedDoi}"`, { limit: 1 });
    return results[0] ?? null;
  }

  /**
   * Searches for articles.
   *
   * @param query - Search query
   * @param options - Search options
   * @returns Matching articles
   *
   * @public
   */
  async searchArticles(
    query: string,
    options?: { limit?: number; type?: string; order?: string }
  ): Promise<readonly FigshareArticle[]> {
    await this.rateLimit();

    const limit = Math.min(options?.limit ?? 10, 100);
    const searchBody: Record<string, unknown> = {
      search_for: query,
      page_size: limit,
    };

    if (options?.type) {
      searchBody.item_type = this.getItemTypeId(options.type);
    }
    if (options?.order) {
      searchBody.order = options.order;
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/articles/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(searchBody),
      });

      if (!response.ok) {
        this.logger.warn('Figshare search error', {
          query,
          status: response.status,
        });
        return [];
      }

      const data = (await response.json()) as FigshareSearchResult;
      const articles: FigshareArticle[] = [];

      for (const item of data) {
        const article = this.parseArticle(item);
        if (article) {
          articles.push(article);
        }
      }

      return articles;
    } catch (err) {
      this.logger.warn('Error searching Figshare', {
        query,
        error: (err as Error).message,
      });
      return [];
    }
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
    options?: { limit?: number }
  ): Promise<readonly FigshareArticle[]> {
    return this.searchArticles(query, { ...options, type: 'dataset' });
  }

  /**
   * Searches for figures.
   *
   * @param query - Search query
   * @param options - Search options
   * @returns Matching figures
   *
   * @public
   */
  async searchFigures(
    query: string,
    options?: { limit?: number }
  ): Promise<readonly FigshareArticle[]> {
    return this.searchArticles(query, { ...options, type: 'figure' });
  }

  /**
   * Searches for code (software).
   *
   * @param query - Search query
   * @param options - Search options
   * @returns Matching code items
   *
   * @public
   */
  async searchCode(
    query: string,
    options?: { limit?: number }
  ): Promise<readonly FigshareArticle[]> {
    return this.searchArticles(query, { ...options, type: 'software' });
  }

  /**
   * Gets the item type ID for a type name.
   */
  private getItemTypeId(typeName: string): number {
    const typeMap: Record<string, number> = {
      figure: 1,
      media: 2,
      dataset: 3,
      fileset: 4,
      poster: 5,
      paper: 6,
      presentation: 7,
      thesis: 8,
      software: 9,
      code: 9,
      online_resource: 10,
      preprint: 11,
      book: 12,
      journal_contribution: 13,
      conference_contribution: 14,
    };
    return typeMap[typeName.toLowerCase()] ?? 3; // Default to dataset
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
   * Parses API article to FigshareArticle.
   */
  private parseArticle(data: FigshareApiArticle): FigshareArticle | null {
    if (!data.id || !data.title) {
      return null;
    }

    return {
      id: data.id,
      doi: data.doi ?? '',
      title: data.title,
      description: data.description,
      type: data.defined_type_name ?? 'dataset',
      authors: (data.authors ?? []).map((a) => ({
        id: a.id ?? 0,
        fullName: a.full_name ?? 'Unknown',
        orcid: a.orcid_id,
      })),
      categories: (data.categories ?? []).map((c) => ({
        id: c.id ?? 0,
        title: c.title ?? 'Unknown',
      })),
      tags: data.tags ?? [],
      license: {
        id: data.license?.value ?? 0,
        name: data.license?.name ?? 'Unknown',
        url: data.license?.url ?? '',
      },
      files: data.files?.map((f) => ({
        id: f.id ?? 0,
        name: f.name ?? 'Unknown',
        size: f.size ?? 0,
        downloadUrl: f.download_url ?? '',
        mimeType: f.mimetype,
      })),
      funding: data.funding,
      references: data.references,
      url: data.url ?? `https://figshare.com/articles/${data.id}`,
      publishedDate: data.published_date ?? '',
      modifiedDate: data.modified_date ?? '',
      viewCount: data.views ?? 0,
      downloadCount: data.downloads ?? 0,
      version: data.version ?? 1,
      source: 'figshare',
    };
  }
}

export default FigsharePlugin;
