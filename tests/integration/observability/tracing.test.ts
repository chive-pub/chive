/**
 * Integration tests for distributed tracing.
 *
 * @remarks
 * Tests the complete tracing flow including span creation,
 * context propagation, and trace export.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import {
  initTelemetry,
  shutdownTelemetry,
  isTelemetryInitialized,
  withSpan,
  withSpanSync,
  withChildSpans,
  getTracer,
  getActiveSpan,
  addSpanAttributes,
  recordSpanError,
  getTraceContext,
  SpanAttributes,
} from '../../../src/observability/index.js';

describe('Distributed Tracing Integration', () => {
  beforeAll(() => {
    if (!isTelemetryInitialized()) {
      initTelemetry({
        serviceName: 'tracing-integration-test',
        serviceVersion: '1.0.0',
        environment: 'test',
        // Use a non-existent endpoint to avoid actual export
        otlpEndpoint: 'http://localhost:14318',
      });
    }
  });

  afterAll(async () => {
    if (isTelemetryInitialized()) {
      try {
        await shutdownTelemetry();
      } catch {
        // Ignore connection errors when collector is not available
        // This is expected in test environments without a real collector
      }
    }
  });

  describe('span creation', () => {
    it('creates spans with withSpan helper', async () => {
      let spanActive = false;

      await withSpan('test-operation', () => {
        const span = getActiveSpan();
        spanActive = span !== undefined;
      });

      expect(spanActive).toBe(true);
    });

    it('creates spans with withSpanSync helper', () => {
      let spanActive = false;

      withSpanSync('sync-operation', () => {
        const span = getActiveSpan();
        spanActive = span !== undefined;
      });

      expect(spanActive).toBe(true);
    });

    it('creates manual spans with getTracer', () => {
      const tracer = getTracer();
      const span = tracer.startSpan('manual-span');

      expect(span).toBeDefined();
      expect(typeof span.end).toBe('function');

      span.end();
    });
  });

  describe('span attributes', () => {
    it('adds attributes to active span', async () => {
      await withSpan('attributed-operation', () => {
        addSpanAttributes({
          [SpanAttributes.HTTP_METHOD]: 'GET',
          [SpanAttributes.HTTP_ROUTE]: '/api/test',
        });

        // Span should have attributes (verified by no error)
      });
    });

    it('adds custom Chive attributes', async () => {
      await withSpan('chive-operation', () => {
        addSpanAttributes({
          [SpanAttributes.PREPRINT_URI]: 'at://did:plc:test/pub.chive.preprint/123',
          [SpanAttributes.USER_DID]: 'did:plc:test',
          [SpanAttributes.REQUEST_ID]: 'req_abc123',
        });
      });
    });
  });

  describe('error recording', () => {
    it('records errors on span', async () => {
      await expect(
        withSpan('error-operation', () => {
          const error = new Error('Test error');
          recordSpanError(error);
          throw error;
        })
      ).rejects.toThrow('Test error');
    });

    it('automatically records errors from withSpan', async () => {
      await expect(
        withSpan('auto-error-operation', () => {
          throw new Error('Automatic error');
        })
      ).rejects.toThrow('Automatic error');
    });
  });

  describe('context propagation', () => {
    it('propagates context to child spans', async () => {
      let parentTraceId: string | undefined;
      let childTraceId: string | undefined;

      await withSpan('parent-span', async () => {
        const parentCtx = getTraceContext();
        parentTraceId = parentCtx?.trace_id;

        await withSpan('child-span', () => {
          const childCtx = getTraceContext();
          childTraceId = childCtx?.trace_id;
        });
      });

      expect(parentTraceId).toBeDefined();
      expect(childTraceId).toBeDefined();
      expect(parentTraceId).toBe(childTraceId);
    });

    it('creates different span IDs for parent and child', async () => {
      let parentSpanId: string | undefined;
      let childSpanId: string | undefined;

      await withSpan('parent-span', async () => {
        const parentCtx = getTraceContext();
        parentSpanId = parentCtx?.span_id;

        await withSpan('child-span', () => {
          const childCtx = getTraceContext();
          childSpanId = childCtx?.span_id;
        });
      });

      expect(parentSpanId).toBeDefined();
      expect(childSpanId).toBeDefined();
      expect(parentSpanId).not.toBe(childSpanId);
    });
  });

  describe('withChildSpans helper', () => {
    it('executes operations sequentially', async () => {
      const executionOrder: number[] = [];

      await withChildSpans('parent-operation', [
        {
          name: 'operation-1',
          fn: () => {
            executionOrder.push(1);
            return 'result-1';
          },
        },
        {
          name: 'operation-2',
          fn: () => {
            executionOrder.push(2);
            return 'result-2';
          },
        },
        {
          name: 'operation-3',
          fn: () => {
            executionOrder.push(3);
            return 'result-3';
          },
        },
      ]);

      expect(executionOrder).toEqual([1, 2, 3]);
    });

    it('returns results from all operations', async () => {
      const [r1, r2, r3] = await withChildSpans('parent-operation', [
        { name: 'op-1', fn: () => 'result-1' },
        { name: 'op-2', fn: () => 'result-2' },
        { name: 'op-3', fn: () => 'result-3' },
      ]);

      expect(r1).toBe('result-1');
      expect(r2).toBe('result-2');
      expect(r3).toBe('result-3');
    });

    it('propagates errors from child operations', async () => {
      await expect(
        withChildSpans('parent-operation', [
          { name: 'op-1', fn: () => 'ok' },
          {
            name: 'op-2',
            fn: () => {
              throw new Error('Child error');
            },
          },
          { name: 'op-3', fn: () => 'should not run' },
        ])
      ).rejects.toThrow('Child error');
    });
  });

  describe('trace context extraction', () => {
    it('returns trace context within span', async () => {
      const holder: { ctx: { trace_id: string; span_id: string; trace_flags: number } | null } = {
        ctx: null,
      };

      await withSpan('context-span', () => {
        holder.ctx = getTraceContext();
      });

      expect(holder.ctx).not.toBeNull();
      // TypeScript doesn't narrow through expect(), so we assert after the check
      const ctx = holder.ctx;
      expect(ctx).not.toBeNull();
      expect(ctx?.trace_id).toBeDefined();
      expect(ctx?.span_id).toBeDefined();
      expect(typeof ctx?.trace_flags).toBe('number');
    });

    it('returns null outside span', () => {
      const ctx = getTraceContext();
      expect(ctx).toBeNull();
    });

    it('trace_id is 32 hex characters', async () => {
      await withSpan('trace-format-span', () => {
        const ctx = getTraceContext();
        expect(ctx).not.toBeNull();
        expect(ctx?.trace_id).toMatch(/^[0-9a-f]{32}$/);
      });
    });

    it('span_id is 16 hex characters', async () => {
      await withSpan('span-format-span', () => {
        const ctx = getTraceContext();
        expect(ctx).not.toBeNull();
        expect(ctx?.span_id).toMatch(/^[0-9a-f]{16}$/);
      });
    });
  });

  describe('performance', () => {
    it('handles many spans efficiently', async () => {
      const start = performance.now();

      for (let i = 0; i < 100; i++) {
        await withSpan(`perf-span-${i}`, () => {
          // Minimal work
        });
      }

      const duration = performance.now() - start;

      // Should complete 100 spans in under 1 second
      expect(duration).toBeLessThan(1000);
    });

    it('handles deeply nested spans', async () => {
      const nestSpan = async (depth: number): Promise<number> => {
        if (depth === 0) return 0;

        return withSpan(`nested-span-${depth}`, async () => {
          return 1 + (await nestSpan(depth - 1));
        });
      };

      const result = await nestSpan(20);
      expect(result).toBe(20);
    });
  });
});
