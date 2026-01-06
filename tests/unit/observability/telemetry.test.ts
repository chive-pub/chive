/**
 * Unit tests for OpenTelemetry initialization.
 *
 * @remarks
 * Tests the telemetry module for SDK initialization and shutdown.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  initTelemetry,
  shutdownTelemetry,
  isTelemetryInitialized,
} from '../../../src/observability/telemetry.js';
import {
  getTracer,
  getActiveSpan,
  addSpanAttributes,
  recordSpanError,
  withSpan,
  withSpanSync,
  getTraceContext,
  SpanAttributes,
} from '../../../src/observability/tracer.js';

describe('Telemetry', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    originalEnv = { ...process.env };

    // Ensure telemetry is shut down before each test
    if (isTelemetryInitialized()) {
      await shutdownTelemetry();
    }
  });

  afterEach(async () => {
    process.env = originalEnv;

    // Clean up telemetry after each test
    if (isTelemetryInitialized()) {
      await shutdownTelemetry();
    }
  });

  describe('initTelemetry', () => {
    it('initializes telemetry with default options', () => {
      initTelemetry();
      expect(isTelemetryInitialized()).toBe(true);
    });

    it('initializes telemetry with custom options', () => {
      initTelemetry({
        serviceName: 'test-service',
        serviceVersion: '1.0.0',
        environment: 'test',
      });
      expect(isTelemetryInitialized()).toBe(true);
    });

    it('reads service name from environment variable', () => {
      process.env.OTEL_SERVICE_NAME = 'env-service';
      initTelemetry();
      expect(isTelemetryInitialized()).toBe(true);
    });

    it('reads endpoint from environment variable', () => {
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:4318';
      initTelemetry();
      expect(isTelemetryInitialized()).toBe(true);
    });

    it('warns when called multiple times', () => {
      const consoleSpy = vi.spyOn(console, 'warn');

      initTelemetry();
      initTelemetry(); // Second call should warn

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Already initialized'));

      consoleSpy.mockRestore();
    });

    it('logs initialization message', () => {
      const consoleSpy = vi.spyOn(console, 'log');

      initTelemetry({ serviceName: 'test-service' });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('OpenTelemetry SDK initialized'),
        expect.objectContaining({ service: 'test-service' })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('shutdownTelemetry', () => {
    it('shuts down initialized telemetry', async () => {
      initTelemetry();
      expect(isTelemetryInitialized()).toBe(true);

      await shutdownTelemetry();
      expect(isTelemetryInitialized()).toBe(false);
    });

    it('warns when shutting down uninitialized telemetry', async () => {
      const consoleSpy = vi.spyOn(console, 'warn');

      await shutdownTelemetry();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Not initialized'));

      consoleSpy.mockRestore();
    });

    it('logs shutdown message', async () => {
      initTelemetry();

      const consoleSpy = vi.spyOn(console, 'log');
      await shutdownTelemetry();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('SDK shut down successfully')
      );

      consoleSpy.mockRestore();
    });

    it('allows re-initialization after shutdown', async () => {
      initTelemetry();
      await shutdownTelemetry();

      initTelemetry();
      expect(isTelemetryInitialized()).toBe(true);
    });
  });

  describe('isTelemetryInitialized', () => {
    it('returns false when not initialized', () => {
      expect(isTelemetryInitialized()).toBe(false);
    });

    it('returns true after initialization', () => {
      initTelemetry();
      expect(isTelemetryInitialized()).toBe(true);
    });

    it('returns false after shutdown', async () => {
      initTelemetry();
      await shutdownTelemetry();
      expect(isTelemetryInitialized()).toBe(false);
    });
  });

  describe('TelemetryOptions', () => {
    it('accepts metricExportIntervalMs option', () => {
      initTelemetry({ metricExportIntervalMs: 30000 });
      expect(isTelemetryInitialized()).toBe(true);
    });

    it('accepts otlpEndpoint option', () => {
      initTelemetry({ otlpEndpoint: 'http://custom-collector:4318' });
      expect(isTelemetryInitialized()).toBe(true);
    });

    it('accepts autoInstrumentation option', () => {
      initTelemetry({
        autoInstrumentation: {
          http: true,
          pg: false,
          redis: true,
        },
      });
      expect(isTelemetryInitialized()).toBe(true);
    });
  });
});

describe('Tracer utilities', () => {
  beforeEach(() => {
    // Initialize telemetry before tracer tests
    if (!isTelemetryInitialized()) {
      initTelemetry({ serviceName: 'tracer-test' });
    }
  });

  afterEach(async () => {
    if (isTelemetryInitialized()) {
      await shutdownTelemetry();
    }
  });

  describe('getTracer', () => {
    it('returns a tracer instance', () => {
      const tracer = getTracer();
      expect(tracer).toBeDefined();
      expect(typeof tracer.startSpan).toBe('function');
    });
  });

  describe('getActiveSpan', () => {
    it('returns undefined when no span is active', () => {
      const span = getActiveSpan();
      expect(span).toBeUndefined();
    });
  });

  describe('withSpan', () => {
    it('executes function within span', async () => {
      let executed = false;
      await withSpan('test-span', () => {
        executed = true;
      });
      expect(executed).toBe(true);
    });

    it('returns function result', async () => {
      const result = await withSpan('test-span', () => {
        return 42;
      });
      expect(result).toBe(42);
    });

    it('propagates errors', async () => {
      await expect(
        withSpan('error-span', () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');
    });

    it('accepts attributes option', async () => {
      await withSpan('attributed-span', async () => {}, {
        attributes: { 'test.attribute': 'value' },
      });
      // Span should be created with attributes
    });
  });

  describe('withSpanSync', () => {
    it('executes synchronous function within span', () => {
      let executed = false;
      withSpanSync('sync-span', () => {
        executed = true;
      });
      expect(executed).toBe(true);
    });

    it('returns function result', () => {
      const result = withSpanSync('sync-span', () => {
        return 'sync result';
      });
      expect(result).toBe('sync result');
    });

    it('propagates errors', () => {
      expect(() =>
        withSpanSync('sync-error-span', () => {
          throw new Error('Sync error');
        })
      ).toThrow('Sync error');
    });
  });

  describe('addSpanAttributes', () => {
    it('does not throw when no span is active', () => {
      expect(() => {
        addSpanAttributes({ 'test.key': 'value' });
      }).not.toThrow();
    });
  });

  describe('recordSpanError', () => {
    it('does not throw when no span is active', () => {
      expect(() => {
        recordSpanError(new Error('Test'));
      }).not.toThrow();
    });
  });

  describe('getTraceContext', () => {
    it('returns null when no span is active', () => {
      const ctx = getTraceContext();
      expect(ctx).toBeNull();
    });
  });

  describe('SpanAttributes', () => {
    it('defines HTTP attributes', () => {
      expect(SpanAttributes.HTTP_METHOD).toBe('http.method');
      expect(SpanAttributes.HTTP_ROUTE).toBe('http.route');
      expect(SpanAttributes.HTTP_STATUS_CODE).toBe('http.status_code');
    });

    it('defines database attributes', () => {
      expect(SpanAttributes.DB_SYSTEM).toBe('db.system');
      expect(SpanAttributes.DB_NAME).toBe('db.name');
      expect(SpanAttributes.DB_OPERATION).toBe('db.operation');
    });

    it('defines Chive-specific attributes', () => {
      expect(SpanAttributes.PREPRINT_URI).toBe('chive.preprint.uri');
      expect(SpanAttributes.USER_DID).toBe('chive.user.did');
      expect(SpanAttributes.REQUEST_ID).toBe('chive.request.id');
    });
  });
});
