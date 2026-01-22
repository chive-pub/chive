/**
 * Tests for useWebVitals hook.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock web-vitals
const mockOnLCP = vi.fn();
const mockOnCLS = vi.fn();
const mockOnINP = vi.fn();
const mockOnFCP = vi.fn();
const mockOnTTFB = vi.fn();

vi.mock('web-vitals', () => ({
  onLCP: (callback: (metric: unknown) => void, options?: unknown) => mockOnLCP(callback, options),
  onCLS: (callback: (metric: unknown) => void, options?: unknown) => mockOnCLS(callback, options),
  onINP: (callback: (metric: unknown) => void, options?: unknown) => mockOnINP(callback, options),
  onFCP: (callback: (metric: unknown) => void, options?: unknown) => mockOnFCP(callback, options),
  onTTFB: (callback: (metric: unknown) => void, options?: unknown) => mockOnTTFB(callback, options),
}));

// Mock getFaro
vi.mock('../initialize', () => ({
  getFaro: vi.fn(() => ({
    api: {
      pushMeasurement: vi.fn(),
      pushEvent: vi.fn(),
    },
  })),
}));

import {
  useWebVitals,
  getWebVitalsSummary,
  WEB_VITALS_THRESHOLDS,
  type WebVitalsData,
} from './useWebVitals';

describe('useWebVitals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns empty vitals initially', () => {
    const { result } = renderHook(() => useWebVitals());

    expect(result.current).toEqual({});
  });

  it('registers all web vitals handlers on mount', () => {
    renderHook(() => useWebVitals());

    expect(mockOnLCP).toHaveBeenCalled();
    expect(mockOnCLS).toHaveBeenCalled();
    expect(mockOnINP).toHaveBeenCalled();
    expect(mockOnFCP).toHaveBeenCalled();
    expect(mockOnTTFB).toHaveBeenCalled();
  });

  it('does not register handlers when disabled', () => {
    renderHook(() => useWebVitals({ enabled: false }));

    expect(mockOnLCP).not.toHaveBeenCalled();
    expect(mockOnCLS).not.toHaveBeenCalled();
    expect(mockOnINP).not.toHaveBeenCalled();
    expect(mockOnFCP).not.toHaveBeenCalled();
    expect(mockOnTTFB).not.toHaveBeenCalled();
  });

  it('updates state when LCP is reported', async () => {
    const { result } = renderHook(() => useWebVitals());

    // Get the callback that was passed to onLCP
    const lcpCallback = mockOnLCP.mock.calls[0][0];

    // Simulate LCP metric being reported
    act(() => {
      lcpCallback({
        name: 'LCP',
        value: 2500,
        id: 'lcp-1',
        rating: 'good',
        navigationType: 'navigate',
      });
    });

    await waitFor(() => {
      expect(result.current.lcp).toBe(2500);
    });
  });

  it('updates state when CLS is reported', async () => {
    const { result } = renderHook(() => useWebVitals());

    const clsCallback = mockOnCLS.mock.calls[0][0];

    act(() => {
      clsCallback({
        name: 'CLS',
        value: 0.05,
        id: 'cls-1',
        rating: 'good',
        navigationType: 'navigate',
      });
    });

    await waitFor(() => {
      expect(result.current.cls).toBe(0.05);
    });
  });

  it('calls onMetric callback when metrics are reported', async () => {
    const onMetric = vi.fn();
    renderHook(() => useWebVitals({ onMetric }));

    const lcpCallback = mockOnLCP.mock.calls[0][0];

    act(() => {
      lcpCallback({
        name: 'LCP',
        value: 2000,
        id: 'lcp-1',
        rating: 'good',
        navigationType: 'navigate',
      });
    });

    await waitFor(() => {
      expect(onMetric).toHaveBeenCalledWith('LCP', 2000, 'good');
    });
  });

  it('passes reportAllChanges option to web-vitals', () => {
    renderHook(() => useWebVitals({ reportAllChanges: true }));

    expect(mockOnLCP).toHaveBeenCalledWith(expect.any(Function), { reportAllChanges: true });
  });

  it('only initializes once even with re-renders', () => {
    const { rerender } = renderHook(() => useWebVitals());

    rerender();
    rerender();
    rerender();

    // Each handler should only be called once
    expect(mockOnLCP).toHaveBeenCalledTimes(1);
    expect(mockOnCLS).toHaveBeenCalledTimes(1);
  });
});

describe('getWebVitalsSummary', () => {
  it('returns good overall when all vitals are good', () => {
    const vitals: WebVitalsData = {
      lcp: 2000, // good < 2500
      cls: 0.05, // good < 0.1
      inp: 150, // good < 200
      fcp: 1500, // good < 1800
      ttfb: 500, // good < 800
    };

    const summary = getWebVitalsSummary(vitals);

    expect(summary.overall).toBe('good');
    expect(summary.ratings.lcp).toBe('good');
    expect(summary.ratings.cls).toBe('good');
    expect(summary.ratings.inp).toBe('good');
    expect(summary.ratings.fcp).toBe('good');
    expect(summary.ratings.ttfb).toBe('good');
  });

  it('returns needs-improvement when any vital needs improvement', () => {
    const vitals: WebVitalsData = {
      lcp: 3000, // needs-improvement (2500-4000)
      cls: 0.05, // good
      inp: 150, // good
    };

    const summary = getWebVitalsSummary(vitals);

    expect(summary.overall).toBe('needs-improvement');
    expect(summary.ratings.lcp).toBe('needs-improvement');
  });

  it('returns poor when any vital is poor', () => {
    const vitals: WebVitalsData = {
      lcp: 5000, // poor > 4000
      cls: 0.05, // good
      inp: 150, // good
    };

    const summary = getWebVitalsSummary(vitals);

    expect(summary.overall).toBe('poor');
    expect(summary.ratings.lcp).toBe('poor');
  });

  it('handles empty vitals', () => {
    const vitals: WebVitalsData = {};

    const summary = getWebVitalsSummary(vitals);

    expect(summary.overall).toBe('good'); // No bad ratings
    expect(summary.ratings).toEqual({});
  });

  it('handles partial vitals', () => {
    const vitals: WebVitalsData = {
      lcp: 2000,
    };

    const summary = getWebVitalsSummary(vitals);

    expect(summary.ratings.lcp).toBe('good');
    expect(summary.ratings.cls).toBeUndefined();
  });
});

describe('WEB_VITALS_THRESHOLDS', () => {
  it('has correct LCP thresholds', () => {
    expect(WEB_VITALS_THRESHOLDS.LCP.good).toBe(2500);
    expect(WEB_VITALS_THRESHOLDS.LCP.needsImprovement).toBe(4000);
  });

  it('has correct CLS thresholds', () => {
    expect(WEB_VITALS_THRESHOLDS.CLS.good).toBe(0.1);
    expect(WEB_VITALS_THRESHOLDS.CLS.needsImprovement).toBe(0.25);
  });

  it('has correct INP thresholds', () => {
    expect(WEB_VITALS_THRESHOLDS.INP.good).toBe(200);
    expect(WEB_VITALS_THRESHOLDS.INP.needsImprovement).toBe(500);
  });

  it('has correct FCP thresholds', () => {
    expect(WEB_VITALS_THRESHOLDS.FCP.good).toBe(1800);
    expect(WEB_VITALS_THRESHOLDS.FCP.needsImprovement).toBe(3000);
  });

  it('has correct TTFB thresholds', () => {
    expect(WEB_VITALS_THRESHOLDS.TTFB.good).toBe(800);
    expect(WEB_VITALS_THRESHOLDS.TTFB.needsImprovement).toBe(1800);
  });
});
