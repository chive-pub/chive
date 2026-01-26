/**
 * Blob proxy service for fetching blobs from user PDSes with 3-tier caching.
 *
 * @remarks
 * **CRITICAL ATProto Compliance Service:**
 * This service handles blob access while respecting ATProto data sovereignty.
 * Blobs (PDFs, supplementary files) ALWAYS live in user PDSes, never in Chive.
 *
 * **3-Tier Cache Architecture:**
 * - L1: Redis (100MB, 1h TTL, 40-50% hit rate, probabilistic early expiration)
 * - L2: CDN/R2 (200GB, 24h TTL, 85-90% hit rate, zero egress fees)
 * - L3: PDS (source of truth, unlimited storage, direct fetch)
 *
 * **Features:**
 * - Request coalescing to prevent thundering herd
 * - CID verification for integrity checking
 * - Circuit breaker + retry for PDS resilience
 * - Probabilistic early expiration to prevent cache stampede
 * - Source PDS tracking for transparency
 *
 * **Never:**
 * - Store blobs authoritatively in Chive
 * - Upload blobs to Chive storage
 * - Modify blob content
 *
 * @packageDocumentation
 * @public
 */

import type { IPolicy } from 'cockatiel';

import { IdentityResolutionError } from '../../atproto/errors/repository-errors.js';
import type { BlobRef, CID, DID } from '../../types/atproto.js';
import { DatabaseError } from '../../types/errors.js';
import type { IIdentityResolver } from '../../types/interfaces/identity.interface.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import type { IRepository } from '../../types/interfaces/repository.interface.js';
import type { Result } from '../../types/result.js';

import type { CDNAdapter } from './cdn-adapter.js';
import type { CIDVerifier } from './cid-verifier.js';
import type { RedisCache } from './redis-cache.js';
import type { RequestCoalescer } from './request-coalescer.js';

/**
 * Blob URL parameters.
 *
 * @public
 */
export interface BlobUrlParams {
  /**
   * Author DID (for PDS resolution).
   */
  readonly did: DID;

  /**
   * Blob reference from record.
   */
  readonly blobRef: BlobRef;

  /**
   * Return direct PDS URL (privacy mode, no CDN).
   *
   * @defaultValue false
   */
  readonly preferDirect?: boolean;

  /**
   * Force download vs inline display.
   *
   * @defaultValue false
   */
  readonly download?: boolean;
}

/**
 * Blob URL response.
 *
 * @public
 */
export interface BlobUrlResponse {
  /**
   * Primary access URL (what client should use).
   */
  readonly url: string;

  /**
   * Source information (transparency).
   */
  readonly source: {
    readonly type: 'pds-direct' | 'cdn-cached' | 'appview-proxy';
    readonly pdsEndpoint: string;
    readonly pdsUrl: string;
  };

  /**
   * Caching information.
   */
  readonly cache: {
    readonly cached: boolean;
    readonly cacheUrl?: string;
    readonly ttl?: number;
    readonly immutable: boolean;
  };

  /**
   * Blob metadata.
   */
  readonly blob: {
    readonly cid: CID;
    readonly mimeType: string;
    readonly size?: number;
  };
}

/**
 * Blob fetch result.
 *
 * @remarks
 * Returned by getBlob() to indicate which cache tier served the blob.
 *
 * @public
 */
export interface BlobFetchResult {
  /**
   * Blob data.
   */
  readonly data: Buffer;

  /**
   * Content type (MIME type).
   */
  readonly contentType: string;

  /**
   * Blob size in bytes.
   */
  readonly size: number;

  /**
   * Which cache tier served this blob.
   */
  readonly source: 'redis' | 'cdn' | 'pds';

  /**
   * Source PDS URL for transparency.
   */
  readonly sourcePDS: string;

  /**
   * Whether this is an early fetch (probabilistic expiration).
   *
   * @remarks
   * If true, caller should refresh in background while serving cached data.
   */
  readonly isEarlyFetch: boolean;
}

/**
 * Proxy blob parameters.
 *
 * @public
 */
export interface ProxyBlobParams {
  /**
   * Author DID.
   */
  readonly did: DID;

  /**
   * Blob CID.
   */
  readonly cid: CID;

  /**
   * MIME type.
   */
  readonly mimeType?: string;

  /**
   * Response disposition.
   *
   * @defaultValue "inline"
   */
  readonly responseDisposition?: 'inline' | 'attachment';
}

/**
 * Blob proxy service configuration.
 *
 * @public
 */
export interface BlobProxyServiceOptions {
  /**
   * Repository for fetching blobs from PDSes.
   */
  readonly repository: IRepository;

  /**
   * Identity resolver for DID-to-PDS endpoint resolution.
   */
  readonly identity: IIdentityResolver;

  /**
   * Redis cache (L1).
   */
  readonly redisCache: RedisCache;

  /**
   * CDN adapter (L2).
   */
  readonly cdnAdapter: CDNAdapter;

  /**
   * CID verifier for integrity checking.
   */
  readonly cidVerifier: CIDVerifier;

  /**
   * Request coalescer to prevent duplicate concurrent requests.
   */
  readonly coalescer: RequestCoalescer<BlobFetchResult>;

  /**
   * Resilience policy (circuit breaker + retry) for PDS calls.
   */
  readonly resiliencePolicy: IPolicy;

  /**
   * Logger instance.
   */
  readonly logger: ILogger;
}

/**
 * Blob proxy service implementation.
 *
 * @remarks
 * Critical ATProto compliance service ensuring blobs are always fetched
 * from user PDSes, never stored authoritatively by Chive.
 *
 * **Data Flow:**
 * ```
 * Client → getBlob(cid)
 *   ↓
 * L1 (Redis): Check cache with probabilistic early expiration
 *   ↓ (miss or early fetch)
 * L2 (CDN): Check Cloudflare R2
 *   ↓ (miss)
 * L3 (PDS): Fetch from user's PDS with resilience
 *   ↓
 * Verify CID integrity
 *   ↓
 * Cache in L2 and L1
 *   ↓
 * Return to client
 * ```
 *
 * **Request Coalescing:**
 * Multiple concurrent requests for same CID are coalesced into single
 * backend fetch, preventing thundering herd.
 *
 * **Probabilistic Early Expiration:**
 * Redis cache uses probabilistic early expiration to prevent cache stampede
 * when many clients request expired keys simultaneously.
 *
 * @example
 * ```typescript
 * const service = new BlobProxyService({
 *   repository,
 *   redisCache,
 *   cdnAdapter,
 *   cidVerifier,
 *   coalescer,
 *   resiliencePolicy,
 *   logger
 * });
 *
 * // Fetch blob with 3-tier caching
 * const result = await service.getBlob(did, cid, 'application/pdf');
 *
 * if (result.ok) {
 *   console.log(`Served from: ${result.value.source}`);
 *   console.log(`PDS: ${result.value.sourcePDS}`);
 *
 *   if (result.value.isEarlyFetch) {
 *     // Refresh in background
 *     service.refreshBlob(did, cid, 'application/pdf').catch(logger.error);
 *   }
 * }
 * ```
 *
 * @public
 */
export class BlobProxyService {
  private readonly repository: IRepository;
  private readonly identity: IIdentityResolver;
  private readonly redisCache: RedisCache;
  private readonly cdnAdapter: CDNAdapter;
  private readonly cidVerifier: CIDVerifier;
  private readonly coalescer: RequestCoalescer<BlobFetchResult>;
  private readonly resiliencePolicy: IPolicy;
  private readonly logger: ILogger;
  private readonly pdsEndpointCache = new Map<DID, string>();

  /**
   * Creates blob proxy service.
   *
   * @param options - Service configuration
   */
  constructor(options: BlobProxyServiceOptions) {
    this.repository = options.repository;
    this.identity = options.identity;
    this.redisCache = options.redisCache;
    this.cdnAdapter = options.cdnAdapter;
    this.cidVerifier = options.cidVerifier;
    this.coalescer = options.coalescer;
    this.resiliencePolicy = options.resiliencePolicy;
    this.logger = options.logger;
  }

  /**
   * Fetches blob with 3-tier caching.
   *
   * @param did - Author DID
   * @param cid - Blob CID
   * @param contentType - Expected content type
   * @returns Blob fetch result with source tracking
   *
   * @remarks
   * **3-Tier Cache Flow:**
   * 1. Check L1 (Redis) with probabilistic early expiration
   * 2. If miss or early fetch, check L2 (CDN)
   * 3. If miss, fetch from L3 (PDS) with resilience
   * 4. Verify CID integrity
   * 5. Cache in L2 and L1
   * 6. Return with source tracking
   *
   * **Request Coalescing:**
   * If multiple clients request same CID concurrently, only one
   * backend fetch is performed. All clients receive same result.
   *
   * **Probabilistic Early Expiration:**
   * Redis cache returns `isEarlyFetch: true` when entry is near expiration.
   * Caller should refresh in background while serving cached data.
   *
   * @example
   * ```typescript
   * const result = await service.getBlob(
   *   toDID('did:plc:abc123')!,
   *   toCID('bafyreib2rxk...')!,
   *   'application/pdf'
   * );
   *
   * if (result.ok) {
   *   // Serve blob to client
   *   return new Response(result.value.data, {
   *     headers: {
   *       'Content-Type': result.value.contentType,
   *       'X-Cache-Source': result.value.source,
   *       'X-Source-PDS': result.value.sourcePDS
   *     }
   *   });
   * }
   * ```
   *
   * @public
   */
  async getBlob(
    did: DID,
    cid: CID,
    contentType: string
  ): Promise<Result<BlobFetchResult, DatabaseError>> {
    try {
      // Use request coalescer to prevent duplicate concurrent fetches
      const result = await this.coalescer.execute(cid, async () => {
        // L1: Check Redis cache
        const cached = await this.redisCache.get(cid);

        if (cached && !cached.isEarlyFetch) {
          this.logger.debug('Blob served from Redis', { cid, size: cached.size });

          return {
            data: cached.data,
            contentType: cached.contentType,
            size: cached.size,
            source: 'redis' as const,
            sourcePDS: await this.resolvePDSEndpoint(did),
            isEarlyFetch: false,
          };
        }

        // Early fetch: serve from cache but refresh in background
        if (cached?.isEarlyFetch) {
          this.logger.debug('Probabilistic early fetch from Redis', { cid });

          // Refresh in background (non-blocking)
          this.refreshBlob(did, cid, contentType).catch((error) => {
            this.logger.error(
              'Background refresh failed',
              error instanceof Error ? error : undefined,
              {
                cid,
              }
            );
          });

          return {
            data: cached.data,
            contentType: cached.contentType,
            size: cached.size,
            source: 'redis' as const,
            sourcePDS: await this.resolvePDSEndpoint(did),
            isEarlyFetch: true,
          };
        }

        // L2: Check CDN
        const cdnBlob = await this.cdnAdapter.get(cid);

        if (cdnBlob) {
          this.logger.debug('Blob served from CDN', { cid, size: cdnBlob.length });

          // Cache in L1 for next request
          await this.redisCache.set(cid, cdnBlob, contentType);

          return {
            data: cdnBlob,
            contentType,
            size: cdnBlob.length,
            source: 'cdn' as const,
            sourcePDS: await this.resolvePDSEndpoint(did),
            isEarlyFetch: false,
          };
        }

        // L3: Fetch from PDS with resilience
        const pdsResult = await this.fetchFromPDS(did, cid, contentType);

        if (pdsResult.ok === false) {
          // Convert error Result to exception for coalescer
          throw pdsResult.error;
        }

        return pdsResult.value;
      });

      return { ok: true, value: result };
    } catch (error) {
      return {
        ok: false,
        error: new DatabaseError(
          'FETCH',
          error instanceof Error ? error.message : `Failed to fetch blob: ${String(error)}`
        ),
      };
    }
  }

  /**
   * Fetches blob from PDS with resilience and caching.
   *
   * @param did - Author DID
   * @param cid - Blob CID
   * @param contentType - Content type
   * @returns Blob fetch result
   *
   * @remarks
   * **Resilience:**
   * Uses circuit breaker + retry policy to handle PDS failures gracefully.
   *
   * **CID Verification:**
   * Verifies blob integrity by computing CID and comparing with expected CID.
   *
   * **Caching:**
   * Caches blob in L2 (CDN) and L1 (Redis) after successful fetch.
   *
   * @private
   */
  private async fetchFromPDS(
    did: DID,
    cid: CID,
    contentType: string
  ): Promise<Result<BlobFetchResult, DatabaseError>> {
    this.logger.info('Fetching blob from PDS', { did, cid });

    try {
      // Fetch with resilience (circuit breaker + retry)
      const stream = await this.resiliencePolicy.execute(async () => {
        return await this.repository.getBlob(did, cid);
      });

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      const reader = stream.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }

      // Concatenate chunks
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const buffer = Buffer.allocUnsafe(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        buffer.set(chunk, offset);
        offset += chunk.length;
      }

      // Verify CID integrity
      const verification = await this.cidVerifier.verify(cid, buffer);

      if (!verification.isValid) {
        this.logger.error('CID verification failed', undefined, {
          cid,
          expectedCID: verification.expectedCID,
          computedCID: verification.computedCID,
        });

        return {
          ok: false,
          error: new DatabaseError(
            'FETCH',
            `Blob CID mismatch: expected ${verification.expectedCID}, got ${verification.computedCID}`
          ),
        };
      }

      this.logger.debug('CID verification succeeded', { cid, codec: verification.codec });

      // Get PDS endpoint for tracking
      const sourcePDS = await this.resolvePDSEndpoint(did);

      // Cache in L2 (CDN)
      const cdnResult = await this.cdnAdapter.set(cid, buffer, contentType, sourcePDS);

      if (cdnResult.ok) {
        this.logger.debug('Cached blob in CDN', { cid, size: buffer.length });
      } else if (cdnResult.ok === false) {
        this.logger.warn('Failed to cache blob in CDN', {
          cid,
          error: cdnResult.error.message,
        });
      }

      // Cache in L1 (Redis)
      const redisCached = await this.redisCache.set(cid, buffer, contentType);

      if (redisCached) {
        this.logger.debug('Cached blob in Redis', { cid, size: buffer.length });
      }

      return {
        ok: true,
        value: {
          data: buffer,
          contentType,
          size: buffer.length,
          source: 'pds',
          sourcePDS,
          isEarlyFetch: false,
        },
      };
    } catch (error) {
      this.logger.error('PDS fetch failed', error instanceof Error ? error : undefined, {
        did,
        cid,
      });

      return {
        ok: false,
        error: new DatabaseError(
          'FETCH',
          error instanceof Error ? error.message : `Failed to fetch blob from PDS: ${String(error)}`
        ),
      };
    }
  }

  /**
   * Refreshes blob in cache (background operation).
   *
   * @param did - Author DID
   * @param cid - Blob CID
   * @param contentType - Content type
   * @returns Result indicating success or failure
   *
   * @remarks
   * Used for probabilistic early expiration. Fetches fresh blob from PDS
   * and updates L1 and L2 caches.
   *
   * This method is called in background when Redis cache returns `isEarlyFetch: true`.
   * Errors are logged but not propagated to caller.
   *
   * @private
   */
  private async refreshBlob(
    did: DID,
    cid: CID,
    contentType: string
  ): Promise<Result<void, DatabaseError>> {
    this.logger.debug('Refreshing blob in background', { cid });

    const result = await this.fetchFromPDS(did, cid, contentType);

    if (result.ok === false) {
      return { ok: false, error: result.error };
    }

    return { ok: true, value: undefined };
  }

  /**
   * Gets blob URL with source tracking.
   *
   * @param params - Blob URL parameters
   * @returns Blob URL response with source information
   *
   * @remarks
   * Returns URL for fetching blob, along with transparency information
   * about source PDS and caching status.
   *
   * **Process:**
   * 1. Resolve PDS endpoint from DID
   * 2. Construct direct PDS blob URL
   * 3. If CDN available and not preferDirect, check CDN cache
   * 4. Return appropriate URL with source tracking
   *
   * **Privacy Mode:**
   * When `preferDirect` is true, returns direct PDS URL without CDN
   * caching to avoid tracking.
   *
   * @example
   * ```typescript
   * // Standard (with CDN caching)
   * const response = await service.getBlobUrl({
   *   did, blobRef
   * });
   *
   * // Privacy mode (direct PDS, no CDN)
   * const directResponse = await service.getBlobUrl({
   *   did, blobRef, preferDirect: true
   * });
   * ```
   *
   * @public
   */
  async getBlobUrl(params: BlobUrlParams): Promise<BlobUrlResponse> {
    // 1. Resolve PDS endpoint from DID
    const pdsEndpoint = await this.resolvePDSEndpoint(params.did);

    // 2. Construct direct PDS blob URL
    const cid = this.extractCID(params.blobRef);
    const pdsUrl = `${pdsEndpoint}/xrpc/com.atproto.sync.getBlob?did=${params.did}&cid=${cid}`;

    // 3. Privacy mode: return direct PDS URL
    if (params.preferDirect) {
      return {
        url: pdsUrl,
        source: {
          type: 'pds-direct',
          pdsEndpoint,
          pdsUrl,
        },
        cache: {
          cached: false,
          immutable: true, // CID-addressed content is immutable
        },
        blob: {
          cid,
          mimeType: params.blobRef.mimeType || 'application/pdf',
          size: params.blobRef.size,
        },
      };
    }

    // 4. Check CDN cache
    const cdnUrl = this.cdnAdapter.getPublicURL(cid);
    const cdnCached = await this.cdnAdapter.has(cid);

    if (cdnCached) {
      this.logger.debug('Blob found in CDN cache', { cid });

      return {
        url: cdnUrl,
        source: {
          type: 'cdn-cached',
          pdsEndpoint,
          pdsUrl, // Always include direct PDS URL for transparency
        },
        cache: {
          cached: true,
          cacheUrl: cdnUrl,
          ttl: 31536000, // 1 year (CIDs are immutable)
          immutable: true,
        },
        blob: {
          cid,
          mimeType: params.blobRef.mimeType || 'application/pdf',
          size: params.blobRef.size,
        },
      };
    }

    // 5. Return proxy URL (will fetch from PDS on first access)
    return {
      url: pdsUrl, // Could also be AppView proxy endpoint
      source: {
        type: 'appview-proxy',
        pdsEndpoint,
        pdsUrl,
      },
      cache: {
        cached: false,
        immutable: true,
      },
      blob: {
        cid,
        mimeType: params.blobRef.mimeType ?? 'application/pdf',
        size: params.blobRef.size,
      },
    };
  }

  /**
   * Proxies blob request from PDS (streaming).
   *
   * @param params - Proxy parameters
   * @returns Readable stream of blob data
   *
   * @remarks
   * Fetches blob from 3-tier cache and returns as stream for efficient
   * large file transfer.
   *
   * **ATProto Compliance:**
   * - Fetches from PDS (read-only)
   * - Verifies CID integrity
   * - Never stores authoritatively
   *
   * @example
   * ```typescript
   * const stream = await service.proxyBlob({
   *   did, cid, mimeType: 'application/pdf'
   * });
   *
   * // Pipe to HTTP response
   * return new Response(stream, {
   *   headers: { 'Content-Type': 'application/pdf' }
   * });
   * ```
   *
   * @public
   */
  async proxyBlob(params: ProxyBlobParams): Promise<ReadableStream<Uint8Array>> {
    this.logger.info('Proxying blob', {
      did: params.did,
      cid: params.cid,
    });

    const result = await this.getBlob(params.did, params.cid, params.mimeType ?? 'application/pdf');

    if (result.ok === false) {
      throw result.error;
    }

    // Convert buffer to stream
    return new ReadableStream({
      start(controller) {
        controller.enqueue(result.value.data);
        controller.close();
      },
    });
  }

  /**
   * Purges blob from all cache tiers.
   *
   * @param cid - Blob CID
   * @returns Result indicating success or failure
   *
   * @remarks
   * Rarely needed since CIDs are immutable. Use only if blob was
   * incorrectly cached or CDN corruption detected.
   *
   * Purges from:
   * - L1 (Redis)
   * - L2 (CDN)
   *
   * L3 (PDS) remains unchanged as it's the source of truth.
   *
   * @public
   */
  async purgeCachedBlob(cid: CID): Promise<Result<void, DatabaseError>> {
    this.logger.info('Purging blob from cache', { cid });

    try {
      // Purge from L1 (Redis)
      await this.redisCache.delete(cid);

      // Purge from L2 (CDN)
      const cdnResult = await this.cdnAdapter.delete(cid);

      if (cdnResult.ok === false) {
        this.logger.warn('Failed to purge blob from CDN', {
          cid,
          error: cdnResult.error.message,
        });
      }

      this.logger.info('Purged blob from cache', { cid });
      return { ok: true, value: undefined };
    } catch (error) {
      return {
        ok: false,
        error: new DatabaseError(
          'DELETE',
          error instanceof Error ? error.message : `Failed to purge blob: ${String(error)}`
        ),
      };
    }
  }

  /**
   * Resolves PDS endpoint from DID.
   *
   * @param did - User DID
   * @returns PDS endpoint URL
   *
   * @remarks
   * Uses identity resolver to find user's PDS endpoint from DID document.
   * Results are cached in memory to avoid repeated resolution.
   *
   * Resolution flow:
   * 1. Check in-memory cache
   * 2. Call identity resolver (which may have its own cache)
   * 3. Cache result in memory for subsequent calls
   *
   * @private
   */
  private async resolvePDSEndpoint(did: DID): Promise<string> {
    // Check in-memory cache first
    const cached = this.pdsEndpointCache.get(did);
    if (cached) {
      return cached;
    }

    try {
      // Resolve via identity service
      const endpoint = await this.identity.getPDSEndpoint(did);

      if (endpoint) {
        // Cache for future requests
        this.pdsEndpointCache.set(did, endpoint);
        return endpoint;
      }

      // If identity resolver returns null, throw an error
      // Do NOT fall back to a hardcoded PDS - this would break federation
      throw new IdentityResolutionError(
        `Failed to resolve PDS endpoint for DID: ${did}`,
        did,
        'no_pds'
      );
    } catch (error) {
      this.logger.error('DID resolution failed', error instanceof Error ? error : undefined, {
        did,
      });
      // Re-throw - do NOT fall back to a hardcoded PDS
      throw error;
    }
  }

  /**
   * Extracts CID from BlobRef.
   *
   * @param blobRef - Blob reference
   * @returns CID string
   *
   * @private
   */
  private extractCID(blobRef: BlobRef): CID {
    return blobRef.ref;
  }
}
