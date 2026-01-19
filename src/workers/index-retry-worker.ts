/**
 * Index retry worker for failed record indexing.
 *
 * @remarks
 * Background worker using BullMQ to retry failed indexRecord calls.
 * When ES or other services are temporarily unavailable, failed index
 * attempts are queued for automatic retry with exponential backoff.
 *
 * **Processing Flow:**
 * 1. Receive retry job with record URI
 * 2. Resolve DID to PDS endpoint
 * 3. Fetch record from PDS
 * 4. Attempt to index via EprintService
 * 5. On success: job complete
 * 6. On failure: retry with backoff (up to max attempts)
 *
 * **ATProto Compliance:**
 * - READ-ONLY from user PDSes
 * - All indexes rebuildable from source
 *
 * @packageDocumentation
 * @public
 */

import { Queue, Worker, Job } from 'bullmq';
import type { ConnectionOptions } from 'bullmq';

import type { EprintService, RecordMetadata } from '../services/eprint/eprint-service.js';
import { transformPDSRecord } from '../services/eprint/pds-record-transformer.js';
import type { AtUri, CID, DID } from '../types/atproto.js';
import type { ILogger } from '../types/interfaces/logger.interface.js';

/**
 * Queue name.
 */
export const INDEX_RETRY_QUEUE_NAME = 'index-retry';

/**
 * Index retry job data.
 *
 * @public
 */
export interface IndexRetryJobData {
  /**
   * AT-URI of the record to index.
   */
  readonly uri: string;

  /**
   * DID of the record owner.
   */
  readonly did: string;

  /**
   * Collection NSID.
   */
  readonly collection: string;

  /**
   * Record key.
   */
  readonly rkey: string;

  /**
   * PDS URL (if already resolved).
   */
  readonly pdsUrl?: string;

  /**
   * Original error message.
   */
  readonly originalError?: string;

  /**
   * Timestamp of original failure.
   */
  readonly failedAt: string;

  /**
   * User DID who requested the index (for auth context).
   */
  readonly requestedBy?: string;
}

/**
 * Index retry worker configuration.
 *
 * @public
 */
export interface IndexRetryWorkerConfig {
  /**
   * Redis connection options for BullMQ.
   */
  readonly connection: ConnectionOptions;

  /**
   * Eprint service for indexing.
   */
  readonly eprintService: EprintService;

  /**
   * Logger instance.
   */
  readonly logger: ILogger;

  /**
   * Worker concurrency.
   *
   * @defaultValue 3
   */
  readonly concurrency?: number;

  /**
   * Maximum retry attempts.
   *
   * @defaultValue 10
   */
  readonly maxAttempts?: number;

  /**
   * Base delay for exponential backoff in ms.
   *
   * @defaultValue 60000 (1 minute)
   */
  readonly baseDelayMs?: number;
}

/**
 * Resolve DID to PDS endpoint using PLC directory.
 */
async function resolvePdsEndpoint(did: DID): Promise<string | null> {
  try {
    if (did.startsWith('did:plc:')) {
      const response = await fetch(`https://plc.directory/${did}`);
      if (!response.ok) {
        return null;
      }
      const doc = (await response.json()) as {
        service?: { id: string; type: string; serviceEndpoint: string }[];
      };
      const pdsService = doc.service?.find(
        (s) => s.id === '#atproto_pds' || s.type === 'AtprotoPersonalDataServer'
      );
      return pdsService?.serviceEndpoint ?? null;
    }

    if (did.startsWith('did:web:')) {
      const domain = did.replace('did:web:', '').replace(/%3A/g, ':');
      const response = await fetch(`https://${domain}/.well-known/did.json`);
      if (!response.ok) {
        return null;
      }
      const doc = (await response.json()) as {
        service?: { id: string; type: string; serviceEndpoint: string }[];
      };
      const pdsService = doc.service?.find(
        (s) => s.id === '#atproto_pds' || s.type === 'AtprotoPersonalDataServer'
      );
      return pdsService?.serviceEndpoint ?? null;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch a record from a PDS.
 */
async function fetchRecordFromPds(
  pdsUrl: string,
  did: DID,
  collection: string,
  rkey: string
): Promise<{ uri: string; cid: string; value: unknown } | null> {
  try {
    const url = new URL('/xrpc/com.atproto.repo.getRecord', pdsUrl);
    url.searchParams.set('repo', did);
    url.searchParams.set('collection', collection);
    url.searchParams.set('rkey', rkey);

    const response = await fetch(url.toString());
    if (!response.ok) {
      return null;
    }

    const record = (await response.json()) as { uri: string; cid: string; value: unknown };
    return record;
  } catch {
    return null;
  }
}

/**
 * Index retry worker.
 *
 * @public
 */
export class IndexRetryWorker {
  private readonly queue: Queue<IndexRetryJobData>;
  private readonly worker: Worker<IndexRetryJobData>;
  private readonly eprintService: EprintService;
  private readonly logger: ILogger;
  private readonly maxAttempts: number;

  constructor(config: IndexRetryWorkerConfig) {
    this.eprintService = config.eprintService;
    this.logger = config.logger.child({ service: 'index-retry-worker' });
    this.maxAttempts = config.maxAttempts ?? 10;

    const baseDelayMs = config.baseDelayMs ?? 60_000;

    // Create queue
    this.queue = new Queue<IndexRetryJobData>(INDEX_RETRY_QUEUE_NAME, {
      connection: config.connection,
      defaultJobOptions: {
        attempts: this.maxAttempts,
        backoff: {
          type: 'exponential',
          delay: baseDelayMs,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    });

    // Create worker
    this.worker = new Worker<IndexRetryJobData>(
      INDEX_RETRY_QUEUE_NAME,
      async (job: Job<IndexRetryJobData>) => this.processJob(job),
      {
        connection: config.connection,
        concurrency: config.concurrency ?? 3,
      }
    );

    // Set up event handlers
    this.worker.on('completed', (job) => {
      this.logger.info('Index retry job completed', {
        jobId: job.id,
        uri: job.data.uri,
        attempts: job.attemptsMade,
      });
    });

    this.worker.on('failed', (job, err) => {
      if (job) {
        this.logger.error('Index retry job failed', err instanceof Error ? err : undefined, {
          jobId: job.id,
          uri: job.data.uri,
          attempts: job.attemptsMade,
          maxAttempts: this.maxAttempts,
        });
      }
    });
  }

  /**
   * Process a single retry job.
   */
  private async processJob(job: Job<IndexRetryJobData>): Promise<void> {
    const { uri, did, collection, rkey, pdsUrl: cachedPdsUrl } = job.data;

    this.logger.info('Processing index retry job', {
      jobId: job.id,
      uri,
      attempt: job.attemptsMade + 1,
    });

    // Only support eprint submissions
    if (collection !== 'pub.chive.eprint.submission') {
      this.logger.debug('Skipping non-eprint collection', { uri, collection });
      return;
    }

    // Resolve PDS endpoint
    const pdsUrl = cachedPdsUrl ?? (await resolvePdsEndpoint(did as DID));
    if (!pdsUrl) {
      throw new Error(`Failed to resolve PDS endpoint for ${did}`);
    }

    // Fetch record from PDS
    const record = await fetchRecordFromPds(pdsUrl, did as DID, collection, rkey);
    if (!record) {
      throw new Error(`Record not found on PDS: ${uri}`);
    }

    // Build metadata
    const metadata: RecordMetadata = {
      uri: uri as AtUri,
      cid: record.cid as CID,
      pdsUrl,
      indexedAt: new Date(),
    };

    // Transform and index
    const eprintRecord = transformPDSRecord(record.value, uri as AtUri, record.cid as CID);
    const result = await this.eprintService.indexEprint(eprintRecord, metadata);

    if (!result.ok) {
      throw new Error(`Indexing failed: ${result.error.message}`);
    }

    this.logger.info('Successfully indexed record via retry', {
      uri,
      cid: record.cid,
      attempt: job.attemptsMade + 1,
    });
  }

  /**
   * Enqueue a failed index attempt for retry.
   *
   * @param data - Job data
   * @returns Job ID
   */
  async enqueueRetry(data: IndexRetryJobData): Promise<string> {
    const job = await this.queue.add('index-retry', data, {
      jobId: `retry:${data.uri}`,
    });

    this.logger.info('Enqueued index retry job', {
      jobId: job.id,
      uri: data.uri,
      originalError: data.originalError,
    });

    return job.id ?? '';
  }

  /**
   * Check if a retry job already exists for a URI.
   */
  async hasExistingJob(uri: string): Promise<boolean> {
    const job = await this.queue.getJob(`retry:${uri}`);
    return job !== undefined;
  }

  /**
   * Get queue statistics.
   */
  async getStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }

  /**
   * Gracefully close the worker and queue.
   */
  async close(): Promise<void> {
    await this.worker.close();
    await this.queue.close();
    this.logger.info('Index retry worker closed');
  }
}
