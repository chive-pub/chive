/**
 * Grafana Faro integration for Chive frontend observability.
 *
 * @remarks
 * This module provides production-grade Real User Monitoring (RUM)
 * using Grafana Faro Web SDK with OpenTelemetry integration.
 *
 * Features:
 * - Automatic error capture and reporting
 * - Distributed tracing with W3C Trace Context
 * - Core Web Vitals tracking (LCP, CLS, INP, FCP, TTFB)
 * - Custom business event tracking
 * - Privacy-first with PII scrubbing
 * - Cost-effective sampling for production
 *
 * @example
 * ```typescript
 * // Initialize in app entry
 * import { initializeFaro, events } from '@/lib/observability/faro';
 *
 * initializeFaro();
 *
 * // Track custom events
 * events.eprintView({ eprintUri: '...', source: 'search' });
 * ```
 *
 * @packageDocumentation
 */

// Configuration
export { getFaroConfig, validateFaroConfig, type FaroConfig } from './config';

// Initialization
export {
  initializeFaro,
  getFaro,
  isFaroInitialized,
  shutdownFaro,
  pauseFaro,
  resumeFaro,
} from './initialize';

// Privacy utilities
export {
  scrubString,
  scrubUrl,
  scrubHeaders,
  scrubObject,
  scrubError,
  createPrivacyBeforeSend,
} from './privacy';

// Sampling
export { createSampler, createTraceSampler, type SamplingDecision } from './sampling';

// Session management
export {
  createSessionManager,
  getPersistedSessionId,
  clearPersistedSessionId,
  type UserContext,
  type SessionAttributes,
} from './session';

// Instrumentations
export {
  createInstrumentations,
  createFetchInstrumentation,
  createDocumentLoadInstrumentation,
  createUserInteractionInstrumentation,
  injectTraceContext,
  createSpanName,
  TRACE_CONTEXT_HEADERS,
} from './instrumentations';

// Transports
export {
  logToConsole,
  storeOfflineItem,
  getOfflineItems,
  clearOfflineItems,
  isOnline,
  calculateBackoff,
  withRetry,
} from './transports';

// Custom events
export {
  events,
  type EprintViewEventAttributes,
  type EprintDownloadEventAttributes,
  type SearchEventAttributes,
  type SearchClickEventAttributes,
  type UserActionEventAttributes,
  type FieldBrowseEventAttributes,
  type AuthorViewEventAttributes,
} from './custom-events';

// Web Vitals
export {
  initWebVitals,
  getRating,
  getPerformanceSummary,
  reportTiming,
  createPerformanceMark,
  WEB_VITALS_THRESHOLDS,
  type WebVitalName,
  type WebVitalRating,
  type WebVitalsCallback,
} from './web-vitals';

// React integration
export {
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
} from './react';
