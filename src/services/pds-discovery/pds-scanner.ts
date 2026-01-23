/**
 * PDS Scanner service.
 *
 * @remarks
 * Scans Personal Data Servers for pub.chive.* records and indexes them
 * via the existing indexing pipeline. This catches records that don't
 * appear in the relay firehose.
 *
 * Uses `@atproto/api` AtpAgent for type-safe ATProto communication.
 *
 * @packageDocumentation
 * @public
 */

import { AtpAgent } from '@atproto/api';
import { injectable } from 'tsyringe';

import {
  pdsMetrics,
  withSpan,
  addSpanAttributes,
  recordSpanError,
} from '../../observability/index.js';
import type { AtUri, DID, CID } from '../../types/atproto.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import type { EprintService, RecordMetadata } from '../eprint/eprint-service.js';
import { transformPDSRecord } from '../eprint/pds-record-transformer.js';

import type { IPDSRegistry, ScanResult } from './pds-registry.js';

/**
 * PDS Scanner configuration.
 *
 * @public
 */
export interface PDSScannerConfig {
  requestsPerMinute: number;
  scanTimeoutMs: number;
  maxRecordsPerPDS: number;
}

/**
 * Default scanner configuration.
 */
const DEFAULT_CONFIG: PDSScannerConfig = {
  requestsPerMinute: 10,
  scanTimeoutMs: 60000,
  maxRecordsPerPDS: 1000,
};

/**
 * Record from listRecords response.
 */
interface ListRecordsRecord {
  uri: string;
  cid: string;
  value: Record<string, unknown>;
}

/**
 * PDS Scanner service implementation.
 *
 * @remarks
 * Uses AtpAgent for type-safe ATProto communication, following the same
 * pattern as ATRepository in the codebase.
 *
 * @public
 */
@injectable()
export class PDSScanner {
  private readonly registry: IPDSRegistry;
  private readonly eprintService: EprintService;
  private readonly logger: ILogger;
  private readonly config: PDSScannerConfig;

  /**
   * Cache of AtpAgent instances per PDS endpoint.
   * Agents are reused for efficiency.
   */
  private readonly agentCache = new Map<string, AtpAgent>();

  constructor(
    registry: IPDSRegistry,
    eprintService: EprintService,
    logger: ILogger,
    config?: Partial<PDSScannerConfig>
  ) {
    this.registry = registry;
    this.eprintService = eprintService;
    this.logger = logger;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Gets or creates an AtpAgent for a PDS endpoint.
   *
   * @param pdsUrl - PDS endpoint URL
   * @returns AtpAgent instance
   */
  private getOrCreateAgent(pdsUrl: string): AtpAgent {
    let agent = this.agentCache.get(pdsUrl);
    if (!agent) {
      agent = new AtpAgent({ service: pdsUrl });
      this.agentCache.set(pdsUrl, agent);
      this.logger.debug('Created new AtpAgent for PDS', { pdsUrl });
    }
    return agent;
  }

  /**
   * Scans a PDS for Chive records.
   *
   * @param pdsUrl - PDS endpoint URL
   * @returns Scan result with record count
   */
  async scanPDS(pdsUrl: string): Promise<ScanResult> {
    return withSpan(
      'pds.scan',
      async () => {
        this.logger.info('Starting PDS scan', { pdsUrl });
        addSpanAttributes({
          'pds.url': pdsUrl,
        });

        const endTimer = pdsMetrics.scanDuration.startTimer();

        try {
          // Mark scan as started
          await this.registry.markScanStarted(pdsUrl);

          // First, get list of repos on this PDS
          const repos = await this.listReposOnPDS(pdsUrl);

          if (repos.length === 0) {
            this.logger.debug('No repos found on PDS', { pdsUrl });
            const result = { hasChiveRecords: false, chiveRecordCount: 0 };
            await this.registry.markScanCompleted(pdsUrl, result);
            pdsMetrics.scansTotal.inc({ status: 'success' });
            endTimer({ status: 'success' });
            addSpanAttributes({
              'pds.repos_count': 0,
              'pds.records_indexed': 0,
            });
            return result;
          }

          this.logger.debug('Found repos on PDS', { pdsUrl, count: repos.length });
          addSpanAttributes({ 'pds.repos_count': repos.length });

          // Scan each repo for Chive records
          let totalRecords = 0;
          const delay = 60000 / this.config.requestsPerMinute;

          for (const did of repos) {
            if (totalRecords >= this.config.maxRecordsPerPDS) {
              this.logger.debug('Reached max records limit', {
                pdsUrl,
                limit: this.config.maxRecordsPerPDS,
              });
              break;
            }

            const records = await this.scanRepoForChiveRecords(pdsUrl, did);
            totalRecords += records;

            // Rate limiting
            if (repos.length > 1) {
              await new Promise((resolve) => setTimeout(resolve, delay));
            }
          }

          const result: ScanResult = {
            hasChiveRecords: totalRecords > 0,
            chiveRecordCount: totalRecords,
            nextScanHours: totalRecords > 0 ? 24 : 168, // 1 day if has records, 7 days otherwise
          };

          await this.registry.markScanCompleted(pdsUrl, result);

          this.logger.info('PDS scan completed', {
            pdsUrl,
            totalRecords,
            reposScanned: repos.length,
          });

          pdsMetrics.scansTotal.inc({ status: 'success' });
          endTimer({ status: 'success' });
          addSpanAttributes({
            'pds.records_indexed': totalRecords,
            'pds.has_chive_records': result.hasChiveRecords,
          });

          return result;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          await this.registry.markScanFailed(pdsUrl, errorMessage);

          this.logger.error('PDS scan failed', error instanceof Error ? error : undefined, {
            pdsUrl,
          });

          pdsMetrics.scansTotal.inc({ status: 'error' });
          endTimer({ status: 'error' });
          if (error instanceof Error) {
            recordSpanError(error);
          }

          throw error;
        }
      },
      { attributes: { 'pds.operation': 'scan' } }
    );
  }

  /**
   * Lists all repositories on a PDS using cursor-based pagination.
   *
   * @remarks
   * Uses AtpAgent.com.atproto.sync.listRepos for type-safe API calls.
   *
   * @param pdsUrl - PDS endpoint URL
   * @returns List of DIDs on this PDS
   */
  private async listReposOnPDS(pdsUrl: string): Promise<DID[]> {
    const allDids: DID[] = [];
    let cursor: string | undefined;
    const pageSize = 1000; // ATProto allows up to 1000 per page
    const agent = this.getOrCreateAgent(pdsUrl);

    try {
      while (true) {
        const response = await agent.com.atproto.sync.listRepos({
          limit: pageSize,
          cursor,
        });

        const repos = response.data.repos ?? [];
        for (const repo of repos) {
          allDids.push(repo.did as DID);
        }

        this.logger.debug('Listed repos page', {
          pdsUrl,
          pageSize: repos.length,
          totalSoFar: allDids.length,
          hasCursor: !!response.data.cursor,
        });

        // Check if we've hit the max limit
        if (allDids.length >= this.config.maxRecordsPerPDS) {
          this.logger.debug('Reached max repos limit', {
            pdsUrl,
            limit: this.config.maxRecordsPerPDS,
          });
          break;
        }

        // No more pages
        if (!response.data.cursor || repos.length === 0) {
          break;
        }

        cursor = response.data.cursor;

        // Rate limiting between pages
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      this.logger.info('Listed all repos on PDS', { pdsUrl, totalRepos: allDids.length });
      return allDids;
    } catch (error) {
      // Handle specific error cases
      if (this.isNotImplementedOrBadRequest(error)) {
        this.logger.debug('PDS does not support listRepos', { pdsUrl });
        return [];
      }

      this.logger.debug('Failed to list repos on PDS', {
        pdsUrl,
        error: error instanceof Error ? error.message : String(error),
        reposFoundSoFar: allDids.length,
      });
      // Return whatever we found so far
      return allDids;
    }
  }

  /**
   * Scans a single DID's repo for Chive records.
   *
   * @remarks
   * Use this method when you know a specific DID has Chive records,
   * e.g., when a user registers their PDS.
   *
   * @param pdsUrl - PDS endpoint URL
   * @param did - Repo DID
   * @returns Number of records indexed
   *
   * @public
   */
  async scanDID(pdsUrl: string, did: DID): Promise<number> {
    this.logger.info('Scanning specific DID for Chive records', { pdsUrl, did });
    return this.scanRepoForChiveRecords(pdsUrl, did);
  }

  /**
   * Scans a single repo for Chive records.
   *
   * @param pdsUrl - PDS endpoint URL
   * @param did - Repo DID
   * @returns Number of records indexed
   */
  private async scanRepoForChiveRecords(pdsUrl: string, did: DID): Promise<number> {
    const collections = [
      'pub.chive.eprint.submission',
      'pub.chive.review.comment',
      'pub.chive.review.endorsement',
    ];

    let totalIndexed = 0;

    for (const collection of collections) {
      try {
        const records = await this.listRecordsForCollection(pdsUrl, did, collection);

        for (const record of records) {
          const indexed = await this.indexRecord(pdsUrl, did, collection, record);
          if (indexed) {
            totalIndexed++;
          }
        }
      } catch (error) {
        this.logger.debug('Failed to scan collection', {
          pdsUrl,
          did,
          collection,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return totalIndexed;
  }

  /**
   * Lists records for a specific collection using AtpAgent.
   *
   * @remarks
   * Uses AtpAgent.com.atproto.repo.listRecords for type-safe API calls.
   * Gracefully handles non-existent collections (400/404 responses).
   *
   * @param pdsUrl - PDS endpoint URL
   * @param did - Repo DID
   * @param collection - Collection NSID
   * @returns Array of records
   */
  private async listRecordsForCollection(
    pdsUrl: string,
    did: DID,
    collection: string
  ): Promise<ListRecordsRecord[]> {
    const allRecords: ListRecordsRecord[] = [];
    let cursor: string | undefined;
    const agent = this.getOrCreateAgent(pdsUrl);

    while (true) {
      try {
        const response = await agent.com.atproto.repo.listRecords({
          repo: did,
          collection,
          limit: 100,
          cursor,
        });

        const records = response.data.records;

        for (const record of records) {
          allRecords.push({
            uri: record.uri,
            cid: record.cid,
            value: record.value as Record<string, unknown>,
          });
        }

        if (!response.data.cursor || records.length === 0) {
          break;
        }

        cursor = response.data.cursor;
      } catch (error) {
        // Handle 400/404 gracefully - collection doesn't exist or invalid request
        if (this.isNotFoundOrBadRequest(error)) {
          break;
        }
        throw error;
      }
    }

    return allRecords;
  }

  /**
   * Checks if error indicates 400 Bad Request or 501 Not Implemented.
   *
   * @param error - Error to check
   * @returns True if 400 or 501 error
   */
  private isNotImplementedOrBadRequest(error: unknown): boolean {
    if (typeof error === 'object' && error !== null) {
      const err = error as Record<string, unknown>;
      const status = err.status ?? err.statusCode;
      if (status === 400 || status === 501) {
        return true;
      }
    }
    return false;
  }

  /**
   * Checks if error indicates 400 Bad Request or 404 Not Found.
   *
   * @remarks
   * Some PDSes return 400 instead of 404 for non-existent collections.
   *
   * @param error - Error to check
   * @returns True if 400 or 404 error
   */
  private isNotFoundOrBadRequest(error: unknown): boolean {
    if (typeof error === 'object' && error !== null) {
      const err = error as Record<string, unknown>;
      const status = err.status ?? err.statusCode;
      if (status === 400 || status === 404) {
        return true;
      }
    }
    return false;
  }

  /**
   * Indexes a single record via the existing pipeline.
   *
   * @param pdsUrl - PDS endpoint URL
   * @param did - Repo DID
   * @param collection - Collection NSID
   * @param record - Record data
   * @returns Whether the record was successfully indexed
   */
  private async indexRecord(
    pdsUrl: string,
    _did: DID,
    collection: string,
    record: ListRecordsRecord
  ): Promise<boolean> {
    return withSpan(
      'pds.index_record',
      async () => {
        addSpanAttributes({
          'record.uri': record.uri,
          'record.collection': collection,
        });
        pdsMetrics.recordsScanned.inc({ collection });

        const endTimer = pdsMetrics.recordIndexDuration.startTimer({ collection });

        try {
          // Only handle eprint submissions for now
          if (collection !== 'pub.chive.eprint.submission') {
            pdsMetrics.scansTotal.inc({ status: 'skipped' });
            endTimer({ status: 'skipped' });
            return false;
          }

          // Transform the PDS record to our format
          let transformed;
          try {
            transformed = transformPDSRecord(record.value, record.uri as AtUri, record.cid as CID);
          } catch (err) {
            this.logger.debug('Record transformation failed', { uri: record.uri });
            pdsMetrics.recordsIndexed.inc({ collection, status: 'error' });
            endTimer({ status: 'error' });
            if (err instanceof Error) {
              recordSpanError(err, 'Record transformation failed');
            }
            return false;
          }

          // Build metadata
          const metadata: RecordMetadata = {
            uri: record.uri as AtUri,
            cid: record.cid as CID,
            pdsUrl,
            indexedAt: new Date(),
          };

          // Index via existing pipeline
          const result = await this.eprintService.indexEprint(transformed, metadata);

          if (result.ok) {
            this.logger.info('Indexed record from PDS scan', { uri: record.uri });
            pdsMetrics.recordsIndexed.inc({ collection, status: 'success' });
            endTimer({ status: 'success' });
            addSpanAttributes({ 'record.indexed': true });
            return true;
          } else {
            this.logger.debug('Failed to index record', {
              uri: record.uri,
              error: result.error.message,
            });
            pdsMetrics.recordsIndexed.inc({ collection, status: 'error' });
            endTimer({ status: 'error' });
            addSpanAttributes({ 'record.indexed': false, 'record.error': result.error.message });
            return false;
          }
        } catch (error) {
          this.logger.debug('Record indexing error', {
            uri: record.uri,
            error: error instanceof Error ? error.message : String(error),
          });
          pdsMetrics.recordsIndexed.inc({ collection, status: 'error' });
          endTimer({ status: 'error' });
          if (error instanceof Error) {
            recordSpanError(error);
          }
          return false;
        }
      },
      { attributes: { 'pds.operation': 'index_record' } }
    );
  }

  /**
   * Scans multiple PDSes in sequence.
   *
   * @param pdsUrls - PDS URLs to scan
   * @param concurrency - Number of concurrent scans
   * @returns Results for each PDS
   */
  async scanMultiplePDSes(
    pdsUrls: string[],
    concurrency = 1
  ): Promise<Map<string, ScanResult | Error>> {
    const results = new Map<string, ScanResult | Error>();
    const queue = [...pdsUrls];

    const worker = async (): Promise<void> => {
      while (queue.length > 0) {
        const pdsUrl = queue.shift();
        if (!pdsUrl) break;

        try {
          const result = await this.scanPDS(pdsUrl);
          results.set(pdsUrl, result);
        } catch (error) {
          results.set(pdsUrl, error instanceof Error ? error : new Error(String(error)));
        }
      }
    };

    // Run concurrent workers
    const workers = Array.from({ length: concurrency }, () => worker());
    await Promise.all(workers);

    return results;
  }
}
