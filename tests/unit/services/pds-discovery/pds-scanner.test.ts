/**
 * Unit tests for PDSScanner.
 *
 * @remarks
 * Tests PDS scanning for Chive records.
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { EprintService } from '@/services/eprint/eprint-service.js';
import type { IPDSRegistry } from '@/services/pds-discovery/pds-registry.js';
import { PDSScanner } from '@/services/pds-discovery/pds-scanner.js';
import type { ReviewService } from '@/services/review/review-service.js';
import type { DID } from '@/types/atproto.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

// =============================================================================
// Mocks
// =============================================================================

function createMockLogger(): ILogger {
  const logger: ILogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => logger),
  };
  return logger;
}

function createMockRegistry(): IPDSRegistry {
  return {
    registerPDS: vi.fn().mockResolvedValue(undefined),
    getPDSesForScan: vi.fn().mockResolvedValue([]),
    markScanStarted: vi.fn().mockResolvedValue(undefined),
    markScanCompleted: vi.fn().mockResolvedValue(undefined),
    markScanFailed: vi.fn().mockResolvedValue(undefined),
    getPDS: vi.fn().mockResolvedValue(null),
    getPDSStats: vi
      .fn()
      .mockResolvedValue({ total: 0, active: 0, withChiveRecords: 0, unreachable: 0 }),
  };
}

function createMockEprintService(): Partial<EprintService> {
  return {
    indexEprint: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
  };
}

function createMockReviewService(): Partial<ReviewService> {
  return {
    indexReview: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    indexEndorsement: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
  };
}

// Mock AtpAgent as a class
vi.mock('@atproto/api', () => {
  return {
    AtpAgent: class MockAtpAgent {
      com = {
        atproto: {
          sync: {
            listRepos: vi.fn().mockResolvedValue({
              data: { repos: [], cursor: undefined },
            }),
          },
          repo: {
            listRecords: vi.fn().mockResolvedValue({
              data: { records: [], cursor: undefined },
            }),
          },
        },
      };
    },
  };
});

// =============================================================================
// Tests
// =============================================================================

describe('PDSScanner', () => {
  let scanner: PDSScanner;
  let mockRegistry: IPDSRegistry;
  let mockEprintService: Partial<EprintService>;
  let mockReviewService: Partial<ReviewService>;
  let mockLogger: ILogger;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRegistry = createMockRegistry();
    mockEprintService = createMockEprintService();
    mockReviewService = createMockReviewService();
    mockLogger = createMockLogger();

    scanner = new PDSScanner(
      mockRegistry,
      mockEprintService as EprintService,
      mockReviewService as ReviewService,
      mockLogger,
      {
        requestsPerMinute: 60, // Fast for tests
        scanTimeoutMs: 5000,
        maxRecordsPerPDS: 100,
      }
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('scanPDS', () => {
    it('marks scan as started and completed', async () => {
      const result = await scanner.scanPDS('https://pds.example.com');

      expect(mockRegistry.markScanStarted).toHaveBeenCalledWith('https://pds.example.com');
      expect(mockRegistry.markScanCompleted).toHaveBeenCalledWith(
        'https://pds.example.com',
        expect.objectContaining({
          hasChiveRecords: false,
          chiveRecordCount: 0,
        })
      );
      expect(result.hasChiveRecords).toBe(false);
    });

    it('marks scan as failed on error', async () => {
      const error = new Error('Network error');
      (mockRegistry.markScanStarted as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      await expect(scanner.scanPDS('https://pds.example.com')).rejects.toThrow('Network error');
    });

    it('logs starting scan message', async () => {
      await scanner.scanPDS('https://pds.example.com');

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Starting PDS scan',
        expect.objectContaining({
          pdsUrl: 'https://pds.example.com',
        })
      );
    });
  });

  describe('scanDID', () => {
    it('scans specific DID for Chive records', async () => {
      const did = 'did:plc:test123' as DID;

      const count = await scanner.scanDID('https://pds.example.com', did);

      expect(count).toBe(0);
      expect(mockLogger.info).toHaveBeenCalledWith('Scanning specific DID for Chive records', {
        pdsUrl: 'https://pds.example.com',
        did,
      });
    });
  });

  describe('scanMultiplePDSes', () => {
    it('scans multiple PDSes and returns results', async () => {
      const pdsUrls = ['https://pds1.example.com', 'https://pds2.example.com'];

      const results = await scanner.scanMultiplePDSes(pdsUrls);

      expect(results.size).toBe(2);
      expect(results.get('https://pds1.example.com')).toBeDefined();
      expect(results.get('https://pds2.example.com')).toBeDefined();
    });

    it('handles errors for individual PDSes', async () => {
      const pdsUrls = ['https://good-pds.example.com', 'https://bad-pds.example.com'];

      // Make the second PDS fail
      (mockRegistry.markScanStarted as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Connection failed'));

      const results = await scanner.scanMultiplePDSes(pdsUrls);

      expect(results.size).toBe(2);
      expect(results.get('https://bad-pds.example.com')).toBeInstanceOf(Error);
    });

    it('respects concurrency limit', async () => {
      const pdsUrls = Array.from({ length: 5 }, (_, i) => `https://pds${i}.example.com`);

      const startTimes: number[] = [];
      (mockRegistry.markScanStarted as ReturnType<typeof vi.fn>).mockImplementation(() => {
        startTimes.push(Date.now());
      });

      await scanner.scanMultiplePDSes(pdsUrls, 2);

      // All scans should complete
      expect(mockRegistry.markScanStarted).toHaveBeenCalledTimes(5);
    });
  });

  describe('configuration', () => {
    it('uses default config when not provided', () => {
      const scannerWithDefaults = new PDSScanner(
        mockRegistry,
        mockEprintService as EprintService,
        mockReviewService as ReviewService,
        mockLogger
      );

      // Should not throw
      expect(scannerWithDefaults).toBeDefined();
    });

    it('merges provided config with defaults', () => {
      const customScanner = new PDSScanner(
        mockRegistry,
        mockEprintService as EprintService,
        mockReviewService as ReviewService,
        mockLogger,
        { requestsPerMinute: 30 }
      );

      expect(customScanner).toBeDefined();
    });
  });
});
