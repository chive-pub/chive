/**
 * Faro route tracker component for Next.js App Router.
 *
 * @remarks
 * Tracks route changes and reports them to Faro for navigation
 * timing and user flow analysis.
 *
 * @packageDocumentation
 */

'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

import { getFaro } from '../initialize';
import { scrubUrl } from '../privacy';

/**
 * Route tracker props.
 */
export interface FaroRouteTrackerProps {
  /** Whether to include search params in route name */
  includeSearchParams?: boolean;
  /** Paths to ignore (regex patterns) */
  ignorePaths?: (string | RegExp)[];
  /** Transform path before reporting */
  transformPath?: (path: string) => string;
}

/**
 * Track route changes and report to Faro.
 *
 * @remarks
 * Place this component inside the Providers wrapper to track
 * navigation events. It uses Next.js App Router hooks for
 * route change detection.
 *
 * @example
 * ```tsx
 * // In Providers or layout
 * <FaroRouteTracker />
 *
 * // With options
 * <FaroRouteTracker
 *   ignorePaths={[/^\/api\//]}
 *   transformPath={(path) => path.replace(/\/\d+/g, '/:id')}
 * />
 * ```
 */
export function FaroRouteTracker({
  includeSearchParams = false,
  ignorePaths = [],
  transformPath,
}: FaroRouteTrackerProps = {}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Track previous path to detect changes
  const prevPathRef = useRef<string | null>(null);
  const navigationStartRef = useRef<number>(0);

  useEffect(() => {
    const faro = getFaro();
    if (!faro || !pathname) return;

    // Check if path should be ignored
    const shouldIgnore = ignorePaths.some((pattern) => {
      if (typeof pattern === 'string') {
        return pathname === pattern;
      }
      return pattern.test(pathname);
    });

    if (shouldIgnore) return;

    // Build full path
    let fullPath = pathname;
    if (includeSearchParams && searchParams?.toString()) {
      fullPath = `${pathname}?${searchParams.toString()}`;
    }

    // Scrub for privacy
    const scrubbedPath = scrubUrl(fullPath);

    // Transform if needed
    const finalPath = transformPath ? transformPath(scrubbedPath) : scrubbedPath;

    // Only report if path changed
    if (prevPathRef.current === finalPath) return;

    // Calculate navigation duration
    const now = performance.now();
    const navigationDuration =
      prevPathRef.current !== null ? Math.round(now - navigationStartRef.current) : 0;

    // Update refs
    const previousPath = prevPathRef.current;
    prevPathRef.current = finalPath;
    navigationStartRef.current = now;

    try {
      // Push view event
      faro.api.pushEvent('route_change', {
        to: finalPath,
        from: previousPath ?? '(initial)',
        navigationType: previousPath === null ? 'initial' : 'client',
        duration: navigationDuration.toString(),
      });

      // Also set view for session tracking
      faro.api.setView({
        name: finalPath,
      });

      // Push timing measurement if not initial load
      if (previousPath !== null && navigationDuration > 0) {
        faro.api.pushMeasurement({
          type: 'navigation',
          values: {
            duration: navigationDuration,
          },
        });
      }
    } catch {
      // Silently fail
    }
  }, [pathname, searchParams, includeSearchParams, ignorePaths, transformPath]);

  // Track initial page load timing
  useEffect(() => {
    const faro = getFaro();
    if (!faro) return;

    // Wait for page to fully load
    if (typeof window === 'undefined') return;

    const reportLoadTiming = () => {
      try {
        const timing = performance.getEntriesByType('navigation')[0] as
          | PerformanceNavigationTiming
          | undefined;
        if (!timing) return;

        faro.api.pushMeasurement({
          type: 'page-load',
          values: {
            dns: timing.domainLookupEnd - timing.domainLookupStart,
            tcp: timing.connectEnd - timing.connectStart,
            ttfb: timing.responseStart - timing.requestStart,
            download: timing.responseEnd - timing.responseStart,
            domParse: timing.domInteractive - timing.responseEnd,
            domComplete: timing.domComplete - timing.domInteractive,
            total: timing.loadEventEnd - timing.startTime,
          },
        });
      } catch {
        // Timing API may not be available
      }
    };

    // Report after load event
    if (document.readyState === 'complete') {
      setTimeout(reportLoadTiming, 0);
    } else {
      window.addEventListener('load', reportLoadTiming);
      return () => window.removeEventListener('load', reportLoadTiming);
    }
  }, []);

  // This component doesn't render anything
  return null;
}

/**
 * Utility to parameterize paths for consistent grouping.
 *
 * @param path - Original path
 * @returns Parameterized path
 *
 * @example
 * ```typescript
 * parameterizePath('/eprints/123/versions/456');
 * // Returns: '/eprints/:id/versions/:id'
 * ```
 */
export function parameterizePath(path: string): string {
  return (
    path
      // Replace UUIDs
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':uuid')
      // Replace numeric IDs
      .replace(/\/\d+(?=\/|$)/g, '/:id')
      // Replace base32 CIDs (common in ATProto)
      .replace(/\/[a-z2-7]{32,}/gi, '/:cid')
      // Replace DIDs
      .replace(/\/did:[a-z]+:[a-z0-9]+/gi, '/:did')
  );
}
