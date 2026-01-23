/**
 * Grafana Faro SDK initialization.
 *
 * @remarks
 * Initializes the Faro Web SDK with OpenTelemetry tracing integration.
 * Handles graceful degradation when collector is unavailable.
 *
 * @packageDocumentation
 */

import {
  initializeFaro as initFaro,
  getWebInstrumentations,
  type Faro,
} from '@grafana/faro-web-sdk';
import { TracingInstrumentation } from '@grafana/faro-web-tracing';

import { type FaroConfig, getFaroConfig, validateFaroConfig } from './config';
import { createInstrumentations } from './instrumentations';
import { createSampler } from './sampling';
import { getPersistedSessionId } from './session';

/**
 * Global Faro instance (singleton).
 */
let faroInstance: Faro | null = null;

/**
 * Flag to track initialization state.
 */
let isInitializing = false;

/**
 * Get the current Faro instance.
 *
 * @returns Faro instance or null if not initialized
 */
export function getFaro(): Faro | null {
  return faroInstance;
}

/**
 * Check if Faro is initialized.
 */
export function isFaroInitialized(): boolean {
  return faroInstance !== null;
}

/**
 * Initialize Grafana Faro Web SDK.
 *
 * @param configOverrides - Optional configuration overrides
 * @returns Initialized Faro instance or null if disabled/failed
 *
 * @example
 * ```typescript
 * // Basic initialization
 * const faro = initializeFaro();
 *
 * // With overrides
 * const faro = initializeFaro({
 *   traceSampleRate: 1.0, // 100% sampling for debugging
 * });
 * ```
 */
export function initializeFaro(configOverrides?: Partial<FaroConfig>): Faro | null {
  // Return existing instance if already initialized
  if (faroInstance) {
    return faroInstance;
  }

  // Prevent concurrent initialization
  if (isInitializing) {
    return null;
  }

  isInitializing = true;

  try {
    // Get configuration
    const baseConfig = getFaroConfig();
    const config: FaroConfig = { ...baseConfig, ...configOverrides };

    // Validate configuration
    const errors = validateFaroConfig(config);
    if (errors.length > 0) {
      console.warn('[Faro] Configuration errors:', errors);
      if (config.environment === 'production') {
        isInitializing = false;
        return null;
      }
    }

    // Check if disabled
    if (!config.enabled) {
      if (process.env.NODE_ENV === 'development') {
        console.debug('[Faro] Disabled by configuration');
      }
      isInitializing = false;
      return null;
    }

    // Create sampler
    const sampler = createSampler(config);
    const sessionDecision = sampler.shouldCaptureSession();

    // Skip initialization if session not sampled (in production)
    if (!sessionDecision.shouldCapture && config.environment === 'production') {
      isInitializing = false;
      return null;
    }

    // Build instrumentations
    const otelInstrumentations = createInstrumentations(config);

    // Initialize Faro with core options
    faroInstance = initFaro({
      url: config.collectorUrl,
      app: {
        name: config.appName,
        version: config.appVersion,
        environment: config.environment,
      },

      // Session configuration
      sessionTracking: {
        enabled: true,
        persistent: true,
        samplingRate: config.sessionSampleRate,
      },

      // Batching configuration
      batching: {
        enabled: true,
        sendTimeout: 5000,
        itemLimit: 25,
      },

      // Built-in instrumentations
      instrumentations: [
        // Faro's web instrumentations (console, errors, etc.)
        ...getWebInstrumentations({
          captureConsole: config.instrumentConsole,
        }),

        // OpenTelemetry tracing
        new TracingInstrumentation({
          instrumentations: otelInstrumentations,
        }),
      ],

      // Ignore internal URLs
      ignoreUrls: [/\/_next\//, /\/favicon\.ico/, /\/api\/health/, /localhost:3001/],

      // Don't track errors from these URLs
      ignoreErrors: [
        // Ignore errors from browser extensions
        /chrome-extension:/,
        /moz-extension:/,
        // Ignore ResizeObserver errors (common false positive)
        /ResizeObserver loop/,
        // Ignore cancelled requests
        /AbortError/,
      ],

      // User tracking (privacy-conscious)
      user: {
        // Session ID for correlation without user identity
        id: getPersistedSessionId(),
      },
    });

    // Log initialization
    if (process.env.NODE_ENV === 'development') {
      console.log('[Faro] Observability initialized', {
        environment: config.environment,
        version: config.appVersion,
        collectorUrl: config.collectorUrl || '(console only)',
        traceSampleRate: config.traceSampleRate,
        sessionSampleRate: config.sessionSampleRate,
      });
    }

    return faroInstance;
  } catch (error) {
    console.error('[Faro] Initialization failed:', error);
    isInitializing = false;
    return null;
  } finally {
    isInitializing = false;
  }
}

/**
 * Shutdown Faro and clean up resources.
 */
export function shutdownFaro(): void {
  if (faroInstance) {
    // Faro doesn't have a shutdown method, but we can null the reference
    faroInstance = null;
  }
}

/**
 * Pause Faro data collection.
 */
export function pauseFaro(): void {
  if (faroInstance) {
    faroInstance.pause();
  }
}

/**
 * Resume Faro data collection.
 */
export function resumeFaro(): void {
  if (faroInstance) {
    faroInstance.unpause();
  }
}
