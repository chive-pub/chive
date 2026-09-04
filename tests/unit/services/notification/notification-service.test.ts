/**
 * Unit tests for NotificationService.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { NotificationService } from '../../../../src/services/notification/notification-service.js';
import type { DID } from '../../../../src/types/atproto.js';
import type { ILogger } from '../../../../src/types/interfaces/logger.interface.js';

// ============================================================================
// Mock Factories
// ============================================================================

const createMockLogger = (): ILogger => {
  const logger: ILogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => logger),
  };
  return logger;
};

interface MockDatabasePool {
  query: ReturnType<typeof vi.fn>;
}

const createMockPool = (): MockDatabasePool => ({
  query: vi.fn().mockResolvedValue({ rows: [] }),
});

// ============================================================================
// Sample Data
// ============================================================================

const SAMPLE_DID = 'did:plc:aswhite' as DID;
const FOLLOWER_DID = 'did:plc:follower';
const COLLECTOR_DID = 'did:plc:collector';

const followerRow = (suffix: string, createdAt: Date): Record<string, unknown> => ({
  uri: `at://${FOLLOWER_DID}/pub.chive.graph.node/${suffix}`,
  owner_did: FOLLOWER_DID,
  label: 'Aaron Steven White',
  activity_types: ['eprint', 'review'],
  created_at: createdAt,
  handle: 'follower.example.com',
  display_name: 'A Follower',
});

const collectionAddRow = (suffix: string, createdAt: Date): Record<string, unknown> => ({
  uri: `at://${COLLECTOR_DID}/pub.chive.graph.edge/${suffix}`,
  owner_did: COLLECTOR_DID,
  source_uri: `at://${COLLECTOR_DID}/pub.chive.graph.node/nlp-reading-list`,
  collection_label: 'NLP reading list',
  eprint_uri: `at://${SAMPLE_DID}/pub.chive.eprint.submission/megaattitude`,
  eprint_title: 'Probabilistic dynamic semantics',
  created_at: createdAt,
  handle: 'collector.example.com',
  display_name: 'A Collector',
});

// ============================================================================
// Tests
// ============================================================================

describe('NotificationService', () => {
  let pool: MockDatabasePool;
  let logger: ILogger;
  let service: NotificationService;

  beforeEach(() => {
    pool = createMockPool();
    logger = createMockLogger();
    service = new NotificationService({
      pool: pool as unknown as ConstructorParameters<typeof NotificationService>[0]['pool'],
      logger,
    });
  });

  describe('listFollowers', () => {
    it('maps collection rows to follower notifications', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [followerRow('one', new Date('2026-08-01T12:00:00.000Z'))],
      });

      const page = await service.listFollowers(SAMPLE_DID);

      expect(page.items).toHaveLength(1);
      expect(page.items[0]).toEqual({
        collectionUri: `at://${FOLLOWER_DID}/pub.chive.graph.node/one`,
        collectionLabel: 'Aaron Steven White',
        followerDid: FOLLOWER_DID,
        followerHandle: 'follower.example.com',
        followerDisplayName: 'A Follower',
        activityTypes: ['eprint', 'review'],
        createdAt: new Date('2026-08-01T12:00:00.000Z'),
      });
    });

    it('matches the subscription DID and excludes the caller as owner', async () => {
      await service.listFollowers(SAMPLE_DID);

      const [sql, params] = pool.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain("c.metadata->>'subscriptionDid' = $1");
      expect(sql).toContain('c.owner_did <> $1');
      expect(params[0]).toBe(SAMPLE_DID);
    });

    it('omits handle and display name when the index has none', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            ...followerRow('one', new Date('2026-08-01T12:00:00.000Z')),
            handle: null,
            display_name: null,
            activity_types: null,
          },
        ],
      });

      const page = await service.listFollowers(SAMPLE_DID);

      expect(page.items[0]).not.toHaveProperty('followerHandle');
      expect(page.items[0]).not.toHaveProperty('followerDisplayName');
      expect(page.items[0]).not.toHaveProperty('activityTypes');
    });

    it('returns a timestamp-and-uri cursor when more rows follow', async () => {
      const rows = [
        followerRow('one', new Date('2026-08-03T00:00:00.000Z')),
        followerRow('two', new Date('2026-08-02T00:00:00.000Z')),
        followerRow('three', new Date('2026-08-01T00:00:00.000Z')),
      ];
      pool.query.mockResolvedValueOnce({ rows });

      const page = await service.listFollowers(SAMPLE_DID, { limit: 2 });

      expect(page.items).toHaveLength(2);
      expect(page.hasMore).toBe(true);
      expect(page.cursor).toBe(
        `2026-08-02T00:00:00.000Z::at://${FOLLOWER_DID}/pub.chive.graph.node/two`
      );
    });

    it('omits the cursor on the last page', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [followerRow('one', new Date('2026-08-01T00:00:00.000Z'))],
      });

      const page = await service.listFollowers(SAMPLE_DID, { limit: 25 });

      expect(page.hasMore).toBe(false);
      expect(page.cursor).toBeUndefined();
    });

    it('applies a keyset predicate on both timestamp and uri', async () => {
      const cursor = `2026-08-02T00:00:00.000Z::at://${FOLLOWER_DID}/pub.chive.graph.node/two`;

      await service.listFollowers(SAMPLE_DID, { cursor });

      const [sql, params] = pool.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('(c.created_at, c.uri) < ($2, $3)');
      expect(params[1]).toEqual(new Date('2026-08-02T00:00:00.000Z'));
      expect(params[2]).toBe(`at://${FOLLOWER_DID}/pub.chive.graph.node/two`);
    });

    it('ignores a malformed cursor rather than filtering on garbage', async () => {
      await service.listFollowers(SAMPLE_DID, { cursor: 'not-a-cursor' });

      const [sql] = pool.query.mock.calls[0] as [string, unknown[]];
      expect(sql).not.toContain('c.created_at, c.uri) <');
    });

    it('caps the requested limit at 100', async () => {
      await service.listFollowers(SAMPLE_DID, { limit: 5000 });

      const [, params] = pool.query.mock.calls[0] as [string, unknown[]];
      expect(params[params.length - 1]).toBe(101);
    });

    it('returns an empty page when the query fails', async () => {
      pool.query.mockRejectedValueOnce(new Error('connection reset'));

      const page = await service.listFollowers(SAMPLE_DID);

      expect(page).toEqual({ items: [], hasMore: false });
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('listCollectionAdds', () => {
    it('maps edge rows to collection-add notifications', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [collectionAddRow('edge-one', new Date('2026-08-01T12:00:00.000Z'))],
      });

      const page = await service.listCollectionAdds(SAMPLE_DID);

      expect(page.items).toHaveLength(1);
      expect(page.items[0]).toEqual({
        uri: `at://${COLLECTOR_DID}/pub.chive.graph.edge/edge-one`,
        actorDid: COLLECTOR_DID,
        actorHandle: 'collector.example.com',
        actorDisplayName: 'A Collector',
        collectionUri: `at://${COLLECTOR_DID}/pub.chive.graph.node/nlp-reading-list`,
        collectionLabel: 'NLP reading list',
        eprintUri: `at://${SAMPLE_DID}/pub.chive.eprint.submission/megaattitude`,
        eprintTitle: 'Probabilistic dynamic semantics',
        createdAt: new Date('2026-08-01T12:00:00.000Z'),
      });
    });

    it('restricts to contains edges over eprint nodes owned by someone else', async () => {
      await service.listCollectionAdds(SAMPLE_DID);

      const [sql, params] = pool.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain("ce.relation_slug = 'contains'");
      expect(sql).toContain("n.subkind = 'eprint'");
      expect(sql).toContain('ce.owner_did <> $1');
      expect(params[0]).toBe(SAMPLE_DID);
    });

    it('matches the caller against the eprint authors array and skips deleted eprints', async () => {
      await service.listCollectionAdds(SAMPLE_DID);

      const [sql] = pool.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain("e.authors @> jsonb_build_array(jsonb_build_object('did', $1::text))");
      expect(sql).toContain('e.deleted_at IS NULL');
    });

    it('omits the collection label when neither index carries one', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            ...collectionAddRow('edge-one', new Date('2026-08-01T12:00:00.000Z')),
            collection_label: null,
          },
        ],
      });

      const page = await service.listCollectionAdds(SAMPLE_DID);

      expect(page.items[0]).not.toHaveProperty('collectionLabel');
    });

    it('returns a timestamp-and-uri cursor when more rows follow', async () => {
      const rows = [
        collectionAddRow('edge-one', new Date('2026-08-03T00:00:00.000Z')),
        collectionAddRow('edge-two', new Date('2026-08-02T00:00:00.000Z')),
        collectionAddRow('edge-three', new Date('2026-08-01T00:00:00.000Z')),
      ];
      pool.query.mockResolvedValueOnce({ rows });

      const page = await service.listCollectionAdds(SAMPLE_DID, { limit: 2 });

      expect(page.items).toHaveLength(2);
      expect(page.hasMore).toBe(true);
      expect(page.cursor).toBe(
        `2026-08-02T00:00:00.000Z::at://${COLLECTOR_DID}/pub.chive.graph.edge/edge-two`
      );
    });

    it('applies a keyset predicate on both timestamp and uri', async () => {
      const cursor = `2026-08-02T00:00:00.000Z::at://${COLLECTOR_DID}/pub.chive.graph.edge/edge-two`;

      await service.listCollectionAdds(SAMPLE_DID, { cursor });

      const [sql, params] = pool.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('(ce.created_at, ce.uri) < ($2, $3)');
      expect(params[1]).toEqual(new Date('2026-08-02T00:00:00.000Z'));
      expect(params[2]).toBe(`at://${COLLECTOR_DID}/pub.chive.graph.edge/edge-two`);
    });

    it('returns an empty page when the query fails', async () => {
      pool.query.mockRejectedValueOnce(new Error('deadlock detected'));

      const page = await service.listCollectionAdds(SAMPLE_DID);

      expect(page).toEqual({ items: [], hasMore: false });
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
