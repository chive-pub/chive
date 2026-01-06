/**
 * Unit tests for ErrorClassifier.
 *
 * @remarks
 * Tests error classification logic for transient, permanent, and rate limit errors.
 */

import { describe, it, expect } from 'vitest';

import { ErrorClassifier, ErrorType } from '@/services/indexing/error-classifier.js';

// Mock error types for testing
interface NodeError extends Error {
  code?: string;
}

interface HttpError {
  message?: string;
  response?: {
    status: number;
  };
}

interface GenericError {
  message?: string;
  code?: string;
  [key: string]: unknown;
}

describe('ErrorClassifier', () => {
  const classifier = new ErrorClassifier();

  describe('network errors', () => {
    it('classifies ECONNREFUSED as transient', () => {
      const error: NodeError = new Error('connect ECONNREFUSED');
      error.code = 'ECONNREFUSED';

      expect(classifier.classify(error)).toBe(ErrorType.TRANSIENT);
    });

    it('classifies ETIMEDOUT as transient', () => {
      const error: NodeError = new Error('request timeout');
      error.code = 'ETIMEDOUT';

      expect(classifier.classify(error)).toBe(ErrorType.TRANSIENT);
    });

    it('classifies ENOTFOUND as transient', () => {
      const error: NodeError = new Error('getaddrinfo ENOTFOUND');
      error.code = 'ENOTFOUND';

      expect(classifier.classify(error)).toBe(ErrorType.TRANSIENT);
    });

    it('classifies ECONNRESET as transient', () => {
      const error: NodeError = new Error('socket hang up');
      error.code = 'ECONNRESET';

      expect(classifier.classify(error)).toBe(ErrorType.TRANSIENT);
    });

    it('classifies EPIPE as transient', () => {
      const error: NodeError = new Error('write EPIPE');
      error.code = 'EPIPE';

      expect(classifier.classify(error)).toBe(ErrorType.TRANSIENT);
    });

    it('classifies EAI_AGAIN as transient', () => {
      const error: NodeError = new Error('getaddrinfo EAI_AGAIN');
      error.code = 'EAI_AGAIN';

      expect(classifier.classify(error)).toBe(ErrorType.TRANSIENT);
    });
  });

  describe('HTTP status codes', () => {
    it('classifies 429 as rate limit', () => {
      const error: HttpError = {
        response: {
          status: 429,
        },
      };

      expect(classifier.classify(error)).toBe(ErrorType.RATE_LIMIT);
    });

    it('classifies 503 as transient', () => {
      const error: HttpError = {
        response: {
          status: 503,
        },
      };

      expect(classifier.classify(error)).toBe(ErrorType.TRANSIENT);
    });

    it('classifies 500 as transient', () => {
      const error: HttpError = {
        response: {
          status: 500,
        },
      };

      expect(classifier.classify(error)).toBe(ErrorType.TRANSIENT);
    });

    it('classifies 502 as transient', () => {
      const error: HttpError = {
        response: {
          status: 502,
        },
      };

      expect(classifier.classify(error)).toBe(ErrorType.TRANSIENT);
    });

    it('classifies 504 as transient', () => {
      const error: HttpError = {
        response: {
          status: 504,
        },
      };

      expect(classifier.classify(error)).toBe(ErrorType.TRANSIENT);
    });

    it('classifies 400 as permanent', () => {
      const error: HttpError = {
        response: {
          status: 400,
        },
      };

      expect(classifier.classify(error)).toBe(ErrorType.PERMANENT);
    });

    it('classifies 404 as permanent', () => {
      const error: HttpError = {
        response: {
          status: 404,
        },
      };

      expect(classifier.classify(error)).toBe(ErrorType.PERMANENT);
    });

    it('classifies 422 as permanent', () => {
      const error: HttpError = {
        response: {
          status: 422,
        },
      };

      expect(classifier.classify(error)).toBe(ErrorType.PERMANENT);
    });
  });

  describe('validation errors', () => {
    it('classifies ValidationError by name as permanent', () => {
      const error = new Error('Validation failed');
      error.name = 'ValidationError';

      expect(classifier.classify(error)).toBe(ErrorType.PERMANENT);
    });

    it('classifies validation errors by message as permanent', () => {
      const error = new Error('validation failed for field X');

      expect(classifier.classify(error)).toBe(ErrorType.PERMANENT);
    });

    it('classifies schema errors as permanent', () => {
      const error = new Error('Schema validation error');

      expect(classifier.classify(error)).toBe(ErrorType.PERMANENT);
    });

    it('classifies invalid errors as permanent', () => {
      const error = new Error('Invalid input provided');

      expect(classifier.classify(error)).toBe(ErrorType.PERMANENT);
    });
  });

  describe('parse errors', () => {
    it('classifies parse errors as permanent', () => {
      const error = new Error('Failed to parse JSON');

      expect(classifier.classify(error)).toBe(ErrorType.PERMANENT);
    });

    it('classifies JSON errors as permanent', () => {
      const error = new Error('Unexpected token in JSON');

      expect(classifier.classify(error)).toBe(ErrorType.PERMANENT);
    });

    it('classifies CBOR errors as permanent', () => {
      const error = new Error('CBOR decode error');

      expect(classifier.classify(error)).toBe(ErrorType.PERMANENT);
    });

    it('classifies decode errors as permanent', () => {
      const error = new Error('Failed to decode data');

      expect(classifier.classify(error)).toBe(ErrorType.PERMANENT);
    });

    it('classifies malformed errors as permanent', () => {
      const error = new Error('Malformed request body');

      expect(classifier.classify(error)).toBe(ErrorType.PERMANENT);
    });
  });

  describe('default behavior', () => {
    it('defaults to transient for unknown error types', () => {
      const error = new Error('Something went wrong');

      expect(classifier.classify(error)).toBe(ErrorType.TRANSIENT);
    });

    it('defaults to transient for errors without code or status', () => {
      const error: GenericError = {
        message: 'Generic error',
      };

      expect(classifier.classify(error)).toBe(ErrorType.TRANSIENT);
    });

    it('handles null error', () => {
      expect(classifier.classify(null)).toBe(ErrorType.TRANSIENT);
    });

    it('handles undefined error', () => {
      expect(classifier.classify(undefined)).toBe(ErrorType.TRANSIENT);
    });

    it('handles error without message', () => {
      const error: GenericError = {
        code: 'UNKNOWN',
      };

      expect(classifier.classify(error)).toBe(ErrorType.TRANSIENT);
    });
  });

  describe('case insensitivity', () => {
    it('handles uppercase validation error messages', () => {
      const error = new Error('VALIDATION FAILED');

      expect(classifier.classify(error)).toBe(ErrorType.PERMANENT);
    });

    it('handles mixed case schema error messages', () => {
      const error = new Error('Schema Validation Error');

      expect(classifier.classify(error)).toBe(ErrorType.PERMANENT);
    });

    it('handles mixed case parse error messages', () => {
      const error = new Error('Failed to Parse JSON');

      expect(classifier.classify(error)).toBe(ErrorType.PERMANENT);
    });
  });

  describe('edge cases', () => {
    it('prioritizes HTTP status over message content', () => {
      // Error has validation in message but 503 status
      const error: HttpError = {
        message: 'validation failed',
        response: {
          status: 503,
        },
      };

      // Should classify as transient (503) not permanent (validation message)
      expect(classifier.classify(error)).toBe(ErrorType.TRANSIENT);
    });

    it('prioritizes network code over message content', () => {
      // Error has validation in message but network code
      const error: NodeError = new Error('validation failed');
      error.code = 'ECONNREFUSED';

      // Should classify as transient (network) not permanent (validation message)
      expect(classifier.classify(error)).toBe(ErrorType.TRANSIENT);
    });

    it('handles errors with multiple indicators', () => {
      // Error has both network code and HTTP status
      const error: NodeError & HttpError = Object.assign(new Error('request failed'), {
        code: 'ETIMEDOUT',
        response: { status: 500 },
      });

      // Network code checked first
      expect(classifier.classify(error)).toBe(ErrorType.TRANSIENT);
    });
  });
});
