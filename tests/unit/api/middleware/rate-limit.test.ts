/**
 * Unit tests for rate limiting middleware.
 *
 * @remarks
 * Tests the rate limiting middleware structure and configuration.
 * Full integration tests with Redis are in tests/integration/api/.
 */

import { describe, it, expect } from 'vitest';

import { rateLimiter, conditionalRateLimiter } from '@/api/middleware/rate-limit.js';

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
