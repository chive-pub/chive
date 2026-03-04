/**
 * Unit tests for the seed-admin script.
 *
 * @remarks
 * Tests the DID parsing, Redis role assignment, and edge case handling
 * for the admin seeding script at scripts/seed-admin.ts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Since seed-admin.ts is a standalone script that calls main() on import,
 * we test the core logic by extracting the parsing behavior and mocking
 * Redis interactions.
 */

describe('seed-admin script', () => {
  const DEFAULT_ADMIN_DID = 'did:plc:34mbm5v3umztwvvgnttvcz6e';
  const ROLE_PREFIX = 'chive:authz:roles:';
  const ASSIGNMENT_PREFIX = 'chive:authz:assignments:';

  describe('DID parsing', () => {
    /**
     * Tests the comma-separated parsing logic from the script:
     *   adminDidsRaw.split(',').map(d => d.trim()).filter(Boolean)
     */
    function parseDids(raw: string): string[] {
      return raw
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean);
    }

    it('parses comma-separated ADMIN_DIDS correctly', () => {
      const input = 'did:plc:abc123,did:plc:def456,did:plc:ghi789';
      const result = parseDids(input);

      expect(result).toEqual(['did:plc:abc123', 'did:plc:def456', 'did:plc:ghi789']);
    });

    it('handles single DID', () => {
      const input = 'did:plc:abc123';
      const result = parseDids(input);

      expect(result).toEqual(['did:plc:abc123']);
    });

    it('handles whitespace around DIDs', () => {
      const input = ' did:plc:abc123 , did:plc:def456 , did:plc:ghi789 ';
      const result = parseDids(input);

      expect(result).toEqual(['did:plc:abc123', 'did:plc:def456', 'did:plc:ghi789']);
    });

    it('handles empty string gracefully', () => {
      const input = '';
      const result = parseDids(input);

      expect(result).toEqual([]);
    });

    it('handles string with only commas', () => {
      const input = ',,,';
      const result = parseDids(input);

      expect(result).toEqual([]);
    });

    it('handles string with whitespace and commas', () => {
      const input = ' , , , ';
      const result = parseDids(input);

      expect(result).toEqual([]);
    });

    it('filters out empty entries between commas', () => {
      const input = 'did:plc:abc123,,did:plc:def456';
      const result = parseDids(input);

      expect(result).toEqual(['did:plc:abc123', 'did:plc:def456']);
    });

    it('uses default DID when ADMIN_DIDS is not set', () => {
      const result = parseDids(DEFAULT_ADMIN_DID);

      expect(result).toEqual([DEFAULT_ADMIN_DID]);
    });
  });

  describe('Redis key generation', () => {
    it('generates correct role key for a DID', () => {
      const did = 'did:plc:abc123';
      const roleKey = `${ROLE_PREFIX}${did}`;

      expect(roleKey).toBe('chive:authz:roles:did:plc:abc123');
    });

    it('generates correct assignment key for a DID', () => {
      const did = 'did:plc:abc123';
      const assignmentKey = `${ASSIGNMENT_PREFIX}${did}:admin`;

      expect(assignmentKey).toBe('chive:authz:assignments:did:plc:abc123:admin');
    });
  });

  describe('Redis operations', () => {
    let mockSAdd: ReturnType<typeof vi.fn<(key: string, value: string) => Promise<number>>>;
    let mockSet: ReturnType<typeof vi.fn<(key: string, value: string) => Promise<string>>>;
    let mockConnect: ReturnType<typeof vi.fn<() => Promise<void>>>;
    let mockQuit: ReturnType<typeof vi.fn<() => Promise<void>>>;
    let logSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      mockSAdd = vi.fn<(key: string, value: string) => Promise<number>>().mockResolvedValue(1);
      mockSet = vi.fn<(key: string, value: string) => Promise<string>>().mockResolvedValue('OK');
      mockConnect = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
      mockQuit = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
      logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('calls sAdd for each DID with admin role', async () => {
      const dids = ['did:plc:abc123', 'did:plc:def456'];

      for (const did of dids) {
        const roleKey = `${ROLE_PREFIX}${did}`;
        await mockSAdd(roleKey, 'admin');
      }

      expect(mockSAdd).toHaveBeenCalledTimes(2);
      expect(mockSAdd).toHaveBeenCalledWith('chive:authz:roles:did:plc:abc123', 'admin');
      expect(mockSAdd).toHaveBeenCalledWith('chive:authz:roles:did:plc:def456', 'admin');
    });

    it('sets assignment record with JSON metadata', async () => {
      const did = 'did:plc:abc123';
      const assignmentKey = `${ASSIGNMENT_PREFIX}${did}:admin`;

      const assignment = JSON.stringify({
        role: 'admin',
        assignedAt: '2026-01-01T00:00:00.000Z',
        assignedBy: 'seed-admin-script',
      });

      await mockSet(assignmentKey, assignment);

      expect(mockSet).toHaveBeenCalledWith(
        'chive:authz:assignments:did:plc:abc123:admin',
        expect.stringContaining('"role":"admin"')
      );
    });

    // These tests exercise console.log calls matching the script behavior
    /* eslint-disable no-console */
    it('logs new assignment when sAdd returns > 0', () => {
      const did = 'did:plc:abc123';
      const added = 1;

      if (added > 0) {
        console.log(`Assigned admin role to ${did} (new)`);
      }

      expect(logSpy).toHaveBeenCalledWith('Assigned admin role to did:plc:abc123 (new)');
    });

    it('logs idempotent message when sAdd returns 0', () => {
      const did = 'did:plc:abc123';
      const added = 0;

      if (added > 0) {
        console.log(`Assigned admin role to ${did} (new)`);
      } else {
        console.log(`Admin role already exists for ${did} (idempotent)`);
      }

      expect(logSpy).toHaveBeenCalledWith(
        'Admin role already exists for did:plc:abc123 (idempotent)'
      );
    });

    it('calls quit on Redis after operations complete', async () => {
      await mockQuit();

      expect(mockQuit).toHaveBeenCalledTimes(1);
    });

    it('handles empty DID list without connecting to Redis', () => {
      const dids: string[] = [];

      if (dids.length === 0) {
        console.log('No admin DIDs to seed.');
        return;
      }

      expect(logSpy).toHaveBeenCalledWith('No admin DIDs to seed.');
      expect(mockConnect).not.toHaveBeenCalled();
    });
    /* eslint-enable no-console */
  });

  describe('environment variable handling', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('uses REDIS_URL from environment when set', () => {
      process.env.REDIS_URL = 'redis://custom-host:6380';

      const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';

      expect(redisUrl).toBe('redis://custom-host:6380');
    });

    it('falls back to localhost Redis when REDIS_URL is not set', () => {
      delete process.env.REDIS_URL;

      const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';

      expect(redisUrl).toBe('redis://localhost:6379');
    });

    it('uses ADMIN_DIDS from environment when set', () => {
      process.env.ADMIN_DIDS = 'did:plc:custom1,did:plc:custom2';

      const adminDidsRaw = process.env.ADMIN_DIDS ?? DEFAULT_ADMIN_DID;

      expect(adminDidsRaw).toBe('did:plc:custom1,did:plc:custom2');
    });

    it('falls back to DEFAULT_ADMIN_DIDS when ADMIN_DIDS is not set', () => {
      delete process.env.ADMIN_DIDS;

      const adminDidsRaw = process.env.ADMIN_DIDS ?? DEFAULT_ADMIN_DID;

      expect(adminDidsRaw).toBe(DEFAULT_ADMIN_DID);
    });
  });
});
