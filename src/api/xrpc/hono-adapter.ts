/**
 * XRPC Hono adapter for ATProto-compliant API routing.
 *
 * @remarks
 * Creates a thin Hono adapter that implements ATProto XRPC conventions:
 * - Path convention: `/xrpc/{nsid}`
 * - HTTP methods: GET for queries, POST for procedures
 * - Error format: `{ error: "Type", message: "..." }`
 * - Lexicon validation for input, params, and output
 *
 * This adapter reuses utilities from @atproto/xrpc-server while
 * maintaining Hono's performance and runtime compatibility.
 *
 * @packageDocumentation
 * @public
 */

import type { Lexicons, LexXrpcQuery, LexXrpcProcedure } from '@atproto/lexicon';
import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server';
import { Hono } from 'hono';

import type { ChiveEnv } from '../types/context.js';

import type { XRPCMethod, XRPCMethodWithMeta, AuthContext } from './types.js';
import { decodeQueryParams, isQuery } from './util.js';
import { validateXrpcParams, validateXrpcInput, validateXrpcOutput } from './validation.js';

/**
 * Options for creating an XRPC router.
 */
export interface CreateXRPCRouterOptions {
  /** Whether to validate output against lexicon schemas */
  validateOutput?: boolean;
  /** Whether to log debug information */
  debug?: boolean;
}

/**
 * XRPC router factory result.
 */
export interface XRPCRouter {
  /** Hono router instance */
  router: Hono<ChiveEnv>;
  /**
   * Registers an XRPC method.
   *
   * @param nsid - NSID of the method
   * @param config - Method configuration
   */
  method: <P, I, O>(nsid: string, config: XRPCMethod<P, I, O>) => void;
  /** All registered methods with metadata */
  methods: Map<string, XRPCMethodWithMeta>;
}

/**
 * Creates an XRPC router with lexicon validation.
 *
 * @param lexicons - Lexicons instance with loaded schemas
 * @param options - Router options
 * @returns XRPC router factory
 *
 * @example
 * ```typescript
 * const lexicons = createLexicons(allLexiconDocs);
 * const { router, method } = createXRPCRouter(lexicons);
 *
 * method('pub.chive.eprint.getSubmission', {
 *   auth: false,
 *   handler: async ({ params, c }) => {
 *     const result = await c.get('services').eprint.getSubmission(params.uri);
 *     return { encoding: 'application/json', body: result };
 *   },
 * });
 *
 * app.route('/xrpc', router);
 * ```
 *
 * @public
 */
export function createXRPCRouter(
  lexicons: Lexicons,
  options: CreateXRPCRouterOptions = {}
): XRPCRouter {
  const router = new Hono<ChiveEnv>();
  const methods = new Map<string, XRPCMethodWithMeta>();
  const { validateOutput = false, debug = false } = options;

  function method<P, I, O>(nsid: string, config: XRPCMethod<P, I, O>): void {
    // Get lexicon definition
    let def: LexXrpcQuery | LexXrpcProcedure | undefined;
    try {
      def = lexicons.getDef(nsid) as LexXrpcQuery | LexXrpcProcedure | undefined;
    } catch {
      // Lexicon not found - will use config only
    }

    // Determine if this is a query (GET) or procedure (POST)
    const isQueryMethod = def ? isQuery(def) : true; // Default to query if no lexicon
    const httpMethod = isQueryMethod ? 'get' : 'post';

    // Store method with metadata
    const methodWithMeta: XRPCMethodWithMeta<P, I, O> = {
      ...config,
      nsid,
      lexicon: def ?? config.lexicon,
    };
    methods.set(nsid, methodWithMeta as XRPCMethodWithMeta);

    // Register route
    const path = `/${nsid}`;

    if (debug) {
      // Use console.warn for debug output (allowed by eslint config)
      console.warn(`[XRPC] Registering ${httpMethod.toUpperCase()} ${path}`);
    }

    router[httpMethod](path, async (c) => {
      const logger = c.get('logger');
      const methodConfig = methods.get(nsid);
      if (!methodConfig) {
        throw new InvalidRequestError(`Unknown method: ${nsid}`);
      }

      // Check authentication
      if (methodConfig.auth === true) {
        const user = c.get('user');
        if (!user) {
          throw new AuthRequiredError();
        }
      }

      // Get auth context from authenticated user
      const user = c.get('user');
      const auth: AuthContext | null = user
        ? {
            did: user.did,
            iss: user.did, // Use DID as issuer since we don't have JWT iss
          }
        : null;

      // Parse and decode parameters
      let params: Record<string, unknown> = {};
      if (isQueryMethod) {
        // Query: params from URL query string
        const rawParams = c.req.query();
        params = def
          ? decodeQueryParams(def, rawParams as Record<string, string | string[] | undefined>)
          : rawParams;

        // Validate params against lexicon
        if (def) {
          validateXrpcParams(lexicons, nsid, params);
        }
      }

      // Parse input (for procedures or queries with body)
      let input: unknown = undefined;
      if (!isQueryMethod) {
        const contentType = c.req.header('content-type') ?? '';
        if (contentType.includes('application/json')) {
          try {
            input = await c.req.json();
          } catch {
            throw new InvalidRequestError('Invalid JSON body');
          }

          // For procedures, params may come from body
          if (def?.parameters && input && typeof input === 'object') {
            params = decodeQueryParams(def, input as Record<string, string | string[] | undefined>);
            validateXrpcParams(lexicons, nsid, params);
          }

          // Validate input body
          if (def) {
            validateXrpcInput(lexicons, nsid, input);
          }
        }
      }

      if (debug) {
        logger.debug('XRPC request', {
          nsid,
          params,
          hasInput: input !== undefined,
          authenticated: auth !== null,
        });
      }

      // Execute handler
      const result = await methodConfig.handler({
        params: params as P,
        input: input as I | undefined,
        auth,
        c,
      });

      // Validate output against lexicon (optional, for development)
      if (validateOutput && def) {
        validateXrpcOutput(lexicons, nsid, result.body);
      }

      // Return response
      const headers: Record<string, string> = {
        'Content-Type': result.encoding,
        ...result.headers,
      };

      return c.json(result.body, 200, headers);
    });
  }

  return { router, method, methods };
}

/**
 * Creates an XRPC router without lexicon validation.
 *
 * @remarks
 * Use this when you don't have lexicon schemas available or want to
 * skip validation for performance reasons. Handlers are responsible
 * for their own validation.
 *
 * @returns XRPC router factory
 *
 * @public
 */
export function createSimpleXRPCRouter(): XRPCRouter {
  const router = new Hono<ChiveEnv>();
  const methods = new Map<string, XRPCMethodWithMeta>();

  function method<P, I, O>(
    nsid: string,
    config: XRPCMethod<P, I, O> & { type?: 'query' | 'procedure' }
  ): void {
    const isQueryMethod = config.type !== 'procedure';
    const httpMethod = isQueryMethod ? 'get' : 'post';

    methods.set(nsid, { ...config, nsid } as XRPCMethodWithMeta);

    router[httpMethod](`/${nsid}`, async (c) => {
      const methodConfig = methods.get(nsid);
      if (!methodConfig) {
        throw new InvalidRequestError(`Unknown method: ${nsid}`);
      }

      // Check authentication
      if (methodConfig.auth === true) {
        const user = c.get('user');
        if (!user) {
          throw new AuthRequiredError();
        }
      }

      // Get auth context
      const user = c.get('user');
      const auth: AuthContext | null = user ? { did: user.did, iss: user.did } : null;

      // Parse params/input
      const params = isQueryMethod ? c.req.query() : {};
      let input: unknown = undefined;

      if (!isQueryMethod) {
        const contentType = c.req.header('content-type') ?? '';
        if (contentType.includes('application/json')) {
          input = await c.req.json().catch(() => ({}));
        }
      }

      // Execute handler
      const result = await methodConfig.handler({
        params: params as P,
        input: input as I | undefined,
        auth,
        c,
      });

      return c.json(result.body, 200, {
        'Content-Type': result.encoding,
        ...result.headers,
      });
    });
  }

  return { router, method, methods };
}

/**
 * Batch registers multiple XRPC methods.
 *
 * @param xrpc - XRPC router
 * @param handlers - Record of NSID to handler config
 *
 * @example
 * ```typescript
 * registerMethods(xrpc, {
 *   'pub.chive.eprint.getSubmission': getSubmissionHandler,
 *   'pub.chive.eprint.search': searchHandler,
 * });
 * ```
 */
export function registerMethods(xrpc: XRPCRouter, handlers: Record<string, XRPCMethod>): void {
  for (const [nsid, config] of Object.entries(handlers)) {
    xrpc.method(nsid, config);
  }
}
