/**
 * AT Protocol repository implementation for fetching records from user PDSes.
 *
 * @remarks
 * This module provides a read-only repository implementation that fetches
 * records and blobs from user Personal Data Servers (PDSes) using the
 * AT Protocol specification.
 *
 * **CRITICAL ATProto Compliance:**
 * - This implementation is READ-ONLY. AppViews must never write to user PDSes.
 * - Fetched blobs are proxied, never stored.
 * - All data fetched via this implementation remains in user PDSes as source of truth.
 *
 * @packageDocumentation
 * @public
 */

import { AtpAgent } from '@atproto/api';
import type { IPolicy } from 'cockatiel';

import type { AtUri, CID, DID, NSID } from '../../types/atproto.js';
import type { IIdentityResolver } from '../../types/interfaces/identity.interface.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import type {
  GetRecordOptions,
  IRepository,
  ListRecordsOptions,
  RepositoryRecord,
} from '../../types/interfaces/repository.interface.js';
import { BlobFetchError, IdentityResolutionError, RecordFetchError } from '../errors/index.js';

import {
  DEFAULT_CONFIG,
  type ATRepositoryConfig,
  type ATRepositoryOptions,
} from './at-repository.config.js';

/**
 * Parses an AT URI into its components.
 *
 * @param uri - AT URI string
 * @returns Parsed components or null if invalid
 *
 * @remarks
 * AT URI format: `at://did/collection/rkey`
 *
 * @example
 * ```typescript
 * const parts = parseAtUri('at://did:plc:abc/pub.chive.eprint.submission/xyz');
 * // { did: 'did:plc:abc', collection: 'pub.chive.eprint.submission', rkey: 'xyz' }
 * ```
 *
 * @internal
 */
function parseAtUri(uri: AtUri): { did: DID; collection: NSID; rkey: string } | null {
  const match = /^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/.exec(uri);
  if (!match) {
    return null;
  }

  const [, did, collection, rkey] = match;
  if (!did || !collection || !rkey) {
    return null;
  }

  return {
    did: did as DID,
    collection: collection as NSID,
    rkey,
  };
}

/**
 * AT Protocol repository implementation.
 *
 * @remarks
 * Implements `IRepository` for fetching records and blobs from user PDSes.
 * Uses `@atproto/api` SDK for AT Protocol compliance and the identity resolver
 * for DID-to-PDS endpoint resolution.
 *
 * **Architecture:**
 * ```
 * ATRepository
 *   ├── IIdentityResolver (DID → PDS URL)
 *   ├── AtpAgent (per-PDS HTTP client)
 *   └── IPolicy (circuit breaker + retry)
 * ```
 *
 * **Resilience:**
 * All PDS requests are wrapped in a resilience policy that provides:
 * - Circuit breaker: Fast-fail when PDS is unhealthy
 * - Retry: Automatic retry with exponential backoff
 *
 * **Caching:**
 * This implementation does NOT cache responses. Caching should be handled
 * by a higher-level service (e.g., BlobProxyService for blobs).
 *
 * @example
 * ```typescript
 * const repository = new ATRepository({
 *   identity: didResolver,
 *   resiliencePolicy: createResiliencePolicy({
 *     circuitBreaker: { name: 'pds', failureThreshold: 5 },
 *     retry: { name: 'pds', maxAttempts: 3 }
 *   }),
 *   logger,
 *   config: { timeoutMs: 30000 }
 * });
 *
 * // Fetch a single record
 * const record = await repository.getRecord<EprintRecord>(uri);
 *
 * // List records from a collection
 * for await (const record of repository.listRecords<EprintRecord>(did, nsid)) {
 *   console.log(record.value.title);
 * }
 *
 * // Fetch a blob
 * const stream = await repository.getBlob(did, cid);
 * ```
 *
 * @public
 */
export class ATRepository implements IRepository {
  private readonly identity: IIdentityResolver;
  private readonly resiliencePolicy: IPolicy;
  private readonly logger: ILogger;
  private readonly config: Required<ATRepositoryConfig>;

  /**
   * Cache of AtpAgent instances per PDS endpoint.
   *
   * @remarks
   * AtpAgent instances are reused for efficiency. Each agent maintains
   * its own HTTP connection pool to a specific PDS.
   */
  private readonly agentCache = new Map<string, AtpAgent>();

  /**
   * Creates a new ATRepository.
   *
   * @param options - Repository options
   *
   * @example
   * ```typescript
   * const repository = new ATRepository({
   *   identity: didResolver,
   *   resiliencePolicy,
   *   logger
   * });
   * ```
   */
  constructor(options: ATRepositoryOptions) {
    this.identity = options.identity;
    this.resiliencePolicy = options.resiliencePolicy;
    this.logger = options.logger;
    this.config = { ...DEFAULT_CONFIG, ...options.config };
  }

  /**
   * Fetches a single record by AT URI.
   *
   * @typeParam T - Record value type
   * @param uri - AT URI of the record
   * @param options - Fetch options (CID for specific version)
   * @returns Record if found, null if not found
   *
   * @remarks
   * This method fetches the record from the user's PDS. If the record
   * doesn't exist or the PDS is unreachable, returns null.
   *
   * **Process:**
   * 1. Parse AT URI to extract DID, collection, rkey
   * 2. Resolve DID to PDS endpoint
   * 3. Get or create AtpAgent for PDS
   * 4. Fetch record via `com.atproto.repo.getRecord`
   * 5. Return typed RepositoryRecord
   *
   * @throws {@link RecordFetchError}
   * Thrown when fetch fails due to network error or parse error.
   * NOT thrown for 404 (returns null instead).
   *
   * @example
   * ```typescript
   * const record = await repository.getRecord<EprintRecord>(
   *   toAtUri('at://did:plc:abc123/pub.chive.eprint.submission/xyz789')!
   * );
   *
   * if (record) {
   *   console.log('Title:', record.value.title);
   *   console.log('Author:', record.author);
   *   console.log('CID:', record.cid);
   * }
   * ```
   *
   * @public
   */
  async getRecord<T>(uri: AtUri, options?: GetRecordOptions): Promise<RepositoryRecord<T> | null> {
    const parsed = parseAtUri(uri);
    if (!parsed) {
      this.logger.warn('Invalid AT URI format', { uri });
      return null;
    }

    const { did, collection, rkey } = parsed;

    try {
      // Get PDS endpoint
      const pdsUrl = await this.resolvePDSEndpoint(did);
      if (!pdsUrl) {
        this.logger.warn('Cannot resolve PDS endpoint', { did });
        return null;
      }

      // Get or create agent for this PDS
      const agent = this.getOrCreateAgent(pdsUrl);

      // Fetch record with resilience
      const response = await this.resiliencePolicy.execute(async () => {
        const result = await agent.com.atproto.repo.getRecord({
          repo: did,
          collection,
          rkey,
          cid: options?.cid,
        });
        return result;
      });

      // Map to RepositoryRecord
      const record: RepositoryRecord<T> = {
        uri,
        cid: response.data.cid as CID,
        value: response.data.value as T,
        author: did,
        indexedAt: new Date().toISOString(),
      };

      this.logger.debug('Fetched record', { uri, cid: record.cid });

      return record;
    } catch (error) {
      // Handle 404 gracefully
      if (this.isNotFoundError(error)) {
        this.logger.debug('Record not found', { uri });
        return null;
      }

      // Re-throw with context
      throw new RecordFetchError(
        `Failed to fetch record: ${error instanceof Error ? error.message : String(error)}`,
        uri,
        this.classifyFetchError(error),
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Lists records from a collection in a user's repository.
   *
   * @typeParam T - Record value type
   * @param did - Repository DID
   * @param collection - Collection NSID
   * @param options - List options (limit, cursor, reverse)
   * @returns Async iterable of records
   *
   * @remarks
   * Returns an async iterable for memory-efficient streaming of large collections.
   * Automatically handles pagination via cursors.
   *
   * **Process:**
   * 1. Resolve DID to PDS endpoint
   * 2. Get or create AtpAgent for PDS
   * 3. Fetch records in pages via `com.atproto.repo.listRecords`
   * 4. Yield records one at a time
   * 5. Continue until no more pages or limit reached
   *
   * @example
   * ```typescript
   * const eprints = repository.listRecords<EprintRecord>(
   *   toDID('did:plc:abc123')!,
   *   toNSID('pub.chive.eprint.submission')!,
   *   { limit: 10 }
   * );
   *
   * for await (const record of eprints) {
   *   console.log('Eprint:', record.value.title);
   * }
   * ```
   *
   * @public
   */
  async *listRecords<T>(
    did: DID,
    collection: NSID,
    options?: ListRecordsOptions
  ): AsyncIterable<RepositoryRecord<T>> {
    // Get PDS endpoint
    const pdsUrl = await this.resolvePDSEndpoint(did);
    if (!pdsUrl) {
      this.logger.warn('Cannot resolve PDS endpoint for listing', { did });
      return;
    }

    // Get or create agent for this PDS
    const agent = this.getOrCreateAgent(pdsUrl);

    let cursor = options?.cursor;
    let fetched = 0;
    const limit = options?.limit ?? this.config.defaultPageSize;
    const pageSize = Math.min(limit, 100); // ATProto max is 100

    try {
      while (true) {
        // Fetch page with resilience
        const response = await this.resiliencePolicy.execute(async () => {
          return await agent.com.atproto.repo.listRecords({
            repo: did,
            collection,
            limit: pageSize,
            cursor,
            reverse: options?.reverse,
          });
        });

        const records = response.data.records;

        if (records.length === 0) {
          break;
        }

        // Yield records
        for (const record of records) {
          if (fetched >= limit) {
            return;
          }

          const repoRecord: RepositoryRecord<T> = {
            uri: record.uri as AtUri,
            cid: record.cid as CID,
            value: record.value as T,
            author: did,
            indexedAt: new Date().toISOString(),
          };

          yield repoRecord;
          fetched++;
        }

        // Check pagination
        cursor = response.data.cursor;
        if (!cursor || fetched >= limit) {
          break;
        }
      }

      this.logger.debug('Listed records', { did, collection, count: fetched });
    } catch (error) {
      // Log error and stop iteration
      this.logger.error('Failed to list records', error instanceof Error ? error : undefined, {
        did,
        collection,
      });
      throw new RecordFetchError(
        `Failed to list records: ${error instanceof Error ? error.message : String(error)}`,
        `at://${did}/${collection}/*`,
        this.classifyFetchError(error),
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Fetches a blob from a user's PDS.
   *
   * @param did - Repository DID
   * @param cid - Blob CID
   * @returns Blob data as readable stream
   *
   * @remarks
   * This method fetches blobs for proxying only; Chive does not store blob
   * data. The stream should be piped directly to the client.
   *
   * Process: resolve DID to PDS endpoint, construct blob URL using
   * `{pdsUrl}/xrpc/com.atproto.sync.getBlob`, fetch blob with resilience,
   * and return as ReadableStream.
   *
   * @throws {@link BlobFetchError}
   * Thrown when blob fetch fails.
   *
   * @example
   * ```typescript
   * const pdfStream = await repository.getBlob(
   *   toDID('did:plc:abc123')!,
   *   toCID('bafyreib2rxk...')!
   * );
   *
   * // Pipe to response
   * return new Response(pdfStream, {
   *   headers: { 'Content-Type': 'application/pdf' }
   * });
   * ```
   *
   * @public
   */
  async getBlob(did: DID, cid: CID): Promise<ReadableStream<Uint8Array>> {
    // Get PDS endpoint
    const pdsUrl = await this.resolvePDSEndpoint(did);
    if (!pdsUrl) {
      throw new IdentityResolutionError(
        `Cannot resolve PDS endpoint for DID: ${did}`,
        did,
        'no_pds'
      );
    }

    // Construct blob URL
    const blobUrl = `${pdsUrl}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${encodeURIComponent(cid)}`;

    this.logger.debug('Fetching blob', { did, cid, url: blobUrl });

    try {
      // Fetch with resilience
      const response = await this.resiliencePolicy.execute(async () => {
        const resp = await fetch(blobUrl, {
          headers: {
            'User-Agent': this.config.userAgent,
          },
          signal: AbortSignal.timeout(this.config.timeoutMs),
        });

        if (!resp.ok) {
          if (resp.status === 404) {
            throw new BlobFetchError(`Blob not found: ${cid}`, did, cid, 'not_found');
          }
          throw new BlobFetchError(
            `PDS returned ${resp.status}: ${resp.statusText}`,
            did,
            cid,
            'pds_error'
          );
        }

        // Check content length
        const contentLength = resp.headers.get('content-length');
        if (contentLength) {
          const size = parseInt(contentLength, 10);
          if (size > this.config.maxBlobSize) {
            throw new BlobFetchError(
              `Blob too large: ${size} bytes (max: ${this.config.maxBlobSize})`,
              did,
              cid,
              'too_large'
            );
          }
        }

        return resp;
      });

      // Return body as ReadableStream
      if (!response.body) {
        throw new BlobFetchError('PDS returned empty response body', did, cid, 'pds_error');
      }

      this.logger.debug('Blob fetch initiated', { did, cid });

      return response.body;
    } catch (error) {
      // Re-throw BlobFetchError as-is
      if (error instanceof BlobFetchError) {
        throw error;
      }

      // Wrap other errors
      throw new BlobFetchError(
        `Failed to fetch blob: ${error instanceof Error ? error.message : String(error)}`,
        did,
        cid,
        'network_error',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Resolves a DID to its PDS endpoint URL.
   *
   * @param did - DID to resolve
   * @returns PDS endpoint URL or null if resolution fails
   *
   * @remarks
   * Uses the identity resolver to fetch the DID document and extract
   * the PDS service endpoint.
   *
   * @private
   */
  private async resolvePDSEndpoint(did: DID): Promise<string | null> {
    try {
      return await this.identity.getPDSEndpoint(did);
    } catch (error) {
      this.logger.warn('DID resolution failed', {
        did,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Gets or creates an AtpAgent for a PDS endpoint.
   *
   * @param pdsUrl - PDS endpoint URL
   * @returns AtpAgent instance
   *
   * @remarks
   * Agents are cached and reused to maintain HTTP connection pools.
   *
   * @private
   */
  private getOrCreateAgent(pdsUrl: string): AtpAgent {
    let agent = this.agentCache.get(pdsUrl);
    if (!agent) {
      agent = new AtpAgent({ service: pdsUrl });
      this.agentCache.set(pdsUrl, agent);
      this.logger.debug('Created new AtpAgent', { pdsUrl });
    }
    return agent;
  }

  /**
   * Checks if an error is a 404 Not Found error.
   *
   * @param error - Error to check
   * @returns True if 404 error
   *
   * @private
   */
  private isNotFoundError(error: unknown): boolean {
    // Check for XrpcError with 404 status
    if (typeof error === 'object' && error !== null) {
      const err = error as Record<string, unknown>;
      if (err.status === 404 || err.statusCode === 404) {
        return true;
      }
      // Check for nested error
      if (err.error && typeof err.error === 'object') {
        const innerErr = err.error as Record<string, unknown>;
        if (innerErr.status === 404 || innerErr.statusCode === 404) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Classifies a fetch error for error reporting.
   *
   * @param error - Error to classify
   * @returns Error classification
   *
   * @private
   */
  private classifyFetchError(error: unknown): RecordFetchError['reason'] {
    if (this.isNotFoundError(error)) {
      return 'not_found';
    }

    if (error instanceof TypeError || (error instanceof Error && error.name === 'AbortError')) {
      return 'network_error';
    }

    if (typeof error === 'object' && error !== null) {
      const err = error as Record<string, unknown>;
      if (typeof err.status === 'number' && err.status >= 400 && err.status < 500) {
        return 'pds_error';
      }
    }

    return 'network_error';
  }
}
