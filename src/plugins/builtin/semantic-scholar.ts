/**
 * Semantic Scholar integration plugin.
 *
 * @remarks
 * Provides academic paper search and author verification via Semantic Scholar API.
 * Semantic Scholar (https://www.semanticscholar.org) is an AI-powered research
 * tool that indexes 200M+ papers with citation and influence metrics.
 *
 * This plugin is used to:
 * - Enrich eprints with citation and influence data
 * - Verify author identity via claimed Semantic Scholar profiles
 * - Provide related paper recommendations
 *
 * Uses Semantic Scholar Academic Graph API:
 * - Base URL: https://api.semanticscholar.org/graph/v1
 * - Rate limit: 100 requests per 5 minutes (public), higher with API key
 *
 * Semantic Scholar profiles linked to ORCID are a verification authority
 * for the multi-authority claiming system.
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
 * Semantic Scholar paper metadata.
 *
 * @public
 */
export interface SemanticScholarPaper {
  /**
   * Semantic Scholar paper ID.
   */
  paperId: string;

  /**
   * External IDs (DOI, arXiv, etc.).
   */
  externalIds?: {
    DOI?: string;
    ArXiv?: string;
    PubMed?: string;
    DBLP?: string;
    CorpusId?: number;
  };

  /**
   * Paper title.
   */
  title: string;

  /**
   * Abstract text.
   */
  abstract?: string;

  /**
   * Publication venue.
   */
  venue?: string;

  /**
   * Publication year.
   */
  year?: number;

  /**
   * Authors.
   */
  authors: readonly SemanticScholarAuthorRef[];

  /**
   * Citation count.
   */
  citationCount: number;

  /**
   * Reference count.
   */
  referenceCount: number;

  /**
   * Influential citation count.
   */
  influentialCitationCount: number;

  /**
   * Open access PDF URL.
   */
  openAccessPdf?: {
    url: string;
    status: string;
  };

  /**
   * Publication date.
   */
  publicationDate?: string;

  /**
   * Fields of study.
   */
  fieldsOfStudy?: readonly string[];

  /**
   * TLDR summary (AI-generated).
   */
  tldr?: {
    text: string;
  };

  /**
   * S2 URL.
   */
  url: string;

  /**
   * Source of the metadata.
   */
  source: 'semanticscholar';
}

/**
 * Author reference in paper metadata.
 *
 * @public
 */
export interface SemanticScholarAuthorRef {
  /**
   * Author ID.
   */
  authorId?: string;

  /**
   * Author name.
   */
  name: string;
}

/**
 * Semantic Scholar author profile.
 *
 * @public
 */
export interface SemanticScholarAuthor {
  /**
   * Author ID.
   */
  authorId: string;

  /**
   * External IDs.
   */
  externalIds?: {
    ORCID?: string;
    DBLP?: string[];
  };

  /**
   * Author name.
   */
  name: string;

  /**
   * Alternate names.
   */
  aliases?: readonly string[];

  /**
   * Primary affiliation.
   */
  affiliations?: readonly string[];

  /**
   * Total papers.
   */
  paperCount: number;

  /**
   * Total citations.
   */
  citationCount: number;

  /**
   * h-index.
   */
  hIndex: number;

  /**
   * S2 URL.
   */
  url: string;

  /**
   * Source of the metadata.
   */
  source: 'semanticscholar';
}

/**
 * Citation edge with influence marker.
 *
 * @remarks
 * Represents a citation relationship from the Semantic Scholar API,
 * including influence markers from their citation influence model.
 *
 * @public
 */
export interface CitationEdge {
  /**
   * The citing or cited paper.
   */
  readonly paper: SemanticScholarPaper;

  /**
   * Whether this is an influential citation (based on S2 influence model).
   *
   * @remarks
   * Semantic Scholar uses a model to determine citation influence based on
   * factors like whether the citing paper extends or builds on the work,
   * vs. merely mentioning it in passing.
   */
  readonly isInfluential: boolean;

  /**
   * Intent of the citation (if available).
   *
   * @remarks
   * Possible values include: 'methodology', 'background', 'result'
   */
  readonly intent?: readonly string[];

  /**
   * Text contexts where the citation appears.
   */
  readonly contexts?: readonly string[];
}

/**
 * Semantic Scholar API paper response.
 *
 * @internal
 */
interface S2ApiPaper {
  paperId?: string;
  externalIds?: {
    DOI?: string;
    ArXiv?: string;
    PubMed?: string;
    DBLP?: string;
    CorpusId?: number;
  };
  title?: string;
  abstract?: string;
  venue?: string;
  year?: number;
  authors?: { authorId?: string; name?: string }[];
  citationCount?: number;
  referenceCount?: number;
  influentialCitationCount?: number;
  openAccessPdf?: { url?: string; status?: string };
  publicationDate?: string;
  fieldsOfStudy?: string[];
  tldr?: { text?: string };
  url?: string;
}

/**
 * Semantic Scholar API author response.
 *
 * @internal
 */
interface S2ApiAuthor {
  authorId?: string;
  externalIds?: {
    ORCID?: string;
    DBLP?: string[];
  };
  name?: string;
  aliases?: string[];
  affiliations?: string[];
  paperCount?: number;
  citationCount?: number;
  hIndex?: number;
  url?: string;
}

/**
 * Semantic Scholar integration plugin.
 *
 * @remarks
 * Provides paper and author lookup from Semantic Scholar's 200M+ paper database.
 * Semantic Scholar profiles with linked ORCID provide high-confidence identity
 * verification for the multi-authority claiming system.
 *
 * @example
 * ```typescript
 * const plugin = new SemanticScholarPlugin();
 * await manager.loadBuiltinPlugin(plugin);
 *
 * // Look up paper by DOI
 * const paper = await plugin.getPaperByDoi('10.1234/example');
 *
 * // Get author for claiming verification
 * const author = await plugin.getAuthor('12345678');
 * if (author?.externalIds?.ORCID) {
 *   // High-confidence match for claiming
 * }
 * ```
 *
 * @public
 */
export class SemanticScholarPlugin extends BasePlugin {
  /**
   * Plugin ID.
   */
  readonly id = 'pub.chive.plugin.semantic-scholar';

  /**
   * Plugin manifest.
   */
  readonly manifest: IPluginManifest = {
    id: 'pub.chive.plugin.semantic-scholar',
    name: 'Semantic Scholar Integration',
    version: '0.1.0',
    description: 'Provides paper metadata and author verification via Semantic Scholar',
    author: 'Aaron Steven White',
    license: 'MIT',
    permissions: {
      network: {
        allowedDomains: ['api.semanticscholar.org'],
      },
      storage: {
        maxSize: 100 * 1024 * 1024, // 100MB for caching
      },
    },
    entrypoint: 'semantic-scholar.js',
  };

  /**
   * Semantic Scholar API base URL.
   */
  private readonly API_BASE_URL = 'https://api.semanticscholar.org/graph/v1';

  /**
   * Default fields to request for papers.
   */
  private readonly PAPER_FIELDS =
    'paperId,externalIds,title,abstract,venue,year,authors,citationCount,referenceCount,influentialCitationCount,openAccessPdf,publicationDate,fieldsOfStudy,tldr,url';

  /**
   * Default fields to request for authors.
   */
  private readonly AUTHOR_FIELDS =
    'authorId,externalIds,name,aliases,affiliations,paperCount,citationCount,hIndex,url';

  /**
   * Cache TTL in seconds (7 days).
   */
  private readonly CACHE_TTL = 86400 * 7;

  /**
   * Rate limit: 100 requests per 5 minutes = ~3 seconds between requests.
   */
  private rateLimitDelayMs = 3000;

  /**
   * Last request timestamp.
   */
  private lastRequestTime = 0;

  /**
   * Initializes the plugin.
   */
  protected onInitialize(): Promise<void> {
    this.logger.info('Semantic Scholar plugin initialized', {
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
   * Gets paper by Semantic Scholar ID.
   *
   * @param paperId - Semantic Scholar paper ID
   * @returns Paper metadata or null
   *
   * @public
   */
  async getPaper(paperId: string): Promise<SemanticScholarPaper | null> {
    const cacheKey = `s2:paper:${paperId}`;
    const cached = await this.cache.get<SemanticScholarPaper>(cacheKey);
    if (cached) {
      return cached;
    }

    await this.rateLimit();

    try {
      const response = await fetch(
        `${this.API_BASE_URL}/paper/${paperId}?fields=${this.PAPER_FIELDS}`,
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
        this.logger.warn('Semantic Scholar API error', {
          paperId,
          status: response.status,
        });
        return null;
      }

      const data = (await response.json()) as S2ApiPaper;
      const paper = this.parsePaper(data);

      if (paper) {
        await this.cache.set(cacheKey, paper, this.CACHE_TTL);
      }

      return paper;
    } catch (err) {
      this.logger.warn('Error fetching Semantic Scholar paper', {
        paperId,
        error: (err as Error).message,
      });
      return null;
    }
  }

  /**
   * Gets paper by DOI.
   *
   * @param doi - DOI string
   * @returns Paper metadata or null
   *
   * @public
   */
  async getPaperByDoi(doi: string): Promise<SemanticScholarPaper | null> {
    const normalizedDoi = this.normalizeDoi(doi);
    if (!normalizedDoi) {
      return null;
    }

    const cacheKey = `s2:paper:doi:${normalizedDoi}`;
    const cached = await this.cache.get<SemanticScholarPaper>(cacheKey);
    if (cached) {
      return cached;
    }

    await this.rateLimit();

    try {
      const response = await fetch(
        `${this.API_BASE_URL}/paper/DOI:${normalizedDoi}?fields=${this.PAPER_FIELDS}`,
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
        this.logger.warn('Semantic Scholar API error', {
          doi: normalizedDoi,
          status: response.status,
        });
        return null;
      }

      const data = (await response.json()) as S2ApiPaper;
      const paper = this.parsePaper(data);

      if (paper) {
        await this.cache.set(cacheKey, paper, this.CACHE_TTL);
      }

      return paper;
    } catch (err) {
      this.logger.warn('Error fetching Semantic Scholar paper by DOI', {
        doi: normalizedDoi,
        error: (err as Error).message,
      });
      return null;
    }
  }

  /**
   * Gets paper by arXiv ID.
   *
   * @param arxivId - arXiv ID (e.g., "2301.01234")
   * @returns Paper metadata or null
   *
   * @public
   */
  async getPaperByArxiv(arxivId: string): Promise<SemanticScholarPaper | null> {
    const cacheKey = `s2:paper:arxiv:${arxivId}`;
    const cached = await this.cache.get<SemanticScholarPaper>(cacheKey);
    if (cached) {
      return cached;
    }

    await this.rateLimit();

    try {
      const response = await fetch(
        `${this.API_BASE_URL}/paper/ARXIV:${arxivId}?fields=${this.PAPER_FIELDS}`,
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
        this.logger.warn('Semantic Scholar API error', {
          arxivId,
          status: response.status,
        });
        return null;
      }

      const data = (await response.json()) as S2ApiPaper;
      const paper = this.parsePaper(data);

      if (paper) {
        await this.cache.set(cacheKey, paper, this.CACHE_TTL);
      }

      return paper;
    } catch (err) {
      this.logger.warn('Error fetching Semantic Scholar paper by arXiv', {
        arxivId,
        error: (err as Error).message,
      });
      return null;
    }
  }

  /**
   * Gets author by Semantic Scholar ID.
   *
   * @remarks
   * Semantic Scholar author profiles with linked ORCID provide high-confidence
   * identity verification for the multi-authority claiming system.
   *
   * @param authorId - Semantic Scholar author ID
   * @returns Author profile or null
   *
   * @public
   */
  async getAuthor(authorId: string): Promise<SemanticScholarAuthor | null> {
    const cacheKey = `s2:author:${authorId}`;
    const cached = await this.cache.get<SemanticScholarAuthor>(cacheKey);
    if (cached) {
      return cached;
    }

    await this.rateLimit();

    try {
      const response = await fetch(
        `${this.API_BASE_URL}/author/${authorId}?fields=${this.AUTHOR_FIELDS}`,
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
        this.logger.warn('Semantic Scholar API error', {
          authorId,
          status: response.status,
        });
        return null;
      }

      const data = (await response.json()) as S2ApiAuthor;
      const author = this.parseAuthor(data);

      if (author) {
        await this.cache.set(cacheKey, author, this.CACHE_TTL);
      }

      return author;
    } catch (err) {
      this.logger.warn('Error fetching Semantic Scholar author', {
        authorId,
        error: (err as Error).message,
      });
      return null;
    }
  }

  /**
   * Searches for authors by name.
   *
   * @param query - Author name to search
   * @param options - Search options
   * @returns Matching authors
   *
   * @public
   */
  async searchAuthors(
    query: string,
    options?: { limit?: number }
  ): Promise<readonly SemanticScholarAuthor[]> {
    await this.rateLimit();

    const limit = Math.min(options?.limit ?? 10, 100);

    try {
      const response = await fetch(
        `${this.API_BASE_URL}/author/search?query=${encodeURIComponent(query)}&fields=${this.AUTHOR_FIELDS}&limit=${limit}`,
        {
          headers: {
            Accept: 'application/json',
          },
        }
      );

      if (!response.ok) {
        this.logger.warn('Semantic Scholar author search error', {
          query,
          status: response.status,
        });
        return [];
      }

      const data = (await response.json()) as { data: S2ApiAuthor[] };
      const authors: SemanticScholarAuthor[] = [];

      for (const item of data.data) {
        const author = this.parseAuthor(item);
        if (author) {
          authors.push(author);
        }
      }

      return authors;
    } catch (err) {
      this.logger.warn('Error searching Semantic Scholar authors', {
        query,
        error: (err as Error).message,
      });
      return [];
    }
  }

  /**
   * Searches for papers.
   *
   * @param query - Search query
   * @param options - Search options
   * @returns Matching papers
   *
   * @public
   */
  async searchPapers(
    query: string,
    options?: { limit?: number; year?: string; fieldsOfStudy?: string }
  ): Promise<readonly SemanticScholarPaper[]> {
    await this.rateLimit();

    const limit = Math.min(options?.limit ?? 10, 100);
    const params = new URLSearchParams({
      query,
      fields: this.PAPER_FIELDS,
      limit: limit.toString(),
    });

    if (options?.year) {
      params.set('year', options.year);
    }
    if (options?.fieldsOfStudy) {
      params.set('fieldsOfStudy', options.fieldsOfStudy);
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/paper/search?${params.toString()}`, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        this.logger.warn('Semantic Scholar paper search error', {
          query,
          status: response.status,
        });
        return [];
      }

      const data = (await response.json()) as { data: S2ApiPaper[] };
      const papers: SemanticScholarPaper[] = [];

      for (const item of data.data) {
        const paper = this.parsePaper(item);
        if (paper) {
          papers.push(paper);
        }
      }

      return papers;
    } catch (err) {
      this.logger.warn('Error searching Semantic Scholar papers', {
        query,
        error: (err as Error).message,
      });
      return [];
    }
  }

  /**
   * Gets papers by an author.
   *
   * @param authorId - Semantic Scholar author ID
   * @param options - Query options
   * @returns Author's papers
   *
   * @public
   */
  async getAuthorPapers(
    authorId: string,
    options?: { limit?: number }
  ): Promise<readonly SemanticScholarPaper[]> {
    await this.rateLimit();

    const limit = Math.min(options?.limit ?? 100, 1000);

    try {
      const response = await fetch(
        `${this.API_BASE_URL}/author/${authorId}/papers?fields=${this.PAPER_FIELDS}&limit=${limit}`,
        {
          headers: {
            Accept: 'application/json',
          },
        }
      );

      if (!response.ok) {
        this.logger.warn('Semantic Scholar author papers error', {
          authorId,
          status: response.status,
        });
        return [];
      }

      const data = (await response.json()) as { data: S2ApiPaper[] };
      const papers: SemanticScholarPaper[] = [];

      for (const item of data.data) {
        const paper = this.parsePaper(item);
        if (paper) {
          papers.push(paper);
        }
      }

      return papers;
    } catch (err) {
      this.logger.warn('Error fetching author papers', {
        authorId,
        error: (err as Error).message,
      });
      return [];
    }
  }

  // =============================================================================
  // RECOMMENDATIONS API
  // =============================================================================

  /**
   * Recommendations API base URL.
   *
   * @remarks
   * The Recommendations API is separate from the Academic Graph API and
   * uses SPECTER2 embeddings for semantic similarity.
   *
   * @see {@link https://api.semanticscholar.org/api-docs/recommendations | Recommendations API}
   */
  private readonly RECOMMENDATIONS_API_URL = 'https://api.semanticscholar.org/recommendations/v1';

  /**
   * Gets paper recommendations for a single paper.
   *
   * @remarks
   * Uses the Semantic Scholar Recommendations API with SPECTER2 embeddings
   * to find semantically similar papers. Supports filtering by paper pool:
   * - `recent`: Recent papers from all fields (default)
   * - `all-cs`: All computer science papers
   *
   * @param paperId - Semantic Scholar paper ID
   * @param options - Recommendation options
   * @returns Array of recommended papers
   *
   * @example
   * ```typescript
   * const recommendations = await plugin.getRecommendations('649def34f8be52c8b66281af98ae884c09aef38b', {
   *   limit: 20,
   *   from: 'recent',
   * });
   *
   * for (const paper of recommendations) {
   *   console.log(`${paper.title} (${paper.citationCount} citations)`);
   * }
   * ```
   *
   * @see {@link https://api.semanticscholar.org/api-docs/recommendations | Semantic Scholar Recommendations API}
   *
   * @public
   */
  async getRecommendations(
    paperId: string,
    options?: {
      /**
       * Number of recommendations (max 500).
       * @defaultValue 10
       */
      limit?: number;
      /**
       * Paper pool: 'recent' or 'all-cs'.
       * @defaultValue 'recent'
       */
      from?: 'recent' | 'all-cs';
    }
  ): Promise<readonly SemanticScholarPaper[]> {
    await this.rateLimit();

    const limit = Math.min(options?.limit ?? 10, 500);
    const from = options?.from ?? 'recent';

    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        from,
        fields: this.PAPER_FIELDS,
      });

      const response = await fetch(
        `${this.RECOMMENDATIONS_API_URL}/papers/forpaper/${paperId}?${params.toString()}`,
        {
          headers: {
            Accept: 'application/json',
          },
        }
      );

      if (response.status === 404) {
        this.logger.debug('Paper not found for recommendations', { paperId });
        return [];
      }

      if (!response.ok) {
        this.logger.warn('Semantic Scholar Recommendations API error', {
          paperId,
          status: response.status,
        });
        return [];
      }

      const data = (await response.json()) as { recommendedPapers: S2ApiPaper[] };
      const papers: SemanticScholarPaper[] = [];

      for (const item of data.recommendedPapers ?? []) {
        const paper = this.parsePaper(item);
        if (paper) {
          papers.push(paper);
        }
      }

      return papers;
    } catch (err) {
      this.logger.warn('Error fetching Semantic Scholar recommendations', {
        paperId,
        error: (err as Error).message,
      });
      return [];
    }
  }

  /**
   * Gets recommendations based on positive and negative paper examples.
   *
   * @remarks
   * Uses the Semantic Scholar Recommendations API with multi-example learning.
   * Provide papers the user likes as positive examples and papers they don't
   * want as negative examples for personalized recommendations.
   *
   * This is used to power the "For You" feed by using the user's claimed
   * papers as positive examples and dismissed recommendations as negatives.
   *
   * @param options - Paper lists and limit
   * @returns Array of recommended papers
   *
   * @example
   * ```typescript
   * // Get recommendations based on user's claimed papers
   * const recommendations = await plugin.getRecommendationsFromLists({
   *   positivePaperIds: ['649def34f8be52c8b66281af98ae884c09aef38b', 'ARXIV:2106.15928'],
   *   negativePaperIds: ['ArXiv:1805.02262'], // Dismissed recommendations
   *   limit: 50,
   * });
   * ```
   *
   * @see {@link https://api.semanticscholar.org/api-docs/recommendations | Semantic Scholar Recommendations API}
   *
   * @public
   */
  async getRecommendationsFromLists(options: {
    /**
     * Paper IDs to find similar papers for.
     * Supports S2 paper IDs, DOI prefixed (DOI:xxx), or arXiv prefixed (ARXIV:xxx).
     */
    positivePaperIds: readonly string[];
    /**
     * Paper IDs to exclude from recommendations (optional).
     */
    negativePaperIds?: readonly string[];
    /**
     * Number of recommendations (max 500).
     * @defaultValue 100
     */
    limit?: number;
  }): Promise<readonly SemanticScholarPaper[]> {
    if (options.positivePaperIds.length === 0) {
      return [];
    }

    await this.rateLimit();

    const limit = Math.min(options.limit ?? 100, 500);

    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        fields: this.PAPER_FIELDS,
      });

      const requestBody: { positivePaperIds: string[]; negativePaperIds?: string[] } = {
        positivePaperIds: [...options.positivePaperIds],
      };

      if (options.negativePaperIds && options.negativePaperIds.length > 0) {
        requestBody.negativePaperIds = [...options.negativePaperIds];
      }

      const response = await fetch(`${this.RECOMMENDATIONS_API_URL}/papers/?${params.toString()}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.status === 404) {
        this.logger.debug('Input papers not found', {
          positivePaperIds: options.positivePaperIds,
        });
        return [];
      }

      if (!response.ok) {
        this.logger.warn('Semantic Scholar multi-example recommendations error', {
          status: response.status,
          positivePaperCount: options.positivePaperIds.length,
        });
        return [];
      }

      const data = (await response.json()) as { recommendedPapers: S2ApiPaper[] };
      const papers: SemanticScholarPaper[] = [];

      for (const item of data.recommendedPapers ?? []) {
        const paper = this.parsePaper(item);
        if (paper) {
          papers.push(paper);
        }
      }

      return papers;
    } catch (err) {
      this.logger.warn('Error fetching multi-example recommendations', {
        positivePaperCount: options.positivePaperIds.length,
        error: (err as Error).message,
      });
      return [];
    }
  }

  // =============================================================================
  // CITATIONS AND REFERENCES
  // =============================================================================

  /**
   * Gets papers that cite this paper.
   *
   * @remarks
   * Returns papers that cite the specified paper, with influence markers
   * indicating whether each citation is influential (based on Semantic
   * Scholar's citation influence model).
   *
   * @param paperId - Semantic Scholar paper ID
   * @param options - Query options
   * @returns Paginated citation results
   *
   * @example
   * ```typescript
   * const { citations, total, next } = await plugin.getCitations('649def34...', {
   *   limit: 50,
   * });
   *
   * for (const { paper, isInfluential } of citations) {
   *   console.log(`${paper.title} ${isInfluential ? '(influential)' : ''}`);
   * }
   * ```
   *
   * @public
   */
  async getCitations(
    paperId: string,
    options?: {
      /**
       * Number of citations to return (max 1000).
       * @defaultValue 100
       */
      limit?: number;
      /**
       * Offset for pagination.
       */
      offset?: number;
    }
  ): Promise<{
    readonly citations: readonly CitationEdge[];
    readonly total: number;
    readonly next?: number;
  }> {
    await this.rateLimit();

    const limit = Math.min(options?.limit ?? 100, 1000);
    const offset = options?.offset ?? 0;

    try {
      const params = new URLSearchParams({
        fields: `${this.PAPER_FIELDS},isInfluential,intents,contexts`,
        limit: limit.toString(),
        offset: offset.toString(),
      });

      const response = await fetch(
        `${this.API_BASE_URL}/paper/${paperId}/citations?${params.toString()}`,
        {
          headers: {
            Accept: 'application/json',
          },
        }
      );

      if (response.status === 404) {
        return { citations: [], total: 0 };
      }

      if (!response.ok) {
        this.logger.warn('Semantic Scholar citations API error', {
          paperId,
          status: response.status,
        });
        return { citations: [], total: 0 };
      }

      const data = (await response.json()) as {
        data: {
          citingPaper?: S2ApiPaper;
          isInfluential?: boolean;
          intents?: string[];
          contexts?: string[];
        }[];
        next?: number;
        offset?: number;
      };

      const citations: CitationEdge[] = [];

      for (const item of data.data ?? []) {
        if (item.citingPaper) {
          const paper = this.parsePaper(item.citingPaper);
          if (paper) {
            citations.push({
              paper,
              isInfluential: item.isInfluential ?? false,
              intent: item.intents,
              contexts: item.contexts,
            });
          }
        }
      }

      return {
        citations,
        total: (data.offset ?? 0) + citations.length + (data.next ? 1 : 0),
        next: data.next,
      };
    } catch (err) {
      this.logger.warn('Error fetching Semantic Scholar citations', {
        paperId,
        error: (err as Error).message,
      });
      return { citations: [], total: 0 };
    }
  }

  /**
   * Gets papers that this paper cites (references).
   *
   * @remarks
   * Returns papers referenced by the specified paper, with influence markers
   * indicating whether each reference is influential.
   *
   * @param paperId - Semantic Scholar paper ID
   * @param options - Query options
   * @returns Paginated reference results
   *
   * @example
   * ```typescript
   * const { references, total, next } = await plugin.getReferences('649def34...', {
   *   limit: 50,
   * });
   *
   * for (const { paper, isInfluential } of references) {
   *   console.log(`${paper.title} ${isInfluential ? '(influential)' : ''}`);
   * }
   * ```
   *
   * @public
   */
  async getReferences(
    paperId: string,
    options?: {
      /**
       * Number of references to return (max 1000).
       * @defaultValue 100
       */
      limit?: number;
      /**
       * Offset for pagination.
       */
      offset?: number;
    }
  ): Promise<{
    readonly references: readonly CitationEdge[];
    readonly total: number;
    readonly next?: number;
  }> {
    await this.rateLimit();

    const limit = Math.min(options?.limit ?? 100, 1000);
    const offset = options?.offset ?? 0;

    try {
      const params = new URLSearchParams({
        fields: `${this.PAPER_FIELDS},isInfluential,intents,contexts`,
        limit: limit.toString(),
        offset: offset.toString(),
      });

      const response = await fetch(
        `${this.API_BASE_URL}/paper/${paperId}/references?${params.toString()}`,
        {
          headers: {
            Accept: 'application/json',
          },
        }
      );

      if (response.status === 404) {
        return { references: [], total: 0 };
      }

      if (!response.ok) {
        this.logger.warn('Semantic Scholar references API error', {
          paperId,
          status: response.status,
        });
        return { references: [], total: 0 };
      }

      const data = (await response.json()) as {
        data: {
          citedPaper?: S2ApiPaper;
          isInfluential?: boolean;
          intents?: string[];
          contexts?: string[];
        }[];
        next?: number;
        offset?: number;
      };

      const references: CitationEdge[] = [];

      for (const item of data.data ?? []) {
        if (item.citedPaper) {
          const paper = this.parsePaper(item.citedPaper);
          if (paper) {
            references.push({
              paper,
              isInfluential: item.isInfluential ?? false,
              intent: item.intents,
              contexts: item.contexts,
            });
          }
        }
      }

      return {
        references,
        total: (data.offset ?? 0) + references.length + (data.next ? 1 : 0),
        next: data.next,
      };
    } catch (err) {
      this.logger.warn('Error fetching Semantic Scholar references', {
        paperId,
        error: (err as Error).message,
      });
      return { references: [], total: 0 };
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
   * Parses API paper to SemanticScholarPaper.
   */
  private parsePaper(data: S2ApiPaper): SemanticScholarPaper | null {
    if (!data.paperId || !data.title) {
      return null;
    }

    return {
      paperId: data.paperId,
      externalIds: data.externalIds,
      title: data.title,
      abstract: data.abstract,
      venue: data.venue,
      year: data.year,
      authors: (data.authors ?? []).map((a) => ({
        authorId: a.authorId,
        name: a.name ?? 'Unknown',
      })),
      citationCount: data.citationCount ?? 0,
      referenceCount: data.referenceCount ?? 0,
      influentialCitationCount: data.influentialCitationCount ?? 0,
      openAccessPdf: data.openAccessPdf?.url
        ? { url: data.openAccessPdf.url, status: data.openAccessPdf.status ?? 'unknown' }
        : undefined,
      publicationDate: data.publicationDate,
      fieldsOfStudy: data.fieldsOfStudy,
      tldr: data.tldr?.text ? { text: data.tldr.text } : undefined,
      url: data.url ?? `https://www.semanticscholar.org/paper/${data.paperId}`,
      source: 'semanticscholar',
    };
  }

  /**
   * Parses API author to SemanticScholarAuthor.
   */
  private parseAuthor(data: S2ApiAuthor): SemanticScholarAuthor | null {
    if (!data.authorId) {
      return null;
    }

    return {
      authorId: data.authorId,
      externalIds: data.externalIds,
      name: data.name ?? 'Unknown',
      aliases: data.aliases,
      affiliations: data.affiliations,
      paperCount: data.paperCount ?? 0,
      citationCount: data.citationCount ?? 0,
      hIndex: data.hIndex ?? 0,
      url: data.url ?? `https://www.semanticscholar.org/author/${data.authorId}`,
      source: 'semanticscholar',
    };
  }
}

export default SemanticScholarPlugin;
