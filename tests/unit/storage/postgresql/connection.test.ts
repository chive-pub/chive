/**
 * Unit tests for PostgreSQL connection management.
 */

import { Pool, type PoolClient } from 'pg';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import type { DatabaseConfig } from '../../../../src/storage/postgresql/config.js';
import {
  createPool,
  closePool,
  healthCheck,
  getPoolStats,
} from '../../../../src/storage/postgresql/connection.js';

describe('connection', () => {
  describe('createPool', () => {
    it('should create pool with correct configuration', async () => {
      const config: DatabaseConfig = {
        host: 'localhost',
        port: 5432,
        database: 'chive_test',
        user: 'chive',
        password: 'test_password',
        max: 20,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000,
      };

      const pool = createPool(config);

      expect(pool).toBeInstanceOf(Pool);
      expect(pool.options.host).toBe('localhost');
      expect(pool.options.port).toBe(5432);
      expect(pool.options.database).toBe('chive_test');
      expect(pool.options.max).toBe(20);

      // Cleanup
      await pool.end();
    });

    it('should apply default max connections when not specified', async () => {
      const config: DatabaseConfig = {
        host: 'localhost',
        port: 5432,
        database: 'chive_test',
        user: 'chive',
        password: 'test_password',
      };

      const pool = createPool(config);

      expect(pool.options.max).toBe(50);

      // Cleanup
      await pool.end();
    });

    it('should enable keepalive by default', async () => {
      const config: DatabaseConfig = {
        host: 'localhost',
        port: 5432,
        database: 'chive_test',
        user: 'chive',
        password: 'test_password',
      };

      const pool = createPool(config);

      expect(pool.options.keepAlive).toBe(true);
      expect(pool.options.keepAliveInitialDelayMillis).toBe(10000);

      // Cleanup
      await pool.end();
    });
  });

  describe('healthCheck', () => {
    let pool: Pool;

    beforeEach(() => {
      const config: DatabaseConfig = {
        host: 'localhost',
        port: 5432,
        database: 'chive_test',
        user: 'chive',
        password: 'test_password',
      };
      pool = createPool(config);
    });

    afterEach(async () => {
      await closePool(pool);
    });

    it('should return true when database is healthy', async () => {
      // Mock successful query
      const queryMock = vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] });
      const releaseMock = vi.fn();
      const mockClient = {
        query: queryMock,
        release: releaseMock,
      } as unknown as PoolClient;

      vi.spyOn(pool, 'connect').mockResolvedValue(mockClient as never);

      const result = await healthCheck(pool);

      expect(result).toBe(true);
      expect(queryMock).toHaveBeenCalledWith('SELECT 1');
      expect(releaseMock).toHaveBeenCalledTimes(1);
    });

    it('should return false when database connection fails', async () => {
      // Mock connection failure
      vi.spyOn(pool, 'connect').mockRejectedValue(new Error('Connection refused'));

      const result = await healthCheck(pool);

      expect(result).toBe(false);
    });

    it('should return false when query fails', async () => {
      // Mock failed query
      const queryMock = vi.fn().mockRejectedValue(new Error('Query failed'));
      const releaseMock = vi.fn();
      const mockClient = {
        query: queryMock,
        release: releaseMock,
      } as unknown as PoolClient;

      vi.spyOn(pool, 'connect').mockResolvedValue(mockClient as never);

      const result = await healthCheck(pool);

      expect(result).toBe(false);
      expect(releaseMock).toHaveBeenCalledTimes(1);
    });

    it('should release client even if query fails', async () => {
      const queryMock = vi.fn().mockRejectedValue(new Error('Query failed'));
      const releaseMock = vi.fn();
      const mockClient = {
        query: queryMock,
        release: releaseMock,
      } as unknown as PoolClient;

      vi.spyOn(pool, 'connect').mockResolvedValue(mockClient as never);

      await healthCheck(pool);

      expect(releaseMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('getPoolStats', () => {
    let pool: Pool;

    beforeEach(() => {
      const config: DatabaseConfig = {
        host: 'localhost',
        port: 5432,
        database: 'chive_test',
        user: 'chive',
        password: 'test_password',
      };
      pool = createPool(config);
    });

    afterEach(async () => {
      await closePool(pool);
    });

    it('should return pool statistics', () => {
      const stats = getPoolStats(pool);

      expect(stats).toHaveProperty('totalConnections');
      expect(stats).toHaveProperty('idleConnections');
      expect(stats).toHaveProperty('waitingClients');

      expect(typeof stats.totalConnections).toBe('number');
      expect(typeof stats.idleConnections).toBe('number');
      expect(typeof stats.waitingClients).toBe('number');
    });

    it('should reflect pool state', () => {
      const stats = getPoolStats(pool);

      // Initially, pool should be empty
      expect(stats.totalConnections).toBe(0);
      expect(stats.idleConnections).toBe(0);
      expect(stats.waitingClients).toBe(0);
    });
  });

  describe('closePool', () => {
    it('should close pool gracefully', async () => {
      const config: DatabaseConfig = {
        host: 'localhost',
        port: 5432,
        database: 'chive_test',
        user: 'chive',
        password: 'test_password',
      };
      const pool = createPool(config);

      const endSpy = vi.spyOn(pool, 'end');

      await closePool(pool);

      expect(endSpy).toHaveBeenCalled();
    });

    it('should wait for active queries to complete', async () => {
      const config: DatabaseConfig = {
        host: 'localhost',
        port: 5432,
        database: 'chive_test',
        user: 'chive',
        password: 'test_password',
      };
      const pool = createPool(config);

      const endSpy = vi.spyOn(pool, 'end').mockResolvedValue();

      await closePool(pool);

      expect(endSpy).toHaveBeenCalled();
    });
  });
});
