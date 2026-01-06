/**
 * Unit tests for Result monad.
 *
 * @remarks
 * Tests validate that Result monad functions correctly handle success
 * and error cases, type narrowing works as expected, and helper functions
 * behave according to specifications.
 */

import { describe, expect, it } from 'vitest';

import type { Result } from '@/types/result.js';
import { andThen, Err, isErr, isOk, map, mapErr, Ok, unwrap, unwrapOr } from '@/types/result.js';

describe('Ok', () => {
  it('should create a success Result', () => {
    const result = Ok(42);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(42);
    }
  });

  it('should work with different value types', () => {
    const stringResult = Ok('hello');
    const objectResult = Ok({ key: 'value' });
    const arrayResult = Ok([1, 2, 3]);

    expect(stringResult.ok).toBe(true);
    expect(objectResult.ok).toBe(true);
    expect(arrayResult.ok).toBe(true);
  });
});

describe('Err', () => {
  it('should create an error Result', () => {
    const error = new Error('Something went wrong');
    const result = Err(error);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(error);
    }
  });

  it('should preserve error details', () => {
    const error = new Error('Test error');
    error.stack = 'Test stack trace';
    const result = Err(error);

    if (!result.ok) {
      expect(result.error.message).toBe('Test error');
      expect(result.error.stack).toBe('Test stack trace');
    }
  });
});

describe('isOk', () => {
  it('should return true for Ok Results', () => {
    const result = Ok(42);
    expect(isOk(result)).toBe(true);
  });

  it('should return false for Err Results', () => {
    const result = Err(new Error('Failed'));
    expect(isOk(result)).toBe(false);
  });

  it('should narrow the type correctly', () => {
    const result = Ok(42);
    if (isOk(result)) {
      // TypeScript should allow accessing value
      expect(result.value).toBe(42);
    }
  });
});

describe('isErr', () => {
  it('should return true for Err Results', () => {
    const result = Err(new Error('Failed'));
    expect(isErr(result)).toBe(true);
  });

  it('should return false for Ok Results', () => {
    const result = Ok(42);
    expect(isErr(result)).toBe(false);
  });

  it('should narrow the type correctly', () => {
    const result = Err(new Error('Failed'));
    if (isErr(result)) {
      // TypeScript should allow accessing error
      expect(result.error.message).toBe('Failed');
    }
  });
});

describe('unwrap', () => {
  it('should return value for Ok Results', () => {
    const result = Ok(42);
    expect(unwrap(result)).toBe(42);
  });

  it('should throw error for Err Results', () => {
    const error = new Error('Failed');
    const result = Err(error);

    expect(() => unwrap(result)).toThrow(error);
  });
});

describe('unwrapOr', () => {
  it('should return value for Ok Results', () => {
    const result = Ok(42);
    expect(unwrapOr(result, 0)).toBe(42);
  });

  it('should return default for Err Results', () => {
    const result = Err(new Error('Failed'));
    expect(unwrapOr(result, 0)).toBe(0);
  });

  it('should work with different types', () => {
    const stringResult: Result<string, Error> = Err(new Error('Failed'));
    expect(unwrapOr(stringResult, 'default')).toBe('default');

    const objectResult = Ok({ key: 'value' });
    expect(unwrapOr(objectResult, { key: 'default' })).toEqual({ key: 'value' });
  });
});

describe('map', () => {
  it('should transform Ok value', () => {
    const result = Ok(5);
    const doubled = map(result, (x) => x * 2);

    expect(isOk(doubled)).toBe(true);
    if (isOk(doubled)) {
      expect(doubled.value).toBe(10);
    }
  });

  it('should preserve Err', () => {
    const error = new Error('Failed');
    const result: Result<number, Error> = Err(error);
    const mapped = map(result, (x) => x * 2);

    expect(isErr(mapped)).toBe(true);
    if (isErr(mapped)) {
      expect(mapped.error).toBe(error);
    }
  });

  it('should allow type transformation', () => {
    const result = Ok(5);
    const stringified = map(result, (x) => x.toString());

    expect(isOk(stringified)).toBe(true);
    if (isOk(stringified)) {
      expect(stringified.value).toBe('5');
    }
  });
});

describe('mapErr', () => {
  it('should transform Err', () => {
    const result: Result<never, Error> = Err(new Error('Original error'));
    const mapped = mapErr(result, (err) => new Error(`Wrapped: ${err.message}`));

    expect(isErr(mapped)).toBe(true);
    if (isErr(mapped)) {
      expect(mapped.error.message).toBe('Wrapped: Original error');
    }
  });

  it('should preserve Ok', () => {
    const result: Result<number, Error> = Ok(42);
    const mapped = mapErr(result, (err) => new Error(`Wrapped: ${err.message}`));

    expect(isOk(mapped)).toBe(true);
    if (isOk(mapped)) {
      expect(mapped.value).toBe(42);
    }
  });
});

describe('andThen', () => {
  it('should chain Ok Results', () => {
    const divide = (a: number, b: number): Result<number, Error> =>
      b === 0 ? Err(new Error('Division by zero')) : Ok(a / b);

    const result = Ok(10);
    const chained = andThen(result, (x) => divide(x, 2));

    expect(isOk(chained)).toBe(true);
    if (isOk(chained)) {
      expect(chained.value).toBe(5);
    }
  });

  it('should short-circuit on Err', () => {
    const result: Result<number, Error> = Err(new Error('Failed'));
    const chained = andThen(result, (x) => Ok(x * 2));

    expect(isErr(chained)).toBe(true);
    if (isErr(chained)) {
      expect(chained.error.message).toBe('Failed');
    }
  });

  it('should propagate errors from chained function', () => {
    const divide = (a: number, b: number): Result<number, Error> =>
      b === 0 ? Err(new Error('Division by zero')) : Ok(a / b);

    const result = Ok(10);
    const chained = andThen(result, (x) => divide(x, 0));

    expect(isErr(chained)).toBe(true);
    if (isErr(chained)) {
      expect(chained.error.message).toBe('Division by zero');
    }
  });

  it('should chain multiple operations', () => {
    const divide = (a: number, b: number): Result<number, Error> =>
      b === 0 ? Err(new Error('Division by zero')) : Ok(a / b);

    const result = Ok(20);
    const chained = andThen(
      andThen(result, (x) => divide(x, 2)),
      (x) => divide(x, 2)
    );

    expect(isOk(chained)).toBe(true);
    if (isOk(chained)) {
      expect(chained.value).toBe(5);
    }
  });
});
