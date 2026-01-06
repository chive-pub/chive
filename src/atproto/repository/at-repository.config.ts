/**
 * Configuration types for ATRepository.
 *
 * @packageDocumentation
 * @public
 */

import type { IPolicy } from 'cockatiel';

import type { IIdentityResolver } from '../../types/interfaces/identity.interface.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';

/**
 * ATRepository configuration.
 *
 * @remarks
 * Configuration options for the AT Protocol repository implementation.
 *
 * @public
 */
export interface ATRepositoryConfig {
  /**
   * Request timeout in milliseconds.
   *
   * @remarks
   * Default: 30000 (30 seconds)
   * Maximum recommended: 60000 (60 seconds)
   *
   * Applies to individual HTTP requests to PDSes. The resilience policy
   * may perform multiple requests with retries, so total operation time
   * can exceed this value.
   */
  readonly timeoutMs?: number;

  /**
   * Maximum blob size to fetch in bytes.
   *
   * @remarks
   * Default: 52428800 (50MB)
   *
   * Blobs exceeding this size will be rejected to prevent memory exhaustion.
   * For very large files, clients should stream directly from PDS.
   */
  readonly maxBlobSize?: number;

  /**
   * Default page size for listing records.
   *
   * @remarks
   * Default: 50
   * Maximum: 100 (ATProto limit)
   *
   * Number of records to fetch per page when using listRecords().
   */
  readonly defaultPageSize?: number;

  /**
   * User-Agent header for PDS requests.
   *
   * @remarks
   * Default: 'Chive-AppView/1.0'
   *
   * Identifies Chive to PDS operators in server logs.
   */
  readonly userAgent?: string;
}

/**
 * ATRepository options.
 *
 * @remarks
 * All required dependencies and optional configuration for ATRepository.
 *
 * @public
 */
export interface ATRepositoryOptions {
  /**
   * Identity resolver for DID-to-PDS endpoint resolution.
   *
   * @remarks
   * Used to resolve DIDs to their DID documents and extract PDS endpoints.
   * Must be a production-ready implementation, not a placeholder.
   */
  readonly identity: IIdentityResolver;

  /**
   * Resilience policy for PDS requests.
   *
   * @remarks
   * Combines circuit breaker and retry logic for handling PDS failures.
   * Use `createResiliencePolicy()` from `src/services/common/resilience.ts`.
   */
  readonly resiliencePolicy: IPolicy;

  /**
   * Logger for repository operations.
   */
  readonly logger: ILogger;

  /**
   * Configuration options.
   */
  readonly config?: ATRepositoryConfig;
}

/**
 * Default configuration values.
 *
 * @internal
 */
export const DEFAULT_CONFIG: Required<ATRepositoryConfig> = {
  timeoutMs: 30000,
  maxBlobSize: 50 * 1024 * 1024, // 50MB
  defaultPageSize: 50,
  userAgent: 'Chive-AppView/1.0',
};
