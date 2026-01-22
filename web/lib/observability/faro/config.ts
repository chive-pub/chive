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
 * Get environment variable with optional default.
 */
function getEnv(key: string, defaultValue?: string): string | undefined {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] ?? defaultValue;
  }
  return defaultValue;
}

/**
 * Parse float from environment variable with default.
 */
function getEnvFloat(key: string, defaultValue: number): number {
  const value = getEnv(key);
  if (value === undefined) return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : Math.min(1, Math.max(0, parsed));
}

/**
 * Determine the current environment.
 */
function getEnvironment(): string {
  return getEnv('NEXT_PUBLIC_ENVIRONMENT') ?? getEnv('NODE_ENV') ?? 'development';
}

/**
 * Determine if Faro should be enabled.
 */
function isFaroEnabled(): boolean {
  // Explicitly disabled
  if (getEnv('NEXT_PUBLIC_FARO_ENABLED') === 'false') return false;

  // Must have collector URL in production
  const collectorUrl = getEnv('NEXT_PUBLIC_FARO_URL');
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

  return {
    collectorUrl: getEnv('NEXT_PUBLIC_FARO_URL'),
    appName: getEnv('NEXT_PUBLIC_APP_NAME', 'chive-web') ?? 'chive-web',
    appVersion: getEnv('NEXT_PUBLIC_APP_VERSION', '0.0.0') ?? '0.0.0',
    environment: getEnvironment(),
    traceSampleRate: getEnvFloat('NEXT_PUBLIC_FARO_TRACE_SAMPLE_RATE', defaults.trace),
    sessionSampleRate: getEnvFloat('NEXT_PUBLIC_FARO_SESSION_SAMPLE_RATE', defaults.session),
    enabled: isFaroEnabled(),
    instrumentConsole: getEnv('NEXT_PUBLIC_FARO_INSTRUMENT_CONSOLE', 'true') === 'true',
    instrumentPerformance: getEnv('NEXT_PUBLIC_FARO_INSTRUMENT_PERFORMANCE', 'true') === 'true',
    instrumentErrors: getEnv('NEXT_PUBLIC_FARO_INSTRUMENT_ERRORS', 'true') === 'true',
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
