/**
 * DID resolver implementation using official ATProto identity library.
 *
 * @remarks
 * Uses `@atproto/identity` for DID and handle resolution with Redis caching.
 * This is the recommended approach per ATProto best practices.
 *
 * @packageDocumentation
 * @public
 */

import { IdResolver, type DidCache, type CacheResult, type DidDocument } from '@atproto/identity';
import type { Redis } from 'ioredis';

import type { DID } from '../../types/atproto.js';
import type {
  DIDDocument as ChiveDIDDocument,
  IIdentityResolver,
} from '../../types/interfaces/identity.interface.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';

/**
 * DID resolver configuration.
 *
 * @public
 */
export interface DIDResolverConfig {
  /**
   * PLC directory URL.
   *
   * @defaultValue 'https://plc.directory'
   */
  readonly plcDirectoryUrl?: string;

  /**
   * Cache TTL in seconds.
   *
   * @defaultValue 300 (5 minutes)
   */
  readonly cacheTtlSeconds?: number;

  /**
   * Request timeout in milliseconds.
   *
   * @defaultValue 10000
   */
  readonly timeoutMs?: number;

  /**
   * Whether to cache failed resolutions.
   *
   * @defaultValue true
   */
  readonly cacheFailures?: boolean;

  /**
   * Failed resolution cache TTL in seconds.
   *
   * @defaultValue 60
   */
  readonly failureCacheTtlSeconds?: number;
}

/**
 * DID resolver options.
 *
 * @public
 */
export interface DIDResolverOptions {
  /**
   * Redis client for caching.
   */
  readonly redis: Redis;

  /**
   * Logger instance.
   */
  readonly logger: ILogger;

  /**
   * Configuration options.
   */
  readonly config?: DIDResolverConfig;
}

/**
 * Default configuration values.
 */
const DEFAULT_CONFIG: Required<DIDResolverConfig> = {
  plcDirectoryUrl: 'https://plc.directory',
  cacheTtlSeconds: 300,
  timeoutMs: 10000,
  cacheFailures: true,
  failureCacheTtlSeconds: 60,
};

/**
 * Redis key prefixes.
 */
const CACHE_PREFIX = 'chive:did:';
const HANDLE_PREFIX = 'chive:handle:';
const FAILURE_PREFIX = 'chive:did:fail:';

/**
 * Redis-backed DID cache for @atproto/identity.
 */
class RedisDIDCache implements DidCache {
  constructor(
    private readonly redis: Redis,
    private readonly ttlSeconds: number,
    private readonly logger: ILogger
  ) {}

  async cacheDid(did: string, doc: DidDocument, _prevResult?: CacheResult): Promise<void> {
    const cacheResult: CacheResult = {
      did,
      doc,
      updatedAt: Date.now(),
      stale: false,
      expired: false,
    };
    await this.redis.setex(`${CACHE_PREFIX}${did}`, this.ttlSeconds, JSON.stringify(cacheResult));
  }

  async checkCache(did: string): Promise<CacheResult | null> {
    const cached = await this.redis.get(`${CACHE_PREFIX}${did}`);
    if (!cached) {
      return null;
    }

    try {
      const result = JSON.parse(cached) as CacheResult;
      const age = Date.now() - result.updatedAt;
      const ttlMs = this.ttlSeconds * 1000;

      // Mark as stale if > 80% of TTL has passed
      result.stale = age > ttlMs * 0.8;
      // Mark as expired if > 100% of TTL has passed
      result.expired = age > ttlMs;

      return result;
    } catch {
      return null;
    }
  }

  async refreshCache(
    did: string,
    getDoc: () => Promise<DidDocument | null>,
    prevResult?: CacheResult
  ): Promise<void> {
    try {
      const doc = await getDoc();
      if (doc) {
        await this.cacheDid(did, doc, prevResult);
      }
    } catch (error) {
      this.logger.debug('Failed to refresh DID cache', {
        did,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async clearEntry(did: string): Promise<void> {
    await this.redis.del(`${CACHE_PREFIX}${did}`);
  }

  async clear(): Promise<void> {
    // Use SCAN to find and delete all cached DIDs
    let cursor = '0';
    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        `${CACHE_PREFIX}*`,
        'COUNT',
        100
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } while (cursor !== '0');
  }
}

/**
 * DID resolver using official @atproto/identity library.
 *
 * @remarks
 * Uses the official ATProto identity library for proper DID/handle resolution.
 * Caches results in Redis for performance.
 *
 * @example
 * ```typescript
 * const resolver = new DIDResolver({
 *   redis,
 *   logger,
 *   config: { cacheTtlSeconds: 600 },
 * });
 *
 * const doc = await resolver.resolveDID(did);
 * if (doc) {
 *   const pdsUrl = await resolver.getPDSEndpoint(did);
 * }
 * ```
 *
 * @public
 */
export class DIDResolver implements IIdentityResolver {
  private readonly redis: Redis;
  private readonly logger: ILogger;
  private readonly config: Required<DIDResolverConfig>;
  private readonly idResolver: IdResolver;

  /**
   * Creates a new DIDResolver using @atproto/identity.
   *
   * @param options - Resolver options
   */
  constructor(options: DIDResolverOptions) {
    this.redis = options.redis;
    this.logger = options.logger;
    this.config = { ...DEFAULT_CONFIG, ...options.config };

    // Create Redis-backed cache for ATProto identity library
    const didCache = new RedisDIDCache(this.redis, this.config.cacheTtlSeconds, this.logger);

    // Initialize the official ATProto identity resolver
    this.idResolver = new IdResolver({
      plcUrl: this.config.plcDirectoryUrl,
      timeout: this.config.timeoutMs,
      didCache,
    });
  }

  /**
   * Resolves a DID to its DID document.
   *
   * @param did - DID to resolve
   * @returns DID document or null if not found
   */
  async resolveDID(did: DID): Promise<ChiveDIDDocument | null> {
    // Check if this is a known failed resolution
    if (this.config.cacheFailures) {
      const failed = await this.redis.get(`${FAILURE_PREFIX}${did}`);
      if (failed) {
        return null;
      }
    }

    try {
      const doc = await this.idResolver.did.resolve(did);
      if (!doc) {
        if (this.config.cacheFailures) {
          await this.cacheFailure(did);
        }
        return null;
      }

      // Convert ATProto DIDDocument to Chive's interface
      return this.convertToChiveDIDDocument(did, doc);
    } catch (error) {
      this.logger.warn('DID resolution failed', {
        did,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (this.config.cacheFailures) {
        await this.cacheFailure(did);
      }

      throw error;
    }
  }

  /**
   * Resolves a handle to its DID.
   *
   * @param handle - Handle to resolve (e.g., "alice.bsky.social")
   * @returns DID or null if not found
   */
  async resolveHandle(handle: string): Promise<DID | null> {
    // Normalize handle (remove @ prefix if present)
    const normalizedHandle = handle.startsWith('@') ? handle.slice(1) : handle;

    // Check cache first
    const cached = await this.redis.get(`${HANDLE_PREFIX}${normalizedHandle}`);
    if (cached) {
      return cached as DID;
    }

    try {
      const did = await this.idResolver.handle.resolve(normalizedHandle);
      if (did) {
        // Cache the handle -> DID mapping
        await this.redis.setex(
          `${HANDLE_PREFIX}${normalizedHandle}`,
          this.config.cacheTtlSeconds,
          did
        );
        return did as DID;
      }
      return null;
    } catch (error) {
      this.logger.warn('Handle resolution failed', {
        handle: normalizedHandle,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Gets PDS endpoint URL for a DID.
   *
   * @param did - DID
   * @returns PDS URL or null if not found
   */
  async getPDSEndpoint(did: DID): Promise<string | null> {
    try {
      // Use the official ATProto method to get PDS endpoint
      const atprotoData = await this.idResolver.did.resolveAtprotoData(did);
      return atprotoData.pds;
    } catch (error) {
      this.logger.debug('Failed to get PDS endpoint', {
        did,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Gets ATProto data for a DID (includes handle, PDS, signing key).
   *
   * @param did - DID
   * @returns ATProto data or null if not found
   */
  async getAtprotoData(
    did: DID
  ): Promise<{ did: string; handle: string; pds: string; signingKey: string } | null> {
    try {
      return await this.idResolver.did.resolveAtprotoData(did);
    } catch {
      return null;
    }
  }

  /**
   * Converts ATProto DIDDocument to Chive's interface.
   */
  private convertToChiveDIDDocument(did: DID, doc: DidDocument): ChiveDIDDocument {
    return {
      id: did,
      alsoKnownAs: doc.alsoKnownAs,
      verificationMethod: doc.verificationMethod
        ? doc.verificationMethod.map((vm) => ({
            id: vm.id,
            type: vm.type,
            controller: vm.controller as DID,
            publicKeyMultibase: vm.publicKeyMultibase,
          }))
        : [],
      service: doc.service?.map((s) => ({
        id: s.id,
        type: s.type,
        // serviceEndpoint can be string or object in ATProto, but Chive expects string
        serviceEndpoint:
          typeof s.serviceEndpoint === 'string'
            ? s.serviceEndpoint
            : JSON.stringify(s.serviceEndpoint),
      })),
    };
  }

  /**
   * Caches a failed resolution.
   */
  private async cacheFailure(did: DID): Promise<void> {
    await this.redis.setex(`${FAILURE_PREFIX}${did}`, this.config.failureCacheTtlSeconds, '1');
  }

  /**
   * Clears cache for a specific DID.
   *
   * @param did - DID to clear cache for
   */
  async clearCache(did: DID): Promise<void> {
    await this.idResolver.did.cache?.clearEntry(did);
    await this.redis.del(`${FAILURE_PREFIX}${did}`);
  }

  /**
   * Clears handle cache.
   *
   * @param handle - Handle to clear cache for
   */
  async clearHandleCache(handle: string): Promise<void> {
    const normalizedHandle = handle.startsWith('@') ? handle.slice(1) : handle;
    await this.redis.del(`${HANDLE_PREFIX}${normalizedHandle}`);
  }
}
