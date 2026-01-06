/**
 * Request coalescing to prevent duplicate concurrent requests.
 *
 * @remarks
 * When multiple clients request the same resource simultaneously,
 * coalesce them into a single backend request and broadcast the result.
 *
 * Industry standard pattern used by:
 * - Cloudflare (request collapsing)
 * - Varnish (request coalescing)
 * - NGINX (proxy_cache_lock)
 *
 * **Benefits**:
 * - Reduces backend load during cache miss storms
 * - Prevents thundering herd on origin servers
 * - Improves response times for coalesced requests
 *
 * @packageDocumentation
 * @public
 */

import type { CID } from '../../types/atproto.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';

/**
 * In-flight request state.
 *
 * @internal
 */
interface InFlightRequest<T> {
  /**
   * Promise representing the in-flight request.
   */
  readonly promise: Promise<T>;

  /**
   * Number of coalesced callers waiting for this request.
   */
  callersCount: number;

  /**
   * When the request was initiated (Unix timestamp in milliseconds).
   */
  readonly startedAt: number;
}

/**
 * Request coalescer configuration.
 *
 * @public
 */
export interface RequestCoalescerConfig {
  /**
   * Maximum time to wait for in-flight request (milliseconds).
   *
   * @remarks
   * Default: 30000 (30 seconds)
   * After this timeout, create new request instead of waiting
   */
  readonly maxWaitTime?: number;

  /**
   * Logger for coalescing events.
   */
  readonly logger?: ILogger;
}

/**
 * Request coalescer to prevent duplicate concurrent requests.
 *
 * @remarks
 * **Pattern**:
 * 1. Client A requests resource X → Create new request, store promise
 * 2. Client B requests resource X (while A pending) → Return A's promise
 * 3. Client C requests resource X (while A pending) → Return A's promise
 * 4. Request completes → All clients receive same result
 *
 * **Timeout Handling**:
 * If in-flight request exceeds maxWaitTime, new callers create fresh request
 * instead of waiting. This prevents indefinite blocking on slow requests.
 *
 * @example
 * ```typescript
 * const coalescer = new RequestCoalescer<Buffer>({
 *   maxWaitTime: 30000,
 *   logger
 * });
 *
 * // Multiple concurrent requests for same CID
 * const [result1, result2, result3] = await Promise.all([
 *   coalescer.execute(cid, () => fetchFromPDS(cid)),
 *   coalescer.execute(cid, () => fetchFromPDS(cid)), // Coalesced
 *   coalescer.execute(cid, () => fetchFromPDS(cid)), // Coalesced
 * ]);
 *
 * // Only one fetchFromPDS() call was made
 * ```
 *
 * @public
 */
export class RequestCoalescer<T> {
  private readonly inFlight = new Map<string, InFlightRequest<T>>();
  private readonly maxWaitTime: number;
  private readonly logger?: ILogger;

  constructor(config: RequestCoalescerConfig = {}) {
    this.maxWaitTime = config.maxWaitTime ?? 30000;
    this.logger = config.logger;
  }

  /**
   * Executes request with coalescing.
   *
   * @param key - Request key (typically CID)
   * @param fetcher - Function that performs the actual request
   * @returns Promise resolving to fetcher result
   *
   * @remarks
   * **Coalescing Logic**:
   * 1. Check if request already in-flight for this key
   * 2. If yes and not timed out: Return existing promise
   * 3. If no or timed out: Execute fetcher and store promise
   * 4. Clean up after completion
   *
   * @public
   */
  async execute(key: CID, fetcher: () => Promise<T>): Promise<T> {
    const keyString = String(key);
    const existing = this.inFlight.get(keyString);

    // Check if there's an in-flight request that hasn't timed out
    if (existing) {
      const age = Date.now() - existing.startedAt;

      if (age < this.maxWaitTime) {
        // Join existing request
        existing.callersCount++;

        this.logger?.debug('Request coalesced', {
          key: keyString,
          age,
          callersCount: existing.callersCount,
        });

        return await existing.promise;
      } else {
        // In-flight request has timed out, create new one
        this.logger?.warn('In-flight request timed out, creating new request', {
          key: keyString,
          age,
        });

        this.inFlight.delete(keyString);
      }
    }

    // Create new request
    const promise = this.executeWithCleanup(keyString, fetcher);

    const request: InFlightRequest<T> = {
      promise,
      callersCount: 1,
      startedAt: Date.now(),
    };

    this.inFlight.set(keyString, request);

    this.logger?.debug('Starting new request', { key: keyString });

    return promise;
  }

  /**
   * Executes fetcher and cleans up after completion.
   *
   * @param key - Request key
   * @param fetcher - Function that performs the actual request
   * @returns Promise resolving to fetcher result
   *
   * @remarks
   * Ensures cleanup happens regardless of success/failure.
   *
   * @private
   */
  private async executeWithCleanup(key: string, fetcher: () => Promise<T>): Promise<T> {
    const request = this.inFlight.get(key);
    let succeeded = false;

    try {
      const result = await fetcher();
      succeeded = true;

      if (request) {
        const duration = Date.now() - request.startedAt;

        this.logger?.debug('Request completed', {
          key,
          duration,
          callersCount: request.callersCount,
        });
      }

      return result;
    } finally {
      // Log failure metrics if request did not succeed
      if (!succeeded && request) {
        const duration = Date.now() - request.startedAt;

        this.logger?.error('Request failed', undefined, {
          key,
          duration,
          callersCount: request.callersCount,
        });
      }

      // Always clean up regardless of success/failure
      this.inFlight.delete(key);
    }
  }

  /**
   * Gets current in-flight request count.
   *
   * @returns Number of in-flight requests
   *
   * @public
   */
  getInFlightCount(): number {
    return this.inFlight.size;
  }

  /**
   * Gets total callers count across all in-flight requests.
   *
   * @returns Total number of callers waiting
   *
   * @public
   */
  getTotalCallersCount(): number {
    let total = 0;
    for (const request of this.inFlight.values()) {
      total += request.callersCount;
    }
    return total;
  }

  /**
   * Clears all in-flight request tracking.
   *
   * @remarks
   * Does NOT cancel pending requests, only clears tracking.
   * Use for testing or service shutdown.
   *
   * @public
   */
  clear(): void {
    this.inFlight.clear();
    this.logger?.debug('Cleared request coalescer');
  }
}
