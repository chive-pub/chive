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
 * 4. Track failures and send to DLQ for retry
 *
 * **Error Handling:**
 * - Critical operations (eprint indexing) throw on failure
 * - Non-critical operations log and track failures
 * - All failures are recorded for DLQ insertion
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

import type {
  NodeKind,
  NodeStatus,
  EdgeStatus,
  ExternalId,
  NodeMetadata,
  EdgeMetadata,
} from '../../storage/neo4j/types.js';
import type { AtUri, CID, DID, NSID } from '../../types/atproto.js';
import { ChiveError, DatabaseError } from '../../types/errors.js';
import type { IIdentityResolver } from '../../types/interfaces/identity.interface.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import type { ActivityService } from '../activity/activity-service.js';
import type { AnnotationService } from '../annotation/annotation-service.js';
import type { EprintService, RecordMetadata } from '../eprint/eprint-service.js';
import { transformPDSRecordWithSchema } from '../eprint/pds-record-transformer.js';
import type { AutomaticProposalService } from '../governance/automatic-proposal-service.js';
import type { EdgeService } from '../governance/edge-service.js';
import type { NodeService } from '../governance/node-service.js';
import type { KnowledgeGraphService } from '../knowledge-graph/graph-service.js';
import type { IPDSRegistry } from '../pds-discovery/pds-registry.js';
import type { ReviewService } from '../review/review-service.js';

import type { DeadLetterQueue, DLQEvent } from './dlq-handler.js';
import type { ProcessedEvent } from './indexing-service.js';

/**
 * Error thrown when event processing fails.
 *
 * @remarks
 * Captures the collection type, URI, and underlying error for debugging
 * and DLQ categorization.
 *
 * @public
 */
export class EventProcessingError extends ChiveError {
  readonly code = 'EVENT_PROCESSING_ERROR';

  /**
   * Collection that failed to process.
   */
  readonly collection: string;

  /**
   * URI of the record that failed.
   */
  readonly uri: string;

  /**
   * Whether this is a critical failure that should stop processing.
   *
   * @remarks
   * Critical failures (e.g., eprint indexing) indicate potential data loss
   * and should be escalated.
   */
  readonly critical: boolean;

  /**
   * Creates a new EventProcessingError.
   *
   * @param message - Description of the failure
   * @param collection - Collection NSID that failed
   * @param uri - AT URI of the record
   * @param critical - Whether this is a critical failure
   * @param cause - Original error
   */
  constructor(message: string, collection: string, uri: string, critical: boolean, cause?: Error) {
    super(message, cause);
    this.collection = collection;
    this.uri = uri;
    this.critical = critical;
  }
}

/**
 * Result of processing a record.
 *
 * @public
 */
export interface ProcessRecordResult {
  /**
   * Whether processing succeeded.
   */
  readonly success: boolean;

  /**
   * URI of the processed record.
   */
  readonly uri: string;

  /**
   * Collection type.
   */
  readonly collection: string;

  /**
   * Error if processing failed.
   */
  readonly error?: EventProcessingError;
}

/**
 * User tag record from lexicon.
 */
export interface UserTagRecord {
  readonly eprintUri: string;
  readonly tag: string;
  readonly createdAt: string;
}

/**
 * Actor profile record from lexicon.
 */
export interface ActorProfileRecord {
  readonly displayName?: string;
  readonly bio?: string;
  readonly avatarBlobRef?: { readonly ref: { readonly $link: string } };
  readonly orcid?: string;
  readonly affiliations?: {
    readonly name: string;
    readonly rorId?: string;
    readonly institutionUri?: string;
  }[];
  readonly fieldIds?: readonly string[];
}

/**
 * Changelog record from lexicon.
 */
export interface ChangelogRecord {
  readonly eprintUri: string;
  readonly version: {
    readonly major: number;
    readonly minor: number;
    readonly patch: number;
    readonly prerelease?: string;
  };
  readonly previousVersion?: {
    readonly major: number;
    readonly minor: number;
    readonly patch: number;
    readonly prerelease?: string;
  };
  readonly summary?: string;
  readonly sections: readonly {
    readonly category: string;
    readonly items: readonly {
      readonly description: string;
      readonly changeType?: string;
      readonly location?: string;
      readonly reviewReference?: string;
    }[];
  }[];
  readonly reviewerResponse?: string;
  readonly createdAt: string;
}

/**
 * Node record from lexicon.
 */
export interface NodeRecord {
  readonly id: string;
  readonly kind: NodeKind;
  readonly subkind?: string;
  readonly subkindUri?: string;
  readonly label: string;
  readonly alternateLabels?: readonly string[];
  readonly description?: string;
  readonly externalIds?: readonly ExternalId[];
  readonly metadata?: NodeMetadata;
  readonly status: NodeStatus;
  readonly deprecatedBy?: string;
  readonly proposalUri?: string;
  readonly createdAt: string;
}

/**
 * Edge record from lexicon.
 */
export interface EdgeRecord {
  readonly id: string;
  readonly sourceUri: string;
  readonly targetUri: string;
  readonly relationUri?: string;
  readonly relationSlug: string;
  readonly weight?: number;
  readonly metadata?: EdgeMetadata;
  readonly status: EdgeStatus;
  readonly proposalUri?: string;
  readonly createdAt: string;
}

/**
 * Event processor configuration.
 */
export interface EventProcessorOptions {
  readonly pool: Pool;
  readonly activity: ActivityService;
  readonly eprintService: EprintService;
  readonly reviewService: ReviewService;
  readonly annotationService?: AnnotationService;
  readonly graphService: KnowledgeGraphService;
  readonly nodeService?: NodeService;
  readonly edgeService?: EdgeService;
  readonly automaticProposalService?: AutomaticProposalService;
  readonly identity: IIdentityResolver;
  readonly logger: ILogger;
  /**
   * Optional PDS registry for automatic PDS discovery.
   * When provided, PDSes discovered during DID resolution are automatically registered.
   */
  readonly pdsRegistry?: IPDSRegistry;
  /**
   * Optional dead letter queue for failed event processing.
   * When provided, failed events are sent to the DLQ for later retry.
   */
  readonly dlq?: DeadLetterQueue;
}

/**
 * Creates an event processor with activity correlation.
 *
 * @param options - Configuration options
 * @returns Event processor function
 *
 * @remarks
 * The processor handles failures as follows:
 * - Critical failures (eprint indexing) throw and send to DLQ
 * - Non-critical failures log and continue, sending to DLQ
 * - All errors are tracked for monitoring
 */
export function createEventProcessor(
  options: EventProcessorOptions
): (event: ProcessedEvent) => Promise<void> {
  const {
    pool,
    activity,
    eprintService,
    reviewService,
    annotationService,
    graphService,
    nodeService,
    edgeService,
    automaticProposalService,
    identity,
    logger,
    pdsRegistry,
    dlq,
  } = options;

  return async (event: ProcessedEvent): Promise<void> => {
    const { repo, collection, rkey, action, cid, seq, record } = event;

    logger.debug('Processing firehose event', {
      repo,
      collection,
      rkey,
      action,
      seq,
    });

    const uri = `at://${repo}/${collection}/${rkey}` as AtUri;
    const pdsUrl = await identity.getPDSEndpoint(repo as DID);

    // Auto-register discovered PDS for future scanning
    if (pdsUrl && pdsRegistry) {
      try {
        await pdsRegistry.registerPDS(pdsUrl, 'did_mention');
      } catch (error) {
        logger.debug('PDS registration skipped', {
          pdsUrl,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const result = await processRecord(
      {
        pool,
        eprintService,
        reviewService,
        annotationService,
        graphService,
        nodeService,
        edgeService,
        automaticProposalService,
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

    // Handle processing failure
    if (!result.success && result.error) {
      // Send to DLQ for retry
      if (dlq) {
        try {
          await dlq.add(event as DLQEvent, result.error, 0);
          logger.info('Event sent to DLQ', {
            uri,
            collection,
            error: result.error.message,
          });
        } catch (dlqError) {
          logger.error(
            'Failed to send event to DLQ',
            dlqError instanceof Error ? dlqError : undefined,
            {
              uri,
              collection,
              originalError: result.error.message,
            }
          );
        }
      }

      // Throw for critical failures to halt processing
      if (result.error.critical) {
        throw result.error;
      }
    }

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
      success: result.success,
    });
  };
}

interface ProcessRecordContext {
  readonly pool: Pool;
  readonly eprintService: EprintService;
  readonly reviewService: ReviewService;
  readonly annotationService?: AnnotationService;
  readonly graphService: KnowledgeGraphService;
  readonly nodeService?: NodeService;
  readonly edgeService?: EdgeService;
  readonly automaticProposalService?: AutomaticProposalService;
  readonly logger: ILogger;
}

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
 * Processes a single record from the firehose.
 *
 * @param ctx - Processing context with services
 * @param data - Record data to process
 * @returns Result indicating success or failure with error details
 *
 * @remarks
 * Critical collections (eprint submissions) are marked as critical failures
 * when they fail, causing the caller to throw and halt processing.
 */
async function processRecord(
  ctx: ProcessRecordContext,
  data: RecordData
): Promise<ProcessRecordResult> {
  const {
    eprintService,
    reviewService,
    annotationService,
    graphService,
    nodeService,
    edgeService,
    automaticProposalService,
    pool,
    logger,
  } = ctx;
  const { uri, cid, collection, action, record, pdsUrl } = data;

  const metadata: RecordMetadata = {
    uri,
    cid: cid ?? ('' as CID),
    pdsUrl,
    indexedAt: new Date(),
  };

  /**
   * Helper to create a success result.
   */
  const success = (): ProcessRecordResult => ({
    success: true,
    uri,
    collection,
  });

  /**
   * Helper to create a failure result.
   */
  const failure = (message: string, critical: boolean, cause?: Error): ProcessRecordResult => ({
    success: false,
    uri,
    collection,
    error: new EventProcessingError(message, collection, uri, critical, cause),
  });

  switch (collection) {
    case 'pub.chive.eprint.submission': {
      logger.debug('Processing eprint submission', { action, uri });

      if (action === 'delete') {
        const result = await eprintService.indexEprintDelete(uri);
        if (!result.ok) {
          const error = result.error as Error;
          logger.error('Failed to delete eprint', error, { uri });
          // Eprint operations are critical
          return failure('Failed to delete eprint', true, error);
        }
      } else if (record) {
        try {
          // Transform PDS record format to internal Eprint model
          // Also capture whether the source uses legacy abstract format
          const transformResult = transformPDSRecordWithSchema(record, uri, cid ?? ('' as CID));
          const eprintRecord = transformResult.eprint;
          const needsAbstractMigration = transformResult.abstractFormat === 'string';

          // Add migration flag to metadata
          const enrichedMetadata: RecordMetadata = {
            ...metadata,
            needsAbstractMigration,
          };

          const result =
            action === 'update'
              ? await eprintService.indexEprintUpdate(uri, eprintRecord, enrichedMetadata)
              : await eprintService.indexEprint(eprintRecord, enrichedMetadata);
          if (!result.ok) {
            const error = result.error as Error;
            logger.error('Failed to index eprint', error, { uri, action });
            // Eprint operations are critical
            return failure(`Failed to ${action} eprint`, true, error);
          }

          // Create automatic governance proposals after successful indexing
          if (automaticProposalService && action === 'create') {
            try {
              await automaticProposalService.processEprintSubmission(eprintRecord, uri);
            } catch (proposalError) {
              // Log but don't fail indexing if proposal creation fails
              logger.error(
                'Failed to create automatic proposals',
                proposalError instanceof Error ? proposalError : undefined,
                { uri, action }
              );
            }
          }
        } catch (transformError) {
          const error =
            transformError instanceof Error ? transformError : new Error(String(transformError));
          logger.error('Failed to transform eprint record', error, { uri, action });
          // Transform failures are critical (indicates schema mismatch)
          return failure('Failed to transform eprint record', true, error);
        }
      }
      return success();
    }

    case 'pub.chive.eprint.changelog': {
      logger.debug('Processing changelog', { action, uri });

      if (action === 'delete') {
        try {
          await pool.query('DELETE FROM changelogs_index WHERE uri = $1', [uri]);
          logger.info('Deleted changelog from index', { uri });
        } catch (dbError) {
          const error = dbError instanceof Error ? dbError : new Error(String(dbError));
          logger.error('Failed to delete changelog', error, { uri });
          return failure(
            'Failed to delete changelog',
            false,
            new DatabaseError('DELETE', error.message, error)
          );
        }
      } else if (record) {
        try {
          const changelogRecord = record as ChangelogRecord;

          await pool.query(
            `INSERT INTO changelogs_index (
              uri, cid, eprint_uri, version, previous_version, summary,
              sections, reviewer_response, created_at, pds_url, indexed_at, last_synced_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
            ON CONFLICT (uri) DO UPDATE SET
              cid = EXCLUDED.cid,
              version = EXCLUDED.version,
              previous_version = EXCLUDED.previous_version,
              summary = EXCLUDED.summary,
              sections = EXCLUDED.sections,
              reviewer_response = EXCLUDED.reviewer_response,
              last_synced_at = NOW()`,
            [
              uri,
              cid ?? '',
              changelogRecord.eprintUri,
              JSON.stringify(changelogRecord.version),
              changelogRecord.previousVersion
                ? JSON.stringify(changelogRecord.previousVersion)
                : null,
              changelogRecord.summary ?? null,
              JSON.stringify(changelogRecord.sections ?? []),
              changelogRecord.reviewerResponse ?? null,
              new Date(changelogRecord.createdAt),
              pdsUrl,
            ]
          );
          logger.info('Indexed changelog', {
            uri,
            eprintUri: changelogRecord.eprintUri,
            version: changelogRecord.version,
          });
        } catch (dbError) {
          const error = dbError instanceof Error ? dbError : new Error(String(dbError));
          logger.error('Failed to index changelog', error, { uri, action });
          return failure(
            'Failed to index changelog',
            false,
            new DatabaseError('INSERT', error.message, error)
          );
        }
      }
      return success();
    }

    case 'pub.chive.review.comment': {
      logger.debug('Processing review comment', { action, uri });

      if (action === 'delete') {
        try {
          await pool.query('DELETE FROM reviews_index WHERE uri = $1', [uri]);
          logger.info('Deleted review from index', { uri });
        } catch (dbError) {
          const error = dbError instanceof Error ? dbError : new Error(String(dbError));
          logger.error('Failed to delete review', error, { uri });
          return failure(
            'Failed to delete review',
            false,
            new DatabaseError('DELETE', error.message, error)
          );
        }
      } else if (record) {
        // Pass record as-is; service validates internally
        const result = await reviewService.indexReview(record, metadata);
        if (!result.ok) {
          const error = result.error as Error;
          logger.error('Failed to index review', error, { uri, action });
          return failure('Failed to index review', false, error);
        }
      }
      return success();
    }

    case 'pub.chive.review.endorsement': {
      logger.debug('Processing endorsement', { action, uri });

      if (action === 'delete') {
        try {
          await pool.query('DELETE FROM endorsements_index WHERE uri = $1', [uri]);
          logger.info('Deleted endorsement from index', { uri });
        } catch (dbError) {
          const error = dbError instanceof Error ? dbError : new Error(String(dbError));
          logger.error('Failed to delete endorsement', error, { uri });
          return failure(
            'Failed to delete endorsement',
            false,
            new DatabaseError('DELETE', error.message, error)
          );
        }
      } else if (record) {
        // Pass record as-is; service validates internally
        const result = await reviewService.indexEndorsement(record, metadata);
        if (!result.ok) {
          const error = result.error as Error;
          logger.error('Failed to index endorsement', error, { uri, action });
          return failure('Failed to index endorsement', false, error);
        }
      }
      return success();
    }

    case 'pub.chive.annotation.comment': {
      logger.debug('Processing annotation comment', { action, uri });

      if (action === 'delete') {
        try {
          await pool.query('DELETE FROM annotations_index WHERE uri = $1', [uri]);
          logger.info('Deleted annotation from index', { uri });
        } catch (dbError) {
          const error = dbError instanceof Error ? dbError : new Error(String(dbError));
          logger.error('Failed to delete annotation', error, { uri });
          return failure(
            'Failed to delete annotation',
            false,
            new DatabaseError('DELETE', error.message, error)
          );
        }
      } else if (record && annotationService) {
        const result = await annotationService.indexAnnotation(record, metadata);
        if (!result.ok) {
          const error = result.error as Error;
          logger.error('Failed to index annotation', error, { uri, action });
          return failure('Failed to index annotation', false, error);
        }
      }
      return success();
    }

    case 'pub.chive.annotation.entityLink': {
      logger.debug('Processing entity link', { action, uri });

      if (action === 'delete') {
        try {
          await pool.query('DELETE FROM entity_links_index WHERE uri = $1', [uri]);
          logger.info('Deleted entity link from index', { uri });
        } catch (dbError) {
          const error = dbError instanceof Error ? dbError : new Error(String(dbError));
          logger.error('Failed to delete entity link', error, { uri });
          return failure(
            'Failed to delete entity link',
            false,
            new DatabaseError('DELETE', error.message, error)
          );
        }
      } else if (record && annotationService) {
        const result = await annotationService.indexEntityLink(record, metadata);
        if (!result.ok) {
          const error = result.error as Error;
          logger.error('Failed to index entity link', error, { uri, action });
          return failure('Failed to index entity link', false, error);
        }
      }
      return success();
    }

    case 'pub.chive.eprint.tag':
    case 'pub.chive.eprint.userTag': {
      logger.debug('Processing tag', { action, uri });

      if (action === 'delete') {
        try {
          await pool.query('DELETE FROM user_tags_index WHERE uri = $1', [uri]);
          logger.info('Deleted tag from index', { uri });
        } catch (dbError) {
          const error = dbError instanceof Error ? dbError : new Error(String(dbError));
          logger.error('Failed to delete tag', error, { uri });
          return failure(
            'Failed to delete tag',
            false,
            new DatabaseError('DELETE', error.message, error)
          );
        }
      } else if (record) {
        try {
          const tagRecord = record as UserTagRecord;
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
        } catch (dbError) {
          const error = dbError instanceof Error ? dbError : new Error(String(dbError));
          logger.error('Failed to index tag', error, { uri, action });
          return failure(
            'Failed to index tag',
            false,
            new DatabaseError('INSERT', error.message, error)
          );
        }
      }
      return success();
    }

    case 'pub.chive.graph.node': {
      logger.debug('Processing node record', { action, uri });

      if (action === 'delete') {
        if (nodeService) {
          try {
            await nodeService.deleteNode(uri);
            logger.info('Deleted node from index', { uri });
          } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.error('Failed to delete node', err, { uri });
            return failure('Failed to delete node', false, err);
          }
        }
      } else if (record && nodeService) {
        const nodeRecord = record as NodeRecord;
        try {
          await nodeService.indexNode({
            id: nodeRecord.id,
            uri,
            kind: nodeRecord.kind,
            subkind: nodeRecord.subkind,
            subkindUri: nodeRecord.subkindUri as AtUri | undefined,
            label: nodeRecord.label,
            alternateLabels: nodeRecord.alternateLabels as string[] | undefined,
            description: nodeRecord.description,
            externalIds: nodeRecord.externalIds as ExternalId[] | undefined,
            metadata: nodeRecord.metadata,
            status: nodeRecord.status,
            deprecatedBy: nodeRecord.deprecatedBy as AtUri | undefined,
            proposalUri: nodeRecord.proposalUri as AtUri | undefined,
            createdBy: data.repo,
          });
          logger.info('Indexed node', { uri, label: nodeRecord.label, kind: nodeRecord.kind });
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          logger.error('Failed to index node', err, { uri, action });
          return failure('Failed to index node', false, err);
        }
      }
      return success();
    }

    case 'pub.chive.graph.edge': {
      logger.debug('Processing edge record', { action, uri });

      if (action === 'delete') {
        if (edgeService) {
          try {
            await edgeService.deleteEdge(uri);
            logger.info('Deleted edge from index', { uri });
          } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.error('Failed to delete edge', err, { uri });
            return failure('Failed to delete edge', false, err);
          }
        }
      } else if (record && edgeService) {
        const edgeRecord = record as EdgeRecord;
        try {
          await edgeService.indexEdge({
            id: edgeRecord.id,
            uri,
            sourceUri: edgeRecord.sourceUri as AtUri,
            targetUri: edgeRecord.targetUri as AtUri,
            relationUri: edgeRecord.relationUri as AtUri | undefined,
            relationSlug: edgeRecord.relationSlug,
            weight: edgeRecord.weight,
            metadata: edgeRecord.metadata,
            status: edgeRecord.status,
            proposalUri: edgeRecord.proposalUri as AtUri | undefined,
            createdBy: data.repo,
          });
          logger.info('Indexed edge', {
            uri,
            sourceUri: edgeRecord.sourceUri,
            targetUri: edgeRecord.targetUri,
            relationSlug: edgeRecord.relationSlug,
          });
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          logger.error('Failed to index edge', err, { uri, action });
          return failure('Failed to index edge', false, err);
        }
      }
      return success();
    }

    case 'pub.chive.graph.nodeProposal': {
      logger.debug('Processing node proposal', { action, uri });

      if (action !== 'delete' && record) {
        const result = await graphService.indexNodeProposal(record, metadata);
        if (!result.ok) {
          const error = result.error as Error;
          logger.error('Failed to index node proposal', error, { uri, action });
          return failure('Failed to index node proposal', false, error);
        }
      }
      return success();
    }

    case 'pub.chive.graph.edgeProposal': {
      logger.debug('Processing edge proposal', { action, uri });

      if (action !== 'delete' && record) {
        const result = await graphService.indexEdgeProposal(record, metadata);
        if (!result.ok) {
          const error = result.error as Error;
          logger.error('Failed to index edge proposal', error, { uri, action });
          return failure('Failed to index edge proposal', false, error);
        }
      }
      return success();
    }

    case 'pub.chive.graph.vote': {
      logger.debug('Processing vote', { action, uri });

      if (action !== 'delete' && record) {
        const result = await graphService.indexVote(record, metadata);
        if (!result.ok) {
          const error = result.error as Error;
          logger.error('Failed to index vote', error, { uri, action });
          return failure('Failed to index vote', false, error);
        }
      }
      return success();
    }

    case 'pub.chive.actor.profile': {
      logger.debug('Processing actor profile', { action, uri });

      if (action === 'delete') {
        try {
          const did = data.repo;
          await pool.query('DELETE FROM authors_index WHERE did = $1', [did]);
          logger.info('Deleted actor profile from index', { did });
        } catch (dbError) {
          const error = dbError instanceof Error ? dbError : new Error(String(dbError));
          logger.error('Failed to delete actor profile', error, { uri });
          return failure(
            'Failed to delete actor profile',
            false,
            new DatabaseError('DELETE', error.message, error)
          );
        }
      } else if (record) {
        try {
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

          // Create automatic institution proposals from profile affiliations
          if (
            automaticProposalService &&
            profileRecord.affiliations &&
            profileRecord.affiliations.length > 0
          ) {
            try {
              await automaticProposalService.processProfileUpdate(
                did,
                profileRecord.affiliations,
                uri
              );
            } catch (proposalError) {
              // Log but don't fail indexing if proposal creation fails
              logger.error(
                'Failed to create automatic institution proposals from profile',
                proposalError instanceof Error ? proposalError : undefined,
                { did, uri }
              );
            }
          }
        } catch (dbError) {
          const error = dbError instanceof Error ? dbError : new Error(String(dbError));
          logger.error('Failed to index actor profile', error, { uri, action });
          return failure(
            'Failed to index actor profile',
            false,
            new DatabaseError('INSERT', error.message, error)
          );
        }
      }
      return success();
    }

    default:
      if (collection.startsWith('pub.chive.')) {
        logger.warn('Unhandled Chive collection', { collection, action });
      }
      return success();
  }
}

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
    logger.warn('Failed to correlate activity', {
      error: error instanceof Error ? error.message : String(error),
      repo: input.repo,
      collection: input.collection,
      rkey: input.rkey,
    });
  }
}

/**
 * Result of batch event processing.
 *
 * @public
 */
export interface BatchProcessResult {
  /**
   * Total events processed.
   */
  readonly total: number;

  /**
   * Successfully processed events.
   */
  readonly succeeded: number;

  /**
   * Failed events (non-critical).
   */
  readonly failed: number;

  /**
   * Critical failures (should halt processing).
   */
  readonly criticalFailures: readonly ProcessRecordResult[];
}

/**
 * Creates a batch processor for efficient correlation.
 *
 * @param options - Configuration options
 * @returns Batch processor function
 *
 * @remarks
 * Processes events in batch, tracking failures and sending to DLQ.
 * Critical failures are collected and thrown at the end if any occur.
 */
export function createBatchEventProcessor(
  options: EventProcessorOptions
): (events: readonly ProcessedEvent[]) => Promise<BatchProcessResult> {
  const {
    pool,
    activity,
    eprintService,
    reviewService,
    annotationService,
    graphService,
    nodeService,
    edgeService,
    identity,
    logger,
    pdsRegistry,
    dlq,
  } = options;

  return async (events: readonly ProcessedEvent[]): Promise<BatchProcessResult> => {
    const results: ProcessRecordResult[] = [];
    const criticalFailures: ProcessRecordResult[] = [];

    for (const event of events) {
      const uri = `at://${event.repo}/${event.collection}/${event.rkey}` as AtUri;
      const pdsUrl = await identity.getPDSEndpoint(event.repo as DID);

      // Auto-register discovered PDS for future scanning
      if (pdsUrl && pdsRegistry) {
        try {
          await pdsRegistry.registerPDS(pdsUrl, 'did_mention');
        } catch (error) {
          logger.debug('PDS registration skipped', {
            pdsUrl,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const result = await processRecord(
        {
          pool,
          eprintService,
          reviewService,
          annotationService,
          graphService,
          nodeService,
          edgeService,
          logger,
        },
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

      results.push(result);

      // Handle failures
      if (!result.success && result.error) {
        // Send to DLQ
        if (dlq) {
          try {
            await dlq.add(event as DLQEvent, result.error, 0);
            logger.info('Event sent to DLQ', {
              uri,
              collection: event.collection,
              error: result.error.message,
            });
          } catch (dlqError) {
            logger.error(
              'Failed to send event to DLQ',
              dlqError instanceof Error ? dlqError : undefined,
              {
                uri,
                collection: event.collection,
                originalError: result.error.message,
              }
            );
          }
        }

        // Track critical failures
        if (result.error.critical) {
          criticalFailures.push(result);
        }
      }
    }

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

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    const batchResult: BatchProcessResult = {
      total: events.length,
      succeeded,
      failed,
      criticalFailures,
    };

    // Throw if there are critical failures
    if (criticalFailures.length > 0) {
      const firstCritical = criticalFailures[0];
      if (firstCritical?.error) {
        logger.error('Batch processing had critical failures', undefined, {
          total: events.length,
          succeeded,
          failed,
          criticalCount: criticalFailures.length,
        });
        throw firstCritical.error;
      }
    }

    return batchResult;
  };
}
