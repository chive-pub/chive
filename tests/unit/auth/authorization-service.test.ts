/**
 * Unit tests for AuthorizationService.
 *
 * @remarks
 * Tests RBAC authorization, role management, and permission checking.
 */

import type { Redis } from 'ioredis';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AuthorizationService } from '@/auth/authorization/authorization-service.js';
import type { DID } from '@/types/atproto.js';
import type { Role, ResourceType, Action } from '@/types/interfaces/authorization.interface.js';
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
    del: vi.fn((...keys: string[]) => {
      let count = 0;
      for (const key of keys) {
        if (store.delete(key)) count++;
      }
      return Promise.resolve(count);
    }),
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
    sismember: vi.fn((key: string, member: string) => {
      const set = sets.get(key);
      return Promise.resolve(set?.has(member) ? 1 : 0);
    }),
  } as unknown as Redis;
};

describe('AuthorizationService', () => {
  let service: AuthorizationService;
  let logger: MockLogger;
  let redis: Redis;

  const adminDid = 'did:plc:admin123' as DID;
  const authorDid = 'did:plc:author456' as DID;
  const readerDid = 'did:plc:reader789' as DID;

  beforeEach(async () => {
    logger = createMockLogger();
    redis = createMockRedis();

    service = new AuthorizationService({
      logger,
      redis,
    });

    await service.initialize();
  });

  describe('assignRole', () => {
    it('should assign a role to a user', async () => {
      await service.assignRole(authorDid, 'author' as Role);

      const roles = await service.getRoles(authorDid);
      expect(roles).toContain('author');
    });

    it('should log role assignment', async () => {
      await service.assignRole(authorDid, 'author' as Role);

      expect(logger.infoMock).toHaveBeenCalledWith(
        'Role assigned',
        expect.objectContaining({ did: authorDid, role: 'author' })
      );
    });

    it('should allow assigning multiple roles', async () => {
      await service.assignRole(adminDid, 'admin' as Role);
      await service.assignRole(adminDid, 'author' as Role);

      const roles = await service.getRoles(adminDid);
      expect(roles).toContain('admin');
      expect(roles).toContain('author');
    });
  });

  describe('revokeRole', () => {
    it('should revoke a role from a user', async () => {
      await service.assignRole(authorDid, 'author' as Role);
      await service.revokeRole(authorDid, 'author' as Role);

      const roles = await service.getRoles(authorDid);
      expect(roles).not.toContain('author');
    });

    it('should log role revocation', async () => {
      await service.assignRole(authorDid, 'author' as Role);
      await service.revokeRole(authorDid, 'author' as Role);

      expect(logger.infoMock).toHaveBeenCalledWith(
        'Role revoked',
        expect.objectContaining({ did: authorDid, role: 'author' })
      );
    });
  });

  describe('getRoles', () => {
    it('should return all roles for a user', async () => {
      await service.assignRole(authorDid, 'author' as Role);
      await service.assignRole(authorDid, 'reader' as Role);

      const roles = await service.getRoles(authorDid);
      expect(roles).toContain('author');
      expect(roles).toContain('reader');
    });

    it('should return empty array for user with no roles', async () => {
      const roles = await service.getRoles('did:plc:noroles' as DID);
      expect(roles).toEqual([]);
    });
  });

  describe('authorize', () => {
    beforeEach(async () => {
      await service.assignRole(adminDid, 'admin' as Role);
      await service.assignRole(authorDid, 'author' as Role);
    });

    it('should allow admin to perform any action', async () => {
      const result = await service.authorize({
        subject: { did: adminDid, roles: ['admin'] as Role[] },
        action: 'admin' as Action,
        resource: { type: 'preprint' as ResourceType },
      });

      expect(result.allowed).toBe(true);
    });

    it('should allow author to create preprints', async () => {
      const result = await service.authorize({
        subject: { did: authorDid, roles: ['author'] as Role[] },
        action: 'create' as Action,
        resource: { type: 'preprint' as ResourceType },
      });

      expect(result.allowed).toBe(true);
    });

    it('should allow resource owner to update their own resource', async () => {
      const result = await service.authorize({
        subject: { did: authorDid, roles: ['author'] as Role[] },
        action: 'update' as Action,
        resource: {
          type: 'preprint' as ResourceType,
          ownerDid: authorDid,
        },
      });

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('resource_owner');
    });

    it('should deny author from updating others resources', async () => {
      const result = await service.authorize({
        subject: { did: authorDid, roles: ['author'] as Role[] },
        action: 'update' as Action,
        resource: {
          type: 'preprint' as ResourceType,
          ownerDid: 'did:plc:someone-else' as DID,
        },
      });

      expect(result.allowed).toBe(false);
    });

    it('should deny reader from creating preprints', async () => {
      const result = await service.authorize({
        subject: { did: readerDid, roles: ['reader'] as Role[] },
        action: 'create' as Action,
        resource: { type: 'preprint' as ResourceType },
      });

      expect(result.allowed).toBe(false);
    });
  });

  describe('hasPermission', () => {
    beforeEach(async () => {
      await service.assignRole(authorDid, 'author' as Role);
    });

    it('should return true for permitted actions', async () => {
      const hasPermission = await service.hasPermission(authorDid, 'preprint:create');
      expect(hasPermission).toBe(true);
    });

    it('should return false for unpermitted actions', async () => {
      const hasPermission = await service.hasPermission(authorDid, 'user:admin');
      expect(hasPermission).toBe(false);
    });
  });
});
