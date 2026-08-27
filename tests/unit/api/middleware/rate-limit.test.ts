/**
 * Unit tests for rate limiting middleware.
 *
 * @remarks
 * Tests the rate limiting middleware structure and configuration.
 * Full integration tests with Redis are in tests/integration/api/.
 */

import { describe, it, expect, afterEach } from 'vitest';

import { rateLimiter, conditionalRateLimiter, getClientIP } from '@/api/middleware/rate-limit.js';

describe('Rate Limiting Middleware', () => {
  describe('rateLimiter', () => {
    it('returns a middleware function', () => {
      const middleware = rateLimiter({ anonymous: 60 });
      expect(typeof middleware).toBe('function');
    });

    it('accepts custom tier limits', () => {
      const middleware = rateLimiter({
        anonymous: 100,
        authenticated: 500,
        premium: 2000,
        admin: 10000,
      });
      expect(typeof middleware).toBe('function');
    });

    it('works with no arguments for default limits', () => {
      const middleware = rateLimiter();
      expect(typeof middleware).toBe('function');
    });
  });

  describe('conditionalRateLimiter', () => {
    it('returns a middleware function', () => {
      const middleware = conditionalRateLimiter(() => true);
      expect(typeof middleware).toBe('function');
    });

    it('accepts condition function to skip rate limiting', () => {
      const middleware = conditionalRateLimiter((c) => c.req.header('X-Skip-RateLimit') !== 'true');
      expect(typeof middleware).toBe('function');
    });
  });
});

describe('getClientIP', () => {
  const saved = process.env.TRUSTED_PROXY_COUNT;

  afterEach(() => {
    if (saved === undefined) delete process.env.TRUSTED_PROXY_COUNT;
    else process.env.TRUSTED_PROXY_COUNT = saved;
  });

  const ctx = (
    headers: Record<string, string>
  ): { req: { header: (name: string) => string | undefined } } => ({
    req: { header: (name: string): string | undefined => headers[name.toLowerCase()] },
  });

  it('reads the entry the trusted proxy appended, not the one the client sent', () => {
    delete process.env.TRUSTED_PROXY_COUNT;
    // The client sent 9.9.9.9; Traefik appended the address it actually saw.
    // Reading left-to-right returns the forgery, which is how anonymous limits
    // used to be defeated by varying one header.
    expect(getClientIP(ctx({ 'x-forwarded-for': '9.9.9.9, 203.0.113.7' }))).toBe('203.0.113.7');
  });

  it('accepts a single entry when one proxy is trusted', () => {
    delete process.env.TRUSTED_PROXY_COUNT;
    expect(getClientIP(ctx({ 'x-forwarded-for': '203.0.113.7' }))).toBe('203.0.113.7');
  });

  it('ignores however many entries the client prepends', () => {
    delete process.env.TRUSTED_PROXY_COUNT;
    const spoofed = '1.1.1.1, 2.2.2.2, 3.3.3.3, 203.0.113.7';
    expect(getClientIP(ctx({ 'x-forwarded-for': spoofed }))).toBe('203.0.113.7');
  });

  it('counts back from the right when several proxies are trusted', () => {
    process.env.TRUSTED_PROXY_COUNT = '2';
    expect(getClientIP(ctx({ 'x-forwarded-for': '9.9.9.9, 203.0.113.7, 10.0.0.1' }))).toBe(
      '203.0.113.7'
    );
  });

  it('refuses to guess when the header is shorter than the proxy chain', () => {
    process.env.TRUSTED_PROXY_COUNT = '2';
    expect(getClientIP(ctx({ 'x-forwarded-for': '203.0.113.7' }))).toBe('unknown');
  });

  it('trusts no forwarding header when no proxy is configured', () => {
    process.env.TRUSTED_PROXY_COUNT = '0';
    expect(getClientIP(ctx({ 'x-forwarded-for': '203.0.113.7' }))).toBe('unknown');
  });

  it('does not fall back to headers a client can set outright', () => {
    delete process.env.TRUSTED_PROXY_COUNT;
    // X-Real-IP and CF-Connecting-IP carry a single value with no chain, so a
    // client setting one is indistinguishable from a proxy setting it.
    expect(getClientIP(ctx({ 'x-real-ip': '9.9.9.9' }))).toBe('unknown');
    expect(getClientIP(ctx({ 'cf-connecting-ip': '9.9.9.9' }))).toBe('unknown');
  });

  it('returns unknown rather than a loopback address when nothing is present', () => {
    delete process.env.TRUSTED_PROXY_COUNT;
    // The old 127.0.0.1 fallback put every unattributable request in the same
    // bucket as genuine loopback traffic.
    expect(getClientIP(ctx({}))).toBe('unknown');
  });

  it('tolerates whitespace and empty entries', () => {
    delete process.env.TRUSTED_PROXY_COUNT;
    expect(getClientIP(ctx({ 'x-forwarded-for': ' 9.9.9.9 , , 203.0.113.7 ' }))).toBe(
      '203.0.113.7'
    );
  });

  it('falls back to one proxy when the setting is not a number', () => {
    process.env.TRUSTED_PROXY_COUNT = 'not-a-number';
    expect(getClientIP(ctx({ 'x-forwarded-for': '9.9.9.9, 203.0.113.7' }))).toBe('203.0.113.7');
  });
});
