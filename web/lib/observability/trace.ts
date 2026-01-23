/**
 * W3C Trace Context utilities for browser observability.
 *
 * @remarks
 * Provides trace context generation and propagation following W3C standards.
 * This enables correlation between frontend and backend logs.
 *
 * @see https://www.w3.org/TR/trace-context/
 * @packageDocumentation
 */

/**
 * Trace context following W3C Trace Context specification.
 */
export interface TraceContext {
  /** Full traceparent header value */
  traceparent: string;
  /** 32-character hex trace ID */
  traceId: string;
  /** 16-character hex span ID */
  spanId: string;
  /** Trace flags (e.g., '01' for sampled) */
  traceFlags: string;
}

/**
 * Current trace context for the page session.
 */
let currentTraceContext: TraceContext | null = null;

/**
 * Generate a random hex string of specified length.
 *
 * @param length - Number of hex characters
 * @returns Random hex string
 */
function randomHex(length: number): string {
  const bytes = new Uint8Array(length / 2);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a new trace context.
 *
 * @remarks
 * Creates a new W3C Trace Context with:
 * - Version: 00 (current version)
 * - Trace ID: 32-character random hex
 * - Span ID: 16-character random hex
 * - Trace Flags: 01 (sampled)
 *
 * @returns New trace context
 */
export function generateTraceContext(): TraceContext {
  const traceId = randomHex(32);
  const spanId = randomHex(16);
  const traceFlags = '01'; // Sampled

  return {
    traceparent: `00-${traceId}-${spanId}-${traceFlags}`,
    traceId,
    spanId,
    traceFlags,
  };
}

/**
 * Generate a new span ID within the current trace.
 *
 * @remarks
 * Creates a new span ID while keeping the same trace ID.
 * Use this when starting a new operation within an existing trace.
 *
 * @returns New span ID (16-character hex)
 */
export function generateSpanId(): string {
  return randomHex(16);
}

/**
 * Initialize trace context for the page session.
 *
 * @remarks
 * Should be called once when the app loads to establish
 * a trace context for the session. Subsequent API calls
 * will use this context for correlation.
 *
 * @returns The initialized trace context
 */
export function initializeTraceContext(): TraceContext {
  currentTraceContext = generateTraceContext();
  return currentTraceContext;
}

/**
 * Get the current trace context.
 *
 * @remarks
 * Returns the current session's trace context, or generates
 * a new one if not yet initialized.
 *
 * @returns Current trace context
 */
export function getCurrentTraceContext(): TraceContext {
  if (!currentTraceContext) {
    currentTraceContext = generateTraceContext();
  }
  return currentTraceContext;
}

/**
 * Create a child span context.
 *
 * @remarks
 * Creates a new span within the current trace. The new span
 * shares the trace ID but has a new span ID.
 *
 * @returns Child trace context with new span ID
 */
export function createChildSpan(): TraceContext {
  const parent = getCurrentTraceContext();
  const spanId = generateSpanId();

  return {
    traceparent: `00-${parent.traceId}-${spanId}-${parent.traceFlags}`,
    traceId: parent.traceId,
    spanId,
    traceFlags: parent.traceFlags,
  };
}

/**
 * Parse a traceparent header.
 *
 * @param header - W3C traceparent header value
 * @returns Parsed trace context or null if invalid
 */
export function parseTraceparent(header: string): TraceContext | null {
  const parts = header.split('-');
  if (parts.length !== 4) return null;

  const version = parts[0];
  const traceId = parts[1];
  const spanId = parts[2];
  const traceFlags = parts[3];

  if (!version || !traceId || !spanId || !traceFlags) return null;
  if (version !== '00') return null;
  if (!/^[0-9a-f]{32}$/i.test(traceId)) return null;
  if (!/^[0-9a-f]{16}$/i.test(spanId)) return null;

  return {
    traceparent: header,
    traceId,
    spanId,
    traceFlags,
  };
}

/**
 * Reset trace context (e.g., on logout or session change).
 */
export function resetTraceContext(): void {
  currentTraceContext = null;
}
