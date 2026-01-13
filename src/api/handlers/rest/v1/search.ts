/**
 * REST API v1 search endpoint.
 *
 * @remarks
 * Provides a unified search endpoint with query parameters.
 * Delegates to the XRPC search handler.
 *
 * @packageDocumentation
 * @public
 */

import type { Hono } from 'hono';
import type { z } from 'zod';

import { REST_PATH_PREFIX } from '../../../config.js';
import { validateQuery } from '../../../middleware/validation.js';
import { searchEprintsParamsSchema } from '../../../schemas/eprint.js';
import type { ChiveEnv } from '../../../types/context.js';
import { searchSubmissionsHandler } from '../../xrpc/eprint/index.js';

/**
 * Registers REST v1 search routes.
 *
 * @param app - Hono application
 *
 * @remarks
 * Routes:
 * - `GET /api/v1/search` - Search eprints
 *
 * Query parameters:
 * - `q` (required): Search query string
 * - `limit`: Maximum results (default: 50, max: 100)
 * - `cursor`: Pagination cursor
 * - `sort`: Sort order (relevance, date, views)
 * - `field`: Filter by field URI
 * - `author`: Filter by author DID
 * - `license`: Filter by license
 * - `dateFrom`, `dateTo`: Date range filters
 *
 * @example
 * ```http
 * GET /api/v1/search?q=machine+learning&limit=20&sort=relevance
 * ```
 *
 * @public
 */
export function registerSearchRoutes(app: Hono<ChiveEnv>): void {
  const searchPath = `${REST_PATH_PREFIX}/search`;

  // GET /api/v1/search: Search eprints
  app.get(searchPath, validateQuery(searchEprintsParamsSchema), async (c) => {
    const params = c.get('validatedInput') as z.infer<typeof searchEprintsParamsSchema>;
    const result = await searchSubmissionsHandler(c, params);
    return c.json(result);
  });
}
