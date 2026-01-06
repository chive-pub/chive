/**
 * CrossRef metadata enrichment plugin.
 *
 * @remarks
 * Provides DOI metadata lookup and enrichment via the CrossRef API.
 * CrossRef (https://www.crossref.org) is a registration agency for DOIs
 * and provides rich bibliographic metadata.
 *
 * This plugin is used to:
 * - Enrich preprints with citation metadata
 * - Verify DOI ownership for claiming
 * - Track citations and references
 *
 * Uses CrossRef REST API (public, polite pool):
 * - Base URL: https://api.crossref.org
 * - Rate limit: ~50 requests per second with polite pool
 * - Polite pool requires User-Agent with contact email
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
 * CrossRef work metadata.
 *
 * @public
 */
export interface CrossRefWork {
  /**
   * DOI of the work.
   */
  doi: string;

  /**
   * Work title(s).
   */
  title: readonly string[];

  /**
   * Work type (journal-article, preprint, book-chapter, etc.).
   */
  type: string;

  /**
   * Authors.
   */
  authors: readonly CrossRefAuthor[];

  /**
   * Container (journal/book) title.
   */
  containerTitle?: readonly string[];

  /**
   * Publisher name.
   */
  publisher?: string;

  /**
   * Publication date parts.
   */
  published?: CrossRefDate;

  /**
   * Abstract text.
   */
  abstract?: string;

  /**
   * Subject categories.
   */
  subjects?: readonly string[];

  /**
   * Number of references cited.
   */
  referencesCount?: number;

  /**
   * Number of citations (is-referenced-by-count).
   */
  citedByCount?: number;

  /**
   * Reference list (if available).
   */
  references?: readonly CrossRefReference[];

  /**
   * License URLs.
   */
  licenses?: readonly CrossRefLicense[];

  /**
   * ORCID iDs for authors.
   */
  authorOrcids?: readonly string[];

  /**
   * URL to the work.
   */
  url?: string;

  /**
   * Source of the metadata.
   */
  source: 'crossref';
}

/**
 * CrossRef author metadata.
 *
 * @public
 */
export interface CrossRefAuthor {
  /**
   * Given (first) name.
   */
  given?: string;

  /**
   * Family (last) name.
   */
  family?: string;

  /**
   * Full name (if given/family not available).
   */
  name?: string;

  /**
   * ORCID iD.
   */
  orcid?: string;

  /**
   * Affiliation names.
   */
  affiliations?: readonly string[];

  /**
   * Author sequence (first, additional).
   */
  sequence?: 'first' | 'additional';
}

/**
 * CrossRef date structure.
 *
 * @public
 */
export interface CrossRefDate {
  /**
   * Date parts: [year, month?, day?].
   */
  dateParts: readonly [number, number?, number?][];
}

/**
 * CrossRef reference metadata.
 *
 * @public
 */
export interface CrossRefReference {
  /**
   * Reference DOI (if available).
   */
  doi?: string;

  /**
   * Unstructured citation text.
   */
  unstructured?: string;

  /**
   * First author name.
   */
  author?: string;

  /**
   * Article/book title.
   */
  articleTitle?: string;

  /**
   * Journal/container title.
   */
  journalTitle?: string;

  /**
   * Publication year.
   */
  year?: string;
}

/**
 * CrossRef license metadata.
 *
 * @public
 */
export interface CrossRefLicense {
  /**
   * License URL.
   */
  url: string;

  /**
   * Start date.
   */
  start?: CrossRefDate;

  /**
   * Content version (vor, am, tdm).
   */
  contentVersion?: string;
}

/**
 * CrossRef API response structure.
 *
 * @internal
 */
interface CrossRefResponse {
  status: string;
  'message-type': string;
  message: CrossRefMessage;
}

/**
 * CrossRef work message.
 *
 * @internal
 */
interface CrossRefMessage {
  DOI?: string;
  title?: string[];
  type?: string;
  author?: CrossRefApiAuthor[];
  'container-title'?: string[];
  publisher?: string;
  published?: {
    'date-parts': [number, number?, number?][];
  };
  abstract?: string;
  subject?: string[];
  'references-count'?: number;
  'is-referenced-by-count'?: number;
  reference?: CrossRefApiReference[];
  license?: CrossRefApiLicense[];
  URL?: string;
}

/**
 * CrossRef API author.
 *
 * @internal
 */
interface CrossRefApiAuthor {
  given?: string;
  family?: string;
  name?: string;
  ORCID?: string;
  affiliation?: { name: string }[];
  sequence?: string;
}

/**
 * CrossRef API reference.
 *
 * @internal
 */
interface CrossRefApiReference {
  DOI?: string;
  unstructured?: string;
  author?: string;
  'article-title'?: string;
  'journal-title'?: string;
  year?: string;
}

/**
 * CrossRef API license.
 *
 * @internal
 */
interface CrossRefApiLicense {
  URL: string;
  start?: {
    'date-parts': [number, number?, number?][];
  };
  'content-version'?: string;
}

/**
 * CrossRef metadata enrichment plugin.
 *
 * @remarks
 * Provides DOI metadata lookup for preprint enrichment and claiming
 * verification. Uses the polite pool for better rate limits.
 *
 * @example
 * ```typescript
 * const plugin = new CrossRefPlugin();
 * await manager.loadBuiltinPlugin(plugin);
 *
 * // Look up DOI metadata
 * const work = await plugin.getWork('10.1234/example');
 * if (work) {
 *   console.log(`Title: ${work.title[0]}`);
 *   console.log(`Cited by: ${work.citedByCount}`);
 * }
 * ```
 *
 * @public
 */
export class CrossRefPlugin extends BasePlugin {
  /**
   * Plugin ID.
   */
  readonly id = 'pub.chive.plugin.crossref';

  /**
   * Plugin manifest.
   */
  readonly manifest: IPluginManifest = {
    id: 'pub.chive.plugin.crossref',
    name: 'CrossRef Integration',
    version: '0.1.0',
    description: 'Provides DOI metadata lookup and citation tracking via CrossRef',
    author: 'Aaron Steven White',
    license: 'MIT',
    permissions: {
      network: {
        allowedDomains: ['api.crossref.org'],
      },
      storage: {
        maxSize: 100 * 1024 * 1024, // 100MB for caching
      },
    },
    entrypoint: 'crossref.js',
  };

  /**
   * CrossRef API base URL.
   */
  private readonly API_BASE_URL = 'https://api.crossref.org';

  /**
   * User-Agent for polite pool access.
   */
  private readonly USER_AGENT = 'Chive-AppView/1.0 (https://chive.pub; contact@chive.pub)';

  /**
   * Cache TTL in seconds (30 days for DOI metadata).
   */
  private readonly CACHE_TTL = 86400 * 30;

  /**
   * Minimum delay between requests (ms).
   */
  private rateLimitDelayMs = 100;

  /**
   * Last request timestamp.
   */
  private lastRequestTime = 0;

  /**
   * Initializes the plugin.
   */
  protected onInitialize(): Promise<void> {
    this.logger.info('CrossRef plugin initialized', {
      note: 'Using polite pool with contact email',
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
   * Gets work metadata by DOI.
   *
   * @param doi - DOI to look up (with or without https://doi.org/ prefix)
   * @returns Work metadata or null if not found
   *
   * @public
   */
  async getWork(doi: string): Promise<CrossRefWork | null> {
    const normalizedDoi = this.normalizeDoi(doi);
    if (!normalizedDoi) {
      return null;
    }

    // Check cache
    const cacheKey = `crossref:work:${normalizedDoi}`;
    const cached = await this.cache.get<CrossRefWork>(cacheKey);
    if (cached) {
      return cached;
    }

    await this.rateLimit();

    try {
      const response = await fetch(
        `${this.API_BASE_URL}/works/${encodeURIComponent(normalizedDoi)}`,
        {
          headers: {
            'User-Agent': this.USER_AGENT,
            Accept: 'application/json',
          },
        }
      );

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        this.logger.warn('CrossRef API error', {
          doi: normalizedDoi,
          status: response.status,
        });
        return null;
      }

      const data = (await response.json()) as CrossRefResponse;
      const work = this.parseWork(data.message);

      if (work) {
        await this.cache.set(cacheKey, work, this.CACHE_TTL);
      }

      return work;
    } catch (err) {
      this.logger.warn('Error fetching CrossRef work', {
        doi: normalizedDoi,
        error: (err as Error).message,
      });
      return null;
    }
  }

  /**
   * Searches for works by query.
   *
   * @param query - Search query (title, author, etc.)
   * @param options - Search options
   * @returns Matching works
   *
   * @public
   */
  async searchWorks(
    query: string,
    options?: { limit?: number; filter?: string }
  ): Promise<readonly CrossRefWork[]> {
    await this.rateLimit();

    const limit = Math.min(options?.limit ?? 20, 100);
    const params = new URLSearchParams({
      query,
      rows: limit.toString(),
    });

    if (options?.filter) {
      params.set('filter', options.filter);
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/works?${params.toString()}`, {
        headers: {
          'User-Agent': this.USER_AGENT,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        this.logger.warn('CrossRef search error', {
          query,
          status: response.status,
        });
        return [];
      }

      const data = (await response.json()) as {
        message: { items?: CrossRefMessage[] };
      };

      const works: CrossRefWork[] = [];
      for (const item of data.message.items ?? []) {
        const work = this.parseWork(item);
        if (work) {
          works.push(work);
        }
      }

      return works;
    } catch (err) {
      this.logger.warn('Error searching CrossRef', {
        query,
        error: (err as Error).message,
      });
      return [];
    }
  }

  /**
   * Gets references for a DOI.
   *
   * @param doi - DOI to get references for
   * @returns Array of references or empty array
   *
   * @public
   */
  async getReferences(doi: string): Promise<readonly CrossRefReference[]> {
    const work = await this.getWork(doi);
    return work?.references ?? [];
  }

  /**
   * Gets citation count for a DOI.
   *
   * @param doi - DOI to get citation count for
   * @returns Citation count or 0
   *
   * @public
   */
  async getCitationCount(doi: string): Promise<number> {
    const work = await this.getWork(doi);
    return work?.citedByCount ?? 0;
  }

  /**
   * Normalizes a DOI string.
   *
   * @param doi - DOI string (various formats)
   * @returns Normalized DOI or null if invalid
   */
  private normalizeDoi(doi: string): string | null {
    // Remove common prefixes
    let normalized = doi.trim();

    if (normalized.startsWith('https://doi.org/')) {
      normalized = normalized.slice(16);
    } else if (normalized.startsWith('http://doi.org/')) {
      normalized = normalized.slice(15);
    } else if (normalized.startsWith('doi:')) {
      normalized = normalized.slice(4);
    }

    // Validate DOI format (10.prefix/suffix)
    if (!/^10\.\d{4,}\/\S+$/.test(normalized)) {
      return null;
    }

    return normalized;
  }

  /**
   * Parses CrossRef API response to CrossRefWork.
   *
   * @param message - CrossRef message object
   * @returns Parsed work or null
   */
  private parseWork(message: CrossRefMessage): CrossRefWork | null {
    if (!message.DOI || !message.title?.[0]) {
      return null;
    }

    const authors: CrossRefAuthor[] = (message.author ?? []).map((a) => ({
      given: a.given,
      family: a.family,
      name: a.name,
      orcid: a.ORCID?.replace('http://orcid.org/', '').replace('https://orcid.org/', ''),
      affiliations: a.affiliation?.map((aff) => aff.name),
      sequence: a.sequence === 'first' ? 'first' : 'additional',
    }));

    const references: CrossRefReference[] = (message.reference ?? []).map((r) => ({
      doi: r.DOI,
      unstructured: r.unstructured,
      author: r.author,
      articleTitle: r['article-title'],
      journalTitle: r['journal-title'],
      year: r.year,
    }));

    const licenses: CrossRefLicense[] = (message.license ?? []).map((l) => ({
      url: l.URL,
      start: l.start ? { dateParts: l.start['date-parts'] } : undefined,
      contentVersion: l['content-version'],
    }));

    // Extract ORCID iDs
    const authorOrcids = authors
      .filter((a): a is CrossRefAuthor & { orcid: string } => a.orcid !== undefined)
      .map((a) => a.orcid);

    return {
      doi: message.DOI,
      title: message.title,
      type: message.type ?? 'unknown',
      authors,
      containerTitle: message['container-title'],
      publisher: message.publisher,
      published: message.published ? { dateParts: message.published['date-parts'] } : undefined,
      abstract: message.abstract,
      subjects: message.subject,
      referencesCount: message['references-count'],
      citedByCount: message['is-referenced-by-count'],
      references: references.length > 0 ? references : undefined,
      licenses: licenses.length > 0 ? licenses : undefined,
      authorOrcids: authorOrcids.length > 0 ? authorOrcids : undefined,
      url: message.URL,
      source: 'crossref',
    };
  }
}

export default CrossRefPlugin;
