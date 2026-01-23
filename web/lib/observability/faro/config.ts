/**
 * Grafana Faro configuration module.
 *
 * @remarks
 * Provides environment-based configuration for Faro Web SDK.
 * All configuration is derived from environment variables with sensible defaults.
 *
 * @packageDocumentation
 */

/**
 * Faro configuration options.
 */
export interface FaroConfig {
  /** Faro collector URL */
  collectorUrl: string | undefined;
  /** Application name */
  appName: string;
  /** Application version */
  appVersion: string;
  /** Environment (development, staging, production) */
  environment: string;
  /** Trace sampling rate (0.0 to 1.0) */
  traceSampleRate: number;
  /** Session/RUM sampling rate (0.0 to 1.0) */
  sessionSampleRate: number;
  /** Whether Faro is enabled */
  enabled: boolean;
  /** Enable console instrumentation */
  instrumentConsole: boolean;
  /** Enable performance instrumentation */
  instrumentPerformance: boolean;
  /** Enable error instrumentation */
  instrumentErrors: boolean;
}

/**
 * Parse float with bounds checking.
 */
function parseFloatBounded(value: string | undefined, defaultValue: number): number {
  if (value === undefined) return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : Math.min(1, Math.max(0, parsed));
}

/**
 * Determine the current environment.
 *
 * @remarks
 * Must use direct process.env access for Next.js static replacement.
 */
function getEnvironment(): string {
  // Direct access required for Next.js to inline at build time
  return process.env.NEXT_PUBLIC_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development';
}

/**
 * Determine if Faro should be enabled.
 */
function isFaroEnabled(): boolean {
  // Explicitly disabled - direct access required for Next.js
  if (process.env.NEXT_PUBLIC_FARO_ENABLED === 'false') return false;

  // Must have collector URL in production
  const collectorUrl = process.env.NEXT_PUBLIC_FARO_URL;
  const env = getEnvironment();

  // Always enabled in development (sends to console only if no URL)
  if (env === 'development') return true;

  // Require URL in production/staging
  return !!collectorUrl;
}

/**
 * Get default sampling rates based on environment.
 */
function getDefaultSampleRates(): { trace: number; session: number } {
  const env = getEnvironment();
  switch (env) {
    case 'production':
      return { trace: 0.1, session: 0.5 }; // 10% traces, 50% sessions
    case 'staging':
      return { trace: 1.0, session: 1.0 }; // 100% in staging
    default:
      return { trace: 1.0, session: 1.0 }; // 100% in development
  }
}

/**
 * Build Faro configuration from environment variables.
 *
 * @returns Faro configuration object
 *
 * @remarks
 * Must use direct process.env access for Next.js static replacement.
 * Dynamic key lookups like process.env[key] won't work.
 *
 * @example
 * ```typescript
 * const config = getFaroConfig();
 * if (config.enabled) {
 *   initializeFaro(config);
 * }
 * ```
 */
export function getFaroConfig(): FaroConfig {
  const defaults = getDefaultSampleRates();

  // Direct process.env access required for Next.js to inline at build time
  return {
    collectorUrl: process.env.NEXT_PUBLIC_FARO_URL,
    appName: process.env.NEXT_PUBLIC_APP_NAME ?? 'chive-web',
    appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0',
    environment: getEnvironment(),
    traceSampleRate: parseFloatBounded(
      process.env.NEXT_PUBLIC_FARO_TRACE_SAMPLE_RATE,
      defaults.trace
    ),
    sessionSampleRate: parseFloatBounded(
      process.env.NEXT_PUBLIC_FARO_SESSION_SAMPLE_RATE,
      defaults.session
    ),
    enabled: isFaroEnabled(),
    instrumentConsole: process.env.NEXT_PUBLIC_FARO_INSTRUMENT_CONSOLE !== 'false',
    instrumentPerformance: process.env.NEXT_PUBLIC_FARO_INSTRUMENT_PERFORMANCE !== 'false',
    instrumentErrors: process.env.NEXT_PUBLIC_FARO_INSTRUMENT_ERRORS !== 'false',
  };
}

/**
 * Validate Faro configuration.
 *
 * @param config - Configuration to validate
 * @returns Array of validation errors (empty if valid)
 */
export function validateFaroConfig(config: FaroConfig): string[] {
  const errors: string[] = [];

  if (config.enabled && config.environment === 'production' && !config.collectorUrl) {
    errors.push('NEXT_PUBLIC_FARO_URL is required in production');
  }

  if (config.traceSampleRate < 0 || config.traceSampleRate > 1) {
    errors.push('traceSampleRate must be between 0 and 1');
  }

  if (config.sessionSampleRate < 0 || config.sessionSampleRate > 1) {
    errors.push('sessionSampleRate must be between 0 and 1');
  }

  return errors;
}
