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

import type { Hono } from 'hono';

import type { ValidationError as _ValidationError } from '../../../types/errors.js';
import { XRPC_PATH_PREFIX } from '../../config.js';
import type { ChiveEnv } from '../../types/context.js';
import { xrpcErrorHandler } from '../../xrpc/error-handler.js';
import { createXRPCRouter } from '../../xrpc/index.js';
import { lexicons, getMethodType } from '../../xrpc/validation.js';

// Re-export all endpoint modules
export * from './activity/index.js';
export * from './actor/index.js';
export * from './alpha/index.js';
export * from './author/index.js';
export * from './backlink/index.js';
export * from './claiming/index.js';
export * from './discovery/index.js';
export * from './endorsement/index.js';
export * from './governance/index.js';
export * from './graph/index.js';
export * from './import/index.js';
export * from './metrics/index.js';
export * from './eprint/index.js';
export * from './review/index.js';
export * from './sync/index.js';
export * from './tag/index.js';
export * from './notification/index.js';

// Import methods for registration
import { activityMethods } from './activity/index.js';
import { actorMethods } from './actor/index.js';
import { alphaMethods } from './alpha/index.js';
import { authorMethods } from './author/index.js';
import { backlinkMethods } from './backlink/index.js';
import { claimingMethods, claimingRestEndpoints } from './claiming/index.js';
import { discoveryMethods } from './discovery/index.js';
import { endorsementMethods } from './endorsement/index.js';
import { eprintMethods } from './eprint/index.js';
import { governanceMethods } from './governance/index.js';
import { graphMethods } from './graph/index.js';
import { importMethods } from './import/index.js';
import { metricsMethods } from './metrics/index.js';
import { notificationMethods } from './notification/index.js';
import { reviewMethods } from './review/index.js';
import { syncMethods } from './sync/index.js';
import { tagMethods } from './tag/index.js';

/**
 * All XRPC methods keyed by NSID.
 */
export const allXRPCMethods = {
  ...activityMethods,
  ...actorMethods,
  ...alphaMethods,
  ...authorMethods,
  ...backlinkMethods,
  ...claimingMethods,
  ...discoveryMethods,
  ...endorsementMethods,
  ...eprintMethods,
  ...governanceMethods,
  ...graphMethods,
  ...importMethods,
  ...metricsMethods,
  ...notificationMethods,
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
  // Create XRPC router with lexicon validation
  const xrpc = createXRPCRouter(lexicons, { validateOutput: false });

  // Apply XRPC error handler to the router for ATProto-compliant error responses
  xrpc.router.onError(xrpcErrorHandler);

  // Register all XRPC methods using the router's method() function
  for (const [nsid, method] of Object.entries(allXRPCMethods)) {
    // Determine method type from lexicon or fallback to handler's type property
    const methodType = getMethodType(nsid) ?? method.type ?? 'query';

    // Register method with the XRPC router (adds lexicon validation)
    // Type assertion needed due to generic type variance in XRPCMethod
    xrpc.method(nsid, {
      ...method,
      type: methodType,
    } as Parameters<typeof xrpc.method>[1]);
  }

  // Mount XRPC router at /xrpc prefix
  app.route(XRPC_PATH_PREFIX, xrpc.router);

  // Register REST-style endpoints (binary/non-JSON responses) directly on app
  for (const endpoint of claimingRestEndpoints) {
    if (endpoint.method === 'GET') {
      app.get(endpoint.path, endpoint.handler);
    } else if (endpoint.method === 'POST') {
      app.post(endpoint.path, endpoint.handler);
    }
  }
}
