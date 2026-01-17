/**
 * Error response schemas for API documentation.
 *
 * @remarks
 * Defines Zod schemas for error responses following industry-standard
 * patterns (Stripe, GitHub). Used for OpenAPI documentation generation.
 *
 * @packageDocumentation
 * @public
 */

import { z } from './base.js';

/**
 * Error detail schema.
 *
 * @public
 */
export const errorDetailSchema = z.object({
  /**
   * Machine-readable error code.
   */
  code: z.string().describe('Machine-readable error code'),

  /**
   * Human-readable error message.
   */
  message: z.string().describe('Human-readable error message'),

  /**
   * Request ID for correlation.
   */
  requestId: z.string().describe('Request ID for support correlation'),

  /**
   * Field that caused the error (validation errors only).
   */
  field: z.string().optional().describe('Field that caused the error'),

  /**
   * Seconds to wait before retrying (rate limit errors only).
   */
  retryAfter: z.number().int().optional().describe('Seconds to wait before retrying'),
});

/**
 * Error response schema.
 *
 * @public
 */
export const errorResponseSchema = z.object({
  error: errorDetailSchema,
});

/**
 * Error response type.
 *
 * @public
 */
export type ErrorResponseType = z.infer<typeof errorResponseSchema>;

/**
 * Validation error response schema (400).
 *
 * @public
 */
export const validationErrorSchema = z.object({
  error: errorDetailSchema.extend({
    code: z.literal('VALIDATION_ERROR'),
    field: z.string().describe('Field that failed validation'),
  }),
});

/**
 * Authentication error response schema (401).
 *
 * @public
 */
export const authenticationErrorSchema = z.object({
  error: errorDetailSchema.extend({
    code: z.literal('AUTHENTICATION_ERROR'),
  }),
});

/**
 * Authorization error response schema (403).
 *
 * @public
 */
export const authorizationErrorSchema = z.object({
  error: errorDetailSchema.extend({
    code: z.literal('AUTHORIZATION_ERROR'),
  }),
});

/**
 * Not found error response schema (404).
 *
 * @public
 */
export const notFoundErrorSchema = z.object({
  error: errorDetailSchema.extend({
    code: z.literal('NOT_FOUND'),
  }),
});

/**
 * Rate limit error response schema (429).
 *
 * @public
 */
export const rateLimitErrorSchema = z.object({
  error: errorDetailSchema.extend({
    code: z.literal('RATE_LIMIT_EXCEEDED'),
    retryAfter: z.number().int().describe('Seconds to wait before retrying'),
  }),
});

/**
 * Internal error response schema (500).
 *
 * @public
 */
export const internalErrorSchema = z.object({
  error: errorDetailSchema.extend({
    code: z.enum(['INTERNAL_ERROR', 'DATABASE_ERROR', 'COMPLIANCE_VIOLATION']),
  }),
});

/**
 * Common error responses for OpenAPI documentation.
 *
 * @remarks
 * Use these in route definitions for consistent error documentation.
 *
 * @example
 * ```typescript
 * const route = createRoute({
 *   // ...
 *   responses: {
 *     200: { ... },
 *     ...commonErrorResponses,
 *   },
 * });
 * ```
 *
 * @public
 */
export const commonErrorResponses = {
  400: {
    description: 'Bad Request - Validation error',
    content: {
      'application/json': {
        schema: validationErrorSchema,
      },
    },
  },
  401: {
    description: 'Unauthorized - Authentication required',
    content: {
      'application/json': {
        schema: authenticationErrorSchema,
      },
    },
  },
  403: {
    description: 'Forbidden - Insufficient permissions',
    content: {
      'application/json': {
        schema: authorizationErrorSchema,
      },
    },
  },
  404: {
    description: 'Not Found - Resource not found',
    content: {
      'application/json': {
        schema: notFoundErrorSchema,
      },
    },
  },
  429: {
    description: 'Too Many Requests - Rate limit exceeded',
    content: {
      'application/json': {
        schema: rateLimitErrorSchema,
      },
    },
  },
  500: {
    description: 'Internal Server Error',
    content: {
      'application/json': {
        schema: internalErrorSchema,
      },
    },
  },
} as const;
