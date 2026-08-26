/**
 * Tests for the production guard on the frontend E2E authentication bypass.
 *
 * @remarks
 * E2E mode makes the client send `X-E2E-Auth-Did`, which the API turns into an
 * identity — and `X-E2E-Auth-Admin` into an administrative one. It was enabled
 * by a single `localStorage` key with no environment guard, so anyone could run
 * `localStorage.setItem('chive_e2e_skip_oauth', 'true')` in a console on the
 * live site and have the client start sending those headers.
 *
 * The API stopped honouring them in production (SEC-4). But a bypass that
 * depends on the other side refusing it is not a control — the same build gets
 * pointed at non-production APIs during development — so the client no longer
 * offers it in a production build either.
 *
 * `NEXT_PUBLIC_E2E_TEST` still enables it, and that is deliberate: it is a
 * build-time value Playwright sets for its own runs, and it cannot be turned on
 * from a browser console.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Reimplements the guard so its logic can be exercised across environments.
 *
 * @remarks
 * `isE2ETestMode` is module-private and reads `process.env` values that Next
 * inlines at build time, so it cannot be re-evaluated per test by importing it.
 * This mirrors the predicate exactly; the companion test below asserts the real
 * source still matches, which is what keeps the two from drifting.
 */
const isE2ETestMode = (storage: Record<string, string>): boolean => {
  if (process.env.NEXT_PUBLIC_E2E_TEST === 'true') return true;
  if (process.env.NODE_ENV === 'production') return false;
  return storage.chive_e2e_skip_oauth === 'true';
};

describe('E2E bypass guard', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  // `NODE_ENV` is typed read-only, so it is stubbed rather than assigned.
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // The defect: a console one-liner on the live site turned this on.
  it('ignores the localStorage key in a production build', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_E2E_TEST', '');

    expect(isE2ETestMode({ chive_e2e_skip_oauth: 'true' })).toBe(false);
  });

  it('honours the localStorage key in development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_E2E_TEST', '');

    expect(isE2ETestMode({ chive_e2e_skip_oauth: 'true' })).toBe(true);
  });

  // Build-time, so Playwright still works and a console cannot set it.
  it('honours the build-time flag even in a production build', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_E2E_TEST', 'true');

    expect(isE2ETestMode({})).toBe(true);
  });

  it('stays off when nothing enables it', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_E2E_TEST', '');

    expect(isE2ETestMode({})).toBe(false);
  });
});

describe('the shipped guard matches', () => {
  const read = (relative: string): string => readFileSync(join(process.cwd(), relative), 'utf8');

  it('gates the localStorage route on a non-production build', () => {
    const source = read('lib/api/client.ts');

    expect(source).toMatch(/NODE_ENV === 'production'\) return false;/);
    expect(source).toMatch(/chive_e2e_skip_oauth/);
  });

  it('gates the mock session in the auth context too', () => {
    const source = read('lib/auth/auth-context.tsx');

    expect(source).toMatch(/e2eAllowed/);
    expect(source).toMatch(/NODE_ENV !== 'production'/);
  });
});
