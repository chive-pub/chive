/**
 * Tests for observability React context.
 *
 * @packageDocumentation
 */

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

import { ObservabilityProvider, useObservability, useTraceId, useTracedOperation } from './context';
import { resetTraceContext } from './trace';

describe('ObservabilityProvider', () => {
  beforeEach(() => {
    resetTraceContext();
  });

  it('renders children', () => {
    render(
      <ObservabilityProvider>
        <div data-testid="child">Child content</div>
      </ObservabilityProvider>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('provides trace context to children', () => {
    function TestComponent() {
      const { traceId, spanId, traceparent } = useObservability();
      return (
        <div>
          <span data-testid="trace-id">{traceId}</span>
          <span data-testid="span-id">{spanId}</span>
          <span data-testid="traceparent">{traceparent}</span>
        </div>
      );
    }

    render(
      <ObservabilityProvider>
        <TestComponent />
      </ObservabilityProvider>
    );

    const traceId = screen.getByTestId('trace-id').textContent;
    const spanId = screen.getByTestId('span-id').textContent;
    const traceparent = screen.getByTestId('traceparent').textContent;

    expect(traceId).toHaveLength(32);
    expect(spanId).toHaveLength(16);
    expect(traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
  });

  it('provides isInitialized flag', async () => {
    function TestComponent() {
      const { isInitialized } = useObservability();
      return <span data-testid="initialized">{String(isInitialized)}</span>;
    }

    render(
      <ObservabilityProvider>
        <TestComponent />
      </ObservabilityProvider>
    );

    // After effect runs, should be initialized
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.getByTestId('initialized').textContent).toBe('true');
  });

  it('provides createSpan function', () => {
    function TestComponent() {
      const { traceId, createSpan } = useObservability();
      const childSpan = createSpan();
      return (
        <div>
          <span data-testid="parent-trace">{traceId}</span>
          <span data-testid="child-trace">{childSpan.traceId}</span>
          <span data-testid="child-span">{childSpan.spanId}</span>
        </div>
      );
    }

    render(
      <ObservabilityProvider>
        <TestComponent />
      </ObservabilityProvider>
    );

    const parentTrace = screen.getByTestId('parent-trace').textContent;
    const childTrace = screen.getByTestId('child-trace').textContent;

    expect(parentTrace).toBe(childTrace); // Same trace ID
    expect(screen.getByTestId('child-span').textContent).toHaveLength(16);
  });

  it('provides reset function', async () => {
    let capturedReset: () => void;
    let firstTraceId: string | undefined;

    function TestComponent() {
      const { traceId, reset } = useObservability();
      capturedReset = reset;
      if (!firstTraceId) {
        firstTraceId = traceId;
      }
      return <span data-testid="trace-id">{traceId}</span>;
    }

    render(
      <ObservabilityProvider>
        <TestComponent />
      </ObservabilityProvider>
    );

    const initialTraceId = screen.getByTestId('trace-id').textContent;

    await act(async () => {
      capturedReset!();
    });

    const newTraceId = screen.getByTestId('trace-id').textContent;

    // After reset, should have a new trace ID
    expect(newTraceId).not.toBe(initialTraceId);
    expect(newTraceId).toHaveLength(32);
  });
});

describe('useObservability', () => {
  beforeEach(() => {
    resetTraceContext();
  });

  it('throws when used outside ObservabilityProvider', () => {
    function TestComponent() {
      useObservability();
      return null;
    }

    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useObservability must be used within an ObservabilityProvider');

    consoleSpy.mockRestore();
  });
});

describe('useTraceId', () => {
  beforeEach(() => {
    resetTraceContext();
  });

  it('returns trace ID when inside provider', () => {
    function TestComponent() {
      const traceId = useTraceId();
      return <span data-testid="trace-id">{traceId}</span>;
    }

    render(
      <ObservabilityProvider>
        <TestComponent />
      </ObservabilityProvider>
    );

    expect(screen.getByTestId('trace-id').textContent).toHaveLength(32);
  });

  it('returns undefined when outside provider', () => {
    function TestComponent() {
      const traceId = useTraceId();
      return <span data-testid="trace-id">{traceId ?? 'undefined'}</span>;
    }

    render(<TestComponent />);

    expect(screen.getByTestId('trace-id').textContent).toBe('undefined');
  });
});

describe('useTracedOperation', () => {
  beforeEach(() => {
    resetTraceContext();
  });

  it('returns function that creates child spans inside provider', () => {
    let capturedCreateSpan: () => ReturnType<typeof useTracedOperation> extends () => infer R
      ? R
      : never;

    function TestComponent() {
      const createSpan = useTracedOperation();
      capturedCreateSpan = createSpan;
      return null;
    }

    render(
      <ObservabilityProvider>
        <TestComponent />
      </ObservabilityProvider>
    );

    const span = capturedCreateSpan!();
    expect(span.traceId).toHaveLength(32);
    expect(span.spanId).toHaveLength(16);
    expect(span.traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
  });

  it('works outside provider (fallback behavior)', () => {
    let capturedCreateSpan: () => ReturnType<typeof useTracedOperation> extends () => infer R
      ? R
      : never;

    function TestComponent() {
      const createSpan = useTracedOperation();
      capturedCreateSpan = createSpan;
      return null;
    }

    render(<TestComponent />);

    const span = capturedCreateSpan!();
    expect(span.traceId).toHaveLength(32);
    expect(span.spanId).toHaveLength(16);
  });

  it('creates unique spans on each call', () => {
    let capturedCreateSpan: () => ReturnType<typeof useTracedOperation> extends () => infer R
      ? R
      : never;

    function TestComponent() {
      const createSpan = useTracedOperation();
      capturedCreateSpan = createSpan;
      return null;
    }

    render(
      <ObservabilityProvider>
        <TestComponent />
      </ObservabilityProvider>
    );

    const span1 = capturedCreateSpan!();
    const span2 = capturedCreateSpan!();

    expect(span1.traceId).toBe(span2.traceId); // Same trace
    expect(span1.spanId).not.toBe(span2.spanId); // Different spans
  });
});

// Import vi for mocking
import { vi } from 'vitest';
