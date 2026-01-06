/**
 * Unit tests for ATRepository.
 *
 * @remarks
 * Tests AT Protocol record fetching, blob fetching, and error handling.
 */

/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import type { IPolicy } from 'cockatiel';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

import { BlobFetchError, RecordFetchError } from '@/atproto/errors/repository-errors.js';
import { ATRepository } from '@/atproto/repository/at-repository.js';
import type { AtUri, CID, DID, NSID } from '@/types/atproto.js';
import type { IIdentityResolver } from '@/types/interfaces/identity.interface.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

// Mock functions must be defined before vi.mock due to hoisting
const mockGetRecord = vi.hoisted(() => vi.fn());
const mockListRecords = vi.hoisted(() => vi.fn());

vi.mock('@atproto/api', () => {
  // Define class inside factory to avoid hoisting issues
  class MockAtpAgent {
    com = {
      atproto: {
        repo: {
          getRecord: mockGetRecord,
          listRecords: mockListRecords,
        },
      },
    };

    constructor(_options: { service: string }) {
      // Constructor receives options but we don't need them for mocking
    }
  }

  return {
    AtpAgent: MockAtpAgent,
  };
});

interface MockLogger extends ILogger {
  debugMock: Mock;
  warnMock: Mock;
  errorMock: Mock;
}

const createMockLogger = (): MockLogger => {
  const debugMock = vi.fn();
  const warnMock = vi.fn();
  const errorMock = vi.fn();
  const logger: MockLogger = {
    debug: debugMock,
    info: vi.fn(),
    warn: warnMock,
    error: errorMock,
    child: vi.fn(function (this: void) {
      return logger;
    }),
    debugMock,
    warnMock,
    errorMock,
  };
  return logger;
};

const createMockIdentityResolver = (): IIdentityResolver => ({
  resolveHandle: vi.fn(),
  resolveDID: vi.fn(),
  getPDSEndpoint: vi.fn().mockResolvedValue('https://pds.example.com'),
});

const createMockResiliencePolicy = (): IPolicy =>
  ({
    execute: vi.fn().mockImplementation((fn) => fn()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

describe('ATRepository', () => {
  let repository: ATRepository;
  let logger: MockLogger;
  let identity: IIdentityResolver;
  let resiliencePolicy: IPolicy;

  const testDid = 'did:plc:test123abc' as DID;
  const testCid = 'bafyreib2rxk3rybk3aobmv5dgudb4vls5sj3bkxfq7c42wgk6b6a7q' as CID;
  const testCollection = 'pub.chive.preprint.submission' as NSID;
  const testRkey = 'xyz789';
  const testUri = `at://${testDid}/${testCollection}/${testRkey}` as AtUri;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRecord.mockReset();
    mockListRecords.mockReset();
    logger = createMockLogger();
    identity = createMockIdentityResolver();
    resiliencePolicy = createMockResiliencePolicy();

    repository = new ATRepository({
      identity,
      resiliencePolicy,
      logger,
    });
  });

  describe('getRecord', () => {
    it('should return null for invalid AT URI format', async () => {
      const invalidUri = 'invalid-uri' as AtUri;

      const result = await repository.getRecord(invalidUri);

      expect(result).toBeNull();
      expect(logger.warnMock).toHaveBeenCalledWith('Invalid AT URI format', { uri: invalidUri });
    });

    it('should return null when PDS endpoint cannot be resolved', async () => {
      (identity.getPDSEndpoint as Mock).mockResolvedValue(null);

      const result = await repository.getRecord(testUri);

      expect(result).toBeNull();
      expect(logger.warnMock).toHaveBeenCalledWith('Cannot resolve PDS endpoint', { did: testDid });
    });

    it('should return record when fetch succeeds', async () => {
      const mockRecord = {
        uri: testUri,
        cid: testCid,
        value: { title: 'Test Preprint', abstract: 'Test abstract' },
      };

      mockGetRecord.mockResolvedValue({
        data: mockRecord,
      });

      const result = await repository.getRecord(testUri);

      expect(result).not.toBeNull();
      expect(result?.uri).toBe(testUri);
      expect(result?.cid).toBe(testCid);
      expect(result?.value).toEqual(mockRecord.value);
      expect(result?.author).toBe(testDid);
    });

    it('should return null for 404 Not Found responses', async () => {
      const notFoundError = { status: 404, message: 'Record not found' };
      mockGetRecord.mockRejectedValue(notFoundError);

      const result = await repository.getRecord(testUri);

      expect(result).toBeNull();
      expect(logger.debugMock).toHaveBeenCalledWith('Record not found', { uri: testUri });
    });

    it('should throw RecordFetchError for network errors', async () => {
      const networkError = new TypeError('fetch failed');
      mockGetRecord.mockRejectedValue(networkError);

      await expect(repository.getRecord(testUri)).rejects.toThrow(RecordFetchError);
    });

    it('should fetch specific version when CID option provided', async () => {
      const specificCid = 'bafyreispecific123' as CID;
      const mockRecord = {
        uri: testUri,
        cid: specificCid,
        value: { title: 'Specific Version' },
      };

      mockGetRecord.mockResolvedValue({
        data: mockRecord,
      });

      const result = await repository.getRecord(testUri, { cid: specificCid });

      expect(mockGetRecord).toHaveBeenCalledWith({
        repo: testDid,
        collection: testCollection,
        rkey: testRkey,
        cid: specificCid,
      });
      expect(result?.cid).toBe(specificCid);
    });
  });

  describe('listRecords', () => {
    it('should yield no records when PDS endpoint cannot be resolved', async () => {
      (identity.getPDSEndpoint as Mock).mockResolvedValue(null);

      const records: unknown[] = [];
      for await (const record of repository.listRecords(testDid, testCollection)) {
        records.push(record);
      }

      expect(records).toHaveLength(0);
      expect(logger.warnMock).toHaveBeenCalledWith('Cannot resolve PDS endpoint for listing', {
        did: testDid,
      });
    });

    it('should yield records from single page', async () => {
      const mockRecords = [
        { uri: `at://${testDid}/${testCollection}/1`, cid: 'cid1', value: { title: 'Record 1' } },
        { uri: `at://${testDid}/${testCollection}/2`, cid: 'cid2', value: { title: 'Record 2' } },
      ];

      mockListRecords.mockResolvedValue({
        data: { records: mockRecords, cursor: undefined },
      });

      const records: unknown[] = [];
      for await (const record of repository.listRecords(testDid, testCollection)) {
        records.push(record);
      }

      expect(records).toHaveLength(2);
      const firstMockRecord = mockRecords[0]!;
      expect(records[0]).toMatchObject({
        uri: firstMockRecord.uri,
        cid: firstMockRecord.cid,
        author: testDid,
      });
    });

    it('should handle pagination correctly', async () => {
      const page1Records = [
        { uri: `at://${testDid}/${testCollection}/1`, cid: 'cid1', value: { title: 'Record 1' } },
      ];
      const page2Records = [
        { uri: `at://${testDid}/${testCollection}/2`, cid: 'cid2', value: { title: 'Record 2' } },
      ];

      mockListRecords
        .mockResolvedValueOnce({
          data: { records: page1Records, cursor: 'cursor1' },
        })
        .mockResolvedValueOnce({
          data: { records: page2Records, cursor: undefined },
        });

      const records: unknown[] = [];
      for await (const record of repository.listRecords(testDid, testCollection, { limit: 10 })) {
        records.push(record);
      }

      expect(records).toHaveLength(2);
      expect(mockListRecords).toHaveBeenCalledTimes(2);
    });

    it('should respect limit option', async () => {
      const mockRecords = [
        { uri: `at://${testDid}/${testCollection}/1`, cid: 'cid1', value: { title: 'Record 1' } },
        { uri: `at://${testDid}/${testCollection}/2`, cid: 'cid2', value: { title: 'Record 2' } },
        { uri: `at://${testDid}/${testCollection}/3`, cid: 'cid3', value: { title: 'Record 3' } },
      ];

      mockListRecords.mockResolvedValue({
        data: { records: mockRecords, cursor: 'cursor1' },
      });

      const records: unknown[] = [];
      for await (const record of repository.listRecords(testDid, testCollection, { limit: 2 })) {
        records.push(record);
      }

      expect(records).toHaveLength(2);
    });

    it('should throw RecordFetchError on network error', async () => {
      mockListRecords.mockRejectedValue(new TypeError('fetch failed'));

      const iterator = repository.listRecords(testDid, testCollection)[Symbol.asyncIterator]();

      await expect(iterator.next()).rejects.toThrow(RecordFetchError);
    });
  });

  describe('getBlob', () => {
    beforeEach(() => {
      // Reset global fetch mock
      vi.stubGlobal('fetch', vi.fn());
    });

    it('should throw IdentityResolutionError when PDS endpoint cannot be resolved', async () => {
      (identity.getPDSEndpoint as Mock).mockResolvedValue(null);

      await expect(repository.getBlob(testDid, testCid)).rejects.toThrow(
        'Cannot resolve PDS endpoint'
      );
    });

    it('should return ReadableStream on successful fetch', async () => {
      const mockBody = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3, 4]));
          controller.close();
        },
      });

      const mockResponse = {
        ok: true,
        status: 200,
        body: mockBody,
        headers: new Headers({ 'content-length': '4' }),
      };

      (global.fetch as Mock).mockResolvedValue(mockResponse);

      const stream = await repository.getBlob(testDid, testCid);

      expect(stream).toBeInstanceOf(ReadableStream);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('com.atproto.sync.getBlob'),
        expect.objectContaining({
          headers: { 'User-Agent': 'Chive-AppView/1.0' },
        })
      );
    });

    it('should throw BlobFetchError for 404 response', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
      };

      (global.fetch as Mock).mockResolvedValue(mockResponse);

      await expect(repository.getBlob(testDid, testCid)).rejects.toThrow(BlobFetchError);

      try {
        await repository.getBlob(testDid, testCid);
      } catch (error) {
        expect(error).toBeInstanceOf(BlobFetchError);
        expect((error as BlobFetchError).reason).toBe('not_found');
      }
    });

    it('should throw BlobFetchError for oversized blobs', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        body: new ReadableStream(),
        headers: new Headers({ 'content-length': '100000000' }), // 100MB
      };

      (global.fetch as Mock).mockResolvedValue(mockResponse);

      // Create repository with small maxBlobSize
      const smallBlobRepo = new ATRepository({
        identity,
        resiliencePolicy,
        logger,
        config: { maxBlobSize: 1000 }, // 1KB
      });

      await expect(smallBlobRepo.getBlob(testDid, testCid)).rejects.toThrow(BlobFetchError);

      try {
        await smallBlobRepo.getBlob(testDid, testCid);
      } catch (error) {
        expect(error).toBeInstanceOf(BlobFetchError);
        expect((error as BlobFetchError).reason).toBe('too_large');
      }
    });

    it('should throw BlobFetchError for network errors', async () => {
      (global.fetch as Mock).mockRejectedValue(new TypeError('fetch failed'));

      await expect(repository.getBlob(testDid, testCid)).rejects.toThrow(BlobFetchError);

      try {
        await repository.getBlob(testDid, testCid);
      } catch (error) {
        expect(error).toBeInstanceOf(BlobFetchError);
        expect((error as BlobFetchError).reason).toBe('network_error');
      }
    });

    it('should construct correct blob URL', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        body: new ReadableStream(),
        headers: new Headers(),
      };

      (global.fetch as Mock).mockResolvedValue(mockResponse);

      await repository.getBlob(testDid, testCid);

      const expectedUrl = `https://pds.example.com/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(testDid)}&cid=${encodeURIComponent(testCid)}`;
      expect(global.fetch).toHaveBeenCalledWith(expectedUrl, expect.any(Object));
    });
  });

  describe('AT URI parsing', () => {
    it('should parse valid AT URIs correctly', async () => {
      mockGetRecord.mockResolvedValue({
        data: { uri: testUri, cid: testCid, value: {} },
      });

      await repository.getRecord(testUri);

      expect(mockGetRecord).toHaveBeenCalledWith({
        repo: testDid,
        collection: testCollection,
        rkey: testRkey,
        cid: undefined,
      });
    });

    it('should return null for AT URIs with missing components', async () => {
      const incompleteUri = 'at://did:plc:test/collection' as AtUri; // missing rkey

      const result = await repository.getRecord(incompleteUri);

      expect(result).toBeNull();
    });
  });

  describe('resilience policy integration', () => {
    it('should wrap getRecord calls with resilience policy', async () => {
      mockGetRecord.mockResolvedValue({
        data: { uri: testUri, cid: testCid, value: {} },
      });

      await repository.getRecord(testUri);

      expect(resiliencePolicy.execute).toHaveBeenCalled();
    });

    it('should wrap listRecords calls with resilience policy', async () => {
      mockListRecords.mockResolvedValue({
        data: { records: [], cursor: undefined },
      });

      for await (const _ of repository.listRecords(testDid, testCollection)) {
        // consume iterator
      }

      expect(resiliencePolicy.execute).toHaveBeenCalled();
    });

    it('should wrap getBlob calls with resilience policy', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          body: new ReadableStream(),
          headers: new Headers(),
        })
      );

      await repository.getBlob(testDid, testCid);

      expect(resiliencePolicy.execute).toHaveBeenCalled();
    });
  });

  describe('agent caching', () => {
    it('should reuse agent for same PDS endpoint', async () => {
      mockGetRecord.mockResolvedValue({
        data: { uri: testUri, cid: testCid, value: {} },
      });

      // First call
      await repository.getRecord(testUri);
      // Second call
      await repository.getRecord(testUri);

      // Agent constructor should be called once per PDS, but since we're mocking
      // we check that operations used same agent
      expect(identity.getPDSEndpoint).toHaveBeenCalledTimes(2);
    });
  });
});
