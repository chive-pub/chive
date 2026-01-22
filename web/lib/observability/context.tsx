'use client';

/**
 * React context for observability (trace context and request IDs).
 *
 * @remarks
 * Provides trace context to components for correlation with backend logs.
 * Uses W3C Trace Context standard for distributed tracing.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { traceId, createSpan } = useObservability();
 *   // traceId can be displayed in error messages for support
 *   // createSpan() creates a child span for the current operation
 * }
 * ```
 *
 * @packageDocumentation
 */

import * as React from 'react';
import { createContext, useContext, useMemo, useCallback, useEffect, useState } from 'react';
import {
  type TraceContext,
  initializeTraceContext,
  getCurrentTraceContext,
  createChildSpan,
  resetTraceContext,
} from './trace';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Observability context value provided to components.
 */
export interface ObservabilityContextValue {
  /** Current trace ID (32-character hex) */
  traceId: string;
  /** Current span ID (16-character hex) */
  spanId: string;
  /** Full traceparent header value */
  traceparent: string;
  /** Create a child span for a new operation */
  createSpan: () => TraceContext;
  /** Reset trace context (e.g., on logout) */
  reset: () => void;
  /** Whether trace context is initialized */
  isInitialized: boolean;
}

// =============================================================================
// CONTEXT
// =============================================================================

const ObservabilityContext = createContext<ObservabilityContextValue | null>(null);

// =============================================================================
// PROVIDER
// =============================================================================

/**
 * Props for ObservabilityProvider.
 */
export interface ObservabilityProviderProps {
  /** Child components */
  children: React.ReactNode;
}

/**
 * Provider component for observability context.
 *
 * @remarks
 * Initializes trace context on mount and provides it to child components.
 * Should be placed near the root of the application.
 *
 * @example
 * ```tsx
 * // In app/layout.tsx
 * <ObservabilityProvider>
 *   <App />
 * </ObservabilityProvider>
 * ```
 */
export function ObservabilityProvider({ children }: ObservabilityProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [traceContext, setTraceContext] = useState<TraceContext | null>(null);

  // Initialize trace context on mount
  useEffect(() => {
    const context = initializeTraceContext();
    setTraceContext(context);
    setIsInitialized(true);
  }, []);

  // Create child span
  const createSpan = useCallback((): TraceContext => {
    return createChildSpan();
  }, []);

  // Reset trace context
  const reset = useCallback(() => {
    resetTraceContext();
    const newContext = initializeTraceContext();
    setTraceContext(newContext);
  }, []);

  // Memoize context value
  const value = useMemo<ObservabilityContextValue>(() => {
    const ctx = traceContext ?? getCurrentTraceContext();
    return {
      traceId: ctx.traceId,
      spanId: ctx.spanId,
      traceparent: ctx.traceparent,
      createSpan,
      reset,
      isInitialized,
    };
  }, [traceContext, createSpan, reset, isInitialized]);

  return <ObservabilityContext.Provider value={value}>{children}</ObservabilityContext.Provider>;
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Hook to access observability context.
 *
 * @returns Observability context value
 * @throws Error if used outside ObservabilityProvider
 *
 * @example
 * ```tsx
 * function ErrorDisplay({ error }: { error: Error }) {
 *   const { traceId } = useObservability();
 *   return (
 *     <div>
 *       <p>An error occurred. Reference: {traceId.slice(0, 8)}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useObservability(): ObservabilityContextValue {
  const context = useContext(ObservabilityContext);
  if (!context) {
    throw new Error('useObservability must be used within an ObservabilityProvider');
  }
  return context;
}

/**
 * Hook to get current trace ID (safe version).
 *
 * @remarks
 * Returns the trace ID or undefined if not in an ObservabilityProvider.
 * Useful for optional tracing in components that may be used outside the provider.
 *
 * @returns Trace ID or undefined
 */
export function useTraceId(): string | undefined {
  const context = useContext(ObservabilityContext);
  return context?.traceId;
}

/**
 * Hook to create a traced operation.
 *
 * @remarks
 * Creates a child span for tracking an operation. The span context
 * can be passed to API calls for correlation.
 *
 * @returns Function to create a child span
 *
 * @example
 * ```tsx
 * function SubmitButton() {
 *   const createSpan = useTracedOperation();
 *
 *   const handleSubmit = async () => {
 *     const span = createSpan();
 *     await api.submit({ traceparent: span.traceparent });
 *   };
 * }
 * ```
 */
export function useTracedOperation(): () => TraceContext {
  const context = useContext(ObservabilityContext);
  return useCallback(() => {
    if (context) {
      return context.createSpan();
    }
    // Fallback if not in provider
    return createChildSpan();
  }, [context]);
}
