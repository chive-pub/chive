/**
 * Reconnection manager for firehose WebSocket connections.
 *
 * @remarks
 * Implements exponential backoff with jitter to prevent thundering herd
 * when multiple instances reconnect simultaneously.
 *
 * Backoff formula: `delay = min(baseDelay * 2^attempts + jitter, maxDelay)`
 *
 * Jitter helps distribute reconnection attempts across time when multiple
 * consumers restart (e.g., during deployment).
 *
 * @example
 * ```typescript
 * const manager = new ReconnectionManager({
 *   maxAttempts: 10,
 *   baseDelay: 1000,
 *   maxDelay: 30000
 * });
 *
 * while (manager.shouldRetry()) {
 *   const delay = manager.calculateDelay();
 *   await sleep(delay);
 *   manager.recordAttempt();
 *
 *   try {
 *     await connect();
 *     manager.reset(); // Success!
 *     break;
 *   } catch (error) {
 *     // Try again
 *   }
 * }
 * ```
 *
 * @packageDocumentation
 * @internal
 */

/**
 * Configuration options for reconnection manager.
 *
 * @public
 */
export interface ReconnectionOptions {
  /**
   * Maximum number of reconnection attempts.
   *
   * @remarks
   * After this many attempts, the manager stops retrying and
   * `shouldRetry()` returns false.
   *
   * @defaultValue 10
   */
  readonly maxAttempts?: number;

  /**
   * Base delay in milliseconds for first retry.
   *
   * @remarks
   * Each subsequent retry doubles this delay (exponential backoff).
   *
   * @defaultValue 1000
   */
  readonly baseDelay?: number;

  /**
   * Maximum delay cap in milliseconds.
   *
   * @remarks
   * Prevents exponential backoff from growing too large.
   *
   * @defaultValue 30000 (30 seconds)
   */
  readonly maxDelay?: number;

  /**
   * Enable jitter to prevent thundering herd.
   *
   * @remarks
   * Adds random variance (±25%) to delay to distribute reconnection
   * attempts across time.
   *
   * @defaultValue true
   */
  readonly enableJitter?: boolean;
}

/**
 * Manages reconnection attempts with exponential backoff.
 *
 * @remarks
 * Tracks reconnection attempts and calculates appropriate delays using
 * exponential backoff with optional jitter.
 *
 * Thread-safe for single consumer (not designed for concurrent use).
 *
 * @public
 */
export class ReconnectionManager {
  private attempts = 0;
  private readonly maxAttempts: number;
  private readonly baseDelay: number;
  private readonly maxDelay: number;
  private readonly enableJitter: boolean;

  /**
   * Creates a reconnection manager.
   *
   * @param options - Configuration options
   */
  constructor(options: ReconnectionOptions = {}) {
    this.maxAttempts = options.maxAttempts ?? 10;
    this.baseDelay = options.baseDelay ?? 1000;
    this.maxDelay = options.maxDelay ?? 30000;
    this.enableJitter = options.enableJitter ?? true;
  }

  /**
   * Calculates delay for next reconnection attempt.
   *
   * @returns Delay in milliseconds
   *
   * @remarks
   * Uses exponential backoff: `baseDelay * 2^attempts`
   *
   * If jitter enabled, adds random variance (±25%) to prevent
   * synchronized reconnections (thundering herd).
   *
   * Caps delay at `maxDelay` to avoid excessive wait times.
   *
   * @example
   * ```typescript
   * const delay = manager.calculateDelay();
   * console.log(`Retrying in ${delay}ms`);
   * await sleep(delay);
   * ```
   */
  calculateDelay(): number {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s (capped at maxDelay)
    const exponential = this.baseDelay * Math.pow(2, this.attempts);

    let delay = Math.min(exponential, this.maxDelay);

    if (this.enableJitter) {
      // Add ±25% jitter to prevent thundering herd
      const jitterAmount = delay * 0.25;
      const jitter = Math.random() * jitterAmount * 2 - jitterAmount;
      delay = Math.max(0, delay + jitter);
    }

    return Math.floor(delay);
  }

  /**
   * Checks if reconnection should be attempted.
   *
   * @returns `true` if more attempts remaining, `false` if exhausted
   *
   * @example
   * ```typescript
   * if (!manager.shouldRetry()) {
   *   throw new Error('Max reconnection attempts exceeded');
   * }
   * ```
   */
  shouldRetry(): boolean {
    return this.attempts < this.maxAttempts;
  }

  /**
   * Records a reconnection attempt.
   *
   * @remarks
   * Increments internal attempt counter. Call after each failed
   * connection attempt.
   *
   * @example
   * ```typescript
   * try {
   *   await connect();
   * } catch (error) {
   *   manager.recordAttempt();
   * }
   * ```
   */
  recordAttempt(): void {
    this.attempts++;
  }

  /**
   * Resets attempt counter after successful connection.
   *
   * @remarks
   * Call after successful reconnection to reset backoff state.
   *
   * @example
   * ```typescript
   * try {
   *   await connect();
   *   manager.reset(); // Success: reset for next disconnect
   * } catch (error) {
   *   // Continue retrying
   * }
   * ```
   */
  reset(): void {
    this.attempts = 0;
  }

  /**
   * Gets current attempt count.
   *
   * @returns Number of attempts made
   */
  getAttempts(): number {
    return this.attempts;
  }
}
