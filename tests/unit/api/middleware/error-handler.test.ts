/**
 * Unit tests for error handler middleware.
 *
 * @remarks
 * Tests error mapping from ChiveError types to HTTP responses
 * following Stripe/GitHub error response patterns.
 */

import { Hono } from 'hono';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { errorHandler, createErrorResponse } from '@/api/middleware/error-handler.js';
import type { ChiveEnv } from '@/api/types/context.js';
import {
  ValidationError,
  NotFoundError,
  AuthenticationError,
  AuthorizationError,
  RateLimitError,
  DatabaseError,
  ComplianceError,
} from '@/types/errors.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

const createMockLogger = (): ILogger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
});

describe('Error Handler Middleware', () => {
  let app: Hono<ChiveEnv>;
  let mockLogger: ILogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    app = new Hono<ChiveEnv>();

    // Set up context with logger and request ID
    app.use('*', async (c, next) => {
      c.set('logger', mockLogger);
      c.set('requestId', 'req_test123');
      await next();
    });

    // Add error handler
    app.onError(errorHandler);
  });

  describe('errorHandler', () => {
    it('returns 400 for ValidationError', async () => {
      app.get('/test', () => {
        throw new ValidationError('Invalid email format', 'email');
      });

      const res = await app.request('/test');

      expect(res.status).toBe(400);
      const body = (await res.json()) as {
        error: { code: string; message: string; field?: string; requestId: string };
      };
      expect(body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        message: 'Invalid email format',
        field: 'email',
        requestId: 'req_test123',
      });
    });

    it('returns 404 for NotFoundError', async () => {
      app.get('/test', () => {
        throw new NotFoundError('Preprint', 'at://did/collection/123');
      });

      const res = await app.request('/test');

      expect(res.status).toBe(404);
      const body = (await res.json()) as {
        error: { code: string; message: string; requestId: string };
      };
      expect(body.error).toMatchObject({
        code: 'NOT_FOUND',
        message: 'Preprint not found: at://did/collection/123',
        requestId: 'req_test123',
      });
    });

    it('returns 401 for AuthenticationError', async () => {
      app.get('/test', () => {
        throw new AuthenticationError('Invalid token');
      });

      const res = await app.request('/test');

      expect(res.status).toBe(401);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('returns 403 for AuthorizationError', async () => {
      app.get('/test', () => {
        throw new AuthorizationError('Insufficient permissions', 'write');
      });

      const res = await app.request('/test');

      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('returns 429 for RateLimitError with Retry-After header', async () => {
      app.get('/test', () => {
        throw new RateLimitError(30);
      });

      const res = await app.request('/test');

      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBe('30');
      const body = (await res.json()) as {
        error: { code: string; retryAfter: number; requestId: string };
      };
      expect(body.error).toMatchObject({
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: 30,
        requestId: 'req_test123',
      });
    });

    it('returns 500 for DatabaseError', async () => {
      app.get('/test', () => {
        throw new DatabaseError('READ', 'Connection failed');
      });

      const res = await app.request('/test');

      expect(res.status).toBe(500);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe('DATABASE_ERROR');
    });

    it('returns 500 for ComplianceError', async () => {
      app.get('/test', () => {
        throw new ComplianceError('WRITE_TO_PDS', 'Cannot write to user PDS');
      });

      const res = await app.request('/test');

      expect(res.status).toBe(500);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe('COMPLIANCE_VIOLATION');
    });

    it('returns 500 for unknown errors', async () => {
      app.get('/test', () => {
        throw new Error('Unknown error');
      });

      const res = await app.request('/test');

      expect(res.status).toBe(500);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });

    it('logs debug for ValidationError', async () => {
      app.get('/test', () => {
        throw new ValidationError('Test error');
      });

      await app.request('/test');

      // ValidationError logs at debug level (client error)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Client error',
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: 'Test error',
        })
      );
    });

    it('logs error for unexpected errors', async () => {
      app.get('/test', () => {
        throw new Error('Unexpected failure');
      });

      await app.request('/test');

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('createErrorResponse', () => {
    it('creates standardized error response object', () => {
      const response = createErrorResponse('INVALID_INPUT', 'Email is required', 'req_123', {
        field: 'email',
      });

      expect(response).toEqual({
        error: {
          code: 'INVALID_INPUT',
          message: 'Email is required',
          requestId: 'req_123',
          field: 'email',
        },
      });
    });

    it('omits field when not provided', () => {
      const response = createErrorResponse('NOT_FOUND', 'Resource not found', 'req_456');

      expect(response).toEqual({
        error: {
          code: 'NOT_FOUND',
          message: 'Resource not found',
          requestId: 'req_456',
        },
      });
    });

    it('includes retryAfter when provided', () => {
      const response = createErrorResponse('RATE_LIMIT_EXCEEDED', 'Too many requests', 'req_789', {
        retryAfter: 30,
      });

      expect(response).toEqual({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests',
          requestId: 'req_789',
          retryAfter: 30,
        },
      });
    });
  });
});
