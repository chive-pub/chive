/**
 * Route registration for Chive API.
 *
 * @remarks
 * Aggregates and registers all API routes:
 * - XRPC endpoints (`/xrpc/*`)
 * - REST endpoints (`/api/v1/*`)
 * - Health check endpoints (`/health`, `/ready`)
 * - OpenAPI documentation (`/openapi.json`, `/docs`)
 *
 * @packageDocumentation
 * @public
 */

import type { Hono } from 'hono';

import { registerRESTRoutes } from './handlers/rest/index.js';
import { registerXRPCRoutes } from './handlers/xrpc/index.js';
import { registerOpenAPIRoutes } from './openapi/index.js';
import type { ChiveEnv } from './types/context.js';

/**
 * Registers all API routes on a Hono application.
 *
 * @param app - Hono application instance
 *
 * @remarks
 * Route groups:
 * - `/xrpc/{nsid}` - ATProto XRPC endpoints
 * - `/api/v1/*` - REST API v1 endpoints
 * - `/health`, `/ready` - Health check endpoints
 *
 * @example
 * ```typescript
 * const app = new Hono<ChiveEnv>();
 * registerRoutes(app);
 * ```
 *
 * @public
 */
export function registerRoutes(app: Hono<ChiveEnv>): void {
  // Register XRPC routes (ATProto standard)
  registerXRPCRoutes(app);

  // Register REST routes (compatibility layer + health)
  registerRESTRoutes(app);

  // Register OpenAPI documentation routes (/openapi.json, /docs)
  registerOpenAPIRoutes(app);
}
