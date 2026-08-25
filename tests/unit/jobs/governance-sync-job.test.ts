/**
 * Unit tests for GovernanceSyncJob.
 *
 * @remarks
 * Focuses on failure accounting: a cycle in which some records fail to index
 * must report `partial` rather than `success`, so callers cannot mistake a
 * lossy sync for a complete one. Also pins the clean-run reporting so the
 * success path stays unchanged.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { GovernanceSyncJob } from '@/jobs/governance-sync-job.js';
import { jobMetrics } from '@/observability/prometheus-registry.js';
import type { EdgeService } from '@/services/governance/edge-service.js';
import type { NodeService } from '@/services/governance/node-service.js';
import type { AtUri, DID } from '@/types/atproto.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

// =============================================================================
// Mocks
// =============================================================================

// Hoisted so the mock factories below can reach these spies without a TDZ error.
const { endTimer, listRecords } = vi.hoisted(() => ({
  endTimer: vi.fn(),
  listRecords: vi.fn(),
}));

vi.mock('@/observability/tracer.js', () => ({
  withSpan: (_name: string, fn: () => unknown) => fn(),
  addSpanAttributes: vi.fn(),
}));

vi.mock('@/observability/prometheus-registry.js', () => ({
  jobMetrics: {
    executionsTotal: { inc: vi.fn() },
    itemsProcessed: { inc: vi.fn() },
    lastRunTimestamp: { set: vi.fn() },
    duration: { startTimer: vi.fn(() => endTimer) },
  },
}));

// A plain class, not vi.fn(), so vi.clearAllMocks() cannot strip the constructor.
vi.mock('@atproto/api', () => ({
  AtpAgent: class {
    com = { atproto: { repo: { listRecords } } };
  },
}));

// =============================================================================
// Helpers
// =============================================================================

const GOVERNANCE_DID = 'did:plc:governance' as DID;
const INDEXED_URI = 'at://did:plc:governance/pub.chive.graph.node/indexed' as AtUri;

const createMockLogger = (): ILogger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
});

function nodeRecord(id: string): { uri: string; value: Record<string, unknown> } {
  return {
    uri: `at://${GOVERNANCE_DID}/pub.chive.graph.node/${id}`,
    value: { id, kind: 'field', label: id, status: 'active' },
  };
}

function edgeRecord(id: string): { uri: string; value: Record<string, unknown> } {
  return {
    uri: `at://${GOVERNANCE_DID}/pub.chive.graph.edge/${id}`,
    value: {
      id,
      sourceUri: `at://${GOVERNANCE_DID}/pub.chive.graph.node/a`,
      targetUri: `at://${GOVERNANCE_DID}/pub.chive.graph.node/b`,
      relationSlug: 'broader',
      status: 'active',
    },
  };
}

/**
 * Stubs listRecords so the node collection returns `nodes` and the edge
 * collection returns `edges`, each in a single page.
 */
function stubCollections(
  nodes: ReturnType<typeof nodeRecord>[],
  edges: ReturnType<typeof edgeRecord>[]
): void {
  listRecords.mockImplementation(({ collection }: { collection: string }) =>
    Promise.resolve({
      data: {
        records: collection === 'pub.chive.graph.node' ? nodes : edges,
        cursor: undefined,
      },
    })
  );
}

function createJob(
  nodeService: NodeService,
  edgeService: EdgeService,
  logger: ILogger
): GovernanceSyncJob {
  return new GovernanceSyncJob({
    pdsUrl: 'https://governance.example',
    graphPdsDid: GOVERNANCE_DID,
    nodeService,
    edgeService,
    logger,
  });
}

// =============================================================================
// Tests
// =============================================================================

describe('GovernanceSyncJob.run', () => {
  let logger: ILogger;
  let nodeService: NodeService;
  let edgeService: EdgeService;

  beforeEach(() => {
    vi.clearAllMocks();
    logger = createMockLogger();
    nodeService = { indexNode: vi.fn().mockResolvedValue(INDEXED_URI) } as unknown as NodeService;
    edgeService = { indexEdge: vi.fn().mockResolvedValue(INDEXED_URI) } as unknown as EdgeService;
  });

  it('reports success and counts every record when nothing fails', async () => {
    stubCollections([nodeRecord('n1'), nodeRecord('n2')], [edgeRecord('e1')]);

    const result = await createJob(nodeService, edgeService, logger).run();

    expect(result).toEqual({
      nodesIndexed: 2,
      edgesIndexed: 1,
      failedCount: 0,
      status: 'success',
    });
    expect(logger.info).toHaveBeenCalledWith(
      'Governance sync completed',
      expect.objectContaining({ nodesIndexed: 2, edgesIndexed: 1 })
    );
    expect(logger.warn).not.toHaveBeenCalled();
    expect(jobMetrics.executionsTotal.inc).toHaveBeenCalledWith({
      job: 'governance_sync',
      status: 'success',
    });
    expect(jobMetrics.itemsProcessed.inc).toHaveBeenCalledTimes(1);
    expect(jobMetrics.itemsProcessed.inc).toHaveBeenCalledWith(
      { job: 'governance_sync', status: 'success' },
      3
    );
    expect(endTimer).toHaveBeenCalledWith({ status: 'success' });
  });

  it('reports partial and counts failures when some records fail to index', async () => {
    stubCollections([nodeRecord('n1'), nodeRecord('n2')], [edgeRecord('e1')]);
    vi.mocked(nodeService.indexNode)
      .mockResolvedValueOnce(INDEXED_URI)
      .mockRejectedValueOnce(new Error('neo4j write failed'));
    vi.mocked(edgeService.indexEdge).mockRejectedValueOnce(new Error('neo4j write failed'));

    const result = await createJob(nodeService, edgeService, logger).run();

    expect(result).toEqual({
      nodesIndexed: 1,
      edgesIndexed: 0,
      failedCount: 2,
      status: 'partial',
    });
    expect(logger.info).not.toHaveBeenCalledWith('Governance sync completed', expect.anything());
    expect(logger.warn).toHaveBeenCalledWith(
      'Governance sync completed with failures',
      expect.objectContaining({ nodesFailed: 1, edgesFailed: 1 })
    );
    expect(jobMetrics.executionsTotal.inc).toHaveBeenCalledWith({
      job: 'governance_sync',
      status: 'partial',
    });
    expect(jobMetrics.itemsProcessed.inc).toHaveBeenCalledWith(
      { job: 'governance_sync', status: 'error' },
      2
    );
    expect(endTimer).toHaveBeenCalledWith({ status: 'partial' });
  });

  it('does not fail the cycle when one record poisons the batch', async () => {
    stubCollections([nodeRecord('n1'), nodeRecord('n2'), nodeRecord('n3')], []);
    vi.mocked(nodeService.indexNode).mockRejectedValueOnce(new Error('boom'));

    const result = await createJob(nodeService, edgeService, logger).run();

    expect(nodeService.indexNode).toHaveBeenCalledTimes(3);
    expect(result.nodesIndexed).toBe(2);
    expect(result.failedCount).toBe(1);
  });

  it('reports success for a skipped cycle since no records were read', async () => {
    stubCollections([nodeRecord('n1')], []);
    const job = createJob(nodeService, edgeService, logger);

    const [first, second] = await Promise.all([job.run(), job.run()]);

    expect(first.nodesIndexed + second.nodesIndexed).toBe(1);
    expect([first.status, second.status]).toEqual(['success', 'success']);
  });
});
