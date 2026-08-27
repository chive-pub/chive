/**
 * Unit tests for error handler middleware.
 *
 * @remarks
 * Tests error mapping from ChiveError types to HTTP responses
 * using ATProto-compliant flat error format.
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
      const body = (await res.json()) as { error: string; message: string };
      expect(body.error).toBe('InvalidRequest');
      expect(body.message).toBe('Invalid email format');
    });

    it('returns 404 for NotFoundError', async () => {
      app.get('/test', () => {
        throw new NotFoundError('Eprint', 'at://did/collection/123');
      });

      const res = await app.request('/test');

      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: string; message: string };
      expect(body.error).toBe('NotFound');
      expect(body.message).toBe('Eprint not found: at://did/collection/123');
    });

    it('returns 401 for AuthenticationError', async () => {
      app.get('/test', () => {
        throw new AuthenticationError('Invalid token');
      });

      const res = await app.request('/test');

      expect(res.status).toBe(401);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe('AuthenticationRequired');
    });

    it('returns 403 for AuthorizationError', async () => {
      app.get('/test', () => {
        throw new AuthorizationError('Insufficient permissions', 'write');
      });

      const res = await app.request('/test');

      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe('Forbidden');
    });

    it('returns 429 for RateLimitError with Retry-After header', async () => {
      app.get('/test', () => {
        throw new RateLimitError(30);
      });

      const res = await app.request('/test');

      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBe('30');
      const body = (await res.json()) as { error: string; message: string };
      expect(body.error).toBe('RateLimitExceeded');
    });

    it('returns 500 for DatabaseError', async () => {
      app.get('/test', () => {
        throw new DatabaseError('READ', 'Connection failed');
      });

      const res = await app.request('/test');

      expect(res.status).toBe(500);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe('DATABASE_ERROR');
    });

    it('returns 500 for ComplianceError', async () => {
      app.get('/test', () => {
        throw new ComplianceError('WRITE_TO_PDS', 'Cannot write to user PDS');
      });

      const res = await app.request('/test');

      expect(res.status).toBe(500);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe('COMPLIANCE_VIOLATION');
    });

    it('returns 500 for unknown errors', async () => {
      app.get('/test', () => {
        throw new Error('Unknown error');
      });

      const res = await app.request('/test');

      expect(res.status).toBe(500);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe('InternalServerError');
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
    it('creates ATProto-compliant flat error response', () => {
      const response = createErrorResponse('InvalidRequest', 'Email is required');

      expect(response).toEqual({
        error: 'InvalidRequest',
        message: 'Email is required',
      });
    });

    it('handles NotFound error type', () => {
      const response = createErrorResponse('NotFound', 'Resource not found');

      expect(response).toEqual({
        error: 'NotFound',
        message: 'Resource not found',
      });
    });

    it('handles RateLimitExceeded error type', () => {
      const response = createErrorResponse('RateLimitExceeded', 'Too many requests');

      expect(response).toEqual({
        error: 'RateLimitExceeded',
        message: 'Too many requests',
      });
    });
  });
});

describe('XRPC error logging severity', () => {
  it('logs a 404 below error severity', async () => {
    // NotFoundError used to match the `ChiveError` branch and be recorded at
    // error severity, so routine misses filled the error dashboards.
    const { xrpcErrorHandler } = await import('@/api/xrpc/error-handler.js');
    const logger = createMockLogger();
    const c = {
      get: (key: string) => (key === 'logger' ? logger : undefined),
      header: vi.fn(),
      json: (body: unknown, status?: number) =>
        new Response(JSON.stringify(body), { status: status ?? 200 }),
    } as never;

    await xrpcErrorHandler(new NotFoundError('Eprint', 'at://x'), c);

    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalled();
  });

  it('logs a 400 at all', async () => {
    // ValidationError matched no branch in the old chain, so every 400 went
    // entirely unlogged — an endpoint could reject every request and leave no
    // trace of having done so.
    const { xrpcErrorHandler } = await import('@/api/xrpc/error-handler.js');
    const logger = createMockLogger();
    const c = {
      get: (key: string) => (key === 'logger' ? logger : undefined),
      header: vi.fn(),
      json: (body: unknown, status?: number) =>
        new Response(JSON.stringify(body), { status: status ?? 200 }),
    } as never;

    await xrpcErrorHandler(new ValidationError('bad input', 'uri'), c);

    expect(logger.debug).toHaveBeenCalled();
  });

  it('logs a 500 at error severity with the error attached', async () => {
    const { xrpcErrorHandler } = await import('@/api/xrpc/error-handler.js');
    const logger = createMockLogger();
    const c = {
      get: (key: string) => (key === 'logger' ? logger : undefined),
      header: vi.fn(),
      json: (body: unknown, status?: number) =>
        new Response(JSON.stringify(body), { status: status ?? 200 }),
    } as never;
    const boom = new Error('boom');

    await xrpcErrorHandler(boom, c);

    expect(logger.error).toHaveBeenCalled();
    const [, attached] = (logger.error as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0] as [string, unknown];
    expect(attached).toBe(boom);
  });
});
