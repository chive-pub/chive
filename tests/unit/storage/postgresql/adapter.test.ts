/**
 * Unit tests for PostgreSQL storage adapter.
 */

import type { Pool, QueryResult } from 'pg';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { PostgreSQLAdapter } from '@/storage/postgresql/adapter.js';
import type { StoredPreprint } from '@/types/interfaces/storage.interface.js';
import { isOk, isErr } from '@/types/result.js';

// Mock preprint fixture
function createMockPreprint(): StoredPreprint {
  return {
    uri: 'at://did:plc:abc123/pub.chive.preprint.submission/xyz789' as never,
    cid: 'bafyreib2rxk3rybk3aobmv5dgudb4vls5sj3bkxfq7c42wgk6b6a7q' as never,
    author: 'did:plc:abc123' as never,
    title: 'Neural Networks in Biology',
    abstract: 'This paper explores the application of neural networks to biological systems.',
    pdfBlobRef: {
      $type: 'blob',
      ref: 'bafyreib2rxk3rybk3aobmv5dgudb4vls5sj3bkxfq7c42wgk6b6a7q' as never,
      mimeType: 'application/pdf',
      size: 2048576,
    },
    license: 'CC-BY-4.0',
    pdsUrl: 'https://pds.example.com',
    indexedAt: new Date('2024-01-01T00:00:00Z'),
    createdAt: new Date('2024-01-01T00:00:00Z'),
  };
}

// Mock pool for testing
function createMockPool(): Pool {
  return {
    query: vi.fn(),
  } as unknown as Pool;
}

describe('PostgreSQLAdapter', () => {
  let adapter: PostgreSQLAdapter;
  let mockPool: Pool;

  beforeEach(() => {
    mockPool = createMockPool();
    adapter = new PostgreSQLAdapter(mockPool);
  });

  describe('storePreprint', () => {
    it('should store preprint successfully', async () => {
      const preprint = createMockPreprint();
      const queryMock = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
      (mockPool.query as ReturnType<typeof vi.fn>).mockImplementation(queryMock);

      const result = await adapter.storePreprint(preprint);

      expect(isOk(result)).toBe(true);
      expect(queryMock).toHaveBeenCalledOnce();
      const call = queryMock.mock.calls[0];
      expect(call?.[0]).toContain('INSERT INTO preprints_index');
      expect(call?.[0]).toContain('ON CONFLICT');
    });

    it('should return error on database failure', async () => {
      const preprint = createMockPreprint();
      const queryMock = vi.fn().mockRejectedValue(new Error('Database error'));
      (mockPool.query as ReturnType<typeof vi.fn>).mockImplementation(queryMock);

      const result = await adapter.storePreprint(preprint);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain('Database error');
      }
    });
  });

  describe('getPreprint', () => {
    it('should return preprint when found', async () => {
      const mockRow = {
        uri: 'at://did:plc:abc123/pub.chive.preprint.submission/xyz789',
        cid: 'bafyreib2rxk3rybk3aobmv5dgudb4vls5sj3bkxfq7c42wgk6b6a7q',
        author_did: 'did:plc:abc123',
        title: 'Neural Networks in Biology',
        abstract: 'This paper explores the application of neural networks to biological systems.',
        pdf_blob_cid: 'bafyreib2rxk3rybk3aobmv5dgudb4vls5sj3bkxfq7c42wgk6b6a7q',
        pdf_blob_mime_type: 'application/pdf',
        pdf_blob_size: 2048576,
        pds_url: 'https://pds.example.com',
        indexed_at: new Date('2024-01-01T00:00:00Z'),
        created_at: new Date('2024-01-01T00:00:00Z'),
      };

      const queryMock = vi.fn().mockResolvedValue({ rows: [mockRow] } as QueryResult);
      (mockPool.query as ReturnType<typeof vi.fn>).mockImplementation(queryMock);

      const result = await adapter.getPreprint(
        'at://did:plc:abc123/pub.chive.preprint.submission/xyz789' as never
      );

      expect(result).not.toBeNull();
      expect(result?.uri).toBe('at://did:plc:abc123/pub.chive.preprint.submission/xyz789');
      expect(result?.title).toBe('Neural Networks in Biology');
      expect(result?.pdfBlobRef.$type).toBe('blob');
    });

    it('should return null when preprint not found', async () => {
      const queryMock = vi.fn().mockResolvedValue({ rows: [] } as unknown as QueryResult);
      (mockPool.query as ReturnType<typeof vi.fn>).mockImplementation(queryMock);

      const result = await adapter.getPreprint(
        'at://did:plc:abc123/pub.chive.preprint.submission/notfound' as never
      );

      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      const queryMock = vi.fn().mockRejectedValue(new Error('Database error'));
      (mockPool.query as ReturnType<typeof vi.fn>).mockImplementation(queryMock);

      await expect(
        adapter.getPreprint('at://did:plc:abc123/pub.chive.preprint.submission/xyz789' as never)
      ).rejects.toThrow('Database error');
    });
  });

  describe('getPreprintsByAuthor', () => {
    it('should return preprints by author with default options', async () => {
      const mockRow = {
        uri: 'at://did:plc:abc123/pub.chive.preprint.submission/xyz789',
        cid: 'bafyreib2rxk3rybk3aobmv5dgudb4vls5sj3bkxfq7c42wgk6b6a7q',
        author_did: 'did:plc:abc123',
        title: 'Neural Networks in Biology',
        abstract: 'This paper explores the application of neural networks to biological systems.',
        pdf_blob_cid: 'bafyreib2rxk3rybk3aobmv5dgudb4vls5sj3bkxfq7c42wgk6b6a7q',
        pdf_blob_mime_type: 'application/pdf',
        pdf_blob_size: 2048576,
        pds_url: 'https://pds.example.com',
        indexed_at: new Date('2024-01-01T00:00:00Z'),
        created_at: new Date('2024-01-01T00:00:00Z'),
      };

      const queryMock = vi.fn().mockResolvedValue({ rows: [mockRow] } as QueryResult);
      (mockPool.query as ReturnType<typeof vi.fn>).mockImplementation(queryMock);

      const results = await adapter.getPreprintsByAuthor('did:plc:abc123' as never);

      expect(results).toHaveLength(1);
      expect(results[0]?.author).toBe('did:plc:abc123');

      // Verify query contains ORDER BY and LIMIT
      const call = queryMock.mock.calls[0];
      expect(call?.[0]).toContain('ORDER BY');
      expect(call?.[0]).toContain('LIMIT');
    });

    it('should respect custom query options', async () => {
      const queryMock = vi.fn().mockResolvedValue({ rows: [] } as unknown as QueryResult);
      (mockPool.query as ReturnType<typeof vi.fn>).mockImplementation(queryMock);

      await adapter.getPreprintsByAuthor('did:plc:abc123' as never, {
        limit: 10,
        offset: 5,
        sortBy: 'title',
        sortOrder: 'asc',
      });

      const call = queryMock.mock.calls[0];
      expect(call?.[0]).toContain('ORDER BY title ASC');
      expect(call?.[0]).toContain('LIMIT 10');
      expect(call?.[0]).toContain('OFFSET 5');
    });

    it('should enforce maximum limit of 100', async () => {
      const queryMock = vi.fn().mockResolvedValue({ rows: [] } as unknown as QueryResult);
      (mockPool.query as ReturnType<typeof vi.fn>).mockImplementation(queryMock);

      await adapter.getPreprintsByAuthor('did:plc:abc123' as never, {
        limit: 200,
      });

      const call = queryMock.mock.calls[0];
      expect(call?.[0]).toContain('LIMIT 100');
    });

    it('should throw error on database failure', async () => {
      const queryMock = vi.fn().mockRejectedValue(new Error('Database error'));
      (mockPool.query as ReturnType<typeof vi.fn>).mockImplementation(queryMock);

      await expect(adapter.getPreprintsByAuthor('did:plc:abc123' as never)).rejects.toThrow(
        'Database error'
      );
    });
  });

  describe('trackPDSSource', () => {
    it('should track PDS source successfully', async () => {
      const queryMock = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
      (mockPool.query as ReturnType<typeof vi.fn>).mockImplementation(queryMock);

      const result = await adapter.trackPDSSource(
        'at://did:plc:abc123/pub.chive.preprint.submission/xyz789' as never,
        'https://pds.example.com',
        new Date('2024-01-01T00:00:00Z')
      );

      expect(isOk(result)).toBe(true);
      expect(queryMock).toHaveBeenCalledOnce();
      const call = queryMock.mock.calls[0];
      expect(call?.[0]).toContain('UPDATE preprints_index');
      expect(call?.[0]).toContain('WHERE');
    });

    it('should return error on database failure', async () => {
      const queryMock = vi.fn().mockRejectedValue(new Error('Database error'));
      (mockPool.query as ReturnType<typeof vi.fn>).mockImplementation(queryMock);

      const result = await adapter.trackPDSSource(
        'at://did:plc:abc123/pub.chive.preprint.submission/xyz789' as never,
        'https://pds.example.com',
        new Date('2024-01-01T00:00:00Z')
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain('Database error');
      }
    });
  });

  describe('isStale', () => {
    it('should return false for recently synced record', async () => {
      const recentDate = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago
      const queryMock = vi
        .fn()
        .mockResolvedValue({ rows: [{ indexed_at: recentDate }] } as QueryResult);
      (mockPool.query as ReturnType<typeof vi.fn>).mockImplementation(queryMock);

      const result = await adapter.isStale(
        'at://did:plc:abc123/pub.chive.preprint.submission/xyz789' as never
      );

      expect(result).toBe(false);
    });

    it('should return true for stale record (>1 hour old)', async () => {
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago (>24h for fallback)
      const queryMock = vi.fn().mockResolvedValue({
        rows: [
          {
            cid: 'bafyreib2rxk3rybk3aobmv5dgudb4vls5sj3bkxfq7c42wgk6b6a7q',
            pds_url: 'https://pds.example.com',
            indexed_at: oldDate,
          },
        ],
      } as unknown as QueryResult);
      (mockPool.query as ReturnType<typeof vi.fn>).mockImplementation(queryMock);

      // Mock global fetch to simulate PDS being unreachable (will trigger time-based fallback)
      global.fetch = vi.fn().mockRejectedValue(new Error('PDS unreachable'));

      const result = await adapter.isStale(
        'at://did:plc:abc123/pub.chive.preprint.submission/xyz789' as never
      );

      expect(result).toBe(true);

      // Cleanup
      delete (global as { fetch?: unknown }).fetch;
    });

    it('should return false when record not found', async () => {
      const queryMock = vi.fn().mockResolvedValue({ rows: [] } as unknown as QueryResult);
      (mockPool.query as ReturnType<typeof vi.fn>).mockImplementation(queryMock);

      const result = await adapter.isStale(
        'at://did:plc:abc123/pub.chive.preprint.submission/notfound' as never
      );

      expect(result).toBe(false);
    });

    it('should throw error on database failure', async () => {
      const queryMock = vi.fn().mockRejectedValue(new Error('Database error'));
      (mockPool.query as ReturnType<typeof vi.fn>).mockImplementation(queryMock);

      await expect(
        adapter.isStale('at://did:plc:abc123/pub.chive.preprint.submission/xyz789' as never)
      ).rejects.toThrow('Database error');
    });
  });
});
