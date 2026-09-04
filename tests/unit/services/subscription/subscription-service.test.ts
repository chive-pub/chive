/**
 * Tests for the standard.site subscription index.
 *
 * @remarks
 * Subscriptions and recommendations are written by readers into their own
 * repositories; Chive only observes them. The invariants worth holding are
 * about counting people rather than records, and about a withdrawn subscription
 * being reinstatable without the firehose replaying a stale deletion over it.
 *
 * @packageDocumentation
 */

import { describe, expect, it, vi } from 'vitest';

import { SubscriptionService } from '@/services/subscription/subscription-service.js';

function build(rows: unknown[] = []): {
  service: SubscriptionService;
  query: ReturnType<typeof vi.fn>;
} {
  const query = vi.fn().mockResolvedValue({ rows });
  const service = new SubscriptionService({
    db: { query } as never,
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn().mockReturnThis(),
    } as never,
  });
  return { service, query };
}

describe('SubscriptionService', () => {
  it('counts people, not records', async () => {
    // An author may hold several publications; a reader following two of them
    // is one follower, not two.
    const { service, query } = build([{ count: '3' }]);

    await service.getSubscriberCount('did:plc:author');

    expect(query.mock.calls[0]?.[0]).toContain('COUNT(DISTINCT subscriber_did)');
  });

  it('counts distinct recommenders for an eprint', async () => {
    const { service, query } = build([{ count: '2' }]);

    await service.getRecommendationCount('at://did:plc:a/pub.chive.eprint.submission/x');

    expect(query.mock.calls[0]?.[0]).toContain('COUNT(DISTINCT recommender_did)');
  });

  it('clears a previous deletion when a subscription is re-recorded', async () => {
    // A reader who unsubscribes and subscribes again writes a new record. A
    // firehose replay must not leave the older deletion standing over it.
    const { service, query } = build();

    await service.recordSubscription({
      uri: 'at://did:plc:reader/site.standard.graph.subscription/1',
      subscriberDid: 'did:plc:reader',
      publicationUri: 'at://did:plc:author/site.standard.publication/1',
      publicationDid: 'did:plc:author',
    });

    const sql = query.mock.calls[0]?.[0] as string;
    expect(sql).toContain('ON CONFLICT (uri) DO UPDATE');
    expect(sql).toContain('is_deleted = false');
    expect(sql).toContain('deleted_at = NULL');
  });

  it('only marks a subscription deleted once', async () => {
    const { service, query } = build();

    await service.deleteSubscription('at://did:plc:reader/site.standard.graph.subscription/1');

    expect(query.mock.calls[0]?.[0]).toContain('is_deleted = false');
  });

  it("excludes withdrawn subscriptions from a reader's follows", async () => {
    const { service, query } = build([{ publication_did: 'did:plc:author' }]);

    const dids = await service.getSubscribedDids('did:plc:reader');

    expect(dids).toEqual(['did:plc:author']);
    expect(query.mock.calls[0]?.[0]).toContain('is_deleted = false');
  });

  it('returns the oldest publication so the answer is stable', async () => {
    // A reader who subscribed yesterday must see the same publication today,
    // not a newer one that would make the control read as unsubscribed.
    const { service, query } = build([{ uri: 'at://did:plc:author/site.standard.publication/1' }]);

    const uri = await service.getPublicationUri('did:plc:author');

    expect(uri).toBe('at://did:plc:author/site.standard.publication/1');
    expect(query.mock.calls[0]?.[0]).toContain('ORDER BY indexed_at ASC');
  });

  it('reports no publication for an author who holds none', async () => {
    const { service } = build([]);

    expect(await service.getPublicationUri('did:plc:nobody')).toBeUndefined();
  });

  it('keeps a resolved eprint when a recommendation is re-recorded without one', async () => {
    const { service, query } = build();

    await service.recordRecommendation({
      uri: 'at://did:plc:reader/site.standard.graph.recommend/1',
      recommenderDid: 'did:plc:reader',
      documentUri: 'at://did:plc:author/site.standard.document/1',
    });

    expect(query.mock.calls[0]?.[0]).toContain('COALESCE(EXCLUDED.eprint_uri');
  });
});
