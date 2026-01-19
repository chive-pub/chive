/**
 * PDS Discovery integration tests.
 *
 * @remarks
 * Tests the PDS discovery workflow against real PostgreSQL and Redis instances:
 * - PDS registration and relay connectivity tracking
 * - Scanning queue management
 * - Scan result persistence
 *
 * External PDS fetches are mocked since they require external infrastructure,
 * but storage operations are tested against real databases.
 *
 * Requires Docker test stack running (PostgreSQL 16+, Redis 7+).
 *
 * @packageDocumentation
 */

import 'reflect-metadata';
import { Redis } from 'ioredis';
import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

import { PDSRegistry, isRelayConnectedPDSSync } from '@/services/pds-discovery/pds-registry.js';
import { RelayHostTracker } from '@/services/pds-discovery/relay-host-tracker.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

// =============================================================================
// Test Configuration
// =============================================================================

const TEST_DB_CONFIG = {
  host: 'localhost',
  port: 5432,
  user: 'chive',
  password: 'chive_test_password',
  database: 'chive',
};

const TEST_REDIS_CONFIG = {
  host: 'localhost',
  port: 6379,
  db: 1, // Use a different DB for tests
};

// =============================================================================
// Helpers
// =============================================================================

function createMockLogger(): ILogger {
  const logger: ILogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: () => createMockLogger(),
  };
  return logger;
}

// =============================================================================
// Tests
// =============================================================================

describe('PDS Discovery Integration', () => {
  let pool: Pool;
  let redis: Redis;
  let logger: ILogger;

  beforeAll(async () => {
    // Connect to test databases
    pool = new Pool(TEST_DB_CONFIG);
    redis = new Redis(TEST_REDIS_CONFIG);
    logger = createMockLogger();

    // Ensure test table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pds_registry (
        pds_url TEXT PRIMARY KEY,
        discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        discovery_source TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        last_scan_at TIMESTAMPTZ,
        next_scan_at TIMESTAMPTZ,
        has_chive_records BOOLEAN,
        chive_record_count INTEGER DEFAULT 0,
        consecutive_failures INTEGER DEFAULT 0,
        scan_priority INTEGER DEFAULT 100,
        last_error TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        is_relay_connected BOOLEAN DEFAULT FALSE
      )
    `);
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query('DELETE FROM pds_registry WHERE pds_url LIKE $1', ['https://test%']);
    await redis.flushdb();
    await pool.end();
    redis.disconnect();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    // Clean up test data
    await pool.query('DELETE FROM pds_registry WHERE pds_url LIKE $1', ['https://test%']);
    await redis.del('chive:relay:hosts:set');
  });

  describe('isRelayConnectedPDSSync utility function', () => {
    it('correctly identifies Bluesky-hosted PDSes', () => {
      expect(isRelayConnectedPDSSync('https://amanita.us-east.host.bsky.network')).toBe(true);
      expect(isRelayConnectedPDSSync('https://phellinus.us-west.host.bsky.network')).toBe(true);
      expect(isRelayConnectedPDSSync('https://bsky.social')).toBe(true);
    });

    it('correctly identifies non-Bluesky PDSes', () => {
      expect(isRelayConnectedPDSSync('https://pds.my-server.com')).toBe(false);
      expect(isRelayConnectedPDSSync('https://custom-pds.example.com')).toBe(false);
    });

    it('handles malformed URLs gracefully', () => {
      expect(isRelayConnectedPDSSync('')).toBe(false);
      expect(isRelayConnectedPDSSync('not-a-url')).toBe(false);
      expect(isRelayConnectedPDSSync('ftp://invalid.com')).toBe(false);
    });
  });

  describe('RelayHostTracker', () => {
    let tracker: RelayHostTracker;

    beforeEach(() => {
      tracker = new RelayHostTracker({
        redis,
        logger,
        config: {
          relayUrl: 'https://bsky.network',
          cacheTtlSeconds: 3600,
          timeoutMs: 5000,
        },
      });

      // Mock fetch for relay API
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            hosts: [
              {
                hostname: 'amanita.us-east.host.bsky.network',
                status: 'active',
                accountCount: 100,
                seq: 1,
              },
              {
                hostname: 'phellinus.us-west.host.bsky.network',
                status: 'active',
                accountCount: 200,
                seq: 2,
              },
              { hostname: 'offline.host.bsky.network', status: 'offline', accountCount: 0, seq: 3 },
            ],
          }),
      });
    });

    it('refreshes and caches relay hosts from API', async () => {
      await tracker.refresh();

      // Check that hosts were cached in Redis
      const cachedHosts = await redis.smembers('chive:relay:hosts:set');
      expect(cachedHosts).toContain('amanita.us-east.host.bsky.network');
      expect(cachedHosts).toContain('phellinus.us-west.host.bsky.network');
      // Offline hosts should not be included
      expect(cachedHosts).not.toContain('offline.host.bsky.network');
    });

    it('checks relay connectivity from cache', async () => {
      // Pre-populate cache
      await redis.sadd('chive:relay:hosts:set', 'cached.host.bsky.network');

      const isConnected = await tracker.isRelayConnected('https://cached.host.bsky.network');
      expect(isConnected).toBe(true);

      const isNotConnected = await tracker.isRelayConnected('https://not-in-cache.example.com');
      // Will trigger refresh since cache doesn't have the key marker, but host won't be found
      expect(isNotConnected).toBe(false);
    });

    it('returns list of known relay hosts', async () => {
      await tracker.refresh();

      const hosts = await tracker.getRelayHosts();
      expect(hosts).toContain('amanita.us-east.host.bsky.network');
      expect(hosts.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('PDSRegistry', () => {
    let registry: PDSRegistry;
    let mockRelayTracker: RelayHostTracker;

    beforeEach(() => {
      mockRelayTracker = {
        isRelayConnected: vi.fn().mockResolvedValue(false),
        getRelayHosts: vi.fn().mockResolvedValue([]),
        refresh: vi.fn().mockResolvedValue(undefined),
      } as unknown as RelayHostTracker;

      registry = new PDSRegistry(pool, logger, mockRelayTracker);
    });

    describe('PDS registration', () => {
      it('registers a new non-relay PDS', async () => {
        await registry.registerPDS('https://test-pds-1.example.com', 'user_registration');

        const result = await pool.query('SELECT * FROM pds_registry WHERE pds_url = $1', [
          'https://test-pds-1.example.com',
        ]);

        expect(result.rows).toHaveLength(1);
        expect(result.rows[0].discovery_source).toBe('user_registration');
        expect(result.rows[0].is_relay_connected).toBe(false);
      });

      it('registers a relay-connected PDS', async () => {
        (mockRelayTracker.isRelayConnected as ReturnType<typeof vi.fn>).mockResolvedValue(true);

        await registry.registerPDS('https://test-relay.host.bsky.network', 'plc_enumeration');

        const result = await pool.query('SELECT * FROM pds_registry WHERE pds_url = $1', [
          'https://test-relay.host.bsky.network',
        ]);

        expect(result.rows).toHaveLength(1);
        expect(result.rows[0].is_relay_connected).toBe(true);
      });

      it('normalizes URLs by removing trailing slash', async () => {
        await registry.registerPDS('https://test-pds-2.example.com/', 'user_registration');

        const result = await pool.query('SELECT * FROM pds_registry WHERE pds_url = $1', [
          'https://test-pds-2.example.com',
        ]);

        expect(result.rows).toHaveLength(1);
      });

      it('handles duplicate registration gracefully', async () => {
        await registry.registerPDS('https://test-pds-3.example.com', 'user_registration');
        await registry.registerPDS('https://test-pds-3.example.com', 'plc_enumeration');

        const result = await pool.query('SELECT * FROM pds_registry WHERE pds_url = $1', [
          'https://test-pds-3.example.com',
        ]);

        // Should still have only one entry
        expect(result.rows).toHaveLength(1);
      });
    });

    describe('getPDSesForScan', () => {
      beforeEach(async () => {
        // Insert test PDSes
        await pool.query(`
          INSERT INTO pds_registry (pds_url, discovery_source, status, is_relay_connected, consecutive_failures)
          VALUES
            ('https://test-scannable-1.example.com', 'user_registration', 'pending', FALSE, 0),
            ('https://test-scannable-2.example.com', 'user_registration', 'active', FALSE, 2),
            ('https://test-relay-skip.bsky.network', 'plc_enumeration', 'pending', TRUE, 0),
            ('https://test-failed.example.com', 'user_registration', 'pending', FALSE, 10)
        `);
      });

      it('only returns non-relay-connected PDSes', async () => {
        const result = await registry.getPDSesForScan(10);

        const urls = result.map((r) => r.pdsUrl);
        expect(urls).toContain('https://test-scannable-1.example.com');
        expect(urls).toContain('https://test-scannable-2.example.com');
        expect(urls).not.toContain('https://test-relay-skip.bsky.network');
      });

      it('excludes PDSes with too many failures', async () => {
        const result = await registry.getPDSesForScan(10);

        const urls = result.map((r) => r.pdsUrl);
        expect(urls).not.toContain('https://test-failed.example.com');
      });

      it('respects limit parameter', async () => {
        const result = await registry.getPDSesForScan(1);
        expect(result).toHaveLength(1);
      });
    });

    describe('scan lifecycle', () => {
      it('marks scan as started', async () => {
        await pool.query(`
          INSERT INTO pds_registry (pds_url, discovery_source, status, is_relay_connected)
          VALUES ('https://test-scan-start.example.com', 'user_registration', 'pending', FALSE)
        `);

        await registry.markScanStarted('https://test-scan-start.example.com');

        const result = await pool.query('SELECT status FROM pds_registry WHERE pds_url = $1', [
          'https://test-scan-start.example.com',
        ]);

        expect(result.rows[0].status).toBe('scanning');
      });

      it('marks scan as completed with results', async () => {
        await pool.query(`
          INSERT INTO pds_registry (pds_url, discovery_source, status, is_relay_connected)
          VALUES ('https://test-scan-complete.example.com', 'user_registration', 'scanning', FALSE)
        `);

        await registry.markScanCompleted('https://test-scan-complete.example.com', {
          hasChiveRecords: true,
          chiveRecordCount: 5,
          nextScanHours: 24,
        });

        const result = await pool.query(
          'SELECT status, has_chive_records, chive_record_count, consecutive_failures FROM pds_registry WHERE pds_url = $1',
          ['https://test-scan-complete.example.com']
        );

        expect(result.rows[0].status).toBe('active');
        expect(result.rows[0].has_chive_records).toBe(true);
        expect(result.rows[0].chive_record_count).toBe(5);
        expect(result.rows[0].consecutive_failures).toBe(0);
      });

      it('marks scan as failed and increments failure count', async () => {
        // Start with 4 failures so it becomes unreachable after increment (>= 4 threshold)
        await pool.query(`
          INSERT INTO pds_registry (pds_url, discovery_source, status, is_relay_connected, consecutive_failures)
          VALUES ('https://test-scan-fail.example.com', 'user_registration', 'scanning', FALSE, 4)
        `);

        await registry.markScanFailed('https://test-scan-fail.example.com', 'Connection timeout');

        const result = await pool.query(
          'SELECT status, consecutive_failures, last_error FROM pds_registry WHERE pds_url = $1',
          ['https://test-scan-fail.example.com']
        );

        expect(result.rows[0].status).toBe('unreachable');
        expect(result.rows[0].consecutive_failures).toBe(5);
        expect(result.rows[0].last_error).toBe('Connection timeout');
      });
    });

    describe('getPDS', () => {
      it('retrieves existing PDS entry', async () => {
        await pool.query(`
          INSERT INTO pds_registry (pds_url, discovery_source, status, has_chive_records, chive_record_count, is_relay_connected)
          VALUES ('https://test-get-pds.example.com', 'user_registration', 'active', TRUE, 10, FALSE)
        `);

        const result = await registry.getPDS('https://test-get-pds.example.com');

        expect(result).toBeDefined();
        expect(result?.pdsUrl).toBe('https://test-get-pds.example.com');
        expect(result?.hasChiveRecords).toBe(true);
        expect(result?.chiveRecordCount).toBe(10);
      });

      it('returns null for non-existent PDS', async () => {
        const result = await registry.getPDS('https://nonexistent.example.com');
        expect(result).toBeNull();
      });
    });

    describe('getPDSStats', () => {
      beforeEach(async () => {
        await pool.query(`
          INSERT INTO pds_registry (pds_url, discovery_source, status, has_chive_records, is_relay_connected)
          VALUES
            ('https://test-stats-1.example.com', 'user_registration', 'active', TRUE, FALSE),
            ('https://test-stats-2.example.com', 'user_registration', 'active', TRUE, FALSE),
            ('https://test-stats-3.example.com', 'user_registration', 'pending', FALSE, FALSE),
            ('https://test-stats-4.example.com', 'user_registration', 'unreachable', FALSE, FALSE)
        `);
      });

      it('returns correct statistics', async () => {
        const stats = await registry.getPDSStats();

        expect(stats.total).toBeGreaterThanOrEqual(4);
        expect(stats.active).toBeGreaterThanOrEqual(2);
        expect(stats.withChiveRecords).toBeGreaterThanOrEqual(2);
        expect(stats.unreachable).toBeGreaterThanOrEqual(1);
      });
    });
  });
});
