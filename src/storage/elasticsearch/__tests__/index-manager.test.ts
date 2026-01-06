/**
 * Unit tests for IndexManager.
 *
 * @packageDocumentation
 */

import type { Client, estypes } from '@elastic/elasticsearch';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AtUri } from '../../../types/atproto.js';
import { BulkOperationError, IndexManager, IndexOperationError } from '../index-manager.js';

describe('IndexManager', () => {
  let mockBulk: ReturnType<typeof vi.fn>;
  let mockDeleteByQuery: ReturnType<typeof vi.fn>;
  let mockRefresh: ReturnType<typeof vi.fn>;
  let mockExists: ReturnType<typeof vi.fn>;
  let mockClient: Client;
  let manager: IndexManager;

  beforeEach(() => {
    mockBulk = vi.fn();
    mockDeleteByQuery = vi.fn();
    mockRefresh = vi.fn();
    mockExists = vi.fn();

    mockClient = {
      bulk: mockBulk,
      deleteByQuery: mockDeleteByQuery,
      indices: {
        refresh: mockRefresh,
        exists: mockExists,
      },
    } as unknown as Client;

    manager = new IndexManager(mockClient, {
      indexName: 'test-index',
      bulkChunkSize: 2,
      continueOnError: true,
      refresh: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should use default configuration', () => {
      const defaultManager = new IndexManager(mockClient);

      expect(defaultManager).toBeDefined();
    });

    it('should accept custom configuration', () => {
      const customManager = new IndexManager(mockClient, {
        indexName: 'custom-index',
        bulkChunkSize: 100,
        maxRetries: 5,
        refresh: true,
        continueOnError: false,
      });

      expect(customManager).toBeDefined();
    });
  });

  describe('bulkIndex', () => {
    it('should return empty result for empty document array', async () => {
      const result = await manager.bulkIndex([]);

      expect(result.indexed).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.failures).toEqual([]);
      expect(result.took).toBe(0);
    });

    it('should index documents successfully', async () => {
      const documents = [
        { uri: 'at://test/1' as AtUri, title: 'Doc 1' },
        { uri: 'at://test/2' as AtUri, title: 'Doc 2' },
      ];

      const mockResponse: estypes.BulkResponse = {
        took: 10,
        errors: false,
        items: [
          { index: { _index: 'test-index', _id: 'at://test/1', status: 201 } },
          { index: { _index: 'test-index', _id: 'at://test/2', status: 201 } },
        ],
      };

      mockBulk.mockResolvedValue(mockResponse);

      const result = await manager.bulkIndex(documents);

      expect(result.indexed).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.failures).toEqual([]);
      expect(result.took).toBe(10);
    });

    it('should handle partial failures with continueOnError', async () => {
      const documents = [
        { uri: 'at://test/1' as AtUri, title: 'Doc 1' },
        { uri: 'at://test/2' as AtUri, title: 'Doc 2' },
      ];

      const mockResponse: estypes.BulkResponse = {
        took: 15,
        errors: true,
        items: [
          { index: { _index: 'test-index', _id: 'at://test/1', status: 201 } },
          {
            index: {
              _index: 'test-index',
              _id: 'at://test/2',
              status: 400,
              error: { type: 'mapper_parsing_exception', reason: 'Invalid field' },
            },
          },
        ],
      };

      mockBulk.mockResolvedValue(mockResponse);

      const result = await manager.bulkIndex(documents);

      expect(result.indexed).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0]?.id).toBe('at://test/2');
      expect(result.failures[0]?.status).toBe(400);
      expect(result.failures[0]?.error).toContain('Invalid field');
    });

    it('should throw error on failures when continueOnError is false', async () => {
      const managerStrictErrors = new IndexManager(mockClient, {
        indexName: 'test-index',
        bulkChunkSize: 2,
        continueOnError: false,
      });

      const documents = [
        { uri: 'at://test/1' as AtUri, title: 'Doc 1' },
        { uri: 'at://test/2' as AtUri, title: 'Doc 2' },
      ];

      const mockResponse: estypes.BulkResponse = {
        took: 15,
        errors: true,
        items: [
          { index: { _index: 'test-index', _id: 'at://test/1', status: 201 } },
          {
            index: {
              _index: 'test-index',
              _id: 'at://test/2',
              status: 400,
              error: { type: 'validation_exception', reason: 'Validation error' },
            },
          },
        ],
      };

      mockBulk.mockResolvedValue(mockResponse);

      await expect(managerStrictErrors.bulkIndex(documents)).rejects.toThrow(BulkOperationError);
      await expect(managerStrictErrors.bulkIndex(documents)).rejects.toThrow(
        'Bulk index operation failed: 1 documents failed'
      );
    });

    it('should chunk large document arrays', async () => {
      const documents = [
        { uri: 'at://test/1' as AtUri, title: 'Doc 1' },
        { uri: 'at://test/2' as AtUri, title: 'Doc 2' },
        { uri: 'at://test/3' as AtUri, title: 'Doc 3' },
        { uri: 'at://test/4' as AtUri, title: 'Doc 4' },
      ];

      const mockResponse: estypes.BulkResponse = {
        took: 10,
        errors: false,
        items: [
          { index: { _index: 'test-index', _id: 'at://test/1', status: 201 } },
          { index: { _index: 'test-index', _id: 'at://test/2', status: 201 } },
        ],
      };

      mockBulk.mockResolvedValue(mockResponse);

      const result = await manager.bulkIndex(documents);

      expect(mockBulk).toHaveBeenCalledTimes(2);
      expect(result.indexed).toBe(4);
      expect(result.failed).toBe(0);
      expect(result.took).toBe(20);
    });

    it('should throw error if document has no uri or id field', async () => {
      const documents = [{ title: 'Doc without ID' }];

      await expect(manager.bulkIndex(documents)).rejects.toThrow(IndexOperationError);
    });
  });

  describe('bulkDelete', () => {
    it('should return empty result for empty URI array', async () => {
      const result = await manager.bulkDelete([]);

      expect(result.indexed).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.failures).toEqual([]);
      expect(result.took).toBe(0);
    });

    it('should delete documents successfully', async () => {
      const uris = ['at://test/1' as AtUri, 'at://test/2' as AtUri];

      const mockResponse: estypes.BulkResponse = {
        took: 10,
        errors: false,
        items: [
          { delete: { _index: 'test-index', _id: 'at://test/1', status: 200 } },
          { delete: { _index: 'test-index', _id: 'at://test/2', status: 200 } },
        ],
      };

      mockBulk.mockResolvedValue(mockResponse);

      const result = await manager.bulkDelete(uris);

      expect(result.indexed).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.took).toBe(10);
    });

    it('should handle delete failures', async () => {
      const uris = ['at://test/1' as AtUri, 'at://test/2' as AtUri];

      const mockResponse: estypes.BulkResponse = {
        took: 15,
        errors: true,
        items: [
          { delete: { _index: 'test-index', _id: 'at://test/1', status: 200 } },
          {
            delete: {
              _index: 'test-index',
              _id: 'at://test/2',
              status: 404,
              error: { type: 'document_missing_exception', reason: 'Document not found' },
            },
          },
        ],
      };

      mockBulk.mockResolvedValue(mockResponse);

      const result = await manager.bulkDelete(uris);

      expect(result.indexed).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.failures[0]?.id).toBe('at://test/2');
      expect(result.failures[0]?.status).toBe(404);
    });
  });

  describe('deleteByQuery', () => {
    it('should delete documents matching query', async () => {
      const query: estypes.QueryDslQueryContainer = {
        match: { author: 'did:plc:test' },
      };

      const mockResponse: estypes.DeleteByQueryResponse = {
        took: 100,
        timed_out: false,
        total: 5,
        deleted: 5,
        batches: 1,
        version_conflicts: 0,
        noops: 0,
        retries: { bulk: 0, search: 0 },
        throttled_millis: 0,
        requests_per_second: -1,
        throttled_until_millis: 0,
        failures: [],
      };

      mockDeleteByQuery.mockResolvedValue(mockResponse);

      const result = await manager.deleteByQuery(query);

      expect(result).toBe(5);
    });

    it('should return zero when no documents deleted', async () => {
      const query: estypes.QueryDslQueryContainer = {
        match: { author: 'did:plc:nonexistent' },
      };

      const mockResponse: estypes.DeleteByQueryResponse = {
        took: 50,
        timed_out: false,
        total: 0,
        deleted: 0,
        batches: 0,
        version_conflicts: 0,
        noops: 0,
        retries: { bulk: 0, search: 0 },
        throttled_millis: 0,
        requests_per_second: -1,
        throttled_until_millis: 0,
        failures: [],
      };

      mockDeleteByQuery.mockResolvedValue(mockResponse);

      const result = await manager.deleteByQuery(query);

      expect(result).toBe(0);
    });
  });

  describe('refresh', () => {
    it('should refresh index successfully', async () => {
      const mockResponse: estypes.IndicesRefreshResponse = {
        _shards: { total: 1, successful: 1, failed: 0 },
      };

      mockRefresh.mockResolvedValue(mockResponse);

      await expect(manager.refresh()).resolves.toBeUndefined();
    });
  });

  describe('exists', () => {
    it('should return true when index exists', async () => {
      mockExists.mockResolvedValue(true);

      const result = await manager.exists('test-index');

      expect(result).toBe(true);
    });

    it('should return false when index does not exist', async () => {
      mockExists.mockResolvedValue(false);

      const result = await manager.exists('nonexistent-index');

      expect(result).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle bulk response with missing operation', async () => {
      const documents = [{ uri: 'at://test/1' as AtUri, title: 'Doc 1' }];

      const mockResponse: estypes.BulkResponse = {
        took: 10,
        errors: false,
        items: [{}],
      };

      mockBulk.mockResolvedValue(mockResponse);

      const result = await manager.bulkIndex(documents);

      expect(result.indexed).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('should handle bulk response with error object', async () => {
      const documents = [{ uri: 'at://test/1' as AtUri, title: 'Doc 1' }];

      const mockResponse: estypes.BulkResponse = {
        took: 10,
        errors: true,
        items: [
          {
            index: {
              _index: 'test-index',
              _id: 'at://test/1',
              status: 400,
              error: {
                type: 'mapper_parsing_exception',
                reason: 'Failed to parse field',
              },
            },
          },
        ],
      };

      mockBulk.mockResolvedValue(mockResponse);

      const result = await manager.bulkIndex(documents);

      expect(result.failed).toBe(1);
      expect(result.failures[0]?.error).toBe('Failed to parse field');
    });

    it('should handle bulk response with missing document ID', async () => {
      const documents = [{ uri: 'at://test/1' as AtUri, title: 'Doc 1' }];

      const mockResponse: estypes.BulkResponse = {
        took: 10,
        errors: true,
        items: [
          {
            index: {
              _index: 'test-index',
              status: 400,
              error: { type: 'missing_id_exception', reason: 'Missing ID' },
            },
          },
        ],
      };

      mockBulk.mockResolvedValue(mockResponse);

      const result = await manager.bulkIndex(documents);

      expect(result.failed).toBe(1);
      expect(result.failures[0]?.id).toBe('unknown');
    });
  });
});
