/**
 * Unit tests for PDSRegistry.
 *
 * @remarks
 * Tests PDS registration, scanning queue management, and relay connectivity filtering.
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  PDSRegistry,
  isRelayConnectedPDSSync,
  type DiscoverySource,
  type ScanResult,
} from '@/services/pds-discovery/pds-registry.js';
import type { RelayHostTracker } from '@/services/pds-discovery/relay-host-tracker.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

// =============================================================================
// Mocks
// =============================================================================

interface MockPool {
  query: ReturnType<typeof vi.fn>;
}

function createMockPool(): MockPool {
  return {
    query: vi.fn(),
  };
}

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

function createMockRelayHostTracker(): Partial<RelayHostTracker> {
  return {
    isRelayConnected: vi.fn().mockResolvedValue(false),
    getRelayHosts: vi.fn().mockResolvedValue([]),
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('isRelayConnectedPDSSync', () => {
  it('returns true for .host.bsky.network domains', () => {
    expect(isRelayConnectedPDSSync('https://amanita.us-east.host.bsky.network')).toBe(true);
    expect(isRelayConnectedPDSSync('https://phellinus.us-west.host.bsky.network')).toBe(true);
    expect(isRelayConnectedPDSSync('https://morel.us-west.host.bsky.network')).toBe(true);
  });

  it('returns true for bsky.social', () => {
    expect(isRelayConnectedPDSSync('https://bsky.social')).toBe(true);
  });

  it('returns true for .bsky.network domains', () => {
    expect(isRelayConnectedPDSSync('https://relay1.us-east.bsky.network')).toBe(true);
  });

  it('returns false for non-Bluesky domains', () => {
    expect(isRelayConnectedPDSSync('https://custom-pds.example.com')).toBe(false);
    expect(isRelayConnectedPDSSync('https://pds.other-network.social')).toBe(false);
  });

  it('returns false for invalid URLs', () => {
    expect(isRelayConnectedPDSSync('not-a-url')).toBe(false);
    expect(isRelayConnectedPDSSync('')).toBe(false);
  });
});

describe('PDSRegistry', () => {
  let registry: PDSRegistry;
  let mockPool: MockPool;
  let mockLogger: ILogger;
  let mockRelayHostTracker: Partial<RelayHostTracker>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPool = createMockPool();
    mockLogger = createMockLogger();
    mockRelayHostTracker = createMockRelayHostTracker();

    registry = new PDSRegistry(
      mockPool as unknown as import('pg').Pool,
      mockLogger,
      mockRelayHostTracker as RelayHostTracker
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('registerPDS', () => {
    it('registers a new PDS with relay connectivity check', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      (mockRelayHostTracker.isRelayConnected as ReturnType<typeof vi.fn>).mockResolvedValue(false);

      await registry.registerPDS('https://custom-pds.example.com', 'user_registration');

      expect(mockRelayHostTracker.isRelayConnected).toHaveBeenCalledWith(
        'https://custom-pds.example.com'
      );
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO pds_registry'),
        ['https://custom-pds.example.com', 'user_registration', false]
      );
    });

    it('normalizes URL by removing trailing slash', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      (mockRelayHostTracker.isRelayConnected as ReturnType<typeof vi.fn>).mockResolvedValue(false);

      await registry.registerPDS('https://pds.example.com/', 'user_registration');

      expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), [
        'https://pds.example.com',
        'user_registration',
        false,
      ]);
    });

    it('marks relay-connected PDSes correctly', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      (mockRelayHostTracker.isRelayConnected as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      await registry.registerPDS('https://amanita.us-east.host.bsky.network', 'plc_enumeration');

      expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), [
        'https://amanita.us-east.host.bsky.network',
        'plc_enumeration',
        true,
      ]);
    });

    it('falls back to pattern matching when tracker fails', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      (mockRelayHostTracker.isRelayConnected as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Redis error')
      );

      await registry.registerPDS('https://amanita.us-east.host.bsky.network', 'user_registration');

      // Should use pattern fallback and detect as relay-connected
      expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), [
        'https://amanita.us-east.host.bsky.network',
        'user_registration',
        true,
      ]);
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('getPDSesForScan', () => {
    it('only returns non-relay-connected PDSes', async () => {
      const mockRows = [
        {
          pds_url: 'https://custom-pds.example.com',
          discovered_at: new Date(),
          discovery_source: 'user_registration' as DiscoverySource,
          status: 'pending',
          last_scan_at: null,
          next_scan_at: null,
          has_chive_records: null,
          chive_record_count: 0,
          consecutive_failures: 0,
          scan_priority: 100,
          last_error: null,
          updated_at: new Date(),
          is_relay_connected: false,
        },
      ];

      mockPool.query.mockResolvedValue({ rows: mockRows });

      const result = await registry.getPDSesForScan(10);

      expect(result).toHaveLength(1);
      const firstResult = result[0];
      expect(firstResult).toBeDefined();
      if (firstResult) {
        expect(firstResult.pdsUrl).toBe('https://custom-pds.example.com');
        expect(firstResult.isRelayConnected).toBe(false);
      }

      // Verify query includes relay filter
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('is_relay_connected = FALSE'),
        [10]
      );
    });

    it('excludes PDSes with too many consecutive failures', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await registry.getPDSesForScan(10);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('consecutive_failures < 5'),
        [10]
      );
    });
  });

  describe('markScanCompleted', () => {
    it('updates PDS with scan results', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result: ScanResult = {
        hasChiveRecords: true,
        chiveRecordCount: 5,
        nextScanHours: 24,
      };

      await registry.markScanCompleted('https://pds.example.com', result);

      expect(mockPool.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE pds_registry'), [
        'https://pds.example.com',
        true,
        5,
        24,
      ]);
    });

    it('sets status to no_chive_records when none found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result: ScanResult = {
        hasChiveRecords: false,
        chiveRecordCount: 0,
      };

      await registry.markScanCompleted('https://pds.example.com', result);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("CASE WHEN $2 THEN 'active' ELSE 'no_chive_records' END"),
        expect.any(Array)
      );
    });
  });

  describe('markScanFailed', () => {
    it('increments consecutive failures', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await registry.markScanFailed('https://pds.example.com', 'Connection timeout');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('consecutive_failures = consecutive_failures + 1'),
        ['https://pds.example.com', 'Connection timeout']
      );
    });
  });

  describe('getPDS', () => {
    it('returns PDS entry when found', async () => {
      const mockRow = {
        pds_url: 'https://pds.example.com',
        discovered_at: new Date(),
        discovery_source: 'user_registration' as DiscoverySource,
        status: 'active',
        last_scan_at: new Date(),
        next_scan_at: new Date(),
        has_chive_records: true,
        chive_record_count: 10,
        consecutive_failures: 0,
        scan_priority: 100,
        last_error: null,
        updated_at: new Date(),
        is_relay_connected: false,
      };

      mockPool.query.mockResolvedValue({ rows: [mockRow] });

      const result = await registry.getPDS('https://pds.example.com');

      expect(result).toBeDefined();
      expect(result?.pdsUrl).toBe('https://pds.example.com');
      expect(result?.hasChiveRecords).toBe(true);
    });

    it('returns null when PDS not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await registry.getPDS('https://nonexistent.example.com');

      expect(result).toBeNull();
    });
  });

  describe('getPDSStats', () => {
    it('returns aggregated statistics', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          {
            total: '100',
            active: '50',
            with_chive_records: '25',
            unreachable: '10',
          },
        ],
      });

      const stats = await registry.getPDSStats();

      expect(stats).toEqual({
        total: 100,
        active: 50,
        withChiveRecords: 25,
        unreachable: 10,
      });
    });
  });

  describe('refreshRelayConnectivity', () => {
    it('updates relay connectivity status from tracker', async () => {
      (mockRelayHostTracker.getRelayHosts as ReturnType<typeof vi.fn>).mockResolvedValue([
        'host1.bsky.network',
        'host2.bsky.network',
      ]);

      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            { pds_url: 'https://host1.bsky.network', is_relay_connected: false },
            { pds_url: 'https://other.pds.com', is_relay_connected: false },
          ],
        })
        .mockResolvedValue({ rows: [] }); // For updates

      const updated = await registry.refreshRelayConnectivity();

      expect(updated).toBe(1); // Only host1 should be updated
      expect(mockPool.query).toHaveBeenCalledWith(
        'UPDATE pds_registry SET is_relay_connected = $1 WHERE pds_url = $2',
        [true, 'https://host1.bsky.network']
      );
    });

    it('returns 0 when tracker is not available', async () => {
      const registryWithoutTracker = new PDSRegistry(
        mockPool as unknown as import('pg').Pool,
        mockLogger
      );

      const updated = await registryWithoutTracker.refreshRelayConnectivity();

      expect(updated).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });
});
