/**
 * PDS Discovery service.
 *
 * @remarks
 * Discovers Personal Data Servers (PDSes) from multiple sources:
 * 1. PLC Directory enumeration - Stream all DIDs and extract unique PDS URLs
 * 2. Relay listHosts - Query relays for subscribed PDSes
 * 3. DID mentions - Extract PDSes from DIDs found in indexed records
 *
 * This enables Chive to find records from non-relay PDSes that aren't in the
 * main firehose.
 *
 * @packageDocumentation
 * @public
 */

import { AtpAgent } from '@atproto/api';
import type { Redis } from 'ioredis';
import { injectable, inject } from 'tsyringe';

import { DIDResolver } from '../../auth/did/did-resolver.js';
import type { DID } from '../../types/atproto.js';
import { APIError } from '../../types/errors.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';

import type { IPDSRegistry, DiscoverySource } from './pds-registry.js';

/**
 * Discovered PDS with source information.
 *
 * @public
 */
export interface DiscoveredPDS {
  pdsUrl: string;
  source: DiscoverySource;
  discoveredFrom?: string;
}

/**
 * PLC Directory export entry.
 */
interface PLCExportEntry {
  did: string;
  operation: {
    type: string;
    services?: {
      atproto_pds?: {
        type: string;
        endpoint: string;
      };
    };
  };
  createdAt: string;
}

/**
 * PDS Discovery service configuration.
 *
 * @public
 */
export interface PDSDiscoveryConfig {
  plcDirectoryUrl: string;
  plcRateLimitPerSecond: number;
  enabled: boolean;
}

/**
 * Default configuration.
 */
const DEFAULT_CONFIG: PDSDiscoveryConfig = {
  plcDirectoryUrl: 'https://plc.directory',
  plcRateLimitPerSecond: 5,
  enabled: true,
};

/**
 * PDS Discovery service implementation.
 *
 * @public
 */
@injectable()
export class PDSDiscoveryService {
  private readonly config: PDSDiscoveryConfig;
  private readonly didResolver: DIDResolver;
  private stopEnumeration = false;

  constructor(
    @inject('PDSRegistry') private readonly registry: IPDSRegistry,
    @inject('Logger') private readonly logger: ILogger,
    @inject('Redis') private readonly redis: Redis,
    @inject('PDSDiscoveryConfig') config?: Partial<PDSDiscoveryConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.didResolver = new DIDResolver({ redis: this.redis, logger: this.logger });
  }

  /**
   * Enumerate PDSes from PLC Directory.
   *
   * @remarks
   * Streams the PLC directory export and extracts unique PDS endpoints.
   * Uses rate limiting to avoid overwhelming the directory.
   *
   * @param cursor - Optional cursor to resume from
   * @yields Discovered PDSes
   */
  async *discoverFromPLCDirectory(cursor?: string): AsyncIterable<DiscoveredPDS> {
    if (!this.config.enabled) {
      return;
    }

    this.stopEnumeration = false;
    const seenPDSes = new Set<string>();
    let currentCursor = cursor;
    const delay = 1000 / this.config.plcRateLimitPerSecond;

    this.logger.info('Starting PLC directory enumeration', { cursor });

    try {
      while (!this.stopEnumeration) {
        const url = new URL('/export', this.config.plcDirectoryUrl);
        if (currentCursor) {
          url.searchParams.set('after', currentCursor);
        }

        const response = await fetch(url.toString(), {
          headers: { Accept: 'application/jsonl' },
          signal: AbortSignal.timeout(30000),
        });

        if (!response.ok) {
          throw new APIError(`PLC export failed: ${response.status}`, response.status, '/export');
        }

        const text = await response.text();
        const lines = text.trim().split('\n').filter(Boolean);

        if (lines.length === 0) {
          this.logger.info('PLC enumeration complete, no more entries');
          break;
        }

        for (const line of lines) {
          try {
            const entry = JSON.parse(line) as PLCExportEntry;
            const pdsEndpoint = entry.operation?.services?.atproto_pds?.endpoint;

            if (pdsEndpoint && !seenPDSes.has(pdsEndpoint)) {
              seenPDSes.add(pdsEndpoint);
              yield {
                pdsUrl: pdsEndpoint,
                source: 'plc_enumeration',
                discoveredFrom: entry.did,
              };
            }

            // Update cursor
            currentCursor = entry.createdAt;
          } catch {
            // Skip malformed entries
          }
        }

        // Rate limiting
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    } catch (error) {
      this.logger.error('PLC enumeration failed', error instanceof Error ? error : undefined, {
        cursor: currentCursor,
      });
      throw error;
    }
  }

  /**
   * Stop ongoing PLC enumeration.
   */
  stopPLCEnumeration(): void {
    this.stopEnumeration = true;
  }

  /**
   * Discover PDSes from a relay's listHosts endpoint.
   *
   * @remarks
   * Uses official @atproto/api for the XRPC call.
   *
   * @param relayUrl - Relay URL (e.g., wss://bsky.network)
   * @returns Discovered PDSes
   */
  async discoverFromRelay(relayUrl: string): Promise<DiscoveredPDS[]> {
    try {
      // Convert WebSocket URL to HTTP for the AtpAgent
      const httpUrl = relayUrl.replace('wss://', 'https://').replace('ws://', 'http://');

      // Use official ATProto API client
      const agent = new AtpAgent({ service: httpUrl });
      const response = await agent.com.atproto.sync.listHosts();

      const hosts = response.data.hosts ?? [];

      this.logger.info('Discovered hosts from relay', {
        relayUrl,
        count: hosts.length,
      });

      return hosts.map((host) => ({
        pdsUrl: `https://${host.hostname}`,
        source: 'relay_listhosts' as DiscoverySource,
        discoveredFrom: relayUrl,
      }));
    } catch (error) {
      this.logger.warn('Failed to discover from relay', {
        relayUrl,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Extract PDSes from a list of DIDs.
   *
   * @remarks
   * Resolves each DID and extracts its PDS endpoint.
   * Useful for discovering PDSes from author DIDs in indexed records.
   *
   * @param dids - List of DIDs to resolve
   * @returns Discovered PDSes
   */
  async discoverFromDIDMentions(dids: DID[]): Promise<DiscoveredPDS[]> {
    const seenPDSes = new Set<string>();
    const results: DiscoveredPDS[] = [];

    // Process in batches of 10
    const batchSize = 10;
    for (let i = 0; i < dids.length; i += batchSize) {
      const batch = dids.slice(i, i + batchSize);

      const pdsEndpoints = await Promise.all(
        batch.map(async (did) => {
          try {
            const endpoint = await this.didResolver.getPDSEndpoint(did);
            return { did, endpoint };
          } catch {
            return { did, endpoint: null };
          }
        })
      );

      for (const { did, endpoint } of pdsEndpoints) {
        if (endpoint && !seenPDSes.has(endpoint)) {
          seenPDSes.add(endpoint);
          results.push({
            pdsUrl: endpoint,
            source: 'did_mention',
            discoveredFrom: did,
          });
        }
      }
    }

    this.logger.debug('Discovered PDSes from DID mentions', {
      inputCount: dids.length,
      discoveredCount: results.length,
    });

    return results;
  }

  /**
   * Registers all discovered PDSes to the registry.
   *
   * @param pdses - PDSes to register
   */
  async registerDiscoveredPDSes(pdses: DiscoveredPDS[]): Promise<void> {
    for (const pds of pdses) {
      try {
        await this.registry.registerPDS(pds.pdsUrl, pds.source);
      } catch (error) {
        this.logger.debug('Failed to register discovered PDS', {
          pdsUrl: pds.pdsUrl,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Run a discovery cycle from all sources.
   *
   * @remarks
   * Discovers PDSes from relay listHosts (quick) and registers them.
   * Does NOT run PLC enumeration (which should be done incrementally
   * via a background job).
   *
   * @param relayUrls - Relay URLs to query
   */
  async runDiscoveryCycle(relayUrls: string[]): Promise<{
    discovered: number;
    registered: number;
  }> {
    const allDiscovered: DiscoveredPDS[] = [];

    // Discover from relays (fast)
    for (const relayUrl of relayUrls) {
      const pdses = await this.discoverFromRelay(relayUrl);
      allDiscovered.push(...pdses);
    }

    // Register all discovered PDSes
    await this.registerDiscoveredPDSes(allDiscovered);

    return {
      discovered: allDiscovered.length,
      registered: allDiscovered.length,
    };
  }
}
