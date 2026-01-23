/**
 * Tests for web-vitals utilities.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock web-vitals
const mockOnLCP = vi.fn();
const mockOnCLS = vi.fn();
const mockOnINP = vi.fn();
const mockOnFCP = vi.fn();
const mockOnTTFB = vi.fn();

vi.mock('web-vitals', () => ({
  onLCP: mockOnLCP,
  onCLS: mockOnCLS,
  onINP: mockOnINP,
  onFCP: mockOnFCP,
  onTTFB: mockOnTTFB,
}));

// Mock getFaro
const mockPushMeasurement = vi.fn();
const mockPushEvent = vi.fn();

vi.mock('./initialize', () => ({
  getFaro: vi.fn(() => ({
    api: {
      pushMeasurement: mockPushMeasurement,
      pushEvent: mockPushEvent,
    },
  })),
}));

// Mock performance API
const mockPerformanceMark = vi.fn();
const mockPerformanceMeasure = vi.fn(() => ({ duration: 100 }));
const mockPerformanceClearMarks = vi.fn();
const mockPerformanceClearMeasures = vi.fn();
const mockPerformanceGetEntriesByType = vi.fn(() => [
  {
    domainLookupStart: 0,
    domainLookupEnd: 10,
    connectStart: 10,
    connectEnd: 30,
    requestStart: 30,
    responseStart: 50,
    responseEnd: 100,
    domInteractive: 150,
    domComplete: 200,
    startTime: 0,
    loadEventEnd: 250,
  },
]);

Object.defineProperty(global, 'performance', {
  value: {
    mark: mockPerformanceMark,
    measure: mockPerformanceMeasure,
    clearMarks: mockPerformanceClearMarks,
    clearMeasures: mockPerformanceClearMeasures,
    getEntriesByType: mockPerformanceGetEntriesByType,
  },
  writable: true,
});

// Need to reset the module state between tests
let initWebVitals: typeof import('./web-vitals').initWebVitals;
let getRating: typeof import('./web-vitals').getRating;
let getPerformanceSummary: typeof import('./web-vitals').getPerformanceSummary;
let reportTiming: typeof import('./web-vitals').reportTiming;
let createPerformanceMark: typeof import('./web-vitals').createPerformanceMark;
let WEB_VITALS_THRESHOLDS: typeof import('./web-vitals').WEB_VITALS_THRESHOLDS;

describe('Web Vitals Utilities', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset module to clear the initialized flag
    vi.resetModules();
    const webVitalsModule = await import('./web-vitals');
    initWebVitals = webVitalsModule.initWebVitals;
    getRating = webVitalsModule.getRating;
    getPerformanceSummary = webVitalsModule.getPerformanceSummary;
    reportTiming = webVitalsModule.reportTiming;
    createPerformanceMark = webVitalsModule.createPerformanceMark;
    WEB_VITALS_THRESHOLDS = webVitalsModule.WEB_VITALS_THRESHOLDS;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initWebVitals', () => {
    it('registers all web vitals handlers', () => {
      initWebVitals();

      expect(mockOnLCP).toHaveBeenCalled();
      expect(mockOnCLS).toHaveBeenCalled();
      expect(mockOnINP).toHaveBeenCalled();
      expect(mockOnFCP).toHaveBeenCalled();
      expect(mockOnTTFB).toHaveBeenCalled();
    });

    it('returns a cleanup function', () => {
      const cleanup = initWebVitals();

      expect(typeof cleanup).toBe('function');
      // Cleanup should not throw
      expect(() => cleanup()).not.toThrow();
    });

    it('calls user callback with metric data', () => {
      const callback = vi.fn();
      initWebVitals(callback);

      // Simulate LCP metric
      const lcpCallback = mockOnLCP.mock.calls[0][0];
      lcpCallback({
        name: 'LCP',
        value: 2000,
        id: 'lcp-1',
        rating: 'good',
      });

      expect(callback).toHaveBeenCalledWith({
        name: 'LCP',
        value: 2000,
        rating: 'good',
        id: 'lcp-1',
      });
    });

    it('reports metrics to Faro', () => {
      initWebVitals();

      const lcpCallback = mockOnLCP.mock.calls[0][0];
      lcpCallback({
        name: 'LCP',
        value: 2000,
        id: 'lcp-1',
        rating: 'good',
        navigationType: 'navigate',
      });

      expect(mockPushMeasurement).toHaveBeenCalledWith({
        type: 'web-vital',
        values: { lcp: 2000 },
      });

      expect(mockPushEvent).toHaveBeenCalledWith('web_vital', {
        name: 'LCP',
        value: '2000',
        id: 'lcp-1',
        rating: 'good',
        navigationType: 'navigate',
      });
    });

    it('prevents double initialization', async () => {
      initWebVitals();
      initWebVitals();

      // Should only register handlers once
      expect(mockOnLCP).toHaveBeenCalledTimes(1);
    });
  });

  describe('getRating', () => {
    describe('LCP ratings', () => {
      it('returns good for values <= 2500', () => {
        expect(getRating('LCP', 2000)).toBe('good');
        expect(getRating('LCP', 2500)).toBe('good');
      });

      it('returns needs-improvement for values between 2500 and 4000', () => {
        expect(getRating('LCP', 3000)).toBe('needs-improvement');
        expect(getRating('LCP', 4000)).toBe('needs-improvement');
      });

      it('returns poor for values > 4000', () => {
        expect(getRating('LCP', 5000)).toBe('poor');
      });
    });

    describe('CLS ratings', () => {
      it('returns good for values <= 0.1', () => {
        expect(getRating('CLS', 0.05)).toBe('good');
        expect(getRating('CLS', 0.1)).toBe('good');
      });

      it('returns needs-improvement for values between 0.1 and 0.25', () => {
        expect(getRating('CLS', 0.15)).toBe('needs-improvement');
        expect(getRating('CLS', 0.25)).toBe('needs-improvement');
      });

      it('returns poor for values > 0.25', () => {
        expect(getRating('CLS', 0.5)).toBe('poor');
      });
    });

    describe('INP ratings', () => {
      it('returns good for values <= 200', () => {
        expect(getRating('INP', 150)).toBe('good');
        expect(getRating('INP', 200)).toBe('good');
      });

      it('returns needs-improvement for values between 200 and 500', () => {
        expect(getRating('INP', 300)).toBe('needs-improvement');
      });

      it('returns poor for values > 500', () => {
        expect(getRating('INP', 600)).toBe('poor');
      });
    });
  });

  describe('getPerformanceSummary', () => {
    it('returns performance timing data', () => {
      const summary = getPerformanceSummary();

      expect(summary).toHaveProperty('dns');
      expect(summary).toHaveProperty('tcp');
      expect(summary).toHaveProperty('ttfb');
      expect(summary).toHaveProperty('download');
      expect(summary).toHaveProperty('domParse');
      expect(summary).toHaveProperty('domComplete');
      expect(summary).toHaveProperty('total');
    });

    it('calculates correct timing values', () => {
      const summary = getPerformanceSummary();

      expect(summary.dns).toBe(10); // domainLookupEnd - domainLookupStart
      expect(summary.tcp).toBe(20); // connectEnd - connectStart
      expect(summary.ttfb).toBe(20); // responseStart - requestStart
    });

    it('returns empty object when performance API is not available', () => {
      const originalPerformance = global.performance;
      // @ts-expect-error - intentionally testing undefined case
      global.performance = undefined;

      const summary = getPerformanceSummary();
      expect(summary).toEqual({});

      global.performance = originalPerformance;
    });
  });

  describe('reportTiming', () => {
    it('reports timing to Faro', () => {
      reportTiming('api_call', 150, { endpoint: '/api/test' });

      expect(mockPushMeasurement).toHaveBeenCalledWith({
        type: 'api_call',
        values: { duration: 150 },
      });

      expect(mockPushEvent).toHaveBeenCalledWith('api_call_timing', {
        value: '150',
        endpoint: '/api/test',
      });
    });

    it('reports timing without event when no attributes', () => {
      reportTiming('simple_timing', 100);

      expect(mockPushMeasurement).toHaveBeenCalledWith({
        type: 'simple_timing',
        values: { duration: 100 },
      });

      // Event should not be called without attributes
      expect(mockPushEvent).not.toHaveBeenCalled();
    });
  });

  describe('createPerformanceMark', () => {
    it('creates mark and measure methods', () => {
      const perf = createPerformanceMark('test-operation');

      expect(perf).toHaveProperty('mark');
      expect(perf).toHaveProperty('measure');
    });

    it('creates start and end marks', () => {
      const perf = createPerformanceMark('test-operation');

      perf.mark('start');
      expect(mockPerformanceMark).toHaveBeenCalledWith('test-operation-start');

      perf.mark('end');
      expect(mockPerformanceMark).toHaveBeenCalledWith('test-operation-end');
    });

    it('measures and reports duration', () => {
      const perf = createPerformanceMark('test-operation');

      perf.mark('start');
      perf.mark('end');
      const duration = perf.measure({ operation: 'test' });

      expect(duration).toBe(100); // mocked duration
      expect(mockPerformanceMeasure).toHaveBeenCalledWith(
        'test-operation',
        'test-operation-start',
        'test-operation-end'
      );
    });

    it('cleans up marks after measure', () => {
      const perf = createPerformanceMark('test-operation');

      perf.mark('start');
      perf.mark('end');
      perf.measure();

      expect(mockPerformanceClearMarks).toHaveBeenCalledWith('test-operation-start');
      expect(mockPerformanceClearMarks).toHaveBeenCalledWith('test-operation-end');
      expect(mockPerformanceClearMeasures).toHaveBeenCalledWith('test-operation');
    });
  });

  describe('WEB_VITALS_THRESHOLDS', () => {
    it('exports correct threshold values', () => {
      expect(WEB_VITALS_THRESHOLDS.LCP).toEqual({ good: 2500, needsImprovement: 4000 });
      expect(WEB_VITALS_THRESHOLDS.CLS).toEqual({ good: 0.1, needsImprovement: 0.25 });
      expect(WEB_VITALS_THRESHOLDS.INP).toEqual({ good: 200, needsImprovement: 500 });
      expect(WEB_VITALS_THRESHOLDS.FCP).toEqual({ good: 1800, needsImprovement: 3000 });
      expect(WEB_VITALS_THRESHOLDS.TTFB).toEqual({ good: 800, needsImprovement: 1800 });
    });
  });
});
