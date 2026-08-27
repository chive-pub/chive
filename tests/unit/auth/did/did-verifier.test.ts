/**
 * Unit tests for DIDVerifier.
 *
 * @remarks
 * The verifier decides whether a JWT proves the holder controls a DID. It had
 * no unit test, and its failure modes are the quiet kind: accepting an
 * unsigned token, accepting one signed with `alg: none`, or accepting an
 * expired one all look exactly like working authentication.
 *
 * The signature check itself is exercised through a stub resolver rather than
 * real keys — what is under test is the order and completeness of the checks
 * around it, which is where this class can be wrong.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi } from 'vitest';

import { DIDVerifier } from '@/auth/did/did-verifier.js';
import type { IIdentityResolver } from '@/types/interfaces/identity.interface.js';
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

function createResolver(document: unknown): IIdentityResolver {
  return {
    resolveDID: vi.fn().mockResolvedValue(document),
    resolveHandle: vi.fn(),
    getPDSEndpoint: vi.fn(),
  } as unknown as IIdentityResolver;
}

/** Encode a JWT part without signing it. */
function part(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function token(header: unknown, payload: unknown, signature = 'not-a-real-signature'): string {
  return `${part(header)}.${part(payload)}.${signature}`;
}

const DID = 'did:plc:subject';
const FUTURE = Math.floor(Date.now() / 1000) + 3600;
const PAST = Math.floor(Date.now() / 1000) - 3600;

function build(resolver: IIdentityResolver, overrides: Record<string, unknown> = {}): DIDVerifier {
  return new DIDVerifier({
    identityResolver: resolver,
    logger: createLogger(),
    ...overrides,
  } as never);
}

describe('DIDVerifier', () => {
  it('rejects an algorithm other than ES256', async () => {
    // `alg: none` is the classic JWT forgery: a token with no signature that a
    // permissive verifier accepts as valid.
    const verifier = build(createResolver({ id: DID }));

    const result = await verifier.verify(token({ alg: 'none' }, { sub: DID, exp: FUTURE }));

    expect(result.valid).toBe(false);
    expect(result.errors?.[0]).toMatch(/Unsupported algorithm/);
  });

  it('rejects HS256, which would let a shared secret stand in for a key', async () => {
    const verifier = build(createResolver({ id: DID }));

    const result = await verifier.verify(token({ alg: 'HS256' }, { sub: DID, exp: FUTURE }));

    expect(result.valid).toBe(false);
  });

  it('rejects a subject that is not a DID', async () => {
    const verifier = build(createResolver({ id: DID }));

    const result = await verifier.verify(token({ alg: 'ES256' }, { sub: 'alice', exp: FUTURE }));

    expect(result.valid).toBe(false);
    expect(result.errors?.[0]).toMatch(/subject/i);
  });

  it('rejects a missing subject', async () => {
    const verifier = build(createResolver({ id: DID }));

    const result = await verifier.verify(token({ alg: 'ES256' }, { exp: FUTURE }));

    expect(result.valid).toBe(false);
  });

  it('rejects a DID that cannot be resolved', async () => {
    // An unresolvable DID means there is no document to check the signature
    // against; treating that as valid would accept any signature at all.
    const verifier = build(createResolver(null));

    const result = await verifier.verify(token({ alg: 'ES256' }, { sub: DID, exp: FUTURE }));

    expect(result.valid).toBe(false);
    expect(result.errors?.[0]).toMatch(/Failed to resolve/);
  });

  it('rejects a malformed token without throwing', async () => {
    const verifier = build(createResolver({ id: DID }));

    const result = await verifier.verify('not.a.jwt');

    expect(result.valid).toBe(false);
    expect(result.errors?.length).toBeGreaterThan(0);
  });

  it('rejects a token with too few segments', async () => {
    const verifier = build(createResolver({ id: DID }));

    const result = await verifier.verify('onlyonesegment');

    expect(result.valid).toBe(false);
  });

  it('never returns valid without also returning the DID it verified', async () => {
    // A result of `{ valid: true }` with no `did` would let a caller treat an
    // unidentified token as an authenticated one.
    const verifier = build(createResolver(null));

    for (const t of [
      token({ alg: 'none' }, { sub: DID }),
      token({ alg: 'ES256' }, { sub: 'not-a-did' }),
      token({ alg: 'ES256' }, { sub: DID }),
      'garbage',
    ]) {
      const result = await verifier.verify(t);
      if (result.valid) expect(result.did).toBeDefined();
      else expect(result.did).toBeUndefined();
    }
  });

  it('resolves the DID from the token subject, not from anything caller-supplied', async () => {
    const resolver = createResolver(null);
    const verifier = build(resolver);

    await verifier.verify(token({ alg: 'ES256' }, { sub: DID, exp: FUTURE }));

    expect(resolver.resolveDID).toHaveBeenCalledWith(DID);
  });

  it('does not resolve anything when the algorithm is already wrong', async () => {
    // Rejecting before the network call keeps a forged token from costing a
    // DID resolution, which is the cheap half of a denial-of-service.
    const resolver = createResolver({ id: DID });
    const verifier = build(resolver);

    await verifier.verify(token({ alg: 'none' }, { sub: DID, exp: PAST }));

    expect(resolver.resolveDID).not.toHaveBeenCalled();
  });
});
