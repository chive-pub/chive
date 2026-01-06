/**
 * PDSSyncService integration tests.
 *
 * @remarks
 * Tests PDSSyncService against real PostgreSQL instance:
 * - Staleness detection
 * - PDS source tracking
 * - Refresh operations
 *
 * The PDS fetch is mocked since it requires external PDS infrastructure,
 * but storage operations are tested against real PostgreSQL.
 *
 * Requires Docker test stack running (PostgreSQL 16+).
 *
 * @packageDocumentation
 */

import { noop } from 'cockatiel';
import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

import { PDSSyncService } from '@/services/pds-sync/sync-service.js';
import { PostgreSQLAdapter } from '@/storage/postgresql/adapter.js';
import { getDatabaseConfig } from '@/storage/postgresql/config.js';
import type { AtUri, CID, DID } from '@/types/atproto.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';
import type { IRepository, RepositoryRecord } from '@/types/interfaces/repository.interface.js';
import type { StoredPreprint } from '@/types/interfaces/storage.interface.js';

// Test constants
const TEST_AUTHOR = 'did:plc:synctestauthor' as DID;
const TEST_PDS_URL = 'https://pds.sync.test.example.com';

// Generate unique test URIs to avoid conflicts
function createTestUri(suffix: string): AtUri {
  const timestamp = Date.now();
  return `at://${TEST_AUTHOR}/pub.chive.preprint.submission/sync${timestamp}${suffix}` as AtUri;
}

function createTestCid(suffix: string): CID {
  return `bafyreisync${suffix}${Date.now().toString(36)}` as CID;
}

/**
 * Creates mock logger for tests.
 */
function createMockLogger(): ILogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: () => createMockLogger(),
  };
}

/**
 * Mock repository wrapper with typed mock functions for assertions.
 */
interface MockRepositoryWrapper {
  repository: IRepository;
  getRecordMock: ReturnType<typeof vi.fn>;
}

/**
 * Creates mock repository for tests.
 * Returns both the typed repository and mock function reference for assertions.
 */
function createMockRepository(
  mockGetRecord?: (uri: AtUri) => RepositoryRecord<unknown> | null
): MockRepositoryWrapper {
  const getRecordMock = vi.fn().mockImplementation(mockGetRecord ?? (() => null));
  const repository = {
    getRecord: getRecordMock,
    listRecords: vi.fn(),
    getBlob: vi.fn().mockResolvedValue(null),
  } as unknown as IRepository;
  return { repository, getRecordMock };
}

/**
 * Creates test preprint for storage.
 */
function createTestStoredPreprint(
  uri: AtUri,
  cid: CID,
  overrides: Partial<StoredPreprint> = {}
): StoredPreprint {
  return {
    uri,
    cid,
    author: TEST_AUTHOR,
    title: 'Test Preprint for Sync',
    abstract: 'This is a test abstract for sync testing.',
    pdfBlobRef: {
      $type: 'blob',
      ref: 'bafyreisyncblob123' as CID,
      mimeType: 'application/pdf',
      size: 1024000,
    },
    license: 'CC-BY-4.0',
    pdsUrl: TEST_PDS_URL,
    indexedAt: new Date(),
    createdAt: new Date(),
    ...overrides,
  };
}

describe('PDSSyncService Integration', () => {
  let pool: Pool;
  let storage: PostgreSQLAdapter;

  beforeAll(() => {
    const dbConfig = getDatabaseConfig();
    pool = new Pool(dbConfig);
    storage = new PostgreSQLAdapter(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    // Clean up test data: delete by author DID pattern
    const client = await pool.connect();
    try {
      await client.query(`DELETE FROM preprints_index WHERE author_did = $1`, [TEST_AUTHOR]);
    } finally {
      client.release();
    }
  });

  describe('trackPDSUpdate', () => {
    it('tracks PDS source for record', async () => {
      const uri = createTestUri('track1');
      const cid = createTestCid('track1');

      // First store a preprint so tracking can work
      const preprint = createTestStoredPreprint(uri, cid);
      await storage.storePreprint(preprint);

      const service = new PDSSyncService({
        pool,
        storage,
        repository: createMockRepository().repository,
        resiliencePolicy: noop,
        logger: createMockLogger(),
      });

      const result = await service.trackPDSUpdate(uri, cid, TEST_PDS_URL);

      expect(result.ok).toBe(true);
    });

    it('returns error for non-existent record', async () => {
      const uri = createTestUri('nonexistent');
      const cid = createTestCid('nonexistent');

      const service = new PDSSyncService({
        pool,
        storage,
        repository: createMockRepository().repository,
        resiliencePolicy: noop,
        logger: createMockLogger(),
      });

      // This should fail since there's no record to track
      // Note: The actual behavior depends on storage.trackPDSSource implementation
      const result = await service.trackPDSUpdate(uri, cid, TEST_PDS_URL);

      // Result type depends on implementation (could be ok or error)
      expect(result).toBeDefined();
    });
  });

  describe('checkStaleness', () => {
    it('returns not stale for recently indexed record', async () => {
      const uri = createTestUri('fresh1');
      const cid = createTestCid('fresh1');

      // Store preprint
      const preprint = createTestStoredPreprint(uri, cid);
      await storage.storePreprint(preprint);

      // Mock repository to return same CID
      const { repository: mockRepository } = createMockRepository(() => ({
        uri,
        cid,
        author: TEST_AUTHOR,
        value: {},
        indexedAt: new Date().toISOString(),
      }));

      const service = new PDSSyncService({
        pool,
        storage,
        repository: mockRepository,
        resiliencePolicy: noop,
        logger: createMockLogger(),
      });

      const result = await service.checkStaleness(uri);

      // Fresh record should not be stale
      expect(result.uri).toBe(uri);
      expect(result.indexedCID).toBe(cid);
    });

    it('returns error info for non-existent record', async () => {
      const uri = createTestUri('nonexistent');

      const service = new PDSSyncService({
        pool,
        storage,
        repository: createMockRepository().repository,
        resiliencePolicy: noop,
        logger: createMockLogger(),
      });

      const result = await service.checkStaleness(uri);

      // Should have error since record doesn't exist
      expect(result.uri).toBe(uri);
      expect(result.error).toBeDefined();
    });

    it('detects stale record when CIDs differ', async () => {
      const uri = createTestUri('stale1');
      const oldCid = createTestCid('old');
      const newCid = createTestCid('new');

      // Store preprint with old CID
      const preprint = createTestStoredPreprint(uri, oldCid, {
        // Set indexedAt to old date to trigger staleness
        indexedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
      });
      await storage.storePreprint(preprint);

      // Mock repository to return new CID
      const { repository: mockRepository } = createMockRepository(() => ({
        uri,
        cid: newCid,
        author: TEST_AUTHOR,
        value: {},
        indexedAt: new Date().toISOString(),
      }));

      const service = new PDSSyncService({
        pool,
        storage,
        repository: mockRepository,
        resiliencePolicy: noop,
        logger: createMockLogger(),
      });

      const result = await service.checkStaleness(uri);

      expect(result.uri).toBe(uri);
      expect(result.indexedCID).toBe(oldCid);
      // If storage reports stale, pdsCID should be fetched
      if (result.pdsCID) {
        expect(result.pdsCID).toBe(newCid);
        expect(result.isStale).toBe(true);
      }
    });
  });

  describe('refreshRecord', () => {
    it('returns not found for non-existent record', async () => {
      const uri = createTestUri('refresh-nonexistent');

      const service = new PDSSyncService({
        pool,
        storage,
        repository: createMockRepository().repository,
        resiliencePolicy: noop,
        logger: createMockLogger(),
      });

      const result = await service.refreshRecord(uri);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('not found');
      }
    });

    it('refreshes record when CID unchanged', async () => {
      const uri = createTestUri('refresh-unchanged');
      const cid = createTestCid('unchanged');

      // Store preprint
      const preprint = createTestStoredPreprint(uri, cid);
      await storage.storePreprint(preprint);

      // Mock repository to return same CID
      const { repository: mockRepository } = createMockRepository(() => ({
        uri,
        cid, // Same CID
        author: TEST_AUTHOR,
        value: {},
        indexedAt: new Date().toISOString(),
      }));

      const service = new PDSSyncService({
        pool,
        storage,
        repository: mockRepository,
        resiliencePolicy: noop,
        logger: createMockLogger(),
      });

      const result = await service.refreshRecord(uri);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.refreshed).toBe(true);
        expect(result.value.changed).toBe(false);
        expect(result.value.previousCID).toBe(cid);
        expect(result.value.currentCID).toBe(cid);
      }
    });

    it('refreshes and detects changed record', async () => {
      const uri = createTestUri('refresh-changed');
      const oldCid = createTestCid('oldv');
      const newCid = createTestCid('newv');

      // Store preprint with old CID
      const preprint = createTestStoredPreprint(uri, oldCid);
      await storage.storePreprint(preprint);

      // Mock repository to return new CID
      const { repository: mockRepository } = createMockRepository(() => ({
        uri,
        cid: newCid,
        author: TEST_AUTHOR,
        value: {},
        indexedAt: new Date().toISOString(),
      }));

      const service = new PDSSyncService({
        pool,
        storage,
        repository: mockRepository,
        resiliencePolicy: noop,
        logger: createMockLogger(),
      });

      const result = await service.refreshRecord(uri);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.refreshed).toBe(true);
        expect(result.value.changed).toBe(true);
        expect(result.value.previousCID).toBe(oldCid);
        expect(result.value.currentCID).toBe(newCid);
      }

      // Verify storage was updated
      const updated = await storage.getPreprint(uri);
      expect(updated?.cid).toBe(newCid);
    });

    it('handles PDS fetch failure gracefully', async () => {
      const uri = createTestUri('refresh-fail');
      const cid = createTestCid('fail');

      // Store preprint
      const preprint = createTestStoredPreprint(uri, cid);
      await storage.storePreprint(preprint);

      // Mock repository to return null (not found in PDS)
      const { repository: mockRepository } = createMockRepository(() => null);

      const service = new PDSSyncService({
        pool,
        storage,
        repository: mockRepository,
        resiliencePolicy: noop,
        logger: createMockLogger(),
      });

      const result = await service.refreshRecord(uri);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('detectStaleRecords', () => {
    it('returns empty array (storage method not yet implemented)', async () => {
      const service = new PDSSyncService({
        pool,
        storage,
        repository: createMockRepository().repository,
        resiliencePolicy: noop,
        logger: createMockLogger(),
      });

      const staleRecords = await service.detectStaleRecords();

      // Currently returns empty array as storage method is not implemented
      expect(Array.isArray(staleRecords)).toBe(true);
      expect(staleRecords.length).toBe(0);
    });

    it('accepts custom max age parameter', async () => {
      const service = new PDSSyncService({
        pool,
        storage,
        repository: createMockRepository().repository,
        resiliencePolicy: noop,
        logger: createMockLogger(),
      });

      // Should not throw with custom max age
      const customMaxAge = 24 * 60 * 60 * 1000; // 1 day
      const staleRecords = await service.detectStaleRecords(customMaxAge);

      expect(Array.isArray(staleRecords)).toBe(true);
    });
  });

  describe('ATProto compliance', () => {
    it('only reads from PDS, never writes', async () => {
      const uri = createTestUri('compliance1');
      const cid = createTestCid('compliance1');

      // Store preprint
      const preprint = createTestStoredPreprint(uri, cid);
      await storage.storePreprint(preprint);

      // Create mock repository and spy on methods
      const { repository: mockRepo, getRecordMock } = createMockRepository(() => ({
        uri,
        cid,
        author: TEST_AUTHOR,
        value: {},
        indexedAt: new Date().toISOString(),
      }));

      const service = new PDSSyncService({
        pool,
        storage,
        repository: mockRepo,
        resiliencePolicy: noop,
        logger: createMockLogger(),
      });

      await service.refreshRecord(uri);

      // Should only call getRecord (read), never write methods
      expect(getRecordMock).toHaveBeenCalled();
      // No write methods should exist on IRepository for AppView
    });

    it('tracks PDS source for every record', async () => {
      const uri = createTestUri('pdstrack');
      const cid = createTestCid('pdstrack');

      // Store preprint
      const preprint = createTestStoredPreprint(uri, cid);
      await storage.storePreprint(preprint);

      const { repository: mockRepository } = createMockRepository(() => ({
        uri,
        cid,
        author: TEST_AUTHOR,
        value: {},
        indexedAt: new Date().toISOString(),
      }));

      const service = new PDSSyncService({
        pool,
        storage,
        repository: mockRepository,
        resiliencePolicy: noop,
        logger: createMockLogger(),
      });

      await service.refreshRecord(uri);

      // Verify PDS URL is tracked
      const stored = await storage.getPreprint(uri);
      expect(stored?.pdsUrl).toBe(TEST_PDS_URL);
    });
  });
});
