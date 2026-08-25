/**
 * Unit tests for HTTP verb selection when registering XRPC methods.
 *
 * @remarks
 * A registered lexicon decides whether a method is a query (GET) or a procedure
 * (POST). When no lexicon is registered, the adapter fell through to `true` —
 * query — and ignored the method's own `type`. A handler declared as a
 * `procedure` was therefore mounted on GET, and every POST caller received a
 * 404 while a GET reached a handler expecting a body.
 */

import { Lexicons } from '@atproto/lexicon';
import { describe, it, expect, vi } from 'vitest';

import { createXRPCRouter } from '@/api/xrpc/hono-adapter.js';
import type { XRPCMethod } from '@/api/xrpc/types.js';

const handler = vi.fn().mockResolvedValue({ encoding: 'application/json', body: { ok: true } });

/** Registers one method on an empty lexicon set and returns the router. */
const register = (nsid: string, config: Partial<XRPCMethod<unknown, unknown, unknown>>) => {
  const xrpc = createXRPCRouter(new Lexicons());
  xrpc.method(nsid, { handler, ...config } as XRPCMethod<unknown, unknown, unknown>);
  return xrpc;
};

/** Reports the HTTP verbs Hono has routes registered for at a path. */
const verbsFor = (xrpc: ReturnType<typeof register>, path: string): string[] =>
  xrpc.router.routes.filter((r) => r.path === path).map((r) => r.method.toLowerCase());

describe('XRPC method verb registration without a lexicon', () => {
  it('registers a declared procedure on POST', () => {
    const xrpc = register('pub.chive.test.doThing', { type: 'procedure' });
    expect(verbsFor(xrpc, '/pub.chive.test.doThing')).toContain('post');
  });

  it('does not register a declared procedure on GET', () => {
    const xrpc = register('pub.chive.test.doThing', { type: 'procedure' });
    expect(verbsFor(xrpc, '/pub.chive.test.doThing')).not.toContain('get');
  });

  it('registers a declared query on GET', () => {
    const xrpc = register('pub.chive.test.getThing', { type: 'query' });
    expect(verbsFor(xrpc, '/pub.chive.test.getThing')).toContain('get');
  });

  // Query stays the default: most lexicon-less methods are reads, and changing
  // that would move existing endpoints off the verb their callers use.
  it('still defaults to GET when no type is declared', () => {
    const xrpc = register('pub.chive.test.unspecified', {});
    expect(verbsFor(xrpc, '/pub.chive.test.unspecified')).toContain('get');
  });
});
