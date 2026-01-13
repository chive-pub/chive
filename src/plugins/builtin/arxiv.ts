/**
 * arXiv integration plugin for eprint harvesting.
 *
 * @remarks
 * Imports eprints from arXiv (https://arxiv.org) using the OAI-PMH protocol.
 *
 * arXiv provides an official OAI-PMH endpoint for bulk metadata harvesting:
 * - Base URL: http://export.arxiv.org/oai2
 * - Format: oai_dc (Dublin Core) or arXiv native format
 * - Supports incremental harvesting via datestamp filtering
 *
 * Rate limiting: arXiv requires 3 seconds between OAI-PMH requests.
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

import { textContent, findAll, getChildren } from 'domutils';
import { parseDocument } from 'htmlparser2';

import { PluginError } from '../../types/errors.js';
import type {
  ExternalAuthor,
  ExternalEprint,
  ExternalSearchQuery,
  FetchOptions,
  IPluginManifest,
  SearchablePlugin,
} from '../../types/interfaces/plugin.interface.js';
import { ImportingPlugin } from '../core/importing-plugin.js';

/**
 * arXiv paper metadata.
 *
 * @public
 */
export interface ArxivPaper {
  /**
   * arXiv identifier (e.g., "2401.12345" or "hep-th/9901001").
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
   * URL to the paper.
   */
  url: string;

  /**
   * Submission/publication date.
   */
  submittedDate: string;

  /**
   * Primary category (e.g., "cs.CL", "hep-th").
   */
  primaryCategory: string;

  /**
   * All categories.
   */
  categories: readonly string[];

  /**
   * DOI if available.
   */
  doi?: string;

  /**
   * Journal reference if published.
   */
  journalRef?: string;

  /**
   * Source archive name.
   */
  source: 'arxiv';
}

/**
 * OAI-PMH ListRecords response.
 *
 * @internal
 */
interface OaiListRecordsResponse {
  records: ArxivPaper[];
  resumptionToken?: string;
}

/**
 * arXiv integration plugin.
 *
 * @remarks
 * Fetches eprints from arXiv using OAI-PMH protocol and imports them
 * into the Chive AppView cache. Users can claim eprints they authored.
 *
 * Extends ImportingPlugin for standardized import/claiming workflow.
 *
 * @example
 * ```typescript
 * const plugin = new ArxivPlugin();
 * await manager.loadBuiltinPlugin(plugin);
 *
 * // Fetch recent linguistics papers
 * const result = await plugin.runImportCycle({
 *   categories: ['cs.CL'], // Computational Linguistics
 *   fromDate: '2024-01-01',
 * });
 * ```
 *
 * @public
 */
export class ArxivPlugin extends ImportingPlugin implements SearchablePlugin {
  /**
   * Plugin ID.
   */
  readonly id = 'pub.chive.plugin.arxiv';

  /**
   * Import source identifier.
   */
  readonly source = 'arxiv' as const;

  /**
   * Indicates this plugin supports on-demand search.
   *
   * @remarks
   * When true, the plugin can be used for real-time search queries
   * against the external arXiv API rather than bulk import.
   */
  readonly supportsSearch = true as const;

  /**
   * Plugin manifest.
   */
  readonly manifest: IPluginManifest = {
    id: 'pub.chive.plugin.arxiv',
    name: 'arXiv Integration',
    version: '0.1.0',
    description: 'Imports eprints from arXiv via OAI-PMH protocol with claiming support',
    author: 'Aaron Steven White',
    license: 'MIT',
    permissions: {
      network: {
        allowedDomains: ['export.arxiv.org', 'arxiv.org'],
      },
      hooks: ['system.startup'],
      storage: {
        maxSize: 100 * 1024 * 1024, // 100MB for caching
      },
    },
    entrypoint: 'arxiv.js',
  };

  /**
   * OAI-PMH base URL.
   */
  private readonly OAI_BASE_URL = 'http://export.arxiv.org/oai2';

  /**
   * arXiv abstract URL base.
   */
  private readonly ABSTRACT_URL_BASE = 'https://arxiv.org/abs';

  /**
   * arXiv PDF URL base.
   */
  private readonly PDF_URL_BASE = 'https://arxiv.org/pdf';

  /**
   * Cache TTL in seconds (7 days).
   */
  private readonly CACHE_TTL = 86400 * 7;

  /**
   * Default categories to harvest (linguistics-related).
   */
  private readonly DEFAULT_CATEGORIES = ['cs.CL', 'cs.AI', 'cs.LG'];

  /**
   * Initializes the plugin.
   *
   * @remarks
   * Sets up rate limiting for arXiv API requests. No startup bulk import
   * since this plugin uses on-demand search via the search() method.
   */
  protected onInitialize(): Promise<void> {
    // arXiv requires 3 seconds between requests
    this.rateLimitDelayMs = 3000;

    this.logger.info('arXiv plugin initialized (search-based)', {
      searchEndpoint: 'http://export.arxiv.org/api/query',
      rateLimit: `${this.rateLimitDelayMs / 1000}s between requests`,
    });

    return Promise.resolve();
  }

  /**
   * Fetches eprints from arXiv via OAI-PMH.
   *
   * @param options - Fetch options (limit, cursor is resumptionToken)
   * @returns Async iterable of external eprints
   */
  async *fetchEprints(options?: FetchOptions): AsyncIterable<ExternalEprint> {
    const limit = options?.limit ?? 100;
    let resumptionToken = options?.cursor;
    let count = 0;

    // Harvest from default categories
    for (const category of this.DEFAULT_CATEGORIES) {
      if (count >= limit) break;

      let hasMore = true;
      while (hasMore && count < limit) {
        await this.rateLimit();

        const response = await this.fetchOaiRecords(category, resumptionToken);

        for (const paper of response.records) {
          if (count >= limit) break;

          const eprint = this.paperToExternalEprint(paper);
          yield eprint;
          count++;
        }

        resumptionToken = response.resumptionToken;
        hasMore = !!resumptionToken;
      }

      // Reset token for next category
      resumptionToken = undefined;
    }
  }

  /**
   * Fetches records from OAI-PMH endpoint.
   *
   * @param category - arXiv category set
   * @param resumptionToken - Optional resumption token for pagination
   * @returns OAI response with records and optional resumption token
   */
  private async fetchOaiRecords(
    category: string,
    resumptionToken?: string
  ): Promise<OaiListRecordsResponse> {
    let url: string;

    if (resumptionToken) {
      // Resume from token
      url = `${this.OAI_BASE_URL}?verb=ListRecords&resumptionToken=${encodeURIComponent(resumptionToken)}`;
    } else {
      // Initial request with set filter
      url = `${this.OAI_BASE_URL}?verb=ListRecords&metadataPrefix=arXiv&set=${category}`;
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Chive-AppView/1.0 (Academic eprint aggregator; contact@chive.pub)',
        Accept: 'application/xml, text/xml',
      },
    });

    if (!response.ok) {
      throw new PluginError(this.id, 'EXECUTE', `arXiv OAI-PMH error: ${response.status}`);
    }

    const xml = await response.text();
    return this.parseOaiResponse(xml);
  }

  /**
   * Parses OAI-PMH XML response.
   *
   * @param xml - OAI-PMH XML response
   * @returns Parsed records and resumption token
   */
  private parseOaiResponse(xml: string): OaiListRecordsResponse {
    const records: ArxivPaper[] = [];
    let resumptionToken: string | undefined;

    try {
      // Use xmlMode to properly parse OAI-PMH XML
      const document = parseDocument(xml, { xmlMode: true });

      // Find all <record> elements
      const recordElements = findAll((elem) => elem.name === 'record', document.children);

      for (const recordElem of recordElements) {
        const paper = this.parseOaiRecord(recordElem);
        if (paper) {
          records.push(paper);
        }
      }

      // Find resumption token
      const tokenElements = findAll((elem) => elem.name === 'resumptionToken', document.children);
      const tokenElem = tokenElements[0];
      if (tokenElem) {
        const token = textContent(tokenElem).trim();
        if (token) {
          resumptionToken = token;
        }
      }
    } catch (err) {
      this.logger.warn('Error parsing arXiv OAI-PMH response', {
        error: (err as Error).message,
      });
    }

    return { records, resumptionToken };
  }

  /**
   * Parses a single OAI-PMH record element.
   *
   * @param recordElem - Record DOM element
   * @returns ArxivPaper or null if invalid
   */
  private parseOaiRecord(recordElem: unknown): ArxivPaper | null {
    try {
      // Navigate to metadata element
      const metadataElements = findAll(
        (elem) => elem.name === 'metadata',
        getChildren(recordElem as Parameters<typeof getChildren>[0])
      );
      const metadataElem = metadataElements[0];
      if (!metadataElem) return null;

      // Find arXiv element within metadata
      const arxivElements = findAll((elem) => elem.name === 'arXiv', getChildren(metadataElem));
      const arxivElem = arxivElements[0];
      if (!arxivElem) return null;

      const children = getChildren(arxivElem);

      // Extract fields
      let id = '';
      let title = '';
      const authors: string[] = [];
      let abstract = '';
      let submittedDate = '';
      let primaryCategory = '';
      const categories: string[] = [];
      let doi: string | undefined;
      let journalRef: string | undefined;

      for (const child of children) {
        if (!('name' in child)) continue;

        const tagName = (child as { name: string }).name;
        const content = textContent(child).trim();

        switch (tagName) {
          case 'id':
            id = content;
            break;
          case 'title':
            title = content.replace(/\s+/g, ' ');
            break;
          case 'authors': {
            // Parse nested author elements
            const authorElements = findAll((elem) => elem.name === 'author', getChildren(child));
            for (const authorElem of authorElements) {
              const nameElements = findAll(
                (elem) => elem.name === 'keyname' || elem.name === 'forenames',
                getChildren(authorElem)
              );
              const parts: string[] = [];
              for (const nameElem of nameElements) {
                parts.push(textContent(nameElem).trim());
              }
              if (parts.length > 0) {
                authors.push(parts.reverse().join(' '));
              }
            }
            break;
          }
          case 'abstract':
            abstract = content.replace(/\s+/g, ' ');
            break;
          case 'created':
            submittedDate = content;
            break;
          case 'categories':
            categories.push(...content.split(' '));
            if (categories.length > 0) {
              primaryCategory = categories[0] ?? '';
            }
            break;
          case 'doi':
            doi = content;
            break;
          case 'journal-ref':
            journalRef = content;
            break;
        }
      }

      if (!id || !title) {
        return null;
      }

      return {
        id,
        title,
        authors,
        abstract: abstract || undefined,
        url: `${this.ABSTRACT_URL_BASE}/${id}`,
        submittedDate: submittedDate || new Date().toISOString(),
        primaryCategory,
        categories,
        doi,
        journalRef,
        source: 'arxiv',
      };
    } catch (err) {
      this.logger.warn('Error parsing arXiv record', {
        error: (err as Error).message,
      });
      return null;
    }
  }

  /**
   * Converts an arXiv paper to ExternalEprint format.
   */
  private paperToExternalEprint(paper: ArxivPaper): ExternalEprint {
    const authors: ExternalAuthor[] = paper.authors.map((name) => ({ name }));

    return {
      externalId: paper.id,
      url: paper.url,
      title: paper.title,
      abstract: paper.abstract,
      authors,
      publicationDate: new Date(paper.submittedDate),
      doi: paper.doi,
      pdfUrl: this.buildPdfUrl(paper.id) ?? undefined,
      categories: paper.categories,
    };
  }

  /**
   * Builds the canonical URL for an arXiv paper.
   *
   * @param externalId - arXiv ID
   * @returns Full URL to the abstract page
   */
  buildEprintUrl(externalId: string): string {
    return `${this.ABSTRACT_URL_BASE}/${externalId}`;
  }

  /**
   * Builds the PDF URL for an arXiv paper.
   *
   * @param externalId - arXiv ID
   * @returns PDF URL
   */
  override buildPdfUrl(externalId: string): string | null {
    return `${this.PDF_URL_BASE}/${externalId}.pdf`;
  }

  /**
   * Parses external ID from an arXiv URL.
   *
   * @param url - arXiv URL
   * @returns arXiv ID or null
   */
  override parseExternalId(url: string): string | null {
    // Match new format: 2401.12345 or 2401.12345v1
    const newMatch = /arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5}(?:v\d+)?)/.exec(url);
    if (newMatch?.[1]) {
      return newMatch[1];
    }

    // Match old format: hep-th/9901001
    const oldMatch = /arxiv\.org\/(?:abs|pdf)\/([a-z-]+\/\d+)/.exec(url);
    return oldMatch?.[1] ?? null;
  }

  /**
   * Fetches paper details from arXiv API.
   *
   * @param arxivId - arXiv identifier
   * @returns Paper metadata or null
   *
   * @public
   */
  async fetchPaperDetails(arxivId: string): Promise<ArxivPaper | null> {
    // Check cache first
    const cached = await this.cache.get<ArxivPaper>(`arxiv:${arxivId}`);
    if (cached) {
      return cached;
    }

    await this.rateLimit();

    // Use arXiv API for single paper lookup
    const url = `http://export.arxiv.org/api/query?id_list=${arxivId}`;

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Chive-AppView/1.0 (Academic eprint aggregator; contact@chive.pub)',
          Accept: 'application/atom+xml',
        },
      });

      if (!response.ok) {
        this.logger.warn('Failed to fetch arXiv paper', {
          arxivId,
          status: response.status,
        });
        return null;
      }

      const xml = await response.text();
      const paper = this.parseAtomEntry(xml, arxivId);

      if (paper) {
        await this.cache.set(`arxiv:${arxivId}`, paper, this.CACHE_TTL);
      }

      return paper;
    } catch (err) {
      this.logger.warn('Error fetching arXiv paper', {
        arxivId,
        error: (err as Error).message,
      });
      return null;
    }
  }

  /**
   * Searches arXiv for eprints matching the query.
   *
   * @param query - Search parameters (author, title, externalId, doi)
   * @returns Matching eprints from arXiv
   *
   * @throws {PluginError} If the search request fails
   *
   * @remarks
   * Uses the arXiv Atom API for search queries. Supports searching by:
   * - Author name (au: prefix)
   * - Title text (ti: prefix)
   * - arXiv ID (id_list parameter for exact match)
   * - Categories (cat: prefix)
   *
   * Rate limiting: Enforces 3 second delay between requests as required by arXiv.
   *
   * @example
   * ```typescript
   * const results = await arxivPlugin.search({
   *   author: 'Vaswani',
   *   title: 'Attention Is All You Need',
   *   limit: 5,
   * });
   * ```
   *
   * @public
   */
  async search(query: ExternalSearchQuery): Promise<readonly ExternalEprint[]> {
    // Handle exact ID lookup separately (more efficient)
    if (query.externalId) {
      const paper = await this.fetchPaperDetails(query.externalId);
      if (paper) {
        return [this.paperToExternalEprint(paper)];
      }
      return [];
    }

    await this.rateLimit();

    const searchUrl = this.buildSearchUrl(query);

    this.logger.debug('Searching arXiv', {
      query,
      url: searchUrl,
    });

    try {
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Chive-AppView/1.0 (Academic eprint aggregator; contact@chive.pub)',
          Accept: 'application/atom+xml',
        },
      });

      if (!response.ok) {
        throw new PluginError(
          this.id,
          'EXECUTE',
          `arXiv search request failed with status ${response.status}`
        );
      }

      const xml = await response.text();
      const papers = this.parseAtomSearchResponse(xml);

      this.logger.debug('arXiv search completed', {
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

      this.logger.error('arXiv search failed', err as Error, { query });
      this.recordCounter('search_errors');

      throw new PluginError(
        this.id,
        'EXECUTE',
        `arXiv search failed: ${(err as Error).message}`,
        err as Error
      );
    }
  }

  /**
   * Builds the arXiv API search URL from query parameters.
   *
   * @param query - Search query parameters
   * @returns Fully formed arXiv API URL
   *
   * @remarks
   * arXiv search query syntax:
   * - `au:name` for author search
   * - `ti:text` for title search
   * - `cat:category` for category filter
   * - Terms are combined with `+AND+` operator
   *
   * @internal
   */
  private buildSearchUrl(query: ExternalSearchQuery): string {
    const searchTerms: string[] = [];

    if (query.author) {
      // Escape special characters and wrap multi-word names
      const authorQuery = query.author.includes(' ') ? `"${query.author}"` : query.author;
      searchTerms.push(`au:${encodeURIComponent(authorQuery)}`);
    }

    if (query.title) {
      // Search title field with the query text
      searchTerms.push(`ti:${encodeURIComponent(query.title)}`);
    }

    if (query.categories && query.categories.length > 0) {
      // Filter by categories (OR between categories)
      const catTerms = query.categories.map((cat) => `cat:${encodeURIComponent(cat)}`);
      searchTerms.push(`(${catTerms.join('+OR+')})`);
    }

    if (query.doi) {
      // DOI search uses all: prefix since arXiv doesn't have specific doi: field
      searchTerms.push(`all:${encodeURIComponent(query.doi)}`);
    }

    const searchQuery = searchTerms.join('+AND+');
    const maxResults = query.limit ?? 10;

    // Sort by submission date, newest first
    return `http://export.arxiv.org/api/query?search_query=${searchQuery}&max_results=${maxResults}&sortBy=submittedDate&sortOrder=descending`;
  }

  /**
   * Parses arXiv Atom API search response with multiple entries.
   *
   * @param xml - Atom XML response
   * @returns Array of ArxivPaper objects
   *
   * @internal
   */
  private parseAtomSearchResponse(xml: string): ArxivPaper[] {
    const papers: ArxivPaper[] = [];

    try {
      const document = parseDocument(xml, { xmlMode: true });

      // Find all entry elements
      const entryElements = findAll((elem) => elem.name === 'entry', document.children);

      for (const entryElem of entryElements) {
        const paper = this.parseSearchEntry(entryElem);
        if (paper) {
          papers.push(paper);
        }
      }
    } catch (err) {
      this.logger.warn('Error parsing arXiv search response', {
        error: (err as Error).message,
      });
    }

    return papers;
  }

  /**
   * Parses a single entry element from an Atom search response.
   *
   * @param entryElem - Entry DOM element
   * @returns ArxivPaper or null if parsing fails
   *
   * @internal
   */
  private parseSearchEntry(entryElem: unknown): ArxivPaper | null {
    try {
      const children = getChildren(entryElem as Parameters<typeof getChildren>[0]);

      let id = '';
      let title = '';
      const authors: string[] = [];
      let abstract = '';
      let submittedDate = '';
      const categories: string[] = [];
      let doi: string | undefined;

      for (const child of children) {
        if (!('name' in child)) continue;

        const tagName = (child as { name: string }).name;
        const content = textContent(child).trim();

        switch (tagName) {
          case 'id': {
            // Extract arXiv ID from full URL: http://arxiv.org/abs/2401.12345v1
            const idMatch = /arxiv\.org\/abs\/(.+)$/.exec(content);
            id = idMatch?.[1] ?? content;
            // Remove version suffix for canonical ID
            id = id.replace(/v\d+$/, '');
            break;
          }
          case 'title':
            title = content.replace(/\s+/g, ' ');
            break;
          case 'author': {
            const nameElem = findAll((e) => e.name === 'name', getChildren(child))[0];
            if (nameElem) {
              authors.push(textContent(nameElem).trim());
            }
            break;
          }
          case 'summary':
            abstract = content.replace(/\s+/g, ' ');
            break;
          case 'published':
            submittedDate = content;
            break;
          case 'category': {
            // Extract term attribute from category element
            const attribs = (child as { attribs?: Record<string, string> }).attribs;
            if (attribs?.term) {
              categories.push(attribs.term);
            }
            break;
          }
          case 'arxiv:doi':
            doi = content;
            break;
        }
      }

      if (!id || !title) {
        return null;
      }

      return {
        id,
        title,
        authors,
        abstract: abstract || undefined,
        url: `${this.ABSTRACT_URL_BASE}/${id}`,
        submittedDate: submittedDate || new Date().toISOString(),
        primaryCategory: categories[0] ?? '',
        categories,
        doi,
        source: 'arxiv',
      };
    } catch (err) {
      this.logger.warn('Error parsing arXiv search entry', {
        error: (err as Error).message,
      });
      return null;
    }
  }

  /**
   * Parses arXiv Atom API response for a single entry.
   *
   * @param xml - Atom XML response
   * @param arxivId - Expected arXiv ID
   * @returns ArxivPaper or null
   */
  private parseAtomEntry(xml: string, arxivId: string): ArxivPaper | null {
    try {
      // Use xmlMode to properly parse Atom XML
      const document = parseDocument(xml, { xmlMode: true });

      // Find entry element
      const entryElements = findAll((elem) => elem.name === 'entry', document.children);
      const entryElem = entryElements[0];
      if (!entryElem) return null;

      const children = getChildren(entryElem);

      let title = '';
      const authors: string[] = [];
      let abstract = '';
      let submittedDate = '';
      const categories: string[] = [];
      let doi: string | undefined;

      for (const child of children) {
        if (!('name' in child)) continue;

        const tagName = (child as { name: string }).name;
        const content = textContent(child).trim();

        switch (tagName) {
          case 'title':
            title = content.replace(/\s+/g, ' ');
            break;
          case 'author': {
            const nameElem = findAll((e) => e.name === 'name', getChildren(child))[0];
            if (nameElem) {
              authors.push(textContent(nameElem).trim());
            }
            break;
          }
          case 'summary':
            abstract = content.replace(/\s+/g, ' ');
            break;
          case 'published':
            submittedDate = content;
            break;
          case 'category':
            // Categories have term attribute
            break;
          case 'arxiv:doi':
            doi = content;
            break;
        }
      }

      if (!title) {
        return null;
      }

      return {
        id: arxivId,
        title,
        authors,
        abstract: abstract || undefined,
        url: `${this.ABSTRACT_URL_BASE}/${arxivId}`,
        submittedDate: submittedDate || new Date().toISOString(),
        primaryCategory: categories[0] ?? '',
        categories,
        doi,
        source: 'arxiv',
      };
    } catch (err) {
      this.logger.warn('Error parsing arXiv Atom entry', {
        arxivId,
        error: (err as Error).message,
      });
      return null;
    }
  }
}

export default ArxivPlugin;
