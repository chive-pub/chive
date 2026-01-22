/**
 * Observability module for Chive frontend.
 *
 * @remarks
 * Provides structured logging, trace context, error tracking,
 * and Grafana Faro integration for production RUM.
 *
 * Features:
 * - Structured browser logging (Pino-compatible)
 * - W3C Trace Context for distributed tracing
 * - Grafana Faro for Real User Monitoring
 * - Core Web Vitals tracking
 * - Custom business event tracking
 * - Privacy-first with PII scrubbing
 *
 * @example
 * ```typescript
 * import { logger, events, useObservability } from '@/lib/observability';
 *
 * // Logging
 * logger.info('User logged in', { userId: 'xxx' });
 *
 * // Custom events
 * events.eprintView({ eprintUri: '...', source: 'search' });
 *
 * // React hook
 * const { traceId, pushEvent } = useObservability();
 * ```
 *
 * @packageDocumentation
 */

// Logger exports
export {
  logger,
  createLogger,
  getLogBuffer,
  clearLogBuffer,
  BrowserLogger,
  type LogContext,
  type LogEntry,
  type LoggerOptions,
  type LogLevel,
  type BrowserLogLevel,
} from './logger';

// Trace context exports
export {
  generateTraceContext,
  generateSpanId,
  initializeTraceContext,
  getCurrentTraceContext,
  createChildSpan,
  parseTraceparent,
  resetTraceContext,
  type TraceContext,
} from './trace';

// Context/Provider exports
export {
  ObservabilityProvider,
  useObservability,
  useTraceId,
  useTracedOperation,
  usePushEvent,
  usePushError,
  type ObservabilityProviderProps,
  type ObservabilityContextValue,
} from './context';

// Faro exports (re-export commonly used items)
export {
  // Initialization
  initializeFaro,
  getFaro,
  isFaroInitialized,
  shutdownFaro,
  pauseFaro,
  resumeFaro,
  // Configuration
  getFaroConfig,
  validateFaroConfig,
  type FaroConfig,
  // Privacy
  scrubString,
  scrubUrl,
  scrubObject,
  scrubError,
  // Sampling
  createSampler,
  // Session
  createSessionManager,
  getPersistedSessionId,
  clearPersistedSessionId,
  type UserContext,
  type SessionAttributes,
  // Custom events
  events,
  type EprintViewEventAttributes,
  type EprintDownloadEventAttributes,
  type SearchEventAttributes,
  type SearchClickEventAttributes,
  type UserActionEventAttributes,
  // Web Vitals
  initWebVitals,
  getRating,
  getPerformanceSummary,
  reportTiming,
  createPerformanceMark,
  WEB_VITALS_THRESHOLDS,
  type WebVitalName,
  type WebVitalRating,
  type WebVitalsCallback,
  // React components
  useFaro,
  useWebVitals,
  getWebVitalsSummary,
  FaroErrorBoundary,
  FaroRouteTracker,
  withFaroErrorBoundary,
  parameterizePath,
  type UseFaroReturn,
  type WebVitalsData,
  type UseWebVitalsOptions,
  type FaroErrorBoundaryProps,
  type FaroRouteTrackerProps,
} from './faro';
