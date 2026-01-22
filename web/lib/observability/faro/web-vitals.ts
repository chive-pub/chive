/**
 * Web Vitals tracking utilities for Faro.
 *
 * @remarks
 * Provides Core Web Vitals tracking with automatic reporting to Faro.
 * This module handles the imperative setup for non-React contexts.
 *
 * @packageDocumentation
 */

import type { Metric } from 'web-vitals';
import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals';

import { getFaro } from './initialize';

/**
 * Web Vitals thresholds (based on Google's recommendations).
 */
export const WEB_VITALS_THRESHOLDS = {
  LCP: { good: 2500, needsImprovement: 4000 },
  CLS: { good: 0.1, needsImprovement: 0.25 },
  INP: { good: 200, needsImprovement: 500 },
  FCP: { good: 1800, needsImprovement: 3000 },
  TTFB: { good: 800, needsImprovement: 1800 },
} as const;

/**
 * Web Vital names.
 */
export type WebVitalName = keyof typeof WEB_VITALS_THRESHOLDS;

/**
 * Rating for a metric value.
 */
export type WebVitalRating = 'good' | 'needs-improvement' | 'poor';

/**
 * Callback type for Web Vitals.
 */
export type WebVitalsCallback = (metric: {
  name: WebVitalName;
  value: number;
  rating: WebVitalRating;
  id: string;
}) => void;

/**
 * Get rating for a metric value.
 */
export function getRating(name: WebVitalName, value: number): WebVitalRating {
  const thresholds = WEB_VITALS_THRESHOLDS[name];
  if (value <= thresholds.good) return 'good';
  if (value <= thresholds.needsImprovement) return 'needs-improvement';
  return 'poor';
}

/**
 * Report a web vital to Faro.
 */
function reportToFaro(metric: Metric): void {
  const faro = getFaro();
  if (!faro) return;

  const { name, value, id, rating } = metric;

  try {
    // Push as measurement
    faro.api.pushMeasurement({
      type: 'web-vital',
      values: {
        [name.toLowerCase()]: value,
      },
    });

    // Push as event for more context
    faro.api.pushEvent('web_vital', {
      name,
      value: value.toString(),
      id,
      rating,
      navigationType: metric.navigationType ?? 'navigate',
    });
  } catch {
    // Silently fail
  }
}

/**
 * Flag to track if web vitals have been initialized.
 */
let initialized = false;

/**
 * Initialize Web Vitals tracking.
 *
 * @remarks
 * Call this once during app initialization. Web Vitals will be
 * automatically reported to Faro when they become available.
 *
 * @param callback - Optional callback for each metric
 * @returns Cleanup function
 *
 * @example
 * ```typescript
 * // Basic usage
 * initWebVitals();
 *
 * // With callback
 * initWebVitals((metric) => {
 *   console.log(`${metric.name}: ${metric.value} (${metric.rating})`);
 * });
 *
 * // Cleanup
 * const cleanup = initWebVitals();
 * // Later...
 * cleanup();
 * ```
 */
export function initWebVitals(callback?: WebVitalsCallback): () => void {
  // Only run in browser
  if (typeof window === 'undefined') {
    return () => {};
  }

  // Prevent double initialization
  if (initialized) {
    return () => {};
  }
  initialized = true;

  // Create handler factory
  const createHandler = (name: WebVitalName) => {
    return (metric: Metric) => {
      // Report to Faro
      reportToFaro(metric);

      // Call user callback
      if (callback) {
        callback({
          name,
          value: metric.value,
          rating: getRating(name, metric.value),
          id: metric.id,
        });
      }
    };
  };

  // Register handlers - web-vitals v4+ doesn't return cleanup functions
  try {
    onLCP(createHandler('LCP') as Parameters<typeof onLCP>[0]);
    onCLS(createHandler('CLS') as Parameters<typeof onCLS>[0]);
    onINP(createHandler('INP') as Parameters<typeof onINP>[0]);
    onFCP(createHandler('FCP') as Parameters<typeof onFCP>[0]);
    onTTFB(createHandler('TTFB') as Parameters<typeof onTTFB>[0]);
  } catch {
    // web-vitals may fail on some browsers
  }

  // Return no-op cleanup function (web-vitals v4+ doesn't support cleanup)
  return () => {
    // No cleanup needed - web-vitals handlers are one-time
  };
}

/**
 * Get a formatted summary of the current page's performance.
 *
 * @returns Performance summary object
 */
export function getPerformanceSummary(): Record<string, number> {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const timing = performance.getEntriesByType('navigation')[0] as
      | PerformanceNavigationTiming
      | undefined;
    if (!timing) return {};

    return {
      dns: Math.round(timing.domainLookupEnd - timing.domainLookupStart),
      tcp: Math.round(timing.connectEnd - timing.connectStart),
      ttfb: Math.round(timing.responseStart - timing.requestStart),
      download: Math.round(timing.responseEnd - timing.responseStart),
      domParse: Math.round(timing.domInteractive - timing.responseEnd),
      domComplete: Math.round(timing.domComplete - timing.domInteractive),
      total: Math.round(timing.loadEventEnd - timing.startTime),
    };
  } catch {
    return {};
  }
}

/**
 * Report custom performance timing.
 *
 * @param name - Metric name
 * @param value - Value in milliseconds
 * @param attributes - Additional attributes
 */
export function reportTiming(
  name: string,
  value: number,
  attributes?: Record<string, string>
): void {
  const faro = getFaro();
  if (!faro) return;

  try {
    faro.api.pushMeasurement({
      type: name,
      values: { duration: value },
    });

    if (attributes) {
      faro.api.pushEvent(`${name}_timing`, {
        value: value.toString(),
        ...attributes,
      });
    }
  } catch {
    // Silently fail
  }
}

/**
 * Create a performance mark and measure.
 *
 * @param name - Mark/measure name
 * @returns Object with mark() and measure() methods
 *
 * @example
 * ```typescript
 * const perf = createPerformanceMark('data-fetch');
 * perf.mark('start');
 * await fetchData();
 * perf.mark('end');
 * perf.measure(); // Reports timing to Faro
 * ```
 */
export function createPerformanceMark(name: string) {
  const startMark = `${name}-start`;
  const endMark = `${name}-end`;

  return {
    mark(phase: 'start' | 'end'): void {
      if (typeof performance === 'undefined') return;
      try {
        performance.mark(phase === 'start' ? startMark : endMark);
      } catch {
        // Ignore
      }
    },

    measure(attributes?: Record<string, string>): number | undefined {
      if (typeof performance === 'undefined') return undefined;

      try {
        const measure = performance.measure(name, startMark, endMark);
        const duration = Math.round(measure.duration);

        // Report to Faro
        reportTiming(name, duration, attributes);

        // Cleanup marks
        performance.clearMarks(startMark);
        performance.clearMarks(endMark);
        performance.clearMeasures(name);

        return duration;
      } catch {
        return undefined;
      }
    },
  };
}
