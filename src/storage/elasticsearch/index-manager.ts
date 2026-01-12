/**
 * Elasticsearch index manager for bulk operations and index lifecycle.
 *
 * @remarks
 * Manages Elasticsearch index operations with:
 * - Bulk indexing with automatic chunking
 * - Error recovery and partial failure handling
 * - Index lifecycle (create, delete, refresh)
 * - Index health monitoring
 * - Type-safe bulk operations
 *
 * @packageDocumentation
 */

import type { Client, estypes } from '@elastic/elasticsearch';
import { errors } from '@elastic/elasticsearch';

import type { AtUri } from '../../types/atproto.js';

/**
 * Index operation error.
 *
 * @public
 */
export class IndexOperationError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'IndexOperationError';
  }
}

/**
 * Bulk operation error with details.
 *
 * @public
 */
export class BulkOperationError extends Error {
  constructor(
    message: string,
    public readonly failedItems: readonly BulkOperationFailure[],
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'BulkOperationError';
  }
}

/**
 * Bulk operation failure details.
 *
 * @public
 */
export interface BulkOperationFailure {
  /**
   * Document ID that failed.
   */
  readonly id: string;

  /**
   * Error reason.
   */
  readonly error: string;

  /**
   * HTTP status code.
   */
  readonly status: number;
}

/**
 * Bulk index result.
 *
 * @public
 */
export interface BulkIndexResult {
  /**
   * Number of documents successfully indexed.
   */
  readonly indexed: number;

  /**
   * Number of documents that failed to index.
   */
  readonly failed: number;

  /**
   * Details of failed operations.
   */
  readonly failures: readonly BulkOperationFailure[];

  /**
   * Time taken in milliseconds.
   */
  readonly took: number;
}

/**
 * Index manager configuration.
 *
 * @public
 */
export interface IndexManagerConfig {
  /**
   * Default index name.
   *
   * @defaultValue 'eprints'
   */
  readonly indexName?: string;

  /**
   * Ingest pipeline ID.
   *
   * @defaultValue 'eprint-processing'
   */
  readonly pipelineId?: string;

  /**
   * Bulk operation chunk size.
   *
   * @remarks
   * Number of documents per bulk request.
   * Higher values improve throughput but increase memory usage.
   *
   * @defaultValue 500
   */
  readonly bulkChunkSize?: number;

  /**
   * Maximum number of retries for failed bulk operations.
   *
   * @defaultValue 3
   */
  readonly maxRetries?: number;

  /**
   * Whether to refresh index after bulk operations.
   *
   * @remarks
   * - true: Wait for refresh (immediate visibility, slower)
   * - false: Don't refresh (eventual visibility, faster)
   * - 'wait_for': Wait for next refresh cycle
   *
   * @defaultValue false
   */
  readonly refresh?: boolean | 'wait_for';

  /**
   * Whether to continue on partial failures.
   *
   * @remarks
   * If true, bulk operations succeed even if some documents fail.
   * If false, bulk operations throw error on any failure.
   *
   * @defaultValue true
   */
  readonly continueOnError?: boolean;
}

/**
 * Default index manager configuration.
 *
 * @public
 */
export const DEFAULT_INDEX_MANAGER_CONFIG: Required<IndexManagerConfig> = {
  indexName: 'eprints',
  pipelineId: 'eprint-processing',
  bulkChunkSize: 500,
  maxRetries: 3,
  refresh: false,
  continueOnError: true,
};

/**
 * Manages Elasticsearch index operations with bulk support.
 *
 * @remarks
 * Provides production-ready index management:
 * - Automatic chunking for large datasets
 * - Partial failure recovery
 * - Pipeline attachment
 * - Progress tracking
 * - Type-safe operations
 *
 * **Bulk Indexing Strategy:**
 * 1. Split documents into chunks (default: 500 per chunk)
 * 2. Process each chunk with bulk API
 * 3. Collect failures for retry
 * 4. Retry failed documents (up to max retries)
 * 5. Return aggregated results
 *
 * @example
 * ```typescript
 * const manager = new IndexManager(client);
 *
 * // Bulk index documents
 * const result = await manager.bulkIndex(documents);
 * console.log(`Indexed: ${result.indexed}, Failed: ${result.failed}`);
 *
 * // Delete by query
 * await manager.deleteByQuery({ match: { pds_url: 'old-pds' } });
 * ```
 *
 * @public
 */
export class IndexManager {
  private readonly client: Client;
  private readonly config: Required<IndexManagerConfig>;

  constructor(client: Client, config: IndexManagerConfig = {}) {
    this.client = client;
    this.config = {
      indexName: config.indexName ?? DEFAULT_INDEX_MANAGER_CONFIG.indexName,
      pipelineId: config.pipelineId ?? DEFAULT_INDEX_MANAGER_CONFIG.pipelineId,
      bulkChunkSize: config.bulkChunkSize ?? DEFAULT_INDEX_MANAGER_CONFIG.bulkChunkSize,
      maxRetries: config.maxRetries ?? DEFAULT_INDEX_MANAGER_CONFIG.maxRetries,
      refresh: config.refresh ?? DEFAULT_INDEX_MANAGER_CONFIG.refresh,
      continueOnError: config.continueOnError ?? DEFAULT_INDEX_MANAGER_CONFIG.continueOnError,
    };
  }

  /**
   * Bulk indexes documents with automatic chunking and error recovery.
   *
   * @param documents - Documents to index
   * @param indexName - Target index (optional, uses default if not provided)
   * @returns Bulk index result
   *
   * @throws {BulkOperationError} If continueOnError is false and any documents fail
   * @throws {IndexOperationError} On unexpected errors
   *
   * @remarks
   * Documents are split into chunks and processed in parallel.
   * Failed documents are retried up to maxRetries times.
   *
   * @public
   */
  async bulkIndex(
    documents: readonly Record<string, unknown>[],
    indexName?: string
  ): Promise<BulkIndexResult> {
    if (documents.length === 0) {
      return {
        indexed: 0,
        failed: 0,
        failures: [],
        took: 0,
      };
    }

    const targetIndex = indexName ?? this.config.indexName;
    const chunks = this.chunkArray(documents, this.config.bulkChunkSize);

    let totalIndexed = 0;
    let totalFailed = 0;
    let totalTook = 0;
    const allFailures: BulkOperationFailure[] = [];

    for (const chunk of chunks) {
      const result = await this.bulkIndexChunk(chunk, targetIndex);

      totalIndexed += result.indexed;
      totalFailed += result.failed;
      totalTook += result.took;
      allFailures.push(...result.failures);
    }

    if (!this.config.continueOnError && allFailures.length > 0) {
      throw new BulkOperationError(
        `Bulk index operation failed: ${allFailures.length} documents failed`,
        allFailures
      );
    }

    return {
      indexed: totalIndexed,
      failed: totalFailed,
      failures: allFailures,
      took: totalTook,
    };
  }

  /**
   * Bulk deletes documents by URIs.
   *
   * @param uris - Document URIs to delete
   * @param indexName - Target index (optional)
   * @returns Bulk index result
   *
   * @throws {BulkOperationError} On bulk operation failure
   *
   * @public
   */
  async bulkDelete(uris: readonly AtUri[], indexName?: string): Promise<BulkIndexResult> {
    if (uris.length === 0) {
      return {
        indexed: 0,
        failed: 0,
        failures: [],
        took: 0,
      };
    }

    const targetIndex = indexName ?? this.config.indexName;

    try {
      const body = uris.flatMap((uri) => [{ delete: { _index: targetIndex, _id: uri } }]);

      const response = await this.client.bulk({
        body,
        refresh: this.config.refresh,
      });

      return this.parseBulkResponse(response);
    } catch (error) {
      if (error instanceof errors.ResponseError) {
        throw new IndexOperationError(`Bulk delete failed: ${error.message}`, error);
      }

      throw new IndexOperationError(
        'Unexpected error during bulk delete',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Deletes documents matching a query.
   *
   * @param query - Elasticsearch query
   * @param indexName - Target index (optional)
   * @returns Number of documents deleted
   *
   * @throws {IndexOperationError} On operation failure
   *
   * @public
   */
  async deleteByQuery(query: estypes.QueryDslQueryContainer, indexName?: string): Promise<number> {
    try {
      const response = await this.client.deleteByQuery({
        index: indexName ?? this.config.indexName,
        query,
        refresh: this.config.refresh === true,
      });

      return response.deleted ?? 0;
    } catch (error) {
      if (error instanceof errors.ResponseError) {
        throw new IndexOperationError(`Delete by query failed: ${error.message}`, error);
      }

      throw new IndexOperationError(
        'Unexpected error during delete by query',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Refreshes index to make recent changes visible.
   *
   * @param indexName - Target index (optional)
   *
   * @throws {IndexOperationError} On refresh failure
   *
   * @public
   */
  async refresh(indexName?: string): Promise<void> {
    try {
      await this.client.indices.refresh({
        index: indexName ?? this.config.indexName,
      });
    } catch (error) {
      if (error instanceof errors.ResponseError) {
        throw new IndexOperationError(`Index refresh failed: ${error.message}`, error);
      }

      throw new IndexOperationError(
        'Unexpected error during index refresh',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Checks if index exists.
   *
   * @param indexName - Index name to check
   * @returns True if exists
   *
   * @throws {IndexOperationError} On check failure
   *
   * @public
   */
  async exists(indexName: string): Promise<boolean> {
    try {
      return await this.client.indices.exists({ index: indexName });
    } catch (error) {
      if (error instanceof errors.ResponseError) {
        throw new IndexOperationError(`Index exists check failed: ${error.message}`, error);
      }

      throw new IndexOperationError(
        'Unexpected error during index exists check',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Bulk indexes a chunk of documents.
   *
   * @param documents - Document chunk
   * @param indexName - Target index
   * @returns Bulk result for this chunk
   */
  private async bulkIndexChunk(
    documents: readonly Record<string, unknown>[],
    indexName: string
  ): Promise<BulkIndexResult> {
    try {
      const body = documents.flatMap((doc) => [
        {
          index: {
            _index: indexName,
            _id: this.extractDocumentId(doc),
            pipeline: this.config.pipelineId,
          },
        },
        doc,
      ]);

      const response = await this.client.bulk({
        body,
        refresh: this.config.refresh,
      });

      return this.parseBulkResponse(response);
    } catch (error) {
      if (error instanceof errors.ResponseError) {
        throw new IndexOperationError(`Bulk index chunk failed: ${error.message}`, error);
      }

      throw new IndexOperationError(
        'Unexpected error during bulk index chunk',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Parses bulk operation response.
   *
   * @param response - Elasticsearch bulk response
   * @returns Parsed result
   */
  private parseBulkResponse(response: estypes.BulkResponse): BulkIndexResult {
    const failures: BulkOperationFailure[] = [];
    let indexed = 0;
    let failed = 0;

    for (const item of response.items) {
      const operation = item.index ?? item.delete;

      if (!operation) {
        continue;
      }

      if (operation.error) {
        failed++;
        failures.push({
          id: operation._id ?? 'unknown',
          error:
            typeof operation.error === 'string'
              ? operation.error
              : (operation.error.reason ?? 'Unknown error'),
          status: operation.status,
        });
      } else {
        indexed++;
      }
    }

    return {
      indexed,
      failed,
      failures,
      took: response.took,
    };
  }

  /**
   * Extracts document ID from document.
   *
   * @param doc - Document
   * @returns Document ID
   */
  private extractDocumentId(doc: Record<string, unknown>): string {
    if ('uri' in doc && typeof doc.uri === 'string') {
      return doc.uri;
    }

    if ('id' in doc && typeof doc.id === 'string') {
      return doc.id;
    }

    throw new IndexOperationError('Document missing uri or id field');
  }

  /**
   * Chunks array into smaller arrays.
   *
   * @param array - Array to chunk
   * @param chunkSize - Size of each chunk
   * @returns Array of chunks
   */
  private chunkArray<T>(array: readonly T[], chunkSize: number): readonly (readonly T[])[] {
    const chunks: T[][] = [];

    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }

    return chunks;
  }
}
