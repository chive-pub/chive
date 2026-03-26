/**
 * REST API v1 route exports.
 *
 * @packageDocumentation
 * @public
 */

import type { Hono } from 'hono';

import type { ChiveEnv } from '../../../types/context.js';

import { registerEprintRoutes } from './eprints.js';
import { registerIntegrationRoutes } from './integrations.js';
import { registerOrcidAuthRoutes } from './orcid-auth.js';
import { registerSearchRoutes } from './search.js';

/**
 * Registers all REST API v1 routes.
 *
 * @param app - Hono application
 *
 * @public
 */
export function registerV1Routes(app: Hono<ChiveEnv>): void {
  registerEprintRoutes(app);
  registerSearchRoutes(app);
  registerIntegrationRoutes(app);
  registerOrcidAuthRoutes(app);
}

export { registerEprintRoutes } from './eprints.js';
export { registerIntegrationRoutes } from './integrations.js';
export { registerOrcidAuthRoutes } from './orcid-auth.js';
export { registerSearchRoutes } from './search.js';
