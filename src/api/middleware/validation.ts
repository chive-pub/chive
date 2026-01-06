/**
 * Request validation middleware using Zod schemas.
 *
 * @remarks
 * Provides middleware factories for validating query parameters, request
 * bodies, and path parameters against Zod schemas. Validation errors are
 * converted to ValidationError for consistent error handling.
 *
 * @packageDocumentation
 * @public
 */

import type { MiddlewareHandler } from 'hono';
import type { z, ZodError } from 'zod';

import { ValidationError } from '../../types/errors.js';
import type { ChiveEnv } from '../types/context.js';

/**
 * Converts Zod validation error to ValidationError.
 *
 * @param error - Zod validation error
 * @returns ValidationError with field and constraint information
 */
function formatZodError(error: ZodError): ValidationError {
  const firstIssue = error.issues[0];

  if (!firstIssue) {
    return new ValidationError('Validation failed');
  }

  const field = firstIssue.path.join('.');
  const constraint = firstIssue.code;
  const message = firstIssue.message;

  return new ValidationError(message, field || undefined, constraint);
}

/**
 * Validates query parameters against a Zod schema.
 *
 * @typeParam T - Schema output type
 * @param schema - Zod schema for validation
 * @returns Middleware that validates query params and sets validatedInput
 *
 * @remarks
 * Validated input is stored in context as `validatedInput` for handler access.
 *
 * @example
 * ```typescript
 * const paramsSchema = z.object({
 *   uri: z.string().startsWith('at://'),
 *   limit: z.coerce.number().min(1).max(100).default(50),
 * });
 *
 * app.get(
 *   '/xrpc/pub.chive.preprint.getSubmission',
 *   validateQuery(paramsSchema),
 *   (c) => {
 *     const params = c.get('validatedInput') as z.infer<typeof paramsSchema>;
 *     // params.uri and params.limit are type-safe
 *   }
 * );
 * ```
 *
 * @public
 */
export function validateQuery<T>(schema: z.ZodType<T>): MiddlewareHandler<ChiveEnv> {
  return async (c, next) => {
    const query = c.req.query();
    const result = schema.safeParse(query);

    if (!result.success) {
      throw formatZodError(result.error);
    }

    c.set('validatedInput', result.data);
    await next();
  };
}

/**
 * Validates request body against a Zod schema.
 *
 * @typeParam T - Schema output type
 * @param schema - Zod schema for validation
 * @returns Middleware that validates body and sets validatedInput
 *
 * @remarks
 * Handles JSON parse errors gracefully, converting them to ValidationError.
 *
 * @example
 * ```typescript
 * const bodySchema = z.object({
 *   q: z.string().min(1),
 *   facets: z.array(z.string()).optional(),
 *   limit: z.number().min(1).max(100).default(50),
 * });
 *
 * app.post(
 *   '/xrpc/pub.chive.preprint.searchSubmissions',
 *   validateBody(bodySchema),
 *   (c) => {
 *     const body = c.get('validatedInput') as z.infer<typeof bodySchema>;
 *     // body.q, body.facets, body.limit are type-safe
 *   }
 * );
 * ```
 *
 * @public
 */
export function validateBody<T>(schema: z.ZodType<T>): MiddlewareHandler<ChiveEnv> {
  return async (c, next) => {
    let body: unknown;

    try {
      body = await c.req.json();
    } catch {
      throw new ValidationError('Invalid JSON body', 'body', 'json_parse');
    }

    const result = schema.safeParse(body);

    if (!result.success) {
      throw formatZodError(result.error);
    }

    c.set('validatedInput', result.data);
    await next();
  };
}

/**
 * Validates path parameters against a Zod schema.
 *
 * @typeParam T - Schema output type
 * @param schema - Zod schema for validation
 * @returns Middleware that validates path params and sets validatedInput
 *
 * @example
 * ```typescript
 * const paramsSchema = z.object({
 *   did: z.string().startsWith('did:'),
 * });
 *
 * app.get(
 *   '/api/v1/authors/:did',
 *   validateParams(paramsSchema),
 *   (c) => {
 *     const params = c.get('validatedInput') as z.infer<typeof paramsSchema>;
 *     // params.did is type-safe
 *   }
 * );
 * ```
 *
 * @public
 */
export function validateParams<T>(schema: z.ZodType<T>): MiddlewareHandler<ChiveEnv> {
  return async (c, next) => {
    const params = c.req.param();
    const result = schema.safeParse(params);

    if (!result.success) {
      throw formatZodError(result.error);
    }

    c.set('validatedInput', result.data);
    await next();
  };
}

/**
 * Combines multiple validation middlewares.
 *
 * @typeParam TQuery - Query schema output type
 * @typeParam TBody - Body schema output type
 * @typeParam TParams - Params schema output type
 * @param options - Validation schemas for query, body, and params
 * @returns Middleware that validates all inputs
 *
 * @remarks
 * Validates query, body, and params in order. First validation failure
 * throws an error. Combined validated input is stored as an object with
 * `query`, `body`, and `params` keys.
 *
 * @example
 * ```typescript
 * app.post(
 *   '/api/v1/preprints/:id/comments',
 *   validateAll({
 *     params: paramsSchema,
 *     body: bodySchema,
 *   }),
 *   (c) => {
 *     const { params, body } = c.get('validatedInput');
 *   }
 * );
 * ```
 *
 * @public
 */
export function validateAll<TQuery = unknown, TBody = unknown, TParams = unknown>(options: {
  query?: z.ZodType<TQuery>;
  body?: z.ZodType<TBody>;
  params?: z.ZodType<TParams>;
}): MiddlewareHandler<ChiveEnv> {
  return async (c, next) => {
    const validated: {
      query?: TQuery;
      body?: TBody;
      params?: TParams;
    } = {};

    // Validate query parameters
    if (options.query) {
      const query = c.req.query();
      const result = options.query.safeParse(query);
      if (!result.success) {
        throw formatZodError(result.error);
      }
      validated.query = result.data;
    }

    // Validate path parameters
    if (options.params) {
      const params = c.req.param();
      const result = options.params.safeParse(params);
      if (!result.success) {
        throw formatZodError(result.error);
      }
      validated.params = result.data;
    }

    // Validate body
    if (options.body) {
      let body: unknown;
      try {
        body = await c.req.json();
      } catch {
        throw new ValidationError('Invalid JSON body', 'body', 'json_parse');
      }
      const result = options.body.safeParse(body);
      if (!result.success) {
        throw formatZodError(result.error);
      }
      validated.body = result.data;
    }

    c.set('validatedInput', validated);
    await next();
  };
}
