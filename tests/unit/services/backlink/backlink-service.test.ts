/**
 * Unit tests for BacklinkService.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { BacklinkService } from '../../../../src/services/backlink/backlink-service.js';
import type { ILogger } from '../../../../src/types/interfaces/logger.interface.js';
import type { BacklinkSourceType } from '../../../../src/types/interfaces/plugin.interface.js';

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

const createMockDatabasePool = (): MockDatabasePool => ({
  query: vi.fn().mockResolvedValue({ rows: [] }),
});

// ============================================================================
// Sample Data (based on real linguistics research)
// ============================================================================

/**
 * Sample AT-URIs for testing.
 *
 * Uses verified formats based on ATProto specification.
 */
const SAMPLE_SOURCE_URI = 'at://did:plc:test123/xyz.semble.collection/reading-list-1';
const SAMPLE_TARGET_URI = 'at://did:plc:aswhite/pub.chive.preprint.submission/megaattitude';
const SAMPLE_DID = 'did:plc:test123';

const SAMPLE_BACKLINK_ROW = {
  id: 1,
  source_uri: SAMPLE_SOURCE_URI,
  source_type: 'semble.collection',
  source_did: SAMPLE_DID,
  target_uri: SAMPLE_TARGET_URI,
  context: 'Computational Semantics Reading List',
  indexed_at: new Date('2024-01-15T10:00:00Z'),
  is_deleted: false,
  deleted_at: null,
};

const SAMPLE_COUNTS_ROW = {
  semble_count: 5,
  leaflet_count: 3,
  whitewind_count: 2,
  bluesky_post_count: 6,
  bluesky_embed_count: 4,
  comment_count: 0,
  endorsement_count: 0,
  other_count: 0,
  total_count: 20,
  last_updated_at: new Date('2024-01-15T12:00:00Z'),
};

// ============================================================================
// Tests
// ============================================================================

describe('BacklinkService', () => {
  let service: BacklinkService;
  let logger: ILogger;
  let db: MockDatabasePool;

  beforeEach(() => {
    logger = createMockLogger();
    db = createMockDatabasePool();
    service = new BacklinkService(logger, db as unknown as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createBacklink', () => {
    it('should create a new backlink', async () => {
      db.query.mockResolvedValueOnce({ rows: [SAMPLE_BACKLINK_ROW] });

      const result = await service.createBacklink({
        sourceUri: SAMPLE_SOURCE_URI,
        sourceType: 'semble.collection' as BacklinkSourceType,
        targetUri: SAMPLE_TARGET_URI,
        context: 'Computational Semantics Reading List',
      });

      expect(result).toMatchObject({
        id: 1,
        sourceUri: SAMPLE_SOURCE_URI,
        sourceType: 'semble.collection',
        targetUri: SAMPLE_TARGET_URI,
        context: 'Computational Semantics Reading List',
        deleted: false,
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO backlinks'),
        expect.arrayContaining([
          SAMPLE_SOURCE_URI,
          'semble.collection',
          SAMPLE_DID,
          SAMPLE_TARGET_URI,
          'Computational Semantics Reading List',
        ])
      );
    });

    it('should extract DID from source URI', async () => {
      db.query.mockResolvedValueOnce({ rows: [SAMPLE_BACKLINK_ROW] });

      await service.createBacklink({
        sourceUri: 'at://did:plc:jgrove456/xyz.semble.collection/list1',
        sourceType: 'semble.collection' as BacklinkSourceType,
        targetUri: SAMPLE_TARGET_URI,
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['did:plc:jgrove456'])
      );
    });

    it('should throw ValidationError for invalid AT-URI', async () => {
      await expect(
        service.createBacklink({
          sourceUri: 'https://example.com/invalid',
          sourceType: 'semble.collection' as BacklinkSourceType,
          targetUri: SAMPLE_TARGET_URI,
        })
      ).rejects.toThrow('Invalid AT-URI format');
    });

    it('should throw DatabaseError if no row returned', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.createBacklink({
          sourceUri: SAMPLE_SOURCE_URI,
          sourceType: 'semble.collection' as BacklinkSourceType,
          targetUri: SAMPLE_TARGET_URI,
        })
      ).rejects.toThrow('Failed to create backlink');
    });

    it('should update counts asynchronously', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [SAMPLE_BACKLINK_ROW] })
        .mockResolvedValueOnce({ rows: [] }); // For updateCounts

      await service.createBacklink({
        sourceUri: SAMPLE_SOURCE_URI,
        sourceType: 'semble.collection' as BacklinkSourceType,
        targetUri: SAMPLE_TARGET_URI,
      });

      // Wait for async count update
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Second call should be the refresh
      expect(db.query).toHaveBeenCalledTimes(2);
    });

    it('should log debug message on success', async () => {
      db.query.mockResolvedValueOnce({ rows: [SAMPLE_BACKLINK_ROW] });

      await service.createBacklink({
        sourceUri: SAMPLE_SOURCE_URI,
        sourceType: 'semble.collection' as BacklinkSourceType,
        targetUri: SAMPLE_TARGET_URI,
      });

      expect(logger.debug).toHaveBeenCalledWith('Backlink created', expect.any(Object));
    });
  });

  describe('deleteBacklink', () => {
    it('should soft delete a backlink', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ target_uri: SAMPLE_TARGET_URI }],
      });

      await service.deleteBacklink(SAMPLE_SOURCE_URI);

      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE backlinks'), [
        SAMPLE_SOURCE_URI,
      ]);
    });

    it('should update counts for affected targets', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ target_uri: SAMPLE_TARGET_URI }] })
        .mockResolvedValueOnce({ rows: [] }); // For updateCounts

      await service.deleteBacklink(SAMPLE_SOURCE_URI);

      // Wait for async count update
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(db.query).toHaveBeenCalledTimes(2);
    });

    it('should handle non-existent backlink gracefully', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      // Should not throw
      await service.deleteBacklink('at://did:plc:nonexistent/collection/rkey');

      expect(logger.debug).not.toHaveBeenCalledWith('Backlink deleted', expect.any(Object));
    });

    it('should log debug message on success', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ target_uri: SAMPLE_TARGET_URI }],
      });

      await service.deleteBacklink(SAMPLE_SOURCE_URI);

      expect(logger.debug).toHaveBeenCalledWith('Backlink deleted', {
        sourceUri: SAMPLE_SOURCE_URI,
      });
    });
  });

  describe('getBacklinks', () => {
    it('should return backlinks for target URI', async () => {
      db.query.mockResolvedValueOnce({ rows: [SAMPLE_BACKLINK_ROW] });

      const result = await service.getBacklinks(SAMPLE_TARGET_URI);

      expect(result.backlinks).toHaveLength(1);
      expect(result.backlinks[0]).toMatchObject({
        sourceUri: SAMPLE_SOURCE_URI,
        targetUri: SAMPLE_TARGET_URI,
      });
    });

    it('should filter by source type', async () => {
      db.query.mockResolvedValueOnce({ rows: [SAMPLE_BACKLINK_ROW] });

      await service.getBacklinks(SAMPLE_TARGET_URI, {
        sourceType: 'semble.collection' as BacklinkSourceType,
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('source_type = $2'),
        expect.arrayContaining([SAMPLE_TARGET_URI, 'semble.collection'])
      );
    });

    it('should handle pagination with cursor', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ ...SAMPLE_BACKLINK_ROW, id: 5 }],
      });

      await service.getBacklinks(SAMPLE_TARGET_URI, { cursor: '4' });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('id > $'),
        expect.arrayContaining([4])
      );
    });

    it('should limit results and return cursor for pagination', async () => {
      const rows = Array.from({ length: 3 }, (_, i) => ({
        ...SAMPLE_BACKLINK_ROW,
        id: i + 1,
      }));
      db.query.mockResolvedValueOnce({ rows });

      const result = await service.getBacklinks(SAMPLE_TARGET_URI, { limit: 2 });

      expect(result.backlinks).toHaveLength(2);
      expect(result.cursor).toBe('2');
    });

    it('should return empty array for no matches', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getBacklinks(SAMPLE_TARGET_URI);

      expect(result.backlinks).toEqual([]);
      expect(result.cursor).toBeUndefined();
    });
  });

  describe('getCounts', () => {
    it('should return aggregated counts', async () => {
      db.query.mockResolvedValueOnce({ rows: [SAMPLE_COUNTS_ROW] });

      const result = await service.getCounts(SAMPLE_TARGET_URI);

      expect(result).toMatchObject({
        sembleCollections: 5,
        leafletLists: 3,
        whitewindBlogs: 2,
        blueskyPosts: 6,
        blueskyEmbeds: 4,
        other: 0,
        total: 20,
      });
    });

    it('should return zeros for non-existent target', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getCounts(SAMPLE_TARGET_URI);

      expect(result).toMatchObject({
        sembleCollections: 0,
        leafletLists: 0,
        whitewindBlogs: 0,
        blueskyPosts: 0,
        blueskyEmbeds: 0,
        other: 0,
        total: 0,
      });
    });
  });

  describe('updateCounts', () => {
    it('should call refresh function', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await service.updateCounts(SAMPLE_TARGET_URI);

      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('refresh_backlink_counts'), [
        SAMPLE_TARGET_URI,
      ]);
    });

    it('should log debug message', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await service.updateCounts(SAMPLE_TARGET_URI);

      expect(logger.debug).toHaveBeenCalledWith('Backlink counts refreshed', {
        targetUri: SAMPLE_TARGET_URI,
      });
    });
  });

  describe('exists', () => {
    it('should return true if backlink exists', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ exists: true }] });

      const result = await service.exists(SAMPLE_SOURCE_URI);

      expect(result).toBe(true);
    });

    it('should return false if backlink does not exist', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ exists: false }] });

      const result = await service.exists(SAMPLE_SOURCE_URI);

      expect(result).toBe(false);
    });

    it('should return false if query returns no rows', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.exists(SAMPLE_SOURCE_URI);

      expect(result).toBe(false);
    });
  });

  describe('getBySourceUri', () => {
    it('should return backlink by source URI', async () => {
      db.query.mockResolvedValueOnce({ rows: [SAMPLE_BACKLINK_ROW] });

      const result = await service.getBySourceUri(SAMPLE_SOURCE_URI);

      expect(result).toMatchObject({
        sourceUri: SAMPLE_SOURCE_URI,
        targetUri: SAMPLE_TARGET_URI,
      });
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getBySourceUri(SAMPLE_SOURCE_URI);

      expect(result).toBeNull();
    });
  });

  describe('batchCreateBacklinks', () => {
    it('should insert multiple backlinks in single query', async () => {
      const backlinks = [
        {
          sourceUri: 'at://did:plc:user1/xyz.semble.collection/list1',
          sourceType: 'semble.collection' as BacklinkSourceType,
          targetUri: SAMPLE_TARGET_URI,
        },
        {
          sourceUri: 'at://did:plc:user2/xyz.leaflet.list/list2',
          sourceType: 'leaflet.list' as BacklinkSourceType,
          targetUri: SAMPLE_TARGET_URI,
        },
      ];

      db.query.mockResolvedValueOnce({
        rows: [{ target_uri: SAMPLE_TARGET_URI }, { target_uri: SAMPLE_TARGET_URI }],
      });

      const count = await service.batchCreateBacklinks(backlinks);

      expect(count).toBe(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO backlinks'),
        expect.any(Array)
      );
    });

    it('should return 0 for empty array', async () => {
      const count = await service.batchCreateBacklinks([]);

      expect(count).toBe(0);
      expect(db.query).not.toHaveBeenCalled();
    });

    it('should refresh counts for affected targets', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ target_uri: SAMPLE_TARGET_URI }] })
        .mockResolvedValueOnce({ rows: [] }); // For updateCounts

      await service.batchCreateBacklinks([
        {
          sourceUri: SAMPLE_SOURCE_URI,
          sourceType: 'semble.collection' as BacklinkSourceType,
          targetUri: SAMPLE_TARGET_URI,
        },
      ]);

      // Wait for async count updates
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(db.query).toHaveBeenCalledTimes(2);
    });

    it('should log info with statistics', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ target_uri: SAMPLE_TARGET_URI }] });

      await service.batchCreateBacklinks([
        {
          sourceUri: SAMPLE_SOURCE_URI,
          sourceType: 'semble.collection' as BacklinkSourceType,
          targetUri: SAMPLE_TARGET_URI,
        },
      ]);

      expect(logger.info).toHaveBeenCalledWith('Batch backlinks created', {
        count: 1,
        targetsAffected: 1,
      });
    });
  });
});
