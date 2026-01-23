'use client';

/**
 * React context for observability (trace context, Faro integration, and request IDs).
 *
 * @remarks
 * Provides trace context to components for correlation with backend logs.
 * Uses W3C Trace Context standard for distributed tracing.
 * Integrates with Grafana Faro for production RUM.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { traceId, createSpan, pushEvent, pushError } = useObservability();
 *   // traceId can be displayed in error messages for support
 *   // createSpan() creates a child span for the current operation
 *   // pushEvent() tracks custom business events
 *   // pushError() reports errors to observability backend
 * }
 * ```
 *
 * @packageDocumentation
 */

import * as React from 'react';
import { createContext, useContext, useMemo, useCallback, useEffect, useState } from 'react';
import type { Faro } from '@grafana/faro-web-sdk';

import {
  type TraceContext,
  initializeTraceContext,
  getCurrentTraceContext,
  createChildSpan,
  resetTraceContext,
} from './trace';
import { initializeFaro, getFaro, initWebVitals, type UserContext } from './faro';

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
  /** Faro instance (null if not available) */
  faro: Faro | null;
  /** Whether Faro is available */
  isFaroAvailable: boolean;
  /** Push a custom event to observability backend */
  pushEvent: (name: string, attributes?: Record<string, string>) => void;
  /** Push an error to observability backend */
  pushError: (error: Error, context?: Record<string, string>) => void;
  /** Set user context (after authentication) */
  setUser: (user: UserContext) => void;
  /** Clear user context (on logout) */
  clearUser: () => void;
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
  /** Disable Faro initialization (for testing) */
  disableFaro?: boolean;
  /** Disable Web Vitals tracking */
  disableWebVitals?: boolean;
}

/**
 * Hash a string for privacy (simple hash, not cryptographic).
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return `h_${Math.abs(hash).toString(16)}`;
}

/**
 * Provider component for observability context.
 *
 * @remarks
 * Initializes trace context and Faro on mount and provides them to child components.
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
export function ObservabilityProvider({
  children,
  disableFaro = false,
  disableWebVitals = false,
}: ObservabilityProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [traceContext, setTraceContext] = useState<TraceContext | null>(null);
  const [faroInstance, setFaroInstance] = useState<Faro | null>(null);

  // Initialize trace context and Faro on mount
  useEffect(() => {
    // Initialize trace context
    const context = initializeTraceContext();
    setTraceContext(context);

    // Initialize Faro
    if (!disableFaro) {
      const faro = initializeFaro();
      setFaroInstance(faro);

      // Initialize Web Vitals tracking
      if (!disableWebVitals && faro) {
        const cleanupVitals = initWebVitals();
        return () => {
          cleanupVitals();
        };
      }
    }

    setIsInitialized(true);
  }, [disableFaro, disableWebVitals]);

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

  // Push custom event
  const pushEvent = useCallback(
    (name: string, attributes?: Record<string, string>) => {
      const faro = faroInstance ?? getFaro();
      if (!faro) return;

      try {
        faro.api.pushEvent(name, attributes);
      } catch {
        // Silently fail
      }
    },
    [faroInstance]
  );

  // Push error
  const pushError = useCallback(
    (error: Error, context?: Record<string, string>) => {
      const faro = faroInstance ?? getFaro();
      if (!faro) return;

      try {
        faro.api.pushError(error, {
          context,
        });
      } catch {
        // Silently fail
      }
    },
    [faroInstance]
  );

  // Set user context
  const setUser = useCallback(
    (user: UserContext) => {
      const faro = faroInstance ?? getFaro();
      if (!faro) return;

      try {
        faro.api.setUser({
          id: user.id ? hashString(user.id) : undefined,
          username: user.username ? 'authenticated' : undefined,
          email: user.email ? 'provided' : undefined,
          attributes: user.attributes,
        });
      } catch {
        // Silently fail
      }
    },
    [faroInstance]
  );

  // Clear user context
  const clearUser = useCallback(() => {
    const faro = faroInstance ?? getFaro();
    if (!faro) return;

    try {
      faro.api.resetUser();
    } catch {
      // Silently fail
    }
  }, [faroInstance]);

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
      faro: faroInstance,
      isFaroAvailable: faroInstance !== null,
      pushEvent,
      pushError,
      setUser,
      clearUser,
    };
  }, [
    traceContext,
    createSpan,
    reset,
    isInitialized,
    faroInstance,
    pushEvent,
    pushError,
    setUser,
    clearUser,
  ]);

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
 *   const { traceId, pushError } = useObservability();
 *
 *   useEffect(() => {
 *     pushError(error, { component: 'ErrorDisplay' });
 *   }, [error, pushError]);
 *
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

/**
 * Hook for pushing custom events.
 *
 * @returns Function to push custom events
 *
 * @example
 * ```tsx
 * function SearchPage() {
 *   const pushEvent = usePushEvent();
 *
 *   const handleSearch = (query: string, resultCount: number) => {
 *     pushEvent('search', { query, resultCount: String(resultCount) });
 *   };
 * }
 * ```
 */
export function usePushEvent(): (name: string, attributes?: Record<string, string>) => void {
  const context = useContext(ObservabilityContext);
  return useCallback(
    (name: string, attributes?: Record<string, string>) => {
      context?.pushEvent(name, attributes);
    },
    [context]
  );
}

/**
 * Hook for pushing errors.
 *
 * @returns Function to push errors
 *
 * @example
 * ```tsx
 * function ApiClient() {
 *   const pushError = usePushError();
 *
 *   const fetchData = async () => {
 *     try {
 *       await api.getData();
 *     } catch (error) {
 *       pushError(error as Error, { endpoint: '/api/data' });
 *     }
 *   };
 * }
 * ```
 */
export function usePushError(): (error: Error, context?: Record<string, string>) => void {
  const context = useContext(ObservabilityContext);
  return useCallback(
    (error: Error, errorContext?: Record<string, string>) => {
      context?.pushError(error, errorContext);
    },
    [context]
  );
}
