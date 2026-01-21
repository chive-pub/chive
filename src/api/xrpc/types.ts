/**
 * XRPC type definitions for Hono adapter.
 *
 * @remarks
 * Provides type-safe interfaces for XRPC method handlers following
 * ATProto conventions. These types enable lexicon-driven validation
 * and handler execution.
 *
 * @packageDocumentation
 * @public
 */

import type { LexXrpcQuery, LexXrpcProcedure } from '@atproto/lexicon';
import type { Context } from 'hono';

import type { ChiveEnv } from '../types/context.js';

/**
 * Authentication context from verified JWT.
 *
 * @public
 */
export interface AuthContext {
  /** User's DID */
  did: string;
  /** JWT issuer (user's PDS) */
  iss: string;
  /** Authorized lexicon method (if scoped) */
  lxm?: string;
}

/**
 * XRPC handler context.
 *
 * @typeParam TParams - Query/input parameters type
 * @typeParam TInput - Request body type (procedures only)
 *
 * @public
 */
export interface XRPCContext<TParams = unknown, TInput = unknown> {
  /** Validated query/input parameters */
  params: TParams;
  /** Validated request body (procedures only) */
  input: TInput | undefined;
  /** Authentication context (null if unauthenticated) */
  auth: AuthContext | null;
  /** Hono context for accessing services and request data */
  c: Context<ChiveEnv>;
}

/**
 * XRPC response structure.
 *
 * @typeParam T - Response body type
 *
 * @public
 */
export interface XRPCResponse<T> {
  /** Content encoding (typically 'application/json') */
  encoding: string;
  /** Response body */
  body: T;
  /** Optional response headers */
  headers?: Record<string, string>;
}

/**
 * XRPC method definition.
 *
 * @typeParam TParams - Query/input parameters type
 * @typeParam TInput - Request body type (procedures only)
 * @typeParam TOutput - Response body type
 *
 * @remarks
 * Defines a complete XRPC method with lexicon reference, auth requirements,
 * and handler function. Used for type-safe route registration.
 *
 * @example
 * ```typescript
 * const getSubmission: XRPCMethod<GetSubmissionParams, void, Submission> = {
 *   auth: false,
 *   handler: async ({ params, c }) => {
 *     const eprintService = c.get('services').eprint;
 *     const result = await eprintService.getSubmission(params.uri);
 *     return { encoding: 'application/json', body: result };
 *   },
 * };
 * ```
 *
 * @public
 */
export interface XRPCMethod<TParams = unknown, TInput = unknown, TOutput = unknown> {
  /**
   * Method type: query (GET) or procedure (POST).
   *
   * @defaultValue 'query'
   */
  type?: 'query' | 'procedure';

  /**
   * Lexicon definition for this method (optional if using NSID lookup).
   */
  lexicon?: LexXrpcQuery | LexXrpcProcedure;

  /**
   * Authentication requirement.
   *
   * @remarks
   * - `true`: Authentication required (401 if not authenticated)
   * - `false`: No authentication required (public endpoint)
   * - `'optional'`: Authentication optional (different behavior for authed users)
   *
   * @defaultValue false
   */
  auth?: boolean | 'optional';

  /**
   * Handler function implementing the method logic.
   */
  handler: (ctx: XRPCContext<TParams, TInput>) => Promise<XRPCResponse<TOutput>>;
}

/**
 * XRPC error response structure (ATProto standard).
 *
 * @remarks
 * ATProto uses a flat error format at the top level:
 * ```json
 * {
 *   "error": "InvalidRequest",
 *   "message": "Missing required field: uri"
 * }
 * ```
 *
 * @public
 */
export interface XRPCErrorResponse {
  /** Error type/code */
  error: string;
  /** Human-readable error message */
  message: string;
}

/**
 * HTTP status codes used by XRPC.
 *
 * @public
 */
export type XRPCStatusCode = 200 | 400 | 401 | 403 | 404 | 413 | 429 | 500 | 501 | 502 | 503;

/**
 * Rate limit tier for endpoint configuration.
 *
 * @public
 */
export type RateLimitTier = 'anonymous' | 'authenticated' | 'elevated' | 'unlimited';

/**
 * Extended XRPC method with metadata for route registration.
 *
 * @typeParam TParams - Query/input parameters type
 * @typeParam TInput - Request body type (procedures only)
 * @typeParam TOutput - Response body type
 *
 * @public
 */
export interface XRPCMethodWithMeta<
  TParams = unknown,
  TInput = unknown,
  TOutput = unknown,
> extends XRPCMethod<TParams, TInput, TOutput> {
  /** NSID of the method (e.g., 'pub.chive.eprint.getSubmission') */
  nsid: string;
  /** Rate limit tier */
  rateLimit?: RateLimitTier;
  /** Human-readable description */
  description?: string;
}
