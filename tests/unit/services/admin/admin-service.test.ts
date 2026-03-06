/**
 * Unit tests for AdminService.
 *
 * @remarks
 * Tests all public methods of the admin dashboard service: aggregate stats,
 * system health checks, alpha application management, user search, content
 * listing, governance, search analytics, and metrics.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

import { AdminService } from '@/services/admin/admin-service.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

// ============================================================================
// Mock Factories
// ============================================================================

interface MockPool {
  query: Mock;
}

const createMockPool = (): MockPool => ({
  query: vi.fn().mockResolvedValue({ rows: [] }),
});

interface MockRedis {
  ping: Mock;
  get: Mock;
  set: Mock;
  smembers: Mock;
  lrange: Mock;
  llen: Mock;
  lrem: Mock;
  rpush: Mock;
  del: Mock;
  keys: Mock;
  zrangebyscore: Mock;
}

const createMockRedis = (): MockRedis => ({
  ping: vi.fn().mockResolvedValue('PONG'),
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue('OK'),
  smembers: vi.fn().mockResolvedValue([]),
  lrange: vi.fn().mockResolvedValue([]),
  llen: vi.fn().mockResolvedValue(0),
  lrem: vi.fn().mockResolvedValue(0),
  rpush: vi.fn().mockResolvedValue(1),
  del: vi.fn().mockResolvedValue(1),
  keys: vi.fn().mockResolvedValue([]),
  zrangebyscore: vi.fn().mockResolvedValue([]),
});

const createMockEsPool = (): { healthCheck: Mock } => ({
  healthCheck: vi.fn().mockResolvedValue({ healthy: true, responseTimeMs: 5 }),
});

const createMockNeo4jConnection = (): { healthCheck: Mock } => ({
  healthCheck: vi.fn().mockResolvedValue({ healthy: true, message: 'OK' }),
});

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

// ============================================================================
// Sample Data
// ============================================================================

const SAMPLE_ALPHA_ROW = {
  id: 'app-uuid-1',
  did: 'did:plc:testuser1',
  handle: 'testuser.bsky.social',
  email: 'researcher@university.edu',
  status: 'pending',
  sector: 'academia',
  sectorOther: null,
  careerStage: 'postdoc',
  careerStageOther: null,
  affiliations: [{ name: 'MIT' }],
  researchKeywords: [{ label: 'NLP' }],
  motivation: 'Testing purposes',
  zulipInvited: false,
  reviewedAt: null,
  reviewedBy: null,
  createdAt: new Date('2024-06-01T10:00:00Z'),
  updatedAt: new Date('2024-06-01T10:00:00Z'),
};

const SAMPLE_ALPHA_ROW_APPROVED = {
  ...SAMPLE_ALPHA_ROW,
  id: 'app-uuid-2',
  did: 'did:plc:testuser2',
  status: 'approved',
  reviewedAt: new Date('2024-06-02T10:00:00Z'),
  reviewedBy: 'did:plc:admin',
};

// ============================================================================
// Tests
// ============================================================================

describe('AdminService', () => {
  let service: AdminService;
  let mockPool: MockPool;
  let mockRedis: MockRedis;
  let mockEsPool: { healthCheck: Mock };
  let mockNeo4j: { healthCheck: Mock };
  let mockLogger: ILogger;

  beforeEach(() => {
    mockPool = createMockPool();
    mockRedis = createMockRedis();
    mockEsPool = createMockEsPool();
    mockNeo4j = createMockNeo4jConnection();
    mockLogger = createMockLogger();

    service = new AdminService(
      mockPool as never,
      mockRedis as never,
      mockEsPool as never,
      mockNeo4j as never,
      mockLogger
    );
  });

  // ==========================================================================
  // getOverview
  // ==========================================================================

  describe('getOverview', () => {
    it('returns aggregate counts from all index tables', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ eprints: 42, authors: 15, reviews: 8, endorsements: 3, collections: 2, tags: 20 }],
      });

      const result = await service.getOverview();

      expect(result).toEqual({
        eprints: 42,
        authors: 15,
        reviews: 8,
        endorsements: 3,
        collections: 2,
        tags: 20,
      });
    });

    it('returns zeroes when the query result is empty', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getOverview();

      expect(result).toEqual({
        eprints: 0,
        authors: 0,
        reviews: 0,
        endorsements: 0,
        collections: 0,
        tags: 0,
      });
    });

    it('returns zeroes when the first row is undefined', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [undefined] });

      const result = await service.getOverview();

      expect(result).toEqual({
        eprints: 0,
        authors: 0,
        reviews: 0,
        endorsements: 0,
        collections: 0,
        tags: 0,
      });
    });

    it('calls pool.query exactly once', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ eprints: 1, authors: 1, reviews: 1, endorsements: 1, collections: 1, tags: 1 }],
      });

      await service.getOverview();

      expect(mockPool.query).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // getSystemHealth
  // ==========================================================================

  describe('getSystemHealth', () => {
    it('returns healthy when all databases are healthy', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
      mockEsPool.healthCheck.mockResolvedValue({ healthy: true, responseTimeMs: 5 });
      mockNeo4j.healthCheck.mockResolvedValue({ healthy: true, message: 'OK' });
      mockRedis.ping.mockResolvedValue('PONG');

      const result = await service.getSystemHealth();

      expect(result.status).toBe('healthy');
      expect(result.databases).toHaveLength(4);
      expect(result.databases.every((db) => db.healthy)).toBe(true);
      expect(result.uptime).toBeTypeOf('number');
      expect(result.timestamp).toBeTruthy();
    });

    it('returns degraded when one database is unhealthy', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
      mockEsPool.healthCheck.mockResolvedValue({ healthy: false, error: 'Cluster unhealthy' });
      mockNeo4j.healthCheck.mockResolvedValue({ healthy: true, message: 'OK' });
      mockRedis.ping.mockResolvedValue('PONG');

      const result = await service.getSystemHealth();

      expect(result.status).toBe('degraded');
      const esDb = result.databases.find((db) => db.name === 'elasticsearch');
      expect(esDb?.healthy).toBe(false);
      expect(esDb?.error).toBe('Cluster unhealthy');
    });

    it('returns unhealthy when all databases are down', async () => {
      mockPool.query.mockRejectedValue(new Error('Connection refused'));
      mockEsPool.healthCheck.mockResolvedValue({ healthy: false, error: 'Timeout' });
      mockNeo4j.healthCheck.mockResolvedValue({ healthy: false, message: 'Connection lost' });
      mockRedis.ping.mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await service.getSystemHealth();

      expect(result.status).toBe('unhealthy');
      expect(result.databases.every((db) => !db.healthy)).toBe(true);
    });

    it('captures PostgreSQL failure gracefully', async () => {
      mockPool.query.mockRejectedValue(new Error('PG down'));
      mockEsPool.healthCheck.mockResolvedValue({ healthy: true, responseTimeMs: 5 });
      mockNeo4j.healthCheck.mockResolvedValue({ healthy: true });
      mockRedis.ping.mockResolvedValue('PONG');

      const result = await service.getSystemHealth();

      expect(result.status).toBe('degraded');
      const pgDb = result.databases.find((db) => db.name === 'postgresql');
      expect(pgDb?.healthy).toBe(false);
      expect(pgDb?.error).toBe('PG down');
    });

    it('captures Redis failure gracefully', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      mockEsPool.healthCheck.mockResolvedValue({ healthy: true, responseTimeMs: 5 });
      mockNeo4j.healthCheck.mockResolvedValue({ healthy: true });
      mockRedis.ping.mockRejectedValue(new Error('Redis timeout'));

      const result = await service.getSystemHealth();

      expect(result.status).toBe('degraded');
      const redisDb = result.databases.find((db) => db.name === 'redis');
      expect(redisDb?.healthy).toBe(false);
      expect(redisDb?.error).toBe('Redis timeout');
    });

    it('captures Neo4j unhealthy status via healthCheck result', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      mockEsPool.healthCheck.mockResolvedValue({ healthy: true, responseTimeMs: 5 });
      mockNeo4j.healthCheck.mockResolvedValue({
        healthy: false,
        message: 'Driver not initialized',
      });
      mockRedis.ping.mockResolvedValue('PONG');

      const result = await service.getSystemHealth();

      expect(result.status).toBe('degraded');
      const neo4jDb = result.databases.find((db) => db.name === 'neo4j');
      expect(neo4jDb?.healthy).toBe(false);
    });

    it('includes latencyMs for each database check', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      mockEsPool.healthCheck.mockResolvedValue({ healthy: true, responseTimeMs: 5 });
      mockNeo4j.healthCheck.mockResolvedValue({ healthy: true });
      mockRedis.ping.mockResolvedValue('PONG');

      const result = await service.getSystemHealth();

      for (const db of result.databases) {
        expect(db.latencyMs).toBeTypeOf('number');
        expect(db.latencyMs).toBeGreaterThanOrEqual(0);
      }
    });

    it('handles ES healthCheck returning error without message', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      mockEsPool.healthCheck.mockResolvedValue({ healthy: false });
      mockNeo4j.healthCheck.mockResolvedValue({ healthy: true });
      mockRedis.ping.mockResolvedValue('PONG');

      const result = await service.getSystemHealth();

      expect(result.status).toBe('degraded');
      const esDb = result.databases.find((db) => db.name === 'elasticsearch');
      expect(esDb?.healthy).toBe(false);
      expect(esDb?.error).toBe('Cluster unhealthy');
    });
  });

  // ==========================================================================
  // getAlphaApplications
  // ==========================================================================

  describe('getAlphaApplications', () => {
    it('returns paginated list without filters', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [SAMPLE_ALPHA_ROW] })
        .mockResolvedValueOnce({ rows: [{ count: 1 }] });

      const result = await service.getAlphaApplications();

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.items[0]?.did).toBe('did:plc:testuser1');
      expect(result.items[0]?.status).toBe('pending');
    });

    it('filters by status', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [SAMPLE_ALPHA_ROW_APPROVED] })
        .mockResolvedValueOnce({ rows: [{ count: 1 }] });

      const result = await service.getAlphaApplications('approved');

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.status).toBe('approved');

      const dataCall = mockPool.query.mock.calls[0];
      expect(dataCall?.[1]).toContain('approved');
    });

    it('applies cursor-based pagination', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [SAMPLE_ALPHA_ROW] })
        .mockResolvedValueOnce({ rows: [{ count: 5 }] });

      const cursorDate = '2024-06-01T00:00:00Z';
      const result = await service.getAlphaApplications(undefined, 10, cursorDate);

      expect(result.items).toHaveLength(1);
      const dataCall = mockPool.query.mock.calls[0];
      expect(dataCall?.[1]).toContain(cursorDate);
    });

    it('sets cursor when there are more results', async () => {
      const rows = [SAMPLE_ALPHA_ROW, { ...SAMPLE_ALPHA_ROW, id: 'extra' }];
      mockPool.query
        .mockResolvedValueOnce({ rows })
        .mockResolvedValueOnce({ rows: [{ count: 10 }] });

      const result = await service.getAlphaApplications(undefined, 1);

      expect(result.items).toHaveLength(1);
      expect(result.cursor).toBeTruthy();
    });

    it('does not set cursor when no more results', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [SAMPLE_ALPHA_ROW] })
        .mockResolvedValueOnce({ rows: [{ count: 1 }] });

      const result = await service.getAlphaApplications(undefined, 50);

      expect(result.cursor).toBeUndefined();
    });

    it('handles empty result', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: 0 }] });

      const result = await service.getAlphaApplications();

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('normalizes Date fields to ISO strings', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [SAMPLE_ALPHA_ROW] })
        .mockResolvedValueOnce({ rows: [{ count: 1 }] });

      const result = await service.getAlphaApplications();

      const item = result.items[0];
      expect(item).toBeDefined();
      expect(item?.createdAt).toBe('2024-06-01T10:00:00.000Z');
      expect(item?.updatedAt).toBe('2024-06-01T10:00:00.000Z');
    });

    it('normalizes null affiliations and researchKeywords to empty arrays', async () => {
      const rowWithNulls = { ...SAMPLE_ALPHA_ROW, affiliations: null, researchKeywords: null };
      mockPool.query
        .mockResolvedValueOnce({ rows: [rowWithNulls] })
        .mockResolvedValueOnce({ rows: [{ count: 1 }] });

      const result = await service.getAlphaApplications();

      expect(result.items[0]?.affiliations).toEqual([]);
      expect(result.items[0]?.researchKeywords).toEqual([]);
    });

    it('handles both status and cursor filters simultaneously', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: 0 }] });

      await service.getAlphaApplications('pending', 10, '2024-01-01T00:00:00Z');

      const dataCall = mockPool.query.mock.calls[0];
      expect(dataCall?.[1]).toContain('pending');
      expect(dataCall?.[1]).toContain('2024-01-01T00:00:00Z');
    });
  });

  // ==========================================================================
  // getAlphaApplication
  // ==========================================================================

  describe('getAlphaApplication', () => {
    it('returns a single application by DID', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [SAMPLE_ALPHA_ROW] });

      const result = await service.getAlphaApplication('did:plc:testuser1');

      expect(result).not.toBeNull();
      expect(result?.did).toBe('did:plc:testuser1');
      expect(result?.email).toBe('researcher@university.edu');
    });

    it('returns null when application not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getAlphaApplication('did:plc:nonexistent');

      expect(result).toBeNull();
    });

    it('passes the DID parameter to the query', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await service.getAlphaApplication('did:plc:abc');

      expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), ['did:plc:abc']);
    });
  });

  // ==========================================================================
  // updateAlphaApplication
  // ==========================================================================

  describe('updateAlphaApplication', () => {
    it('approves an application', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rowCount: 1 }) // UPDATE
        .mockResolvedValueOnce({
          rows: [{ ...SAMPLE_ALPHA_ROW, status: 'approved' }],
        }); // getAlphaApplication re-fetch

      const result = await service.updateAlphaApplication(
        'did:plc:testuser1',
        'approve',
        'did:plc:admin'
      );

      expect(result?.status).toBe('approved');
      const updateCall = mockPool.query.mock.calls[0];
      expect(updateCall?.[1]).toContain('approved');
      expect(updateCall?.[1]).toContain('did:plc:admin');
      expect(updateCall?.[1]).toContain('did:plc:testuser1');
    });

    it('rejects an application', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ ...SAMPLE_ALPHA_ROW, status: 'rejected' }] });

      const result = await service.updateAlphaApplication(
        'did:plc:testuser1',
        'reject',
        'did:plc:admin'
      );

      expect(result?.status).toBe('rejected');
    });

    it('revokes an application', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ ...SAMPLE_ALPHA_ROW, status: 'revoked' }] });

      const result = await service.updateAlphaApplication(
        'did:plc:testuser1',
        'revoke',
        'did:plc:admin'
      );

      expect(result?.status).toBe('revoked');
    });

    it('returns null when the DID does not exist after update', async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 0 }).mockResolvedValueOnce({ rows: [] });

      const result = await service.updateAlphaApplication(
        'did:plc:nonexistent',
        'approve',
        'did:plc:admin'
      );

      expect(result).toBeNull();
    });

    it('logs the update action', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rows: [SAMPLE_ALPHA_ROW] });

      await service.updateAlphaApplication('did:plc:testuser1', 'approve', 'did:plc:admin');

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Alpha application updated',
        expect.objectContaining({ did: 'did:plc:testuser1', action: 'approve' })
      );
    });
  });

  // ==========================================================================
  // getAlphaStats
  // ==========================================================================

  describe('getAlphaStats', () => {
    it('returns aggregated stats from multiple queries', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            { status: 'pending', count: 5 },
            { status: 'approved', count: 3 },
          ],
        })
        .mockResolvedValueOnce({
          rows: [{ sector: 'academia', count: 6 }],
        })
        .mockResolvedValueOnce({
          rows: [{ career_stage: 'postdoc', count: 4 }],
        })
        .mockResolvedValueOnce({
          rows: [{ date: new Date('2024-06-01'), count: 2 }],
        })
        .mockResolvedValueOnce({
          rows: [{ count: 8 }],
        });

      const result = await service.getAlphaStats();

      expect(result.byStatus).toEqual({ pending: 5, approved: 3 });
      expect(result.bySector).toEqual({ academia: 6 });
      expect(result.byCareerStage).toEqual({ postdoc: 4 });
      expect(result.recentByDay).toHaveLength(1);
      expect(result.recentByDay[0]?.date).toBe('2024-06-01');
      expect(result.total).toBe(8);
    });

    it('handles empty stats', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.getAlphaStats();

      expect(result.byStatus).toEqual({});
      expect(result.bySector).toEqual({});
      expect(result.byCareerStage).toEqual({});
      expect(result.recentByDay).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('handles date as string in recentByDay', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ date: '2024-06-01', count: 3 }],
        })
        .mockResolvedValueOnce({ rows: [{ count: 3 }] });

      const result = await service.getAlphaStats();

      expect(result.recentByDay[0]?.date).toBe('2024-06-01');
    });
  });

  // ==========================================================================
  // searchUsers
  // ==========================================================================

  describe('searchUsers', () => {
    it('returns users matching the query', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            did: 'did:plc:testuser1',
            handle: 'testuser.bsky.social',
            displayName: 'Test User',
            eprintCount: 5,
            reviewCount: 2,
            endorsementCount: 1,
            createdAt: new Date('2024-01-01T00:00:00Z'),
          },
        ],
      });
      mockRedis.smembers.mockResolvedValueOnce(['admin']);

      const result = await service.searchUsers('testuser');

      expect(result).toHaveLength(1);
      expect(result[0]?.did).toBe('did:plc:testuser1');
      expect(result[0]?.handle).toBe('testuser.bsky.social');
      expect(result[0]?.roles).toEqual(['admin']);
      expect(result[0]?.eprintCount).toBe(5);
    });

    it('returns empty array for no matches', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.searchUsers('nonexistent');

      expect(result).toEqual([]);
    });

    it('applies ILIKE search with wildcard', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await service.searchUsers('alice');

      const call = mockPool.query.mock.calls[0];
      expect(call?.[1]?.[0]).toBe('%alice%');
    });

    it('uses default limit of 20', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await service.searchUsers('test');

      const call = mockPool.query.mock.calls[0];
      expect(call?.[1]?.[1]).toBe(20);
    });

    it('passes custom limit', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await service.searchUsers('test', 5);

      const call = mockPool.query.mock.calls[0];
      expect(call?.[1]?.[1]).toBe(5);
    });

    it('enriches each user with roles from Redis', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            did: 'did:plc:user1',
            handle: 'user1',
            displayName: null,
            eprintCount: 0,
            reviewCount: 0,
            endorsementCount: 0,
            createdAt: null,
          },
          {
            did: 'did:plc:user2',
            handle: 'user2',
            displayName: null,
            eprintCount: 0,
            reviewCount: 0,
            endorsementCount: 0,
            createdAt: null,
          },
        ],
      });
      mockRedis.smembers.mockResolvedValueOnce(['admin', 'editor']).mockResolvedValueOnce([]);

      const result = await service.searchUsers('user');

      expect(result[0]?.roles).toEqual(['admin', 'editor']);
      expect(result[1]?.roles).toEqual([]);
      expect(mockRedis.smembers).toHaveBeenCalledWith('chive:authz:roles:did:plc:user1');
      expect(mockRedis.smembers).toHaveBeenCalledWith('chive:authz:roles:did:plc:user2');
    });
  });

  // ==========================================================================
  // getUserDetail
  // ==========================================================================

  describe('getUserDetail', () => {
    it('returns user detail with roles', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            did: 'did:plc:testuser1',
            handle: 'test.bsky.social',
            displayName: 'Test User',
            eprintCount: 10,
            reviewCount: 3,
            endorsementCount: 2,
            createdAt: new Date('2024-01-01T00:00:00Z'),
          },
        ],
      });
      mockRedis.smembers.mockResolvedValueOnce(['admin']);

      const result = await service.getUserDetail('did:plc:testuser1');

      expect(result).not.toBeNull();
      expect(result?.did).toBe('did:plc:testuser1');
      expect(result?.roles).toEqual(['admin']);
      expect(result?.createdAt).toBe('2024-01-01T00:00:00.000Z');
    });

    it('returns null when user not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getUserDetail('did:plc:nonexistent');

      expect(result).toBeNull();
    });

    it('queries Redis with the correct role key', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            did: 'did:plc:abc',
            handle: null,
            displayName: null,
            eprintCount: 0,
            reviewCount: 0,
            endorsementCount: 0,
            createdAt: null,
          },
        ],
      });
      mockRedis.smembers.mockResolvedValueOnce([]);

      await service.getUserDetail('did:plc:abc');

      expect(mockRedis.smembers).toHaveBeenCalledWith('chive:authz:roles:did:plc:abc');
    });

    it('handles null createdAt', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            did: 'did:plc:test',
            handle: null,
            displayName: null,
            eprintCount: 0,
            reviewCount: 0,
            endorsementCount: 0,
            createdAt: null,
          },
        ],
      });
      mockRedis.smembers.mockResolvedValueOnce([]);

      const result = await service.getUserDetail('did:plc:test');

      expect(result?.createdAt).toBeNull();
    });
  });

  // ==========================================================================
  // listEprints
  // ==========================================================================

  describe('listEprints', () => {
    it('returns paginated eprints without search query', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            {
              uri: 'at://did:plc:test/pub.chive.eprint.submission/abc',
              cid: 'bafytest',
              title: 'Test Eprint',
              submitted_by: 'did:plc:test',
              publication_status: 'preprint',
              keywords: ['nlp'],
              fields: [{ uri: 'at://did:plc:gov/pub.chive.graph.node/field1' }],
              created_at: new Date('2024-06-01T00:00:00Z'),
              indexed_at: new Date('2024-06-01T00:01:00Z'),
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ count: 1 }] });

      const result = await service.listEprints(undefined, 10, 0);

      expect(result.eprints).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.eprints[0]).toEqual(
        expect.objectContaining({
          uri: 'at://did:plc:test/pub.chive.eprint.submission/abc',
          title: 'Test Eprint',
          authorDid: 'did:plc:test',
          status: 'preprint',
        })
      );
    });

    it('applies search query filter on title and abstract', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: 0 }] });

      await service.listEprints('neural networks', 10, 0);

      const dataCall = mockPool.query.mock.calls[0];
      expect(dataCall?.[1]?.[0]).toBe('%neural networks%');
    });

    it('handles empty search query string', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: 0 }] });

      await service.listEprints('   ', 10, 0);

      // Should not include search filter for whitespace-only queries
      const dataCall = mockPool.query.mock.calls[0];
      expect(dataCall?.[1]).toEqual([10, 0]);
    });

    it('returns fieldUris from fields array', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            {
              uri: 'at://test',
              title: 'Test',
              submitted_by: 'did:plc:test',
              publication_status: null,
              keywords: [],
              fields: [
                { uri: 'at://gov/pub.chive.graph.node/f1' },
                { uri: 'at://gov/pub.chive.graph.node/f2' },
              ],
              created_at: '2024-01-01',
              indexed_at: '2024-01-01',
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ count: 1 }] });

      const result = await service.listEprints(undefined, 10, 0);

      expect(result.eprints[0]?.fieldUris).toEqual([
        'at://gov/pub.chive.graph.node/f1',
        'at://gov/pub.chive.graph.node/f2',
      ]);
    });

    it('defaults publication_status to eprint when null', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            {
              uri: 'at://test',
              title: 'Test',
              submitted_by: 'did:plc:test',
              publication_status: null,
              keywords: [],
              fields: null,
              created_at: '2024-01-01',
              indexed_at: '2024-01-01',
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ count: 1 }] });

      const result = await service.listEprints(undefined, 10, 0);

      expect(result.eprints[0]?.status).toBe('eprint');
    });

    it('handles non-array fields gracefully', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            {
              uri: 'at://test',
              title: 'Test',
              submitted_by: 'did:plc:test',
              publication_status: null,
              keywords: [],
              fields: null,
              created_at: '2024-01-01',
              indexed_at: '2024-01-01',
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ count: 1 }] });

      const result = await service.listEprints(undefined, 10, 0);

      expect(result.eprints[0]?.fieldUris).toBeUndefined();
    });
  });

  // ==========================================================================
  // listReviews
  // ==========================================================================

  describe('listReviews', () => {
    it('returns paginated reviews with eprint title join', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            {
              uri: 'at://did:plc:reviewer/pub.chive.review.comment/r1',
              cid: 'bafyreview1',
              eprint_uri: 'at://did:plc:author/pub.chive.eprint.submission/e1',
              reviewer_did: 'did:plc:reviewer',
              motivation: 'methodology-concern',
              reply_count: 2,
              endorsement_count: 1,
              eprint_title: 'Machine Learning Paper',
              created_at: new Date('2024-06-01T00:00:00Z'),
              indexed_at: new Date('2024-06-01T00:01:00Z'),
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ count: 1 }] });

      const result = await service.listReviews(10, 0);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.items[0]).toEqual(
        expect.objectContaining({
          uri: 'at://did:plc:reviewer/pub.chive.review.comment/r1',
          eprintUri: 'at://did:plc:author/pub.chive.eprint.submission/e1',
          reviewerDid: 'did:plc:reviewer',
          eprintTitle: 'Machine Learning Paper',
        })
      );
    });

    it('handles null eprint_title', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            {
              uri: 'at://r1',
              cid: 'bafytest',
              eprint_uri: 'at://e1',
              reviewer_did: 'did:plc:r',
              motivation: 'general',
              reply_count: 0,
              endorsement_count: 0,
              eprint_title: null,
              created_at: '2024-01-01',
              indexed_at: '2024-01-01',
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ count: 1 }] });

      const result = await service.listReviews(10, 0);

      expect(result.items[0]?.eprintTitle).toBeUndefined();
    });

    it('returns empty list with zero total', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: 0 }] });

      const result = await service.listReviews(10, 0);

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  // ==========================================================================
  // listEndorsements
  // ==========================================================================

  describe('listEndorsements', () => {
    it('returns paginated endorsements', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            {
              uri: 'at://did:plc:endorser/pub.chive.review.endorsement/end1',
              cid: 'bafyendorse1',
              eprint_uri: 'at://did:plc:author/pub.chive.eprint.submission/e1',
              endorser_did: 'did:plc:endorser',
              endorsement_type: 'methodological',
              comment: 'Solid methodology',
              eprint_title: 'Test Paper',
              created_at: new Date('2024-06-01T00:00:00Z'),
              indexed_at: new Date('2024-06-01T00:01:00Z'),
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ count: 1 }] });

      const result = await service.listEndorsements(10, 0);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.items[0]).toEqual(
        expect.objectContaining({
          endorserDid: 'did:plc:endorser',
          endorsementType: 'methodological',
          comment: 'Solid methodology',
          eprintTitle: 'Test Paper',
        })
      );
    });

    it('handles null comment', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            {
              uri: 'at://end1',
              cid: 'bafytest',
              eprint_uri: 'at://e1',
              endorser_did: 'did:plc:e',
              endorsement_type: 'analytical',
              comment: null,
              eprint_title: null,
              created_at: '2024-01-01',
              indexed_at: '2024-01-01',
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ count: 1 }] });

      const result = await service.listEndorsements(10, 0);

      expect(result.items[0]?.comment).toBeNull();
      expect(result.items[0]?.eprintTitle).toBeUndefined();
    });

    it('returns empty list when no endorsements exist', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: 0 }] });

      const result = await service.listEndorsements(10, 0);

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  // ==========================================================================
  // listImports
  // ==========================================================================

  describe('listImports', () => {
    it('returns paginated imports', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            {
              uri: 'at://did:plc:test/pub.chive.eprint.submission/imp1',
              title: 'Imported Paper',
              submitted_by: 'did:plc:test',
              pds_url: 'https://pds.example.com',
              created_at: new Date('2024-06-01T00:00:00Z'),
              indexed_at: new Date('2024-06-01T00:01:00Z'),
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ count: 1 }] });

      const result = await service.listImports(10, 0);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.items[0]).toEqual(
        expect.objectContaining({
          uri: 'at://did:plc:test/pub.chive.eprint.submission/imp1',
          title: 'Imported Paper',
          submittedBy: 'did:plc:test',
          pdsUrl: 'https://pds.example.com',
        })
      );
    });

    it('filters by source PDS', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: 0 }] });

      await service.listImports(10, 0, 'https://pds.example.com');

      const dataCall = mockPool.query.mock.calls[0];
      expect(dataCall?.[1]?.[0]).toBe('https://pds.example.com');
    });

    it('passes null for source when not specified', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: 0 }] });

      await service.listImports(10, 0);

      const dataCall = mockPool.query.mock.calls[0];
      expect(dataCall?.[1]?.[0]).toBeNull();
    });

    it('returns empty list', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: 0 }] });

      const result = await service.listImports(10, 0);

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  // ==========================================================================
  // deleteContent
  // ==========================================================================

  describe('deleteContent', () => {
    it('soft-deletes content from an allowed table', async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });

      const result = await service.deleteContent(
        'at://did:plc:test/pub.chive.eprint.submission/abc',
        'eprints_index'
      );

      expect(result.deleted).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE eprints_index'), [
        'at://did:plc:test/pub.chive.eprint.submission/abc',
      ]);
    });

    it('rejects deletion from disallowed table', async () => {
      const result = await service.deleteContent('at://test', 'users_table');

      expect(result.deleted).toBe(false);
      expect(mockPool.query).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Attempted deletion from disallowed table',
        undefined,
        expect.objectContaining({ table: 'users_table' })
      );
    });

    it('returns false when no matching record found', async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 0 });

      const result = await service.deleteContent(
        'at://did:plc:test/pub.chive.eprint.submission/nonexistent',
        'reviews_index'
      );

      expect(result.deleted).toBe(false);
    });

    it('allows deletion from reviews_index', async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });
      const result = await service.deleteContent('at://test', 'reviews_index');
      expect(result.deleted).toBe(true);
    });

    it('allows deletion from endorsements_index', async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });
      const result = await service.deleteContent('at://test', 'endorsements_index');
      expect(result.deleted).toBe(true);
    });

    it('allows deletion from user_tags_index', async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });
      const result = await service.deleteContent('at://test', 'user_tags_index');
      expect(result.deleted).toBe(true);
    });

    it('handles null rowCount gracefully', async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: null });

      const result = await service.deleteContent('at://test', 'eprints_index');

      expect(result.deleted).toBe(false);
    });

    it('logs successful deletion', async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });

      await service.deleteContent('at://test/uri', 'eprints_index');

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Content deleted from index',
        expect.objectContaining({ uri: 'at://test/uri', table: 'eprints_index' })
      );
    });

    it('logs warning when no content found', async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 0 });

      await service.deleteContent('at://test/uri', 'eprints_index');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No content found to delete',
        expect.objectContaining({ uri: 'at://test/uri' })
      );
    });
  });

  // ==========================================================================
  // getSearchAnalytics
  // ==========================================================================

  describe('getSearchAnalytics', () => {
    it('returns aggregated search analytics', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ total_queries: 100 }] })
        .mockResolvedValueOnce({ rows: [{ total_clicks: 25 }] })
        .mockResolvedValueOnce({ rows: [{ impressions: 100, clicks: 25 }] })
        .mockResolvedValueOnce({ rows: [{ avg_dwell_time: 3500 }] })
        .mockResolvedValueOnce({
          rows: [
            { position: 1, count: 15 },
            { position: 2, count: 7 },
          ],
        })
        .mockResolvedValueOnce({
          rows: [{ query: 'neural networks', impression_count: 50, click_count: 10 }],
        })
        .mockResolvedValueOnce({ rows: [{ zero_result_count: 3 }] })
        .mockResolvedValueOnce({
          rows: [
            { relevance_grade: 1, count: 5 },
            { relevance_grade: 3, count: 8 },
          ],
        });

      const result = await service.getSearchAnalytics();

      expect(result.totalQueries).toBe(100);
      expect(result.totalClicks).toBe(25);
      expect(result.impressions).toBe(100);
      expect(result.clicks).toBe(25);
      expect(result.ctr).toBe(0.25);
      expect(result.avgDwellTimeMs).toBe(3500);
      expect(result.positionDistribution).toHaveLength(2);
      expect(result.topQueries).toHaveLength(1);
      expect(result.topQueries[0]?.query).toBe('neural networks');
      expect(result.zeroResultCount).toBe(3);
      expect(result.relevanceGradeDistribution).toHaveLength(2);
      expect(result.timestamp).toBeTruthy();
    });

    it('returns zero CTR when no impressions', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ total_queries: 0 }] })
        .mockResolvedValueOnce({ rows: [{ total_clicks: 0 }] })
        .mockResolvedValueOnce({ rows: [{ impressions: 0, clicks: 0 }] })
        .mockResolvedValueOnce({ rows: [{ avg_dwell_time: null }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ zero_result_count: 0 }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.getSearchAnalytics();

      expect(result.ctr).toBe(0);
      expect(result.avgDwellTimeMs).toBeNull();
      expect(result.positionDistribution).toEqual([]);
      expect(result.topQueries).toEqual([]);
    });

    it('handles query failures with graceful fallbacks', async () => {
      // All queries fail
      mockPool.query.mockRejectedValue(new Error('Table does not exist'));

      const result = await service.getSearchAnalytics();

      expect(result.totalQueries).toBe(0);
      expect(result.totalClicks).toBe(0);
      expect(result.impressions).toBe(0);
      expect(result.clicks).toBe(0);
      expect(result.ctr).toBe(0);
    });
  });

  // ==========================================================================
  // getAuditLog
  // ==========================================================================

  describe('getAuditLog', () => {
    it('returns paginated audit log entries', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'log-1',
              action: 'approve_proposal',
              collection: 'pub.chive.graph.node',
              uri: 'at://gov/pub.chive.graph.node/f1',
              editor_did: 'did:plc:editor',
              record_snapshot: { name: 'Machine Learning' },
              created_at: new Date('2024-06-01T00:00:00Z'),
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ count: 1 }] });

      const result = await service.getAuditLog(10, 0);

      expect(result.entries).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.entries[0]).toEqual(
        expect.objectContaining({
          id: 'log-1',
          action: 'approve_proposal',
          actorDid: 'did:plc:editor',
          collection: 'pub.chive.graph.node',
        })
      );
    });

    it('filters by actorDid', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: 0 }] });

      await service.getAuditLog(10, 0, 'did:plc:editor');

      const dataCall = mockPool.query.mock.calls[0];
      expect(dataCall?.[1]).toContain('did:plc:editor');
    });

    it('returns empty result when table does not exist', async () => {
      mockPool.query.mockRejectedValue(new Error('relation "governance_audit_log" does not exist'));

      const result = await service.getAuditLog(10, 0);

      expect(result.entries).toEqual([]);
      expect(result.total).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'governance_audit_log table not available; returning empty result'
      );
    });

    it('returns entries without actorDid filter', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: 0 }] });

      const result = await service.getAuditLog(10, 0);

      expect(result.entries).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  // ==========================================================================
  // listWarnings
  // ==========================================================================

  describe('listWarnings', () => {
    it('returns warnings list', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'warn-1',
            user_did: 'did:plc:user1',
            reason: 'Spam content detected',
            issued_by: 'did:plc:admin',
            issued_at: new Date('2024-06-01T00:00:00Z'),
            expires_at: null,
            active: true,
            resolved_at: null,
            resolved_by: null,
          },
        ],
      });

      const result = await service.listWarnings(10);

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toEqual(
        expect.objectContaining({
          id: 'warn-1',
          targetDid: 'did:plc:user1',
          reason: 'Spam content detected',
          issuedBy: 'did:plc:admin',
          acknowledged: false,
          acknowledgedAt: null,
        })
      );
    });

    it('marks resolved warnings as acknowledged', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'warn-2',
            user_did: 'did:plc:user2',
            reason: 'Policy violation',
            issued_by: 'did:plc:admin',
            issued_at: new Date('2024-06-01T00:00:00Z'),
            expires_at: null,
            active: false,
            resolved_at: new Date('2024-06-02T00:00:00Z'),
            resolved_by: 'did:plc:admin',
          },
        ],
      });

      const result = await service.listWarnings(10);

      expect(result.warnings[0]?.acknowledged).toBe(true);
      expect(result.warnings[0]?.acknowledgedAt).toBe('2024-06-02T00:00:00.000Z');
    });

    it('filters by DID', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await service.listWarnings(10, 'did:plc:target');

      const call = mockPool.query.mock.calls[0];
      expect(call?.[1]).toContain('did:plc:target');
    });

    it('returns empty result when table does not exist', async () => {
      mockPool.query.mockRejectedValue(new Error('relation does not exist'));

      const result = await service.listWarnings(10);

      expect(result.warnings).toEqual([]);
    });

    it('does not include DID filter when not provided', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await service.listWarnings(20);

      const call = mockPool.query.mock.calls[0];
      // Only the limit param, no DID
      expect(call?.[1]).toEqual([20]);
    });
  });

  // ==========================================================================
  // listViolations
  // ==========================================================================

  describe('listViolations', () => {
    it('returns violations list', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'viol-1',
            user_did: 'did:plc:user1',
            violation_type: 'plagiarism',
            description: 'Duplicate content detected',
            issued_by: 'did:plc:admin',
            issued_at: new Date('2024-06-01T00:00:00Z'),
            related_uri: 'at://did:plc:user1/pub.chive.eprint.submission/abc',
          },
        ],
      });

      const result = await service.listViolations(10);

      expect(result.violations).toHaveLength(1);
      expect(result.violations[0]).toEqual(
        expect.objectContaining({
          id: 'viol-1',
          targetDid: 'did:plc:user1',
          type: 'plagiarism',
          description: 'Duplicate content detected',
          targetUri: 'at://did:plc:user1/pub.chive.eprint.submission/abc',
        })
      );
    });

    it('handles null related_uri', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'viol-2',
            user_did: 'did:plc:user1',
            violation_type: 'tos',
            description: 'Terms of service violation',
            issued_by: 'did:plc:admin',
            issued_at: '2024-06-01',
            related_uri: null,
          },
        ],
      });

      const result = await service.listViolations(10);

      expect(result.violations[0]?.targetUri).toBeUndefined();
    });

    it('filters by DID', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await service.listViolations(10, 'did:plc:target');

      const call = mockPool.query.mock.calls[0];
      expect(call?.[1]).toContain('did:plc:target');
    });

    it('returns empty result when table does not exist', async () => {
      mockPool.query.mockRejectedValue(new Error('relation does not exist'));

      const result = await service.listViolations(10);

      expect(result.violations).toEqual([]);
    });
  });

  // ==========================================================================
  // listPDSEntries
  // ==========================================================================

  describe('listPDSEntries', () => {
    it('returns PDS entries with status and counts', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            pds_url: 'https://pds.example.com',
            status: 'active',
            last_scan_at: new Date('2024-06-01T00:00:00Z'),
            chive_record_count: 42,
            user_count: 5,
          },
        ],
      });

      const result = await service.listPDSEntries();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          url: 'https://pds.example.com',
          status: 'active',
          lastScanAt: '2024-06-01T00:00:00.000Z',
          recordCount: 42,
          userCount: 5,
        })
      );
    });

    it('handles null last_scan_at', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            pds_url: 'https://pds.test.com',
            status: 'stale',
            last_scan_at: null,
            chive_record_count: 0,
            user_count: 0,
          },
        ],
      });

      const result = await service.listPDSEntries();

      expect(result[0]?.lastScanAt).toBeUndefined();
    });

    it('returns empty array when table does not exist', async () => {
      mockPool.query.mockRejectedValue(new Error('relation does not exist'));

      const result = await service.listPDSEntries();

      expect(result).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'pds_registry table not available; returning empty list'
      );
    });

    it('returns multiple PDS entries', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            pds_url: 'https://pds1.com',
            status: 'active',
            last_scan_at: null,
            chive_record_count: 100,
            user_count: 10,
          },
          {
            pds_url: 'https://pds2.com',
            status: 'unreachable',
            last_scan_at: null,
            chive_record_count: 5,
            user_count: 1,
          },
        ],
      });

      const result = await service.listPDSEntries();

      expect(result).toHaveLength(2);
      expect(result[0]?.url).toBe('https://pds1.com');
      expect(result[1]?.url).toBe('https://pds2.com');
    });
  });

  // ==========================================================================
  // getPendingProposalCount
  // ==========================================================================

  describe('getPendingProposalCount', () => {
    it('returns count of pending proposals', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ count: 7 }] });

      const result = await service.getPendingProposalCount();

      expect(result).toBe(7);
    });

    it('returns zero when no pending proposals', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ count: 0 }] });

      const result = await service.getPendingProposalCount();

      expect(result).toBe(0);
    });

    it('returns zero when table does not exist', async () => {
      mockPool.query.mockRejectedValue(new Error('relation does not exist'));

      const result = await service.getPendingProposalCount();

      expect(result).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'field_proposals_index table not available; returning 0'
      );
    });

    it('returns zero when rows are empty', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getPendingProposalCount();

      expect(result).toBe(0);
    });
  });

  // ==========================================================================
  // getViewDownloadTimeSeries
  // ==========================================================================

  describe('getViewDownloadTimeSeries', () => {
    it('returns aggregate data from eprint_metrics for all URIs', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            uri: 'at://test/e1',
            total_views: '150',
            total_downloads: '30',
            last_flushed_at: new Date('2024-06-01T00:00:00Z'),
          },
        ],
      });

      const result = await service.getViewDownloadTimeSeries();

      expect(result.buckets).toHaveLength(1);
      expect(result.buckets[0]?.views).toBe(150);
      expect(result.buckets[0]?.downloads).toBe(30);
      expect(result.timestamp).toBeTruthy();
    });

    it('returns single bucket for a specific URI', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            uri: 'at://test/e1',
            total_views: '50',
            total_downloads: '10',
            last_flushed_at: new Date('2024-06-01T00:00:00Z'),
          },
        ],
      });

      const result = await service.getViewDownloadTimeSeries('at://test/e1');

      expect(result.buckets).toHaveLength(1);
      expect(result.buckets[0]?.views).toBe(50);
    });

    it('returns empty buckets for unknown URI', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getViewDownloadTimeSeries('at://unknown');

      expect(result.buckets).toEqual([]);
    });

    it('queries Redis for hourly granularity with a specific URI', async () => {
      mockRedis.zrangebyscore.mockResolvedValueOnce(['1717200000000:user1', '1717200300000:user2']);

      const result = await service.getViewDownloadTimeSeries('at://test/e1', 'hour');

      expect(mockRedis.zrangebyscore).toHaveBeenCalledWith(
        'chive:metrics:views:24h:at://test/e1',
        expect.any(Number),
        expect.any(Number)
      );
      expect(result.buckets).toBeDefined();
      expect(result.timestamp).toBeTruthy();
    });

    it('falls back to PostgreSQL when Redis fails for hourly granularity', async () => {
      mockRedis.zrangebyscore.mockRejectedValueOnce(new Error('Redis timeout'));
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            uri: 'at://test/e1',
            total_views: '20',
            total_downloads: '5',
            last_flushed_at: new Date('2024-06-01T00:00:00Z'),
          },
        ],
      });

      const result = await service.getViewDownloadTimeSeries('at://test/e1', 'hour');

      expect(result.buckets).toHaveLength(1);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('returns empty buckets when eprint_metrics table does not exist', async () => {
      mockPool.query.mockRejectedValue(new Error('relation does not exist'));

      const result = await service.getViewDownloadTimeSeries();

      expect(result.buckets).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'eprint_metrics table not available; returning empty buckets'
      );
    });

    it('returns 24 hourly buckets when Redis has entries', async () => {
      mockRedis.zrangebyscore.mockResolvedValueOnce([]);

      const result = await service.getViewDownloadTimeSeries('at://test/e1', 'hour');

      expect(result.buckets).toHaveLength(24);
      for (const bucket of result.buckets) {
        expect(bucket.views).toBeTypeOf('number');
        expect(bucket.downloads).toBe(0);
      }
    });

    it('does not query Redis for hourly granularity without a URI', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await service.getViewDownloadTimeSeries(undefined, 'hour');

      expect(mockRedis.zrangebyscore).not.toHaveBeenCalled();
    });

    it('does not query Redis for day granularity', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            uri: 'at://test/e1',
            total_views: '50',
            total_downloads: '10',
            last_flushed_at: '2024-06-01',
          },
        ],
      });

      await service.getViewDownloadTimeSeries('at://test/e1', 'day');

      expect(mockRedis.zrangebyscore).not.toHaveBeenCalled();
    });

    it('handles Redis entries with invalid timestamps', async () => {
      mockRedis.zrangebyscore.mockResolvedValueOnce(['invalid:data', '0:notime']);

      const result = await service.getViewDownloadTimeSeries('at://test/e1', 'hour');

      // Should still return 24 hourly buckets without crashing
      expect(result.buckets).toHaveLength(24);
    });
  });

  // ==========================================================================
  // Response Shape Validation
  // ==========================================================================

  describe('response shape validation', () => {
    it('getOverview returns all expected fields', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ eprints: 1, authors: 2, reviews: 3, endorsements: 4, collections: 5, tags: 6 }],
      });

      const result = await service.getOverview();

      expect(result).toHaveProperty('eprints');
      expect(result).toHaveProperty('authors');
      expect(result).toHaveProperty('reviews');
      expect(result).toHaveProperty('endorsements');
      expect(result).toHaveProperty('collections');
      expect(result).toHaveProperty('tags');
    });

    it('getSystemHealth returns expected shape', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      mockEsPool.healthCheck.mockResolvedValue({ healthy: true, responseTimeMs: 1 });
      mockNeo4j.healthCheck.mockResolvedValue({ healthy: true });
      mockRedis.ping.mockResolvedValue('PONG');

      const result = await service.getSystemHealth();

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('databases');
      expect(result).toHaveProperty('uptime');
      expect(result).toHaveProperty('timestamp');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(result.status);
    });

    it('searchAnalytics returns expected shape', async () => {
      // Set up all 8 query responses
      for (let i = 0; i < 8; i++) {
        mockPool.query.mockResolvedValueOnce({ rows: [] });
      }

      const result = await service.getSearchAnalytics();

      expect(result).toHaveProperty('totalQueries');
      expect(result).toHaveProperty('totalClicks');
      expect(result).toHaveProperty('impressions');
      expect(result).toHaveProperty('clicks');
      expect(result).toHaveProperty('ctr');
      expect(result).toHaveProperty('avgDwellTimeMs');
      expect(result).toHaveProperty('positionDistribution');
      expect(result).toHaveProperty('topQueries');
      expect(result).toHaveProperty('zeroResultCount');
      expect(result).toHaveProperty('relevanceGradeDistribution');
      expect(result).toHaveProperty('timestamp');
    });
  });

  // ==========================================================================
  // Edge cases
  // ==========================================================================

  describe('edge cases', () => {
    it('getOverview handles query errors by propagating them', async () => {
      mockPool.query.mockRejectedValue(new Error('Connection lost'));

      await expect(service.getOverview()).rejects.toThrow('Connection lost');
    });

    it('getAlphaApplications handles count query returning no rows', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });

      const result = await service.getAlphaApplications();

      expect(result.total).toBe(0);
    });

    it('listReviews handles count query returning no rows', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });

      const result = await service.listReviews(10, 0);

      expect(result.total).toBe(0);
    });

    it('listEndorsements handles count query returning no rows', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });

      const result = await service.listEndorsements(10, 0);

      expect(result.total).toBe(0);
    });

    it('listImports handles count query returning no rows', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });

      const result = await service.listImports(10, 0);

      expect(result.total).toBe(0);
    });

    it('AdminService constructor calls logger.child', () => {
      expect(mockLogger.child).toHaveBeenCalledWith({ service: 'AdminService' });
    });

    it('getAlphaApplication handles string date values', async () => {
      const rowWithStringDates = {
        ...SAMPLE_ALPHA_ROW,
        createdAt: '2024-06-01T10:00:00.000Z',
        updatedAt: '2024-06-01T10:00:00.000Z',
      };
      mockPool.query.mockResolvedValueOnce({ rows: [rowWithStringDates] });

      const result = await service.getAlphaApplication('did:plc:testuser1');

      expect(result?.createdAt).toBe('2024-06-01T10:00:00.000Z');
    });

    it('getViewDownloadTimeSeries parses string total_views and total_downloads', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            uri: 'at://test/e1',
            total_views: '999',
            total_downloads: '123',
            last_flushed_at: '2024-06-01T00:00:00Z',
          },
        ],
      });

      const result = await service.getViewDownloadTimeSeries('at://test/e1');

      expect(result.buckets[0]?.views).toBe(999);
      expect(result.buckets[0]?.downloads).toBe(123);
    });
  });
});
