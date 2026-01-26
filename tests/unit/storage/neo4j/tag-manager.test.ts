/**
 * Unit tests for TagManager.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import type { Neo4jConnection } from '../../../../src/storage/neo4j/connection.js';
import { TagManager } from '../../../../src/storage/neo4j/tag-manager.js';
import type { AtUri } from '../../../../src/types/atproto.js';
import type { ILogger } from '../../../../src/types/interfaces/logger.interface.js';

interface MockRecord {
  get: (key: string) => unknown;
}

interface MockQueryResult {
  records: MockRecord[];
}

/**
 * Creates a mock record that mimics the Neo4j Record interface.
 */
function createMockRecord(data: Record<string, unknown>): MockRecord {
  return {
    get: (key: string): unknown => data[key],
  };
}

/**
 * Creates a mock logger.
 */
function createMockLogger(): ILogger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  } as unknown as ILogger;
}

/**
 * Creates a mock Neo4j connection with configurable query behavior.
 */
function createMockConnection(): Neo4jConnection & {
  executeQuery: Mock;
  executeTransaction: Mock;
} {
  return {
    executeQuery: vi.fn(),
    executeTransaction: vi.fn(),
    getSession: vi.fn(),
    healthCheck: vi.fn(),
    isConnectionHealthy: vi.fn(),
    close: vi.fn(),
  } as unknown as Neo4jConnection & { executeQuery: Mock; executeTransaction: Mock };
}

describe('TagManager', () => {
  let tagManager: TagManager;
  let mockConnection: ReturnType<typeof createMockConnection>;
  let mockLogger: ILogger;

  beforeEach(() => {
    mockConnection = createMockConnection();
    mockLogger = createMockLogger();
    tagManager = new TagManager({
      connection: mockConnection,
      logger: mockLogger,
    });
  });

  describe('removeAllTagsForRecord', () => {
    it('should successfully remove all tag relationships for a record', async () => {
      const recordUri = 'at://did:plc:user123/pub.chive.eprint.submission/abc123' as AtUri;

      mockConnection.executeQuery.mockResolvedValue({
        records: [createMockRecord({ removedCount: 3 })],
      } as MockQueryResult);

      const result = await tagManager.removeAllTagsForRecord(recordUri);

      expect(result).toBe(3);
      expect(mockConnection.executeQuery).toHaveBeenCalledTimes(1);

      const callArgs = mockConnection.executeQuery.mock.calls[0] as [
        string,
        Record<string, unknown>,
      ];
      const query = callArgs[0];
      const params = callArgs[1];

      expect(query).toContain('MATCH (record {uri: $recordUri})-[r:TAGGED_WITH]->(tag:UserTag)');
      expect(query).toContain('DELETE r');
      expect(query).toContain('SET tag.usageCount');
      expect(params.recordUri).toBe(recordUri);
    });

    it('should return correct count of removed relationships', async () => {
      const recordUri = 'at://did:plc:user123/pub.chive.eprint.submission/abc123' as AtUri;

      // Test various counts
      const testCases = [0, 1, 5, 10, 100];

      for (const expectedCount of testCases) {
        mockConnection.executeQuery.mockResolvedValue({
          records: [createMockRecord({ removedCount: expectedCount })],
        } as MockQueryResult);

        const result = await tagManager.removeAllTagsForRecord(recordUri);

        expect(result).toBe(expectedCount);
      }
    });

    it('should decrement usageCount on affected tags', async () => {
      const recordUri = 'at://did:plc:user123/pub.chive.eprint.submission/abc123' as AtUri;

      mockConnection.executeQuery.mockResolvedValue({
        records: [createMockRecord({ removedCount: 2 })],
      } as MockQueryResult);

      await tagManager.removeAllTagsForRecord(recordUri);

      const callArgs = mockConnection.executeQuery.mock.calls[0] as [
        string,
        Record<string, unknown>,
      ];
      const query = callArgs[0];

      // Verify the query decrements usageCount with proper bounds checking
      expect(query).toContain(
        'tag.usageCount = CASE WHEN tag.usageCount > 0 THEN tag.usageCount - 1 ELSE 0 END'
      );
      expect(query).toContain('tag.updatedAt = datetime()');
    });

    it('should handle case where record has no tags and return 0', async () => {
      const recordUri = 'at://did:plc:user123/pub.chive.eprint.submission/no-tags' as AtUri;

      // No records returned means no tags were associated
      mockConnection.executeQuery.mockResolvedValue({
        records: [createMockRecord({ removedCount: 0 })],
      } as MockQueryResult);

      const result = await tagManager.removeAllTagsForRecord(recordUri);

      expect(result).toBe(0);
    });

    it('should handle case where query returns empty records array', async () => {
      const recordUri = 'at://did:plc:user123/pub.chive.eprint.submission/no-tags' as AtUri;

      mockConnection.executeQuery.mockResolvedValue({
        records: [],
      } as MockQueryResult);

      const result = await tagManager.removeAllTagsForRecord(recordUri);

      expect(result).toBe(0);
    });

    it('should handle Neo4j connection errors gracefully', async () => {
      const recordUri = 'at://did:plc:user123/pub.chive.eprint.submission/abc123' as AtUri;
      const dbError = new Error('Neo4j connection lost');

      mockConnection.executeQuery.mockRejectedValue(dbError);

      await expect(tagManager.removeAllTagsForRecord(recordUri)).rejects.toThrow(
        'Neo4j connection lost'
      );
    });

    it('should handle Neo4j timeout errors', async () => {
      const recordUri = 'at://did:plc:user123/pub.chive.eprint.submission/abc123' as AtUri;
      const timeoutError = new Error('Query execution timeout');

      mockConnection.executeQuery.mockRejectedValue(timeoutError);

      await expect(tagManager.removeAllTagsForRecord(recordUri)).rejects.toThrow(
        'Query execution timeout'
      );
    });
  });

  describe('updateTagStatistics .catch() handlers', () => {
    it('should log errors from updateTagStatistics but not propagate them in addTag', async () => {
      const recordUri = 'at://did:plc:user123/pub.chive.eprint.submission/abc123' as AtUri;
      const rawTag = 'machine learning';
      const userDid = 'did:plc:user123';

      let updateStatisticsCallCount = 0;

      // First call is for addTag, subsequent calls are for updateTagStatistics
      mockConnection.executeQuery.mockImplementation(() => {
        updateStatisticsCallCount++;

        if (updateStatisticsCallCount === 1) {
          // First call: addTag main query succeeds
          return Promise.resolve({
            records: [
              createMockRecord({
                existed: false,
                usageCount: 1,
                paperCount: 0,
              }),
            ],
          });
        } else {
          // Subsequent calls: updateTagStatistics fails
          return Promise.reject(new Error('Statistics update failed'));
        }
      });

      // The main operation should still succeed
      const result = await tagManager.addTag(recordUri, rawTag, userDid);

      expect(result).toEqual({
        rawForm: rawTag,
        normalizedForm: 'machine learning',
        existed: false,
      });

      // Wait for async updateTagStatistics to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify warning was logged
      expect(mockLogger.warn).toHaveBeenCalledWith('Failed to update tag statistics', {
        tag: 'machine learning',
        error: 'Statistics update failed',
      });
    });

    it('should log errors from updateTagStatistics but not propagate them in removeTag', async () => {
      const recordUri = 'at://did:plc:user123/pub.chive.eprint.submission/abc123' as AtUri;
      const normalizedTag = 'machine learning';

      let queryCallCount = 0;

      mockConnection.executeQuery.mockImplementation(() => {
        queryCallCount++;

        if (queryCallCount === 1) {
          // First call: removeTag main query succeeds
          return Promise.resolve({
            records: [
              createMockRecord({
                usageCount: 5,
                paperCount: 3,
              }),
            ],
          });
        } else {
          // Subsequent calls: updateTagStatistics fails
          return Promise.reject(new Error('Statistics update failed'));
        }
      });

      // The main operation should complete without throwing
      await tagManager.removeTag(recordUri, normalizedTag);

      // Wait for async updateTagStatistics to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify warning was logged
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to update tag statistics after removal',
        {
          tag: normalizedTag,
          error: 'Statistics update failed',
        }
      );
    });

    it('should handle non-Error objects in catch handler', async () => {
      const recordUri = 'at://did:plc:user123/pub.chive.eprint.submission/abc123' as AtUri;
      const rawTag = 'deep learning';
      const userDid = 'did:plc:user123';

      let queryCallCount = 0;

      mockConnection.executeQuery.mockImplementation(() => {
        queryCallCount++;

        if (queryCallCount === 1) {
          return Promise.resolve({
            records: [
              createMockRecord({
                existed: false,
                usageCount: 1,
                paperCount: 0,
              }),
            ],
          });
        } else {
          // Reject with an object that is not a standard Error
          // We use `as Error` to satisfy the linter, but the actual object tests
          // the String() fallback path in the catch handler
          const customError = { message: 'Custom error object' } as unknown as Error;
          return Promise.reject(customError);
        }
      });

      const result = await tagManager.addTag(recordUri, rawTag, userDid);

      expect(result.normalizedForm).toBe('deep learning');

      // Wait for async updateTagStatistics to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify warning was logged with stringified error
      expect(mockLogger.warn).toHaveBeenCalledWith('Failed to update tag statistics', {
        tag: 'deep learning',
        error: '[object Object]',
      });
    });

    it('should still succeed when logger is not provided', async () => {
      // Create TagManager without logger
      const tagManagerNoLogger = new TagManager(mockConnection);

      const recordUri = 'at://did:plc:user123/pub.chive.eprint.submission/abc123' as AtUri;
      const rawTag = 'neural networks';
      const userDid = 'did:plc:user123';

      let queryCallCount = 0;

      mockConnection.executeQuery.mockImplementation(() => {
        queryCallCount++;

        if (queryCallCount === 1) {
          return Promise.resolve({
            records: [
              createMockRecord({
                existed: false,
                usageCount: 1,
                paperCount: 0,
              }),
            ],
          });
        } else {
          return Promise.reject(new Error('Statistics update failed'));
        }
      });

      // Should not throw even without logger
      const result = await tagManagerNoLogger.addTag(recordUri, rawTag, userDid);

      expect(result.normalizedForm).toBe('neural networks');
    });
  });

  describe('normalizeTag', () => {
    it('should convert to lowercase', () => {
      expect(tagManager.normalizeTag('Machine Learning')).toBe('machine learning');
      expect(tagManager.normalizeTag('DEEP LEARNING')).toBe('deep learning');
    });

    it('should remove special characters except hyphens', () => {
      expect(tagManager.normalizeTag('Neural-Networks!')).toBe('neural-networks');
      expect(tagManager.normalizeTag('AI/ML')).toBe('aiml');
      expect(tagManager.normalizeTag('test@tag#value')).toBe('testtagvalue');
    });

    it('should normalize whitespace', () => {
      expect(tagManager.normalizeTag('  deep   learning  ')).toBe('deep learning');
      expect(tagManager.normalizeTag('machine\t\tlearning')).toBe('machine learning');
    });

    it('should normalize multiple hyphens', () => {
      expect(tagManager.normalizeTag('neural---networks')).toBe('neural-networks');
    });
  });

  describe('addTag', () => {
    it('should add a new tag to a record', async () => {
      const recordUri = 'at://did:plc:user123/pub.chive.eprint.submission/abc123' as AtUri;
      const rawTag = 'Machine Learning';
      const userDid = 'did:plc:user123';

      mockConnection.executeQuery.mockResolvedValue({
        records: [
          createMockRecord({
            existed: false,
            usageCount: 1,
            paperCount: 1,
          }),
        ],
      });

      const result = await tagManager.addTag(recordUri, rawTag, userDid);

      expect(result).toEqual({
        rawForm: rawTag,
        normalizedForm: 'machine learning',
        existed: false,
      });
    });

    it('should return existed: true for duplicate tag', async () => {
      const recordUri = 'at://did:plc:user123/pub.chive.eprint.submission/abc123' as AtUri;
      const rawTag = 'Machine Learning';
      const userDid = 'did:plc:user123';

      mockConnection.executeQuery.mockResolvedValue({
        records: [
          createMockRecord({
            existed: true,
            usageCount: 5,
            paperCount: 3,
          }),
        ],
      });

      const result = await tagManager.addTag(recordUri, rawTag, userDid);

      expect(result.existed).toBe(true);
    });
  });

  describe('removeTag', () => {
    it('should remove a tag from a record', async () => {
      const recordUri = 'at://did:plc:user123/pub.chive.eprint.submission/abc123' as AtUri;
      const normalizedTag = 'machine learning';

      mockConnection.executeQuery.mockResolvedValue({
        records: [
          createMockRecord({
            usageCount: 4,
            paperCount: 3,
          }),
        ],
      });

      await tagManager.removeTag(recordUri, normalizedTag);

      const callArgs = mockConnection.executeQuery.mock.calls[0] as [
        string,
        Record<string, unknown>,
      ];
      const query = callArgs[0];
      const params = callArgs[1];

      expect(query).toContain(
        'MATCH (record {uri: $recordUri})-[r:TAGGED_WITH]->(tag:UserTag {normalizedForm: $normalizedTag})'
      );
      expect(query).toContain('DELETE r');
      expect(params.recordUri).toBe(recordUri);
      expect(params.normalizedTag).toBe(normalizedTag);
    });
  });

  describe('getTag', () => {
    it('should return tag when found', async () => {
      const normalizedForm = 'machine learning';

      mockConnection.executeQuery.mockResolvedValue({
        records: [
          createMockRecord({
            tag: {
              properties: {
                normalizedForm: 'machine learning',
                rawForm: 'Machine Learning',
                usageCount: 10,
                uniqueUsers: 5,
                paperCount: 8,
                qualityScore: 0.8,
                spamScore: 0.1,
                growthRate: 0.5,
                createdAt: new Date('2024-01-01'),
              },
            },
          }),
        ],
      });

      const result = await tagManager.getTag(normalizedForm);

      expect(result).not.toBeNull();
      expect(result?.normalizedForm).toBe('machine learning');
      expect(result?.usageCount).toBe(10);
    });

    it('should return null when tag not found', async () => {
      mockConnection.executeQuery.mockResolvedValue({
        records: [],
      });

      const result = await tagManager.getTag('nonexistent-tag');

      expect(result).toBeNull();
    });
  });

  describe('getTagsForRecord', () => {
    it('should return tags for a record', async () => {
      const recordUri = 'at://did:plc:user123/pub.chive.eprint.submission/abc123' as AtUri;

      mockConnection.executeQuery.mockResolvedValue({
        records: [
          createMockRecord({
            tag: {
              properties: {
                normalizedForm: 'machine learning',
                rawForm: 'Machine Learning',
                usageCount: 10,
                uniqueUsers: 5,
                paperCount: 8,
                qualityScore: 0.8,
                spamScore: 0.1,
                growthRate: 0.5,
                createdAt: new Date('2024-01-01'),
              },
            },
          }),
          createMockRecord({
            tag: {
              properties: {
                normalizedForm: 'deep learning',
                rawForm: 'Deep Learning',
                usageCount: 8,
                uniqueUsers: 4,
                paperCount: 6,
                qualityScore: 0.75,
                spamScore: 0.05,
                growthRate: 0.6,
                createdAt: new Date('2024-01-02'),
              },
            },
          }),
        ],
      });

      const result = await tagManager.getTagsForRecord(recordUri);

      expect(result).toHaveLength(2);
      expect(result[0]?.normalizedForm).toBe('machine learning');
      expect(result[1]?.normalizedForm).toBe('deep learning');
    });

    it('should return empty array when record has no tags', async () => {
      mockConnection.executeQuery.mockResolvedValue({
        records: [],
      });

      const result = await tagManager.getTagsForRecord(
        'at://did:plc:user123/pub.chive.eprint.submission/no-tags' as AtUri
      );

      expect(result).toEqual([]);
    });
  });
});
