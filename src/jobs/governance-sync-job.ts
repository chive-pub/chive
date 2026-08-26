/**
 * Graph PDS sync job.
 *
 * @remarks
 * Syncs knowledge graph nodes and edges from the Graph PDS to Neo4j.
 * This job runs frequently to ensure the AppView has current data.
 *
 * **Why needed**: The Graph PDS may not be connected to a relay in local
 * development, so records don't automatically flow through the firehose.
 * This job provides a direct sync mechanism.
 *
 * **ATProto Compliance**:
 * - READ-ONLY from Graph PDS
 * - Indexes into Neo4j (rebuildable index, not source of truth)
 * - Tracks source PDS for all indexed records
 *
 * @packageDocumentation
 * @public
 */

import { AtpAgent } from '@atproto/api';

import { jobMetrics } from '../observability/prometheus-registry.js';
import { withSpan } from '../observability/tracer.js';
import type { EdgeService } from '../services/governance/edge-service.js';
import type { NodeService } from '../services/governance/node-service.js';
import type {
  ExternalId,
  NodeMetadata,
  NodeKind,
  NodeStatus,
  EdgeStatus,
} from '../storage/neo4j/types.js';
import type { DID, AtUri } from '../types/atproto.js';
import type { ILogger } from '../types/interfaces/logger.interface.js';

/**
 * Graph sync job configuration.
 *
 * @public
 */
export interface GovernanceSyncJobConfig {
  /** Graph PDS URL */
  pdsUrl: string;
  /** Graph PDS DID */
  graphPdsDid: DID;
  /** Node service for indexing nodes */
  nodeService: NodeService;
  /** Edge service for indexing edges */
  edgeService: EdgeService;
  /** Logger */
  logger: ILogger;
  /** Sync interval in milliseconds (default: 30 seconds) */
  syncIntervalMs?: number;
}

/**
 * Outcome of a single sync cycle.
 *
 * @remarks
 * A cycle that indexed every record it read is `success`; a cycle in which at
 * least one record failed to index is `partial`. Callers that track the sync as
 * an operation — e.g. the admin trigger endpoint — should treat `partial` as a
 * failure, since a partial cycle silently leaves the Neo4j index behind the
 * Governance PDS.
 *
 * @public
 */
export interface GovernanceSyncResult {
  /** Nodes successfully indexed into Neo4j. */
  nodesIndexed: number;
  /** Edges successfully indexed into Neo4j. */
  edgesIndexed: number;
  /** Records that were read but could not be indexed. */
  failedCount: number;
  /** Whether every record read was indexed. */
  status: 'success' | 'partial';
}

/**
 * Per-collection sync tallies.
 */
interface SyncCounts {
  indexed: number;
  failed: number;
}

/**
 * Node record value from ATProto listRecords.
 */
interface NodeRecordValue {
  $type?: string;
  id: string;
  kind: NodeKind;
  subkind?: string;
  subkindUri?: string;
  label: string;
  alternateLabels?: string[];
  description?: string;
  externalIds?: ExternalId[];
  metadata?: NodeMetadata;
  status: NodeStatus;
  deprecatedBy?: string;
  proposalUri?: string;
}

/**
 * Edge record value from ATProto listRecords.
 */
interface EdgeRecordValue {
  $type?: string;
  id: string;
  sourceUri: string;
  targetUri: string;
  relationUri?: string;
  relationSlug: string;
  weight?: number;
  metadata?: Record<string, unknown>;
  status: EdgeStatus;
  proposalUri?: string;
}

/**
 * Type guard for node record value.
 */
function isNodeRecord(value: unknown): value is NodeRecordValue {
  const v = value as Record<string, unknown>;
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof v.id === 'string' &&
    typeof v.kind === 'string' &&
    typeof v.label === 'string' &&
    typeof v.status === 'string'
  );
}

/**
 * Type guard for edge record value.
 */
function isEdgeRecord(value: unknown): value is EdgeRecordValue {
  const v = value as Record<string, unknown>;
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof v.id === 'string' &&
    typeof v.sourceUri === 'string' &&
    typeof v.targetUri === 'string' &&
    typeof v.relationSlug === 'string' &&
    typeof v.status === 'string'
  );
}

/**
 * Governance PDS sync job.
 *
 * @public
 */
export class GovernanceSyncJob {
  private readonly config: Required<GovernanceSyncJobConfig>;
  private readonly agent: AtpAgent;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  constructor(config: GovernanceSyncJobConfig) {
    this.config = {
      ...config,
      syncIntervalMs: config.syncIntervalMs ?? 30_000, // 30 seconds default
    };
    this.agent = new AtpAgent({ service: config.pdsUrl });
  }

  /**
   * Starts the sync job with periodic execution.
   */
  async start(): Promise<void> {
    this.config.logger.info('Starting governance sync job', {
      pdsUrl: this.config.pdsUrl,
      governanceDid: this.config.graphPdsDid,
      syncIntervalMs: this.config.syncIntervalMs,
    });

    // Run immediately on start
    await this.run();

    // Then run periodically
    this.intervalId = setInterval(() => {
      this.run().catch((err) => {
        this.config.logger.error(
          'Governance sync job failed',
          err instanceof Error ? err : undefined
        );
      });
    }, this.config.syncIntervalMs);
  }

  /**
   * Stops the sync job.
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.config.logger.info('Governance sync job stopped');
  }

  /**
   * Runs a single sync cycle.
   *
   * @returns The cycle outcome, `partial` when some records failed to index.
   *
   * @remarks
   * Per-record indexing failures do not abort the cycle — one poisoned record
   * should not block the rest of the graph — but they are counted and surfaced
   * so a caller cannot mistake a lossy cycle for a complete one.
   */
  async run(): Promise<GovernanceSyncResult> {
    if (this.isRunning) {
      this.config.logger.debug('Sync already in progress, skipping');
      // Nothing was read, so nothing was dropped: not a partial cycle.
      return { nodesIndexed: 0, edgesIndexed: 0, failedCount: 0, status: 'success' };
    }

    this.isRunning = true;
    const startTime = Date.now();
    const endTimer = jobMetrics.duration.startTimer({ job: 'governance_sync' });

    try {
      return await withSpan('job.governance_sync', async () => {
        this.config.logger.debug('Starting governance sync');

        const nodes = await this.syncNodes();
        const edges = await this.syncEdges();

        const nodeCount = nodes.indexed;
        const edgeCount = edges.indexed;
        const failedCount = nodes.failed + edges.failed;
        const status = failedCount > 0 ? 'partial' : 'success';

        const duration = Date.now() - startTime;
        if (failedCount > 0) {
          this.config.logger.warn('Governance sync completed with failures', {
            nodesIndexed: nodeCount,
            edgesIndexed: edgeCount,
            nodesFailed: nodes.failed,
            edgesFailed: edges.failed,
            durationMs: duration,
          });
        } else {
          this.config.logger.info('Governance sync completed', {
            nodesIndexed: nodeCount,
            edgesIndexed: edgeCount,
            durationMs: duration,
          });
        }

        jobMetrics.executionsTotal.inc({ job: 'governance_sync', status });
        jobMetrics.lastRunTimestamp.set({ job: 'governance_sync' }, Date.now() / 1000);
        jobMetrics.itemsProcessed.inc(
          { job: 'governance_sync', status: 'success' },
          nodeCount + edgeCount
        );
        if (failedCount > 0) {
          jobMetrics.itemsProcessed.inc({ job: 'governance_sync', status: 'error' }, failedCount);
        }
        endTimer({ status });

        return { nodesIndexed: nodeCount, edgesIndexed: edgeCount, failedCount, status };
      });
    } catch (error) {
      this.config.logger.error(
        'Governance sync failed',
        error instanceof Error ? error : undefined
      );

      jobMetrics.executionsTotal.inc({ job: 'governance_sync', status: 'error' });
      endTimer({ status: 'error' });

      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Syncs all node records from the Governance PDS.
   *
   * @returns Indexed and failed record counts for this collection.
   */
  private async syncNodes(): Promise<SyncCounts> {
    let indexedCount = 0;
    let failedCount = 0;
    let cursor: string | undefined;

    do {
      const response = await this.agent.com.atproto.repo.listRecords({
        repo: this.config.graphPdsDid,
        collection: 'pub.chive.graph.node',
        limit: 100,
        cursor,
      });

      for (const record of response.data.records) {
        if (!isNodeRecord(record.value)) {
          this.config.logger.warn('Skipping invalid node record', { uri: record.uri });
          continue;
        }

        try {
          const nodeRecord = record.value;
          await this.config.nodeService.indexNode({
            id: nodeRecord.id,
            uri: record.uri as AtUri,
            kind: nodeRecord.kind,
            subkind: nodeRecord.subkind,
            subkindUri: nodeRecord.subkindUri as AtUri | undefined,
            label: nodeRecord.label,
            alternateLabels: nodeRecord.alternateLabels,
            description: nodeRecord.description,
            externalIds: nodeRecord.externalIds,
            metadata: nodeRecord.metadata,
            status: nodeRecord.status,
            deprecatedBy: nodeRecord.deprecatedBy as AtUri | undefined,
            proposalUri: nodeRecord.proposalUri as AtUri | undefined,
            createdBy: this.config.graphPdsDid,
          });
          indexedCount++;
        } catch (error) {
          this.config.logger.error(
            'Failed to index node',
            error instanceof Error ? error : undefined,
            { uri: record.uri }
          );
          failedCount++;
        }
      }

      cursor = response.data.cursor;
    } while (cursor);

    return { indexed: indexedCount, failed: failedCount };
  }

  /**
   * Syncs all edge records from the Governance PDS.
   *
   * @returns Indexed and failed record counts for this collection.
   */
  private async syncEdges(): Promise<SyncCounts> {
    let indexedCount = 0;
    let failedCount = 0;
    let cursor: string | undefined;

    do {
      const response = await this.agent.com.atproto.repo.listRecords({
        repo: this.config.graphPdsDid,
        collection: 'pub.chive.graph.edge',
        limit: 100,
        cursor,
      });

      for (const record of response.data.records) {
        if (!isEdgeRecord(record.value)) {
          this.config.logger.warn('Skipping invalid edge record', { uri: record.uri });
          continue;
        }

        try {
          const edgeRecord = record.value;
          await this.config.edgeService.indexEdge({
            id: edgeRecord.id,
            uri: record.uri as AtUri,
            sourceUri: edgeRecord.sourceUri as AtUri,
            targetUri: edgeRecord.targetUri as AtUri,
            relationUri: edgeRecord.relationUri as AtUri | undefined,
            relationSlug: edgeRecord.relationSlug,
            weight: edgeRecord.weight,
            metadata: edgeRecord.metadata,
            status: edgeRecord.status,
            proposalUri: edgeRecord.proposalUri as AtUri | undefined,
            createdBy: this.config.graphPdsDid,
          });
          indexedCount++;
        } catch (error) {
          this.config.logger.error(
            'Failed to index edge',
            error instanceof Error ? error : undefined,
            { uri: record.uri }
          );
          failedCount++;
        }
      }

      cursor = response.data.cursor;
    } while (cursor);

    return { indexed: indexedCount, failed: failedCount };
  }
}
