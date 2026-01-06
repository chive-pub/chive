/**
 * LingBuzz integration plugin for linguistics preprints.
 *
 * @remarks
 * Imports linguistics preprints from LingBuzz (https://lingbuzz.net).
 *
 * Since LingBuzz has no official API, this plugin uses a hybrid approach:
 * - Primary: Unofficial RSS feed from Feedburner for recent papers
 * - Secondary: Respectful web scraping for additional metadata
 *
 * Rate limiting: Maximum 1 request per 10 seconds for scraping
 *
 * ATProto Compliance:
 * - All imported data is AppView cache (ephemeral, rebuildable)
 * - Never writes to user PDSes
 * - Users claim preprints by creating records in THEIR PDS
 *
 * @packageDocumentation
 * @public
 * @since 0.1.0
 */

import { findAll, textContent, getAttributeValue, getChildren } from 'domutils';
import { parseDocument } from 'htmlparser2';

import { PluginError } from '../../types/errors.js';
import type {
  ExternalPreprint,
  FetchOptions,
  IPluginManifest,
  IPluginContext,
} from '../../types/interfaces/plugin.interface.js';
import { ImportingPlugin } from '../core/importing-plugin.js';
import type { IExternalPaperSearch, ExternalPaperDocument } from '../core/paper-search.js';
import { createPaperId } from '../core/paper-search.js';

/**
 * LingBuzz paper metadata.
 *
 * @public
 */
export interface LingBuzzPaper {
  /**
   * Unique paper identifier (e.g., "007123").
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
   * Paper abstract (if available from scraping).
   */
  abstract?: string;

  /**
   * URL to the paper.
   */
  url: string;

  /**
   * Publication date from RSS feed.
   */
  pubDate: string;

  /**
   * Categories/keywords (if available).
   */
  categories?: readonly string[];

  /**
   * Source archive name.
   */
  source: 'lingbuzz';
}

/**
 * Parsed RSS item from Feedburner.
 *
 * @internal
 */
interface RssItem {
  title: string;
  link: string;
  pubDate: string;
  author?: string;
  description?: string;
  categories?: readonly string[];
}

/**
 * LingBuzz integration plugin.
 *
 * @remarks
 * Fetches linguistics preprints from LingBuzz via RSS feed and imports them
 * into the Chive AppView cache. Users can claim preprints they authored.
 *
 * Extends ImportingPlugin for standardized import/claiming workflow.
 *
 * @example
 * ```typescript
 * const plugin = new LingBuzzPlugin();
 * await manager.loadBuiltinPlugin(plugin);
 * ```
 *
 * @public
 */
export class LingBuzzPlugin extends ImportingPlugin {
  /**
   * Plugin ID.
   */
  readonly id = 'pub.chive.plugin.lingbuzz';

  /**
   * Import source identifier.
   */
  readonly source = 'lingbuzz' as const;

  /**
   * Indicates this plugin does NOT support on-demand search.
   *
   * @remarks
   * LingBuzz has no search API, so this plugin requires periodic bulk
   * import via RSS feed and web scraping. Use ImportScheduler to
   * schedule periodic imports.
   */
  readonly supportsSearch = false as const;

  /**
   * Plugin manifest.
   */
  readonly manifest: IPluginManifest = {
    id: 'pub.chive.plugin.lingbuzz',
    name: 'LingBuzz Integration',
    version: '0.1.0',
    description: 'Imports linguistics preprints from LingBuzz via RSS feed with claiming support',
    author: 'Aaron Steven White',
    license: 'MIT',
    permissions: {
      network: {
        allowedDomains: ['ling.auf.net', 'lingbuzz.net', 'feeds.feedburner.com'],
      },
      hooks: ['system.startup', 'import.updated'],
      storage: {
        maxSize: 20 * 1024 * 1024, // 20MB for caching
      },
    },
    entrypoint: 'lingbuzz.js',
  };

  /**
   * RSS feed URL (unofficial Feedburner feed).
   */
  private readonly RSS_FEED_URL = 'https://feeds.feedburner.com/LingBuzz';

  /**
   * Base URL for LingBuzz papers.
   */
  private readonly BASE_URL = 'https://ling.auf.net';

  /**
   * Cache TTL in seconds (7 days).
   */
  private readonly CACHE_TTL = 86400 * 7;

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
    // Set rate limit to 10 seconds between scraping requests
    this.rateLimitDelayMs = 10000;

    this.context.eventBus.on('system.startup', (..._args: readonly unknown[]) => {
      void this.handleStartup();
    });

    this.logger.info('LingBuzz plugin initialized', {
      note: 'Using unofficial RSS feed + respectful web scraping',
      rateLimit: `${this.rateLimitDelayMs / 1000}s between scraping requests`,
    });

    return Promise.resolve();
  }

  /**
   * Handles system startup event.
   */
  private async handleStartup(): Promise<void> {
    this.logger.info('Running LingBuzz import cycle on startup');

    try {
      const result = await this.runImportCycle();

      this.logger.info('LingBuzz startup import completed', {
        totalFetched: result.totalFetched,
        newImports: result.newImports,
        updated: result.updated,
        errors: result.errors,
      });
    } catch (err) {
      this.logger.error('Failed to run LingBuzz import cycle', err as Error);
      this.recordCounter('import_cycle_errors');
    }
  }

  /**
   * Fetches preprints from LingBuzz RSS feed.
   *
   * @param options - Fetch options (limit, cursor)
   * @returns Async iterable of external preprints
   */
  async *fetchPreprints(options?: FetchOptions): AsyncIterable<ExternalPreprint> {
    // Apply rate limiting for respectful crawling
    await this.rateLimit();

    const response = await fetch(this.RSS_FEED_URL, {
      headers: {
        'User-Agent': 'Chive-AppView/1.0 (Academic preprint aggregator; contact@chive.pub)',
        Accept: 'application/rss+xml, application/xml, text/xml',
      },
    });

    if (!response.ok) {
      throw new PluginError(this.id, 'EXECUTE', `LingBuzz RSS feed error: ${response.status}`);
    }

    const xml = await response.text();
    const rssItems = this.parseRssFeed(xml);

    let count = 0;
    const limit = options?.limit ?? 100;

    for (const item of rssItems) {
      if (count >= limit) break;

      const paper = this.rssItemToPaper(item);
      if (paper) {
        // Convert to ExternalPreprint format
        const preprint = this.paperToExternalPreprint(paper);
        yield preprint;
        count++;
      }
    }
  }

  /**
   * Builds the canonical URL for a LingBuzz paper.
   *
   * @param externalId - LingBuzz paper ID
   * @returns Full URL to the paper
   */
  buildPreprintUrl(externalId: string): string {
    return `${this.BASE_URL}/lingbuzz/${externalId}`;
  }

  /**
   * Builds the PDF URL for a LingBuzz paper.
   *
   * @param externalId - LingBuzz paper ID
   * @returns PDF URL
   */
  override buildPdfUrl(externalId: string): string | null {
    return `${this.BASE_URL}/lingbuzz/${externalId}/current.pdf`;
  }

  /**
   * Parses external ID from a LingBuzz URL.
   *
   * @param url - LingBuzz URL
   * @returns Paper ID or null
   */
  override parseExternalId(url: string): string | null {
    const match = /lingbuzz\/(\d+)/.exec(url);
    return match?.[1] ?? null;
  }

  /**
   * Converts a LingBuzz paper to ExternalPreprint format.
   */
  private paperToExternalPreprint(paper: LingBuzzPaper): ExternalPreprint {
    return {
      externalId: paper.id,
      url: paper.url,
      title: paper.title,
      abstract: paper.abstract,
      authors: paper.authors.map((name) => ({ name })),
      publicationDate: new Date(paper.pubDate),
      categories: paper.categories,
      pdfUrl: this.buildPdfUrl(paper.id) ?? undefined,
    };
  }

  /**
   * Parses RSS feed XML to extract items.
   *
   * @param xml - RSS feed XML content
   * @returns Array of parsed RSS items
   */
  private parseRssFeed(xml: string): RssItem[] {
    const items: RssItem[] = [];

    try {
      // Use xmlMode to properly parse RSS XML (otherwise <link> is treated as void element)
      const document = parseDocument(xml, { xmlMode: true });

      // Find all <item> elements
      const itemElements = findAll((elem) => elem.name === 'item', document.children);

      for (const itemElem of itemElements) {
        const children = getChildren(itemElem);

        let title = '';
        let link = '';
        let pubDate = '';
        let author: string | undefined;
        let description: string | undefined;
        const categories: string[] = [];

        for (const child of children) {
          if (!('name' in child)) continue;

          const tagName = child.name;
          const content = textContent(child).trim();

          switch (tagName) {
            case 'title':
              title = content;
              break;
            case 'link':
              link = content;
              break;
            case 'pubDate':
              pubDate = content;
              break;
            case 'author':
            case 'dc:creator':
              author = content;
              break;
            case 'description':
              // RSS description contains the abstract
              if (content) {
                description = content;
              }
              break;
            case 'category':
              if (content) {
                categories.push(content);
              }
              break;
          }
        }

        if (title && link) {
          items.push({
            title,
            link,
            pubDate: pubDate || new Date().toISOString(),
            author,
            description,
            categories: categories.length > 0 ? categories : undefined,
          });
        }
      }
    } catch (err) {
      this.logger.warn('Error parsing LingBuzz RSS feed', {
        error: (err as Error).message,
      });
    }

    return items;
  }

  /**
   * Converts an RSS item to a LingBuzz paper.
   *
   * @param item - RSS item
   * @returns LingBuzz paper or null if invalid
   */
  private rssItemToPaper(item: RssItem): LingBuzzPaper | null {
    // Extract paper ID from URL (e.g., "https://ling.auf.net/lingbuzz/007123")
    const idMatch = /lingbuzz\/(\d+)/.exec(item.link);
    const id = idMatch?.[1];
    if (!id) {
      return null;
    }

    // Parse authors from title if present (common format: "Title, by Author1 and Author2")
    let title = item.title;
    let authors: string[] = [];

    if (item.author) {
      // Author from RSS dc:creator field - format is "Lastname, Firstname; Lastname, Firstname"
      // Multiple authors are separated by semicolons, not commas
      authors = item.author.split(/;\s*/).map((a) => a.trim());
    } else {
      // Try to extract from title
      const byIndex = title.lastIndexOf(', by ');
      if (byIndex !== -1) {
        const authorPart = title.slice(byIndex + 5);
        title = title.slice(0, byIndex);
        authors = authorPart.split(/,\s*and\s*|,\s*/).map((a) => a.trim());
      }
    }

    return {
      id,
      title,
      authors,
      abstract: item.description,
      url: item.link,
      pubDate: item.pubDate,
      categories: item.categories,
      source: 'lingbuzz',
    };
  }

  /**
   * Fetches additional metadata for a paper via web scraping.
   *
   * @remarks
   * This method is rate-limited to be respectful to the server.
   * Only call when additional metadata (abstract, etc.) is needed.
   *
   * @param paperId - LingBuzz paper ID
   * @returns Enhanced paper metadata or null if scraping fails
   *
   * @public
   */
  async fetchPaperDetails(paperId: string): Promise<LingBuzzPaper | null> {
    // Check cache first
    const cached = await this.cache.get<LingBuzzPaper>(`lingbuzz:detail:${paperId}`);
    if (cached) {
      return cached;
    }

    await this.rateLimit();

    const url = `${this.BASE_URL}/lingbuzz/${paperId}`;

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Chive-AppView/1.0 (Academic preprint aggregator; contact@chive.pub)',
          Accept: 'text/html',
        },
      });

      if (!response.ok) {
        this.logger.warn('Failed to fetch LingBuzz paper', {
          paperId,
          status: response.status,
        });
        return null;
      }

      const html = await response.text();
      const paper = this.parsePaperPage(paperId, url, html);

      if (paper) {
        await this.cache.set(`lingbuzz:detail:${paperId}`, paper, this.CACHE_TTL);
        // Index for search (async, non-blocking)
        void this.indexPaper(paper);
      }

      return paper;
    } catch (err) {
      this.logger.warn('Error scraping LingBuzz paper', {
        paperId,
        error: (err as Error).message,
      });
      return null;
    }
  }

  /**
   * Parses a paper detail page to extract metadata.
   *
   * @remarks
   * LingBuzz page structure (as of 2025):
   * - Title in first linked heading
   * - Authors linked to `/_person/[name]` profiles
   * - Abstract is a paragraph after metadata section
   * - Keywords appear as comma-separated text labeled "Keywords:"
   * - Publication date appears as "Month YYYY"
   *
   * @param paperId - Paper ID
   * @param url - Paper URL
   * @param html - HTML content
   * @returns Parsed paper or null
   */
  private parsePaperPage(paperId: string, url: string, html: string): LingBuzzPaper | null {
    try {
      const document = parseDocument(html);

      // Find title - usually the first linked heading or the text that links to this paper
      let title = '';
      const allLinks = findAll((elem) => elem.name === 'a', document.children);
      for (const link of allLinks) {
        const href = getAttributeValue(link, 'href');
        // Find the link that points to this paper (self-reference) and get title
        if (href?.includes(`/lingbuzz/${paperId}`)) {
          const linkText = textContent(link).trim();
          // The title link usually has the full title
          if (linkText.length > 10) {
            title = linkText;
            break;
          }
        }
      }

      // Fallback to h1 if no title found
      if (!title) {
        const h1Elements = findAll((elem) => elem.name === 'h1', document.children);
        const firstH1 = h1Elements[0];
        if (firstH1) {
          title = textContent(firstH1).trim();
        }
      }

      // Find authors - linked to paper URL with query params (e.g., /lingbuzz/006789?_s=...)
      // or to /_person/ profiles (older format)
      const authors: string[] = [];
      const authorLinks = findAll((elem) => {
        if (elem.name !== 'a') return false;
        const href = getAttributeValue(elem, 'href');
        if (!href) return false;
        // Author links point to the same paper with query params, or to /_person/
        return href.includes(`/lingbuzz/${paperId}?`) || href.includes('/_person/');
      }, document.children);
      for (const link of authorLinks) {
        const authorName = textContent(link).trim();
        // Exclude short names (likely navigation) and the paper title itself
        if (
          authorName &&
          authorName.length >= 3 &&
          !authors.includes(authorName) &&
          authorName !== title
        ) {
          authors.push(authorName);
        }
      }

      // Find abstract - look for the largest paragraph that's not metadata
      let abstract: string | undefined;
      const paragraphs = findAll((elem) => elem.name === 'p', document.children);
      for (const p of paragraphs) {
        const text = textContent(p).trim();
        // Abstract is usually a substantial paragraph (> 100 chars) without metadata markers
        if (
          text.length > 100 &&
          !text.startsWith('Format:') &&
          !text.startsWith('Reference:') &&
          !text.startsWith('Published') &&
          !text.startsWith('Keywords:') &&
          !text.startsWith('Downloaded')
        ) {
          abstract = text;
          break;
        }
      }

      // Find keywords - look for "Keywords:" text followed by comma-separated terms
      const categories: string[] = [];
      const bodyText = textContent(document).trim();
      const keywordsMatch = /Keywords:\s*([^\n]+)/i.exec(bodyText);
      if (keywordsMatch?.[1]) {
        const keywordText = keywordsMatch[1];
        // Split by comma, clean up
        const keywords = keywordText
          .split(',')
          .map((k) => k.trim())
          .filter((k) => k.length > 0);
        categories.push(...keywords);
      }

      // Extract publication date if available (format: "Month YYYY")
      let pubDate = new Date().toISOString();
      const dateMatch =
        /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i.exec(
          bodyText
        );
      if (dateMatch) {
        const monthYear = `${dateMatch[1]} ${dateMatch[2]}`;
        const parsed = new Date(monthYear);
        if (!isNaN(parsed.getTime())) {
          pubDate = parsed.toISOString();
        }
      }

      if (!title) {
        return null;
      }

      return {
        id: paperId,
        title,
        authors,
        abstract,
        url,
        pubDate,
        categories: categories.length > 0 ? categories : undefined,
        source: 'lingbuzz',
      };
    } catch (err) {
      this.logger.warn('Error parsing LingBuzz paper page', {
        paperId,
        error: (err as Error).message,
      });
      return null;
    }
  }

  /**
   * Gets a cached paper by ID.
   *
   * @param id - Paper ID
   * @returns Paper metadata or null
   *
   * @public
   */
  async getPaper(id: string): Promise<LingBuzzPaper | null> {
    return this.cache.get<LingBuzzPaper>(`lingbuzz:${id}`);
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
  async searchPapers(query: string, limit = 20): Promise<readonly LingBuzzPaper[]> {
    if (!this.paperSearch) {
      this.logger.debug('Paper search not available, returning empty results', { query });
      return [];
    }

    try {
      const results = await this.paperSearch.search({
        q: query,
        sources: ['lingbuzz'],
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
  private async indexPaper(paper: LingBuzzPaper): Promise<void> {
    if (!this.paperSearch) {
      return;
    }

    const doc: ExternalPaperDocument = {
      id: createPaperId('lingbuzz', paper.id),
      source: 'lingbuzz',
      externalId: paper.id,
      title: paper.title,
      authors: paper.authors,
      abstract: paper.abstract,
      url: paper.url,
      pdfUrl: this.buildPdfUrl(paper.id) ?? undefined,
      publicationDate: new Date(paper.pubDate),
      categories: paper.categories,
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
   * Converts an external paper document to LingBuzz paper format.
   *
   * @param doc - External paper document
   * @returns LingBuzz paper
   */
  private externalDocumentToPaper(doc: ExternalPaperDocument): LingBuzzPaper {
    return {
      id: doc.externalId,
      title: doc.title,
      authors: [...doc.authors],
      abstract: doc.abstract,
      url: doc.url,
      pubDate: doc.publicationDate?.toISOString() ?? new Date().toISOString(),
      categories: doc.categories ? [...doc.categories] : undefined,
      source: 'lingbuzz',
    };
  }
}

export default LingBuzzPlugin;
