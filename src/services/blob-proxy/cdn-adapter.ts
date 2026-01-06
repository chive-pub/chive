/**
 * CDN adapter for Cloudflare R2 integration.
 *
 * @remarks
 * L2 cache layer using Cloudflare R2 (S3-compatible object storage).
 *
 * **Architecture**:
 * - L1: Redis cache (100MB, 1h TTL, 40-50% hit rate)
 * - L2: Cloudflare R2 (200GB, 24h TTL, 85-90% hit rate)
 * - L3: PDS (source of truth, unlimited)
 *
 * **Cloudflare R2 Benefits**:
 * - Zero egress fees (unlike S3)
 * - S3-compatible API
 * - Global edge distribution
 * - 10ms p50 latency
 *
 * **ATProto Compliance**:
 * - Stores cached copies only, not authoritative data
 * - Includes X-Source-PDS header pointing to origin
 * - TTL-based expiration ensures staleness detection
 * - Can rebuild entire cache from PDSes
 *
 * @packageDocumentation
 * @public
 */

import { Sha256 } from '@aws-crypto/sha256-js';
import { SignatureV4 } from '@aws-sdk/signature-v4';

import type { CID } from '../../types/atproto.js';
import { DatabaseError } from '../../types/errors.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import type { Result } from '../../types/result.js';

/**
 * CDN adapter configuration.
 *
 * @public
 */
export interface CDNAdapterConfig {
  /**
   * Cloudflare R2 endpoint URL.
   *
   * @remarks
   * Format: `https://<account-id>.r2.cloudflarestorage.com`
   */
  readonly endpoint: string;

  /**
   * R2 bucket name.
   *
   * @remarks
   * Create bucket via Cloudflare dashboard or API.
   */
  readonly bucket: string;

  /**
   * R2 access key ID.
   */
  readonly accessKeyId: string;

  /**
   * R2 secret access key.
   */
  readonly secretAccessKey: string;

  /**
   * CDN base URL for public access.
   *
   * @remarks
   * Format: `https://cdn.chive.pub`
   * Points to R2 bucket via custom domain.
   */
  readonly cdnBaseURL: string;

  /**
   * Default cache TTL in seconds.
   *
   * @remarks
   * Default: 86400 (24 hours)
   * L2 cache typically 6-48 hours
   */
  readonly defaultTTL?: number;

  /**
   * Maximum blob size to cache (bytes).
   *
   * @remarks
   * Default: 104857600 (100MB)
   * R2 free tier: 10GB storage, 1M Class A ops/month
   */
  readonly maxBlobSize?: number;

  /**
   * Logger for CDN events.
   */
  readonly logger?: ILogger;
}

/**
 * CDN cache entry metadata.
 *
 * @remarks
 * Stored in R2 object metadata for tracking.
 *
 * @public
 */
export interface CDNCacheMetadata {
  /**
   * CID of cached blob.
   */
  readonly cid: string;

  /**
   * Source PDS URL.
   */
  readonly sourcePDS: string;

  /**
   * When cached (ISO 8601 timestamp).
   */
  readonly cachedAt: string;

  /**
   * Cache TTL in seconds.
   */
  readonly ttl: number;

  /**
   * Content type (MIME type).
   */
  readonly contentType: string;

  /**
   * Blob size in bytes.
   */
  readonly size: number;
}

/**
 * CDN adapter for Cloudflare R2.
 *
 * @remarks
 * Uses S3-compatible API via fetch (no SDK dependency).
 *
 * **S3 API Operations**:
 * - `PUT /{bucket}/{key}` - Upload object
 * - `GET /{bucket}/{key}` - Download object
 * - `HEAD /{bucket}/{key}` - Check existence
 * - `DELETE /{bucket}/{key}` - Remove object
 *
 * **Authentication**:
 * Uses AWS Signature Version 4 (SigV4) for request signing.
 *
 * @example
 * ```typescript
 * const cdn = new CDNAdapter({
 *   endpoint: 'https://abc123.r2.cloudflarestorage.com',
 *   bucket: 'chive-blobs',
 *   accessKeyId: process.env.R2_ACCESS_KEY_ID,
 *   secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
 *   cdnBaseURL: 'https://cdn.chive.pub',
 *   defaultTTL: 86400,
 *   logger
 * });
 *
 * // Cache blob
 * await cdn.set(cid, blobData, 'application/pdf', 'https://user.pds.host');
 *
 * // Retrieve from CDN
 * const blob = await cdn.get(cid);
 * if (blob) {
 *   console.log(`Served from CDN: ${blob.size} bytes`);
 * }
 * ```
 *
 * @public
 */
export class CDNAdapter {
  private readonly endpoint: string;
  private readonly bucket: string;
  private readonly cdnBaseURL: string;
  private readonly defaultTTL: number;
  private readonly maxBlobSize: number;
  private readonly logger?: ILogger;
  private readonly signer: SignatureV4;
  private readonly region: string;

  constructor(config: CDNAdapterConfig) {
    this.endpoint = config.endpoint;
    this.bucket = config.bucket;
    this.cdnBaseURL = config.cdnBaseURL;
    this.defaultTTL = config.defaultTTL ?? 86400;
    this.maxBlobSize = config.maxBlobSize ?? 100 * 1024 * 1024; // 100MB
    this.logger = config.logger;

    // R2 uses 'auto' region; extract from endpoint or default
    this.region = this.extractRegion(config.endpoint);

    // Initialize AWS SigV4 signer for S3-compatible API
    this.signer = new SignatureV4({
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      region: this.region,
      service: 's3',
      sha256: Sha256,
    });
  }

  /**
   * Extracts region from R2 endpoint URL.
   *
   * @param endpoint - R2 endpoint URL
   * @returns Region identifier
   *
   * @remarks
   * Cloudflare R2 uses 'auto' region for automatic routing.
   *
   * @private
   */
  private extractRegion(endpoint: string): string {
    // Cloudflare R2 endpoints use 'auto' region
    // Format: https://<account-id>.r2.cloudflarestorage.com
    if (endpoint.includes('r2.cloudflarestorage.com')) {
      return 'auto';
    }
    // For AWS S3, extract region from endpoint
    // Format: https://s3.<region>.amazonaws.com
    const match = /s3\.([a-z0-9-]+)\.amazonaws\.com/.exec(endpoint);
    if (match?.[1]) {
      return match[1];
    }
    // Default to us-east-1 for compatibility
    return 'us-east-1';
  }

  /**
   * Signs an HTTP request using AWS Signature Version 4.
   *
   * @param method - HTTP method
   * @param url - Full request URL
   * @param headers - Request headers
   * @param body - Optional request body
   * @returns Signed headers to include in request
   *
   * @remarks
   * AWS SigV4 is required for authenticated S3-compatible APIs
   * including Cloudflare R2.
   *
   * The signature is computed from:
   * - HTTP method
   * - Canonical URI
   * - Query string
   * - Headers
   * - Payload hash (SHA-256)
   *
   * @private
   */
  private async signRequest(
    method: string,
    url: string,
    headers: Record<string, string>,
    body?: Buffer | string
  ): Promise<Record<string, string>> {
    const parsedUrl = new URL(url);

    // Build request object for signing
    const request = {
      method,
      protocol: parsedUrl.protocol,
      hostname: parsedUrl.hostname,
      port: parsedUrl.port ? parseInt(parsedUrl.port, 10) : undefined,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: {
        host: parsedUrl.host,
        ...headers,
      },
      body,
    };

    // Sign the request
    const signedRequest = await this.signer.sign(request);

    // Return signed headers
    return signedRequest.headers as Record<string, string>;
  }

  /**
   * Caches blob in CDN.
   *
   * @param cid - Content identifier
   * @param data - Blob data
   * @param contentType - MIME type
   * @param sourcePDS - Source PDS URL
   * @param ttl - Optional TTL override (seconds)
   * @returns Result indicating success or failure
   *
   * @remarks
   * Uses S3 PUT operation with metadata headers.
   *
   * **Metadata Headers**:
   * - `x-amz-meta-cid`: CID
   * - `x-amz-meta-source-pds`: Source PDS URL
   * - `x-amz-meta-cached-at`: Timestamp
   * - `x-amz-meta-ttl`: TTL in seconds
   * - `Cache-Control`: `max-age={ttl}`
   *
   * @public
   */
  async set(
    cid: CID,
    data: Buffer,
    contentType: string,
    sourcePDS: string,
    ttl?: number
  ): Promise<Result<void, DatabaseError>> {
    // Skip caching large blobs
    if (data.length > this.maxBlobSize) {
      this.logger?.debug('Blob too large for CDN', {
        cid,
        size: data.length,
        maxSize: this.maxBlobSize,
      });
      return { ok: true, value: undefined }; // Not an error, just skipped
    }

    const effectiveTTL = ttl ?? this.defaultTTL;
    const key = this.buildKey(cid);
    const url = `${this.endpoint}/${this.bucket}/${key}`;

    const metadata: CDNCacheMetadata = {
      cid,
      sourcePDS,
      cachedAt: new Date().toISOString(),
      ttl: effectiveTTL,
      contentType,
      size: data.length,
    };

    try {
      // Build headers for signing
      const baseHeaders: Record<string, string> = {
        'Content-Type': contentType,
        'Cache-Control': `public, max-age=${effectiveTTL}`,
        'x-amz-meta-cid': metadata.cid,
        'x-amz-meta-source-pds': metadata.sourcePDS,
        'x-amz-meta-cached-at': metadata.cachedAt,
        'x-amz-meta-ttl': metadata.ttl.toString(),
        'x-amz-meta-size': metadata.size.toString(),
      };

      // Sign request with AWS SigV4
      const signedHeaders = await this.signRequest('PUT', url, baseHeaders, data);

      const response = await fetch(url, {
        method: 'PUT',
        headers: signedHeaders,
        body: data,
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger?.error('CDN PUT failed', undefined, {
          cid,
          status: response.status,
          error: errorText,
        });
        return {
          ok: false,
          error: new DatabaseError('WRITE', `CDN PUT failed: ${response.status}`),
        };
      }

      this.logger?.debug('Cached blob in CDN', {
        cid,
        size: data.length,
        ttl: effectiveTTL,
      });

      return { ok: true, value: undefined };
    } catch (error) {
      this.logger?.error('CDN set error', error instanceof Error ? error : undefined, { cid });
      return {
        ok: false,
        error: new DatabaseError('WRITE', error instanceof Error ? error.message : String(error)),
      };
    }
  }

  /**
   * Retrieves blob from CDN.
   *
   * @param cid - Content identifier
   * @returns Blob data or null if not found
   *
   * @remarks
   * Uses S3 GET operation.
   *
   * Returns null if:
   * - Blob not in CDN
   * - Blob expired (past TTL)
   * - CDN error (logged)
   *
   * @public
   */
  async get(cid: CID): Promise<Buffer | null> {
    const key = this.buildKey(cid);
    const url = `${this.endpoint}/${this.bucket}/${key}`;

    try {
      // Sign request with AWS SigV4
      const signedHeaders = await this.signRequest('GET', url, {});

      const response = await fetch(url, {
        method: 'GET',
        headers: signedHeaders,
      });

      if (response.status === 404) {
        this.logger?.debug('CDN miss', { cid });
        return null;
      }

      if (!response.ok) {
        this.logger?.error('CDN GET failed', undefined, {
          cid,
          status: response.status,
        });
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      this.logger?.debug('CDN hit', { cid, size: buffer.length });

      return buffer;
    } catch (error) {
      this.logger?.error('CDN get error', error instanceof Error ? error : undefined, { cid });
      return null;
    }
  }

  /**
   * Checks if blob exists in CDN.
   *
   * @param cid - Content identifier
   * @returns True if exists, false otherwise
   *
   * @remarks
   * Uses S3 HEAD operation (no data transfer).
   *
   * @public
   */
  async has(cid: CID): Promise<boolean> {
    const key = this.buildKey(cid);
    const url = `${this.endpoint}/${this.bucket}/${key}`;

    try {
      // Sign request with AWS SigV4
      const signedHeaders = await this.signRequest('HEAD', url, {});

      const response = await fetch(url, {
        method: 'HEAD',
        headers: signedHeaders,
      });

      return response.ok;
    } catch (error) {
      this.logger?.error('CDN has error', error instanceof Error ? error : undefined, { cid });
      return false;
    }
  }

  /**
   * Deletes blob from CDN.
   *
   * @param cid - Content identifier
   * @returns Result indicating success or failure
   *
   * @remarks
   * Uses S3 DELETE operation.
   *
   * @public
   */
  async delete(cid: CID): Promise<Result<void, DatabaseError>> {
    const key = this.buildKey(cid);
    const url = `${this.endpoint}/${this.bucket}/${key}`;

    try {
      // Sign request with AWS SigV4
      const signedHeaders = await this.signRequest('DELETE', url, {});

      const response = await fetch(url, {
        method: 'DELETE',
        headers: signedHeaders,
      });

      if (!response.ok && response.status !== 404) {
        return {
          ok: false,
          error: new DatabaseError('DELETE', `CDN DELETE failed: ${response.status}`),
        };
      }

      this.logger?.debug('Deleted from CDN', { cid });

      return { ok: true, value: undefined };
    } catch (error) {
      this.logger?.error('CDN delete error', error instanceof Error ? error : undefined, { cid });
      return {
        ok: false,
        error: new DatabaseError('DELETE', error instanceof Error ? error.message : String(error)),
      };
    }
  }

  /**
   * Gets public CDN URL for blob.
   *
   * @param cid - Content identifier
   * @returns Public CDN URL
   *
   * @remarks
   * Returns URL for direct browser access via custom domain.
   *
   * @example
   * ```typescript
   * const url = cdn.getPublicURL(cid);
   * // https://cdn.chive.pub/blobs/bafyreiabc123...
   * ```
   *
   * @public
   */
  getPublicURL(cid: CID): string {
    const key = this.buildKey(cid);
    return `${this.cdnBaseURL}/${key}`;
  }

  /**
   * Builds S3 object key from CID.
   *
   * @param cid - Content identifier
   * @returns S3 object key
   *
   * @remarks
   * Key format: `blobs/{cid}`
   *
   * Prefix `blobs/` enables:
   * - Namespace separation
   * - Lifecycle rules per prefix
   * - Access control per prefix
   *
   * @private
   */
  private buildKey(cid: CID): string {
    return `blobs/${cid}`;
  }
}
