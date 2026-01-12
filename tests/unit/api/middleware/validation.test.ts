/**
 * Unit tests for validation middleware.
 *
 * @remarks
 * Tests Zod schema validation for query parameters, request body,
 * and path parameters.
 */

import { Hono } from 'hono';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

import { validateQuery, validateBody, validateParams } from '@/api/middleware/validation.js';
import type { ChiveEnv } from '@/api/types/context.js';
import { ValidationError } from '@/types/errors.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

/** Type for validation error responses in tests. */
interface ValidationErrorResponse {
  error: {
    code: string;
    message?: string;
    field?: string;
  };
}

const createMockLogger = (): ILogger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
});

describe('Validation Middleware', () => {
  let app: Hono<ChiveEnv>;
  let mockLogger: ILogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    app = new Hono<ChiveEnv>();

    // Set up context
    app.use('*', async (c, next) => {
      c.set('logger', mockLogger);
      c.set('requestId', 'req_test123');
      await next();
    });

    // Error handler to convert ValidationError to JSON response
    app.onError((err, c) => {
      if (err instanceof ValidationError) {
        return c.json(
          {
            error: {
              code: err.code,
              message: err.message,
              field: err.field,
            },
          },
          400
        );
      }
      return c.json({ error: { message: err.message } }, 500);
    });
  });

  describe('validateQuery', () => {
    const querySchema = z.object({
      limit: z.coerce.number().int().min(1).max(100).default(20),
      cursor: z.string().optional(),
      sort: z.enum(['date', 'relevance']).default('date'),
    });

    it('validates and coerces valid query parameters', async () => {
      app.get('/test', validateQuery(querySchema), (c) => {
        const input = c.get('validatedInput');
        return c.json(input);
      });

      const res = await app.request('/test?limit=50&sort=relevance');

      expect(res.status).toBe(200);
      const body = (await res.json()) as { limit: number; sort: string };
      expect(body).toEqual({
        limit: 50,
        sort: 'relevance',
      });
    });

    it('applies default values for missing optional params', async () => {
      app.get('/test', validateQuery(querySchema), (c) => {
        const input = c.get('validatedInput');
        return c.json(input);
      });

      const res = await app.request('/test');

      expect(res.status).toBe(200);
      const body = (await res.json()) as { limit: number; sort: string };
      expect(body).toEqual({
        limit: 20,
        sort: 'date',
      });
    });

    it('returns 400 for invalid query parameters', async () => {
      app.get('/test', validateQuery(querySchema), (c) => {
        return c.json({ success: true });
      });

      const res = await app.request('/test?limit=-5');

      expect(res.status).toBe(400);
      const body = (await res.json()) as ValidationErrorResponse;
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for invalid enum values', async () => {
      app.get('/test', validateQuery(querySchema), (c) => {
        return c.json({ success: true });
      });

      const res = await app.request('/test?sort=invalid');

      expect(res.status).toBe(400);
      const body = (await res.json()) as ValidationErrorResponse;
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('handles required fields correctly', async () => {
      const requiredSchema = z.object({
        uri: z.string().min(1),
      });

      app.get('/test', validateQuery(requiredSchema), (c) => {
        return c.json({ success: true });
      });

      const res = await app.request('/test');

      expect(res.status).toBe(400);
      const body = (await res.json()) as ValidationErrorResponse;
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.field).toBe('uri');
    });
  });

  describe('validateBody', () => {
    const bodySchema = z.object({
      title: z.string().min(1).max(500),
      abstract: z.string().min(100).max(5000),
      keywords: z.array(z.string()).optional(),
    });

    it('validates valid JSON body', async () => {
      app.post('/test', validateBody(bodySchema), (c) => {
        const input = c.get('validatedInput');
        return c.json(input);
      });

      const res = await app.request('/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Test Eprint',
          abstract: 'A'.repeat(150),
          keywords: ['quantum', 'computing'],
        }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { title: string; keywords: string[] };
      expect(body.title).toBe('Test Eprint');
      expect(body.keywords).toEqual(['quantum', 'computing']);
    });

    it('returns 400 for invalid body', async () => {
      app.post('/test', validateBody(bodySchema), (c) => {
        return c.json({ success: true });
      });

      const res = await app.request('/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: '',
          abstract: 'Too short',
        }),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as ValidationErrorResponse;
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('handles missing Content-Type header', async () => {
      app.post('/test', validateBody(bodySchema), (c) => {
        return c.json({ success: true });
      });

      const res = await app.request('/test', {
        method: 'POST',
        body: JSON.stringify({ title: 'Test' }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('validateParams', () => {
    const paramsSchema = z.object({
      id: z.string().regex(/^[a-z0-9-]+$/),
    });

    it('validates valid path parameters', async () => {
      app.get('/items/:id', validateParams(paramsSchema), (c) => {
        const params = c.get('validatedInput');
        return c.json(params);
      });

      const res = await app.request('/items/test-item-123');

      expect(res.status).toBe(200);
      const body = (await res.json()) as { id: string };
      expect(body.id).toBe('test-item-123');
    });

    it('returns 400 for invalid path parameters', async () => {
      app.get('/items/:id', validateParams(paramsSchema), (c) => {
        return c.json({ success: true });
      });

      const res = await app.request('/items/INVALID_ID');

      expect(res.status).toBe(400);
      const body = (await res.json()) as ValidationErrorResponse;
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.field).toBe('id');
    });
  });

  describe('Zod error formatting', () => {
    it('extracts first error path as field', async () => {
      const schema = z.object({
        nested: z.object({
          value: z.number().positive(),
        }),
      });

      app.post('/test', validateBody(schema), (c) => {
        return c.json({ success: true });
      });

      const res = await app.request('/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nested: { value: -1 } }),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as ValidationErrorResponse;
      expect(body.error.field).toBe('nested.value');
    });
  });
});
