/**
 * REST API v1 route exports.
 *
 * @packageDocumentation
 * @public
 */

import type { Hono } from 'hono';

import type { ChiveEnv } from '../../../types/context.js';

import { registerIntegrationRoutes } from './integrations.js';
import { registerPreprintRoutes } from './preprints.js';
import { registerSearchRoutes } from './search.js';

/**
 * Registers all REST API v1 routes.
 *
 * @param app - Hono application
 *
 * @public
 */
export function registerV1Routes(app: Hono<ChiveEnv>): void {
  registerPreprintRoutes(app);
  registerSearchRoutes(app);
  registerIntegrationRoutes(app);
}

export { registerIntegrationRoutes } from './integrations.js';
export { registerPreprintRoutes } from './preprints.js';
export { registerSearchRoutes } from './search.js';
