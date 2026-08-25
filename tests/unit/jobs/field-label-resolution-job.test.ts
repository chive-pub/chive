/**
 * Unit tests for FieldLabelResolutionJob.
 *
 * @remarks
 * The regression these guard against: a deploy recreates Neo4j and repopulates
 * it asynchronously, so a reindex can resolve every field label against an
 * empty graph and persist raw UUIDs. Repairing PostgreSQL alone leaves browse
 * and search — which read from Elasticsearch — showing UUIDs indefinitely, so
 * the job must mirror each repair into the search index.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { FieldLabelResolutionJob } from '@/jobs/field-label-resolution-job.js';
import type { FieldLabelIndexWriter } from '@/jobs/field-label-resolution-job.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

vi.mock('@/observability/tracer.js', () => ({
  withSpan: (_name: string, fn: () => unknown) => fn(),
  addSpanAttributes: vi.fn(),
}));

vi.mock('@/observability/prometheus-registry.js', () => ({
  jobMetrics: {
    duration: { startTimer: () => () => undefined },
    executionsTotal: { inc: vi.fn() },
    lastRunTimestamp: { set: vi.fn() },
    itemsProcessed: { inc: vi.fn() },
  },
}));

const createMockLogger = (): ILogger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
});

const UUID = '9cfe6371-0a2c-5aee-8302-f7b170b0d2d8';
const URI = 'at://did:plc:abc/pub.chive.eprint.submission/xyz';

/** One eprint whose single field label is still a raw UUID. */
function createMockPool(
  fields: unknown = [{ id: UUID, uri: `at://did:plc:g/n/${UUID}`, label: UUID }]
): { query: ReturnType<typeof vi.fn> } {
  return {
    query: vi.fn().mockImplementation((sql: string) => {
      if (sql.trim().startsWith('SELECT')) {
        return Promise.resolve({ rows: [{ uri: URI, fields: JSON.stringify(fields) }] });
      }
      return Promise.resolve({ rows: [] });
    }),
  };
}

const resolvingLookup = {
  getNodesByIds: vi.fn().mockResolvedValue(new Map([[UUID, { label: 'Formal Semantics' }]])),
};

describe('FieldLabelResolutionJob', () => {
  let logger: ILogger;
  let indexWriter: FieldLabelIndexWriter;

  beforeEach(() => {
    vi.clearAllMocks();
    logger = createMockLogger();
    indexWriter = { updateFieldLabels: vi.fn().mockResolvedValue(undefined) };
    resolvingLookup.getNodesByIds.mockResolvedValue(
      new Map([[UUID, { label: 'Formal Semantics' }]])
    );
  });

  it('should mirror a repaired label into the search index', async () => {
    const pool = createMockPool();
    const job = new FieldLabelResolutionJob({
      pool: pool as never,
      nodeLookup: resolvingLookup,
      indexWriter,
      logger,
      runOnStartup: false,
    });

    const result = await job.run();

    expect(result.resolved).toBe(1);
    expect(result.indexUpdated).toBe(1);
    expect(indexWriter.updateFieldLabels).toHaveBeenCalledWith(
      URI,
      expect.arrayContaining([expect.objectContaining({ id: UUID, label: 'Formal Semantics' })])
    );
  });

  it('should still repair PostgreSQL when the search index write fails', async () => {
    const pool = createMockPool();
    indexWriter.updateFieldLabels = vi.fn().mockRejectedValue(new Error('ES unavailable'));

    const job = new FieldLabelResolutionJob({
      pool: pool as never,
      nodeLookup: resolvingLookup,
      indexWriter,
      logger,
      runOnStartup: false,
    });

    const result = await job.run();

    expect(result.success).toBe(true);
    expect(result.resolved).toBe(1);
    expect(result.indexUpdated).toBe(0);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('should warn when no search index writer is configured', async () => {
    const pool = createMockPool();
    const job = new FieldLabelResolutionJob({
      pool: pool as never,
      nodeLookup: resolvingLookup,
      logger,
      runOnStartup: false,
    });

    const result = await job.run();

    expect(result.resolved).toBe(1);
    expect(result.indexUpdated).toBe(0);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('search index'));
  });

  it('should not touch either store when the graph cannot resolve the label', async () => {
    const pool = createMockPool();
    resolvingLookup.getNodesByIds.mockResolvedValue(new Map());

    const job = new FieldLabelResolutionJob({
      pool: pool as never,
      nodeLookup: resolvingLookup,
      indexWriter,
      logger,
      runOnStartup: false,
    });

    const result = await job.run();

    expect(result.resolved).toBe(0);
    expect(indexWriter.updateFieldLabels).not.toHaveBeenCalled();
    const updates = pool.query.mock.calls.filter((c) => String(c[0]).includes('UPDATE'));
    expect(updates).toHaveLength(0);
  });

  it('should skip eprints whose labels are already resolved', async () => {
    const pool = createMockPool([
      { id: UUID, uri: `at://did:plc:g/n/${UUID}`, label: 'Formal Semantics' },
    ]);

    const job = new FieldLabelResolutionJob({
      pool: pool as never,
      nodeLookup: resolvingLookup,
      indexWriter,
      logger,
      runOnStartup: false,
    });

    const result = await job.run();

    expect(result.resolved).toBe(0);
    expect(indexWriter.updateFieldLabels).not.toHaveBeenCalled();
  });
});
