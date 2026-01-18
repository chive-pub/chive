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

import type {
  NodeKind,
  NodeStatus,
  EdgeStatus,
  ExternalId,
  NodeMetadata,
  EdgeMetadata,
} from '../../storage/neo4j/types.js';
import type { AtUri, CID, DID, NSID } from '../../types/atproto.js';
import type { IIdentityResolver } from '../../types/interfaces/identity.interface.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import type { Eprint } from '../../types/models/eprint.js';
import type { ActivityService } from '../activity/activity-service.js';
import type { EprintService, RecordMetadata } from '../eprint/eprint-service.js';
import type { EdgeService } from '../governance/edge-service.js';
import type { NodeService } from '../governance/node-service.js';
import type { KnowledgeGraphService } from '../knowledge-graph/graph-service.js';
import type { ReviewService, ReviewComment, Endorsement } from '../review/review-service.js';

import type { ProcessedEvent } from './indexing-service.js';

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
  readonly affiliations?: readonly string[];
  readonly fieldIds?: readonly string[];
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
  readonly graphService: KnowledgeGraphService;
  readonly nodeService?: NodeService;
  readonly edgeService?: EdgeService;
  readonly identity: IIdentityResolver;
  readonly logger: ILogger;
}

/**
 * Creates an event processor with activity correlation.
 */
export function createEventProcessor(
  options: EventProcessorOptions
): (event: ProcessedEvent) => Promise<void> {
  const {
    pool,
    activity,
    eprintService,
    reviewService,
    graphService,
    nodeService,
    edgeService,
    identity,
    logger,
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

    await processRecord(
      {
        pool,
        eprintService,
        reviewService,
        graphService,
        nodeService,
        edgeService,
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

interface ProcessRecordContext {
  readonly pool: Pool;
  readonly eprintService: EprintService;
  readonly reviewService: ReviewService;
  readonly graphService: KnowledgeGraphService;
  readonly nodeService?: NodeService;
  readonly edgeService?: EdgeService;
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

async function processRecord(ctx: ProcessRecordContext, data: RecordData): Promise<void> {
  const { eprintService, reviewService, graphService, nodeService, edgeService, pool, logger } =
    ctx;
  const { uri, cid, collection, action, record, pdsUrl } = data;

  const metadata: RecordMetadata = {
    uri,
    cid: cid ?? ('' as CID),
    pdsUrl,
    indexedAt: new Date(),
  };

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
        await pool.query('DELETE FROM user_tags_index WHERE uri = $1', [uri]);
        logger.info('Deleted tag from index', { uri });
      } else if (record) {
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
      }
      break;
    }

    case 'pub.chive.graph.node': {
      logger.debug('Processing node record', { action, uri });

      if (action === 'delete') {
        if (nodeService) {
          await nodeService.deleteNode(uri);
          logger.info('Deleted node from index', { uri });
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
          logger.error('Failed to index node', error instanceof Error ? error : undefined, {
            uri,
            action,
          });
        }
      }
      break;
    }

    case 'pub.chive.graph.edge': {
      logger.debug('Processing edge record', { action, uri });

      if (action === 'delete') {
        if (edgeService) {
          await edgeService.deleteEdge(uri);
          logger.info('Deleted edge from index', { uri });
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
          logger.error('Failed to index edge', error instanceof Error ? error : undefined, {
            uri,
            action,
          });
        }
      }
      break;
    }

    case 'pub.chive.graph.nodeProposal': {
      logger.debug('Processing node proposal', { action, uri });

      if (action !== 'delete' && record) {
        const result = await graphService.indexNodeProposal(record, metadata);
        if (!result.ok) {
          logger.error('Failed to index node proposal', result.error as Error, { uri, action });
        }
      }
      break;
    }

    case 'pub.chive.graph.edgeProposal': {
      logger.debug('Processing edge proposal', { action, uri });

      if (action !== 'delete' && record) {
        const result = await graphService.indexEdgeProposal(record, metadata);
        if (!result.ok) {
          logger.error('Failed to index edge proposal', result.error as Error, { uri, action });
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
      break;
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
 * Creates a batch processor for efficient correlation.
 */
export function createBatchEventProcessor(
  options: EventProcessorOptions
): (events: readonly ProcessedEvent[]) => Promise<void> {
  const {
    pool,
    activity,
    eprintService,
    reviewService,
    graphService,
    nodeService,
    edgeService,
    identity,
    logger,
  } = options;

  return async (events: readonly ProcessedEvent[]): Promise<void> => {
    for (const event of events) {
      const uri = `at://${event.repo}/${event.collection}/${event.rkey}` as AtUri;
      const pdsUrl = await identity.getPDSEndpoint(event.repo as DID);

      await processRecord(
        { pool, eprintService, reviewService, graphService, nodeService, edgeService, logger },
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
