/**
 * Unit tests for SessionManager.
 *
 * @remarks
 * Tests session creation, retrieval, updates, and revocation.
 */

import type { Redis } from 'ioredis';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { SessionManager } from '@/auth/session/session-manager.js';
import type { DID } from '@/types/atproto.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';
import type { SessionMetadata } from '@/types/interfaces/session.interface.js';

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

  const mockRedis = {
    get: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    set: vi.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve('OK');
    }),
    setex: vi.fn((key: string, _ttl: number, value: string) => {
      store.set(key, value);
      return Promise.resolve('OK');
    }),
    del: vi.fn((...keys: string[]) => {
      let count = 0;
      for (const key of keys) {
        if (store.delete(key)) count++;
      }
      return Promise.resolve(count);
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
    srem: vi.fn((key: string, ...members: string[]) => {
      const set = sets.get(key);
      if (!set) return Promise.resolve(0);
      let count = 0;
      for (const member of members) {
        if (set.delete(member)) count++;
      }
      return Promise.resolve(count);
    }),
    smembers: vi.fn((key: string) => {
      const set = sets.get(key);
      return Promise.resolve(set ? Array.from(set) : []);
    }),
    scard: vi.fn((key: string) => {
      const set = sets.get(key);
      return Promise.resolve(set ? set.size : 0);
    }),
    ttl: vi.fn(() => Promise.resolve(3600)),
    pipeline: vi.fn(() => {
      const commands: { method: string; args: unknown[] }[] = [];
      const pipelineMock = {
        setex: (key: string, ttl: number, value: string) => {
          commands.push({ method: 'setex', args: [key, ttl, value] });
          return pipelineMock;
        },
        sadd: (key: string, ...members: string[]) => {
          commands.push({ method: 'sadd', args: [key, ...members] });
          return pipelineMock;
        },
        del: (...keys: string[]) => {
          commands.push({ method: 'del', args: keys });
          return pipelineMock;
        },
        srem: (key: string, ...members: string[]) => {
          commands.push({ method: 'srem', args: [key, ...members] });
          return pipelineMock;
        },
        expire: (key: string, ttl: number) => {
          commands.push({ method: 'expire', args: [key, ttl] });
          return pipelineMock;
        },
        exec: async () => {
          const results: [Error | null, unknown][] = [];
          for (const cmd of commands) {
            const method = cmd.method as keyof typeof mockRedis;
            if (method in mockRedis && typeof mockRedis[method] === 'function') {
              const fn = mockRedis[method] as (...args: unknown[]) => Promise<unknown>;
              const result = await fn(...cmd.args);
              results.push([null, result]);
            }
          }
          return results;
        },
      };
      return pipelineMock;
    }),
  };

  return mockRedis as unknown as Redis;
};

describe('SessionManager', () => {
  let manager: SessionManager;
  let logger: MockLogger;
  let redis: Redis;

  const testDid = 'did:plc:test123' as DID;
  const testMetadata: SessionMetadata = {
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0 Test Browser',
    deviceId: 'device-123',
  };

  beforeEach(() => {
    logger = createMockLogger();
    redis = createMockRedis();

    manager = new SessionManager({
      logger,
      redis,
      config: {
        sessionExpirationSeconds: 86400,
        maxSessionsPerUser: 5,
      },
    });
  });

  describe('createSession', () => {
    it('should create a new session', async () => {
      const session = await manager.createSession(testDid, testMetadata);

      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.did).toBe(testDid);
      expect(session.ipAddress).toBe(testMetadata.ipAddress);
      expect(session.userAgent).toBe(testMetadata.userAgent);
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.expiresAt).toBeInstanceOf(Date);
    });

    it('should store session in Redis', async () => {
      const session = await manager.createSession(testDid, testMetadata);

      // Verify Redis was called
      expect(redis.setex).toHaveBeenCalled();
      expect(redis.sadd).toHaveBeenCalled();

      // Should be able to retrieve session
      const retrieved = await manager.getSession(session.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(session.id);
    });

    it('should log session creation', async () => {
      await manager.createSession(testDid, testMetadata);

      expect(logger.infoMock).toHaveBeenCalledWith(
        'Session created',
        expect.objectContaining({ did: testDid })
      );
    });
  });

  describe('getSession', () => {
    it('should return session if exists', async () => {
      const created = await manager.createSession(testDid, testMetadata);
      const session = await manager.getSession(created.id);

      expect(session).not.toBeNull();
      expect(session?.id).toBe(created.id);
      expect(session?.did).toBe(testDid);
    });

    it('should return null for non-existent session', async () => {
      const session = await manager.getSession('non-existent-id');
      expect(session).toBeNull();
    });
  });

  describe('updateSession', () => {
    it('should update session last activity', async () => {
      const created = await manager.createSession(testDid, testMetadata);
      const newActivity = new Date();

      await manager.updateSession(created.id, { lastActivity: newActivity });

      const updated = await manager.getSession(created.id);
      expect(updated?.lastActivity.getTime()).toBe(newActivity.getTime());
    });

    it('should update session scope', async () => {
      const created = await manager.createSession(testDid, testMetadata);
      const newScope = ['read:eprints', 'write:reviews'];

      await manager.updateSession(created.id, { scope: newScope });

      const updated = await manager.getSession(created.id);
      expect(updated?.scope).toEqual(newScope);
    });
  });

  describe('revokeSession', () => {
    it('should delete session from Redis', async () => {
      const session = await manager.createSession(testDid, testMetadata);

      await manager.revokeSession(session.id);

      const retrieved = await manager.getSession(session.id);
      expect(retrieved).toBeNull();
    });

    it('should log session revocation', async () => {
      const session = await manager.createSession(testDid, testMetadata);

      await manager.revokeSession(session.id);

      expect(logger.infoMock).toHaveBeenCalledWith(
        'Session revoked',
        expect.objectContaining({ sessionId: session.id })
      );
    });
  });

  describe('revokeAllSessions', () => {
    it('should revoke all sessions for user', async () => {
      // Create multiple sessions
      const session1 = await manager.createSession(testDid, testMetadata);
      const session2 = await manager.createSession(testDid, {
        ...testMetadata,
        deviceId: 'device-456',
      });

      await manager.revokeAllSessions(testDid);

      // Both sessions should be gone
      expect(await manager.getSession(session1.id)).toBeNull();
      expect(await manager.getSession(session2.id)).toBeNull();
    });

    it('should log all sessions revocation', async () => {
      await manager.createSession(testDid, testMetadata);
      await manager.createSession(testDid, { ...testMetadata, deviceId: 'device-2' });

      await manager.revokeAllSessions(testDid);

      expect(logger.infoMock).toHaveBeenCalledWith(
        'All sessions revoked',
        expect.objectContaining({ did: testDid })
      );
    });
  });

  describe('listSessions', () => {
    it('should list all active sessions for user', async () => {
      const session1 = await manager.createSession(testDid, testMetadata);
      const session2 = await manager.createSession(testDid, {
        ...testMetadata,
        deviceId: 'device-456',
      });

      const sessions = await manager.listSessions(testDid);

      expect(sessions.length).toBe(2);
      expect(sessions.map((s) => s.id)).toContain(session1.id);
      expect(sessions.map((s) => s.id)).toContain(session2.id);
    });

    it('should return empty array for user with no sessions', async () => {
      const sessions = await manager.listSessions('did:plc:nosessions' as DID);
      expect(sessions).toEqual([]);
    });
  });
});
