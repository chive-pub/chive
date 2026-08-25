/**
 * Unit tests for the production guard on the E2E authentication bypass.
 *
 * @remarks
 * `ENABLE_E2E_AUTH_BYPASS` turns `X-E2E-Auth-Did` into an identity and
 * `X-E2E-Auth-Admin: true` into full administrative access, and both header
 * names are in the production CORS allowlist. Before this guard, an unset
 * environment variable was the only thing separating a production deploy from
 * an open admin door. Two independent protections are pinned here: the process
 * refuses to boot when the flag is set in production, and the middleware
 * ignores the flag there even if a boot check is bypassed.
 */

import { describe, it, expect } from 'vitest';

import { assertNoAuthBypassInProduction } from '@/api/middleware/auth.js';

describe('assertNoAuthBypassInProduction', () => {
  it('refuses to start a production process with the bypass enabled', () => {
    expect(() =>
      assertNoAuthBypassInProduction({
        NODE_ENV: 'production',
        ENABLE_E2E_AUTH_BYPASS: 'true',
      })
    ).toThrow(/ENABLE_E2E_AUTH_BYPASS is set in production/);
  });

  it('allows a production process with the bypass unset', () => {
    expect(() => assertNoAuthBypassInProduction({ NODE_ENV: 'production' })).not.toThrow();
  });

  it('allows a production process with the bypass explicitly disabled', () => {
    expect(() =>
      assertNoAuthBypassInProduction({ NODE_ENV: 'production', ENABLE_E2E_AUTH_BYPASS: 'false' })
    ).not.toThrow();
  });

  it.each([['development'], ['test'], [undefined]])(
    'permits the bypass when NODE_ENV is %s',
    (nodeEnv) => {
      expect(() =>
        assertNoAuthBypassInProduction({
          ...(nodeEnv === undefined ? {} : { NODE_ENV: nodeEnv }),
          ENABLE_E2E_AUTH_BYPASS: 'true',
        })
      ).not.toThrow();
    }
  );

  // Only the exact string 'true' enables it, so a stray value cannot arm the
  // bypass and equally must not block a boot.
  it('ignores a non-boolean value for the flag', () => {
    expect(() =>
      assertNoAuthBypassInProduction({ NODE_ENV: 'production', ENABLE_E2E_AUTH_BYPASS: '1' })
    ).not.toThrow();
  });
});
