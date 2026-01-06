/**
 * OpenAlex metadata enrichment plugin.
 *
 * @remarks
 * Provides scholarly metadata lookup via the OpenAlex API.
 * OpenAlex (https://openalex.org) is an open scholarly database with
 * 250M+ works, including papers, authors, institutions, and concepts.
 *
 * This plugin is used to:
 * - Enrich preprints with citation and reference metadata
 * - Verify author identity via ORCID-linked profiles
 * - Provide institution and concept data
 *
 * Uses OpenAlex REST API (free, open access):
 * - Base URL: https://api.openalex.org
 * - Rate limit: 100,000 requests/day (with email), 10 requests/second
 * - Polite pool requires email parameter
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
 * OpenAlex work metadata.
 *
 * @public
 */
export interface OpenAlexWork {
  /**
   * OpenAlex ID (e.g., W123456789).
   */
  id: string;

  /**
   * DOI (if available).
   */
  doi?: string;

  /**
   * Work title.
   */
  title: string;

  /**
   * Work type.
   */
  type: string;

  /**
   * Publication date (ISO format).
   */
  publicationDate?: string;

  /**
   * Publication year.
   */
  publicationYear?: number;

  /**
   * Authors with their affiliations.
   */
  authorships: readonly OpenAlexAuthorship[];

  /**
   * Primary location (journal, repository, etc.).
   */
  primaryLocation?: OpenAlexLocation;

  /**
   * Citation count.
   */
  citedByCount: number;

  /**
   * Number of references.
   */
  referencedWorksCount: number;

  /**
   * Related concepts/topics.
   */
  concepts: readonly OpenAlexConcept[];

  /**
   * Open access status.
   */
  openAccess?: {
    isOa: boolean;
    oaUrl?: string;
    oaStatus?: string;
  };

  /**
   * Abstract (inverted index format converted to text).
   */
  abstract?: string;

  /**
   * Source of the metadata.
   */
  source: 'openalex';
}

/**
 * OpenAlex authorship information.
 *
 * @public
 */
export interface OpenAlexAuthorship {
  /**
   * Author position.
   */
  authorPosition: 'first' | 'middle' | 'last';

  /**
   * Author information.
   */
  author: {
    id: string;
    displayName: string;
    orcid?: string;
  };

  /**
   * Affiliated institutions.
   */
  institutions: readonly {
    id: string;
    displayName: string;
    ror?: string;
    countryCode?: string;
  }[];

  /**
   * Raw affiliation string.
   */
  rawAffiliationString?: string;
}

/**
 * OpenAlex location (where work is published).
 *
 * @public
 */
export interface OpenAlexLocation {
  /**
   * Source information.
   */
  source?: {
    id: string;
    displayName: string;
    issn?: string[];
    type?: string;
  };

  /**
   * PDF URL.
   */
  pdfUrl?: string;

  /**
   * Landing page URL.
   */
  landingPageUrl?: string;

  /**
   * License URL.
   */
  license?: string;

  /**
   * Version type.
   */
  version?: string;
}

/**
 * OpenAlex concept/topic.
 *
 * @public
 */
export interface OpenAlexConcept {
  /**
   * Concept ID.
   */
  id: string;

  /**
   * Display name.
   */
  displayName: string;

  /**
   * Wikidata ID.
   */
  wikidata?: string;

  /**
   * Relevance score (0-1).
   */
  score: number;

  /**
   * Hierarchical level (0 = root).
   */
  level: number;
}

/**
 * OpenAlex author profile.
 *
 * @public
 */
export interface OpenAlexAuthor {
  /**
   * OpenAlex author ID.
   */
  id: string;

  /**
   * Display name.
   */
  displayName: string;

  /**
   * ORCID iD.
   */
  orcid?: string;

  /**
   * Works count.
   */
  worksCount: number;

  /**
   * Citation count.
   */
  citedByCount: number;

  /**
   * Most frequent affiliations.
   */
  affiliations: readonly {
    institution: {
      id: string;
      displayName: string;
      ror?: string;
    };
    years: readonly number[];
  }[];

  /**
   * Most frequently associated concepts.
   */
  topConcepts: readonly OpenAlexConcept[];

  /**
   * Source of the metadata.
   */
  source: 'openalex';
}

/**
 * OpenAlex API work response.
 *
 * @internal
 */
interface OpenAlexApiWork {
  id: string;
  doi?: string;
  title?: string;
  type?: string;
  publication_date?: string;
  publication_year?: number;
  authorships?: OpenAlexApiAuthorship[];
  primary_location?: OpenAlexApiLocation;
  cited_by_count?: number;
  referenced_works_count?: number;
  concepts?: OpenAlexApiConcept[];
  open_access?: {
    is_oa?: boolean;
    oa_url?: string;
    oa_status?: string;
  };
  abstract_inverted_index?: Record<string, number[]>;
}

/**
 * OpenAlex API authorship.
 *
 * @internal
 */
interface OpenAlexApiAuthorship {
  author_position?: string;
  author?: {
    id?: string;
    display_name?: string;
    orcid?: string;
  };
  institutions?: {
    id?: string;
    display_name?: string;
    ror?: string;
    country_code?: string;
  }[];
  raw_affiliation_string?: string;
}

/**
 * OpenAlex API location.
 *
 * @internal
 */
interface OpenAlexApiLocation {
  source?: {
    id?: string;
    display_name?: string;
    issn?: string[];
    type?: string;
  };
  pdf_url?: string;
  landing_page_url?: string;
  license?: string;
  version?: string;
}

/**
 * OpenAlex API concept.
 *
 * @internal
 */
interface OpenAlexApiConcept {
  id?: string;
  display_name?: string;
  wikidata?: string;
  score?: number;
  level?: number;
}

/**
 * OpenAlex topic with hierarchical structure.
 *
 * @public
 */
export interface OpenAlexTopic {
  /**
   * Topic ID.
   */
  id: string;

  /**
   * Display name.
   */
  displayName: string;

  /**
   * Relevance score (0-1).
   */
  score: number;

  /**
   * Subfield name (third level).
   */
  subfield?: string;

  /**
   * Field name (second level).
   */
  field?: string;

  /**
   * Domain name (top level).
   */
  domain?: string;
}

/**
 * OpenAlex keyword with score.
 *
 * @public
 */
export interface OpenAlexKeyword {
  /**
   * Keyword ID.
   */
  id: string;

  /**
   * Display name.
   */
  displayName: string;

  /**
   * Relevance score.
   */
  score: number;
}

/**
 * Result of text classification.
 *
 * @public
 */
export interface TextClassificationResult {
  /**
   * Primary topic (highest scoring).
   */
  primaryTopic?: OpenAlexTopic;

  /**
   * All matched topics.
   */
  topics: readonly OpenAlexTopic[];

  /**
   * Extracted keywords.
   */
  keywords: readonly OpenAlexKeyword[];

  /**
   * Matched concepts.
   */
  concepts: readonly OpenAlexConcept[];
}

/**
 * OpenAlex /text API response.
 *
 * @internal
 */
interface OpenAlexTextApiResponse {
  meta?: {
    keywords_count?: number;
    topics_count?: number;
    concepts_count?: number;
  };
  primary_topic?: OpenAlexApiTopic;
  topics?: OpenAlexApiTopic[];
  keywords?: {
    id?: string;
    display_name?: string;
    score?: number;
  }[];
  concepts?: OpenAlexApiConcept[];
}

/**
 * OpenAlex API topic response.
 *
 * @internal
 */
interface OpenAlexApiTopic {
  id?: string;
  display_name?: string;
  score?: number;
  subfield?: { display_name?: string };
  field?: { display_name?: string };
  domain?: { display_name?: string };
}

/**
 * OpenAlex API author response.
 *
 * @internal
 */
interface OpenAlexApiAuthor {
  id: string;
  display_name?: string;
  orcid?: string;
  works_count?: number;
  cited_by_count?: number;
  affiliations?: {
    institution?: {
      id?: string;
      display_name?: string;
      ror?: string;
    };
    years?: number[];
  }[];
  x_concepts?: OpenAlexApiConcept[];
}

/**
 * OpenAlex metadata enrichment plugin.
 *
 * @remarks
 * Provides scholarly metadata lookup from OpenAlex's 250M+ works database.
 * Used for preprint enrichment and author verification.
 *
 * @example
 * ```typescript
 * const plugin = new OpenAlexPlugin();
 * await manager.loadBuiltinPlugin(plugin);
 *
 * // Look up work by DOI
 * const work = await plugin.getWorkByDoi('10.1234/example');
 *
 * // Get author by ORCID (for claiming verification)
 * const author = await plugin.getAuthorByOrcid('0000-0001-2345-6789');
 * ```
 *
 * @public
 */
export class OpenAlexPlugin extends BasePlugin {
  /**
   * Plugin ID.
   */
  readonly id = 'pub.chive.plugin.openalex';

  /**
   * Plugin manifest.
   */
  readonly manifest: IPluginManifest = {
    id: 'pub.chive.plugin.openalex',
    name: 'OpenAlex Integration',
    version: '0.1.0',
    description: 'Provides scholarly metadata from OpenAlex (250M+ works)',
    author: 'Aaron Steven White',
    license: 'MIT',
    permissions: {
      network: {
        allowedDomains: ['api.openalex.org'],
      },
      storage: {
        maxSize: 200 * 1024 * 1024, // 200MB for caching
      },
    },
    entrypoint: 'openalex.js',
  };

  /**
   * OpenAlex API base URL.
   */
  private readonly API_BASE_URL = 'https://api.openalex.org';

  /**
   * Email for polite pool access.
   */
  private readonly CONTACT_EMAIL = 'contact@chive.pub';

  /**
   * Cache TTL in seconds (7 days).
   */
  private readonly CACHE_TTL = 86400 * 7;

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
    this.logger.info('OpenAlex plugin initialized', {
      note: 'Using polite pool with email',
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
   * Gets work by OpenAlex ID.
   *
   * @param id - OpenAlex work ID (W123456789)
   * @returns Work metadata or null
   *
   * @public
   */
  async getWork(id: string): Promise<OpenAlexWork | null> {
    const cacheKey = `openalex:work:${id}`;
    const cached = await this.cache.get<OpenAlexWork>(cacheKey);
    if (cached) {
      return cached;
    }

    await this.rateLimit();

    try {
      const response = await fetch(
        `${this.API_BASE_URL}/works/${id}?mailto=${this.CONTACT_EMAIL}`,
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
        this.logger.warn('OpenAlex API error', {
          id,
          status: response.status,
        });
        return null;
      }

      const data = (await response.json()) as OpenAlexApiWork;
      const work = this.parseWork(data);

      if (work) {
        await this.cache.set(cacheKey, work, this.CACHE_TTL);
      }

      return work;
    } catch (err) {
      this.logger.warn('Error fetching OpenAlex work', {
        id,
        error: (err as Error).message,
      });
      return null;
    }
  }

  /**
   * Gets work by DOI.
   *
   * @param doi - DOI string
   * @returns Work metadata or null
   *
   * @public
   */
  async getWorkByDoi(doi: string): Promise<OpenAlexWork | null> {
    const normalizedDoi = this.normalizeDoi(doi);
    if (!normalizedDoi) {
      return null;
    }

    const cacheKey = `openalex:work:doi:${normalizedDoi}`;
    const cached = await this.cache.get<OpenAlexWork>(cacheKey);
    if (cached) {
      return cached;
    }

    await this.rateLimit();

    try {
      const response = await fetch(
        `${this.API_BASE_URL}/works/https://doi.org/${normalizedDoi}?mailto=${this.CONTACT_EMAIL}`,
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
        this.logger.warn('OpenAlex API error', {
          doi: normalizedDoi,
          status: response.status,
        });
        return null;
      }

      const data = (await response.json()) as OpenAlexApiWork;
      const work = this.parseWork(data);

      if (work) {
        await this.cache.set(cacheKey, work, this.CACHE_TTL);
      }

      return work;
    } catch (err) {
      this.logger.warn('Error fetching OpenAlex work by DOI', {
        doi: normalizedDoi,
        error: (err as Error).message,
      });
      return null;
    }
  }

  /**
   * Gets author by ORCID.
   *
   * @remarks
   * Used for claiming verification - OpenAlex author profiles
   * linked to ORCID provide high-confidence identity verification.
   *
   * @param orcid - ORCID iD
   * @returns Author profile or null
   *
   * @public
   */
  async getAuthorByOrcid(orcid: string): Promise<OpenAlexAuthor | null> {
    const normalizedOrcid = this.normalizeOrcid(orcid);
    if (!normalizedOrcid) {
      return null;
    }

    const cacheKey = `openalex:author:orcid:${normalizedOrcid}`;
    const cached = await this.cache.get<OpenAlexAuthor>(cacheKey);
    if (cached) {
      return cached;
    }

    await this.rateLimit();

    try {
      const response = await fetch(
        `${this.API_BASE_URL}/authors/https://orcid.org/${normalizedOrcid}?mailto=${this.CONTACT_EMAIL}`,
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
        this.logger.warn('OpenAlex API error', {
          orcid: normalizedOrcid,
          status: response.status,
        });
        return null;
      }

      const data = (await response.json()) as OpenAlexApiAuthor;
      const author = this.parseAuthor(data);

      if (author) {
        await this.cache.set(cacheKey, author, this.CACHE_TTL);
      }

      return author;
    } catch (err) {
      this.logger.warn('Error fetching OpenAlex author by ORCID', {
        orcid: normalizedOrcid,
        error: (err as Error).message,
      });
      return null;
    }
  }

  /**
   * Gets author by OpenAlex ID.
   *
   * @param id - OpenAlex author ID (A123456789)
   * @returns Author profile or null
   *
   * @public
   */
  async getAuthor(id: string): Promise<OpenAlexAuthor | null> {
    const cacheKey = `openalex:author:${id}`;
    const cached = await this.cache.get<OpenAlexAuthor>(cacheKey);
    if (cached) {
      return cached;
    }

    await this.rateLimit();

    try {
      const response = await fetch(
        `${this.API_BASE_URL}/authors/${id}?mailto=${this.CONTACT_EMAIL}`,
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
        this.logger.warn('OpenAlex API error', {
          id,
          status: response.status,
        });
        return null;
      }

      const data = (await response.json()) as OpenAlexApiAuthor;
      const author = this.parseAuthor(data);

      if (author) {
        await this.cache.set(cacheKey, author, this.CACHE_TTL);
      }

      return author;
    } catch (err) {
      this.logger.warn('Error fetching OpenAlex author', {
        id,
        error: (err as Error).message,
      });
      return null;
    }
  }

  /**
   * Autocompletes author names (fast endpoint).
   *
   * @remarks
   * Uses OpenAlex's dedicated autocomplete endpoint which is
   * optimized for low latency (~200ms).
   *
   * @param query - Name query
   * @param options - Autocomplete options
   * @returns Matching authors with basic info
   *
   * @public
   */
  async autocompleteAuthors(
    query: string,
    options?: { limit?: number }
  ): Promise<
    readonly {
      id: string;
      displayName: string;
      hint: string | null;
      worksCount: number;
      citedByCount: number;
      orcid: string | null;
    }[]
  > {
    if (query.length < 2) {
      return [];
    }

    await this.rateLimit();

    const limit = Math.min(options?.limit ?? 8, 10);

    try {
      const response = await fetch(
        `${this.API_BASE_URL}/autocomplete/authors?q=${encodeURIComponent(query)}&mailto=${this.CONTACT_EMAIL}`,
        {
          headers: {
            Accept: 'application/json',
          },
        }
      );

      if (!response.ok) {
        this.logger.warn('OpenAlex autocomplete error', {
          query,
          status: response.status,
        });
        return [];
      }

      const data = (await response.json()) as {
        results: {
          id?: string;
          display_name?: string;
          hint?: string;
          works_count?: number;
          cited_by_count?: number;
          external_id?: string;
        }[];
      };

      return data.results.slice(0, limit).map((r) => ({
        id: r.id ?? '',
        displayName: r.display_name ?? 'Unknown',
        hint: r.hint ?? null,
        worksCount: r.works_count ?? 0,
        citedByCount: r.cited_by_count ?? 0,
        orcid: r.external_id?.replace('https://orcid.org/', '') ?? null,
      }));
    } catch (err) {
      this.logger.warn('Error autocompleting OpenAlex authors', {
        query,
        error: (err as Error).message,
      });
      return [];
    }
  }

  /**
   * Searches for works.
   *
   * @param query - Search query
   * @param options - Search options
   * @returns Matching works
   *
   * @public
   */
  async searchWorks(
    query: string,
    options?: { limit?: number; filter?: string }
  ): Promise<readonly OpenAlexWork[]> {
    await this.rateLimit();

    const limit = Math.min(options?.limit ?? 20, 200);
    const params = new URLSearchParams({
      search: query,
      per_page: limit.toString(),
      mailto: this.CONTACT_EMAIL,
    });

    if (options?.filter) {
      params.set('filter', options.filter);
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/works?${params.toString()}`, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        this.logger.warn('OpenAlex search error', {
          query,
          status: response.status,
        });
        return [];
      }

      const data = (await response.json()) as { results: OpenAlexApiWork[] };
      const works: OpenAlexWork[] = [];

      for (const item of data.results) {
        const work = this.parseWork(item);
        if (work) {
          works.push(work);
        }
      }

      return works;
    } catch (err) {
      this.logger.warn('Error searching OpenAlex', {
        query,
        error: (err as Error).message,
      });
      return [];
    }
  }

  // =============================================================================
  // TEXT CLASSIFICATION API
  // =============================================================================

  /**
   * Rate limiter for text classification endpoint.
   *
   * @remarks
   * The /text endpoint has stricter rate limits: 1 req/sec, 1000 req/day.
   */
  private textApiLastRequestTime = 0;
  private readonly textApiDelayMs = 1000;

  /**
   * Enforces rate limiting for text classification API.
   */
  private async rateLimitTextApi(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.textApiLastRequestTime;

    if (elapsed < this.textApiDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, this.textApiDelayMs - elapsed));
    }

    this.textApiLastRequestTime = Date.now();
  }

  /**
   * Classifies text into topics, keywords, and concepts.
   *
   * @remarks
   * Uses the OpenAlex `/text` endpoint to classify arbitrary text (title + abstract)
   * into OpenAlex topics, keywords, and concepts. This is useful for preprints
   * that don't yet have a DOI in OpenAlex's database.
   *
   * **Rate Limits:**
   * - 1 request per second
   * - 1,000 requests per day
   * - Text must be 20-2000 characters
   *
   * @param title - Title text (required)
   * @param abstract - Abstract text (optional, improves classification)
   * @returns Classification results with topics, keywords, and concepts
   *
   * @example
   * ```typescript
   * const classification = await plugin.classifyText(
   *   'Attention Is All You Need',
   *   'The dominant sequence transduction models are based on complex...'
   * );
   *
   * console.log('Primary topic:', classification.primaryTopic?.displayName);
   * console.log('Keywords:', classification.keywords.map(k => k.displayName).join(', '));
   * ```
   *
   * @see {@link https://docs.openalex.org/api-entities/aboutness-endpoint-text | OpenAlex /text Endpoint}
   *
   * @public
   */
  async classifyText(title: string, abstract?: string): Promise<TextClassificationResult> {
    const text = abstract ? `${title} ${abstract}` : title;

    // Validate text length
    if (text.length < 20) {
      this.logger.debug('Text too short for classification', { length: text.length });
      return { topics: [], keywords: [], concepts: [] };
    }

    // Truncate if too long
    const truncatedTitle = title.slice(0, 500);
    const truncatedAbstract = abstract?.slice(0, 1500);

    await this.rateLimitTextApi();

    try {
      const params = new URLSearchParams({
        title: truncatedTitle,
        mailto: this.CONTACT_EMAIL,
      });

      if (truncatedAbstract) {
        params.set('abstract', truncatedAbstract);
      }

      const response = await fetch(`${this.API_BASE_URL}/text?${params.toString()}`, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        this.logger.warn('OpenAlex text classification error', {
          status: response.status,
          titleLength: truncatedTitle.length,
        });
        return { topics: [], keywords: [], concepts: [] };
      }

      const data = (await response.json()) as OpenAlexTextApiResponse;

      return {
        primaryTopic: data.primary_topic ? this.parseOpenAlexTopic(data.primary_topic) : undefined,
        topics: (data.topics ?? []).map((t) => this.parseOpenAlexTopic(t)),
        keywords: (data.keywords ?? []).map((k) => ({
          id: k.id ?? '',
          displayName: k.display_name ?? '',
          score: k.score ?? 0,
        })),
        concepts: (data.concepts ?? []).map((c) => ({
          id: c.id ?? '',
          displayName: c.display_name ?? 'Unknown',
          wikidata: c.wikidata,
          score: c.score ?? 0,
          level: c.level ?? 0,
        })),
      };
    } catch (err) {
      this.logger.warn('Error classifying text with OpenAlex', {
        error: (err as Error).message,
      });
      return { topics: [], keywords: [], concepts: [] };
    }
  }

  /**
   * Parses an OpenAlex topic from API response.
   */
  private parseOpenAlexTopic(topic: OpenAlexApiTopic): OpenAlexTopic {
    return {
      id: topic.id ?? '',
      displayName: topic.display_name ?? 'Unknown',
      score: topic.score ?? 0,
      subfield: topic.subfield?.display_name,
      field: topic.field?.display_name,
      domain: topic.domain?.display_name,
    };
  }

  // =============================================================================
  // RELATED WORKS
  // =============================================================================

  /**
   * Gets related works for a paper (pre-computed by OpenAlex).
   *
   * @remarks
   * OpenAlex pre-computes related works based on concept overlap and
   * other signals. Returns up to 10 related work IDs.
   *
   * @param workId - OpenAlex work ID (e.g., "W2741809807")
   * @returns Array of related work IDs
   *
   * @example
   * ```typescript
   * const relatedIds = await plugin.getRelatedWorks('W2741809807');
   * // Returns: ['W2123456789', 'W9876543210', ...]
   *
   * // Fetch full metadata for related works
   * const relatedWorks = await plugin.getWorksBatch(relatedIds);
   * ```
   *
   * @public
   */
  async getRelatedWorks(workId: string): Promise<readonly string[]> {
    await this.rateLimit();

    try {
      const response = await fetch(
        `${this.API_BASE_URL}/works/${workId}?select=related_works&mailto=${this.CONTACT_EMAIL}`,
        {
          headers: {
            Accept: 'application/json',
          },
        }
      );

      if (response.status === 404) {
        return [];
      }

      if (!response.ok) {
        this.logger.warn('OpenAlex related works error', {
          workId,
          status: response.status,
        });
        return [];
      }

      const data = (await response.json()) as { related_works?: string[] };
      return data.related_works ?? [];
    } catch (err) {
      this.logger.warn('Error fetching OpenAlex related works', {
        workId,
        error: (err as Error).message,
      });
      return [];
    }
  }

  /**
   * Batch fetches multiple works efficiently.
   *
   * @remarks
   * Uses OpenAlex's filter syntax to fetch up to 50 works in a single request.
   * More efficient than individual getWork() calls.
   *
   * @param workIds - Array of OpenAlex work IDs (max 50)
   * @returns Array of work metadata
   *
   * @example
   * ```typescript
   * const works = await plugin.getWorksBatch([
   *   'W2741809807',
   *   'W2123456789',
   *   'W9876543210',
   * ]);
   * ```
   *
   * @public
   */
  async getWorksBatch(workIds: readonly string[]): Promise<readonly OpenAlexWork[]> {
    if (workIds.length === 0) {
      return [];
    }

    // Limit to 50 IDs per batch
    const batchIds = workIds.slice(0, 50);

    await this.rateLimit();

    try {
      // Use pipe-separated filter
      const filter = `openalex_id:${batchIds.join('|')}`;
      const params = new URLSearchParams({
        filter,
        per_page: batchIds.length.toString(),
        mailto: this.CONTACT_EMAIL,
      });

      const response = await fetch(`${this.API_BASE_URL}/works?${params.toString()}`, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        this.logger.warn('OpenAlex batch fetch error', {
          status: response.status,
          batchSize: batchIds.length,
        });
        return [];
      }

      const data = (await response.json()) as { results: OpenAlexApiWork[] };
      const works: OpenAlexWork[] = [];

      for (const item of data.results ?? []) {
        const work = this.parseWork(item);
        if (work) {
          works.push(work);
        }
      }

      return works;
    } catch (err) {
      this.logger.warn('Error batch fetching OpenAlex works', {
        batchSize: batchIds.length,
        error: (err as Error).message,
      });
      return [];
    }
  }

  // =============================================================================
  // UTILITIES
  // =============================================================================

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
   * Normalizes an ORCID.
   */
  private normalizeOrcid(orcid: string): string | null {
    let normalized = orcid.trim();

    if (normalized.startsWith('https://orcid.org/')) {
      normalized = normalized.slice(18);
    } else if (normalized.startsWith('http://orcid.org/')) {
      normalized = normalized.slice(17);
    }

    // Validate ORCID format
    if (!/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(normalized)) {
      return null;
    }

    return normalized;
  }

  /**
   * Parses API work to OpenAlexWork.
   */
  private parseWork(data: OpenAlexApiWork): OpenAlexWork | null {
    if (!data.id || !data.title) {
      return null;
    }

    const authorships: OpenAlexAuthorship[] = (data.authorships ?? []).map((a) => ({
      authorPosition: (a.author_position as OpenAlexAuthorship['authorPosition']) ?? 'middle',
      author: {
        id: a.author?.id ?? '',
        displayName: a.author?.display_name ?? 'Unknown',
        orcid: a.author?.orcid?.replace('https://orcid.org/', ''),
      },
      institutions: (a.institutions ?? []).map((i) => ({
        id: i.id ?? '',
        displayName: i.display_name ?? 'Unknown',
        ror: i.ror,
        countryCode: i.country_code,
      })),
      rawAffiliationString: a.raw_affiliation_string,
    }));

    const concepts: OpenAlexConcept[] = (data.concepts ?? []).map((c) => ({
      id: c.id ?? '',
      displayName: c.display_name ?? 'Unknown',
      wikidata: c.wikidata,
      score: c.score ?? 0,
      level: c.level ?? 0,
    }));

    // Convert inverted index abstract to plain text
    let abstract: string | undefined;
    if (data.abstract_inverted_index) {
      abstract = this.invertedIndexToText(data.abstract_inverted_index);
    }

    return {
      id: data.id,
      doi: data.doi?.replace('https://doi.org/', ''),
      title: data.title,
      type: data.type ?? 'unknown',
      publicationDate: data.publication_date,
      publicationYear: data.publication_year,
      authorships,
      primaryLocation: data.primary_location
        ? {
            source: data.primary_location.source
              ? {
                  id: data.primary_location.source.id ?? '',
                  displayName: data.primary_location.source.display_name ?? 'Unknown',
                  issn: data.primary_location.source.issn,
                  type: data.primary_location.source.type,
                }
              : undefined,
            pdfUrl: data.primary_location.pdf_url,
            landingPageUrl: data.primary_location.landing_page_url,
            license: data.primary_location.license,
            version: data.primary_location.version,
          }
        : undefined,
      citedByCount: data.cited_by_count ?? 0,
      referencedWorksCount: data.referenced_works_count ?? 0,
      concepts,
      openAccess: data.open_access
        ? {
            isOa: data.open_access.is_oa ?? false,
            oaUrl: data.open_access.oa_url,
            oaStatus: data.open_access.oa_status,
          }
        : undefined,
      abstract,
      source: 'openalex',
    };
  }

  /**
   * Parses API author to OpenAlexAuthor.
   */
  private parseAuthor(data: OpenAlexApiAuthor): OpenAlexAuthor | null {
    if (!data.id) {
      return null;
    }

    return {
      id: data.id,
      displayName: data.display_name ?? 'Unknown',
      orcid: data.orcid?.replace('https://orcid.org/', ''),
      worksCount: data.works_count ?? 0,
      citedByCount: data.cited_by_count ?? 0,
      affiliations: (data.affiliations ?? []).map((a) => ({
        institution: {
          id: a.institution?.id ?? '',
          displayName: a.institution?.display_name ?? 'Unknown',
          ror: a.institution?.ror,
        },
        years: a.years ?? [],
      })),
      topConcepts: (data.x_concepts ?? []).slice(0, 10).map((c) => ({
        id: c.id ?? '',
        displayName: c.display_name ?? 'Unknown',
        wikidata: c.wikidata,
        score: c.score ?? 0,
        level: c.level ?? 0,
      })),
      source: 'openalex',
    };
  }

  /**
   * Converts OpenAlex inverted index abstract to plain text.
   */
  private invertedIndexToText(invertedIndex: Record<string, number[]>): string {
    const words: [string, number][] = [];

    for (const [word, positions] of Object.entries(invertedIndex)) {
      for (const pos of positions) {
        words.push([word, pos]);
      }
    }

    words.sort((a, b) => a[1] - b[1]);
    return words.map(([word]) => word).join(' ');
  }
}

export default OpenAlexPlugin;
