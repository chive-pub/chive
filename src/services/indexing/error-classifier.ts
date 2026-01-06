/**
 * Error classification for event processing failures.
 *
 * @remarks
 * Classifies errors to determine appropriate retry strategy:
 * - **Transient**: Network issues, temporary failures (retry with backoff)
 * - **Permanent**: Validation errors, malformed data (send to DLQ, no retry)
 * - **Rate Limit**: 429 responses (retry with longer backoff)
 *
 * Different error types have different retry budgets:
 * - Permanent: 0 retries (immediate DLQ)
 * - Transient: 3 retries with exponential backoff (1s, 2s, 4s)
 * - Rate Limit: 5 retries with longer backoff (10s, 20s, 40s, 80s, 160s)
 *
 * @example
 * ```typescript
 * const classifier = new ErrorClassifier();
 * const errorType = classifier.classify(error);
 *
 * if (errorType === ErrorType.PERMANENT) {
 *   // Don't retry, send to DLQ
 *   await dlq.add(event, error);
 * } else if (errorType === ErrorType.TRANSIENT) {
 *   // Retry with exponential backoff
 *   await retryWithBackoff(operation, 3);
 * } else if (errorType === ErrorType.RATE_LIMIT) {
 *   // Retry with longer backoff
 *   await retryWithBackoff(operation, 5, 10000);
 * }
 * ```
 *
 * @packageDocumentation
 * @public
 */

/**
 * Error classification types.
 *
 * @public
 */
export enum ErrorType {
  /**
   * Transient error (network issues, temporary failures).
   *
   * @remarks
   * These errors should be retried with exponential backoff.
   * Examples: connection refused, timeout, 503 Service Unavailable.
   */
  TRANSIENT = 'transient',

  /**
   * Permanent error (validation failure, malformed data).
   *
   * @remarks
   * These errors should NOT be retried. Send to dead letter queue
   * for manual investigation.
   * Examples: schema validation, 400 Bad Request, parsing errors.
   */
  PERMANENT = 'permanent',

  /**
   * Rate limit error (429 Too Many Requests).
   *
   * @remarks
   * These errors should be retried with longer backoff to respect
   * rate limits.
   */
  RATE_LIMIT = 'rate_limit',
}

/**
 * Classifies errors to determine retry strategy.
 *
 * @remarks
 * Uses heuristics based on error codes, HTTP status, and error types
 * to classify errors.
 *
 * When uncertain, defaults to TRANSIENT (safer to retry than drop).
 *
 * @public
 */
export class ErrorClassifier {
  /**
   * Classifies an error.
   *
   * @param error - Error to classify
   * @returns Error classification
   *
   * @remarks
   * Classification logic:
   * 1. Network errors (ECONNREFUSED, ETIMEDOUT) → TRANSIENT
   * 2. HTTP 429 → RATE_LIMIT
   * 3. HTTP 503 → TRANSIENT
   * 4. HTTP 4xx (except 429) → PERMANENT
   * 5. HTTP 5xx → TRANSIENT
   * 6. ValidationError → PERMANENT
   * 7. Default → TRANSIENT (safer)
   *
   * @example
   * ```typescript
   * const classifier = new ErrorClassifier();
   *
   * // Network error: transient
   * const e1 = new Error('connect ECONNREFUSED');
   * e1.code = 'ECONNREFUSED';
   * classifier.classify(e1); // ErrorType.TRANSIENT
   *
   * // Validation error: permanent
   * const e2 = new ValidationError('Invalid schema');
   * classifier.classify(e2); // ErrorType.PERMANENT
   *
   * // Rate limit: rate_limit
   * const e3 = { response: { status: 429 } };
   * classifier.classify(e3); // ErrorType.RATE_LIMIT
   * ```
   */
  classify(error: unknown): ErrorType {
    // Network errors: transient
    if (this.isNetworkError(error)) {
      return ErrorType.TRANSIENT;
    }

    // HTTP status codes
    if (
      typeof error === 'object' &&
      error !== null &&
      'response' in error &&
      typeof error.response === 'object' &&
      error.response !== null &&
      'status' in error.response &&
      typeof error.response.status === 'number'
    ) {
      const status = error.response.status;

      if (status === 429) {
        return ErrorType.RATE_LIMIT;
      }

      if (status === 503) {
        return ErrorType.TRANSIENT;
      }

      // 4xx client errors (except 429) are permanent
      if (status >= 400 && status < 500) {
        return ErrorType.PERMANENT;
      }

      // 5xx server errors are transient
      if (status >= 500) {
        return ErrorType.TRANSIENT;
      }
    }

    // Validation errors: permanent
    if (this.isValidationError(error)) {
      return ErrorType.PERMANENT;
    }

    // Parse errors: permanent
    if (this.isParseError(error)) {
      return ErrorType.PERMANENT;
    }

    // Default to transient (safer to retry than drop)
    return ErrorType.TRANSIENT;
  }

  /**
   * Checks if error is a network error.
   *
   * @param error - Error to check
   * @returns `true` if network error
   *
   * @internal
   */
  private isNetworkError(error: unknown): boolean {
    const networkCodes = [
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ECONNRESET',
      'EPIPE',
      'EAI_AGAIN',
    ];

    if (typeof error === 'object' && error !== null && 'code' in error) {
      return networkCodes.includes((error as { code: string }).code);
    }

    return false;
  }

  /**
   * Checks if error is a validation error.
   *
   * @param error - Error to check
   * @returns `true` if validation error
   *
   * @internal
   */
  private isValidationError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) {
      return false;
    }

    // Check error name
    if ('name' in error && error.name === 'ValidationError') {
      return true;
    }

    // Check error message
    if ('message' in error && typeof error.message === 'string') {
      const message = error.message.toLowerCase();
      return (
        message.includes('validation') || message.includes('schema') || message.includes('invalid')
      );
    }

    return false;
  }

  /**
   * Checks if error is a parse error.
   *
   * @param error - Error to check
   * @returns `true` if parse error
   *
   * @internal
   */
  private isParseError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) {
      return false;
    }

    if ('message' in error && typeof error.message === 'string') {
      const message = error.message.toLowerCase();
      return (
        message.includes('parse') ||
        message.includes('json') ||
        message.includes('cbor') ||
        message.includes('decode') ||
        message.includes('malformed')
      );
    }

    return false;
  }
}
