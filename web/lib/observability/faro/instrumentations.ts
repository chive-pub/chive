/**
 * OpenTelemetry instrumentations for Faro.
 *
 * @remarks
 * Configures automatic instrumentation for fetch, document load,
 * and user interactions. Integrates with Faro's tracing transport.
 *
 * @packageDocumentation
 */

import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { DocumentLoadInstrumentation } from '@opentelemetry/instrumentation-document-load';
import { UserInteractionInstrumentation } from '@opentelemetry/instrumentation-user-interaction';

import type { FaroConfig } from './config';
import { scrubUrl } from './privacy';

/** OpenTelemetry instrumentation type */
type Instrumentation =
  | FetchInstrumentation
  | DocumentLoadInstrumentation
  | UserInteractionInstrumentation;

/**
 * API endpoints that should always be traced (regardless of sampling).
 */
const CRITICAL_ENDPOINTS = ['/api/auth', '/api/xrpc', '/api/eprints'];

/**
 * API endpoints to ignore (health checks, etc.).
 */
const IGNORED_ENDPOINTS = [
  '/api/health',
  '/api/healthz',
  '/api/ready',
  '/api/metrics',
  '/_next/',
  '/favicon.ico',
];

/**
 * Check if a URL should be traced.
 */
function _shouldTraceUrl(url: string): boolean {
  // Always ignore internal Next.js requests
  if (IGNORED_ENDPOINTS.some((endpoint) => url.includes(endpoint))) {
    return false;
  }
  return true;
}

/**
 * Check if a URL is critical and should always be traced.
 */
function isCriticalUrl(url: string): boolean {
  return CRITICAL_ENDPOINTS.some((endpoint) => url.includes(endpoint));
}

/**
 * Create fetch instrumentation with privacy scrubbing.
 *
 * @param config - Faro configuration
 * @returns Configured FetchInstrumentation
 */
export function createFetchInstrumentation(config: FaroConfig): FetchInstrumentation {
  return new FetchInstrumentation({
    // Propagate trace context to backend
    propagateTraceHeaderCorsUrls: [
      // Same-origin requests
      /^\/api\//,
      // Backend API (if configured)
      ...(process.env.NEXT_PUBLIC_API_URL
        ? [new RegExp(`^${process.env.NEXT_PUBLIC_API_URL}`)]
        : []),
    ],

    // Filter out non-interesting requests
    ignoreUrls: IGNORED_ENDPOINTS.map((endpoint) => new RegExp(endpoint)),

    // Add custom attributes to spans
    applyCustomAttributesOnSpan: (span, request, _response) => {
      if (request instanceof Request) {
        // Scrub URL for privacy
        span.setAttribute('http.url.scrubbed', scrubUrl(request.url));

        // Mark critical endpoints
        if (isCriticalUrl(request.url)) {
          span.setAttribute('http.critical', true);
        }
      }
    },

    // Clear timing for failed requests
    clearTimingResources: config.environment === 'production',
  });
}

/**
 * Create document load instrumentation.
 *
 * @param _config - Faro configuration (unused but kept for consistency)
 * @returns Configured DocumentLoadInstrumentation
 */
export function createDocumentLoadInstrumentation(
  _config: FaroConfig
): DocumentLoadInstrumentation {
  return new DocumentLoadInstrumentation({
    // Add custom attributes
    applyCustomAttributesOnSpan: {
      documentLoad: (span) => {
        // Add route information
        if (typeof window !== 'undefined') {
          span.setAttribute('page.path', window.location.pathname);
          span.setAttribute('page.referrer', document.referrer || 'direct');
        }
      },
      resourceFetch: (span, resource) => {
        // Track resource type
        if (resource.initiatorType) {
          span.setAttribute('resource.type', resource.initiatorType);
        }
      },
    },
  });
}

/**
 * Create user interaction instrumentation.
 *
 * @param _config - Faro configuration (unused but kept for consistency)
 * @returns Configured UserInteractionInstrumentation
 */
export function createUserInteractionInstrumentation(
  _config: FaroConfig
): UserInteractionInstrumentation {
  return new UserInteractionInstrumentation({
    // Track click and input events
    eventNames: ['click', 'submit'],

    // Only track elements with specific attributes
    shouldPreventSpanCreation: (_eventType, element) => {
      // Only track elements with data-track attribute or specific roles
      const shouldTrack =
        element.hasAttribute('data-track') ||
        element.getAttribute('role') === 'button' ||
        element.tagName === 'BUTTON' ||
        element.tagName === 'A' ||
        (element.tagName === 'INPUT' && element.getAttribute('type') === 'submit');

      return !shouldTrack;
    },
  });
}

/**
 * Create all OpenTelemetry instrumentations.
 *
 * @param config - Faro configuration
 * @returns Array of configured instrumentations
 */
export function createInstrumentations(config: FaroConfig): Instrumentation[] {
  const instrumentations: Instrumentation[] = [];

  // Always include fetch instrumentation
  instrumentations.push(createFetchInstrumentation(config));

  // Include performance instrumentations if enabled
  if (config.instrumentPerformance) {
    instrumentations.push(createDocumentLoadInstrumentation(config));
    instrumentations.push(createUserInteractionInstrumentation(config));
  }

  return instrumentations;
}

/**
 * Headers to propagate for trace context.
 */
export const TRACE_CONTEXT_HEADERS = ['traceparent', 'tracestate'] as const;

/**
 * Extract trace context headers from current span.
 *
 * @param headers - Current request headers
 * @returns Headers with trace context added
 */
export function injectTraceContext(headers: Record<string, string>): Record<string, string> {
  // This is a simplified version - the actual injection happens
  // via the FetchInstrumentation's propagateTraceHeaderCorsUrls
  return {
    ...headers,
  };
}

/**
 * Create a span name from a URL and method.
 *
 * @param method - HTTP method
 * @param url - Request URL
 * @returns Span name
 */
export function createSpanName(method: string, url: string): string {
  try {
    const parsed = new URL(url, 'http://localhost');
    return `${method} ${parsed.pathname}`;
  } catch {
    return `${method} ${url}`;
  }
}
