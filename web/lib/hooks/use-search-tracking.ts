/**
 * Search interaction tracking hook for LTR training data.
 *
 * @remarks
 * Tracks user interactions with search results for Learning to Rank model training.
 * Uses the Beacon API for dwell time tracking to ensure delivery on page exit.
 *
 * @example
 * ```tsx
 * const { trackClick, trackDwellTime } = useSearchTracking(impressionId);
 *
 * // Track click on result
 * <Link
 *   href={`/eprints/${uri}`}
 *   onClick={() => trackClick(uri, position)}
 * >
 *   {title}
 * </Link>
 *
 * // Dwell time is automatically tracked when user leaves the page
 * ```
 *
 * @packageDocumentation
 */

import { useCallback, useEffect, useRef } from 'react';

import { api } from '@/lib/api/client';

/**
 * Click tracking data stored in sessionStorage.
 */
interface ClickData {
  impressionId: string;
  uri: string;
  position: number;
  startTime: number;
}

const CLICK_DATA_KEY = 'chive:search:click';

/**
 * Hook for tracking search result interactions.
 *
 * @param impressionId - Impression ID from search response
 * @returns Object with tracking functions
 */
export function useSearchTracking(impressionId: string | undefined) {
  const _dwellStartTime = useRef<number | null>(null);
  const _currentClick = useRef<ClickData | null>(null);

  /**
   * Tracks a click on a search result.
   */
  const trackClick = useCallback(
    async (uri: string, position: number) => {
      if (!impressionId) return;

      // Store click data for dwell time tracking
      const clickData: ClickData = {
        impressionId,
        uri,
        position,
        startTime: Date.now(),
      };

      // Persist to sessionStorage for cross-page tracking
      try {
        sessionStorage.setItem(CLICK_DATA_KEY, JSON.stringify(clickData));
      } catch {
        // sessionStorage may be unavailable
      }

      // Record the click
      try {
        await api.POST('/xrpc/pub.chive.metrics.recordSearchClick', {
          body: {
            impressionId,
            uri,
            position,
          },
        });
      } catch (error) {
        console.warn('Failed to record search click:', error);
      }
    },
    [impressionId]
  );

  /**
   * Sends dwell time via Beacon API.
   */
  const sendDwellTime = useCallback((data: ClickData) => {
    const dwellTimeMs = Date.now() - data.startTime;

    // Use Beacon API for reliable delivery on page exit
    if (navigator.sendBeacon) {
      const payload = JSON.stringify({
        impressionId: data.impressionId,
        uri: data.uri,
        dwellTimeMs,
      });

      navigator.sendBeacon(
        '/xrpc/pub.chive.metrics.recordDwellTime',
        new Blob([payload], { type: 'application/json' })
      );
    } else {
      // Fallback to fetch with keepalive
      fetch('/xrpc/pub.chive.metrics.recordDwellTime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          impressionId: data.impressionId,
          uri: data.uri,
          dwellTimeMs,
        }),
        keepalive: true,
      }).catch(() => {
        // Best effort; do not block page exit.
      });
    }

    // Clear stored click data
    try {
      sessionStorage.removeItem(CLICK_DATA_KEY);
    } catch {
      // sessionStorage may be unavailable
    }
  }, []);

  /**
   * Records a download event (strong relevance signal).
   */
  const trackDownload = useCallback(
    async (uri: string) => {
      if (!impressionId) return;

      try {
        await api.POST('/xrpc/pub.chive.metrics.recordSearchDownload', {
          body: {
            impressionId,
            uri,
          },
        });
      } catch (error) {
        console.warn('Failed to record search download:', error);
      }
    },
    [impressionId]
  );

  // Set up visibility change listener for dwell time tracking
  useEffect(() => {
    // Check for pending click data on mount (returning from eprint page)
    try {
      const storedData = sessionStorage.getItem(CLICK_DATA_KEY);
      if (storedData) {
        const clickData = JSON.parse(storedData) as ClickData;
        // If we're back on the search page, send the dwell time
        sendDwellTime(clickData);
      }
    } catch {
      // sessionStorage may be unavailable or corrupted
    }

    // Handle page visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        try {
          const storedData = sessionStorage.getItem(CLICK_DATA_KEY);
          if (storedData) {
            const clickData = JSON.parse(storedData) as ClickData;
            sendDwellTime(clickData);
          }
        } catch {
          // Best effort
        }
      }
    };

    // Handle page unload
    const handleBeforeUnload = () => {
      try {
        const storedData = sessionStorage.getItem(CLICK_DATA_KEY);
        if (storedData) {
          const clickData = JSON.parse(storedData) as ClickData;
          sendDwellTime(clickData);
        }
      } catch {
        // Best effort
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [sendDwellTime]);

  return {
    trackClick,
    trackDownload,
  };
}

/**
 * Marks the start of viewing an eprint page (called on eprint page mount).
 *
 * @remarks
 * This should be called when an eprint page loads to mark the start time
 * for dwell time calculation.
 */
export function markEprintViewStart(): void {
  try {
    const storedData = sessionStorage.getItem(CLICK_DATA_KEY);
    if (storedData) {
      const clickData = JSON.parse(storedData) as ClickData;
      // Update start time to now (more accurate)
      clickData.startTime = Date.now();
      sessionStorage.setItem(CLICK_DATA_KEY, JSON.stringify(clickData));
    }
  } catch {
    // sessionStorage may be unavailable
  }
}

export default useSearchTracking;
