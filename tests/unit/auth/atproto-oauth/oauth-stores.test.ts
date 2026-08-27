/**
 * Unit tests for the ATProto OAuth state and session stores.
 *
 * @remarks
 * These hold the two things an attacker most wants: the CSRF state that binds
 * an authorization response to the request that started it, and the refresh
 * tokens that grant continued access to a user's PDS. Neither had a unit test.
 *
 * @packageDocumentation
 */

import { randomBytes } from 'node:crypto';

import { describe, it, expect, vi } from 'vitest';

import { RedisSessionStore } from '@/auth/atproto-oauth/session-store.js';
import { RedisStateStore } from '@/auth/atproto-oauth/state-store.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

function createLogger(): ILogger {
  const logger: ILogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: () => logger,
  };
  return logger;
}

/** A Redis stand-in that records what it was asked to store. */
function createRedis(): {
  store: Map<string, string>;
  get: ReturnType<typeof vi.fn>;
  setex: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
} {
  const store = new Map<string, string>();
  return {
    store,
    get: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    setex: vi.fn((key: string, _ttl: number, value: string) => {
      store.set(key, value);
      return Promise.resolve('OK');
    }),
    del: vi.fn((key: string) => {
      store.delete(key);
      return Promise.resolve(1);
    }),
  };
}

const KEY = 'hex'.repeat(0) + randomBytes(32).toString('hex');

describe('RedisStateStore', () => {
  it('round-trips state', async () => {
    const redis = createRedis();
    const store = new RedisStateStore({ redis: redis as never, logger: createLogger() });

    await store.set('state-123', { dpopKey: 'k' } as never);

    expect(await store.get('state-123')).toEqual({ dpopKey: 'k' });
  });

  it('returns undefined for a key that is absent', async () => {
    const store = new RedisStateStore({ redis: createRedis() as never, logger: createLogger() });

    expect(await store.get('never-stored')).toBeUndefined();
  });

  it('gives state a bounded lifetime', async () => {
    // OAuth state is single-use and short-lived. Storing it without an expiry
    // would leave a replayable value in Redis indefinitely.
    const redis = createRedis();
    const store = new RedisStateStore({ redis: redis as never, logger: createLogger() });

    await store.set('state-123', { dpopKey: 'k' } as never);

    const [, ttl] = redis.setex.mock.calls[0] as [string, number, string];
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(900);
  });

  it('namespaces its keys so state cannot collide with another store', async () => {
    const redis = createRedis();
    const store = new RedisStateStore({ redis: redis as never, logger: createLogger() });

    await store.set('abc', { dpopKey: 'k' } as never);

    expect([...redis.store.keys()][0]).toMatch(/^chive:atproto:state:abc$/);
  });

  it('deletes corrupt state rather than returning it', async () => {
    // A half-written value must not be handed back as if it were valid state,
    // and must not sit there failing every subsequent read.
    const redis = createRedis();
    redis.store.set('chive:atproto:state:bad', '{not json');
    const store = new RedisStateStore({ redis: redis as never, logger: createLogger() });

    expect(await store.get('bad')).toBeUndefined();
    expect(redis.del).toHaveBeenCalledWith('chive:atproto:state:bad');
  });

  it('deletes on request', async () => {
    const redis = createRedis();
    const store = new RedisStateStore({ redis: redis as never, logger: createLogger() });

    await store.set('abc', { dpopKey: 'k' } as never);
    await store.del('abc');

    expect(await store.get('abc')).toBeUndefined();
  });
});

describe('RedisSessionStore', () => {
  it('round-trips a session', async () => {
    const redis = createRedis();
    const store = new RedisSessionStore({ redis: redis as never, logger: createLogger() });

    await store.set('did:plc:user', { tokenSet: { refresh_token: 'r' } } as never);

    expect(await store.get('did:plc:user')).toEqual({ tokenSet: { refresh_token: 'r' } });
  });

  it('does not write refresh tokens in the clear when a key is configured', async () => {
    // Sessions hold the credentials that grant continued access to a user's
    // PDS. Anyone who can read Redis must not be able to read those.
    const redis = createRedis();
    const store = new RedisSessionStore({
      redis: redis as never,
      logger: createLogger(),
      config: { encryptionKey: KEY },
    });

    await store.set('did:plc:user', { tokenSet: { refresh_token: 'super-secret' } } as never);

    const stored = [...redis.store.values()][0] ?? '';
    expect(stored).not.toContain('super-secret');
    expect(stored).not.toContain('refresh_token');
  });

  it('round-trips through encryption', async () => {
    const redis = createRedis();
    const store = new RedisSessionStore({
      redis: redis as never,
      logger: createLogger(),
      config: { encryptionKey: KEY },
    });

    await store.set('did:plc:user', { tokenSet: { refresh_token: 'super-secret' } } as never);

    expect(await store.get('did:plc:user')).toEqual({
      tokenSet: { refresh_token: 'super-secret' },
    });
  });

  it('cannot be decrypted with a different key', async () => {
    const redis = createRedis();
    const writer = new RedisSessionStore({
      redis: redis as never,
      logger: createLogger(),
      config: { encryptionKey: KEY },
    });
    await writer.set('did:plc:user', { tokenSet: { refresh_token: 'r' } } as never);

    const reader = new RedisSessionStore({
      redis: redis as never,
      logger: createLogger(),
      config: { encryptionKey: randomBytes(32).toString('hex') },
    });

    // Authenticated encryption: the wrong key must fail, not return garbage.
    expect(await reader.get('did:plc:user')).toBeUndefined();
  });

  it('rejects an encryption key that is not 32 bytes', () => {
    // A short key would otherwise be padded or truncated silently, producing
    // encryption weaker than it appears.
    expect(
      () =>
        new RedisSessionStore({
          redis: createRedis() as never,
          logger: createLogger(),
          config: { encryptionKey: 'abcd' },
        })
    ).toThrow(/32 bytes/);
  });

  it('gives sessions a bounded lifetime', async () => {
    const redis = createRedis();
    const store = new RedisSessionStore({ redis: redis as never, logger: createLogger() });

    await store.set('did:plc:user', { tokenSet: {} } as never);

    const [, ttl] = redis.setex.mock.calls[0] as [string, number, string];
    expect(ttl).toBeGreaterThan(0);
  });

  it('deletes a corrupt session rather than returning it', async () => {
    const redis = createRedis();
    const store = new RedisSessionStore({
      redis: redis as never,
      logger: createLogger(),
      config: { encryptionKey: KEY },
    });
    redis.store.set('chive:atproto:session:did:plc:user', 'not-base64-ciphertext');

    expect(await store.get('did:plc:user')).toBeUndefined();
    expect(redis.del).toHaveBeenCalled();
  });
});
