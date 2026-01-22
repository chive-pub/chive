/**
 * Sampling strategies for Faro observability.
 *
 * @remarks
 * Provides cost-effective sampling strategies for production use.
 * Errors are always captured (with rate limiting), while traces
 * and session data use configurable sampling rates.
 *
 * @packageDocumentation
 */

import type { FaroConfig } from './config';

/**
 * Session sampling state.
 */
interface SamplingState {
  /** Whether this session is sampled for RUM */
  isSessionSampled: boolean;
  /** Whether this session is sampled for traces */
  isTraceSampled: boolean;
  /** Error count for rate limiting */
  errorCount: number;
  /** Last error timestamp for rate limiting */
  lastErrorTime: number;
}

/**
 * Error rate limiting configuration.
 */
const ERROR_RATE_LIMIT = {
  /** Maximum errors per window */
  maxErrors: 10,
  /** Window duration in milliseconds (1 minute) */
  windowMs: 60_000,
};

/**
 * Storage key for sampling state.
 */
const SAMPLING_STATE_KEY = 'chive:faro:sampling';

/**
 * Get or create sampling state for this session.
 */
function getSamplingState(config: FaroConfig): SamplingState {
  // Try to restore from session storage
  if (typeof sessionStorage !== 'undefined') {
    try {
      const stored = sessionStorage.getItem(SAMPLING_STATE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // Ignore storage errors
    }
  }

  // Create new state based on sampling rates
  const state: SamplingState = {
    isSessionSampled: Math.random() < config.sessionSampleRate,
    isTraceSampled: Math.random() < config.traceSampleRate,
    errorCount: 0,
    lastErrorTime: 0,
  };

  // Persist to session storage
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.setItem(SAMPLING_STATE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage errors
    }
  }

  return state;
}

/**
 * Update sampling state in session storage.
 */
function updateSamplingState(state: SamplingState): void {
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.setItem(SAMPLING_STATE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage errors
    }
  }
}

/**
 * Check if an error should be captured based on rate limiting.
 *
 * @param state - Current sampling state
 * @returns Whether the error should be captured
 */
function shouldCaptureError(state: SamplingState): boolean {
  const now = Date.now();

  // Reset window if expired
  if (now - state.lastErrorTime > ERROR_RATE_LIMIT.windowMs) {
    state.errorCount = 0;
    state.lastErrorTime = now;
  }

  // Check rate limit
  if (state.errorCount >= ERROR_RATE_LIMIT.maxErrors) {
    return false;
  }

  state.errorCount++;
  state.lastErrorTime = now;
  updateSamplingState(state);

  return true;
}

/**
 * Sampling decision result.
 */
export interface SamplingDecision {
  /** Whether to capture this item */
  shouldCapture: boolean;
  /** Reason for the decision */
  reason: string;
}

/**
 * Create a sampler for Faro events.
 *
 * @param config - Faro configuration
 * @returns Sampler functions
 */
export function createSampler(config: FaroConfig) {
  const state = getSamplingState(config);

  return {
    /**
     * Check if this session should capture RUM data.
     */
    shouldCaptureSession(): SamplingDecision {
      return {
        shouldCapture: state.isSessionSampled,
        reason: state.isSessionSampled
          ? 'Session sampled'
          : `Session not sampled (rate: ${config.sessionSampleRate})`,
      };
    },

    /**
     * Check if this session should capture traces.
     */
    shouldCaptureTrace(): SamplingDecision {
      return {
        shouldCapture: state.isTraceSampled,
        reason: state.isTraceSampled
          ? 'Trace sampled'
          : `Trace not sampled (rate: ${config.traceSampleRate})`,
      };
    },

    /**
     * Check if an error should be captured.
     * Errors are always captured if within rate limit.
     */
    shouldCaptureError(): SamplingDecision {
      const shouldCapture = shouldCaptureError(state);
      return {
        shouldCapture,
        reason: shouldCapture ? 'Error captured' : 'Error rate limited',
      };
    },

    /**
     * Get current sampling state for debugging.
     */
    getState(): Readonly<SamplingState> {
      return { ...state };
    },

    /**
     * Force-sample this session (e.g., for debugging).
     */
    forceSample(): void {
      state.isSessionSampled = true;
      state.isTraceSampled = true;
      updateSamplingState(state);
    },
  };
}

/**
 * OpenTelemetry trace sampler based on Faro config.
 *
 * @param config - Faro configuration
 * @returns Sampler function for OpenTelemetry
 */
export function createTraceSampler(config: FaroConfig) {
  const state = getSamplingState(config);

  return {
    /**
     * Determine if a trace should be sampled.
     *
     * @returns Sampling decision
     */
    shouldSample(): { decision: number } {
      // Decision values: 0 = NOT_RECORD, 1 = RECORD, 2 = RECORD_AND_SAMPLED
      return {
        decision: state.isTraceSampled ? 2 : 0,
      };
    },

    /**
     * Get sampler description.
     */
    toString(): string {
      return `ChiveSampler{rate=${config.traceSampleRate}, sampled=${state.isTraceSampled}}`;
    },
  };
}
