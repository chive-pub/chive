/**
 * DID resolver implementation using AT Protocol.
 *
 * @remarks
 * Resolves DIDs to DID documents, handles to DIDs, and extracts PDS endpoints.
 * Uses caching via Redis to reduce resolution latency.
 *
 * @packageDocumentation
 * @public
 */

import type { Redis } from 'ioredis';

import type { DID } from '../../types/atproto.js';
import type { DIDDocument, IIdentityResolver } from '../../types/interfaces/identity.interface.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import { DIDResolutionError } from '../errors.js';

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
 * DID resolver implementing IIdentityResolver.
 *
 * @remarks
 * Resolves did:plc and did:web DIDs using the AT Protocol standards.
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

  /**
   * Creates a new DIDResolver.
   *
   * @param options - Resolver options
   */
  constructor(options: DIDResolverOptions) {
    this.redis = options.redis;
    this.logger = options.logger;
    this.config = { ...DEFAULT_CONFIG, ...options.config };
  }

  /**
   * Resolves a DID to its DID document.
   *
   * @param did - DID to resolve
   * @returns DID document or null if not found
   */
  async resolveDID(did: DID): Promise<DIDDocument | null> {
    // Check cache first
    const cached = await this.getCachedDocument(did);
    if (cached !== undefined) {
      return cached;
    }

    // Check if this is a known failed resolution
    if (this.config.cacheFailures) {
      const failed = await this.redis.get(`${FAILURE_PREFIX}${did}`);
      if (failed) {
        return null;
      }
    }

    try {
      const doc = await this.fetchDIDDocument(did);
      if (doc) {
        await this.cacheDocument(did, doc);
      } else if (this.config.cacheFailures) {
        await this.cacheFailure(did);
      }
      return doc;
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
      const did = await this.fetchHandleToDID(normalizedHandle);
      if (did) {
        // Cache the handle -> DID mapping
        await this.redis.setex(
          `${HANDLE_PREFIX}${normalizedHandle}`,
          this.config.cacheTtlSeconds,
          did
        );
      }
      return did;
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
    const doc = await this.resolveDID(did);
    if (!doc) {
      return null;
    }

    return this.extractPDSEndpoint(doc);
  }

  /**
   * Extracts PDS endpoint from DID document.
   *
   * @param doc - DID document
   * @returns PDS URL or null
   */
  private extractPDSEndpoint(doc: DIDDocument): string | null {
    if (!doc.service) {
      return null;
    }

    // Look for ATProto PDS service
    const pdsService = doc.service.find(
      (s) =>
        s.type === 'AtprotoPersonalDataServer' ||
        s.id === '#atproto_pds' ||
        s.id.endsWith('#atproto_pds')
    );

    return pdsService?.serviceEndpoint ?? null;
  }

  /**
   * Fetches DID document from appropriate resolver.
   *
   * @param did - DID to resolve
   * @returns DID document or null
   */
  private async fetchDIDDocument(did: DID): Promise<DIDDocument | null> {
    if (did.startsWith('did:plc:')) {
      return this.fetchPLCDocument(did);
    } else if (did.startsWith('did:web:')) {
      return this.fetchWebDocument(did);
    } else {
      throw new DIDResolutionError(
        did,
        'invalid_format',
        `Unsupported DID method: ${did.split(':')[1]}`
      );
    }
  }

  /**
   * Fetches DID document from PLC directory.
   *
   * @param did - did:plc DID
   * @returns DID document or null
   */
  private async fetchPLCDocument(did: DID): Promise<DIDDocument | null> {
    const url = `${this.config.plcDirectoryUrl}/${did}`;

    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new DIDResolutionError(
          did,
          'network_error',
          `PLC directory returned ${response.status}`
        );
      }

      const data = (await response.json()) as Record<string, unknown>;
      return this.normalizePLCDocument(did, data);
    } catch (error) {
      if (error instanceof DIDResolutionError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new DIDResolutionError(did, 'timeout', 'PLC directory request timed out', error);
      }

      throw new DIDResolutionError(
        did,
        'network_error',
        `Failed to fetch from PLC directory: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Fetches DID document for did:web.
   *
   * @param did - did:web DID
   * @returns DID document or null
   */
  private async fetchWebDocument(did: DID): Promise<DIDDocument | null> {
    // Extract domain from did:web:domain.com or did:web:domain.com:path
    const didParts = did.slice('did:web:'.length);
    const [domain, ...pathParts] = didParts.split(':');

    if (!domain) {
      throw new DIDResolutionError(did, 'invalid_format', 'Invalid did:web format');
    }

    // Construct URL: https://domain.com/.well-known/did.json or with path
    const path =
      pathParts.length > 0 ? `/${pathParts.join('/')}/did.json` : '/.well-known/did.json';
    const url = `https://${domain}${path}`;

    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new DIDResolutionError(
          did,
          'network_error',
          `did:web server returned ${response.status}`
        );
      }

      const data = (await response.json()) as DIDDocument;

      // Validate that the returned document matches the DID
      if (data.id !== did) {
        throw new DIDResolutionError(
          did,
          'invalid_format',
          `DID document id mismatch: expected ${did}, got ${data.id}`
        );
      }

      return data;
    } catch (error) {
      if (error instanceof DIDResolutionError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new DIDResolutionError(did, 'timeout', 'did:web request timed out', error);
      }

      throw new DIDResolutionError(
        did,
        'network_error',
        `Failed to fetch did:web document: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Normalizes PLC directory response to standard DID document format.
   *
   * @param did - DID being resolved
   * @param data - Raw PLC response
   * @returns Normalized DID document
   */
  private normalizePLCDocument(did: DID, data: Record<string, unknown>): DIDDocument {
    // PLC directory may return in various formats
    // Handle both the direct DID document and the operation log format

    if ('id' in data && data.id === did) {
      // Already a DID document
      return data as unknown as DIDDocument;
    }

    // Extract from alsoKnownAs and services
    const alsoKnownAs = data.alsoKnownAs as string[] | undefined;
    const services = data.service as
      | { id: string; type: string; serviceEndpoint: string }[]
      | undefined;
    const verificationMethods = data.verificationMethod as
      | {
          id: string;
          type: string;
          controller: string;
          publicKeyMultibase?: string;
        }[]
      | undefined;

    return {
      id: did,
      alsoKnownAs: alsoKnownAs,
      verificationMethod:
        verificationMethods?.map((vm) => ({
          id: vm.id,
          type: vm.type,
          controller: vm.controller as DID,
          publicKeyMultibase: vm.publicKeyMultibase,
        })) ?? [],
      service: services?.map((s) => ({
        id: s.id,
        type: s.type,
        serviceEndpoint: s.serviceEndpoint,
      })),
    };
  }

  /**
   * Fetches DID for a handle using DNS or HTTP.
   *
   * @param handle - Handle to resolve
   * @returns DID or null
   */
  private async fetchHandleToDID(handle: string): Promise<DID | null> {
    // First try HTTP method (/.well-known/atproto-did)
    try {
      const httpResult = await this.resolveHandleViaHTTP(handle);
      if (httpResult) {
        return httpResult;
      }
    } catch {
      // Fall through to DNS method
    }

    // Try DNS TXT record method
    try {
      return await this.resolveHandleViaDNS(handle);
    } catch {
      return null;
    }
  }

  /**
   * Resolves handle via HTTP /.well-known/atproto-did.
   *
   * @param handle - Handle to resolve
   * @returns DID or null
   */
  private async resolveHandleViaHTTP(handle: string): Promise<DID | null> {
    const url = `https://${handle}/.well-known/atproto-did`;

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });

      if (!response.ok) {
        return null;
      }

      const text = await response.text();
      const did = text.trim();

      if (!did.startsWith('did:')) {
        return null;
      }

      return did as DID;
    } catch {
      return null;
    }
  }

  /**
   * Resolves handle via DNS TXT record.
   *
   * @param handle - Handle to resolve
   * @returns DID or null
   */
  private async resolveHandleViaDNS(handle: string): Promise<DID | null> {
    // Use DNS-over-HTTPS for TXT record lookup
    const dnsUrl = `https://cloudflare-dns.com/dns-query?name=_atproto.${handle}&type=TXT`;

    try {
      const response = await fetch(dnsUrl, {
        headers: {
          Accept: 'application/dns-json',
        },
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as {
        Answer?: { data: string }[];
      };

      if (!data.Answer || data.Answer.length === 0) {
        return null;
      }

      // Find TXT record with did= prefix
      for (const answer of data.Answer) {
        const txt = answer.data.replace(/^"|"$/g, ''); // Remove quotes
        if (txt.startsWith('did=')) {
          const did = txt.slice(4);
          if (did.startsWith('did:')) {
            return did as DID;
          }
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Gets cached DID document.
   *
   * @param did - DID to look up
   * @returns Cached document, null if not found, or undefined if not in cache
   */
  private async getCachedDocument(did: DID): Promise<DIDDocument | null | undefined> {
    const cached = await this.redis.get(`${CACHE_PREFIX}${did}`);
    if (!cached) {
      return undefined;
    }

    try {
      return JSON.parse(cached) as DIDDocument;
    } catch {
      // Invalid cache entry, treat as miss
      return undefined;
    }
  }

  /**
   * Caches a DID document.
   *
   * @param did - DID
   * @param doc - Document to cache
   */
  private async cacheDocument(did: DID, doc: DIDDocument): Promise<void> {
    await this.redis.setex(
      `${CACHE_PREFIX}${did}`,
      this.config.cacheTtlSeconds,
      JSON.stringify(doc)
    );
  }

  /**
   * Caches a failed resolution.
   *
   * @param did - DID that failed
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
    await this.redis.del(`${CACHE_PREFIX}${did}`);
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
