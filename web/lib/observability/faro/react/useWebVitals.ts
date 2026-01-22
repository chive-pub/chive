/**
 * React hook for Web Vitals tracking.
 *
 * @remarks
 * Tracks Core Web Vitals (LCP, CLS, INP, FCP, TTFB) and reports
 * them to Faro for monitoring and alerting.
 *
 * @packageDocumentation
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import type { Metric, CLSMetric, FCPMetric, INPMetric, LCPMetric, TTFBMetric } from 'web-vitals';
import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals';

import { getFaro } from '../initialize';

/**
 * Web Vitals thresholds (based on Google's recommendations).
 */
export const WEB_VITALS_THRESHOLDS = {
  LCP: {
    good: 2500,
    needsImprovement: 4000,
  },
  CLS: {
    good: 0.1,
    needsImprovement: 0.25,
  },
  INP: {
    good: 200,
    needsImprovement: 500,
  },
  FCP: {
    good: 1800,
    needsImprovement: 3000,
  },
  TTFB: {
    good: 800,
    needsImprovement: 1800,
  },
} as const;

/**
 * Web Vitals data.
 */
export interface WebVitalsData {
  /** Largest Contentful Paint (ms) */
  lcp?: number;
  /** Cumulative Layout Shift */
  cls?: number;
  /** Interaction to Next Paint (ms) */
  inp?: number;
  /** First Contentful Paint (ms) */
  fcp?: number;
  /** Time to First Byte (ms) */
  ttfb?: number;
}

/**
 * Rating for a Web Vital metric.
 */
export type WebVitalRating = 'good' | 'needs-improvement' | 'poor';

/**
 * Get rating for a metric value.
 */
function getRating(name: keyof typeof WEB_VITALS_THRESHOLDS, value: number): WebVitalRating {
  const thresholds = WEB_VITALS_THRESHOLDS[name];
  if (value <= thresholds.good) return 'good';
  if (value <= thresholds.needsImprovement) return 'needs-improvement';
  return 'poor';
}

/**
 * Report a web vital to Faro.
 */
function reportWebVital(metric: Metric): void {
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

    // Also push as event for more context
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
 * Hook options.
 */
export interface UseWebVitalsOptions {
  /** Enable tracking (default: true) */
  enabled?: boolean;
  /** Report all changes, not just final values (default: false) */
  reportAllChanges?: boolean;
  /** Callback when metrics are collected */
  onMetric?: (name: string, value: number, rating: WebVitalRating) => void;
}

/**
 * Hook for tracking Web Vitals.
 *
 * @param options - Configuration options
 * @returns Current Web Vitals data
 *
 * @example
 * ```tsx
 * function App() {
 *   const vitals = useWebVitals({
 *     onMetric: (name, value, rating) => {
 *       console.log(`${name}: ${value} (${rating})`);
 *     },
 *   });
 *
 *   return (
 *     <div>
 *       {vitals.lcp && <p>LCP: {vitals.lcp}ms</p>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useWebVitals(options: UseWebVitalsOptions = {}): WebVitalsData {
  const { enabled = true, reportAllChanges = false, onMetric } = options;

  const [vitals, setVitals] = useState<WebVitalsData>({});
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    // Only run on client
    if (typeof window === 'undefined') return;

    // Prevent double initialization
    if (initializedRef.current) return;
    initializedRef.current = true;

    const createHandler = (name: keyof typeof WEB_VITALS_THRESHOLDS) => {
      return (metric: Metric) => {
        // Report to Faro
        reportWebVital(metric);

        // Update local state
        setVitals((prev) => ({
          ...prev,
          [name.toLowerCase()]: metric.value,
        }));

        // Call user callback
        if (onMetric) {
          const rating = getRating(name, metric.value);
          onMetric(name, metric.value, rating);
        }
      };
    };

    // Register handlers - web-vitals v4+ doesn't return cleanup functions
    try {
      onLCP(createHandler('LCP') as (metric: LCPMetric) => void, { reportAllChanges });
      onCLS(createHandler('CLS') as (metric: CLSMetric) => void, { reportAllChanges });
      onINP(createHandler('INP') as (metric: INPMetric) => void, { reportAllChanges });
      onFCP(createHandler('FCP') as (metric: FCPMetric) => void, { reportAllChanges });
      onTTFB(createHandler('TTFB') as (metric: TTFBMetric) => void, { reportAllChanges });
    } catch {
      // web-vitals may fail on some browsers
    }

    // No cleanup needed - web-vitals handlers are one-time per page load
  }, [enabled, reportAllChanges, onMetric]);

  return vitals;
}

/**
 * Get a summary of Web Vitals performance.
 *
 * @param vitals - Web Vitals data
 * @returns Summary with ratings
 */
export function getWebVitalsSummary(vitals: WebVitalsData): {
  overall: WebVitalRating;
  ratings: Record<string, WebVitalRating>;
} {
  const ratings: Record<string, WebVitalRating> = {};
  let worstRating: WebVitalRating = 'good';

  if (vitals.lcp !== undefined) {
    ratings.lcp = getRating('LCP', vitals.lcp);
  }
  if (vitals.cls !== undefined) {
    ratings.cls = getRating('CLS', vitals.cls);
  }
  if (vitals.inp !== undefined) {
    ratings.inp = getRating('INP', vitals.inp);
  }
  if (vitals.fcp !== undefined) {
    ratings.fcp = getRating('FCP', vitals.fcp);
  }
  if (vitals.ttfb !== undefined) {
    ratings.ttfb = getRating('TTFB', vitals.ttfb);
  }

  // Calculate overall rating (worst of all)
  for (const rating of Object.values(ratings)) {
    if (rating === 'poor') {
      worstRating = 'poor';
      break;
    }
    if (rating === 'needs-improvement') {
      worstRating = 'needs-improvement';
    }
  }

  return { overall: worstRating, ratings };
}
