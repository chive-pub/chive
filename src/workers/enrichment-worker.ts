/**
 * Enrichment worker for background eprint enrichment.
 *
 * @remarks
 * Background worker using BullMQ for async eprint enrichment.
 * Fetches metadata from Semantic Scholar and OpenAlex, indexes
 * citations to Neo4j, and updates eprint records.
 *
 * **Processing Flow:**
 * 1. Receive enrichment job with eprint URI/DOI/arXiv ID
 * 2. Fetch data from Semantic Scholar (citations, influence)
 * 3. Fetch data from OpenAlex (concepts, topics)
 * 4. Index Chive-to-Chive citations in Neo4j
 * 5. Update eprint record with enrichment data
 * 6. Emit `eprint.enriched` event
 *
 * **ATProto Compliance:**
 * - Read-only external API access
 * - All data is cached/derived, not source of truth
 * - Works without external APIs (graceful degradation)
 *
 * @example
 * ```typescript
 * const worker = new EnrichmentWorker({
 *   redis: { host: 'localhost', port: 6379 },
 *   discoveryService,
 *   eventBus,
 *   logger,
 * });
 *
 * await worker.start();
 *
 * // Queue enrichment job
 * await EnrichmentWorker.enqueue(queue, {
 *   uri: 'at://did:plc:example/pub.chive.eprint.submission/abc',
 *   doi: '10.1234/example',
 * });
 * ```
 *
 * @packageDocumentation
 * @public
 */

import { Queue, Worker, Job } from 'bullmq';
import type { ConnectionOptions } from 'bullmq';
import type { EventEmitter2 as EventEmitter2Type } from 'eventemitter2';

import type { AtUri } from '../types/atproto.js';
import { APIError } from '../types/errors.js';
import type {
  IDiscoveryService,
  EnrichmentResult,
} from '../types/interfaces/discovery.interface.js';
import type { ILogger } from '../types/interfaces/logger.interface.js';

/**
 * Queue names.
 */
export const ENRICHMENT_QUEUE_NAME = 'eprint-enrichment';

/**
 * Job priority levels.
 */
export const EnrichmentPriority = {
  /** User-triggered (claimed paper) - highest priority */
  CLAIMED: 1,
  /** Recently indexed eprint */
  INDEXED: 5,
  /** Background re-enrichment */
  BACKGROUND: 10,
} as const;

/**
 * Enrichment job data.
 *
 * @public
 */
export interface EnrichmentJobData {
  /**
   * AT-URI of the eprint to enrich.
   */
  readonly uri: AtUri;

  /**
   * DOI for external API lookup.
   */
  readonly doi?: string;

  /**
   * arXiv ID for external API lookup.
   */
  readonly arxivId?: string;

  /**
   * Eprint title for text-based classification.
   */
  readonly title?: string;

  /**
   * Eprint abstract for text-based classification.
   */
  readonly abstract?: string;

  /**
   * Job priority level.
   */
  readonly priority?: number;

  /**
   * Trigger source for logging.
   */
  readonly source?: 'indexed' | 'claimed' | 'manual' | 'reprocess';
}

/**
 * Enrichment worker configuration.
 *
 * @public
 */
export interface EnrichmentWorkerOptions {
  /**
   * Redis connection options.
   */
  readonly redis: ConnectionOptions;

  /**
   * Discovery service for enrichment operations.
   */
  readonly discoveryService: IDiscoveryService;

  /**
   * Event bus for emitting enrichment events.
   */
  readonly eventBus: EventEmitter2Type;

  /**
   * Logger instance.
   */
  readonly logger: ILogger;

  /**
   * Number of concurrent jobs.
   *
   * @defaultValue 5
   */
  readonly concurrency?: number;

  /**
   * Rate limit: max jobs per duration.
   *
   * @remarks
   * Limits processing to respect external API rate limits.
   * S2: 1 req/sec with key, OpenAlex: 10 req/sec.
   *
   * @defaultValue 5
   */
  readonly rateLimit?: number;

  /**
   * Rate limit duration (ms).
   *
   * @defaultValue 1000
   */
  readonly rateLimitDuration?: number;

  /**
   * Maximum retry attempts.
   *
   * @defaultValue 3
   */
  readonly maxRetries?: number;

  /**
   * Base delay for retry backoff (ms).
   *
   * @defaultValue 5000
   */
  readonly retryDelay?: number;
}

/**
 * Enrichment worker metrics.
 *
 * @public
 */
export interface EnrichmentMetrics {
  readonly processed: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly waiting: number;
  readonly active: number;
}

/**
 * Enrichment worker for background eprint enrichment.
 *
 * @remarks
 * Processes enrichment jobs asynchronously using BullMQ.
 * Respects external API rate limits and handles failures gracefully.
 *
 * **Key Features:**
 * - Async job processing with BullMQ
 * - Rate limiting to respect external API limits
 * - Retry with exponential backoff
 * - Priority queue (claimed papers first)
 * - Event emission on completion
 *
 * @public
 */
export class EnrichmentWorker {
  private readonly worker: Worker<EnrichmentJobData>;
  private readonly queue: Queue<EnrichmentJobData>;
  private readonly logger: ILogger;
  private readonly discoveryService: IDiscoveryService;
  private readonly eventBus: EventEmitter2Type;

  private processedCount = 0;
  private succeededCount = 0;
  private failedCount = 0;

  /**
   * Creates an enrichment worker.
   *
   * @param options - Worker configuration
   */
  constructor(options: EnrichmentWorkerOptions) {
    this.logger = options.logger.child({ service: 'enrichment-worker' });
    this.discoveryService = options.discoveryService;
    this.eventBus = options.eventBus;

    const concurrency = options.concurrency ?? 5;
    const rateLimit = options.rateLimit ?? 5;
    const rateLimitDuration = options.rateLimitDuration ?? 1000;
    const maxRetries = options.maxRetries ?? 3;
    const retryDelay = options.retryDelay ?? 5000;

    // Create queue
    this.queue = new Queue<EnrichmentJobData>(ENRICHMENT_QUEUE_NAME, {
      connection: options.redis,
      defaultJobOptions: {
        attempts: maxRetries + 1,
        backoff: {
          type: 'exponential',
          delay: retryDelay,
        },
        removeOnComplete: {
          age: 86400, // Keep completed jobs for 24 hours
          count: 10000,
        },
        removeOnFail: {
          age: 604800, // Keep failed jobs for 7 days
        },
      },
    });

    // Create worker
    this.worker = new Worker<EnrichmentJobData>(
      ENRICHMENT_QUEUE_NAME,
      async (job: Job<EnrichmentJobData>) => {
        return this.processJob(job);
      },
      {
        connection: options.redis,
        concurrency,
        limiter: {
          max: rateLimit,
          duration: rateLimitDuration,
        },
      }
    );

    // Set up event handlers
    this.setupEventHandlers();
  }

  /**
   * Sets up worker event handlers.
   */
  private setupEventHandlers(): void {
    this.worker.on('completed', (job, result: EnrichmentResult) => {
      this.processedCount++;
      this.succeededCount++;

      this.logger.debug('Enrichment job completed', {
        uri: job.data.uri,
        s2Id: result.semanticScholarId,
        oaId: result.openAlexId,
        citationsIndexed: result.chiveCitationsIndexed,
      });

      // Emit enrichment event
      this.eventBus.emit('eprint.enriched', {
        uri: job.data.uri,
        result,
        source: job.data.source ?? 'indexed',
      });
    });

    this.worker.on('failed', (job, error) => {
      this.processedCount++;
      this.failedCount++;

      this.logger.warn('Enrichment job failed', {
        uri: job?.data.uri,
        error: error.message,
        attempts: job?.attemptsMade,
      });
    });

    this.worker.on('error', (error) => {
      this.logger.error('Worker error', error);
    });
  }

  /**
   * Processes a single enrichment job.
   *
   * @param job - BullMQ job
   * @returns Enrichment result
   */
  private async processJob(job: Job<EnrichmentJobData>): Promise<EnrichmentResult> {
    const { uri, doi, arxivId, title, abstract, source } = job.data;

    this.logger.debug('Processing enrichment job', {
      uri,
      doi,
      arxivId,
      source,
      attempt: job.attemptsMade,
    });

    // Call discovery service for enrichment
    const result = await this.discoveryService.enrichEprint({
      uri,
      doi,
      arxivId,
      title: title ?? '',
      abstract,
    });

    if (!result.success) {
      throw new APIError(result.error ?? 'Enrichment failed', undefined, 'enrichment');
    }

    return result;
  }

  /**
   * Enqueues an eprint for enrichment.
   *
   * @param job - Enrichment job data
   * @returns Job ID
   *
   * @example
   * ```typescript
   * const jobId = await worker.enqueue({
   *   uri: eprintUri,
   *   doi: '10.1234/example',
   *   source: 'indexed',
   * });
   * ```
   */
  async enqueue(job: EnrichmentJobData): Promise<string> {
    const priority = job.priority ?? EnrichmentPriority.INDEXED;

    const bullJob = await this.queue.add('enrich', job, {
      priority,
      jobId: `enrich:${job.uri}`, // Dedupe by URI
    });

    this.logger.debug('Enqueued enrichment job', {
      uri: job.uri,
      jobId: bullJob.id,
      priority,
    });

    return bullJob.id ?? '';
  }

  /**
   * Static method to enqueue from external code.
   *
   * @param queue - BullMQ queue instance
   * @param job - Enrichment job data
   * @returns Job ID
   */
  static async enqueueJob(
    queue: Queue<EnrichmentJobData>,
    job: EnrichmentJobData
  ): Promise<string> {
    const priority = job.priority ?? EnrichmentPriority.INDEXED;

    const bullJob = await queue.add('enrich', job, {
      priority,
      jobId: `enrich:${job.uri}`,
    });

    return bullJob.id ?? '';
  }

  /**
   * Gets worker metrics.
   *
   * @returns Current metrics
   */
  async getMetrics(): Promise<EnrichmentMetrics> {
    const [waiting, active] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
    ]);

    return {
      processed: this.processedCount,
      succeeded: this.succeededCount,
      failed: this.failedCount,
      waiting,
      active,
    };
  }

  /**
   * Pauses the worker.
   */
  async pause(): Promise<void> {
    await this.worker.pause();
    this.logger.info('Enrichment worker paused');
  }

  /**
   * Resumes the worker.
   */
  resume(): void {
    this.worker.resume();
    this.logger.info('Enrichment worker resumed');
  }

  /**
   * Checks if worker is paused.
   */
  isPaused(): boolean {
    return this.worker.isPaused();
  }

  /**
   * Gets the queue instance for external enqueueing.
   */
  getQueue(): Queue<EnrichmentJobData> {
    return this.queue;
  }

  /**
   * Closes the worker and queue.
   */
  async close(): Promise<void> {
    this.logger.info('Closing enrichment worker...');
    await this.worker.close();
    await this.queue.close();
    this.logger.info('Enrichment worker closed');
  }

  /**
   * Drains the queue (waits for all jobs to complete).
   */
  async drain(): Promise<void> {
    this.logger.info('Draining enrichment queue...');
    await this.queue.drain();
    this.logger.info('Enrichment queue drained');
  }
}

/**
 * Creates an enrichment queue for external enqueueing.
 *
 * @param redis - Redis connection options
 * @returns Configured queue
 *
 * @example
 * ```typescript
 * const queue = createEnrichmentQueue({ host: 'localhost', port: 6379 });
 *
 * // In indexing pipeline
 * await EnrichmentWorker.enqueueJob(queue, {
 *   uri: eprintUri,
 *   doi: eprint.doi,
 *   source: 'indexed',
 * });
 * ```
 */
export function createEnrichmentQueue(redis: ConnectionOptions): Queue<EnrichmentJobData> {
  return new Queue<EnrichmentJobData>(ENRICHMENT_QUEUE_NAME, {
    connection: redis,
    defaultJobOptions: {
      attempts: 4,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: {
        age: 86400,
        count: 10000,
      },
      removeOnFail: {
        age: 604800,
      },
    },
  });
}
