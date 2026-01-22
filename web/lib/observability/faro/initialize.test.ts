/**
 * Tests for Faro initialization.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted to create mocks before they're referenced
const mockInitFaro = vi.hoisted(() =>
  vi.fn(() => ({
    api: {
      pushEvent: vi.fn(),
      pushError: vi.fn(),
    },
    pause: vi.fn(),
    unpause: vi.fn(),
  }))
);

vi.mock('@grafana/faro-web-sdk', () => ({
  initializeFaro: mockInitFaro,
  getWebInstrumentations: vi.fn(() => []),
  LogLevel: { DEBUG: 'debug', INFO: 'info', WARN: 'warn', ERROR: 'error' },
}));

vi.mock('@grafana/faro-web-tracing', () => ({
  TracingInstrumentation: vi.fn(() => ({})),
}));

vi.mock('./config', () => ({
  getFaroConfig: vi.fn(() => ({
    collectorUrl: 'https://faro.example.com',
    appName: 'test-app',
    appVersion: '1.0.0',
    environment: 'test',
    traceSampleRate: 1.0,
    sessionSampleRate: 1.0,
    enabled: true,
    instrumentConsole: true,
    instrumentPerformance: true,
    instrumentErrors: true,
  })),
  validateFaroConfig: vi.fn(() => []),
}));

vi.mock('./instrumentations', () => ({
  createInstrumentations: vi.fn(() => []),
}));

vi.mock('./sampling', () => ({
  createSampler: vi.fn(() => ({
    shouldCaptureSession: vi.fn(() => ({ shouldCapture: true, reason: 'sampled' })),
    shouldCaptureTrace: vi.fn(() => ({ shouldCapture: true, reason: 'sampled' })),
    shouldCaptureError: vi.fn(() => ({ shouldCapture: true, reason: 'sampled' })),
  })),
}));

vi.mock('./session', () => ({
  getPersistedSessionId: vi.fn(() => 'test-session-123'),
}));

// Import after mocks are set up
import {
  initializeFaro,
  getFaro,
  isFaroInitialized,
  shutdownFaro,
  pauseFaro,
  resumeFaro,
} from './initialize';

describe('Faro Initialization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the module state between tests
    shutdownFaro();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initializeFaro', () => {
    it('initializes Faro SDK', () => {
      const faro = initializeFaro();

      expect(faro).not.toBeNull();
      expect(mockInitFaro).toHaveBeenCalled();
    });

    it('returns existing instance on subsequent calls', () => {
      const faro1 = initializeFaro();
      const faro2 = initializeFaro();

      expect(faro1).toBe(faro2);
      expect(mockInitFaro).toHaveBeenCalledTimes(1);
    });

    it('passes correct configuration to Faro SDK', () => {
      initializeFaro();

      expect(mockInitFaro).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://faro.example.com',
          app: expect.objectContaining({
            name: 'test-app',
            version: '1.0.0',
            environment: 'test',
          }),
        })
      );
    });

    it('returns null when disabled', async () => {
      const { getFaroConfig } = await import('./config');
      vi.mocked(getFaroConfig).mockReturnValue({
        collectorUrl: undefined,
        appName: 'test',
        appVersion: '1.0.0',
        environment: 'test',
        traceSampleRate: 1.0,
        sessionSampleRate: 1.0,
        enabled: false,
        instrumentConsole: true,
        instrumentPerformance: true,
        instrumentErrors: true,
      });

      // Reset state
      shutdownFaro();

      const faro = initializeFaro();
      expect(faro).toBeNull();
    });

    it('accepts configuration overrides', async () => {
      // Reset state
      shutdownFaro();

      initializeFaro({ traceSampleRate: 0.5 });

      // The override should be passed to the sampler
      const { createSampler } = await import('./sampling');
      expect(createSampler).toHaveBeenCalledWith(
        expect.objectContaining({
          traceSampleRate: 0.5,
        })
      );
    });
  });

  describe('getFaro', () => {
    it('returns null before initialization', () => {
      expect(getFaro()).toBeNull();
    });

    it('returns Faro instance after initialization', () => {
      initializeFaro();
      expect(getFaro()).not.toBeNull();
    });
  });

  describe('isFaroInitialized', () => {
    it('returns false before initialization', () => {
      expect(isFaroInitialized()).toBe(false);
    });

    it('returns true after initialization', () => {
      initializeFaro();
      expect(isFaroInitialized()).toBe(true);
    });
  });

  describe('shutdownFaro', () => {
    it('clears Faro instance', () => {
      initializeFaro();
      expect(getFaro()).not.toBeNull();

      shutdownFaro();
      expect(getFaro()).toBeNull();
    });
  });

  describe('pauseFaro', () => {
    it('pauses Faro data collection', () => {
      const faro = initializeFaro();
      pauseFaro();

      expect(faro?.pause).toHaveBeenCalled();
    });

    it('does not throw when Faro is not initialized', () => {
      expect(() => pauseFaro()).not.toThrow();
    });
  });

  describe('resumeFaro', () => {
    it('resumes Faro data collection', () => {
      const faro = initializeFaro();
      resumeFaro();

      expect(faro?.unpause).toHaveBeenCalled();
    });

    it('does not throw when Faro is not initialized', () => {
      expect(() => resumeFaro()).not.toThrow();
    });
  });
});
