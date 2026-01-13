/**
 * Handler type definitions for XRPC and REST endpoints.
 *
 * @remarks
 * Provides type-safe handler interfaces for implementing API endpoints.
 * XRPC handlers follow AT Protocol conventions while REST handlers
 * provide compatibility for non-AT Protocol clients.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';
import type { z } from 'zod';

import type { NSID } from '../../types/atproto.js';

import type { ChiveEnv, RateLimitTier } from './context.js';

/**
 * XRPC endpoint type.
 *
 * @remarks
 * - `query`: Read-only operation (HTTP GET)
 * - `procedure`: State-changing operation (HTTP POST)
 *
 * Note: Chive AppView only exposes queries (read-only), never procedures
 * that write to user PDSes.
 *
 * @public
 */
export type XRPCType = 'query' | 'procedure';

/**
 * Authentication requirement for an endpoint.
 *
 * @remarks
 * - `none`: No authentication required (public endpoint)
 * - `optional`: Authentication optional (rate limits differ)
 * - `required`: Authentication required (401 if not authenticated)
 *
 * @public
 */
export type AuthRequirement = 'none' | 'optional' | 'required';

/**
 * XRPC handler function type.
 *
 * @typeParam TInput - Validated input type from Zod schema
 * @typeParam TOutput - Output type matching output schema
 *
 * @remarks
 * Handlers receive the Hono context and validated input parameters.
 * They should return the output directly; errors should be thrown
 * as ChiveError subclasses for centralized handling.
 *
 * @example
 * ```typescript
 * const handler: XRPCHandler<GetSubmissionInput, GetSubmissionOutput> =
 *   async (c, input) => {
 *     const { eprint } = c.get('services');
 *     const result = await eprint.getEprint(input.uri);
 *     if (!result) {
 *       throw new NotFoundError('Eprint', input.uri);
 *     }
 *     return { uri: result.uri, ... };
 *   };
 * ```
 *
 * @public
 */
export type XRPCHandler<TInput, TOutput> = (
  c: Context<ChiveEnv>,
  input: TInput
) => Promise<TOutput>;

/**
 * XRPC endpoint definition.
 *
 * @typeParam TInput - Input parameter type
 * @typeParam TOutput - Output response type
 *
 * @remarks
 * Defines a complete XRPC endpoint with metadata, schemas, and handler.
 * Used for route registration and OpenAPI documentation generation.
 *
 * @example
 * ```typescript
 * export const getSubmissionEndpoint: XRPCEndpoint<
 *   GetSubmissionInput,
 *   GetSubmissionOutput
 * > = {
 *   method: 'pub.chive.eprint.getSubmission' as NSID,
 *   type: 'query',
 *   description: 'Get eprint by AT URI',
 *   inputSchema: getSubmissionInputSchema,
 *   outputSchema: getSubmissionOutputSchema,
 *   handler: getSubmissionHandler,
 *   auth: 'optional',
 *   rateLimit: 'authenticated',
 * };
 * ```
 *
 * @public
 */
export interface XRPCEndpoint<TInput, TOutput> {
  /**
   * NSID of the XRPC method (e.g., "pub.chive.eprint.getSubmission").
   */
  readonly method: NSID;

  /**
   * XRPC type: query (GET) or procedure (POST).
   */
  readonly type: XRPCType;

  /**
   * Human-readable description for documentation.
   */
  readonly description: string;

  /**
   * Zod schema for validating input parameters.
   */
  readonly inputSchema: z.ZodType<TInput>;

  /**
   * Zod schema for validating and documenting output.
   */
  readonly outputSchema: z.ZodType<TOutput>;

  /**
   * Handler function implementing the endpoint logic.
   */
  readonly handler: XRPCHandler<TInput, TOutput>;

  /**
   * Authentication requirement for this endpoint.
   *
   * @defaultValue 'optional'
   */
  readonly auth?: AuthRequirement;

  /**
   * Rate limit tier to apply.
   *
   * @remarks
   * Determines which rate limit bucket is used. Higher tiers get more
   * requests per minute.
   *
   * @defaultValue 'authenticated'
   */
  readonly rateLimit?: RateLimitTier;
}

/**
 * REST handler function type.
 *
 * @remarks
 * REST handlers receive the full Hono context and handle the request
 * directly, including response formatting.
 *
 * @public
 */
export type RESTHandler = (c: Context<ChiveEnv>) => Promise<Response>;

/**
 * REST endpoint definition.
 *
 * @remarks
 * Defines a REST endpoint with HTTP method, path pattern, and handler.
 *
 * @public
 */
export interface RESTEndpoint {
  /**
   * HTTP method.
   */
  readonly method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

  /**
   * URL path pattern (e.g., "/api/v1/eprints/:uri").
   */
  readonly path: string;

  /**
   * Human-readable description for documentation.
   */
  readonly description: string;

  /**
   * Handler function.
   */
  readonly handler: RESTHandler;

  /**
   * Authentication requirement.
   */
  readonly auth?: AuthRequirement;

  /**
   * Rate limit tier to apply.
   */
  readonly rateLimit?: RateLimitTier;
}

/**
 * Extracts input type from an XRPC endpoint definition.
 *
 * @typeParam T - XRPC endpoint type
 *
 * @public
 */
export type ExtractInput<T> = T extends XRPCEndpoint<infer I, unknown> ? I : never;

/**
 * Extracts output type from an XRPC endpoint definition.
 *
 * @typeParam T - XRPC endpoint type
 *
 * @public
 */
export type ExtractOutput<T> = T extends XRPCEndpoint<unknown, infer O> ? O : never;
