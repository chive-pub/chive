/**
 * Unit tests for CommitHandler.
 *
 * @remarks
 * Tests commit parsing, CAR decoding, and operation extraction.
 */

import { describe, it, expect } from 'vitest';

import { CommitHandler, ParseError } from '@/services/indexing/commit-handler.js';
import type { CID, DID } from '@/types/atproto.js';

describe('CommitHandler', () => {
  const handler = new CommitHandler();

  describe('parsePath', () => {
    it('extracts collection and rkey from valid path', () => {
      const result = handler.parsePath('pub.chive.eprint.submission/abc123');

      expect(result.collection).toBe('pub.chive.eprint.submission');
      expect(result.rkey).toBe('abc123');
    });

    it('handles various rkey formats', () => {
      const result1 = handler.parsePath('pub.chive.eprint.submission/3kj5h2k3j5h');
      expect(result1.rkey).toBe('3kj5h2k3j5h');

      const result2 = handler.parsePath('pub.chive.review.comment/abc-def-123');
      expect(result2.rkey).toBe('abc-def-123');
    });

    it('throws on empty path', () => {
      expect(() => handler.parsePath('')).toThrow('Invalid operation path format');
    });

    it('throws on path without slash', () => {
      expect(() => handler.parsePath('pub.chive.eprint.submission')).toThrow(
        'Invalid operation path format'
      );
    });

    it('throws on path with only slash', () => {
      expect(() => handler.parsePath('/')).toThrow('Invalid operation path format');
    });

    it('throws on path with empty collection', () => {
      expect(() => handler.parsePath('/abc123')).toThrow('Invalid operation path format');
    });

    it('throws on path with empty rkey', () => {
      expect(() => handler.parsePath('pub.chive.eprint.submission/')).toThrow(
        'Invalid operation path format'
      );
    });

    it('rejects paths with multiple slashes', () => {
      // ATProto paths must be exactly "collection/rkey" format
      expect(() => handler.parsePath('pub.chive.eprint.submission/abc/def')).toThrow(
        'Invalid operation path format'
      );
    });
  });

  describe('validateOperation', () => {
    it('validates delete operations correctly', () => {
      const validDelete = {
        action: 'delete' as const,
        path: 'pub.chive.eprint.submission/abc123',
      };

      expect(handler.validateOperation(validDelete)).toBe(true);
    });

    it('rejects delete operations with cid', () => {
      const invalidDelete = {
        action: 'delete' as const,
        path: 'pub.chive.eprint.submission/abc123',
        cid: 'bafyreiabc123' as CID,
      };

      expect(handler.validateOperation(invalidDelete)).toBe(false);
    });

    it('rejects delete operations with record', () => {
      const invalidDelete = {
        action: 'delete' as const,
        path: 'pub.chive.eprint.submission/abc123',
        record: { title: 'Test' },
      };

      expect(handler.validateOperation(invalidDelete)).toBe(false);
    });

    it('validates create operations correctly', () => {
      const validCreate = {
        action: 'create' as const,
        path: 'pub.chive.eprint.submission/abc123',
        cid: 'bafyreiabc123' as CID,
        record: { title: 'Test Eprint' },
      };

      expect(handler.validateOperation(validCreate)).toBe(true);
    });

    it('rejects create operations without cid', () => {
      const invalidCreate = {
        action: 'create' as const,
        path: 'pub.chive.eprint.submission/abc123',
        record: { title: 'Test' },
      };

      expect(handler.validateOperation(invalidCreate)).toBe(false);
    });

    it('rejects create operations without record', () => {
      const invalidCreate = {
        action: 'create' as const,
        path: 'pub.chive.eprint.submission/abc123',
        cid: 'bafyreiabc123' as CID,
      };

      expect(handler.validateOperation(invalidCreate)).toBe(false);
    });

    it('validates update operations correctly', () => {
      const validUpdate = {
        action: 'update' as const,
        path: 'pub.chive.eprint.submission/abc123',
        cid: 'bafyreiabc123' as CID,
        record: { title: 'Updated Title' },
      };

      expect(handler.validateOperation(validUpdate)).toBe(true);
    });

    it('rejects operations without path', () => {
      const invalid = {
        action: 'create' as const,
        path: '',
        cid: 'bafyreiabc123' as CID,
        record: { title: 'Test' },
      };

      expect(handler.validateOperation(invalid)).toBe(false);
    });
  });

  describe('parseCommit', () => {
    it('handles tooBig events', async () => {
      const event = {
        $type: 'com.atproto.sync.subscribeRepos#commit' as const,
        repo: 'did:plc:abc123' as DID,
        commit: 'bafyreiabc123' as CID,
        ops: [],
        seq: 1,
        time: '2024-01-01T00:00:00Z',
        tooBig: true,
      };

      await expect(handler.parseCommit(event)).rejects.toThrow(ParseError);
      await expect(handler.parseCommit(event)).rejects.toThrow('Event blocks too large');
    });

    it('handles events with no blocks', async () => {
      const event = {
        $type: 'com.atproto.sync.subscribeRepos#commit' as const,
        repo: 'did:plc:abc123' as DID,
        commit: 'bafyreiabc123' as CID,
        ops: [
          {
            action: 'create' as const,
            path: 'pub.chive.eprint.submission/xyz',
            cid: 'bafyreidef456' as CID,
          },
        ],
        seq: 1,
        time: '2024-01-01T00:00:00Z',
      };

      const result = await handler.parseCommit(event);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        action: 'create',
        path: 'pub.chive.eprint.submission/xyz',
        cid: 'bafyreidef456',
      });
    });

    it('handles empty blocks array', async () => {
      const event = {
        $type: 'com.atproto.sync.subscribeRepos#commit' as const,
        repo: 'did:plc:abc123' as DID,
        commit: 'bafyreiabc123' as CID,
        ops: [],
        blocks: new Uint8Array(0),
        seq: 1,
        time: '2024-01-01T00:00:00Z',
      };

      const result = await handler.parseCommit(event);

      expect(result).toHaveLength(0);
    });

    it('processes delete operations without blocks', async () => {
      const event = {
        $type: 'com.atproto.sync.subscribeRepos#commit' as const,
        repo: 'did:plc:abc123' as DID,
        commit: 'bafyreiabc123' as CID,
        ops: [
          {
            action: 'delete' as const,
            path: 'pub.chive.eprint.submission/xyz',
          },
        ],
        seq: 1,
        time: '2024-01-01T00:00:00Z',
      };

      const result = await handler.parseCommit(event);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        action: 'delete',
        path: 'pub.chive.eprint.submission/xyz',
      });
    });

    it('returns ops with CID when no blocks provided', async () => {
      // When blocks are missing, ops are returned as-is with their CIDs
      // (no record data can be decoded without blocks)
      const event = {
        $type: 'com.atproto.sync.subscribeRepos#commit' as const,
        repo: 'did:plc:abc123' as DID,
        commit: 'bafyreiabc123' as CID,
        ops: [
          {
            action: 'create' as const,
            path: 'pub.chive.eprint.submission/xyz',
            cid: 'bafyreixyz123' as CID,
          },
        ],
        seq: 1,
        time: '2024-01-01T00:00:00Z',
      };

      const result = await handler.parseCommit(event);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        action: 'create',
        path: 'pub.chive.eprint.submission/xyz',
        cid: 'bafyreixyz123',
      });
    });

    // Note: Testing actual CAR parsing requires creating valid CAR files,
    // which is complex. These tests cover the error paths and edge cases.
    // Integration tests should cover full CAR parsing with real data.
  });

  describe('ParseError', () => {
    it('creates error with message', () => {
      const error = new ParseError('Test error');

      expect(error.message).toBe('Test error');
      expect(error.name).toBe('ParseError');
      expect(error.cid).toBeUndefined();
      expect(error.cause).toBeUndefined();
    });

    it('creates error with CID', () => {
      const error = new ParseError('Test error', 'bafyreiabc123');

      expect(error.message).toBe('Test error');
      expect(error.cid).toBe('bafyreiabc123');
      expect(error.cause).toBeUndefined();
    });

    it('creates error with cause', () => {
      const cause = new Error('Root cause');
      const error = new ParseError('Test error', 'bafyreiabc123', cause);

      expect(error.message).toBe('Test error');
      expect(error.cid).toBe('bafyreiabc123');
      expect(error.cause).toBe(cause);
    });

    it('is instanceof Error', () => {
      const error = new ParseError('Test error');

      expect(error instanceof Error).toBe(true);
      expect(error instanceof ParseError).toBe(true);
    });
  });
});
