/**
 * Unit tests for the single resolution of a method's HTTP verb.
 *
 * @remarks
 * The verb was decided in two places from different inputs. The runtime router
 * asked the lexicon and fell back to the handler's declared `type`; the OpenAPI
 * generator looked only at `type`. When they disagreed, the generated client
 * was built against a verb the server did not serve.
 *
 * That is the concrete chain behind `dismissSuggestion`: it declared
 * `procedure` with no lexicon, so the spec said POST while the router mounted
 * GET, and every generated call 404ed. Both now resolve through one function.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

import { resolveMethodType } from '@/api/xrpc/validation.js';

const read = (relative: string): string => readFileSync(join(process.cwd(), relative), 'utf8');

describe('resolveMethodType', () => {
  // A published lexicon is the contract, so it outranks the declaration.
  it('prefers the lexicon over a conflicting declaration', () => {
    expect(resolveMethodType('pub.chive.eprint.searchSubmissions', 'procedure')).toBe('query');
  });

  it('agrees with the lexicon when the declaration matches', () => {
    expect(resolveMethodType('pub.chive.eprint.searchSubmissions', 'query')).toBe('query');
  });

  it('falls back to the declaration when no lexicon is registered', () => {
    expect(resolveMethodType('pub.chive.not.aRealMethod', 'procedure')).toBe('procedure');
  });

  // Most lexicon-less methods are reads, and defaulting the other way would
  // move existing endpoints off the verb their callers already use.
  it('defaults to query when neither says', () => {
    expect(resolveMethodType('pub.chive.not.aRealMethod')).toBe('query');
  });

  it('resolves the method that exposed the divergence', () => {
    expect(resolveMethodType('pub.chive.claiming.dismissSuggestion', 'procedure')).toBe(
      'procedure'
    );
  });
});

describe('both consumers use the shared resolver', () => {
  it('the router does', () => {
    expect(read('src/api/handlers/xrpc/index.ts')).toMatch(
      /resolveMethodType\(nsid, method\.type\)/
    );
  });

  it('the OpenAPI generator does', () => {
    expect(read('src/api/openapi/index.ts')).toMatch(/resolveMethodType\(nsid, method\.type\)/);
  });

  // The bug was the generator deciding on its own; make sure it cannot again.
  it('the OpenAPI generator no longer decides from the declaration alone', () => {
    expect(read('src/api/openapi/index.ts')).not.toMatch(
      /method\.type === 'procedure' \? 'post' : 'get'/
    );
  });
});
