/**
 * Unit tests for the firehose event processor's failure handling.
 *
 * @remarks
 * The cursor advances when an event is queued, not when it is processed, so a
 * handler failure that neither reaches the DLQ nor rethrows loses the record
 * permanently. These tests pin the two halves of that contract: a configured
 * DLQ receives non-critical failures, and an absent one is reported loudly.
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

/**
 * A vote event whose handler fails non-critically when graphService rejects it.
 */
const voteEvent: ProcessedEvent = {
  $type: 'commit',
  seq: 42,
  repo: REPO,
  time: '2026-08-24T00:00:00.000Z',
  action: 'create',
  collection: 'pub.chive.graph.vote',
  rkey: '3kabc',
  cid: 'bafyreiabc',
  record: { proposalUri: `at://${REPO}/pub.chive.graph.nodeProposal/xyz`, vote: 'support' },
};

describe('createEventProcessor', () => {
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  const indexVote = vi.fn();
  const dlqAdd = vi.fn();

  const buildOptions = (dlq?: DeadLetterQueue): EventProcessorOptions =>
    ({
      pool: { query: vi.fn() },
      activity: { correlateWithFirehose: vi.fn().mockResolvedValue({ ok: true, value: null }) },
      eprintService: {},
      reviewService: {},
      graphService: { indexVote },
      identity: { getPDSEndpoint: vi.fn().mockResolvedValue('https://pds.example.com') },
      logger,
      dlq,
    }) as unknown as EventProcessorOptions;

  beforeEach(() => {
    vi.clearAllMocks();
    indexVote.mockResolvedValue({ ok: false, error: new Error('neo4j unavailable') });
    dlqAdd.mockResolvedValue(1);
  });

  it('sends non-critical handler failures to the DLQ', async () => {
    const dlq = { add: dlqAdd } as unknown as DeadLetterQueue;
    const processor = createEventProcessor(buildOptions(dlq));

    await processor(voteEvent);

    expect(dlqAdd).toHaveBeenCalledTimes(1);
    const [event, error, retryCount] = dlqAdd.mock.calls[0] as [
      ProcessedEvent,
      EventProcessingError,
      number,
    ];
    expect(event.seq).toBe(42);
    expect(event.collection).toBe('pub.chive.graph.vote');
    expect(error).toBeInstanceOf(EventProcessingError);
    expect(error.critical).toBe(false);
    expect(error.uri).toBe(`at://${REPO}/pub.chive.graph.vote/3kabc`);
    expect(retryCount).toBe(0);
  });

  it('does not rethrow when the DLQ accepts the failure', async () => {
    const dlq = { add: dlqAdd } as unknown as DeadLetterQueue;
    const processor = createEventProcessor(buildOptions(dlq));

    await expect(processor(voteEvent)).resolves.toBeUndefined();
  });

  it('warns that the record is dropped when no DLQ is configured', async () => {
    const processor = createEventProcessor(buildOptions(undefined));

    await processor(voteEvent);

    expect(dlqAdd).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('no DLQ configured'),
      expect.objectContaining({ collection: 'pub.chive.graph.vote' })
    );
  });

  it('still processes the event when the DLQ write itself fails', async () => {
    dlqAdd.mockRejectedValue(new Error('postgres down'));
    const dlq = { add: dlqAdd } as unknown as DeadLetterQueue;
    const processor = createEventProcessor(buildOptions(dlq));

    await expect(processor(voteEvent)).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to send event to DLQ',
      expect.any(Error),
      expect.objectContaining({ collection: 'pub.chive.graph.vote' })
    );
  });
});
