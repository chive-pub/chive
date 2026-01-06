/**
 * Unit tests for TagSpamDetector.
 *
 * @packageDocumentation
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Neo4jConnection } from '../../../../src/storage/neo4j/connection.js';
import {
  TagSpamDetector,
  type TagSpamDetectorConfig,
} from '../../../../src/storage/neo4j/tag-spam-detector.js';
import type { ILogger } from '../../../../src/types/interfaces/logger.interface.js';

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
 * Creates a mock Neo4j connection with configurable query results.
 */
function createMockConnection(queryResults = new Map<string, unknown[]>()): Neo4jConnection {
  return {
    executeQuery: vi.fn().mockImplementation((query: string) => {
      // Match query patterns and return appropriate results
      if (query.includes('MATCH (tag:UserTag')) {
        const statsResult = queryResults.get('tagStats');
        if (statsResult) {
          return Promise.resolve({
            records: statsResult.map((result) => ({
              get: (key: string) => (result as Record<string, unknown>)[key],
            })),
          });
        }
        return Promise.resolve({ records: [] });
      }

      if (query.includes('TAGGED_WITH')) {
        const burstResult = queryResults.get('burstCount');
        if (burstResult) {
          return Promise.resolve({
            records: [{ get: () => burstResult[0] }],
          });
        }
        return Promise.resolve({ records: [{ get: () => 0 }] });
      }

      return Promise.resolve({ records: [] });
    }),
  } as unknown as Neo4jConnection;
}

describe('TagSpamDetector', () => {
  let detector: TagSpamDetector;
  let mockLogger: ILogger;
  let mockConnection: Neo4jConnection;

  const defaultConfig: TagSpamDetectorConfig = {
    spamThreshold: 0.7,
    minUsageForDetection: 3,
    userDominanceThreshold: 0.8,
    maxTagLength: 50,
    burstWindowHours: 1,
    burstThreshold: 10,
  };

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockConnection = createMockConnection();
    detector = new TagSpamDetector({
      connection: mockConnection,
      logger: mockLogger,
      config: defaultConfig,
    });
  });

  describe('constructor', () => {
    it('should create detector with default config', () => {
      const detectorWithDefaults = new TagSpamDetector({
        connection: mockConnection,
        logger: mockLogger,
      });

      expect(detectorWithDefaults).toBeDefined();
    });

    it('should create detector with custom config', () => {
      const customConfig: TagSpamDetectorConfig = {
        spamThreshold: 0.5,
        minUsageForDetection: 5,
      };

      const detectorWithCustom = new TagSpamDetector({
        connection: mockConnection,
        logger: mockLogger,
        config: customConfig,
      });

      expect(detectorWithCustom).toBeDefined();
    });
  });

  describe('detectSpam', () => {
    it('should return default result for non-existent tag', async () => {
      const result = await detector.detectSpam('nonexistent-tag');

      expect(result.isSpam).toBe(false);
      expect(result.spamScore).toBe(0);
      expect(result.reasons).toHaveLength(0);
    });

    it('should return default result for tag with low usage', async () => {
      const queryResults = new Map<string, unknown[]>([
        [
          'tagStats',
          [
            {
              normalizedForm: 'low-usage-tag',
              displayForm: 'Low Usage Tag',
              usageCount: 2, // Below minUsageForDetection
              uniqueUsers: 2,
              uniquePreprints: 2,
              createdAt: new Date().toISOString(),
              lastUsedAt: new Date().toISOString(),
              userDids: ['did:plc:user1', 'did:plc:user2'],
            },
          ],
        ],
      ]);

      mockConnection = createMockConnection(queryResults);
      detector = new TagSpamDetector({
        connection: mockConnection,
        logger: mockLogger,
        config: defaultConfig,
      });

      const result = await detector.detectSpam('low-usage-tag');

      expect(result.isSpam).toBe(false);
      expect(result.spamScore).toBe(0);
    });

    it('should detect spam for promotional tags', async () => {
      const queryResults = new Map<string, unknown[]>([
        [
          'tagStats',
          [
            {
              normalizedForm: 'buy-free-money',
              displayForm: 'buy-free-money',
              usageCount: 10,
              uniqueUsers: 5,
              uniquePreprints: 8,
              createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
              lastUsedAt: new Date().toISOString(),
              userDids: ['did:plc:user1'],
            },
          ],
        ],
        ['burstCount', [0]],
      ]);

      mockConnection = createMockConnection(queryResults);
      detector = new TagSpamDetector({
        connection: mockConnection,
        logger: mockLogger,
        config: defaultConfig,
      });

      const result = await detector.detectSpam('buy-free-money');

      expect(result.ruleScores.promotionalPattern).toBeGreaterThan(0);
      expect(result.reasons.some((r) => r.includes('Promotional keywords'))).toBe(true);
    });

    it('should detect spam for URL patterns', async () => {
      const queryResults = new Map<string, unknown[]>([
        [
          'tagStats',
          [
            {
              normalizedForm: 'visit-example.com',
              displayForm: 'visit-example.com',
              usageCount: 5,
              uniqueUsers: 3,
              uniquePreprints: 4,
              createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
              lastUsedAt: new Date().toISOString(),
              userDids: ['did:plc:user1'],
            },
          ],
        ],
        ['burstCount', [0]],
      ]);

      mockConnection = createMockConnection(queryResults);
      detector = new TagSpamDetector({
        connection: mockConnection,
        logger: mockLogger,
        config: defaultConfig,
      });

      const result = await detector.detectSpam('visit-example.com');

      expect(result.ruleScores.promotionalPattern).toBeGreaterThan(0);
      expect(result.reasons.some((r) => r.includes('URL pattern'))).toBe(true);
    });

    it('should detect spam for excessively long tags', async () => {
      const longTag = 'a'.repeat(60);
      const queryResults = new Map<string, unknown[]>([
        [
          'tagStats',
          [
            {
              normalizedForm: longTag,
              displayForm: longTag,
              usageCount: 5,
              uniqueUsers: 3,
              uniquePreprints: 4,
              createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
              lastUsedAt: new Date().toISOString(),
              userDids: ['did:plc:user1'],
            },
          ],
        ],
        ['burstCount', [0]],
      ]);

      mockConnection = createMockConnection(queryResults);
      detector = new TagSpamDetector({
        connection: mockConnection,
        logger: mockLogger,
        config: defaultConfig,
      });

      const result = await detector.detectSpam(longTag);

      expect(result.ruleScores.nonsensePattern).toBeGreaterThan(0);
      expect(result.reasons.some((r) => r.includes('Excessive length'))).toBe(true);
    });

    it('should detect spam for nonsense character patterns', async () => {
      const nonsenseTag = '12345'; // Only numbers
      const queryResults = new Map<string, unknown[]>([
        [
          'tagStats',
          [
            {
              normalizedForm: nonsenseTag,
              displayForm: nonsenseTag,
              usageCount: 5,
              uniqueUsers: 3,
              uniquePreprints: 4,
              createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
              lastUsedAt: new Date().toISOString(),
              userDids: ['did:plc:user1'],
            },
          ],
        ],
        ['burstCount', [0]],
      ]);

      mockConnection = createMockConnection(queryResults);
      detector = new TagSpamDetector({
        connection: mockConnection,
        logger: mockLogger,
        config: defaultConfig,
      });

      const result = await detector.detectSpam(nonsenseTag);

      expect(result.ruleScores.nonsensePattern).toBeGreaterThan(0);
    });

    it('should detect spam for user dominance', async () => {
      const queryResults = new Map<string, unknown[]>([
        [
          'tagStats',
          [
            {
              normalizedForm: 'dominated-tag',
              displayForm: 'Dominated Tag',
              usageCount: 100,
              uniqueUsers: 1, // Very high dominance
              uniquePreprints: 50,
              createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
              lastUsedAt: new Date().toISOString(),
              userDids: ['did:plc:spammer'],
            },
          ],
        ],
        ['burstCount', [0]],
      ]);

      mockConnection = createMockConnection(queryResults);
      detector = new TagSpamDetector({
        connection: mockConnection,
        logger: mockLogger,
        config: defaultConfig,
      });

      const result = await detector.detectSpam('dominated-tag');

      expect(result.ruleScores.userDominance).toBeGreaterThan(0.8);
      expect(result.reasons.some((r) => r.includes('Single user dominance'))).toBe(true);
    });

    it('should detect spam for low diversity', async () => {
      const queryResults = new Map<string, unknown[]>([
        [
          'tagStats',
          [
            {
              normalizedForm: 'low-diversity-tag',
              displayForm: 'Low Diversity Tag',
              usageCount: 50,
              uniqueUsers: 10,
              uniquePreprints: 5, // Very low preprint diversity
              createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
              lastUsedAt: new Date().toISOString(),
              userDids: ['did:plc:user1'],
            },
          ],
        ],
        ['burstCount', [0]],
      ]);

      mockConnection = createMockConnection(queryResults);
      detector = new TagSpamDetector({
        connection: mockConnection,
        logger: mockLogger,
        config: defaultConfig,
      });

      const result = await detector.detectSpam('low-diversity-tag');

      expect(result.ruleScores.lowDiversity).toBeGreaterThan(0);
      expect(result.reasons.some((r) => r.includes('Low diversity'))).toBe(true);
    });

    it('should calculate weighted spam score correctly', async () => {
      const queryResults = new Map<string, unknown[]>([
        [
          'tagStats',
          [
            {
              normalizedForm: 'legitimate-tag',
              displayForm: 'Legitimate Tag',
              usageCount: 20,
              uniqueUsers: 15,
              uniquePreprints: 18,
              createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
              lastUsedAt: new Date().toISOString(),
              userDids: [],
            },
          ],
        ],
        ['burstCount', [0]],
      ]);

      mockConnection = createMockConnection(queryResults);
      detector = new TagSpamDetector({
        connection: mockConnection,
        logger: mockLogger,
        config: defaultConfig,
      });

      const result = await detector.detectSpam('legitimate-tag');

      // Should have low spam score for legitimate tag
      expect(result.spamScore).toBeLessThan(0.5);
      expect(result.isSpam).toBe(false);
    });

    it('should log when spam is detected', async () => {
      // Create a tag that triggers spam detection (promotional keywords + user dominance)
      const queryResults = new Map<string, unknown[]>([
        [
          'tagStats',
          [
            {
              normalizedForm: 'free-money-offer',
              displayForm: 'free-money-offer',
              usageCount: 100,
              uniqueUsers: 1,
              uniquePreprints: 5,
              createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
              lastUsedAt: new Date().toISOString(),
              userDids: ['did:plc:spammer'],
            },
          ],
        ],
        ['burstCount', [15]],
      ]);

      mockConnection = createMockConnection(queryResults);
      detector = new TagSpamDetector({
        connection: mockConnection,
        logger: mockLogger,
        config: { ...defaultConfig, spamThreshold: 0.3 },
      });

      await detector.detectSpam('free-money-offer');

      expect(mockLogger.info).toHaveBeenCalled();
    });
  });

  describe('batchDetectSpam', () => {
    it('should process multiple tags', async () => {
      const results = await detector.batchDetectSpam(['tag1', 'tag2', 'tag3']);

      expect(results.size).toBe(3);
      expect(results.has('tag1')).toBe(true);
      expect(results.has('tag2')).toBe(true);
      expect(results.has('tag3')).toBe(true);
    });

    it('should handle empty array', async () => {
      const results = await detector.batchDetectSpam([]);

      expect(results.size).toBe(0);
    });

    it('should process batches correctly', async () => {
      // Create array of 25 tags to test batch processing (batch size is 10)
      const tags = Array.from({ length: 25 }, (_, i) => `tag-${i}`);

      const results = await detector.batchDetectSpam(tags);

      expect(results.size).toBe(25);
    });
  });

  describe('rule combinations', () => {
    it('should combine multiple spam signals', async () => {
      // Tag that triggers multiple spam rules
      const queryResults = new Map<string, unknown[]>([
        [
          'tagStats',
          [
            {
              normalizedForm: 'buy-discount-now.com',
              displayForm: 'buy-discount-now.com',
              usageCount: 100,
              uniqueUsers: 2, // High dominance
              uniquePreprints: 10, // Low diversity
              createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
              lastUsedAt: new Date().toISOString(),
              userDids: ['did:plc:spammer'],
            },
          ],
        ],
        ['burstCount', [15]], // Burst creation
      ]);

      mockConnection = createMockConnection(queryResults);
      detector = new TagSpamDetector({
        connection: mockConnection,
        logger: mockLogger,
        config: defaultConfig,
      });

      const result = await detector.detectSpam('buy-discount-now.com');

      // Should have high spam score from multiple rules
      expect(result.spamScore).toBeGreaterThan(0.5);
      expect(result.reasons.length).toBeGreaterThan(1);
      expect(result.ruleScores.promotionalPattern).toBeGreaterThan(0);
      expect(result.ruleScores.userDominance).toBeGreaterThan(0);
      expect(result.ruleScores.lowDiversity).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('should handle query errors gracefully', async () => {
      mockConnection = {
        executeQuery: vi.fn().mockRejectedValue(new Error('Database error')),
      } as unknown as Neo4jConnection;

      detector = new TagSpamDetector({
        connection: mockConnection,
        logger: mockLogger,
        config: defaultConfig,
      });

      const result = await detector.detectSpam('any-tag');

      // Should return default result on error
      expect(result.spamScore).toBe(0);
      expect(result.isSpam).toBe(false);
    });
  });
});
