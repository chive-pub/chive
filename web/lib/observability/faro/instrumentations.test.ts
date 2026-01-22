/**
 * Tests for OpenTelemetry instrumentations.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock OpenTelemetry instrumentation modules
vi.mock('@opentelemetry/instrumentation-fetch', () => ({
  FetchInstrumentation: vi.fn(() => ({
    _type: 'FetchInstrumentation',
  })),
}));

vi.mock('@opentelemetry/instrumentation-document-load', () => ({
  DocumentLoadInstrumentation: vi.fn(() => ({
    _type: 'DocumentLoadInstrumentation',
  })),
}));

vi.mock('@opentelemetry/instrumentation-user-interaction', () => ({
  UserInteractionInstrumentation: vi.fn(() => ({
    _type: 'UserInteractionInstrumentation',
  })),
}));

// Mock privacy module
vi.mock('./privacy', () => ({
  scrubUrl: vi.fn((url: string) => url.replace(/\?.*$/, '')),
}));

import {
  createInstrumentations,
  createFetchInstrumentation,
  createDocumentLoadInstrumentation,
  createUserInteractionInstrumentation,
  injectTraceContext,
  createSpanName,
  TRACE_CONTEXT_HEADERS,
} from './instrumentations';

import type { FaroConfig } from './config';

describe('Instrumentations', () => {
  const defaultConfig: FaroConfig = {
    collectorUrl: 'https://faro.example.com',
    appName: 'test-app',
    appVersion: '1.0.0',
    environment: 'test',
    traceSampleRate: 1.0,
    sessionSampleRate: 1.0,
    enabled: true,
    instrumentConsole: true,
    instrumentPerformance: true,
    instrumentErrors: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createInstrumentations', () => {
    it('creates array of instrumentations', () => {
      const instrumentations = createInstrumentations(defaultConfig);

      expect(Array.isArray(instrumentations)).toBe(true);
      expect(instrumentations.length).toBeGreaterThan(0);
    });

    it('includes fetch instrumentation', () => {
      const instrumentations = createInstrumentations(defaultConfig);

      // Should have at least fetch instrumentation
      expect(instrumentations.length).toBeGreaterThanOrEqual(1);
    });

    it('includes performance instrumentations when enabled', () => {
      const config = { ...defaultConfig, instrumentPerformance: true };
      const instrumentations = createInstrumentations(config);

      // Should have fetch + document load + user interaction
      expect(instrumentations.length).toBe(3);
    });

    it('excludes performance instrumentations when disabled', () => {
      const config = { ...defaultConfig, instrumentPerformance: false };
      const instrumentations = createInstrumentations(config);

      // Should only have fetch
      expect(instrumentations.length).toBe(1);
    });
  });

  describe('createFetchInstrumentation', () => {
    it('creates fetch instrumentation', async () => {
      const { FetchInstrumentation } = await import('@opentelemetry/instrumentation-fetch');

      createFetchInstrumentation(defaultConfig);

      expect(FetchInstrumentation).toHaveBeenCalled();
    });

    it('passes config options to FetchInstrumentation', async () => {
      const { FetchInstrumentation } = await import('@opentelemetry/instrumentation-fetch');

      createFetchInstrumentation(defaultConfig);

      expect(FetchInstrumentation).toHaveBeenCalledWith(
        expect.objectContaining({
          propagateTraceHeaderCorsUrls: expect.any(Array),
          ignoreUrls: expect.any(Array),
        })
      );
    });
  });

  describe('createDocumentLoadInstrumentation', () => {
    it('creates document load instrumentation', async () => {
      const { DocumentLoadInstrumentation } =
        await import('@opentelemetry/instrumentation-document-load');

      createDocumentLoadInstrumentation(defaultConfig);

      expect(DocumentLoadInstrumentation).toHaveBeenCalled();
    });
  });

  describe('createUserInteractionInstrumentation', () => {
    it('creates user interaction instrumentation', async () => {
      const { UserInteractionInstrumentation } =
        await import('@opentelemetry/instrumentation-user-interaction');

      createUserInteractionInstrumentation(defaultConfig);

      expect(UserInteractionInstrumentation).toHaveBeenCalled();
    });
  });

  describe('injectTraceContext', () => {
    it('returns headers unchanged (simplified implementation)', () => {
      const existingHeaders = {
        'Content-Type': 'application/json',
      };

      const result = injectTraceContext(existingHeaders);

      expect(result['Content-Type']).toBe('application/json');
    });

    it('creates copy of headers', () => {
      const existingHeaders = {
        'Content-Type': 'application/json',
      };

      const result = injectTraceContext(existingHeaders);

      // Should be a new object
      expect(result).not.toBe(existingHeaders);
      expect(result).toEqual(existingHeaders);
    });
  });

  describe('createSpanName', () => {
    it('creates span name for fetch request', () => {
      const name = createSpanName('GET', 'https://api.example.com/users');

      expect(name).toBe('GET /users');
    });

    it('handles relative URLs', () => {
      const name = createSpanName('POST', '/api/eprints');

      expect(name).toBe('POST /api/eprints');
    });

    it('handles edge cases', () => {
      expect(createSpanName('GET', '/')).toBe('GET /');
      expect(createSpanName('DELETE', '/api')).toBe('DELETE /api');
    });

    it('handles full URLs with paths', () => {
      const name = createSpanName('PUT', 'https://api.example.com/users/123/profile');

      expect(name).toBe('PUT /users/123/profile');
    });
  });

  describe('TRACE_CONTEXT_HEADERS', () => {
    it('exports traceparent header name', () => {
      expect(TRACE_CONTEXT_HEADERS).toContain('traceparent');
    });

    it('exports tracestate header name', () => {
      expect(TRACE_CONTEXT_HEADERS).toContain('tracestate');
    });

    it('is an array with two elements', () => {
      expect(Array.isArray(TRACE_CONTEXT_HEADERS)).toBe(true);
      expect(TRACE_CONTEXT_HEADERS).toHaveLength(2);
    });
  });
});

describe('Instrumentation configuration', () => {
  it('respects instrumentation flags in config', () => {
    const config: FaroConfig = {
      collectorUrl: 'https://faro.example.com',
      appName: 'test-app',
      appVersion: '1.0.0',
      environment: 'test',
      traceSampleRate: 1.0,
      sessionSampleRate: 1.0,
      enabled: true,
      instrumentConsole: false,
      instrumentPerformance: false,
      instrumentErrors: false,
    };

    // Should still create instrumentations but with different configuration
    const instrumentations = createInstrumentations(config);
    expect(Array.isArray(instrumentations)).toBe(true);
    // Only fetch instrumentation when performance is disabled
    expect(instrumentations.length).toBe(1);
  });
});
