/**
 * XRPC handler exports and route registration.
 *
 * @remarks
 * Aggregates all XRPC endpoints and provides route registration
 * for the Hono application using ATProto-compliant XRPC conventions.
 *
 * @packageDocumentation
 * @public
 */

import type { Hono, MiddlewareHandler } from 'hono';

import type { ValidationError as _ValidationError } from '../../../types/errors.js';
import { RATE_LIMITS, XRPC_PATH_PREFIX } from '../../config.js';
import { requireAuth } from '../../middleware/auth.js';
import { rateLimiter } from '../../middleware/rate-limit.js';
import type { ChiveEnv } from '../../types/context.js';
import { xrpcErrorHandler } from '../../xrpc/error-handler.js';
import { createXRPCRouter } from '../../xrpc/index.js';
import { lexicons, resolveMethodType } from '../../xrpc/validation.js';

// Re-export all endpoint modules
export * from './activity/index.js';
export * from './actor/index.js';
export { adminMethods } from './admin/index.js';
export { annotationMethods } from './annotation/index.js';
export * from './author/index.js';
export * from './backlink/index.js';
export * from './claiming/index.js';
export * from './collaboration/index.js';
export { collectionMethods } from './collection/index.js';
export { subscriptionMethods } from './subscription/index.js';
export * from './discovery/index.js';
export * from './endorsement/index.js';
export * from './governance/index.js';
export * from './graph/index.js';
export * from './import/index.js';
export * from './metrics/index.js';
export * from './eprint/index.js';
export * from './resolve/index.js';
export * from './review/index.js';
export * from './sync/index.js';
export * from './tag/index.js';
export * from './notification/index.js';
export { moderationMethods } from './moderation/index.js';

// Import methods for registration
import { activityMethods } from './activity/index.js';
import { actorMethods } from './actor/index.js';
import { adminMethods } from './admin/index.js';
import { annotationMethods } from './annotation/index.js';
import { atprotoMethods } from './atproto/index.js';
import { authorMethods } from './author/index.js';
import { backlinkMethods } from './backlink/index.js';
import { claimingMethods, claimingRestEndpoints } from './claiming/index.js';
import { collaborationMethods } from './collaboration/index.js';
import { collectionMethods } from './collection/index.js';
import { discoveryMethods } from './discovery/index.js';
import { endorsementMethods } from './endorsement/index.js';
import { eprintMethods } from './eprint/index.js';
import { governanceMethods } from './governance/index.js';
import { graphMethods } from './graph/index.js';
import { importMethods } from './import/index.js';
import { metricsMethods } from './metrics/index.js';
import { moderationMethods } from './moderation/index.js';
import { notificationMethods } from './notification/index.js';
import { resolveMethods } from './resolve/index.js';
import { reviewMethods } from './review/index.js';
import { subscriptionMethods } from './subscription/index.js';
import { syncMethods } from './sync/index.js';
import { tagMethods } from './tag/index.js';

/**
 * All XRPC methods keyed by NSID.
 */
export const allXRPCMethods = {
  ...activityMethods,
  ...actorMethods,
  ...adminMethods,
  ...annotationMethods,
  ...atprotoMethods,
  ...authorMethods,
  ...backlinkMethods,
  ...claimingMethods,
  ...collaborationMethods,
  ...collectionMethods,
  ...subscriptionMethods,
  ...discoveryMethods,
  ...endorsementMethods,
  ...eprintMethods,
  ...governanceMethods,
  ...graphMethods,
  ...importMethods,
  ...metricsMethods,
  ...moderationMethods,
  ...notificationMethods,
  ...resolveMethods,
  ...reviewMethods,
  ...syncMethods,
  ...tagMethods,
} as const;

/**
 * Registers all XRPC routes on a Hono app.
 *
 * @param app - Hono application instance
 *
 * @remarks
 * Routes are registered at `/xrpc/{nsid}` following ATProto conventions:
 * - Query endpoints use GET
 * - Procedure endpoints use POST
 * - Errors use flat ATProto format: `{ error: "Type", message: "..." }`
 *
 * @example
 * ```typescript
 * const app = new Hono<ChiveEnv>();
 * registerXRPCRoutes(app);
 * // Routes:
 * // GET /xrpc/pub.chive.eprint.getSubmission
 * // GET /xrpc/pub.chive.eprint.searchSubmissions
 * // etc.
 * ```
 *
 * @public
 */
export function registerXRPCRoutes(app: Hono<ChiveEnv>): void {
  // Create XRPC router with lexicon validation (output validation catches schema mismatches server-side)
  const xrpc = createXRPCRouter(lexicons, { validateOutput: true });

  // Apply XRPC error handler to the router for ATProto-compliant error responses
  xrpc.router.onError(xrpcErrorHandler);

  // Register all XRPC methods using the router's method() function
  for (const [nsid, method] of Object.entries(allXRPCMethods)) {
    // Determine method type from lexicon or fallback to handler's type property
    const methodType = resolveMethodType(nsid, method.type);

    // Register method with the XRPC router (adds lexicon validation)
    // Type assertion needed due to generic type variance in XRPCMethod
    xrpc.method(nsid, {
      ...method,
      type: methodType,
    } as Parameters<typeof xrpc.method>[1]);
  }

  // Mount XRPC router at /xrpc prefix
  app.route(XRPC_PATH_PREFIX, xrpc.router);

  // Register REST-style endpoints (binary/non-JSON responses) directly on app.
  //
  // Three things were wrong with the previous if/else over GET and POST:
  //
  //   - The `auth` and `rateLimit` fields on `RESTEndpoint` were declared and
  //     then ignored. `fetchExternalPdf` says `auth: 'required'` and is only
  //     protected because its handler happens to check `c.get('user')` itself;
  //     the next endpoint to declare it and forget that check would be open.
  //   - `RESTEndpoint` admits PUT, DELETE and PATCH. Any endpoint declaring one
  //     matched neither branch and was registered nowhere — a 404 at runtime
  //     with nothing said at startup.
  //   - An unrecognised method was skipped in silence. It now throws while the
  //     server is starting, which is the only point at which anyone would see it.
  for (const endpoint of claimingRestEndpoints) {
    const middleware: MiddlewareHandler<ChiveEnv>[] = [];

    if (endpoint.auth === 'required') {
      middleware.push(requireAuth());
    }

    // The declared tier is a ceiling: an endpoint marked `anonymous` gets the
    // anonymous allowance regardless of who is calling, which is the point of
    // declaring it on a route that proxies fetches to third parties.
    const ceiling = RATE_LIMITS[endpoint.rateLimit];
    middleware.push(
      rateLimiter({
        anonymous: Math.min(RATE_LIMITS.anonymous, ceiling),
        authenticated: Math.min(RATE_LIMITS.authenticated, ceiling),
        premium: Math.min(RATE_LIMITS.premium, ceiling),
        admin: Math.min(RATE_LIMITS.admin, ceiling),
      })
    );

    switch (endpoint.method) {
      case 'GET':
        app.get(endpoint.path, ...middleware, endpoint.handler);
        break;
      case 'POST':
        app.post(endpoint.path, ...middleware, endpoint.handler);
        break;
      case 'PUT':
        app.put(endpoint.path, ...middleware, endpoint.handler);
        break;
      case 'DELETE':
        app.delete(endpoint.path, ...middleware, endpoint.handler);
        break;
      case 'PATCH':
        app.patch(endpoint.path, ...middleware, endpoint.handler);
        break;
      default: {
        const unreachable: never = endpoint.method;
        throw new Error(`Unsupported REST endpoint method: ${String(unreachable)}`);
      }
    }
  }
}
