/**
 * Result monad for explicit error handling without exceptions.
 *
 * @remarks
 * The Result type provides a functional programming pattern for handling
 * fallible operations. Instead of throwing exceptions, functions return
 * Result<T, E>, forcing callers to explicitly handle both success and
 * error cases.
 *
 * This approach provides compile-time guarantees that errors are handled,
 * prevents silent exception swallowing, enables easier error composition
 * and transformation, and offers better performance by avoiding stack
 * unwinding.
 *
 * Use Result for operations that can fail in expected ways. Continue
 * using exceptions for truly exceptional, unrecoverable errors.
 *
 * **Why custom implementation instead of libraries?**
 *
 * While libraries like `neverthrow`, `ts-results`, and `oxide.ts` exist,
 * a custom implementation avoids runtime dependencies (reducing bundle size
 * and security surface), provides precise control over API surface and
 * behavior, guarantees compatibility with Chive's strict TypeScript
 * configuration, eliminates breaking changes from upstream library updates,
 * and simplifies debugging by avoiding external code.
 *
 * The Result monad is a simple pattern (~200 LOC) that doesn't require
 * the maintenance overhead of external dependencies.
 *
 * @packageDocumentation
 * @public
 */

/**
 * Result monad representing either success (Ok) or failure (Err).
 *
 * @typeParam T - Success value type
 * @typeParam E - Error type (must extend Error)
 *
 * @remarks
 * Result is a discriminated union with two variants:
 * - `{ ok: true, value: T }` - Success case
 * - `{ ok: false, error: E }` - Error case
 *
 * Use type guards (isOk, isErr) or pattern matching (if/switch on ok field)
 * to safely access the value or error.
 *
 * @example
 * ```typescript
 * function divide(a: number, b: number): Result<number, Error> {
 *   if (b === 0) {
 *     return Err(new Error('Division by zero'));
 *   }
 *   return Ok(a / b);
 * }
 *
 * const result = divide(10, 2);
 * if (result.ok) {
 *   console.log('Result:', result.value); // 5
 * } else {
 *   console.error('Error:', result.error.message);
 * }
 * ```
 *
 * @public
 */
export type Result<T, E extends Error = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

/**
 * Creates a successful Result.
 *
 * @typeParam T - Success value type
 * @param value - Success value
 * @returns Success Result containing the value
 *
 * @example
 * ```typescript
 * const result = Ok(42);
 * console.log(result.ok); // true
 * console.log(result.value); // 42
 * ```
 *
 * @public
 */
export function Ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/**
 * Creates an error Result.
 *
 * @typeParam E - Error type (must extend Error)
 * @param error - Error object
 * @returns Error Result containing the error
 *
 * @example
 * ```typescript
 * const result = Err(new Error('Something went wrong'));
 * console.log(result.ok); // false
 * console.log(result.error.message); // 'Something went wrong'
 * ```
 *
 * @public
 */
export function Err<E extends Error>(error: E): Result<never, E> {
  return { ok: false, error };
}

/**
 * Type guard for success Results.
 *
 * @typeParam T - Success value type
 * @typeParam E - Error type
 * @param result - Result to check
 * @returns True if Result is Ok, false if Err
 *
 * @remarks
 * This type guard narrows the Result type, allowing safe access to the
 * value field in TypeScript.
 *
 * @example
 * ```typescript
 * const result = divide(10, 2);
 * if (isOk(result)) {
 *   // TypeScript knows result.value exists
 *   console.log(result.value);
 * }
 * ```
 *
 * @public
 */
export function isOk<T, E extends Error>(result: Result<T, E>): result is { ok: true; value: T } {
  return result.ok;
}

/**
 * Type guard for error Results.
 *
 * @typeParam T - Success value type
 * @typeParam E - Error type
 * @param result - Result to check
 * @returns True if Result is Err, false if Ok
 *
 * @remarks
 * This type guard narrows the Result type, allowing safe access to the
 * error field in TypeScript.
 *
 * @example
 * ```typescript
 * const result = divide(10, 0);
 * if (isErr(result)) {
 *   // TypeScript knows result.error exists
 *   console.error(result.error.message);
 * }
 * ```
 *
 * @public
 */
export function isErr<T, E extends Error>(result: Result<T, E>): result is { ok: false; error: E } {
  return !result.ok;
}

/**
 * Unwraps a Result, returning the value or throwing the error.
 *
 * @typeParam T - Success value type
 * @typeParam E - Error type
 * @param result - Result to unwrap
 * @returns The success value
 * @throws The error if Result is Err
 *
 * @remarks
 * Use this function when you're confident the Result will be Ok, or when
 * you want to propagate errors via exceptions.
 *
 * Prefer pattern matching with isOk/isErr for safer error handling.
 *
 * @example
 * ```typescript
 * const result = Ok(42);
 * const value = unwrap(result); // 42
 *
 * const errorResult = Err(new Error('Failed'));
 * const value2 = unwrap(errorResult); // Throws Error('Failed')
 * ```
 *
 * @public
 */
export function unwrap<T, E extends Error>(result: Result<T, E>): T {
  if (result.ok) {
    return result.value;
  }
  throw result.error;
}

/**
 * Unwraps a Result, returning the value or a default.
 *
 * @typeParam T - Success value type
 * @typeParam E - Error type
 * @param result - Result to unwrap
 * @param defaultValue - Default value to return if Result is Err
 * @returns The success value or the default value
 *
 * @remarks
 * Use this function when you want to provide a fallback value for errors
 * without exception handling.
 *
 * @example
 * ```typescript
 * const result = Err(new Error('Failed'));
 * const value = unwrapOr(result, 42); // 42
 *
 * const okResult = Ok(10);
 * const value2 = unwrapOr(okResult, 42); // 10
 * ```
 *
 * @public
 */
export function unwrapOr<T, E extends Error>(result: Result<T, E>, defaultValue: T): T {
  return result.ok ? result.value : defaultValue;
}

/**
 * Maps a function over the success value of a Result.
 *
 * @typeParam T - Original success value type
 * @typeParam U - Transformed success value type
 * @typeParam E - Error type
 * @param result - Result to map over
 * @param fn - Transformation function
 * @returns New Result with transformed value, or original error
 *
 * @remarks
 * If the Result is Ok, applies the function to the value and wraps the
 * result in Ok. If the Result is Err, returns the error unchanged.
 *
 * @example
 * ```typescript
 * const result = Ok(5);
 * const doubled = map(result, (x) => x * 2);
 * // Ok(10)
 *
 * const errorResult = Err(new Error('Failed'));
 * const mapped = map(errorResult, (x) => x * 2);
 * // Err(Error('Failed'))
 * ```
 *
 * @public
 */
export function map<T, U, E extends Error>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  if (result.ok) {
    return Ok(fn(result.value));
  }
  return result;
}

/**
 * Maps a function over the error of a Result.
 *
 * @typeParam T - Success value type
 * @typeParam E1 - Original error type
 * @typeParam E2 - Transformed error type
 * @param result - Result to map over
 * @param fn - Error transformation function
 * @returns New Result with transformed error, or original value
 *
 * @remarks
 * If the Result is Err, applies the function to the error and wraps the
 * result in Err. If the Result is Ok, returns the value unchanged.
 *
 * Useful for wrapping errors in more specific error types or adding context.
 *
 * @example
 * ```typescript
 * const result = Err(new Error('Failed'));
 * const wrapped = mapErr(result, (err) => new ValidationError(err.message));
 * // Err(ValidationError('Failed'))
 * ```
 *
 * @public
 */
export function mapErr<T, E1 extends Error, E2 extends Error>(
  result: Result<T, E1>,
  fn: (error: E1) => E2
): Result<T, E2> {
  if (!result.ok) {
    return Err(fn(result.error));
  }
  return result;
}

/**
 * Chains a function that returns a Result over a Result (flatMap).
 *
 * @typeParam T - Original success value type
 * @typeParam U - New success value type
 * @typeParam E - Error type
 * @param result - Result to chain over
 * @param fn - Function returning a new Result
 * @returns Flattened Result
 *
 * @remarks
 * If the Result is Ok, applies the function to the value. If the Result is
 * Err, returns the error unchanged.
 *
 * Use this to chain multiple fallible operations without nesting Results.
 *
 * @example
 * ```typescript
 * function divide(a: number, b: number): Result<number, Error> {
 *   return b === 0 ? Err(new Error('Division by zero')) : Ok(a / b);
 * }
 *
 * const result = Ok(10);
 * const chained = andThen(result, (x) => divide(x, 2));
 * // Ok(5)
 * ```
 *
 * @public
 */
export function andThen<T, U, E extends Error>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  if (result.ok) {
    return fn(result.value);
  }
  return result;
}
