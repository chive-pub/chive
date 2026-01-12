/**
 * PsyArXiv integration plugin for psychology eprints.
 *
 * @remarks
 * Imports psychology eprints from PsyArXiv (https://psyarxiv.com),
 * which is hosted on the OSF Eprints platform.
 *
 * Uses the OSF Eprints API v2:
 * - REST API with JSON:API format
 * - Public access without authentication for reading
 * - Rate limit: 100 requests per minute
 *
 * ATProto Compliance:
 * - All imported data is AppView cache (ephemeral, rebuildable)
 * - Never writes to user PDSes
 * - Users claim eprints by creating records in THEIR PDS
 *
 * @packageDocumentation
 * @public
 * @since 0.1.0
 */

import { PluginError } from '../../types/errors.js';
import type {
  ExternalEprint,
  ExternalSearchQuery,
  FetchOptions,
  IPluginManifest,
  SearchablePlugin,
} from '../../types/interfaces/plugin.interface.js';
import { ImportingPlugin } from '../core/importing-plugin.js';

/**
 * OSF Eprints API response types.
 *
 * @internal
 */
interface OsfEprintResponse {
  data: OsfEprint[];
  links: {
    next?: string;
    prev?: string;
  };
}

/**
 * OSF Eprint data structure.
 *
 * @internal
 */
interface OsfEprint {
  id: string;
  type: 'eprints';
  attributes: {
    title: string;
    description?: string;
    date_created: string;
    date_modified: string;
    date_published?: string;
    doi?: string;
    is_published: boolean;
    is_eprint_orphan: boolean;
    license_record?: {
      copyright_holders: string[];
      year: string;
    };
    tags?: string[];
    subjects?: {
      id: string;
      text: string;
    }[];
  };
  relationships: {
    contributors: {
      links: {
        related: {
          href: string;
        };
      };
    };
    primary_file?: {
      links: {
        related: {
          href: string;
        };
      };
    };
  };
  links: {
    self: string;
    html: string;
    eprint_doi?: string;
  };
}

/**
 * OSF Contributor response.
 *
 * @internal
 */
interface OsfContributorResponse {
  data: OsfContributor[];
}

/**
 * OSF Contributor data structure.
 *
 * @internal
 */
interface OsfContributor {
  id: string;
  attributes: {
    bibliographic: boolean;
    permission: string;
    index: number;
  };
  embeds?: {
    users?: {
      data: {
        attributes: {
          full_name: string;
          given_name?: string;
          family_name?: string;
        };
      };
    };
  };
}

/**
 * PsyArXiv paper metadata.
 *
 * @public
 */
export interface PsyArxivPaper {
  /**
   * Unique eprint identifier.
   */
  id: string;

  /**
   * Paper title.
   */
  title: string;

  /**
   * Author names.
   */
  authors: readonly string[];

  /**
   * Paper abstract.
   */
  abstract?: string;

  /**
   * URL to the eprint.
   */
  url: string;

  /**
   * Publication date.
   */
  publicationDate: string;

  /**
   * DOI (if assigned).
   */
  doi?: string;

  /**
   * PDF URL (if available).
   */
  pdfUrl?: string;

  /**
   * Subject categories.
   */
  subjects?: readonly string[];

  /**
   * User-assigned tags.
   */
  tags?: readonly string[];

  /**
   * Source archive name.
   */
  source: 'psyarxiv';
}

/**
 * PsyArXiv integration plugin.
 *
 * @remarks
 * Fetches psychology eprints from PsyArXiv via OSF Eprints API and imports
 * them into the Chive AppView cache. Users can claim eprints they authored.
 *
 * Extends ImportingPlugin for standardized import/claiming workflow.
 *
 * @example
 * ```typescript
 * const plugin = new PsyArxivPlugin();
 * await manager.loadBuiltinPlugin(plugin);
 * ```
 *
 * @public
 */
export class PsyArxivPlugin extends ImportingPlugin implements SearchablePlugin {
  /**
   * Plugin ID.
   */
  readonly id = 'pub.chive.plugin.psyarxiv';

  /**
   * Import source identifier.
   */
  readonly source = 'psyarxiv' as const;

  /**
   * Indicates this plugin supports on-demand search.
   */
  readonly supportsSearch = true as const;

  /**
   * Plugin manifest.
   */
  readonly manifest: IPluginManifest = {
    id: 'pub.chive.plugin.psyarxiv',
    name: 'PsyArXiv Integration',
    version: '0.1.0',
    description: 'Imports psychology eprints from PsyArXiv with claiming support',
    author: 'Aaron Steven White',
    license: 'MIT',
    permissions: {
      network: {
        allowedDomains: ['api.osf.io', 'osf.io', 'psyarxiv.com'],
      },
      hooks: ['system.startup'],
      storage: {
        maxSize: 50 * 1024 * 1024, // 50MB for caching
      },
    },
    entrypoint: 'psyarxiv.js',
  };

  /**
   * OSF API base URL.
   */
  private readonly API_BASE_URL = 'https://api.osf.io/v2';

  /**
   * PsyArXiv provider ID on OSF.
   */
  private readonly PROVIDER_ID = 'psyarxiv';

  /**
   * Cache TTL in seconds (7 days).
   */
  private readonly CACHE_TTL = 86400 * 7;

  /**
   * Initializes the plugin.
   *
   * @remarks
   * Sets up rate limiting. No startup bulk import since this plugin
   * uses on-demand search via the search() method.
   */
  protected onInitialize(): Promise<void> {
    // Set rate limit to 600ms between requests (100 requests/minute)
    this.rateLimitDelayMs = 600;

    this.logger.info('PsyArXiv plugin initialized (search-based)', {
      apiVersion: 'OSF Eprints API v2',
      rateLimit: `${this.rateLimitDelayMs}ms between requests`,
    });

    return Promise.resolve();
  }

  /**
   * Fetches eprints from PsyArXiv.
   *
   * @param options - Fetch options (limit, cursor)
   * @returns Async iterable of external eprints
   */
  async *fetchEprints(options?: FetchOptions): AsyncIterable<ExternalEprint> {
    let nextUrl: string | null =
      `${this.API_BASE_URL}/eprints/?filter[provider]=${this.PROVIDER_ID}&sort=-date_created`;

    // If cursor provided, use it as the next URL
    if (options?.cursor) {
      nextUrl = options.cursor;
    }

    let count = 0;
    const limit = options?.limit ?? 100;

    while (nextUrl && count < limit) {
      await this.rateLimit();

      const response = await fetch(nextUrl, {
        headers: {
          'User-Agent': 'Chive-AppView/1.0 (Academic eprint aggregator; contact@chive.pub)',
          Accept: 'application/vnd.api+json',
        },
      });

      if (!response.ok) {
        throw new PluginError(this.id, 'EXECUTE', `PsyArXiv API error: ${response.status}`);
      }

      const data = (await response.json()) as OsfEprintResponse;

      for (const eprint of data.data) {
        if (count >= limit) break;

        // Skip unpublished or orphaned eprints
        if (!eprint.attributes.is_published || eprint.attributes.is_eprint_orphan) {
          continue;
        }

        const paper = await this.osfEprintToPaper(eprint);
        if (paper) {
          yield this.paperToExternalEprint(paper);
          count++;
        }
      }

      // Get next page URL
      nextUrl = data.links.next ?? null;
    }
  }

  /**
   * Builds the canonical URL for a PsyArXiv eprint.
   *
   * @param externalId - Eprint ID
   * @returns Full URL to the eprint
   */
  buildEprintUrl(externalId: string): string {
    return `https://psyarxiv.com/${externalId}`;
  }

  /**
   * Builds the PDF URL for a PsyArXiv eprint.
   *
   * @param externalId - Eprint ID
   * @returns PDF download URL
   */
  override buildPdfUrl(externalId: string): string | null {
    return `https://psyarxiv.com/${externalId}/download`;
  }

  /**
   * Parses external ID from a PsyArXiv URL.
   *
   * @param url - PsyArXiv URL
   * @returns Eprint ID or null
   */
  override parseExternalId(url: string): string | null {
    // Match psyarxiv.com/{id} or osf.io/eprints/psyarxiv/{id}
    const psyarxivMatch = /psyarxiv\.com\/([a-z0-9]+)/i.exec(url);
    if (psyarxivMatch?.[1]) {
      return psyarxivMatch[1];
    }

    const osfMatch = /osf\.io\/eprints\/psyarxiv\/([a-z0-9]+)/i.exec(url);
    return osfMatch?.[1] ?? null;
  }

  /**
   * Converts an OSF eprint to PsyArxivPaper format.
   *
   * @param eprint - OSF eprint data
   * @returns PsyArxiv paper or null
   */
  private async osfEprintToPaper(eprint: OsfEprint): Promise<PsyArxivPaper | null> {
    try {
      // Fetch contributors to get author names
      const authors = await this.fetchContributors(eprint);

      // Extract subjects as categories
      const subjects = eprint.attributes.subjects?.map((s) => s.text) ?? [];

      return {
        id: eprint.id,
        title: eprint.attributes.title,
        authors,
        abstract: eprint.attributes.description,
        url: eprint.links.html,
        publicationDate: eprint.attributes.date_published ?? eprint.attributes.date_created,
        doi: eprint.attributes.doi,
        pdfUrl: this.buildPdfUrl(eprint.id) ?? undefined,
        subjects: subjects.length > 0 ? subjects : undefined,
        tags: eprint.attributes.tags,
        source: 'psyarxiv',
      };
    } catch (err) {
      this.logger.warn('Error converting OSF eprint', {
        eprintId: eprint.id,
        error: (err as Error).message,
      });
      return null;
    }
  }

  /**
   * Fetches contributors for a eprint.
   *
   * @param eprint - OSF eprint data
   * @returns Array of author names
   */
  private async fetchContributors(eprint: OsfEprint): Promise<string[]> {
    const contributorsUrl = eprint.relationships.contributors.links.related.href;

    await this.rateLimit();

    const response = await fetch(`${contributorsUrl}?embed=users`, {
      headers: {
        'User-Agent': 'Chive-AppView/1.0 (Academic eprint aggregator; contact@chive.pub)',
        Accept: 'application/vnd.api+json',
      },
    });

    if (!response.ok) {
      this.logger.warn('Failed to fetch contributors', {
        eprintId: eprint.id,
        status: response.status,
      });
      return [];
    }

    const data = (await response.json()) as OsfContributorResponse;

    // Filter to bibliographic contributors and sort by index
    const bibliographicContributors = data.data
      .filter((c) => c.attributes.bibliographic)
      .sort((a, b) => a.attributes.index - b.attributes.index);

    // Extract names from embedded user data
    const names: string[] = [];
    for (const contributor of bibliographicContributors) {
      const userData = contributor.embeds?.users?.data;
      if (userData) {
        names.push(userData.attributes.full_name);
      }
    }

    return names;
  }

  /**
   * Converts a PsyArxiv paper to ExternalEprint format.
   */
  private paperToExternalEprint(paper: PsyArxivPaper): ExternalEprint {
    return {
      externalId: paper.id,
      url: paper.url,
      title: paper.title,
      abstract: paper.abstract,
      authors: paper.authors.map((name) => ({ name })),
      publicationDate: new Date(paper.publicationDate),
      doi: paper.doi,
      pdfUrl: paper.pdfUrl,
      categories: paper.subjects,
    };
  }

  /**
   * Gets a cached paper by ID.
   *
   * @param id - Eprint ID
   * @returns Paper metadata or null
   *
   * @public
   */
  async getPaper(id: string): Promise<PsyArxivPaper | null> {
    return this.cache.get<PsyArxivPaper>(`psyarxiv:${id}`);
  }

  /**
   * Fetches details for a specific eprint.
   *
   * @param eprintId - PsyArXiv eprint ID
   * @returns Paper details or null
   *
   * @public
   */
  async fetchEprintDetails(eprintId: string): Promise<PsyArxivPaper | null> {
    // Check cache first
    const cached = await this.cache.get<PsyArxivPaper>(`psyarxiv:detail:${eprintId}`);
    if (cached) {
      return cached;
    }

    await this.rateLimit();

    try {
      const response = await fetch(`${this.API_BASE_URL}/eprints/${eprintId}/`, {
        headers: {
          'User-Agent': 'Chive-AppView/1.0 (Academic eprint aggregator; contact@chive.pub)',
          Accept: 'application/vnd.api+json',
        },
      });

      if (!response.ok) {
        this.logger.warn('Failed to fetch eprint details', {
          eprintId,
          status: response.status,
        });
        return null;
      }

      const data = (await response.json()) as { data: OsfEprint };
      const paper = await this.osfEprintToPaper(data.data);

      if (paper) {
        await this.cache.set(`psyarxiv:detail:${eprintId}`, paper, this.CACHE_TTL);
      }

      return paper;
    } catch (err) {
      this.logger.warn('Error fetching eprint details', {
        eprintId,
        error: (err as Error).message,
      });
      return null;
    }
  }

  /**
   * Searches for eprints by query.
   *
   * @param query - Search query
   * @param options - Search options
   * @returns Matching papers
   *
   * @public
   */
  async searchEprints(
    query: string,
    options?: { limit?: number }
  ): Promise<readonly PsyArxivPaper[]> {
    await this.rateLimit();

    const limit = Math.min(options?.limit ?? 25, 100);
    const encodedQuery = encodeURIComponent(query);

    try {
      const response = await fetch(
        `${this.API_BASE_URL}/eprints/?filter[provider]=${this.PROVIDER_ID}&filter[title]=${encodedQuery}&page[size]=${limit}`,
        {
          headers: {
            'User-Agent': 'Chive-AppView/1.0 (Academic eprint aggregator; contact@chive.pub)',
            Accept: 'application/vnd.api+json',
          },
        }
      );

      if (!response.ok) {
        this.logger.warn('Search request failed', {
          query,
          status: response.status,
        });
        return [];
      }

      const data = (await response.json()) as OsfEprintResponse;
      const papers: PsyArxivPaper[] = [];

      for (const eprint of data.data) {
        if (!eprint.attributes.is_published || eprint.attributes.is_eprint_orphan) {
          continue;
        }

        const paper = await this.osfEprintToPaper(eprint);
        if (paper) {
          papers.push(paper);
        }
      }

      return papers;
    } catch (err) {
      this.logger.warn('Search error', {
        query,
        error: (err as Error).message,
      });
      return [];
    }
  }

  /**
   * Searches PsyArXiv for eprints matching the query.
   *
   * @param query - Search parameters (author, title, externalId)
   * @returns Matching eprints from PsyArXiv
   *
   * @throws {PluginError} If the search request fails
   *
   * @remarks
   * Uses OSF Eprints API v2 for search queries. Supports searching by:
   * - Title text (filter[title] parameter)
   * - Eprint ID (exact match lookup)
   *
   * Rate limiting: Enforces 600ms delay between requests.
   *
   * @example
   * ```typescript
   * const results = await psyArxivPlugin.search({
   *   title: 'cognitive psychology',
   *   limit: 10,
   * });
   * ```
   *
   * @public
   */
  async search(query: ExternalSearchQuery): Promise<readonly ExternalEprint[]> {
    // Handle exact ID lookup separately
    if (query.externalId) {
      const paper = await this.fetchEprintDetails(query.externalId);
      if (paper) {
        return [this.paperToExternalEprint(paper)];
      }
      return [];
    }

    // Build search terms from query
    const searchTerms: string[] = [];

    if (query.title) {
      searchTerms.push(query.title);
    }

    if (query.author) {
      searchTerms.push(query.author);
    }

    if (searchTerms.length === 0) {
      return [];
    }

    await this.rateLimit();

    const searchUrl = this.buildSearchUrl(query);

    this.logger.debug('Searching PsyArXiv', {
      query,
      url: searchUrl,
    });

    try {
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Chive-AppView/1.0 (Academic eprint aggregator; contact@chive.pub)',
          Accept: 'application/vnd.api+json',
        },
      });

      if (!response.ok) {
        throw new PluginError(
          this.id,
          'EXECUTE',
          `PsyArXiv search request failed with status ${response.status}`
        );
      }

      const data = (await response.json()) as OsfEprintResponse;
      const papers: PsyArxivPaper[] = [];

      for (const eprint of data.data) {
        if (!eprint.attributes.is_published || eprint.attributes.is_eprint_orphan) {
          continue;
        }

        const paper = await this.osfEprintToPaper(eprint);
        if (paper) {
          papers.push(paper);
        }
      }

      this.logger.debug('PsyArXiv search completed', {
        resultCount: papers.length,
      });

      // Record metrics
      this.recordCounter('search_requests');
      this.recordCounter('search_results', { count: String(papers.length) });

      return papers.map((paper) => this.paperToExternalEprint(paper));
    } catch (err) {
      if (err instanceof PluginError) {
        throw err;
      }

      this.logger.error('PsyArXiv search failed', err as Error, { query });
      this.recordCounter('search_errors');

      throw new PluginError(
        this.id,
        'EXECUTE',
        `PsyArXiv search failed: ${(err as Error).message}`,
        err as Error
      );
    }
  }

  /**
   * Builds the OSF API search URL from query parameters.
   *
   * @param query - Search query parameters
   * @returns Fully formed OSF API URL
   *
   * @internal
   */
  private buildSearchUrl(query: ExternalSearchQuery): string {
    const url = new URL(`${this.API_BASE_URL}/eprints/`);

    url.searchParams.set('filter[provider]', this.PROVIDER_ID);

    if (query.title) {
      url.searchParams.set('filter[title]', query.title);
    }

    url.searchParams.set('page[size]', String(query.limit ?? 10));

    return url.toString();
  }
}

export default PsyArxivPlugin;
