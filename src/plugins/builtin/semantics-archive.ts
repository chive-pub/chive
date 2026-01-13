/**
 * Semantics Archive integration plugin.
 *
 * @remarks
 * Imports linguistics eprints from Semantics Archive (https://semanticsarchive.net).
 *
 * Since Semantics Archive has no official API, this plugin:
 * - Scrapes the recent papers page with respectful rate limiting
 * - Extracts metadata from paper listing pages
 * - Caches metadata to minimize external requests
 *
 * Rate limiting: Maximum 1 request per 5 seconds
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

import { findAll, textContent, getAttributeValue } from 'domutils';
import { parseDocument } from 'htmlparser2';

import { PluginError } from '../../types/errors.js';
import type {
  ExternalEprint,
  FetchOptions,
  IPluginManifest,
  IPluginContext,
} from '../../types/interfaces/plugin.interface.js';
import { ImportingPlugin } from '../core/importing-plugin.js';
import type { IExternalPaperSearch, ExternalPaperDocument } from '../core/paper-search.js';
import { createPaperId } from '../core/paper-search.js';

/**
 * Semantics Archive paper metadata.
 *
 * @public
 */
export interface SemanticsArchivePaper {
  /**
   * Unique paper identifier.
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
   * Paper abstract (if available).
   */
  abstract?: string;

  /**
   * URL to the paper.
   */
  url: string;

  /**
   * Date paper was added.
   */
  addedDate: string;

  /**
   * Keywords (if available).
   */
  keywords?: readonly string[];

  /**
   * Source archive name.
   */
  source: 'semanticsarchive';
}

/**
 * Semantics Archive integration plugin.
 *
 * @remarks
 * Fetches linguistics eprints from Semantics Archive and imports them
 * into the Chive AppView cache. Users can claim eprints they authored.
 *
 * Extends ImportingPlugin for standardized import/claiming workflow.
 *
 * @example
 * ```typescript
 * const plugin = new SemanticsArchivePlugin();
 * await manager.loadBuiltinPlugin(plugin);
 * ```
 *
 * @public
 */
export class SemanticsArchivePlugin extends ImportingPlugin {
  /**
   * Plugin ID.
   */
  readonly id = 'pub.chive.plugin.semanticsarchive';

  /**
   * Import source identifier.
   */
  readonly source = 'semanticsarchive' as const;

  /**
   * Indicates this plugin does NOT support on-demand search.
   *
   * @remarks
   * Semantics Archive has no search API, so this plugin requires periodic
   * bulk import via web scraping. Use ImportScheduler to schedule
   * periodic imports.
   */
  readonly supportsSearch = false as const;

  /**
   * Plugin manifest.
   */
  readonly manifest: IPluginManifest = {
    id: 'pub.chive.plugin.semanticsarchive',
    name: 'Semantics Archive Integration',
    version: '0.1.0',
    description: 'Imports linguistics eprints from Semantics Archive with claiming support',
    author: 'Aaron Steven White',
    license: 'MIT',
    permissions: {
      network: {
        allowedDomains: ['semanticsarchive.net'],
      },
      hooks: ['system.startup', 'import.created', 'import.updated'],
      storage: {
        maxSize: 20 * 1024 * 1024, // 20MB for caching
      },
    },
    entrypoint: 'semantics-archive.js',
  };

  /**
   * Base URL for Semantics Archive.
   */
  private readonly BASE_URL = 'https://semanticsarchive.net';

  /**
   * External paper search service (optional).
   *
   * @remarks
   * If provided via context.config.paperSearch, papers will be indexed
   * for full-text search.
   */
  private paperSearch?: IExternalPaperSearch;

  /**
   * Initializes the plugin.
   *
   * @param context - Plugin context with dependencies
   */
  override async initialize(context: IPluginContext): Promise<void> {
    await super.initialize(context);

    // Get paper search service from context if available
    const paperSearchService = context.config.paperSearch as IExternalPaperSearch | undefined;
    if (paperSearchService) {
      this.paperSearch = paperSearchService;
      this.logger.info('Paper search service configured');
    }
  }

  /**
   * Initializes the plugin after base setup.
   */
  protected onInitialize(): Promise<void> {
    // Set rate limit to 5 seconds between requests
    this.rateLimitDelayMs = 5000;

    this.context.eventBus.on('system.startup', (..._args: readonly unknown[]) => {
      void this.handleStartup();
    });

    this.logger.info('Semantics Archive plugin initialized', {
      note: 'No official API - using respectful web scraping',
      rateLimit: `${this.rateLimitDelayMs / 1000}s between requests`,
    });

    return Promise.resolve();
  }

  /**
   * Handles system startup event.
   */
  private async handleStartup(): Promise<void> {
    this.logger.info('Running Semantics Archive import cycle on startup');

    try {
      const result = await this.runImportCycle();

      this.logger.info('Semantics Archive startup import completed', {
        totalFetched: result.totalFetched,
        newImports: result.newImports,
        updated: result.updated,
        errors: result.errors,
      });
    } catch (err) {
      this.logger.error('Failed to run Semantics Archive import cycle', err as Error);
      this.recordCounter('import_cycle_errors');
    }
  }

  /**
   * Fetches eprints from Semantics Archive.
   *
   * @param options - Fetch options (limit, cursor)
   * @returns Async iterable of external eprints
   */
  async *fetchEprints(options?: FetchOptions): AsyncIterable<ExternalEprint> {
    await this.rateLimit();

    const response = await fetch(`${this.BASE_URL}/cgi-bin/browse.pl`, {
      headers: {
        'User-Agent': 'Chive-AppView/1.0 (Academic eprint aggregator; contact@chive.pub)',
        Accept: 'text/html',
      },
    });

    if (!response.ok) {
      throw new PluginError(this.id, 'EXECUTE', `Semantics Archive error: ${response.status}`);
    }

    const html = await response.text();
    const papers = this.parseRecentPapersHtml(html);

    let count = 0;
    const limit = options?.limit ?? 100;

    for (const paper of papers) {
      if (count >= limit) break;

      // Convert to ExternalEprint format
      const eprint = this.paperToExternalEprint(paper);
      yield eprint;
      count++;
    }
  }

  /**
   * Builds the canonical URL for a Semantics Archive paper.
   *
   * @param externalId - Paper ID
   * @returns Full URL to the paper
   */
  buildEprintUrl(externalId: string): string {
    return `${this.BASE_URL}/Archive/${externalId}`;
  }

  /**
   * Builds the PDF URL for a Semantics Archive paper.
   *
   * @param externalId - Paper ID
   * @returns Full URL to the PDF
   */
  override buildPdfUrl(externalId: string): string | null {
    return `${this.BASE_URL}/Archive/${externalId}/paper.pdf`;
  }

  /**
   * Parses external ID from a Semantics Archive URL.
   *
   * @param url - Semantics Archive URL
   * @returns Paper ID or null
   */
  override parseExternalId(url: string): string | null {
    const match = /\/Archive\/([^/]+)/.exec(url);
    return match?.[1] ?? null;
  }

  /**
   * Converts a Semantics Archive paper to ExternalEprint format.
   */
  private paperToExternalEprint(paper: SemanticsArchivePaper): ExternalEprint {
    return {
      externalId: paper.id,
      url: paper.url,
      title: paper.title,
      abstract: paper.abstract,
      authors: paper.authors.map((name) => ({ name })),
      publicationDate: new Date(paper.addedDate),
      categories: paper.keywords,
    };
  }

  /**
   * Parses HTML to extract paper metadata.
   *
   * @remarks
   * Semantics Archive browse page format (as of 2025):
   * ```
   * 2024 08 26 Author Name(s) <a href="/Archive/XYZ123">Paper Title</a>
   * ```
   * - Date in "YYYY MM DD" format (space-separated)
   * - Author names as plain text before the link
   * - Paper title in the anchor text
   *
   * @param html - HTML content
   * @returns Array of paper metadata
   */
  private parseRecentPapersHtml(html: string): SemanticsArchivePaper[] {
    const papers: SemanticsArchivePaper[] = [];

    try {
      const document = parseDocument(html);

      // Find all links to papers
      const links = findAll((elem) => {
        return (
          elem.name === 'a' && (getAttributeValue(elem, 'href')?.includes('/Archive/') ?? false)
        );
      }, document.children);

      // Get the full text content to help with context extraction
      const fullText = textContent(document);
      const lines = fullText
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      for (const link of links) {
        const href = getAttributeValue(link, 'href');
        const title = textContent(link).trim();

        if (!href || !title || title.length < 5) {
          continue;
        }

        // Extract paper ID from URL
        const idMatch = /\/Archive\/([^/]+)/.exec(href);
        const id = idMatch?.[1];
        if (!id) {
          continue;
        }

        // Skip navigation links
        if (
          ['browse', 'search', 'submit', 'about', 'instructions', 'Archive'].includes(
            id.toLowerCase()
          ) ||
          id === ''
        ) {
          continue;
        }

        // Find the line that contains this paper's title
        let addedDate = new Date().toISOString();
        let authors: string[] = [];

        for (const line of lines) {
          // Check if this line contains the title
          if (!line.includes(title)) {
            continue;
          }

          // Try to parse date at the start: "YYYY MM DD"
          const dateMatch = /^(\d{4})\s+(\d{2})\s+(\d{2})\s+(.+)$/.exec(line);
          if (dateMatch) {
            const [, year, month, day, rest] = dateMatch;
            const parsedDate = new Date(`${year}-${month}-${day}`);
            if (!isNaN(parsedDate.getTime())) {
              addedDate = parsedDate.toISOString();
            }

            // The "rest" contains author names followed by the title
            // Find where the title starts and extract authors before it
            if (rest) {
              const titleIndex = rest.indexOf(title);
              if (titleIndex > 0) {
                const authorPart = rest.slice(0, titleIndex).trim();
                // Split authors by common separators
                authors = authorPart
                  .split(/,\s*and\s*|;\s*|,\s*/)
                  .map((a) => a.trim())
                  .filter((a) => a.length > 0 && !a.startsWith('[') && !a.startsWith('('));
              }
            }
          }
          break;
        }

        papers.push({
          id,
          title,
          authors,
          url: href.startsWith('http')
            ? href
            : `${this.BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`,
          addedDate,
          source: 'semanticsarchive',
        });
      }
    } catch (err) {
      this.logger.warn('Error parsing Semantics Archive HTML', {
        error: (err as Error).message,
      });
    }

    return papers;
  }

  /**
   * Gets a cached paper by ID.
   *
   * @param id - Paper ID
   * @returns Paper metadata or null
   *
   * @public
   */
  async getPaper(id: string): Promise<SemanticsArchivePaper | null> {
    return this.cache.get<SemanticsArchivePaper>(`semarch:${id}`);
  }

  /**
   * Searches papers using the external paper search service.
   *
   * @param query - Search query
   * @param limit - Maximum number of results
   * @returns Matching papers
   *
   * @public
   */
  async searchPapers(query: string, limit = 20): Promise<readonly SemanticsArchivePaper[]> {
    if (!this.paperSearch) {
      this.logger.debug('Paper search not available, returning empty results', { query });
      return [];
    }

    try {
      const results = await this.paperSearch.search({
        q: query,
        sources: ['semanticsarchive'],
        limit,
      });

      return results.hits.map((hit) => this.externalDocumentToPaper(hit.paper));
    } catch (error) {
      this.logger.warn('Paper search failed', {
        query,
        error: (error as Error).message,
      });
      return [];
    }
  }

  /**
   * Indexes a paper for search.
   *
   * @param paper - Paper to index
   *
   * @internal
   */
  async indexPaper(paper: SemanticsArchivePaper): Promise<void> {
    if (!this.paperSearch) {
      return;
    }

    const doc: ExternalPaperDocument = {
      id: createPaperId('semanticsarchive', paper.id),
      source: 'semanticsarchive',
      externalId: paper.id,
      title: paper.title,
      authors: paper.authors,
      abstract: paper.abstract,
      url: paper.url,
      pdfUrl: this.buildPdfUrl(paper.id) ?? undefined,
      publicationDate: new Date(paper.addedDate),
      categories: paper.keywords,
      indexedAt: new Date(),
    };

    try {
      await this.paperSearch.indexPaper(doc);
    } catch (error) {
      this.logger.warn('Failed to index paper', {
        paperId: paper.id,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Converts an external paper document to Semantics Archive paper format.
   *
   * @param doc - External paper document
   * @returns Semantics Archive paper
   */
  private externalDocumentToPaper(doc: ExternalPaperDocument): SemanticsArchivePaper {
    return {
      id: doc.externalId,
      title: doc.title,
      authors: [...doc.authors],
      abstract: doc.abstract,
      url: doc.url,
      addedDate: doc.publicationDate?.toISOString() ?? new Date().toISOString(),
      keywords: doc.categories ? [...doc.categories] : undefined,
      source: 'semanticsarchive',
    };
  }
}

export default SemanticsArchivePlugin;
