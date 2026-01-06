/**
 * Event processor for firehose indexing with activity correlation.
 *
 * @remarks
 * Processes firehose events and correlates them with user activities
 * logged via the Chive UI.
 *
 * **Processing Flow:**
 * 1. Extract record data from ProcessedEvent
 * 2. Store/update record in appropriate storage backend
 * 3. Correlate with pending user activity (if any)
 *
 * **ATProto Compliance:**
 * - Read-only consumption of firehose
 * - All indexes rebuildable from firehose
 * - PDS source tracking via record origin
 *
 * @packageDocumentation
 * @public
 */

import type { Pool } from 'pg';

import type { AtUri, CID, DID, NSID } from '../../types/atproto.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import type { ActivityService } from '../activity/activity-service.js';

import type { ProcessedEvent } from './indexing-service.js';

/**
 * Event processor configuration.
 *
 * @public
 */
export interface EventProcessorOptions {
  /**
   * PostgreSQL connection pool.
   */
  readonly pool: Pool;

  /**
   * Activity service for correlation.
   */
  readonly activity: ActivityService;

  /**
   * Logger instance.
   */
  readonly logger: ILogger;
}

/**
 * Creates an event processor with activity correlation.
 *
 * @param options - Processor configuration
 * @returns Event processor function
 *
 * @remarks
 * This processor:
 * 1. Processes the firehose event for indexing (storage, search, etc.)
 * 2. Correlates with any pending user activity
 *
 * The correlation uses (repo, collection, rkey) as the key to match
 * pending activities logged by users before their PDS write.
 *
 * @example
 * ```typescript
 * const processor = createEventProcessor({
 *   pool,
 *   activity: activityService,
 *   logger,
 * });
 *
 * const indexingService = new IndexingService({
 *   relay: 'wss://bsky.network',
 *   db: pool,
 *   redis,
 *   processor,
 * });
 * ```
 *
 * @public
 */
export function createEventProcessor(
  options: EventProcessorOptions
): (event: ProcessedEvent) => Promise<void> {
  const { pool, activity, logger } = options;

  return async (event: ProcessedEvent): Promise<void> => {
    const { repo, collection, rkey, action, cid, seq, record } = event;

    logger.debug('Processing firehose event', {
      repo,
      collection,
      rkey,
      action,
      seq,
    });

    // Construct AT URI for this record
    const uri = `at://${repo}/${collection}/${rkey}` as AtUri;

    // Process the record based on collection type
    await processRecord(pool, logger, {
      uri,
      repo: repo as DID,
      collection: collection as NSID,
      rkey,
      action,
      cid: cid as CID | undefined,
      record,
    });

    // Correlate with pending user activity (if this is a create/update)
    if (action === 'create' || action === 'update') {
      await correlateActivity(activity, logger, {
        repo: repo as DID,
        collection: collection as NSID,
        rkey,
        seq,
        uri,
        cid: cid as CID,
      });
    }

    logger.debug('Event processed', {
      repo,
      collection,
      rkey,
      action,
    });
  };
}

/**
 * Processes a record for indexing.
 *
 * @internal
 */
async function processRecord(
  _pool: Pool,
  logger: ILogger,
  record: {
    readonly uri: AtUri;
    readonly repo: DID;
    readonly collection: NSID;
    readonly rkey: string;
    readonly action: 'create' | 'update' | 'delete';
    readonly cid?: CID;
    readonly record?: unknown;
  }
): Promise<void> {
  const { collection, action } = record;

  // Placeholder await for async function (will be replaced when TODOs are implemented)
  await Promise.resolve();

  // Route to appropriate handler based on collection
  switch (collection) {
    case 'pub.chive.preprint.submission':
      logger.debug('Processing preprint submission', { action, uri: record.uri });
      // TODO: Call preprintService.indexPreprint() or similar
      break;

    case 'pub.chive.review.comment':
      logger.debug('Processing review comment', { action, uri: record.uri });
      // TODO: Call reviewService.indexReview() or similar
      break;

    case 'pub.chive.review.endorsement':
      logger.debug('Processing endorsement', { action, uri: record.uri });
      // TODO: Call endorsementService.indexEndorsement() or similar
      break;

    case 'pub.chive.preprint.tag':
      logger.debug('Processing tag', { action, uri: record.uri });
      // TODO: Call tagManager.indexTag() or similar
      break;

    case 'pub.chive.graph.fieldProposal':
    case 'pub.chive.graph.vote':
      logger.debug('Processing governance record', { collection, action, uri: record.uri });
      // TODO: Call governanceService.indexRecord() or similar
      break;

    case 'pub.chive.actor.profile':
      logger.debug('Processing actor profile', { action, uri: record.uri });
      // TODO: Call actorService.indexProfile() or similar
      break;

    default:
      if (collection.startsWith('pub.chive.')) {
        logger.warn('Unhandled Chive collection', { collection, action });
      }
      // Ignore non-Chive collections
      break;
  }
}

/**
 * Correlates firehose event with pending user activity.
 *
 * @internal
 */
async function correlateActivity(
  activity: ActivityService,
  logger: ILogger,
  input: {
    readonly repo: DID;
    readonly collection: NSID;
    readonly rkey: string;
    readonly seq: number;
    readonly uri: AtUri;
    readonly cid: CID;
  }
): Promise<void> {
  try {
    const result = await activity.correlateWithFirehose({
      repo: input.repo,
      collection: input.collection,
      rkey: input.rkey,
      seq: input.seq,
      uri: input.uri,
      cid: input.cid,
    });

    if (result.ok && result.value) {
      logger.info('Correlated activity with firehose', {
        activityId: result.value,
        repo: input.repo,
        collection: input.collection,
        rkey: input.rkey,
      });
    }
  } catch (error) {
    // Log but don't fail the event processing
    logger.warn('Failed to correlate activity', {
      error: error instanceof Error ? error.message : String(error),
      repo: input.repo,
      collection: input.collection,
      rkey: input.rkey,
    });
  }
}

/**
 * Creates a batch processor for efficient correlation.
 *
 * @param options - Processor configuration
 * @returns Batch processor function
 *
 * @remarks
 * Use for batch processing when handling multiple events at once.
 * More efficient than individual correlations.
 *
 * @public
 */
export function createBatchEventProcessor(
  options: EventProcessorOptions
): (events: readonly ProcessedEvent[]) => Promise<void> {
  const { pool, activity, logger } = options;

  return async (events: readonly ProcessedEvent[]): Promise<void> => {
    // Process records
    for (const event of events) {
      const uri = `at://${event.repo}/${event.collection}/${event.rkey}` as AtUri;

      await processRecord(pool, logger, {
        uri,
        repo: event.repo as DID,
        collection: event.collection as NSID,
        rkey: event.rkey,
        action: event.action,
        cid: event.cid as CID | undefined,
        record: event.record,
      });
    }

    // Batch correlate activities
    const createUpdateEvents = events.filter((e) => e.action === 'create' || e.action === 'update');

    if (createUpdateEvents.length > 0) {
      const correlations = createUpdateEvents.map((e) => ({
        repo: e.repo as DID,
        collection: e.collection as NSID,
        rkey: e.rkey,
        seq: e.seq,
        uri: `at://${e.repo}/${e.collection}/${e.rkey}` as AtUri,
        cid: e.cid as CID,
      }));

      try {
        const result = await activity.batchCorrelate(correlations);

        if (result.ok) {
          logger.info('Batch correlated activities', {
            total: createUpdateEvents.length,
            correlated: result.value.size,
          });
        }
      } catch (error) {
        logger.warn('Failed to batch correlate activities', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  };
}
