/**
 * Unit tests for WebAuthnService.
 *
 * @remarks
 * Tests passkey registration, authentication, and credential management.
 */

import type { Redis } from 'ioredis';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { WebAuthnService } from '@/auth/webauthn/webauthn-service.js';
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
  } as unknown as Redis;
};

describe('WebAuthnService', () => {
  let service: WebAuthnService;
  let logger: MockLogger;
  let redis: Redis;

  const testDid = 'did:plc:webauthn123' as DID;

  beforeEach(() => {
    logger = createMockLogger();
    redis = createMockRedis();

    service = new WebAuthnService({
      redis,
      logger,
      config: {
        rpName: 'Chive',
        rpId: 'chive.pub',
        expectedOrigins: ['https://chive.pub'],
        challengeExpirationSeconds: 300,
      },
    });
  });

  describe('generateRegistrationChallenge', () => {
    it('should generate registration options with challenge', async () => {
      const challenge = await service.generateRegistrationChallenge(testDid);

      expect(challenge).toBeDefined();
      expect(challenge.challengeId).toBeDefined();
      expect(challenge.options).toBeDefined();
      expect(challenge.options.challenge).toBeDefined();
      expect(challenge.options.rp).toBeDefined();
      expect(challenge.options.rp.id).toBe('chive.pub');
      expect(challenge.options.rp.name).toBe('Chive');
      expect(challenge.options.user).toBeDefined();
      expect(challenge.expiresAt).toBeDefined();
    });

    it('should store challenge in Redis with TTL', async () => {
      await service.generateRegistrationChallenge(testDid);

      expect(redis.setex).toHaveBeenCalled();
    });

    it('should include excludeCredentials for existing credentials', async () => {
      // Pre-populate credential
      const credentialId = 'existing_credential_id';
      (redis.smembers as ReturnType<typeof vi.fn>).mockResolvedValueOnce([credentialId]);
      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        JSON.stringify({
          credentialId,
          did: testDid,
          publicKey: 'mock_public_key',
          counter: 0,
          createdAt: new Date().toISOString(),
        })
      );

      const challenge = await service.generateRegistrationChallenge(testDid);

      // Exclusion list should contain existing credential
      expect(challenge.options.excludeCredentials).toBeDefined();
    });

    it('should support custom options', async () => {
      const challenge = await service.generateRegistrationChallenge(testDid, {
        nickname: 'My MacBook',
        userVerification: 'required',
      });

      expect(challenge.options.authenticatorSelection?.userVerification).toBe('required');
    });
  });

  describe('generateAuthenticationChallenge', () => {
    it('should generate authentication options', async () => {
      // Pre-populate credential
      const credentialId = 'auth_credential_id';
      (redis.smembers as ReturnType<typeof vi.fn>).mockResolvedValueOnce([credentialId]);
      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        JSON.stringify({
          credentialId,
          did: testDid,
          publicKey: 'mock_public_key',
          counter: 0,
          transports: ['internal'],
          createdAt: new Date().toISOString(),
        })
      );

      const challenge = await service.generateAuthenticationChallenge(testDid);

      expect(challenge).toBeDefined();
      expect(challenge.challengeId).toBeDefined();
      expect(challenge.options).toBeDefined();
      expect(challenge.options.challenge).toBeDefined();
      expect(challenge.options.rpId).toBe('chive.pub');
    });

    it('should include allowed credentials', async () => {
      const credentialId = 'allowed_credential';
      (redis.smembers as ReturnType<typeof vi.fn>).mockResolvedValueOnce([credentialId]);
      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        JSON.stringify({
          credentialId,
          did: testDid,
          publicKey: 'mock_public_key',
          counter: 0,
          createdAt: new Date().toISOString(),
        })
      );

      const challenge = await service.generateAuthenticationChallenge(testDid);

      expect(challenge.options.allowCredentials).toBeDefined();
      expect(challenge.options.allowCredentials?.length).toBeGreaterThan(0);
    });

    it('should throw when no credentials registered', async () => {
      (redis.smembers as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

      await expect(service.generateAuthenticationChallenge(testDid)).rejects.toThrow(
        'No WebAuthn credentials registered'
      );
    });

    it('should allow discoverable credentials without DID', async () => {
      const challenge = await service.generateAuthenticationChallenge();

      expect(challenge).toBeDefined();
      expect(challenge.options.allowCredentials).toBeUndefined();
    });
  });

  describe('verifyRegistration', () => {
    it('should throw when challenge not found', async () => {
      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

      await expect(
        service.verifyRegistration({
          challengeId: 'nonexistent',
          credential: {
            id: 'cred_id',
            rawId: 'raw_id',
            type: 'public-key',
            response: {
              clientDataJSON: 'client_data',
              attestationObject: 'attestation',
            },
          },
        })
      ).rejects.toThrow('Registration challenge not found or expired');
    });
  });

  describe('verifyAuthentication', () => {
    it('should return error when challenge not found', async () => {
      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

      const result = await service.verifyAuthentication({
        challengeId: 'nonexistent',
        credential: {
          id: 'cred_id',
          rawId: 'raw_id',
          type: 'public-key',
          response: {
            clientDataJSON: 'client_data',
            authenticatorData: 'auth_data',
            signature: 'sig',
          },
        },
      });

      expect(result.verified).toBe(false);
      expect(result.error).toContain('not found or expired');
    });

    it('should return error when credential not found', async () => {
      // Challenge exists
      (redis.get as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(
          JSON.stringify({
            challenge: 'test_challenge',
            did: testDid,
            createdAt: new Date().toISOString(),
          })
        )
        // Credential lookup fails
        .mockResolvedValueOnce(null);

      const result = await service.verifyAuthentication({
        challengeId: 'test_challenge_id',
        credential: {
          id: 'unknown_cred',
          rawId: 'raw_id',
          type: 'public-key',
          response: {
            clientDataJSON: 'client_data',
            authenticatorData: 'auth_data',
            signature: 'sig',
          },
        },
      });

      expect(result.verified).toBe(false);
      expect(result.error).toContain('Credential not found');
    });
  });

  describe('listCredentials', () => {
    it('should return all credentials for user', async () => {
      const credentialIds = ['cred1', 'cred2'];
      (redis.smembers as ReturnType<typeof vi.fn>).mockResolvedValueOnce(credentialIds);
      (redis.get as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(
          JSON.stringify({
            credentialId: 'cred1',
            did: testDid,
            publicKey: 'key1',
            counter: 5,
            nickname: 'MacBook Pro',
            createdAt: new Date().toISOString(),
          })
        )
        .mockResolvedValueOnce(
          JSON.stringify({
            credentialId: 'cred2',
            did: testDid,
            publicKey: 'key2',
            counter: 3,
            nickname: 'iPhone',
            createdAt: new Date().toISOString(),
          })
        );

      const credentials = await service.listCredentials(testDid);

      expect(credentials).toHaveLength(2);
      expect(credentials[0]?.nickname).toBe('MacBook Pro');
      expect(credentials[1]?.nickname).toBe('iPhone');
    });

    it('should return empty array for user with no credentials', async () => {
      (redis.smembers as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

      const credentials = await service.listCredentials(testDid);

      expect(credentials).toEqual([]);
    });
  });

  describe('deleteCredential', () => {
    it('should remove credential from storage', async () => {
      const credentialId = 'cred_to_delete';

      // Mock credential exists and belongs to user
      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        JSON.stringify({
          credentialId,
          did: testDid,
          publicKey: 'key',
          counter: 0,
          createdAt: new Date().toISOString(),
        })
      );

      await service.deleteCredential(testDid, credentialId);

      expect(redis.del).toHaveBeenCalled();
      expect(redis.srem).toHaveBeenCalled();
    });

    it('should throw when credential not found', async () => {
      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

      await expect(service.deleteCredential(testDid, 'nonexistent')).rejects.toThrow(
        'Credential not found'
      );
    });

    it('should throw when credential belongs to different user', async () => {
      const credentialId = 'cred_other_user';

      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        JSON.stringify({
          credentialId,
          did: 'did:plc:otheruser' as DID,
          publicKey: 'key',
          counter: 0,
          createdAt: new Date().toISOString(),
        })
      );

      await expect(service.deleteCredential(testDid, credentialId)).rejects.toThrow(
        'Not authorized'
      );
    });
  });

  describe('updateCredentialNickname', () => {
    it('should update credential nickname', async () => {
      const credentialId = 'cred_to_rename';
      const existingCredential = {
        credentialId,
        did: testDid,
        publicKey: 'key',
        counter: 0,
        nickname: 'Old Name',
        createdAt: new Date().toISOString(),
      };

      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        JSON.stringify(existingCredential)
      );

      await service.updateCredentialNickname(testDid, credentialId, 'New Name');

      expect(redis.set).toHaveBeenCalled();
    });

    it('should throw when credential not found', async () => {
      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

      await expect(
        service.updateCredentialNickname(testDid, 'nonexistent', 'New Name')
      ).rejects.toThrow('Credential not found');
    });

    it('should throw when credential belongs to different user', async () => {
      const credentialId = 'cred_other_user';

      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        JSON.stringify({
          credentialId,
          did: 'did:plc:otheruser' as DID,
          publicKey: 'key',
          counter: 0,
          createdAt: new Date().toISOString(),
        })
      );

      await expect(
        service.updateCredentialNickname(testDid, credentialId, 'New Name')
      ).rejects.toThrow('Not authorized');
    });
  });
});
