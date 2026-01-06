/**
 * Unit tests for transaction management.
 */

import type { Pool, PoolClient } from 'pg';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  withTransaction,
  withSavepoint,
  DeadlockError,
} from '../../../../src/storage/postgresql/transaction.js';
import { isOk, isErr } from '../../../../src/types/result.js';

interface MockPoolClient extends PoolClient {
  queryMock: ReturnType<typeof vi.fn>;
  releaseMock: ReturnType<typeof vi.fn>;
}

// Mock PoolClient for testing
function createMockClient(): MockPoolClient {
  const queryMock = vi.fn();
  const releaseMock = vi.fn();
  return {
    query: queryMock,
    release: releaseMock,
    queryMock,
    releaseMock,
    // Add other required PoolClient properties as mocks
  } as unknown as MockPoolClient;
}

// Mock Pool for testing
function createMockPool(client: PoolClient): Pool {
  return {
    connect: vi.fn().mockResolvedValue(client),
  } as unknown as Pool;
}

describe('transaction', () => {
  describe('withTransaction', () => {
    let mockClient: MockPoolClient;
    let mockPool: Pool;

    beforeEach(() => {
      mockClient = createMockClient();
      mockPool = createMockPool(mockClient);
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should begin transaction, execute function, and commit', async () => {
      const fn = vi.fn<(client: PoolClient) => Promise<string>>().mockResolvedValue('success');

      const result = await withTransaction(mockPool, fn);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe('success');
      }

      expect(mockClient.queryMock).toHaveBeenCalledWith('BEGIN ISOLATION LEVEL READ COMMITTED');
      expect(fn).toHaveBeenCalledWith(mockClient);
      expect(mockClient.queryMock).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.releaseMock).toHaveBeenCalled();
    });

    it('should rollback on error', async () => {
      const error = new Error('Transaction failed');
      const fn = vi.fn<(client: PoolClient) => Promise<string>>().mockRejectedValue(error);

      const result = await withTransaction(mockPool, fn);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toBe('Transaction failed');
      }

      expect(mockClient.queryMock).toHaveBeenCalledWith('BEGIN ISOLATION LEVEL READ COMMITTED');
      expect(fn).toHaveBeenCalledWith(mockClient);
      expect(mockClient.queryMock).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.releaseMock).toHaveBeenCalled();
    });

    it('should support custom isolation level', async () => {
      const fn = vi.fn<(client: PoolClient) => Promise<string>>().mockResolvedValue('success');

      await withTransaction(mockPool, fn, { isolationLevel: 'SERIALIZABLE' });

      expect(mockClient.queryMock).toHaveBeenCalledWith('BEGIN ISOLATION LEVEL SERIALIZABLE');
    });

    it('should retry on deadlock', async () => {
      const deadlockError = Object.assign(new Error('Deadlock detected'), { code: '40P01' });
      let attempts = 0;

      const fn = vi
        .fn<(client: PoolClient) => Promise<string>>()
        .mockImplementation((): Promise<string> => {
          attempts++;
          if (attempts === 1) {
            return Promise.reject(deadlockError);
          }
          return Promise.resolve('success');
        });

      // Need to return new client for each attempt
      const mockClient2 = createMockClient();
      vi.spyOn(mockPool, 'connect')
        .mockResolvedValueOnce(mockClient as never)
        .mockResolvedValueOnce(mockClient2 as never);

      const result = await withTransaction(mockPool, fn, {
        maxRetries: 3,
        retryDelay: 10,
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe('success');
      }
      expect(attempts).toBe(2);
    });

    it('should return DeadlockError after max retries', async () => {
      const deadlockError = Object.assign(new Error('Deadlock detected'), { code: '40P01' });
      const fn = vi.fn<(client: PoolClient) => Promise<string>>().mockRejectedValue(deadlockError);

      // Create multiple mock clients for retries
      const clients = [createMockClient(), createMockClient(), createMockClient()];
      const connectSpy = vi.spyOn(mockPool, 'connect');
      clients.forEach((client) => connectSpy.mockResolvedValueOnce(client as never));

      const result = await withTransaction(mockPool, fn, {
        maxRetries: 3,
        retryDelay: 10,
      });

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toBeInstanceOf(DeadlockError);
        expect(result.error.message).toContain('Deadlock after 3 retries');
      }
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should release client even if commit fails', async () => {
      const fn = vi.fn<(client: PoolClient) => Promise<string>>().mockResolvedValue('success');
      const queryMock = vi
        .fn()
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(new Error('Commit failed')); // COMMIT

      mockClient.queryMock.mockImplementation(queryMock);

      const result = await withTransaction(mockPool, fn);

      expect(isErr(result)).toBe(true);
      expect(mockClient.releaseMock).toHaveBeenCalled();
    });

    it('should release client even if rollback fails', async () => {
      const fn = vi
        .fn<(client: PoolClient) => Promise<string>>()
        .mockRejectedValue(new Error('Function failed'));
      const queryMock = vi
        .fn()
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(new Error('Rollback failed')); // ROLLBACK

      mockClient.queryMock.mockImplementation(queryMock);

      const result = await withTransaction(mockPool, fn);

      expect(isErr(result)).toBe(true);
      expect(mockClient.releaseMock).toHaveBeenCalled();
    });
  });

  describe('withSavepoint', () => {
    let mockClient: MockPoolClient;

    beforeEach(() => {
      mockClient = createMockClient();
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should create savepoint, execute function, and release', async () => {
      const fn = vi.fn<() => Promise<string>>().mockResolvedValue('success');

      const result = await withSavepoint(mockClient, 'test_savepoint', fn);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe('success');
      }

      expect(mockClient.queryMock).toHaveBeenCalledWith('SAVEPOINT test_savepoint');
      expect(fn).toHaveBeenCalled();
      expect(mockClient.queryMock).toHaveBeenCalledWith('RELEASE SAVEPOINT test_savepoint');
    });

    it('should rollback to savepoint on error', async () => {
      const error = new Error('Savepoint failed');
      const fn = vi.fn<() => Promise<string>>().mockRejectedValue(error);

      const result = await withSavepoint(mockClient, 'test_savepoint', fn);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toBe('Savepoint failed');
      }

      expect(mockClient.queryMock).toHaveBeenCalledWith('SAVEPOINT test_savepoint');
      expect(fn).toHaveBeenCalled();
      expect(mockClient.queryMock).toHaveBeenCalledWith('ROLLBACK TO SAVEPOINT test_savepoint');
    });

    it('should handle savepoint creation failure', async () => {
      const queryMock = vi.fn().mockRejectedValue(new Error('Cannot create savepoint'));
      mockClient.queryMock.mockImplementation(queryMock);

      const fn = vi.fn<() => Promise<string>>();

      const result = await withSavepoint(mockClient, 'test_savepoint', fn);

      expect(isErr(result)).toBe(true);
      expect(fn).not.toHaveBeenCalled();
    });

    it('should handle rollback failure gracefully', async () => {
      const fn = vi.fn<() => Promise<string>>().mockRejectedValue(new Error('Function failed'));
      const queryMock = vi
        .fn()
        .mockResolvedValueOnce({}) // SAVEPOINT
        .mockRejectedValueOnce(new Error('Rollback failed')); // ROLLBACK TO SAVEPOINT

      mockClient.queryMock.mockImplementation(queryMock);

      const result = await withSavepoint(mockClient, 'test_savepoint', fn);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toBe('Function failed');
      }
    });
  });
});
