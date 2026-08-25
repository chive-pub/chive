/**
 * Unit tests for lexicon-method scoping of service auth tokens.
 *
 * @remarks
 * A service auth JWT's `lxm` claim scopes it to a single lexicon method. The
 * verifier has always been able to check it, but the middleware called
 * `verify(token)` with no method, so the claim was decoded, copied into
 * `user.scopes` — which nothing reads — and never enforced. A token minted for
 * `pub.chive.metrics.recordView` was accepted at `pub.chive.admin.deleteContent`.
 *
 * The middleware now derives the method from the request path and passes it, so
 * a scoped token is rejected everywhere except the method it names.
 */

import { describe, it, expect } from 'vitest';

import { lexiconMethodForPath } from '@/api/middleware/auth.js';

describe('lexiconMethodForPath', () => {
  it('extracts the NSID from an XRPC path', () => {
    expect(lexiconMethodForPath('/xrpc/pub.chive.admin.deleteContent')).toBe(
      'pub.chive.admin.deleteContent'
    );
  });

  it('ignores a query string', () => {
    expect(lexiconMethodForPath('/xrpc/pub.chive.eprint.searchSubmissions?q=syntax')).toBe(
      'pub.chive.eprint.searchSubmissions'
    );
  });

  it('ignores trailing path segments', () => {
    expect(lexiconMethodForPath('/xrpc/pub.chive.actor.profile/extra')).toBe(
      'pub.chive.actor.profile'
    );
  });

  // REST routes carry no lexicon method; `lxm` does not scope them, so passing
  // nothing leaves those tokens checked exactly as before.
  it.each([
    ['/v1/auth/orcid/callback'],
    ['/health'],
    ['/ready'],
    ['/metrics'],
    ['/.well-known/did.json'],
  ])('returns nothing for the non-XRPC path %s', (path) => {
    expect(lexiconMethodForPath(path)).toBeUndefined();
  });

  it('returns nothing for a bare xrpc prefix', () => {
    expect(lexiconMethodForPath('/xrpc/')).toBeUndefined();
  });

  // The escalation this closes: two different methods must never resolve to the
  // same scope string.
  it('distinguishes the methods that were previously interchangeable', () => {
    const low = lexiconMethodForPath('/xrpc/pub.chive.metrics.recordView');
    const high = lexiconMethodForPath('/xrpc/pub.chive.admin.deleteContent');
    expect(low).not.toBe(high);
    expect(high).toBe('pub.chive.admin.deleteContent');
  });
});
