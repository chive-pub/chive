/**
 * Unit tests for RelayHostTracker.
 *
 * @remarks
 * Tests relay connectivity detection via com.atproto.sync.listHosts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  RelayHostTracker,
  type RelayHostTrackerOptions,
} from '@/services/pds-discovery/relay-host-tracker.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

// =============================================================================
// Mocks
// =============================================================================

interface MockPipeline {
  del: ReturnType<typeof vi.fn>;
  sadd: ReturnType<typeof vi.fn>;
  expire: ReturnType<typeof vi.fn>;
  exec: ReturnType<typeof vi.fn>;
}

interface MockRedis {
  sismember: ReturnType<typeof vi.fn>;
  smembers: ReturnType<typeof vi.fn>;
  exists: ReturnType<typeof vi.fn>;
  pipeline: () => MockPipeline;
}

function createMockRedis(): MockRedis {
  const pipelineObj: MockPipeline = {
    del: vi.fn().mockReturnThis(),
    sadd: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
  };

  return {
    sismember: vi.fn().mockResolvedValue(0),
    smembers: vi.fn().mockResolvedValue([]),
    exists: vi.fn().mockResolvedValue(0),
    pipeline: () => pipelineObj,
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

// =============================================================================
// Tests
// =============================================================================

describe('RelayHostTracker', () => {
  let tracker: RelayHostTracker;
  let mockRedis: MockRedis;
  let mockLogger: ILogger;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis = createMockRedis();
    mockLogger = createMockLogger();

    tracker = new RelayHostTracker({
      redis: mockRedis as unknown as RelayHostTrackerOptions['redis'],
      logger: mockLogger,
      config: {
        relayUrl: 'https://test-relay.example.com',
        cacheTtlSeconds: 3600,
        timeoutMs: 5000,
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('isRelayConnected', () => {
    it('returns true for cached relay-connected hosts', async () => {
      mockRedis.sismember.mockResolvedValue(1);

      const result = await tracker.isRelayConnected('https://amanita.us-east.host.bsky.network');

      expect(result).toBe(true);
      expect(mockRedis.sismember).toHaveBeenCalledWith(
        'chive:relay:hosts:set',
        'amanita.us-east.host.bsky.network'
      );
    });

    it('returns false for non-cached hosts when cache exists', async () => {
      mockRedis.sismember.mockResolvedValue(0);
      mockRedis.exists.mockResolvedValue(1); // Cache exists

      const result = await tracker.isRelayConnected('https://custom-pds.example.com');

      expect(result).toBe(false);
    });

    it('extracts hostname from URL correctly', async () => {
      mockRedis.sismember.mockResolvedValue(1);

      await tracker.isRelayConnected('https://some.pds.network:443/path');

      expect(mockRedis.sismember).toHaveBeenCalledWith('chive:relay:hosts:set', 'some.pds.network');
    });

    it('returns false for invalid URLs', async () => {
      const result = await tracker.isRelayConnected('not-a-valid-url');

      expect(result).toBe(false);
      expect(mockRedis.sismember).not.toHaveBeenCalled();
    });

    it('refreshes cache when cache does not exist', async () => {
      mockRedis.sismember.mockResolvedValue(0);
      mockRedis.exists.mockResolvedValue(0); // Cache doesn't exist

      // Mock fetch for refresh
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          hosts: [
            {
              hostname: 'amanita.us-east.host.bsky.network',
              status: 'active',
              accountCount: 100,
              seq: 1,
            },
          ],
          cursor: undefined,
        }),
      });

      await tracker.isRelayConnected('https://amanita.us-east.host.bsky.network');

      // Should have called fetch to refresh
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('getRelayHosts', () => {
    it('returns cached hosts', async () => {
      const hosts = ['host1.bsky.network', 'host2.bsky.network'];
      mockRedis.exists.mockResolvedValue(1);
      mockRedis.smembers.mockResolvedValue(hosts);

      const result = await tracker.getRelayHosts();

      expect(result).toEqual(hosts);
    });

    it('refreshes and returns hosts when cache is empty', async () => {
      mockRedis.exists.mockResolvedValue(0);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          hosts: [
            { hostname: 'host1.bsky.network', status: 'active', accountCount: 100, seq: 1 },
            { hostname: 'host2.bsky.network', status: 'active', accountCount: 200, seq: 2 },
          ],
        }),
      });

      // After refresh, smembers will be called
      mockRedis.smembers.mockResolvedValue(['host1.bsky.network', 'host2.bsky.network']);

      const result = await tracker.getRelayHosts();

      expect(result).toEqual(['host1.bsky.network', 'host2.bsky.network']);
    });
  });

  describe('refresh', () => {
    it('fetches all pages of hosts', async () => {
      const page1 = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          hosts: [{ hostname: 'host1.bsky.network', status: 'active', accountCount: 100, seq: 1 }],
          cursor: 'page2',
        }),
      };

      const page2 = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          hosts: [{ hostname: 'host2.bsky.network', status: 'active', accountCount: 200, seq: 2 }],
          cursor: undefined,
        }),
      };

      global.fetch = vi.fn().mockResolvedValueOnce(page1).mockResolvedValueOnce(page2);

      await tracker.refresh();

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Relay host list refreshed',
        expect.objectContaining({ hostCount: 2 })
      );
    });

    it('only includes active hosts', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          hosts: [
            { hostname: 'active.host', status: 'active', accountCount: 100, seq: 1 },
            { hostname: 'offline.host', status: 'offline', accountCount: 0, seq: 2 },
            { hostname: 'idle.host', status: 'idle', accountCount: 50, seq: 3 },
          ],
        }),
      });

      await tracker.refresh();

      const pipeline = mockRedis.pipeline();
      expect(pipeline.sadd).toHaveBeenCalledWith('chive:relay:hosts:set', 'active.host');
    });

    it('handles fetch errors gracefully', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(tracker.refresh()).rejects.toThrow('Network error');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('handles non-200 responses', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(tracker.refresh()).rejects.toThrow('Failed to fetch relay hosts');
    });
  });
});
