/**
 * Relay host tracker service.
 *
 * @remarks
 * Queries the ATProto relay's `com.atproto.sync.listHosts` endpoint to get
 * the authoritative list of PDSes connected to the relay. This is the
 * industry-standard approach for determining relay connectivity.
 *
 * @see {@link https://docs.bsky.app/blog/relay-sync-updates | Relay Sync Updates}
 * @packageDocumentation
 * @public
 */

import type { Redis } from 'ioredis';

import type { ILogger } from '../../types/interfaces/logger.interface.js';

/**
 * Host entry from relay listHosts response.
 *
 * @public
 */
export interface RelayHost {
  hostname: string;
  accountCount: number;
  seq: number;
  status: 'active' | 'idle' | 'offline';
}

/**
 * Response from com.atproto.sync.listHosts.
 */
interface ListHostsResponse {
  cursor?: string;
  hosts: RelayHost[];
}

/**
 * Relay host tracker configuration.
 *
 * @public
 */
export interface RelayHostTrackerConfig {
  /**
   * Relay URL to query for hosts.
   *
   * @defaultValue 'https://relay1.us-east.bsky.network'
   */
  readonly relayUrl?: string;

  /**
   * Cache TTL in seconds.
   *
   * @defaultValue 3600 (1 hour)
   */
  readonly cacheTtlSeconds?: number;

  /**
   * Request timeout in milliseconds.
   *
   * @defaultValue 30000
   */
  readonly timeoutMs?: number;
}

/**
 * Relay host tracker options.
 *
 * @public
 */
export interface RelayHostTrackerOptions {
  redis: Redis;
  logger: ILogger;
  config?: RelayHostTrackerConfig;
}

const DEFAULT_CONFIG: Required<RelayHostTrackerConfig> = {
  relayUrl: 'https://relay1.us-east.bsky.network',
  cacheTtlSeconds: 3600, // 1 hour
  timeoutMs: 30000,
};

const CACHE_SET_KEY = 'chive:relay:hosts:set';

/**
 * Tracks PDSes connected to the ATProto relay.
 *
 * @remarks
 * Uses the official `com.atproto.sync.listHosts` endpoint to get the
 * authoritative list of relay-connected PDSes. Results are cached in Redis.
 *
 * @example
 * ```typescript
 * const tracker = new RelayHostTracker({ redis, logger });
 *
 * // Check if a PDS is relay-connected
 * const isConnected = await tracker.isRelayConnected('https://amanita.us-east.host.bsky.network');
 *
 * // Refresh the host list
 * await tracker.refresh();
 * ```
 *
 * @public
 */
export class RelayHostTracker {
  private readonly redis: Redis;
  private readonly logger: ILogger;
  private readonly config: Required<RelayHostTrackerConfig>;

  constructor(options: RelayHostTrackerOptions) {
    this.redis = options.redis;
    this.logger = options.logger;
    this.config = { ...DEFAULT_CONFIG, ...options.config };
  }

  /**
   * Checks if a PDS is connected to the relay.
   *
   * @param pdsUrl - PDS endpoint URL (e.g., 'https://amanita.us-east.host.bsky.network')
   * @returns True if the PDS is connected to the relay
   */
  async isRelayConnected(pdsUrl: string): Promise<boolean> {
    // Extract hostname from URL
    const hostname = this.extractHostname(pdsUrl);
    if (!hostname) {
      return false;
    }

    // Check cache first
    const isCached = await this.redis.sismember(CACHE_SET_KEY, hostname);
    if (isCached) {
      return true;
    }

    // Check if cache exists; if not, refresh
    const cacheExists = await this.redis.exists(CACHE_SET_KEY);
    if (!cacheExists) {
      await this.refresh();
      return (await this.redis.sismember(CACHE_SET_KEY, hostname)) === 1;
    }

    return false;
  }

  /**
   * Gets all relay-connected hosts.
   *
   * @returns Array of hostnames connected to the relay
   */
  async getRelayHosts(): Promise<string[]> {
    // Check if cache exists; if not, refresh
    const cacheExists = await this.redis.exists(CACHE_SET_KEY);
    if (!cacheExists) {
      await this.refresh();
    }

    return await this.redis.smembers(CACHE_SET_KEY);
  }

  /**
   * Refreshes the relay host list from the relay endpoint.
   *
   * @remarks
   * Fetches all hosts from `com.atproto.sync.listHosts` and caches them.
   * This is paginated to handle large numbers of PDSes.
   */
  async refresh(): Promise<void> {
    this.logger.info('Refreshing relay host list', { relayUrl: this.config.relayUrl });

    const hosts: string[] = [];
    let cursor: string | undefined;

    try {
      // Paginate through all hosts
      do {
        const response = await this.fetchHostsPage(cursor);
        for (const host of response.hosts) {
          if (host.status === 'active') {
            hosts.push(host.hostname);
          }
        }
        cursor = response.cursor;
      } while (cursor);

      // Update cache atomically
      const pipeline = this.redis.pipeline();
      pipeline.del(CACHE_SET_KEY);
      if (hosts.length > 0) {
        pipeline.sadd(CACHE_SET_KEY, ...hosts);
      }
      pipeline.expire(CACHE_SET_KEY, this.config.cacheTtlSeconds);
      await pipeline.exec();

      this.logger.info('Relay host list refreshed', { hostCount: hosts.length });
    } catch (error) {
      this.logger.error(
        'Failed to refresh relay host list',
        error instanceof Error ? error : undefined,
        {
          relayUrl: this.config.relayUrl,
        }
      );
      throw error;
    }
  }

  /**
   * Fetches a page of hosts from the relay.
   */
  private async fetchHostsPage(cursor?: string): Promise<ListHostsResponse> {
    const url = new URL(`${this.config.relayUrl}/xrpc/com.atproto.sync.listHosts`);
    url.searchParams.set('limit', '1000');
    if (cursor) {
      url.searchParams.set('cursor', cursor);
    }

    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(this.config.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch relay hosts: ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as ListHostsResponse;
  }

  /**
   * Extracts hostname from a PDS URL.
   */
  private extractHostname(pdsUrl: string): string | null {
    try {
      const url = new URL(pdsUrl);
      return url.hostname.toLowerCase();
    } catch {
      return null;
    }
  }
}
