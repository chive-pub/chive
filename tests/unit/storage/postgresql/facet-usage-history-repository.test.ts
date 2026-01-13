/**
 * Unit tests for FacetUsageHistoryRepository.
 *
 * @remarks
 * Tests facet usage history recording and trending calculations.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

import {
  FacetUsageHistoryRepository,
  type TrendingTimeWindow,
} from '@/storage/postgresql/facet-usage-history-repository.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

/**
 * Mock Pool interface.
 */
interface MockPool {
  query: Mock;
  connect: Mock;
}

/**
 * Mock Client interface.
 */
interface MockClient {
  query: Mock;
  release: Mock;
}

describe('FacetUsageHistoryRepository', () => {
  let mockPool: MockPool;
  let mockClient: MockClient;
  let mockLogger: ILogger;
  let repository: FacetUsageHistoryRepository;

  beforeEach(() => {
    mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      release: vi.fn(),
    };

    mockPool = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      connect: vi.fn().mockResolvedValue(mockClient),
    };

    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn().mockReturnThis(),
    } as unknown as ILogger;

    repository = new FacetUsageHistoryRepository(
      mockPool as unknown as import('pg').Pool,
      mockLogger
    );
  });

  describe('recordDailySnapshot', () => {
    it('calls upsert function with correct parameters', async () => {
      const facetUri = 'tag:machine-learning';
      const usageCount = 42;
      const uniqueRecords = 15;
      const date = new Date('2024-01-15');

      await repository.recordDailySnapshot(facetUri, usageCount, uniqueRecords, date);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('upsert_facet_usage_snapshot'),
        [facetUri, date, usageCount, uniqueRecords]
      );
    });

    it('uses today as default date', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await repository.recordDailySnapshot('tag:test', 10, 5);

      const [, params] = mockPool.query.mock.calls[0] as [string, unknown[]];
      const dateParam = params[1] as Date;
      // Date should be today (within same day)
      expect(dateParam.toDateString()).toBe(new Date().toDateString());
    });

    it('logs success', async () => {
      await repository.recordDailySnapshot('tag:test', 10, 5);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Recorded facet usage snapshot',
        expect.objectContaining({
          facetUri: 'tag:test',
          usageCount: 10,
          uniqueRecords: 5,
        })
      );
    });
  });

  describe('batchRecordSnapshots', () => {
    it('records multiple snapshots in transaction', async () => {
      const snapshots = [
        { facetUri: 'tag:ml', date: new Date(), usageCount: 10, uniqueRecords: 5 },
        { facetUri: 'tag:ai', date: new Date(), usageCount: 20, uniqueRecords: 8 },
      ];

      await repository.batchRecordSnapshots(snapshots);

      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('rolls back on error', async () => {
      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('upsert')) {
          throw new Error('Database error');
        }
        return { rows: [] };
      });

      const snapshots = [
        { facetUri: 'tag:ml', date: new Date(), usageCount: 10, uniqueRecords: 5 },
      ];

      await expect(repository.batchRecordSnapshots(snapshots)).rejects.toThrow();
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('does nothing for empty array', async () => {
      await repository.batchRecordSnapshots([]);

      expect(mockPool.connect).not.toHaveBeenCalled();
    });

    it('skips transaction when useTransaction is false', async () => {
      const snapshots = [
        { facetUri: 'tag:ml', date: new Date(), usageCount: 10, uniqueRecords: 5 },
      ];

      await repository.batchRecordSnapshots(snapshots, { useTransaction: false });

      expect(mockClient.query).not.toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).not.toHaveBeenCalledWith('COMMIT');
    });
  });

  describe('getUsageHistory', () => {
    it('returns mapped snapshots', async () => {
      const mockRows = [
        { facet_uri: 'tag:ml', date: new Date('2024-01-15'), usage_count: 42, unique_records: 15 },
        { facet_uri: 'tag:ml', date: new Date('2024-01-14'), usage_count: 38, unique_records: 12 },
      ];
      mockPool.query.mockResolvedValueOnce({ rows: mockRows });

      const result = await repository.getUsageHistory('tag:ml', 7);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        facetUri: 'tag:ml',
        date: mockRows[0]?.date,
        usageCount: 42,
        uniqueRecords: 15,
      });
    });

    it('queries with correct date range', async () => {
      await repository.getUsageHistory('tag:ml', 14);

      // Should use INTERVAL arithmetic for PostgreSQL date subtraction
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("CURRENT_DATE - ($2 * INTERVAL '1 day')"),
        ['tag:ml', 14]
      );
    });
  });

  describe('calculateTrending', () => {
    it('returns trending calculation from database function', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            trending: true,
            growth_rate: '0.35',
            recent_avg: '15.5',
            prior_avg: '11.5',
          },
        ],
      });

      const result = await repository.calculateTrending('tag:ml', 'week');

      expect(result).toEqual({
        trending: true,
        growthRate: 0.35,
        recentAverage: 15.5,
        priorAverage: 11.5,
      });
    });

    it('uses correct window days for different time windows', async () => {
      const testCases: { window: TrendingTimeWindow; days: number }[] = [
        { window: 'day', days: 1 },
        { window: 'week', days: 7 },
        { window: 'month', days: 30 },
      ];

      for (const { window, days } of testCases) {
        mockPool.query.mockResolvedValueOnce({
          rows: [{ trending: false, growth_rate: '0', recent_avg: '0', prior_avg: '0' }],
        });

        await repository.calculateTrending('tag:ml', window);

        expect(mockPool.query).toHaveBeenLastCalledWith(expect.any(String), ['tag:ml', days]);
      }
    });

    it('returns default values when no data', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await repository.calculateTrending('tag:new');

      expect(result).toEqual({
        trending: false,
        growthRate: 0,
        recentAverage: 0,
        priorAverage: 0,
      });
    });
  });

  describe('getTopTrending', () => {
    it('returns sorted trending facets', async () => {
      // First query: get facets with recent activity
      mockPool.query.mockResolvedValueOnce({
        rows: [{ facet_uri: 'tag:ml' }, { facet_uri: 'tag:ai' }],
      });

      // Subsequent queries: calculate trending for each
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ trending: true, growth_rate: '0.5', recent_avg: '10', prior_avg: '6.67' }],
        })
        .mockResolvedValueOnce({
          rows: [{ trending: true, growth_rate: '0.3', recent_avg: '8', prior_avg: '6.15' }],
        });

      const result = await repository.getTopTrending('week', 10, 5);

      expect(result).toHaveLength(2);
      // Should be sorted by growth rate descending
      expect(result[0]?.facetUri).toBe('tag:ml');
      expect(result[0]?.trending.growthRate).toBe(0.5);
    });

    it('filters out non-trending facets', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ facet_uri: 'tag:ml' }, { facet_uri: 'tag:old' }],
      });

      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ trending: true, growth_rate: '0.3', recent_avg: '10', prior_avg: '7.7' }],
        })
        .mockResolvedValueOnce({
          rows: [{ trending: false, growth_rate: '-0.1', recent_avg: '5', prior_avg: '5.55' }],
        });

      const result = await repository.getTopTrending('week', 10, 5);

      expect(result).toHaveLength(1);
      expect(result[0]?.facetUri).toBe('tag:ml');
    });
  });

  describe('cleanupOldHistory', () => {
    it('deletes old records', async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 150 });

      const deleted = await repository.cleanupOldHistory(90);

      expect(deleted).toBe(150);
      expect(mockPool.query).toHaveBeenCalledWith(expect.stringContaining('DELETE'), [90]);
    });

    it('logs cleanup result', async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 50 });

      await repository.cleanupOldHistory(30);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Cleaned up old facet usage history',
        expect.objectContaining({ retentionDays: 30, deletedCount: 50 })
      );
    });
  });
});
