/**
 * Resilience patterns using cockatiel circuit breaker and retry.
 *
 * @remarks
 * Thin wrappers around industry-standard cockatiel library (inspired by Polly .NET).
 * Integrates with Chive's error classification system and logging infrastructure.
 *
 * @packageDocumentation
 * @public
 */

import {
  ConsecutiveBreaker,
  ExponentialBackoff,
  type IPolicy,
  circuitBreaker,
  handleAll,
  retry,
  wrap,
} from 'cockatiel';

import type { ILogger } from '../../types/interfaces/logger.interface.js';

/**
 * Circuit breaker configuration.
 *
 * @public
 */
export interface CircuitBreakerConfig {
  /**
   * Circuit name for logging and metrics.
   */
  readonly name: string;

  /**
   * Consecutive failures before opening circuit.
   *
   * @remarks
   * Default: 5
   * Industry standard: 3-10 failures
   */
  readonly failureThreshold?: number;

  /**
   * Milliseconds to wait before attempting recovery (HALF_OPEN).
   *
   * @remarks
   * Default: 60000ms (60 seconds)
   * Industry standard: 30-120 seconds
   */
  readonly timeout?: number;

  /**
   * Logger for circuit state transitions.
   */
  readonly logger?: ILogger;
}

/**
 * Retry strategy configuration.
 *
 * @public
 */
export interface RetryConfig {
  /**
   * Operation name for logging.
   */
  readonly name: string;

  /**
   * Maximum retry attempts.
   *
   * @remarks
   * Default: 3
   * Industry standard: 3-5 retries for network failures
   */
  readonly maxAttempts?: number;

  /**
   * Base delay between retries in milliseconds.
   *
   * @remarks
   * Default: 100ms
   * Industry standard: 50-200ms base delay
   */
  readonly baseDelay?: number;

  /**
   * Maximum delay between retries in milliseconds.
   *
   * @remarks
   * Default: 10000ms (10 seconds)
   * Prevents excessive wait times for rate-limited requests
   */
  readonly maxDelay?: number;

  /**
   * Logger for retry events.
   */
  readonly logger?: ILogger;
}

/**
 * Combined resilience configuration.
 *
 * @public
 */
export interface ResilienceConfig {
  /**
   * Circuit breaker configuration.
   */
  readonly circuitBreaker: CircuitBreakerConfig;

  /**
   * Retry configuration.
   */
  readonly retry: RetryConfig;
}

/**
 * Creates a circuit breaker using cockatiel.
 *
 * @param config - Circuit breaker configuration
 * @returns Cockatiel circuit breaker policy
 *
 * @remarks
 * Uses ConsecutiveBreaker strategy: opens after N consecutive failures,
 * not based on failure rate within time window.
 *
 * @example
 * ```typescript
 * const breaker = createCircuitBreaker({
 *   name: 'pds-fetch',
 *   failureThreshold: 5,
 *   timeout: 60000,
 *   logger
 * });
 *
 * const result = await breaker.execute(async () => {
 *   const response = await fetch(pdsUrl);
 *   if (!response.ok) throw new Error(`HTTP ${response.status}`);
 *   return response.json();
 * });
 * ```
 *
 * @public
 */
export function createCircuitBreaker(config: CircuitBreakerConfig): IPolicy {
  const threshold = config.failureThreshold ?? 5;
  const halfOpenAfter = config.timeout ?? 60000;

  const policy = circuitBreaker(handleAll, {
    halfOpenAfter,
    breaker: new ConsecutiveBreaker(threshold),
  });

  // Log state transitions
  if (config.logger) {
    const logger = config.logger;
    const circuitName = config.name;

    policy.onBreak(() => {
      logger.warn('Circuit breaker opened', { circuit: circuitName });
    });

    policy.onReset(() => {
      logger.info('Circuit breaker closed', { circuit: circuitName });
    });

    policy.onHalfOpen(() => {
      logger.info('Circuit breaker half-open', { circuit: circuitName });
    });
  }

  return policy;
}

/**
 * Creates a retry policy using cockatiel.
 *
 * @param config - Retry configuration
 * @returns Cockatiel retry policy
 *
 * @remarks
 * Uses exponential backoff with jitter to prevent thundering herd.
 *
 * @example
 * ```typescript
 * const retryPolicy = createRetryPolicy({
 *   name: 'fetch-preprint',
 *   maxAttempts: 3,
 *   baseDelay: 100,
 *   logger
 * });
 *
 * const result = await retryPolicy.execute(async () => {
 *   return await repository.getRecord(uri);
 * });
 * ```
 *
 * @public
 */
export function createRetryPolicy(config: RetryConfig): IPolicy {
  const maxAttempts = config.maxAttempts ?? 3;
  const initialDelay = config.baseDelay ?? 100;
  const maxDelay = config.maxDelay ?? 10000;

  const policy = retry(handleAll, {
    maxAttempts,
    backoff: new ExponentialBackoff({
      initialDelay,
      maxDelay,
    }),
  });

  // Log retry events
  if (config.logger) {
    const logger = config.logger;
    const operationName = config.name;

    policy.onRetry((event) => {
      logger.debug('Retrying operation', {
        operation: operationName,
        attempt: event.attempt,
        delay: event.delay,
      });
    });

    policy.onGiveUp((reason) => {
      const error = 'error' in reason ? reason.error : undefined;
      logger.error('All retries exhausted', error, {
        operation: operationName,
      });
    });
  }

  return policy;
}

/**
 * Creates combined circuit breaker and retry policy.
 *
 * @param config - Combined resilience configuration
 * @returns Combined policy (circuit breaker wrapping retry)
 *
 * @remarks
 * Combines circuit breaker and retry in correct order:
 * 1. Circuit breaker (outer): Fast-fail if circuit open
 * 2. Retry (inner): Retry transient failures
 *
 * This prevents retries when circuit is open (would waste resources).
 *
 * @example
 * ```typescript
 * const policy = createResiliencePolicy({
 *   circuitBreaker: {
 *     name: 'pds',
 *     failureThreshold: 5,
 *     timeout: 60000,
 *     logger
 *   },
 *   retry: {
 *     name: 'pds',
 *     maxAttempts: 3,
 *     baseDelay: 100,
 *     logger
 *   }
 * });
 *
 * const result = await policy.execute(async () => {
 *   return await fetch(pdsUrl);
 * });
 * ```
 *
 * @public
 */
export function createResiliencePolicy(config: ResilienceConfig): IPolicy {
  const breakerPolicy = createCircuitBreaker(config.circuitBreaker);
  const retryPolicy = createRetryPolicy(config.retry);

  // Circuit breaker wraps retry: CB → Retry → Operation
  return wrap(breakerPolicy, retryPolicy);
}
