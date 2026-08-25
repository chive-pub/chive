/**
 * Unit tests for governance record handling in the firehose event processor.
 *
 * @remarks
 * Two failure modes are pinned here. First, a proposal or vote retracted from
 * its source PDS must be removed from the index rather than ignored, so that a
 * withdrawn ballot stops counting. Second, a governance record missing a
 * lexicon-required field must reach the DLQ instead of being recorded as
 * indexed, since the cursor advances whether or not the record was stored.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { DeadLetterQueue } from '@/services/indexing/dlq-handler.js';
import {
  createEventProcessor,
  EventProcessingError,
  type EventProcessorOptions,
} from '@/services/indexing/event-processor.js';
import type { ProcessedEvent } from '@/services/indexing/indexing-service.js';

const REPO = 'did:plc:testrepo';
const PROPOSAL_URI = `at://${REPO}/pub.chive.graph.nodeProposal/xyz`;

/**
 * Builds a firehose event for a governance collection.
 */
const event = (
  collection: string,
  action: 'create' | 'update' | 'delete',
  record?: unknown
): ProcessedEvent =>
  ({
    $type: 'commit',
    seq: 7,
    repo: REPO,
    time: '2026-08-24T00:00:00.000Z',
    action,
    collection,
    rkey: '3kabc',
    cid: 'bafyreiabc',
    record,
  }) as ProcessedEvent;

describe('event processor governance records', () => {
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  const indexNodeProposal = vi.fn();
  const indexEdgeProposal = vi.fn();
  const indexVote = vi.fn();
  const deleteNodeProposal = vi.fn();
  const deleteEdgeProposal = vi.fn();
  const deleteVote = vi.fn();
  const dlqAdd = vi.fn();

  const buildOptions = (graphService: Record<string, unknown>): EventProcessorOptions =>
    ({
      pool: { query: vi.fn() },
      activity: { correlateWithFirehose: vi.fn().mockResolvedValue({ ok: true, value: null }) },
      eprintService: {},
      reviewService: {},
      graphService,
      identity: { getPDSEndpoint: vi.fn().mockResolvedValue('https://pds.example.com') },
      logger,
      dlq: { add: dlqAdd } as unknown as DeadLetterQueue,
    }) as unknown as EventProcessorOptions;

  const fullGraphService = (): Record<string, unknown> => ({
    indexNodeProposal,
    indexEdgeProposal,
    indexVote,
    deleteNodeProposal,
    deleteEdgeProposal,
    deleteVote,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    const ok = { ok: true, value: undefined };
    indexNodeProposal.mockResolvedValue(ok);
    indexEdgeProposal.mockResolvedValue(ok);
    indexVote.mockResolvedValue(ok);
    deleteNodeProposal.mockResolvedValue(ok);
    deleteEdgeProposal.mockResolvedValue(ok);
    deleteVote.mockResolvedValue(ok);
    dlqAdd.mockResolvedValue(1);
  });

  describe('deletions from the source PDS', () => {
    it('removes a retracted vote from the index', async () => {
      const processor = createEventProcessor(buildOptions(fullGraphService()));

      await processor(event('pub.chive.graph.vote', 'delete'));

      expect(deleteVote).toHaveBeenCalledWith(`at://${REPO}/pub.chive.graph.vote/3kabc`);
      expect(indexVote).not.toHaveBeenCalled();
      expect(dlqAdd).not.toHaveBeenCalled();
    });

    it('removes a retracted node proposal from the index', async () => {
      const processor = createEventProcessor(buildOptions(fullGraphService()));

      await processor(event('pub.chive.graph.nodeProposal', 'delete'));

      expect(deleteNodeProposal).toHaveBeenCalledWith(
        `at://${REPO}/pub.chive.graph.nodeProposal/3kabc`
      );
      expect(dlqAdd).not.toHaveBeenCalled();
    });

    it('removes a retracted edge proposal from the index', async () => {
      const processor = createEventProcessor(buildOptions(fullGraphService()));

      await processor(event('pub.chive.graph.edgeProposal', 'delete'));

      expect(deleteEdgeProposal).toHaveBeenCalledWith(
        `at://${REPO}/pub.chive.graph.edgeProposal/3kabc`
      );
      expect(dlqAdd).not.toHaveBeenCalled();
    });

    it('sends the deletion to the DLQ when the graph service rejects it', async () => {
      deleteVote.mockResolvedValue({ ok: false, error: new Error('neo4j unavailable') });
      const processor = createEventProcessor(buildOptions(fullGraphService()));

      await processor(event('pub.chive.graph.vote', 'delete'));

      expect(dlqAdd).toHaveBeenCalledTimes(1);
      const [, error] = dlqAdd.mock.calls[0] as [ProcessedEvent, EventProcessingError, number];
      expect(error).toBeInstanceOf(EventProcessingError);
      expect(error.critical).toBe(false);
      expect(error.message).toContain('Failed to delete vote');
    });

    it('sends the deletion to the DLQ when the graph service cannot apply it yet', async () => {
      // deleteVote is absent from the service, as it is today.
      const processor = createEventProcessor(
        buildOptions({ indexNodeProposal, indexEdgeProposal, indexVote })
      );

      await processor(event('pub.chive.graph.vote', 'delete'));

      expect(dlqAdd).toHaveBeenCalledTimes(1);
      const [, error] = dlqAdd.mock.calls[0] as [ProcessedEvent, EventProcessingError, number];
      expect(error.cause).toBeDefined();
      expect(error.cause?.message).toContain('deleteVote');
    });

    it('sends the deletion to the DLQ when the graph service throws', async () => {
      deleteVote.mockRejectedValue(new Error('bolt connection reset'));
      const processor = createEventProcessor(buildOptions(fullGraphService()));

      await processor(event('pub.chive.graph.vote', 'delete'));

      expect(dlqAdd).toHaveBeenCalledTimes(1);
      const [, error] = dlqAdd.mock.calls[0] as [ProcessedEvent, EventProcessingError, number];
      expect(error.cause?.message).toContain('bolt connection reset');
    });
  });

  describe('malformed records', () => {
    it('routes a vote missing its choice to the DLQ without indexing it', async () => {
      const processor = createEventProcessor(buildOptions(fullGraphService()));

      await processor(event('pub.chive.graph.vote', 'create', { proposalUri: PROPOSAL_URI }));

      expect(indexVote).not.toHaveBeenCalled();
      expect(dlqAdd).toHaveBeenCalledTimes(1);
      const [, error] = dlqAdd.mock.calls[0] as [ProcessedEvent, EventProcessingError, number];
      expect(error.message).toContain('Malformed vote');
      expect(error.cause?.message).toContain('vote');
    });

    it('routes a node proposal missing its rationale to the DLQ', async () => {
      const processor = createEventProcessor(buildOptions(fullGraphService()));

      await processor(
        event('pub.chive.graph.nodeProposal', 'create', { proposalType: 'create', kind: 'type' })
      );

      expect(indexNodeProposal).not.toHaveBeenCalled();
      expect(dlqAdd).toHaveBeenCalledTimes(1);
      const [, error] = dlqAdd.mock.calls[0] as [ProcessedEvent, EventProcessingError, number];
      expect(error.cause?.message).toContain('rationale');
    });

    it('routes an edge proposal missing its rationale to the DLQ', async () => {
      const processor = createEventProcessor(buildOptions(fullGraphService()));

      await processor(event('pub.chive.graph.edgeProposal', 'update', { proposalType: 'update' }));

      expect(indexEdgeProposal).not.toHaveBeenCalled();
      expect(dlqAdd).toHaveBeenCalledTimes(1);
    });

    it('routes a create carrying no decoded record to the DLQ', async () => {
      const processor = createEventProcessor(buildOptions(fullGraphService()));

      await processor(event('pub.chive.graph.vote', 'create', undefined));

      expect(indexVote).not.toHaveBeenCalled();
      expect(dlqAdd).toHaveBeenCalledTimes(1);
    });
  });

  describe('well-formed records', () => {
    it('indexes a valid vote and leaves the DLQ untouched', async () => {
      const processor = createEventProcessor(buildOptions(fullGraphService()));

      await processor(
        event('pub.chive.graph.vote', 'create', { proposalUri: PROPOSAL_URI, vote: 'approve' })
      );

      expect(indexVote).toHaveBeenCalledTimes(1);
      expect(dlqAdd).not.toHaveBeenCalled();
    });

    it('indexes a valid node proposal and leaves the DLQ untouched', async () => {
      const processor = createEventProcessor(buildOptions(fullGraphService()));

      await processor(
        event('pub.chive.graph.nodeProposal', 'create', {
          proposalType: 'create',
          kind: 'type',
          rationale: 'This field is missing from the taxonomy.',
        })
      );

      expect(indexNodeProposal).toHaveBeenCalledTimes(1);
      expect(dlqAdd).not.toHaveBeenCalled();
    });
  });
});
