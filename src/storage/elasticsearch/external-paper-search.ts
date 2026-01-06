/**
 * Elasticsearch-backed external paper search service.
 *
 * @remarks
 * Provides search functionality for papers imported from external archives
 * like LingBuzz, Semantics Archive, arXiv, etc.
 *
 * @packageDocumentation
 * @public
 */

import type { Client } from '@elastic/elasticsearch';

import type {
  ExternalPaperDocument,
  ExternalPaperSearchQuery,
  ExternalPaperSearchResults,
  IExternalPaperSearch,
} from '../../plugins/core/paper-search.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';

/**
 * Configuration for the external paper search service.
 *
 * @public
 */
export interface ExternalPaperSearchConfig {
  /**
   * Elasticsearch index name.
   *
   * @defaultValue 'external-papers-v1'
   */
  readonly indexName?: string;
}

/**
 * Options for creating an external paper search service.
 *
 * @public
 */
export interface ExternalPaperSearchOptions {
  /**
   * Elasticsearch client.
   */
  readonly client: Client;

  /**
   * Logger instance.
   */
  readonly logger: ILogger;

  /**
   * Configuration options.
   */
  readonly config?: ExternalPaperSearchConfig;
}

/**
 * Elasticsearch document structure for external papers.
 *
 * @internal
 */
interface ElasticsearchPaperDocument {
  id: string;
  source: string;
  external_id: string;
  title: string;
  abstract?: string;
  authors: string[];
  url: string;
  pdf_url?: string;
  publication_date?: string;
  categories?: string[];
  doi?: string;
  indexed_at: string;
  year_published?: number;
}

/**
 * Elasticsearch-backed implementation of external paper search.
 *
 * @remarks
 * Indexes papers from external archives and provides full-text search.
 *
 * @example
 * ```typescript
 * const paperSearch = new ExternalPaperSearchService({
 *   client: esClient,
 *   logger,
 * });
 *
 * // Index a paper
 * await paperSearch.indexPaper({
 *   id: 'lingbuzz:007123',
 *   source: 'lingbuzz',
 *   externalId: '007123',
 *   title: 'A Study of Syntax',
 *   authors: ['Jane Doe'],
 *   url: 'https://lingbuzz.net/lingbuzz/007123',
 *   indexedAt: new Date(),
 * });
 *
 * // Search for papers
 * const results = await paperSearch.search({ q: 'syntax' });
 * ```
 *
 * @public
 */
export class ExternalPaperSearchService implements IExternalPaperSearch {
  private readonly client: Client;
  private readonly logger: ILogger;
  private readonly indexName: string;

  /**
   * Creates a new ExternalPaperSearchService.
   *
   * @param options - Service options
   */
  constructor(options: ExternalPaperSearchOptions) {
    this.client = options.client;
    this.logger = options.logger.child({ service: 'ExternalPaperSearchService' });
    this.indexName = options.config?.indexName ?? 'external-papers-v1';
  }

  /**
   * Indexes an external paper.
   *
   * @param paper - Paper document to index
   */
  async indexPaper(paper: ExternalPaperDocument): Promise<void> {
    const doc = this.toElasticsearchDocument(paper);

    try {
      await this.client.index({
        index: this.indexName,
        id: paper.id,
        document: doc,
      });

      this.logger.debug('Paper indexed', {
        id: paper.id,
        source: paper.source,
        title: paper.title,
      });
    } catch (error) {
      this.logger.error('Failed to index paper', error instanceof Error ? error : undefined, {
        id: paper.id,
      });
      throw error;
    }
  }

  /**
   * Indexes multiple papers in bulk.
   *
   * @param papers - Papers to index
   */
  async bulkIndexPapers(papers: readonly ExternalPaperDocument[]): Promise<void> {
    if (papers.length === 0) {
      return;
    }

    const operations = papers.flatMap((paper) => [
      { index: { _index: this.indexName, _id: paper.id } },
      this.toElasticsearchDocument(paper),
    ]);

    try {
      const response = await this.client.bulk({ operations, refresh: true });

      if (response.errors) {
        const failedItems = response.items.filter((item) => item.index?.error);
        this.logger.warn('Some papers failed to index', {
          total: papers.length,
          failed: failedItems.length,
        });
      }

      this.logger.debug('Bulk indexed papers', {
        count: papers.length,
        errors: response.errors,
      });
    } catch (error) {
      this.logger.error('Failed to bulk index papers', error instanceof Error ? error : undefined, {
        count: papers.length,
      });
      throw error;
    }
  }

  /**
   * Searches for papers.
   *
   * @param query - Search query
   * @returns Search results
   */
  async search(query: ExternalPaperSearchQuery): Promise<ExternalPaperSearchResults> {
    const limit = Math.min(query.limit ?? 10, 100);
    const offset = query.offset ?? 0;

    // Build Elasticsearch query
    const esQuery = this.buildSearchQuery(query);

    try {
      const response = await this.client.search<ElasticsearchPaperDocument>({
        index: this.indexName,
        query: esQuery,
        from: offset,
        size: limit,
        highlight: {
          fields: {
            title: { number_of_fragments: 1 },
            abstract: { number_of_fragments: 2, fragment_size: 200 },
          },
        },
        _source: true,
      });

      const hits = response.hits.hits
        .filter(
          (hit): hit is typeof hit & { _source: ElasticsearchPaperDocument } =>
            hit._source !== undefined
        )
        .map((hit) => ({
          paper: this.fromElasticsearchDocument(hit._source),
          score: hit._score ?? 0,
          highlight: hit.highlight
            ? {
                title: hit.highlight.title,
                abstract: hit.highlight.abstract,
              }
            : undefined,
        }));

      const total =
        typeof response.hits.total === 'number'
          ? response.hits.total
          : (response.hits.total?.value ?? 0);

      return {
        hits,
        total,
        took: response.took,
      };
    } catch (error) {
      this.logger.error('Search failed', error instanceof Error ? error : undefined, {
        query: query.q,
      });
      throw error;
    }
  }

  /**
   * Gets a paper by ID.
   *
   * @param id - Paper ID
   * @returns Paper document or null if not found
   */
  async getPaper(id: string): Promise<ExternalPaperDocument | null> {
    try {
      const response = await this.client.get<ElasticsearchPaperDocument>({
        index: this.indexName,
        id,
      });

      if (!response.found || !response._source) {
        return null;
      }

      return this.fromElasticsearchDocument(response._source);
    } catch (error) {
      // Check if it's a 404
      if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Deletes a paper from the index.
   *
   * @param id - Paper ID
   */
  async deletePaper(id: string): Promise<void> {
    try {
      await this.client.delete({
        index: this.indexName,
        id,
      });

      this.logger.debug('Paper deleted', { id });
    } catch (error) {
      // Ignore 404 errors
      if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404) {
        return;
      }
      throw error;
    }
  }

  /**
   * Deletes all papers from a specific source.
   *
   * @param source - Source archive identifier
   * @returns Number of papers deleted
   */
  async deleteBySource(source: string): Promise<number> {
    try {
      const response = await this.client.deleteByQuery({
        index: this.indexName,
        query: {
          term: { source },
        },
        refresh: true,
      });

      const deleted = response.deleted ?? 0;
      this.logger.info('Deleted papers by source', { source, count: deleted });
      return deleted;
    } catch (error) {
      this.logger.error(
        'Failed to delete papers by source',
        error instanceof Error ? error : undefined,
        { source }
      );
      throw error;
    }
  }

  /**
   * Builds the Elasticsearch query from search parameters.
   *
   * @param query - Search query parameters
   * @returns Elasticsearch query object
   */
  private buildSearchQuery(query: ExternalPaperSearchQuery): Record<string, unknown> {
    const must: Record<string, unknown>[] = [];
    const filter: Record<string, unknown>[] = [];

    // Full-text search
    if (query.q?.trim()) {
      must.push({
        multi_match: {
          query: query.q,
          fields: ['title^3', 'abstract^2', 'authors'],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    }

    // Source filter
    if (query.sources && query.sources.length > 0) {
      filter.push({
        terms: { source: query.sources },
      });
    }

    // Category filter
    if (query.categories && query.categories.length > 0) {
      filter.push({
        terms: { categories: query.categories },
      });
    }

    // Date range filter
    if (query.dateFrom || query.dateTo) {
      const range: Record<string, string> = {};
      if (query.dateFrom) {
        range.gte = query.dateFrom.toISOString();
      }
      if (query.dateTo) {
        range.lte = query.dateTo.toISOString();
      }
      filter.push({
        range: { publication_date: range },
      });
    }

    // If no query text, match all
    if (must.length === 0) {
      must.push({ match_all: {} });
    }

    return {
      bool: {
        must,
        filter: filter.length > 0 ? filter : undefined,
      },
    };
  }

  /**
   * Converts a paper document to Elasticsearch format.
   *
   * @param paper - Paper document
   * @returns Elasticsearch document
   */
  private toElasticsearchDocument(paper: ExternalPaperDocument): ElasticsearchPaperDocument {
    return {
      id: paper.id,
      source: paper.source,
      external_id: paper.externalId,
      title: paper.title,
      abstract: paper.abstract,
      authors: [...paper.authors],
      url: paper.url,
      pdf_url: paper.pdfUrl,
      publication_date: paper.publicationDate?.toISOString(),
      categories: paper.categories ? [...paper.categories] : undefined,
      doi: paper.doi,
      indexed_at: paper.indexedAt.toISOString(),
      year_published: paper.publicationDate?.getFullYear(),
    };
  }

  /**
   * Converts an Elasticsearch document to paper format.
   *
   * @param doc - Elasticsearch document
   * @returns Paper document
   */
  private fromElasticsearchDocument(doc: ElasticsearchPaperDocument): ExternalPaperDocument {
    return {
      id: doc.id,
      source: doc.source,
      externalId: doc.external_id,
      title: doc.title,
      abstract: doc.abstract,
      authors: doc.authors,
      url: doc.url,
      pdfUrl: doc.pdf_url,
      publicationDate: doc.publication_date ? new Date(doc.publication_date) : undefined,
      categories: doc.categories,
      doi: doc.doi,
      indexedAt: new Date(doc.indexed_at),
    };
  }
}
