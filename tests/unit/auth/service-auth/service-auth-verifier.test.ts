/**
 * Unit tests for ServiceAuthVerifier.
 *
 * @remarks
 * This is the trust boundary: whatever this returns becomes the caller's
 * identity for the rest of the request. It had no unit test at all, which is
 * the same gap that let SEC-3 — a token minted for one lexicon method being
 * accepted for any other — go unnoticed until 0.8.0.
 *
 * `verifyJwt` from `@atproto/xrpc-server` is mocked: what is under test is what
 * Chive asks it to check and what Chive does with the answer, not the ATProto
 * library's cryptography.
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const verifyJwt = vi.fn();

vi.mock('@atproto/xrpc-server', () => ({
  verifyJwt: (...args: unknown[]): unknown => verifyJwt(...args) as unknown,
  cryptoVerifySignatureWithKey: vi.fn(),
}));

vi.mock('@atproto/identity', () => ({
  IdResolver: class {
    did = { resolveAtprotoKey: vi.fn().mockResolvedValue('did:key:zTestSigningKey') };
  },
}));

const { ServiceAuthVerifier } = await import('@/auth/service-auth/service-auth-verifier.js');

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

const SERVICE_DID = 'did:web:api.chive.pub';

function build(): InstanceType<typeof ServiceAuthVerifier> {
  return new ServiceAuthVerifier({
    logger: createLogger(),
    config: { serviceDid: SERVICE_DID },
  } as never);
}

describe('ServiceAuthVerifier', () => {
  beforeEach(() => {
    verifyJwt.mockReset();
  });

  it('returns the issuing DID as the caller identity', async () => {
    verifyJwt.mockResolvedValue({
      iss: 'did:plc:caller',
      aud: SERVICE_DID,
      lxm: 'pub.chive.eprint.getSubmission',
      exp: 1893456000,
    });

    const result = await build().verify('a.jwt.string');

    expect(result).toEqual({
      did: 'did:plc:caller',
      lxm: 'pub.chive.eprint.getSubmission',
      exp: 1893456000,
    });
  });

  it('checks the audience against this service', async () => {
    // A token minted for a different service must not be accepted here. The
    // audience is passed to verifyJwt rather than checked afterwards, so the
    // test asserts on the argument.
    verifyJwt.mockResolvedValue({ iss: 'did:plc:caller', aud: SERVICE_DID, exp: 1 });

    await build().verify('a.jwt.string');

    expect(verifyJwt).toHaveBeenCalledWith(
      'a.jwt.string',
      SERVICE_DID,
      null,
      expect.any(Function),
      expect.any(Function)
    );
  });

  it('checks the lexicon method when one is given', async () => {
    // This is SEC-3: without the lxm argument, a token minted for a read is
    // accepted for a write.
    verifyJwt.mockResolvedValue({ iss: 'did:plc:caller', aud: SERVICE_DID, exp: 1 });

    await build().verify('a.jwt.string', 'pub.chive.eprint.deleteSubmission');

    expect(verifyJwt).toHaveBeenCalledWith(
      'a.jwt.string',
      SERVICE_DID,
      'pub.chive.eprint.deleteSubmission',
      expect.any(Function),
      expect.any(Function)
    );
  });

  it('returns null rather than throwing when verification fails', async () => {
    // The middleware treats null as "unauthenticated". An exception escaping
    // here would surface as a 500 and tell a caller their token broke the
    // server rather than that it was rejected.
    verifyJwt.mockRejectedValue(new Error('bad signature'));

    expect(await build().verify('a.jwt.string')).toBeNull();
  });

  it('returns null for an expired token', async () => {
    verifyJwt.mockRejectedValue(new Error('jwt expired'));

    expect(await build().verify('a.jwt.string')).toBeNull();
  });

  it('returns null when the signing key cannot be resolved', async () => {
    verifyJwt.mockRejectedValue(new Error('could not resolve did'));

    expect(await build().verify('a.jwt.string')).toBeNull();
  });

  it('never returns a partially verified identity', async () => {
    // Any failure path must yield null, not an object with the DID filled in
    // from an unverified token.
    for (const failure of ['bad signature', 'jwt expired', 'wrong audience', 'bad lxm']) {
      verifyJwt.mockRejectedValueOnce(new Error(failure));
      expect(await build().verify('a.jwt.string'), failure).toBeNull();
    }
  });
});
