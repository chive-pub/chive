/**
 * Tests for W3C Trace Context utilities.
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  generateTraceContext,
  generateSpanId,
  initializeTraceContext,
  getCurrentTraceContext,
  createChildSpan,
  parseTraceparent,
  resetTraceContext,
} from './trace';

describe('Trace Context Utilities', () => {
  beforeEach(() => {
    resetTraceContext();
  });

  describe('generateTraceContext', () => {
    it('generates a valid trace context', () => {
      const context = generateTraceContext();

      expect(context.traceId).toBeDefined();
      expect(context.spanId).toBeDefined();
      expect(context.traceFlags).toBe('01');
      expect(context.traceparent).toBeDefined();
    });

    it('generates 32-character hex trace ID', () => {
      const context = generateTraceContext();

      expect(context.traceId).toHaveLength(32);
      expect(context.traceId).toMatch(/^[0-9a-f]{32}$/);
    });

    it('generates 16-character hex span ID', () => {
      const context = generateTraceContext();

      expect(context.spanId).toHaveLength(16);
      expect(context.spanId).toMatch(/^[0-9a-f]{16}$/);
    });

    it('generates W3C-compliant traceparent header', () => {
      const context = generateTraceContext();

      // Format: 00-trace_id-span_id-trace_flags
      const parts = context.traceparent.split('-');
      expect(parts).toHaveLength(4);
      expect(parts[0]).toBe('00'); // version
      expect(parts[1]).toBe(context.traceId);
      expect(parts[2]).toBe(context.spanId);
      expect(parts[3]).toBe(context.traceFlags);
    });

    it('generates unique trace IDs', () => {
      const context1 = generateTraceContext();
      const context2 = generateTraceContext();

      expect(context1.traceId).not.toBe(context2.traceId);
      expect(context1.spanId).not.toBe(context2.spanId);
    });
  });

  describe('generateSpanId', () => {
    it('generates 16-character hex span ID', () => {
      const spanId = generateSpanId();

      expect(spanId).toHaveLength(16);
      expect(spanId).toMatch(/^[0-9a-f]{16}$/);
    });

    it('generates unique span IDs', () => {
      const spanId1 = generateSpanId();
      const spanId2 = generateSpanId();

      expect(spanId1).not.toBe(spanId2);
    });
  });

  describe('initializeTraceContext', () => {
    it('initializes and returns trace context', () => {
      const context = initializeTraceContext();

      expect(context.traceId).toBeDefined();
      expect(context.spanId).toBeDefined();
      expect(context.traceparent).toBeDefined();
    });

    it('sets the current trace context', () => {
      const initialized = initializeTraceContext();
      const current = getCurrentTraceContext();

      expect(current.traceId).toBe(initialized.traceId);
      expect(current.spanId).toBe(initialized.spanId);
    });
  });

  describe('getCurrentTraceContext', () => {
    it('returns existing trace context if initialized', () => {
      const initialized = initializeTraceContext();
      const current = getCurrentTraceContext();

      expect(current.traceId).toBe(initialized.traceId);
    });

    it('generates new context if not initialized', () => {
      const context = getCurrentTraceContext();

      expect(context.traceId).toBeDefined();
      expect(context.spanId).toBeDefined();
    });

    it('returns same context on multiple calls', () => {
      const context1 = getCurrentTraceContext();
      const context2 = getCurrentTraceContext();

      expect(context1.traceId).toBe(context2.traceId);
      expect(context1.spanId).toBe(context2.spanId);
    });
  });

  describe('createChildSpan', () => {
    it('creates child span with same trace ID', () => {
      const parent = initializeTraceContext();
      const child = createChildSpan();

      expect(child.traceId).toBe(parent.traceId);
    });

    it('creates child span with new span ID', () => {
      const parent = initializeTraceContext();
      const child = createChildSpan();

      expect(child.spanId).not.toBe(parent.spanId);
    });

    it('preserves trace flags', () => {
      const parent = initializeTraceContext();
      const child = createChildSpan();

      expect(child.traceFlags).toBe(parent.traceFlags);
    });

    it('generates valid traceparent header', () => {
      initializeTraceContext();
      const child = createChildSpan();

      const parts = child.traceparent.split('-');
      expect(parts).toHaveLength(4);
      expect(parts[0]).toBe('00');
      expect(parts[1]).toBe(child.traceId);
      expect(parts[2]).toBe(child.spanId);
      expect(parts[3]).toBe(child.traceFlags);
    });

    it('creates multiple unique child spans', () => {
      initializeTraceContext();
      const child1 = createChildSpan();
      const child2 = createChildSpan();

      expect(child1.traceId).toBe(child2.traceId); // Same trace
      expect(child1.spanId).not.toBe(child2.spanId); // Different spans
    });
  });

  describe('parseTraceparent', () => {
    it('parses valid traceparent header', () => {
      const traceId = 'a'.repeat(32);
      const spanId = 'b'.repeat(16);
      const header = `00-${traceId}-${spanId}-01`;

      const result = parseTraceparent(header);

      expect(result).not.toBeNull();
      expect(result?.traceId).toBe(traceId);
      expect(result?.spanId).toBe(spanId);
      expect(result?.traceFlags).toBe('01');
      expect(result?.traceparent).toBe(header);
    });

    it('returns null for invalid format - wrong part count', () => {
      expect(parseTraceparent('00-abc-def')).toBeNull();
      expect(parseTraceparent('00-abc-def-01-extra')).toBeNull();
    });

    it('returns null for invalid version', () => {
      const traceId = 'a'.repeat(32);
      const spanId = 'b'.repeat(16);
      const header = `01-${traceId}-${spanId}-01`;

      expect(parseTraceparent(header)).toBeNull();
    });

    it('returns null for invalid trace ID length', () => {
      const spanId = 'b'.repeat(16);
      expect(parseTraceparent(`00-abc-${spanId}-01`)).toBeNull();
      expect(parseTraceparent(`00-${'a'.repeat(31)}-${spanId}-01`)).toBeNull();
      expect(parseTraceparent(`00-${'a'.repeat(33)}-${spanId}-01`)).toBeNull();
    });

    it('returns null for invalid span ID length', () => {
      const traceId = 'a'.repeat(32);
      expect(parseTraceparent(`00-${traceId}-abc-01`)).toBeNull();
      expect(parseTraceparent(`00-${traceId}-${'b'.repeat(15)}-01`)).toBeNull();
      expect(parseTraceparent(`00-${traceId}-${'b'.repeat(17)}-01`)).toBeNull();
    });

    it('returns null for non-hex trace ID', () => {
      const spanId = 'b'.repeat(16);
      expect(parseTraceparent(`00-${'g'.repeat(32)}-${spanId}-01`)).toBeNull();
    });

    it('returns null for non-hex span ID', () => {
      const traceId = 'a'.repeat(32);
      expect(parseTraceparent(`00-${traceId}-${'g'.repeat(16)}-01`)).toBeNull();
    });

    it('accepts uppercase hex characters', () => {
      const traceId = 'A'.repeat(32);
      const spanId = 'B'.repeat(16);
      const header = `00-${traceId}-${spanId}-01`;

      const result = parseTraceparent(header);
      expect(result).not.toBeNull();
    });

    it('parses different trace flags', () => {
      const traceId = 'a'.repeat(32);
      const spanId = 'b'.repeat(16);

      const sampled = parseTraceparent(`00-${traceId}-${spanId}-01`);
      expect(sampled?.traceFlags).toBe('01');

      const notSampled = parseTraceparent(`00-${traceId}-${spanId}-00`);
      expect(notSampled?.traceFlags).toBe('00');
    });

    it('returns null for empty parts', () => {
      expect(parseTraceparent('00--' + 'b'.repeat(16) + '-01')).toBeNull();
      expect(parseTraceparent('00-' + 'a'.repeat(32) + '--01')).toBeNull();
    });
  });

  describe('resetTraceContext', () => {
    it('clears the current trace context', () => {
      const original = initializeTraceContext();
      resetTraceContext();
      const newContext = getCurrentTraceContext();

      expect(newContext.traceId).not.toBe(original.traceId);
    });

    it('allows reinitializing after reset', () => {
      initializeTraceContext();
      resetTraceContext();
      const newContext = initializeTraceContext();

      expect(newContext.traceId).toBeDefined();
    });
  });

  describe('integration', () => {
    it('full trace workflow', () => {
      // Initialize root trace
      const root = initializeTraceContext();
      expect(root.traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);

      // Create child spans
      const child1 = createChildSpan();
      const child2 = createChildSpan();

      // All share same trace ID
      expect(child1.traceId).toBe(root.traceId);
      expect(child2.traceId).toBe(root.traceId);

      // All have unique span IDs
      const spanIds = new Set([root.spanId, child1.spanId, child2.spanId]);
      expect(spanIds.size).toBe(3);

      // Parse back a traceparent
      const parsed = parseTraceparent(child1.traceparent);
      expect(parsed?.traceId).toBe(child1.traceId);
      expect(parsed?.spanId).toBe(child1.spanId);
    });
  });
});
