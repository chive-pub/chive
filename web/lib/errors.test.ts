/**
 * Tests for Chive frontend error classes.
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest';

import {
  ChiveError,
  APIError,
  NotFoundError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  RateLimitError,
  NetworkError,
} from './errors';

describe('ChiveError', () => {
  // ChiveError is abstract, so we test through concrete implementations
  describe('base functionality via APIError', () => {
    it('has name property set to class name', () => {
      const error = new APIError('test message');
      expect(error.name).toBe('APIError');
    });

    it('has code property', () => {
      const error = new APIError('test message');
      expect(error.code).toBe('API_ERROR');
    });

    it('has message property', () => {
      const error = new APIError('test message');
      expect(error.message).toBe('test message');
    });

    it('has stack trace', () => {
      const error = new APIError('test message');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('APIError');
    });

    it('supports error cause chaining', () => {
      const cause = new Error('original error');
      const error = new APIError('wrapped error', undefined, undefined, cause);
      expect(error.cause).toBe(cause);
    });

    it('is instanceof Error', () => {
      const error = new APIError('test');
      expect(error).toBeInstanceOf(Error);
    });
  });
});

describe('APIError', () => {
  it('has API_ERROR code', () => {
    const error = new APIError('API failed');
    expect(error.code).toBe('API_ERROR');
  });

  it('stores statusCode', () => {
    const error = new APIError('API failed', 404);
    expect(error.statusCode).toBe(404);
  });

  it('stores endpoint', () => {
    const error = new APIError('API failed', 404, '/api/eprints');
    expect(error.endpoint).toBe('/api/eprints');
  });

  describe('severity', () => {
    it('returns high for 5xx status codes', () => {
      expect(new APIError('error', 500).severity).toBe('high');
      expect(new APIError('error', 502).severity).toBe('high');
      expect(new APIError('error', 503).severity).toBe('high');
    });

    it('returns medium for 4xx status codes', () => {
      expect(new APIError('error', 400).severity).toBe('medium');
      expect(new APIError('error', 404).severity).toBe('medium');
      expect(new APIError('error', 403).severity).toBe('medium');
    });

    it('returns medium when no status code', () => {
      expect(new APIError('error').severity).toBe('medium');
    });
  });

  describe('isRetryable', () => {
    it('returns true for 5xx errors', () => {
      expect(new APIError('error', 500).isRetryable).toBe(true);
      expect(new APIError('error', 502).isRetryable).toBe(true);
      expect(new APIError('error', 503).isRetryable).toBe(true);
    });

    it('returns true for 408 (timeout)', () => {
      expect(new APIError('error', 408).isRetryable).toBe(true);
    });

    it('returns true for 429 (rate limit)', () => {
      expect(new APIError('error', 429).isRetryable).toBe(true);
    });

    it('returns false for other 4xx errors', () => {
      expect(new APIError('error', 400).isRetryable).toBe(false);
      expect(new APIError('error', 401).isRetryable).toBe(false);
      expect(new APIError('error', 403).isRetryable).toBe(false);
      expect(new APIError('error', 404).isRetryable).toBe(false);
    });

    it('returns true when no status code', () => {
      expect(new APIError('error').isRetryable).toBe(true);
    });
  });

  describe('toJSON', () => {
    it('includes all properties', () => {
      const error = new APIError('API failed', 404, '/api/eprints');
      const json = error.toJSON();

      expect(json.name).toBe('APIError');
      expect(json.code).toBe('API_ERROR');
      expect(json.message).toBe('API failed');
      expect(json.severity).toBe('medium');
      expect(json.isRetryable).toBe(false);
      expect(json.statusCode).toBe(404);
      expect(json.endpoint).toBe('/api/eprints');
      expect(json.stack).toBeDefined();
    });

    it('includes cause if present', () => {
      const cause = new Error('original error');
      const error = new APIError('wrapped', 500, undefined, cause);
      const json = error.toJSON();

      expect(json.cause).toBeDefined();
      expect(json.cause?.message).toBe('original error');
      expect(json.cause?.code).toBe('UNKNOWN');
    });

    it('includes ChiveError cause with full details', () => {
      const cause = new NotFoundError('Eprint', 'at://did:plc:abc/test');
      const error = new APIError('Not found', 404, undefined, cause);
      const json = error.toJSON();

      expect(json.cause).toBeDefined();
      expect(json.cause?.code).toBe('NOT_FOUND');
      expect(json.cause?.name).toBe('NotFoundError');
    });
  });
});

describe('NotFoundError', () => {
  it('has NOT_FOUND code', () => {
    const error = new NotFoundError('Eprint', 'at://did:plc:abc/test');
    expect(error.code).toBe('NOT_FOUND');
  });

  it('stores resourceType', () => {
    const error = new NotFoundError('Eprint', 'at://did:plc:abc/test');
    expect(error.resourceType).toBe('Eprint');
  });

  it('stores resourceId', () => {
    const error = new NotFoundError('Eprint', 'at://did:plc:abc/test');
    expect(error.resourceId).toBe('at://did:plc:abc/test');
  });

  it('generates descriptive message', () => {
    const error = new NotFoundError('Author', 'did:plc:xyz');
    expect(error.message).toBe('Author not found: did:plc:xyz');
  });

  it('has medium severity by default', () => {
    const error = new NotFoundError('Eprint', 'test');
    expect(error.severity).toBe('medium');
  });

  it('is not retryable by default', () => {
    const error = new NotFoundError('Eprint', 'test');
    expect(error.isRetryable).toBe(false);
  });
});

describe('ValidationError', () => {
  it('has VALIDATION_ERROR code', () => {
    const error = new ValidationError('Invalid input');
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('stores field', () => {
    const error = new ValidationError('Title is required', 'title');
    expect(error.field).toBe('title');
  });

  it('stores constraint', () => {
    const error = new ValidationError('Title is required', 'title', 'required');
    expect(error.constraint).toBe('required');
  });

  it('supports error cause', () => {
    const cause = new Error('parse error');
    const error = new ValidationError('Invalid JSON', undefined, undefined, cause);
    expect(error.cause).toBe(cause);
  });

  it('has medium severity by default', () => {
    const error = new ValidationError('Invalid');
    expect(error.severity).toBe('medium');
  });

  it('is not retryable by default', () => {
    const error = new ValidationError('Invalid');
    expect(error.isRetryable).toBe(false);
  });
});

describe('AuthenticationError', () => {
  it('has AUTHENTICATION_ERROR code', () => {
    const error = new AuthenticationError('Invalid credentials');
    expect(error.code).toBe('AUTHENTICATION_ERROR');
  });

  it('has medium severity by default', () => {
    const error = new AuthenticationError('Session expired');
    expect(error.severity).toBe('medium');
  });

  it('is not retryable by default', () => {
    const error = new AuthenticationError('Invalid token');
    expect(error.isRetryable).toBe(false);
  });
});

describe('AuthorizationError', () => {
  it('has AUTHORIZATION_ERROR code', () => {
    const error = new AuthorizationError('Access denied');
    expect(error.code).toBe('AUTHORIZATION_ERROR');
  });

  it('stores requiredScope', () => {
    const error = new AuthorizationError('Access denied', 'write:eprints');
    expect(error.requiredScope).toBe('write:eprints');
  });

  it('has medium severity by default', () => {
    const error = new AuthorizationError('Access denied');
    expect(error.severity).toBe('medium');
  });

  it('is not retryable by default', () => {
    const error = new AuthorizationError('Access denied');
    expect(error.isRetryable).toBe(false);
  });
});

describe('RateLimitError', () => {
  it('has RATE_LIMIT_EXCEEDED code', () => {
    const error = new RateLimitError(60);
    expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('stores retryAfter', () => {
    const error = new RateLimitError(120);
    expect(error.retryAfter).toBe(120);
  });

  it('generates descriptive message', () => {
    const error = new RateLimitError(60);
    expect(error.message).toBe('Rate limit exceeded. Retry after 60 seconds.');
  });

  it('has low severity', () => {
    const error = new RateLimitError(60);
    expect(error.severity).toBe('low');
  });

  it('is retryable', () => {
    const error = new RateLimitError(60);
    expect(error.isRetryable).toBe(true);
  });

  describe('toJSON', () => {
    it('includes retryAfter', () => {
      const error = new RateLimitError(120);
      const json = error.toJSON();

      expect(json.retryAfter).toBe(120);
      expect(json.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(json.severity).toBe('low');
      expect(json.isRetryable).toBe(true);
    });
  });
});

describe('NetworkError', () => {
  it('has NETWORK_ERROR code', () => {
    const error = new NetworkError('Connection failed');
    expect(error.code).toBe('NETWORK_ERROR');
  });

  it('supports error cause', () => {
    const cause = new TypeError('Failed to fetch');
    const error = new NetworkError('Network request failed', cause);
    expect(error.cause).toBe(cause);
  });

  it('has high severity', () => {
    const error = new NetworkError('Connection failed');
    expect(error.severity).toBe('high');
  });

  it('is retryable', () => {
    const error = new NetworkError('Connection failed');
    expect(error.isRetryable).toBe(true);
  });
});

describe('Error inheritance', () => {
  it('all errors extend ChiveError', () => {
    expect(new APIError('test')).toBeInstanceOf(ChiveError);
    expect(new NotFoundError('type', 'id')).toBeInstanceOf(ChiveError);
    expect(new ValidationError('test')).toBeInstanceOf(ChiveError);
    expect(new AuthenticationError('test')).toBeInstanceOf(ChiveError);
    expect(new AuthorizationError('test')).toBeInstanceOf(ChiveError);
    expect(new RateLimitError(60)).toBeInstanceOf(ChiveError);
    expect(new NetworkError('test')).toBeInstanceOf(ChiveError);
  });

  it('all errors extend Error', () => {
    expect(new APIError('test')).toBeInstanceOf(Error);
    expect(new NotFoundError('type', 'id')).toBeInstanceOf(Error);
    expect(new ValidationError('test')).toBeInstanceOf(Error);
    expect(new AuthenticationError('test')).toBeInstanceOf(Error);
    expect(new AuthorizationError('test')).toBeInstanceOf(Error);
    expect(new RateLimitError(60)).toBeInstanceOf(Error);
    expect(new NetworkError('test')).toBeInstanceOf(Error);
  });
});

describe('toJSON serialization', () => {
  it('produces JSON-serializable output', () => {
    const error = new APIError('Test error', 500, '/api/test');
    const json = error.toJSON();

    // Should not throw when stringified
    const str = JSON.stringify(json);
    expect(str).toBeDefined();

    // Should be parseable
    const parsed = JSON.parse(str);
    expect(parsed.code).toBe('API_ERROR');
    expect(parsed.message).toBe('Test error');
  });

  it('handles nested cause chain', () => {
    const rootCause = new NetworkError('Connection reset');
    const midCause = new APIError('Request failed', 500, undefined, rootCause);
    const error = new APIError('Operation failed', 503, '/api/op', midCause);

    const json = error.toJSON();
    expect(json.cause?.code).toBe('API_ERROR');
    expect(json.cause?.cause?.code).toBe('NETWORK_ERROR');
  });
});
