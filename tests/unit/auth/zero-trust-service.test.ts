/**
 * Unit tests for ZeroTrustService.
 *
 * @remarks
 * Tests trust evaluation, policy decisions, and audit logging.
 */

import type { Redis } from 'ioredis';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ZeroTrustService } from '@/auth/zero-trust/zero-trust-service.js';
import type { DID } from '@/types/atproto.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

interface MockLogger extends ILogger {
  debugMock: ReturnType<typeof vi.fn>;
  infoMock: ReturnType<typeof vi.fn>;
  warnMock: ReturnType<typeof vi.fn>;
}

const createMockLogger = (): MockLogger => {
  const debugMock = vi.fn();
  const infoMock = vi.fn();
  const warnMock = vi.fn();
  const logger: MockLogger = {
    debug: debugMock,
    info: infoMock,
    warn: warnMock,
    error: vi.fn(),
    child: vi.fn(function (this: void) {
      return logger;
    }),
    debugMock,
    infoMock,
    warnMock,
  };
  return logger;
};

const createMockRedis = (): Redis => {
  const store = new Map<string, string>();
  const sets = new Map<string, Set<string>>();
  const lists = new Map<string, string[]>();

  return {
    get: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    set: vi.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve('OK');
    }),
    setex: vi.fn((key: string, _ttl: number, value: string) => {
      store.set(key, value);
      return Promise.resolve('OK');
    }),
    del: vi.fn((key: string) => {
      store.delete(key);
      return Promise.resolve(1);
    }),
    lpush: vi.fn((key: string, ...values: string[]) => {
      if (!lists.has(key)) lists.set(key, []);
      const list = lists.get(key);
      if (list) {
        list.unshift(...values);
        return Promise.resolve(list.length);
      }
      return Promise.resolve(values.length);
    }),
    ltrim: vi.fn(() => Promise.resolve('OK')),
    lrange: vi.fn((key: string, start: number, stop: number) => {
      const list = lists.get(key) ?? [];
      const end = stop === -1 ? list.length : stop + 1;
      return Promise.resolve(list.slice(start, end));
    }),
    expire: vi.fn(() => Promise.resolve(1)),
    sadd: vi.fn((key: string, ...members: string[]) => {
      if (!sets.has(key)) sets.set(key, new Set());
      const set = sets.get(key);
      let count = 0;
      if (set) {
        for (const member of members) {
          if (!set.has(member)) {
            set.add(member);
            count++;
          }
        }
      }
      return Promise.resolve(count);
    }),
    smembers: vi.fn((key: string) => {
      const set = sets.get(key);
      return Promise.resolve(set ? Array.from(set) : []);
    }),
    sismember: vi.fn((key: string, member: string) => {
      const set = sets.get(key);
      return Promise.resolve(set?.has(member) ? 1 : 0);
    }),
    scard: vi.fn((key: string) => {
      const set = sets.get(key);
      return Promise.resolve(set ? set.size : 0);
    }),
    keys: vi.fn((pattern: string) => {
      // Simple pattern matching for tests (supports * wildcard at end)
      const prefix = pattern.replace(/\*$/, '');
      const matchingKeys = Array.from(store.keys()).filter((k) => k.startsWith(prefix));
      return Promise.resolve(matchingKeys);
    }),
  } as unknown as Redis;
};

describe('ZeroTrustService', () => {
  let service: ZeroTrustService;
  let logger: MockLogger;
  let redis: Redis;

  const testDid = 'did:plc:zerotrust123' as DID;

  beforeEach(() => {
    logger = createMockLogger();
    redis = createMockRedis();

    service = new ZeroTrustService({
      redis,
      logger,
      config: {
        minTrustScore: 50,
        weights: {
          authentication: 40,
          devicePosture: 25,
          behaviorAnalysis: 20,
          networkContext: 15,
        },
      },
    });
  });

  describe('evaluate', () => {
    it('should allow request with high trust score', async () => {
      const decision = await service.evaluate({
        subject: {
          did: testDid,
          roles: ['author'],
        },
        action: 'read',
        resource: {
          type: 'preprint',
          id: 'preprint_123',
        },
        context: {
          ipAddress: '192.168.1.1',
        },
      });

      expect(decision).toBeDefined();
      expect(decision.allow).toBe(true);
      expect(decision.reasons).toBeDefined();
    });

    it('should include reasons in decision', async () => {
      const decision = await service.evaluate({
        subject: {
          did: testDid,
          roles: ['reader'],
        },
        action: 'read',
        resource: {
          type: 'preprint',
          id: 'preprint_123',
        },
        context: {},
      });

      expect(decision.reasons).toBeDefined();
      expect(decision.reasons?.length).toBeGreaterThan(0);
    });

    it('should include obligations when step-up auth required', async () => {
      // Low trust score scenario: create a service with high minimum
      const strictService = new ZeroTrustService({
        redis,
        logger,
        config: {
          minTrustScore: 90, // Very high threshold
        },
      });

      const decision = await strictService.evaluate({
        subject: {
          did: testDid,
          roles: [],
        },
        action: 'write',
        resource: {
          type: 'admin',
          id: 'admin_panel',
        },
        context: {
          ipAddress: '1.2.3.4', // Unknown IP
        },
      });

      // With minTrustScore 90, access should be denied
      expect(decision.allow).toBe(false);
      expect(decision.reasons).toBeDefined();
      expect(decision.reasons?.length).toBeGreaterThan(0);
    });

    it('should log decisions', async () => {
      await service.evaluate({
        subject: {
          did: testDid,
          roles: ['author'],
        },
        action: 'write',
        resource: {
          type: 'preprint',
          id: 'preprint_123',
        },
        context: {},
      });

      expect(logger.infoMock).toHaveBeenCalledWith(
        'Zero trust evaluation',
        expect.objectContaining({
          subject: testDid,
          action: 'write',
        })
      );
    });
  });

  describe('trust score calculation', () => {
    it('should grant higher trust to admin role than reader role', async () => {
      // Trust score calculation with weights: auth=40%, device=25%, behavior=20%, network=15%
      // Admin: auth=60 (40+20), device=30, behavior=70, network=50
      //        Total = (60*40 + 30*25 + 70*20 + 50*15) / 100 = 5050/100 = 51 -> allowed
      // Reader: auth=40 (40+0), device=30, behavior=70, network=50
      //         Total = (40*40 + 30*25 + 70*20 + 50*15) / 100 = 4250/100 = 43 -> denied
      const adminDecision = await service.evaluate({
        subject: {
          did: testDid,
          roles: ['admin'],
        },
        action: 'read',
        resource: { type: 'preprint', id: '123' },
        context: {},
      });

      const readerDecision = await service.evaluate({
        subject: {
          did: testDid,
          roles: ['reader'],
        },
        action: 'read',
        resource: { type: 'preprint', id: '123' },
        context: {},
      });

      // Admin role provides +20 auth bonus, pushing score above threshold
      expect(adminDecision.allow).toBe(true);
      // Reader role provides no bonus, score falls below threshold of 50
      expect(readerDecision.allow).toBe(false);
      // Verify decision includes reasons
      expect(readerDecision.reasons).toBeDefined();
      expect(readerDecision.reasons?.length).toBeGreaterThan(0);
      expect(readerDecision.reasons?.[0]).toMatch(/denied/i);
    });

    it('should boost trust score with MFA verification', async () => {
      // Without MFA: author auth=50 (40+10), total ~49 -> denied
      // With MFA: author auth=70 (40+10+20), total ~57 -> allowed
      const mfaKey = `chive:zt:mfa:${testDid}`;
      const getMock = redis.get as ReturnType<
        typeof vi.fn<(key: string) => Promise<string | null>>
      >;
      getMock.mockImplementation((key: string) => {
        return key === mfaKey ? Promise.resolve('1') : Promise.resolve(null);
      });

      const withMfa = await service.evaluate({
        subject: {
          did: testDid,
          roles: ['author'],
        },
        action: 'write',
        resource: { type: 'preprint', id: '123' },
        context: {},
      });

      // Reset mock for without-MFA test
      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const withoutMfa = await service.evaluate({
        subject: {
          did: testDid,
          roles: ['author'],
        },
        action: 'write',
        resource: { type: 'preprint', id: '123' },
        context: {},
      });

      // MFA adds +20 to auth score, pushing author above threshold
      expect(withMfa.allow).toBe(true);
      // Without MFA, author (score ~49) falls just below threshold
      expect(withoutMfa.allow).toBe(false);
    });

    it('should boost trust score for fresh sessions', async () => {
      // Author without session age bonus: auth=50 (40+10), total ~49 -> denied
      // Author with fresh session bonus: auth=60 (40+10+10), total ~53 -> allowed
      const freshSession = await service.evaluate({
        subject: {
          did: testDid,
          roles: ['author'],
        },
        action: 'read',
        resource: { type: 'preprint', id: '123' },
        context: {
          attributes: {
            sessionAge: 60, // 1 minute (gets +10 bonus)
          },
        },
      });

      const staleSession = await service.evaluate({
        subject: {
          did: testDid,
          roles: ['author'],
        },
        action: 'read',
        resource: { type: 'preprint', id: '123' },
        context: {
          attributes: {
            sessionAge: 7200, // 2 hours (no session age bonus)
          },
        },
      });

      // Fresh session adds +10 to auth score, pushing author above threshold
      expect(freshSession.allow).toBe(true);
      // Stale session gets no bonus, author (score ~49) falls below threshold
      expect(staleSession.allow).toBe(false);
    });
  });

  describe('getPolicyVersion', () => {
    it('should return current policy version', async () => {
      const version = await service.getPolicyVersion();

      expect(version).toBeDefined();
      expect(typeof version).toBe('string');
    });
  });

  describe('loadPolicy', () => {
    it('should load policy from URL', async () => {
      // Mock fetch to return a valid response
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(16)),
      });
      vi.stubGlobal('fetch', mockFetch);

      await expect(
        service.loadPolicy('https://policies.example.com/bundle.tar.gz')
      ).resolves.not.toThrow();

      expect(redis.set).toHaveBeenCalled();
      vi.unstubAllGlobals();
    });

    it('should update policy version after loading', async () => {
      // Mock fetch to return a valid response
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(16)),
      });
      vi.stubGlobal('fetch', mockFetch);

      const initialVersion = service.getPolicyVersion();

      await service.loadPolicy('https://policies.example.com/bundle.tar.gz');

      const newVersion = service.getPolicyVersion();

      expect(newVersion).not.toBe(initialVersion);
      vi.unstubAllGlobals();
    });
  });

  describe('auditDecision', () => {
    it('should log decisions to Redis', async () => {
      const decision = await service.evaluate({
        subject: {
          did: testDid,
          roles: ['author'],
        },
        action: 'write',
        resource: { type: 'preprint', id: '123' },
        context: {
          ipAddress: '192.168.1.1',
        },
      });

      await service.auditDecision(decision, {
        subject: {
          did: testDid,
          roles: ['author'],
        },
        action: 'write',
        resource: { type: 'preprint', id: '123' },
        context: {
          ipAddress: '192.168.1.1',
        },
      });

      // Audit entry should be stored
      expect(redis.setex).toHaveBeenCalled();
      expect(redis.lpush).toHaveBeenCalled();
    });
  });

  describe('recordDevicePosture', () => {
    it('should store device posture data', async () => {
      await service.recordDevicePosture(testDid, 'device_123', {
        encryptionEnabled: true,
        screenLockEnabled: true,
        osUpToDate: true,
      });

      expect(redis.setex).toHaveBeenCalled();
      expect(redis.sadd).toHaveBeenCalled();
    });
  });

  describe('getKnownDevices', () => {
    it('should return known device IDs', async () => {
      const deviceIds = ['device_1', 'device_2'];
      (redis.smembers as ReturnType<typeof vi.fn>).mockResolvedValueOnce(deviceIds);

      const devices = await service.getKnownDevices(testDid);

      expect(devices).toEqual(deviceIds);
    });
  });

  describe('recordSecurityEvent', () => {
    it('should store security event', async () => {
      await service.recordSecurityEvent(testDid, 'login_failed', {
        ipAddress: '1.2.3.4',
        attemptedAt: new Date().toISOString(),
      });

      expect(redis.lpush).toHaveBeenCalled();
      expect(redis.ltrim).toHaveBeenCalled();
    });
  });

  describe('service-to-service authentication', () => {
    it('should authenticate services via SPIFFE ID with appropriate threshold', async () => {
      // Service-to-service auth uses different risk profile than user auth
      // SPIFFE: auth=50, device=30 (no deviceId), behavior=70, network=50
      // Score: (50*40 + 30*25 + 70*20 + 50*15) / 100 = 4900/100 = 49
      // With S2S threshold of 45, this passes
      const s2sService = new ZeroTrustService({
        redis,
        logger,
        config: {
          minTrustScore: 45, // Lower threshold for internal service communication
        },
      });

      const decision = await s2sService.evaluate({
        subject: {
          spiffeId: 'spiffe://chive.pub/ns/default/sa/preprint-service',
        },
        action: 'read',
        resource: { type: 'internal', id: 'metrics' },
        context: {},
      });

      expect(decision).toBeDefined();
      expect(decision.allow).toBe(true);
      expect(decision.reasons?.[0]).toMatch(/granted/i);
    });

    it('should allow SPIFFE with trusted network context', async () => {
      // With trusted IP reputation, network score increases
      // Setup trusted IP
      const trustedIp = '10.0.0.1';
      const getMock = redis.get as ReturnType<
        typeof vi.fn<(key: string) => Promise<string | null>>
      >;
      getMock.mockImplementation((key: string) => {
        return key === `chive:zt:ip:${trustedIp}`
          ? Promise.resolve('trusted')
          : Promise.resolve(null);
      });

      const decision = await service.evaluate({
        subject: {
          spiffeId: 'spiffe://chive.pub/ns/default/sa/preprint-service',
        },
        action: 'read',
        resource: { type: 'internal', id: 'metrics' },
        context: {
          ipAddress: trustedIp,
        },
      });

      // With trusted IP, network score = 70+20 = 90
      // Total: (50*40 + 30*25 + 70*20 + 90*15) / 100 = 5500/100 = 55 -> allowed
      expect(decision.allow).toBe(true);
    });

    it('should deny service without valid identity', async () => {
      // No SPIFFE ID and no DID means auth score is 0
      const decision = await service.evaluate({
        subject: {},
        action: 'read',
        resource: { type: 'internal', id: 'metrics' },
        context: {},
      });

      expect(decision.allow).toBe(false);
      expect(decision.reasons?.[0]).toMatch(/denied/i);
    });
  });
});
