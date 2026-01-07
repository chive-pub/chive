/**
 * XRPC handler exports and route registration.
 *
 * @remarks
 * Aggregates all XRPC endpoints and provides route registration
 * for the Hono application.
 *
 * @packageDocumentation
 * @public
 */

import type { Hono } from 'hono';

import { XRPC_PATH_PREFIX } from '../../config.js';
import { validateQuery, validateBody } from '../../middleware/validation.js';
import type { ChiveEnv } from '../../types/context.js';

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
export * from './preprint/index.js';
export * from './review/index.js';
export * from './sync/index.js';
export * from './tag/index.js';

// Import endpoints for registration
import { activityEndpoints } from './activity/index.js';
import { actorEndpoints } from './actor/index.js';
import { alphaEndpoints } from './alpha/index.js';
import { authorEndpoints } from './author/index.js';
import { backlinkEndpoints } from './backlink/index.js';
import { claimingEndpoints } from './claiming/index.js';
import { discoveryEndpoints } from './discovery/index.js';
import { endorsementEndpoints } from './endorsement/index.js';
import { governanceEndpoints } from './governance/index.js';
import { graphEndpoints } from './graph/index.js';
import { importEndpoints } from './import/index.js';
import { metricsEndpoints } from './metrics/index.js';
import { preprintEndpoints } from './preprint/index.js';
import { reviewEndpoints } from './review/index.js';
import { syncEndpoints } from './sync/index.js';
import { tagEndpoints } from './tag/index.js';

/**
 * All XRPC endpoints.
 */
export const allXRPCEndpoints = [
  ...activityEndpoints,
  ...actorEndpoints,
  ...alphaEndpoints,
  ...authorEndpoints,
  ...backlinkEndpoints,
  ...claimingEndpoints,
  ...discoveryEndpoints,
  ...endorsementEndpoints,
  ...governanceEndpoints,
  ...graphEndpoints,
  ...importEndpoints,
  ...metricsEndpoints,
  ...preprintEndpoints,
  ...reviewEndpoints,
  ...syncEndpoints,
  ...tagEndpoints,
] as const;

/**
 * Registers all XRPC routes on a Hono app.
 *
 * @param app - Hono application instance
 *
 * @remarks
 * Routes are registered at `/xrpc/{nsid}` following ATProto conventions.
 * Query endpoints use GET, procedure endpoints use POST.
 *
 * @example
 * ```typescript
 * const app = new Hono<ChiveEnv>();
 * registerXRPCRoutes(app);
 * // Routes:
 * // GET /xrpc/pub.chive.preprint.getSubmission
 * // GET /xrpc/pub.chive.preprint.searchSubmissions
 * // etc.
 * ```
 *
 * @public
 */
export function registerXRPCRoutes(app: Hono<ChiveEnv>): void {
  for (const endpoint of allXRPCEndpoints) {
    const path = `${XRPC_PATH_PREFIX}/${endpoint.method}`;
    // Cast schema to any to allow dynamic endpoint registration
    // Type safety is maintained by individual endpoint definitions
    const schema = endpoint.inputSchema as Parameters<typeof validateQuery>[0];
    const handler = endpoint.handler as (c: unknown, params: unknown) => Promise<unknown>;

    if (endpoint.type === 'query') {
      app.get(path, validateQuery(schema), async (c) => {
        const input = c.get('validatedInput');
        const result = await handler(c, input);
        return c.json(result);
      });
    } else {
      // Procedure (POST)
      app.post(path, validateBody(schema), async (c) => {
        const input = c.get('validatedInput');
        const result = await handler(c, input);
        return c.json(result);
      });
    }
  }
}
