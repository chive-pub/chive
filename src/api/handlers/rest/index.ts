/**
 * REST handler exports and route registration.
 *
 * @packageDocumentation
 * @public
 */

import type { Hono } from 'hono';

import type { ChiveEnv } from '../../types/context.js';

import { registerHealthRoutes } from './health.js';
import { registerV1Routes } from './v1/index.js';
import { registerWellKnownRoutes } from './well-known.js';

/**
 * Registers all REST routes on a Hono app.
 *
 * @param app - Hono application instance
 *
 * @remarks
 * Registers:
 * - Health check routes (`/health`, `/ready`)
 * - Well-known routes (`/.well-known/*`)
 * - REST API v1 routes (`/api/v1/*`)
 *
 * @public
 */
export function registerRESTRoutes(app: Hono<ChiveEnv>): void {
  registerHealthRoutes(app);
  registerWellKnownRoutes(app);
  registerV1Routes(app);
}

export { registerHealthRoutes, livenessHandler, readinessHandler } from './health.js';
export { registerWellKnownRoutes, standardPublicationHandler } from './well-known.js';
export { registerV1Routes } from './v1/index.js';
