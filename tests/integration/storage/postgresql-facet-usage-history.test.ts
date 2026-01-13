/**
 * PostgreSQL facet usage history integration tests.
 *
 * @remarks
 * Verifies that FacetUsageHistoryRepository SQL executes correctly:
 * - Date arithmetic uses INTERVAL (not integer subtraction)
 * - Stored functions work correctly
 * - Data consistency for record/retrieve operations
 *
 * This test catches SQL errors that unit tests miss due to mocked pools.
 *
 * @packageDocumentation
 */

import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import { getDatabaseConfig } from '@/storage/postgresql/config.js';
import {
  FacetUsageHistoryRepository,
  type TrendingTimeWindow,
} from '@/storage/postgresql/facet-usage-history-repository.js';

import { createMockLogger } from '../../helpers/mock-services.js';

describe('FacetUsageHistoryRepository', () => {
  let pool: Pool;
  let repository: FacetUsageHistoryRepository;
  const logger = createMockLogger();
  const testFacetUri = `test:facet:${Date.now()}`;

  beforeAll(() => {
    const config = getDatabaseConfig();
    pool = new Pool(config);
    repository = new FacetUsageHistoryRepository(pool, logger);
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query(`DELETE FROM facet_usage_history WHERE facet_uri LIKE 'test:facet:%'`);
    await pool.end();
  });

  beforeEach(async () => {
    // Clean up test facet before each test
    await pool.query(`DELETE FROM facet_usage_history WHERE facet_uri = $1`, [testFacetUri]);
  });

  describe('recordDailySnapshot', () => {
    it('records a snapshot without SQL errors', async () => {
      await expect(repository.recordDailySnapshot(testFacetUri, 42, 15)).resolves.not.toThrow();
    });

    it('upserts on duplicate date', async () => {
      const date = new Date();
      await repository.recordDailySnapshot(testFacetUri, 10, 5, date);
      await repository.recordDailySnapshot(testFacetUri, 20, 10, date);

      const history = await repository.getUsageHistory(testFacetUri, 1);
      expect(history).toHaveLength(1);
      expect(history[0]?.usageCount).toBe(20);
    });
  });

  describe('getUsageHistory', () => {
    it('executes without SQL date arithmetic errors', async () => {
      // This was previously failing with "operator does not exist: date > integer"
      await expect(repository.getUsageHistory(testFacetUri, 7)).resolves.not.toThrow();
    });

    it('returns snapshots within the specified window', async () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      await repository.recordDailySnapshot(testFacetUri, 10, 5, today);
      await repository.recordDailySnapshot(testFacetUri, 8, 4, yesterday);

      const history = await repository.getUsageHistory(testFacetUri, 7);
      expect(history.length).toBeGreaterThanOrEqual(2);
    });

    it('filters out snapshots outside the window', async () => {
      const today = new Date();
      const oldDate = new Date(today);
      oldDate.setDate(oldDate.getDate() - 30);

      await repository.recordDailySnapshot(testFacetUri, 10, 5, today);
      await repository.recordDailySnapshot(testFacetUri, 100, 50, oldDate);

      const history = await repository.getUsageHistory(testFacetUri, 7);
      // Should only get recent snapshot, not the 30-day-old one
      const oldSnapshot = history.find((h) => h.usageCount === 100);
      expect(oldSnapshot).toBeUndefined();
    });
  });

  describe('calculateTrending', () => {
    it('executes stored function without SQL errors', async () => {
      // This tests the calculate_facet_trending function
      await expect(repository.calculateTrending(testFacetUri, 'week')).resolves.not.toThrow();
    });

    it('returns trending calculation structure', async () => {
      const result = await repository.calculateTrending(testFacetUri, 'week');

      expect(result).toHaveProperty('trending');
      expect(result).toHaveProperty('growthRate');
      expect(result).toHaveProperty('recentAverage');
      expect(result).toHaveProperty('priorAverage');
      expect(typeof result.trending).toBe('boolean');
      expect(typeof result.growthRate).toBe('number');
    });

    it('calculates trending for different time windows', async () => {
      const windows: TrendingTimeWindow[] = ['day', 'week', 'month'];

      for (const window of windows) {
        await expect(repository.calculateTrending(testFacetUri, window)).resolves.not.toThrow();
      }
    });

    it('detects trending when growth rate exceeds threshold', async () => {
      const today = new Date();
      const uniqueFacet = `test:facet:trending:${Date.now()}`;

      // Create data with significant growth
      // Prior period: low usage
      for (let i = 14; i >= 8; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        await repository.recordDailySnapshot(uniqueFacet, 1, 1, date);
      }

      // Recent period: high usage (>20% growth)
      for (let i = 7; i >= 1; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        await repository.recordDailySnapshot(uniqueFacet, 10, 5, date);
      }

      const result = await repository.calculateTrending(uniqueFacet, 'week');

      // Growth from avg 1 to avg 10 should be 900% (9.0), well above 20% threshold
      expect(result.growthRate).toBeGreaterThan(0.2);
      expect(result.trending).toBe(true);

      // Clean up
      await pool.query(`DELETE FROM facet_usage_history WHERE facet_uri = $1`, [uniqueFacet]);
    });
  });

  describe('getTopTrending', () => {
    it('executes without SQL date arithmetic errors', async () => {
      // This was previously failing with "operator does not exist: date > integer"
      await expect(repository.getTopTrending('week', 10, 1)).resolves.not.toThrow();
    });

    it('returns array of trending facets', async () => {
      const result = await repository.getTopTrending('week', 10, 1);

      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0]).toHaveProperty('facetUri');
        expect(result[0]).toHaveProperty('trending');
      }
    });
  });

  describe('cleanupOldHistory', () => {
    it('executes without SQL date arithmetic errors', async () => {
      // This was previously failing with "operator does not exist: date > integer"
      await expect(repository.cleanupOldHistory(90)).resolves.not.toThrow();
    });

    it('returns count of deleted rows', async () => {
      const result = await repository.cleanupOldHistory(90);
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it('deletes old data beyond retention period', async () => {
      const uniqueFacet = `test:facet:cleanup:${Date.now()}`;
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);

      await repository.recordDailySnapshot(uniqueFacet, 10, 5, oldDate);

      // Cleanup with 90-day retention
      await repository.cleanupOldHistory(90);

      const history = await repository.getUsageHistory(uniqueFacet, 365);
      expect(history).toHaveLength(0);
    });
  });

  describe('batchRecordSnapshots', () => {
    it('records multiple snapshots in transaction', async () => {
      const uniqueFacet = `test:facet:batch:${Date.now()}`;
      const today = new Date();
      const snapshots = [
        { facetUri: uniqueFacet, date: today, usageCount: 10, uniqueRecords: 5 },
        {
          facetUri: uniqueFacet,
          date: new Date(today.getTime() - 86400000),
          usageCount: 8,
          uniqueRecords: 4,
        },
      ];

      await expect(repository.batchRecordSnapshots(snapshots)).resolves.not.toThrow();

      const history = await repository.getUsageHistory(uniqueFacet, 7);
      expect(history).toHaveLength(2);

      // Clean up
      await pool.query(`DELETE FROM facet_usage_history WHERE facet_uri = $1`, [uniqueFacet]);
    });

    it('rolls back on error', async () => {
      const uniqueFacet = `test:facet:rollback:${Date.now()}`;

      // Create one valid snapshot
      await repository.recordDailySnapshot(uniqueFacet, 10, 5);

      // Try batch with invalid data (this should trigger an error)
      const invalidSnapshots = [
        { facetUri: uniqueFacet, date: new Date(), usageCount: 20, uniqueRecords: 10 },
        {
          facetUri: null as unknown as string,
          date: new Date(),
          usageCount: 30,
          uniqueRecords: 15,
        },
      ];

      await expect(repository.batchRecordSnapshots(invalidSnapshots)).rejects.toThrow();

      // Original snapshot should still be intact due to rollback
      const history = await repository.getUsageHistory(uniqueFacet, 7);
      expect(history[0]?.usageCount).toBe(10);

      // Clean up
      await pool.query(`DELETE FROM facet_usage_history WHERE facet_uri = $1`, [uniqueFacet]);
    });
  });

  describe('batchCalculateTrending', () => {
    it('calculates trending for multiple facets', async () => {
      const facets = [`test:facet:multi1:${Date.now()}`, `test:facet:multi2:${Date.now()}`];

      // Record some data
      for (const facet of facets) {
        await repository.recordDailySnapshot(facet, 10, 5);
      }

      const results = await repository.batchCalculateTrending(facets, 'week');

      expect(results.size).toBe(2);
      for (const facet of facets) {
        expect(results.has(facet)).toBe(true);
      }

      // Clean up
      for (const facet of facets) {
        await pool.query(`DELETE FROM facet_usage_history WHERE facet_uri = $1`, [facet]);
      }
    });
  });
});
