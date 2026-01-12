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
import type { IIdentityResolver } from '../../types/interfaces/identity.interface.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import type { Eprint } from '../../types/models/eprint.js';
import type { ActivityService } from '../activity/activity-service.js';
import type { EprintService, RecordMetadata } from '../eprint/eprint-service.js';
import type { KnowledgeGraphService } from '../knowledge-graph/graph-service.js';
import type { ReviewService, ReviewComment, Endorsement } from '../review/review-service.js';

import type { ProcessedEvent } from './indexing-service.js';

/**
 * User tag record from lexicon.
 *
 * @public
 */
export interface UserTagRecord {
  readonly eprintUri: string;
  readonly tag: string;
  readonly createdAt: string;
}

/**
 * Actor profile record from lexicon.
 *
 * @public
 */
export interface ActorProfileRecord {
  readonly displayName?: string;
  readonly bio?: string;
  readonly avatarBlobRef?: { readonly ref: { readonly $link: string } };
  readonly orcid?: string;
  readonly affiliations?: readonly string[];
  readonly fieldIds?: readonly string[];
}

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
   * Eprint service for indexing eprints.
   */
  readonly eprintService: EprintService;

  /**
   * Review service for indexing comments and endorsements.
   */
  readonly reviewService: ReviewService;

  /**
   * Knowledge graph service for proposals and votes.
   */
  readonly graphService: KnowledgeGraphService;

  /**
   * Identity resolver for PDS URL lookup.
   */
  readonly identity: IIdentityResolver;

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
  const { pool, activity, eprintService, reviewService, graphService, identity, logger } =
    options;

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

    // Resolve PDS URL from DID for metadata
    const pdsUrl = await identity.getPDSEndpoint(repo as DID);

    // Process the record based on collection type
    await processRecord(
      {
        pool,
        eprintService,
        reviewService,
        graphService,
        logger,
      },
      {
        uri,
        repo: repo as DID,
        collection: collection as NSID,
        rkey,
        action,
        cid: cid as CID | undefined,
        record,
        pdsUrl: pdsUrl ?? 'unknown',
      }
    );

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
 * Services context for record processing.
 *
 * @internal
 */
interface ProcessRecordContext {
  readonly pool: Pool;
  readonly eprintService: EprintService;
  readonly reviewService: ReviewService;
  readonly graphService: KnowledgeGraphService;
  readonly logger: ILogger;
}

/**
 * Record data with metadata for processing.
 *
 * @internal
 */
interface RecordData {
  readonly uri: AtUri;
  readonly repo: DID;
  readonly collection: NSID;
  readonly rkey: string;
  readonly action: 'create' | 'update' | 'delete';
  readonly cid?: CID;
  readonly record?: unknown;
  readonly pdsUrl: string;
}

/**
 * Processes a record for indexing.
 *
 * @internal
 */
async function processRecord(ctx: ProcessRecordContext, data: RecordData): Promise<void> {
  const { eprintService, reviewService, graphService, pool, logger } = ctx;
  const { uri, cid, collection, action, record, pdsUrl } = data;

  // Build metadata for indexing
  const metadata: RecordMetadata = {
    uri,
    cid: cid ?? ('' as CID),
    pdsUrl,
    indexedAt: new Date(),
  };

  // Route to appropriate handler based on collection
  switch (collection) {
    case 'pub.chive.eprint.submission': {
      logger.debug('Processing eprint submission', { action, uri });

      if (action === 'delete') {
        const result = await eprintService.indexEprintDelete(uri);
        if (!result.ok) {
          logger.error('Failed to delete eprint', result.error as Error, { uri });
        }
      } else if (record) {
        const eprintRecord = record as Eprint;
        const result =
          action === 'update'
            ? await eprintService.indexEprintUpdate(uri, eprintRecord, metadata)
            : await eprintService.indexEprint(eprintRecord, metadata);
        if (!result.ok) {
          logger.error('Failed to index eprint', result.error as Error, { uri, action });
        }
      }
      break;
    }

    case 'pub.chive.review.comment': {
      logger.debug('Processing review comment', { action, uri });

      if (action === 'delete') {
        // Delete review from index
        await pool.query('DELETE FROM reviews_index WHERE uri = $1', [uri]);
        logger.info('Deleted review from index', { uri });
      } else if (record) {
        const commentRecord = record as ReviewComment;
        const result = await reviewService.indexReview(commentRecord, metadata);
        if (!result.ok) {
          logger.error('Failed to index review', result.error as Error, { uri, action });
        }
      }
      break;
    }

    case 'pub.chive.review.endorsement': {
      logger.debug('Processing endorsement', { action, uri });

      if (action === 'delete') {
        // Delete endorsement from index
        await pool.query('DELETE FROM endorsements_index WHERE uri = $1', [uri]);
        logger.info('Deleted endorsement from index', { uri });
      } else if (record) {
        const endorsementRecord = record as Endorsement;
        const result = await reviewService.indexEndorsement(endorsementRecord, metadata);
        if (!result.ok) {
          logger.error('Failed to index endorsement', result.error as Error, { uri, action });
        }
      }
      break;
    }

    case 'pub.chive.eprint.tag':
    case 'pub.chive.eprint.userTag': {
      logger.debug('Processing tag', { action, uri });

      if (action === 'delete') {
        // Delete tag from index
        await pool.query('DELETE FROM user_tags_index WHERE uri = $1', [uri]);
        logger.info('Deleted tag from index', { uri });
      } else if (record) {
        const tagRecord = record as UserTagRecord;
        // Extract tagger DID from AT URI (format: at://did:xxx/collection/rkey)
        const taggerDid = uri.split('/')[2];

        await pool.query(
          `INSERT INTO user_tags_index (
            uri, cid, eprint_uri, tagger_did, tag, created_at, pds_url, indexed_at, last_synced_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
          ON CONFLICT (uri) DO UPDATE SET
            cid = EXCLUDED.cid,
            tag = EXCLUDED.tag,
            last_synced_at = NOW()`,
          [
            uri,
            cid ?? '',
            tagRecord.eprintUri,
            taggerDid,
            tagRecord.tag,
            new Date(tagRecord.createdAt),
            pdsUrl,
          ]
        );
        logger.info('Indexed tag', { uri, eprintUri: tagRecord.eprintUri, tag: tagRecord.tag });
      }
      break;
    }

    case 'pub.chive.graph.fieldProposal': {
      logger.debug('Processing field proposal', { action, uri });

      if (action !== 'delete' && record) {
        const result = await graphService.indexFieldProposal(record, metadata);
        if (!result.ok) {
          logger.error('Failed to index field proposal', result.error as Error, { uri, action });
        }
      }
      break;
    }

    case 'pub.chive.graph.vote': {
      logger.debug('Processing vote', { action, uri });

      if (action !== 'delete' && record) {
        const result = await graphService.indexVote(record, metadata);
        if (!result.ok) {
          logger.error('Failed to index vote', result.error as Error, { uri, action });
        }
      }
      break;
    }

    case 'pub.chive.actor.profile': {
      logger.debug('Processing actor profile', { action, uri });

      if (action === 'delete') {
        // Delete profile from index
        const did = data.repo;
        await pool.query('DELETE FROM authors_index WHERE did = $1', [did]);
        logger.info('Deleted actor profile from index', { did });
      } else if (record) {
        const profileRecord = record as ActorProfileRecord;
        const did = data.repo;

        await pool.query(
          `INSERT INTO authors_index (
            did, handle, display_name, bio, avatar_blob_cid, orcid, affiliations, field_ids,
            pds_url, indexed_at, last_synced_at
          ) VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
          ON CONFLICT (did) DO UPDATE SET
            display_name = EXCLUDED.display_name,
            bio = EXCLUDED.bio,
            avatar_blob_cid = EXCLUDED.avatar_blob_cid,
            orcid = EXCLUDED.orcid,
            affiliations = EXCLUDED.affiliations,
            field_ids = EXCLUDED.field_ids,
            pds_url = EXCLUDED.pds_url,
            last_synced_at = NOW()`,
          [
            did,
            profileRecord.displayName ?? null,
            profileRecord.bio ?? null,
            profileRecord.avatarBlobRef?.ref.$link ?? null,
            profileRecord.orcid ?? null,
            profileRecord.affiliations ?? [],
            profileRecord.fieldIds ?? [],
            pdsUrl,
          ]
        );
        logger.info('Indexed actor profile', { did, displayName: profileRecord.displayName });
      }
      break;
    }

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
  const { pool, activity, eprintService, reviewService, graphService, identity, logger } =
    options;

  return async (events: readonly ProcessedEvent[]): Promise<void> => {
    // Process records
    for (const event of events) {
      const uri = `at://${event.repo}/${event.collection}/${event.rkey}` as AtUri;
      const pdsUrl = await identity.getPDSEndpoint(event.repo as DID);

      await processRecord(
        { pool, eprintService, reviewService, graphService, logger },
        {
          uri,
          repo: event.repo as DID,
          collection: event.collection as NSID,
          rkey: event.rkey,
          action: event.action,
          cid: event.cid as CID | undefined,
          record: event.record,
          pdsUrl: pdsUrl ?? 'unknown',
        }
      );
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
