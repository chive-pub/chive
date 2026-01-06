/**
 * Unit tests for MFAService.
 *
 * @remarks
 * Tests TOTP enrollment, verification, and backup code management.
 */

import type { Redis } from 'ioredis';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { MFAService } from '@/auth/mfa/mfa-service.js';
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
    incr: vi.fn((key: string) => {
      const val = parseInt(store.get(key) ?? '0', 10) + 1;
      store.set(key, String(val));
      return Promise.resolve(val);
    }),
    expire: vi.fn(() => Promise.resolve(1)),
    ttl: vi.fn(() => Promise.resolve(300)),
    scard: vi.fn((key: string) => {
      const set = sets.get(key);
      return Promise.resolve(set ? set.size : 0);
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
  } as unknown as Redis;
};

describe('MFAService', () => {
  let service: MFAService;
  let logger: MockLogger;
  let redis: Redis;

  const testDid = 'did:plc:mfa123' as DID;

  beforeEach(() => {
    logger = createMockLogger();
    redis = createMockRedis();

    service = new MFAService({
      redis,
      logger,
      config: {
        issuer: 'Chive',
        backupCodeCount: 10,
      },
    });
  });

  describe('enrollTOTP', () => {
    it('should generate secret and URI', async () => {
      const result = await service.enrollTOTP(testDid);

      expect(result).toBeDefined();
      expect(result.secret).toBeDefined();
      expect(result.uri).toBeDefined();
      expect(result.uri).toContain('otpauth://totp/');
      expect(result.uri).toContain('Chive');
      expect(result.enrollmentId).toBeDefined();
    });

    it('should store pending enrollment in Redis', async () => {
      await service.enrollTOTP(testDid);

      expect(redis.setex).toHaveBeenCalled();
    });

    it('should generate backup codes', async () => {
      const result = await service.enrollTOTP(testDid);

      expect(result.backupCodes).toBeDefined();
      expect(result.backupCodes.length).toBe(10);
    });

    it('should include DID in URI when using default accountName', async () => {
      const result = await service.enrollTOTP(testDid);

      // URI should include account identifier
      expect(result.uri).toContain(encodeURIComponent(testDid));
    });

    it('should use custom accountName when provided', async () => {
      const result = await service.enrollTOTP(testDid, {
        accountName: 'testuser',
      });

      expect(result.uri).toContain('testuser');
    });
  });

  describe('verifyTOTPEnrollment', () => {
    it('should reject expired enrollment', async () => {
      // No pending enrollment (expired)
      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

      await expect(
        service.verifyTOTPEnrollment(testDid, 'enrollment_123', '123456')
      ).rejects.toThrow('No pending TOTP enrollment or enrollment expired');
    });

    it('should reject invalid TOTP code', async () => {
      // Setup pending enrollment
      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        JSON.stringify({
          enrollmentId: 'enrollment_123',
          secret: 'JBSWY3DPEHPK3PXP',
          backupCodes: [],
          createdAt: new Date().toISOString(),
        })
      );

      await expect(
        service.verifyTOTPEnrollment(testDid, 'enrollment_123', 'invalid')
      ).rejects.toThrow('Invalid TOTP code');
    });
  });

  describe('verifyMFA', () => {
    it('should reject invalid TOTP code', async () => {
      const enrollment = {
        secret: 'JBSWY3DPEHPK3PXP',
        enrolledAt: new Date().toISOString(),
      };

      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(JSON.stringify(enrollment));

      const result = await service.verifyMFA(testDid, {
        method: 'totp',
        value: 'invalid',
      });

      // Without real TOTP matching, this will fail verification
      expect(result.verified).toBe(false);
    });

    it('should handle backup code verification', async () => {
      const enrollment = {
        secret: 'secret',
        enrolledAt: new Date().toISOString(),
      };

      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(JSON.stringify(enrollment));

      // Backup code verification
      const result = await service.verifyMFA(testDid, {
        method: 'backup_code',
        value: 'ABCD-1234',
      });

      // Without actual hash matching, this will fail
      expect(result).toBeDefined();
      expect(result.method).toBe('backup_code');
    });

    it('should return error for unsupported method', async () => {
      const result = await service.verifyMFA(testDid, {
        method: 'webauthn',
        value: 'credential',
      });

      expect(result.verified).toBe(false);
      expect(result.error).toContain('WebAuthn');
    });

    it('should enforce lockout after too many failed attempts', async () => {
      // Setup lockout
      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce('1');
      (redis.ttl as ReturnType<typeof vi.fn>).mockResolvedValueOnce(300);

      const result = await service.verifyMFA(testDid, {
        method: 'totp',
        value: '123456',
      });

      expect(result.verified).toBe(false);
      expect(result.error).toContain('Too many failed attempts');
    });
  });

  describe('disableTOTP', () => {
    it('should delete TOTP and backup codes', async () => {
      await service.disableTOTP(testDid);

      expect(redis.del).toHaveBeenCalled();
    });
  });

  describe('getEnrollmentStatus', () => {
    it('should return enrollment status when TOTP is enabled', async () => {
      const enrollment = {
        secret: 'secret',
        enrolledAt: new Date().toISOString(),
      };

      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(JSON.stringify(enrollment));
      (redis.scard as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(5) // backup codes
        .mockResolvedValueOnce(0); // webauthn credentials

      const status = await service.getEnrollmentStatus(testDid);

      expect(status.totpEnabled).toBe(true);
      expect(status.backupCodesRemaining).toBe(5);
    });

    it('should return default status for non-enrolled user', async () => {
      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
      (redis.scard as ReturnType<typeof vi.fn>).mockResolvedValueOnce(0).mockResolvedValueOnce(0);

      const status = await service.getEnrollmentStatus(testDid);

      expect(status.totpEnabled).toBe(false);
      expect(status.backupCodesRemaining).toBe(0);
    });
  });

  describe('regenerateBackupCodes', () => {
    it('should generate new backup codes when TOTP enabled', async () => {
      const enrollment = {
        secret: 'secret',
        enrolledAt: new Date().toISOString(),
      };

      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(JSON.stringify(enrollment));

      const codes = await service.regenerateBackupCodes(testDid);

      expect(codes).toBeDefined();
      expect(codes.length).toBe(10); // Default count
      expect(redis.del).toHaveBeenCalled();
      expect(redis.sadd).toHaveBeenCalled();
    });

    it('should generate unique codes', async () => {
      const enrollment = {
        secret: 'secret',
        enrolledAt: new Date().toISOString(),
      };

      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(JSON.stringify(enrollment));

      const codes = await service.regenerateBackupCodes(testDid);
      const uniqueCodes = new Set(codes);

      expect(uniqueCodes.size).toBe(codes.length);
    });

    it('should throw when TOTP not enabled', async () => {
      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

      await expect(service.regenerateBackupCodes(testDid)).rejects.toThrow('TOTP must be enabled');
    });
  });

  describe('hasMFAEnabled', () => {
    it('should return true when TOTP is enabled', async () => {
      const enrollment = {
        secret: 'secret',
        enrolledAt: new Date().toISOString(),
      };

      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(JSON.stringify(enrollment));
      (redis.scard as ReturnType<typeof vi.fn>).mockResolvedValueOnce(0).mockResolvedValueOnce(0);

      const enabled = await service.hasMFAEnabled(testDid);

      expect(enabled).toBe(true);
    });

    it('should return false when not enrolled', async () => {
      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
      (redis.scard as ReturnType<typeof vi.fn>).mockResolvedValueOnce(0).mockResolvedValueOnce(0);

      const enabled = await service.hasMFAEnabled(testDid);

      expect(enabled).toBe(false);
    });
  });

  describe('isMFARequired', () => {
    it('should return false when user has no roles requiring MFA', async () => {
      const getRoles = vi.fn().mockResolvedValue(['author', 'reader']);

      const serviceWithRoles = new MFAService({
        redis,
        logger,
        getRoles,
      });

      const required = await serviceWithRoles.isMFARequired(testDid);

      expect(required).toBe(false);
    });

    it('should return true when user has admin role', async () => {
      const getRoles = vi.fn().mockResolvedValue(['admin']);

      const serviceWithRoles = new MFAService({
        redis,
        logger,
        getRoles,
      });

      const required = await serviceWithRoles.isMFARequired(testDid);

      expect(required).toBe(true);
    });
  });
});
