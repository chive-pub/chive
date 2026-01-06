/**
 * Unit tests for batch operations.
 */

import type { Pool, PoolClient } from 'pg';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { BatchOperations } from '@/storage/postgresql/batch-operations.js';
import type { StoredPreprint } from '@/types/interfaces/storage.interface.js';
import { isOk, isErr } from '@/types/result.js';

function createMockPreprint(uri: string): StoredPreprint {
  return {
    uri: uri as never,
    cid: 'bafyreib2rxk3rybk3aobmv5dgudb4vls5sj3bkxfq7c42wgk6b6a7q' as never,
    author: 'did:plc:abc123' as never,
    title: `Preprint ${uri}`,
    abstract: 'Abstract text',
    pdfBlobRef: {
      $type: 'blob',
      ref: 'bafyreib2rxk3rybk3aobmv5dgudb4vls5sj3bkxfq7c42wgk6b6a7q' as never,
      mimeType: 'application/pdf',
      size: 1024,
    },
    license: 'CC-BY-4.0',
    pdsUrl: 'https://pds.example.com',
    indexedAt: new Date('2024-01-01'),
    createdAt: new Date('2024-01-01'),
  };
}

function createMockPool(): Pool {
  const mockClient: PoolClient = {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    release: vi.fn(),
  } as unknown as PoolClient;

  return {
    connect: vi.fn().mockResolvedValue(mockClient),
  } as unknown as Pool;
}

describe('BatchOperations', () => {
  let batch: BatchOperations;
  let mockPool: Pool;

  beforeEach(() => {
    mockPool = createMockPool();
    batch = new BatchOperations(mockPool);
  });

  describe('batchInsertPreprints', () => {
    it('should insert preprints successfully', async () => {
      const preprints = [
        createMockPreprint('at://did:plc:abc/pub.chive.preprint.submission/1'),
        createMockPreprint('at://did:plc:abc/pub.chive.preprint.submission/2'),
        createMockPreprint('at://did:plc:abc/pub.chive.preprint.submission/3'),
      ];

      const result = await batch.batchInsertPreprints(preprints);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.successCount).toBe(3);
        expect(result.value.failureCount).toBe(0);
        expect(result.value.totalCount).toBe(3);
        expect(result.value.failures).toHaveLength(0);
      }
    });

    it('should handle empty array', async () => {
      const result = await batch.batchInsertPreprints([]);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.successCount).toBe(0);
        expect(result.value.failureCount).toBe(0);
        expect(result.value.totalCount).toBe(0);
      }
    });

    it('should chunk large batches', async () => {
      const preprints = Array.from({ length: 2500 }, (_, i) =>
        createMockPreprint(`at://did:plc:abc/pub.chive.preprint.submission/${i}`)
      );

      const result = await batch.batchInsertPreprints(preprints, { batchSize: 1000 });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.totalCount).toBe(2500);
      }
    });

    it('should call progress callback', async () => {
      const preprints = Array.from({ length: 10 }, (_, i) =>
        createMockPreprint(`at://did:plc:abc/pub.chive.preprint.submission/${i}`)
      );

      const progressCalls: { processed: number; total: number }[] = [];
      const onProgress = (processed: number, total: number): void => {
        progressCalls.push({ processed, total });
      };

      await batch.batchInsertPreprints(preprints, { batchSize: 5 }, onProgress);

      expect(progressCalls.length).toBeGreaterThan(0);
      expect(progressCalls[progressCalls.length - 1]?.total).toBe(10);
    });

    it('should continue on error when configured', async () => {
      const mockClient = await mockPool.connect();
      const queryMock = vi
        .fn()
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })
        .mockRejectedValueOnce(new Error('Insert failed'))
        .mockResolvedValueOnce({ rows: [], rowCount: 1 });

      (mockClient.query as ReturnType<typeof vi.fn>).mockImplementation(queryMock);

      const preprints = [
        createMockPreprint('at://did:plc:abc/pub.chive.preprint.submission/1'),
        createMockPreprint('at://did:plc:abc/pub.chive.preprint.submission/2'),
        createMockPreprint('at://did:plc:abc/pub.chive.preprint.submission/3'),
      ];

      const result = await batch.batchInsertPreprints(preprints, {
        continueOnError: true,
        batchSize: 1,
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.successCount).toBeGreaterThanOrEqual(0);
        expect(result.value.failureCount).toBeGreaterThanOrEqual(0);
      }
    });

    it('should stop on error when configured', async () => {
      const mockClient = await mockPool.connect();
      (mockClient.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Insert failed'));

      const preprints = [
        createMockPreprint('at://did:plc:abc/pub.chive.preprint.submission/1'),
        createMockPreprint('at://did:plc:abc/pub.chive.preprint.submission/2'),
      ];

      const result = await batch.batchInsertPreprints(preprints, {
        continueOnError: false,
        batchSize: 10,
      });

      expect(isErr(result)).toBe(true);
    });

    it('should respect custom batch size', async () => {
      const preprints = Array.from({ length: 100 }, (_, i) =>
        createMockPreprint(`at://did:plc:abc/pub.chive.preprint.submission/${i}`)
      );

      await batch.batchInsertPreprints(preprints, { batchSize: 25 });

      const connectCalls = (mockPool.connect as ReturnType<typeof vi.fn>).mock.calls.length;
      expect(connectCalls).toBeGreaterThanOrEqual(4);
    });

    it('should include duration in result', async () => {
      const preprints = [createMockPreprint('at://did:plc:abc/pub.chive.preprint.submission/1')];

      const result = await batch.batchInsertPreprints(preprints);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.durationMs).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('batchUpdatePDSTracking', () => {
    it('should update PDS tracking successfully', async () => {
      const updates = [
        {
          uri: 'at://did:plc:abc/pub.chive.preprint.submission/1',
          pdsUrl: 'https://pds.example.com',
          lastSynced: new Date(),
        },
        {
          uri: 'at://did:plc:abc/pub.chive.preprint.submission/2',
          pdsUrl: 'https://pds.example.com',
          lastSynced: new Date(),
        },
      ];

      const result = await batch.batchUpdatePDSTracking(updates);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.successCount).toBe(2);
        expect(result.value.failureCount).toBe(0);
        expect(result.value.totalCount).toBe(2);
      }
    });

    it('should handle empty update array', async () => {
      const result = await batch.batchUpdatePDSTracking([]);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.successCount).toBe(0);
        expect(result.value.totalCount).toBe(0);
      }
    });

    it('should chunk large updates', async () => {
      const updates = Array.from({ length: 1500 }, (_, i) => ({
        uri: `at://did:plc:abc/pub.chive.preprint.submission/${i}`,
        pdsUrl: 'https://pds.example.com',
        lastSynced: new Date(),
      }));

      const result = await batch.batchUpdatePDSTracking(updates, { batchSize: 500 });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.totalCount).toBe(1500);
      }
    });

    it('should call progress callback for updates', async () => {
      const updates = Array.from({ length: 10 }, (_, i) => ({
        uri: `at://did:plc:abc/pub.chive.preprint.submission/${i}`,
        pdsUrl: 'https://pds.example.com',
        lastSynced: new Date(),
      }));

      const progressCalls: { processed: number; total: number }[] = [];
      const onProgress = (processed: number, total: number): void => {
        progressCalls.push({ processed, total });
      };

      await batch.batchUpdatePDSTracking(updates, { batchSize: 5 }, onProgress);

      expect(progressCalls.length).toBeGreaterThan(0);
    });

    it('should continue on error when configured', async () => {
      const mockClient = await mockPool.connect();
      const queryMock = vi
        .fn()
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })
        .mockRejectedValueOnce(new Error('Update failed'))
        .mockResolvedValueOnce({ rows: [], rowCount: 1 });

      (mockClient.query as ReturnType<typeof vi.fn>).mockImplementation(queryMock);

      const updates = [
        {
          uri: 'at://did:plc:abc/pub.chive.preprint.submission/1',
          pdsUrl: 'https://pds.example.com',
          lastSynced: new Date(),
        },
        {
          uri: 'at://did:plc:abc/pub.chive.preprint.submission/2',
          pdsUrl: 'https://pds.example.com',
          lastSynced: new Date(),
        },
        {
          uri: 'at://did:plc:abc/pub.chive.preprint.submission/3',
          pdsUrl: 'https://pds.example.com',
          lastSynced: new Date(),
        },
      ];

      const result = await batch.batchUpdatePDSTracking(updates, {
        continueOnError: true,
        batchSize: 1,
      });

      expect(isOk(result)).toBe(true);
    });
  });

  describe('default configuration', () => {
    it('should use default batch size', async () => {
      const preprints = Array.from({ length: 2000 }, (_, i) =>
        createMockPreprint(`at://did:plc:abc/pub.chive.preprint.submission/${i}`)
      );

      await batch.batchInsertPreprints(preprints);

      const connectCalls = (mockPool.connect as ReturnType<typeof vi.fn>).mock.calls.length;
      expect(connectCalls).toBeGreaterThanOrEqual(2);
    });

    it('should use custom default configuration', async () => {
      const customBatch = new BatchOperations(mockPool, {
        batchSize: 100,
        continueOnError: false,
      });

      const preprints = Array.from({ length: 250 }, (_, i) =>
        createMockPreprint(`at://did:plc:abc/pub.chive.preprint.submission/${i}`)
      );

      await customBatch.batchInsertPreprints(preprints);

      const connectCalls = (mockPool.connect as ReturnType<typeof vi.fn>).mock.calls.length;
      expect(connectCalls).toBeGreaterThanOrEqual(3);
    });
  });

  describe('error handling', () => {
    it('should include error details in failures', async () => {
      const mockClient = await mockPool.connect();
      const specificError = new Error('Unique constraint violation');
      (mockClient.query as ReturnType<typeof vi.fn>).mockRejectedValue(specificError);

      const preprints = [createMockPreprint('at://did:plc:abc/pub.chive.preprint.submission/1')];

      const result = await batch.batchInsertPreprints(preprints, {
        continueOnError: true,
        batchSize: 1,
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.failures.length).toBeGreaterThan(0);
        const failure = result.value.failures[0];
        expect(failure?.error.message).toContain('Unique constraint');
      }
    });

    it('should include item index in failures', async () => {
      const mockClient = await mockPool.connect();
      (mockClient.query as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const preprints = Array.from({ length: 3 }, (_, i) =>
        createMockPreprint(`at://did:plc:abc/pub.chive.preprint.submission/${i}`)
      );

      const result = await batch.batchInsertPreprints(preprints, {
        continueOnError: true,
        batchSize: 1,
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value.failures.length > 0) {
        const failure = result.value.failures[0];
        expect(failure?.index).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('performance', () => {
    it('should handle single preprint efficiently', async () => {
      const preprints = [createMockPreprint('at://did:plc:abc/pub.chive.preprint.submission/1')];

      const startTime = Date.now();
      await batch.batchInsertPreprints(preprints);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000);
    });

    it('should provide accurate duration measurement', async () => {
      const preprints = Array.from({ length: 10 }, (_, i) =>
        createMockPreprint(`at://did:plc:abc/pub.chive.preprint.submission/${i}`)
      );

      const result = await batch.batchInsertPreprints(preprints);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.durationMs).toBeGreaterThanOrEqual(0);
        expect(result.value.durationMs).toBeLessThan(5000);
      }
    });
  });
});
