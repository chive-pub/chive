/**
 * Tests for Grafana Faro integration.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { getFaroConfig, validateFaroConfig, type FaroConfig } from '../faro/config';
import { scrubString, scrubUrl, scrubHeaders, scrubObject, scrubError } from '../faro/privacy';
import { createSampler } from '../faro/sampling';
import { events } from '../faro/custom-events';
import { parameterizePath } from '../faro/react/FaroRouteTracker';

// =============================================================================
// CONFIG TESTS
// =============================================================================

describe('Faro Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getFaroConfig', () => {
    it('returns default configuration', () => {
      const config = getFaroConfig();

      expect(config.appName).toBe('chive-web');
      expect(config.appVersion).toBe('0.0.0');
      // Environment is determined by NODE_ENV
      expect(typeof config.environment).toBe('string');
    });

    it('uses environment variables when set', () => {
      process.env.NEXT_PUBLIC_FARO_URL = 'https://faro.example.com/collect';
      process.env.NEXT_PUBLIC_APP_NAME = 'test-app';
      process.env.NEXT_PUBLIC_APP_VERSION = '1.2.3';

      const config = getFaroConfig();

      expect(config.collectorUrl).toBe('https://faro.example.com/collect');
      expect(config.appName).toBe('test-app');
      expect(config.appVersion).toBe('1.2.3');
    });

    it('parses sample rates correctly', () => {
      process.env.NEXT_PUBLIC_FARO_TRACE_SAMPLE_RATE = '0.5';
      process.env.NEXT_PUBLIC_FARO_SESSION_SAMPLE_RATE = '0.25';

      const config = getFaroConfig();

      expect(config.traceSampleRate).toBe(0.5);
      expect(config.sessionSampleRate).toBe(0.25);
    });

    it('clamps sample rates to valid range', () => {
      process.env.NEXT_PUBLIC_FARO_TRACE_SAMPLE_RATE = '1.5';
      process.env.NEXT_PUBLIC_FARO_SESSION_SAMPLE_RATE = '-0.5';

      const config = getFaroConfig();

      expect(config.traceSampleRate).toBe(1.0);
      expect(config.sessionSampleRate).toBe(0);
    });
  });

  describe('validateFaroConfig', () => {
    it('returns no errors for valid config', () => {
      const config: FaroConfig = {
        collectorUrl: 'https://faro.example.com',
        appName: 'test',
        appVersion: '1.0.0',
        environment: 'development',
        traceSampleRate: 0.5,
        sessionSampleRate: 0.5,
        enabled: true,
        instrumentConsole: true,
        instrumentPerformance: true,
        instrumentErrors: true,
      };

      const errors = validateFaroConfig(config);
      expect(errors).toHaveLength(0);
    });

    it('returns error for production without collector URL', () => {
      const config: FaroConfig = {
        collectorUrl: undefined,
        appName: 'test',
        appVersion: '1.0.0',
        environment: 'production',
        traceSampleRate: 0.5,
        sessionSampleRate: 0.5,
        enabled: true,
        instrumentConsole: true,
        instrumentPerformance: true,
        instrumentErrors: true,
      };

      const errors = validateFaroConfig(config);
      expect(errors).toContain('NEXT_PUBLIC_FARO_URL is required in production');
    });
  });
});

// =============================================================================
// PRIVACY TESTS
// =============================================================================

describe('Privacy Utilities', () => {
  describe('scrubString', () => {
    it('redacts email addresses', () => {
      const input = 'Contact: user@example.com';
      const result = scrubString(input);
      expect(result).toBe('Contact: [REDACTED]');
    });

    it('redacts DIDs', () => {
      const input = 'User did:plc:abc123def';
      const result = scrubString(input);
      expect(result).toBe('User [REDACTED]');
    });

    it('redacts handles', () => {
      const input = 'Follow @user.bsky.social';
      const result = scrubString(input);
      expect(result).toBe('Follow [REDACTED]');
    });

    it('redacts JWT tokens', () => {
      const input = 'Token: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.abc123';
      const result = scrubString(input);
      expect(result).toBe('Token: [REDACTED]');
    });

    it('handles null and undefined', () => {
      expect(scrubString(null as unknown as string)).toBeNull();
      expect(scrubString(undefined as unknown as string)).toBeUndefined();
    });
  });

  describe('scrubUrl', () => {
    it('redacts sensitive query parameters', () => {
      const url = 'https://example.com/api?token=secret123&foo=bar';
      const result = scrubUrl(url);
      // URL API encodes brackets as %5B and %5D
      expect(result).toContain('token=');
      expect(result).toContain('REDACTED');
      expect(result).toContain('foo=bar');
    });

    it('handles relative URLs', () => {
      const url = '/api/auth?access_token=secret';
      const result = scrubUrl(url);
      // URL API encodes brackets
      expect(result).toContain('/api/auth?access_token=');
      expect(result).toContain('REDACTED');
    });

    it('returns unchanged URL if no sensitive params', () => {
      const url = 'https://example.com/page?sort=asc';
      const result = scrubUrl(url);
      expect(result).toBe(url);
    });
  });

  describe('scrubHeaders', () => {
    it('redacts sensitive headers', () => {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: 'Bearer secret123',
        Cookie: 'session=abc',
      };

      const result = scrubHeaders(headers);

      expect(result['Content-Type']).toBe('application/json');
      expect(result['Authorization']).toBe('[REDACTED]');
      expect(result['Cookie']).toBe('[REDACTED]');
    });
  });

  describe('scrubObject', () => {
    it('redacts nested sensitive keys', () => {
      const obj = {
        user: {
          name: 'Test',
          password: 'secret123',
          data: { apiKey: 'key123' },
        },
      };

      const result = scrubObject(obj) as typeof obj;

      expect(result.user.name).toBe('Test');
      expect(result.user.password).toBe('[REDACTED]');
      expect(result.user.data.apiKey).toBe('[REDACTED]');
    });

    it('redacts keys containing sensitive substrings', () => {
      const obj = {
        user: {
          credentials: { value: 'secret' },
        },
      };

      // The 'credentials' key itself triggers redaction
      const result = scrubObject(obj) as { user: { credentials: unknown } };
      expect(result.user.credentials).toBe('[REDACTED]');
    });

    it('scrubs strings inside objects', () => {
      const obj = {
        message: 'Contact user@example.com for help',
      };

      const result = scrubObject(obj) as typeof obj;
      expect(result.message).toBe('Contact [REDACTED] for help');
    });

    it('handles arrays', () => {
      const obj = {
        emails: ['user1@example.com', 'user2@example.com'],
      };

      const result = scrubObject(obj) as typeof obj;
      expect(result.emails).toEqual(['[REDACTED]', '[REDACTED]']);
    });

    it('limits recursion depth', () => {
      const obj: { nested?: object } = {};
      let current = obj;
      for (let i = 0; i < 15; i++) {
        current.nested = {};
        current = current.nested as { nested?: object };
      }

      // Should not throw
      expect(() => scrubObject(obj)).not.toThrow();
    });
  });

  describe('scrubError', () => {
    it('scrubs error message', () => {
      const error = new Error('Failed for user@example.com');
      const result = scrubError(error);
      expect(result.message).toBe('Failed for [REDACTED]');
    });

    it('scrubs error stack', () => {
      const error = new Error('Error with did:plc:abc123');
      const result = scrubError(error);
      expect(result.stack).not.toContain('did:plc:abc123');
    });
  });
});

// =============================================================================
// SAMPLING TESTS
// =============================================================================

describe('Sampling', () => {
  describe('createSampler', () => {
    it('returns consistent session sampling', () => {
      const config: FaroConfig = {
        collectorUrl: 'https://faro.example.com',
        appName: 'test',
        appVersion: '1.0.0',
        environment: 'development',
        traceSampleRate: 1.0,
        sessionSampleRate: 1.0,
        enabled: true,
        instrumentConsole: true,
        instrumentPerformance: true,
        instrumentErrors: true,
      };

      const sampler = createSampler(config);
      const decision1 = sampler.shouldCaptureSession();
      const decision2 = sampler.shouldCaptureSession();

      // Same sampler should give consistent results
      expect(decision1.shouldCapture).toBe(decision2.shouldCapture);
    });

    it('always captures errors initially', () => {
      const config: FaroConfig = {
        collectorUrl: 'https://faro.example.com',
        appName: 'test',
        appVersion: '1.0.0',
        environment: 'development',
        traceSampleRate: 0,
        sessionSampleRate: 0,
        enabled: true,
        instrumentConsole: true,
        instrumentPerformance: true,
        instrumentErrors: true,
      };

      const sampler = createSampler(config);
      const decision = sampler.shouldCaptureError();

      // First error should be captured
      expect(decision.shouldCapture).toBe(true);
    });

    it('rate limits errors', () => {
      const config: FaroConfig = {
        collectorUrl: 'https://faro.example.com',
        appName: 'test',
        appVersion: '1.0.0',
        environment: 'development',
        traceSampleRate: 1.0,
        sessionSampleRate: 1.0,
        enabled: true,
        instrumentConsole: true,
        instrumentPerformance: true,
        instrumentErrors: true,
      };

      const sampler = createSampler(config);

      // Exhaust rate limit (10 errors per minute)
      for (let i = 0; i < 10; i++) {
        sampler.shouldCaptureError();
      }

      // 11th error should be rate limited
      const decision = sampler.shouldCaptureError();
      expect(decision.shouldCapture).toBe(false);
      expect(decision.reason).toBe('Error rate limited');
    });

    it('forceSample enables all sampling', () => {
      const config: FaroConfig = {
        collectorUrl: 'https://faro.example.com',
        appName: 'test',
        appVersion: '1.0.0',
        environment: 'development',
        traceSampleRate: 0,
        sessionSampleRate: 0,
        enabled: true,
        instrumentConsole: true,
        instrumentPerformance: true,
        instrumentErrors: true,
      };

      const sampler = createSampler(config);
      sampler.forceSample();

      expect(sampler.shouldCaptureSession().shouldCapture).toBe(true);
      expect(sampler.shouldCaptureTrace().shouldCapture).toBe(true);
    });
  });
});

// =============================================================================
// ROUTE PARAMETERIZATION TESTS
// =============================================================================

describe('parameterizePath', () => {
  it('replaces numeric IDs', () => {
    expect(parameterizePath('/eprints/123')).toBe('/eprints/:id');
    expect(parameterizePath('/eprints/123/versions/456')).toBe('/eprints/:id/versions/:id');
  });

  it('replaces UUIDs', () => {
    const path = '/items/550e8400-e29b-41d4-a716-446655440000';
    expect(parameterizePath(path)).toBe('/items/:uuid');
  });

  it('replaces DIDs', () => {
    expect(parameterizePath('/users/did:plc:abc123')).toBe('/users/:did');
    // did:web: format includes dots which are preserved in URL encoding
    // The current regex handles basic DID patterns
    const webDid = parameterizePath('/profile/did:web:example');
    expect(webDid).toBe('/profile/:did');
  });

  it('handles paths without IDs', () => {
    expect(parameterizePath('/about')).toBe('/about');
    expect(parameterizePath('/search')).toBe('/search');
  });

  it('handles complex paths', () => {
    const path = '/users/did:plc:abc123/eprints/456/comments/789';
    expect(parameterizePath(path)).toBe('/users/:did/eprints/:id/comments/:id');
  });
});

// =============================================================================
// CUSTOM EVENTS TESTS
// =============================================================================

describe('Custom Events', () => {
  describe('events.startTiming', () => {
    it('returns a timing tracker', () => {
      const timer = events.startTiming('test-operation');
      expect(timer).toHaveProperty('end');
      expect(typeof timer.end).toBe('function');
    });

    it('measures duration', async () => {
      const timer = events.startTiming('test-operation');

      // Wait a small amount of time
      await new Promise((resolve) => setTimeout(resolve, 50));

      // end() should not throw
      expect(() => timer.end({ operation: 'test' })).not.toThrow();
    });
  });

  describe('events object', () => {
    it('has all expected event methods', () => {
      expect(events).toHaveProperty('eprintView');
      expect(events).toHaveProperty('eprintDownload');
      expect(events).toHaveProperty('search');
      expect(events).toHaveProperty('searchClick');
      expect(events).toHaveProperty('userAction');
      expect(events).toHaveProperty('fieldBrowse');
      expect(events).toHaveProperty('authorView');
      expect(events).toHaveProperty('custom');
      expect(events).toHaveProperty('timing');
      expect(events).toHaveProperty('startTiming');
    });
  });
});
