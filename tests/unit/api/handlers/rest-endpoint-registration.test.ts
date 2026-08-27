import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import { claimingRestEndpoints } from '@/api/handlers/xrpc/claiming/index.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const registration = readFileSync(join(REPO_ROOT, 'src/api/handlers/xrpc/index.ts'), 'utf8');

const block = registration.slice(
  registration.indexOf('// Register REST-style endpoints'),
  registration.length
);

/**
 * `RESTEndpoint` declares `auth`, `rateLimit` and five HTTP methods. The
 * registration loop honoured two of the methods and neither field, so the
 * metadata was decorative: an endpoint declaring `auth: 'required'` was
 * protected only if its handler remembered to check, and one declaring PUT,
 * DELETE or PATCH was registered nowhere at all — a 404 with nothing said at
 * startup.
 */
describe('REST endpoint registration honours declared metadata', () => {
  it('registers every method the type admits', () => {
    for (const verb of ['get', 'post', 'put', 'delete', 'patch']) {
      expect(block, `app.${verb} missing`).toContain(`app.${verb}(endpoint.path`);
    }
  });

  it('applies authentication when the endpoint requires it', () => {
    expect(block).toContain("endpoint.auth === 'required'");
    expect(block).toContain('requireAuth()');
  });

  it('applies the declared rate-limit tier', () => {
    expect(block).toContain('RATE_LIMITS[endpoint.rateLimit]');
    expect(block).toContain('rateLimiter(');
  });

  it('fails at startup on a method it cannot register', () => {
    // Silently skipping produced an endpoint that 404s in production with no
    // indication anywhere that it was never mounted.
    expect(block).toContain('Unsupported REST endpoint method');
    expect(block).toContain('const unreachable: never');
  });

  it('every declared endpoint names a method the loop handles', () => {
    const handled = new Set(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']);
    for (const endpoint of claimingRestEndpoints) {
      expect(handled, endpoint.path).toContain(endpoint.method);
    }
  });

  it('every declared endpoint names a real rate-limit tier', () => {
    const tiers = new Set(['anonymous', 'authenticated', 'admin']);
    for (const endpoint of claimingRestEndpoints) {
      expect(tiers, endpoint.path).toContain(endpoint.rateLimit);
    }
  });
});
