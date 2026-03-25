/**
 * Unit tests for ContentReportService.
 *
 * @remarks
 * Tests report creation (including duplicate handling), content retrieval,
 * pending report listing, and status update functionality with a mock
 * PostgreSQL pool.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

import { ContentReportService } from '@/services/moderation/content-report-service.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

import { TEST_USER_DIDS } from '../../../test-constants.js';

// =============================================================================
// MOCKS
// =============================================================================

interface MockLogger extends ILogger {
  debugMock: ReturnType<typeof vi.fn>;
  infoMock: ReturnType<typeof vi.fn>;
  warnMock: ReturnType<typeof vi.fn>;
  errorMock: ReturnType<typeof vi.fn>;
}

interface MockPool {
  query: Mock;
}

const createMockLogger = (): MockLogger => {
  const debugMock = vi.fn();
  const infoMock = vi.fn();
  const warnMock = vi.fn();
  const errorMock = vi.fn();
  const logger: MockLogger = {
    debug: debugMock,
    info: infoMock,
    warn: warnMock,
    error: errorMock,
    child: vi.fn(function (this: void) {
      return logger;
    }),
    debugMock,
    infoMock,
    warnMock,
    errorMock,
  };
  return logger;
};

const createMockPool = (): MockPool => ({
  query: vi.fn(),
});

// =============================================================================
// TEST DATA
// =============================================================================

const REPORTER_DID = TEST_USER_DIDS.USER_1;
const ADMIN_DID = TEST_USER_DIDS.ADMIN;
const TARGET_URI = 'at://did:plc:author/pub.chive.eprint.submission/abc';
const TARGET_COLLECTION = 'pub.chive.eprint.submission';

const createReportRow = (overrides?: Record<string, unknown>): Record<string, unknown> => ({
  id: 1,
  reporter_did: REPORTER_DID,
  target_uri: TARGET_URI,
  target_collection: TARGET_COLLECTION,
  reason: 'spam',
  description: null,
  status: 'pending',
  reviewed_by: null,
  reviewed_at: null,
  created_at: new Date('2024-01-15T10:00:00Z'),
  ...overrides,
});

// =============================================================================
// TESTS
// =============================================================================

describe('ContentReportService', () => {
  let service: ContentReportService;
  let mockPool: MockPool;
  let mockLogger: MockLogger;

  beforeEach(() => {
    mockPool = createMockPool();
    mockLogger = createMockLogger();
    service = new ContentReportService(mockPool as never, mockLogger);
  });

  // ---------------------------------------------------------------------------
  // createReport
  // ---------------------------------------------------------------------------

  describe('createReport', () => {
    const input = {
      reporterDid: REPORTER_DID,
      targetUri: TARGET_URI,
      targetCollection: TARGET_COLLECTION,
      reason: 'spam' as const,
    };

    it('creates a report and returns it when insert succeeds', async () => {
      const row = createReportRow();
      mockPool.query.mockResolvedValueOnce({ rows: [row] });

      const result = await service.createReport(input);

      expect(result.id).toBe(1);
      expect(result.reporterDid).toBe(REPORTER_DID);
      expect(result.targetUri).toBe(TARGET_URI);
      expect(result.targetCollection).toBe(TARGET_COLLECTION);
      expect(result.reason).toBe('spam');
      expect(result.status).toBe('pending');
      expect(result.createdAt).toBe('2024-01-15T10:00:00.000Z');
    });

    it('returns existing report on duplicate', async () => {
      const existingRow = createReportRow({ id: 42 });
      // First query (INSERT) returns no rows (conflict)
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      // Second query (SELECT) returns the existing report
      mockPool.query.mockResolvedValueOnce({ rows: [existingRow] });

      const result = await service.createReport(input);

      expect(result.id).toBe(42);
      expect(mockPool.query).toHaveBeenCalledTimes(2);
    });

    it('throws if both insert and lookup fail', async () => {
      // INSERT returns no rows
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      // SELECT also returns no rows
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.createReport(input)).rejects.toThrow(
        'Content report insert and lookup both failed'
      );
    });

    it('passes correct parameters to the SQL query', async () => {
      const row = createReportRow();
      mockPool.query.mockResolvedValueOnce({ rows: [row] });

      const inputWithDescription = {
        ...input,
        description: 'This is spam content',
      };

      await service.createReport(inputWithDescription);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO content_reports'),
        [REPORTER_DID, TARGET_URI, TARGET_COLLECTION, 'spam', 'This is spam content']
      );
    });

    it('passes null description when not provided', async () => {
      const row = createReportRow();
      mockPool.query.mockResolvedValueOnce({ rows: [row] });

      await service.createReport(input);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO content_reports'),
        [REPORTER_DID, TARGET_URI, TARGET_COLLECTION, 'spam', null]
      );
    });

    it('logs on successful creation', async () => {
      const row = createReportRow();
      mockPool.query.mockResolvedValueOnce({ rows: [row] });

      await service.createReport(input);

      expect(mockLogger.infoMock).toHaveBeenCalledWith('Content report created', {
        reportId: 1,
        targetUri: TARGET_URI,
        reason: 'spam',
      });
    });

    it('logs on duplicate detection', async () => {
      const existingRow = createReportRow({ id: 42 });
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      mockPool.query.mockResolvedValueOnce({ rows: [existingRow] });

      await service.createReport(input);

      expect(mockLogger.infoMock).toHaveBeenCalledWith(
        'Duplicate content report, returning existing',
        {
          targetUri: TARGET_URI,
          reporterDid: REPORTER_DID,
        }
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getReportsForContent
  // ---------------------------------------------------------------------------

  describe('getReportsForContent', () => {
    it('returns reports for a target URI', async () => {
      const rows = [createReportRow({ id: 2, reason: 'copyright' }), createReportRow({ id: 1 })];
      mockPool.query.mockResolvedValueOnce({ rows });

      const result = await service.getReportsForContent(TARGET_URI);

      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe(2);
      expect(result[1]?.id).toBe(1);
    });

    it('returns empty array when no reports exist', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getReportsForContent(TARGET_URI);

      expect(result).toEqual([]);
    });

    it('orders by created_at DESC', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await service.getReportsForContent(TARGET_URI);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        [TARGET_URI]
      );
    });
  });

  // ---------------------------------------------------------------------------
  // listPendingReports
  // ---------------------------------------------------------------------------

  describe('listPendingReports', () => {
    it('returns paginated pending reports with total count', async () => {
      const rows = [createReportRow(), createReportRow({ id: 2 })];
      // COUNT query
      mockPool.query.mockResolvedValueOnce({ rows: [{ total: 5 }] });
      // DATA query
      mockPool.query.mockResolvedValueOnce({ rows });

      const result = await service.listPendingReports(10, 0);

      expect(result.total).toBe(5);
      expect(result.reports).toHaveLength(2);
    });

    it('uses default limit and offset', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ total: 0 }] });
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await service.listPendingReports();

      // The second call is the data query with limit/offset
      const dataCall = mockPool.query.mock.calls[1];
      expect(dataCall).toBeDefined();
      expect(dataCall?.[1]).toEqual([50, 0]);
    });

    it('passes custom limit and offset', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ total: 0 }] });
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await service.listPendingReports(25, 10);

      const dataCall = mockPool.query.mock.calls[1];
      expect(dataCall).toBeDefined();
      expect(dataCall?.[1]).toEqual([25, 10]);
    });
  });

  // ---------------------------------------------------------------------------
  // updateReportStatus
  // ---------------------------------------------------------------------------

  describe('updateReportStatus', () => {
    it('updates and returns the report', async () => {
      const updatedRow = createReportRow({
        status: 'reviewed',
        reviewed_by: ADMIN_DID,
        reviewed_at: new Date('2024-01-16T12:00:00Z'),
      });
      mockPool.query.mockResolvedValueOnce({ rows: [updatedRow] });

      const result = await service.updateReportStatus(1, 'reviewed', ADMIN_DID);

      expect(result).not.toBeNull();
      expect(result?.status).toBe('reviewed');
      expect(result?.reviewedBy).toBe(ADMIN_DID);
      expect(result?.reviewedAt).toBe('2024-01-16T12:00:00.000Z');
    });

    it('returns null when report not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.updateReportStatus(999, 'reviewed', ADMIN_DID);

      expect(result).toBeNull();
    });

    it('sets reviewed_by and reviewed_at', async () => {
      const updatedRow = createReportRow({
        status: 'actioned',
        reviewed_by: ADMIN_DID,
        reviewed_at: new Date('2024-01-16T12:00:00Z'),
      });
      mockPool.query.mockResolvedValueOnce({ rows: [updatedRow] });

      await service.updateReportStatus(1, 'actioned', ADMIN_DID);

      expect(mockPool.query).toHaveBeenCalledWith(expect.stringContaining('reviewed_by = $2'), [
        'actioned',
        ADMIN_DID,
        1,
      ]);
    });

    it('logs warning when not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await service.updateReportStatus(999, 'reviewed', ADMIN_DID);

      expect(mockLogger.warnMock).toHaveBeenCalledWith(
        'Content report not found for status update',
        { id: 999, status: 'reviewed' }
      );
    });
  });
});
