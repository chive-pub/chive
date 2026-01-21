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
import { HTTPException } from 'hono/http-exception';

import type { QueryParams as SearchSubmissionsParams } from '../../../../lexicons/generated/types/pub/chive/eprint/searchSubmissions.js';
import { REST_PATH_PREFIX } from '../../../config.js';
import type { ChiveEnv } from '../../../types/context.js';
import { searchSubmissions } from '../../xrpc/eprint/index.js';

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
 * - `q` (optional): Search query string. If omitted, returns recent eprints (browsing mode)
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
  // Supports browsing mode when q is omitted (returns recent eprints)
  app.get(searchPath, async (c) => {
    const query = c.req.query();

    // Parse limit with default
    const limit = query.limit ? parseInt(query.limit, 10) : 20;
    if (isNaN(limit) || limit < 1 || limit > 100) {
      throw new HTTPException(400, { message: 'Invalid limit: must be 1-100' });
    }

    // Parse fieldUris from comma-separated string or array
    const fieldUris = query.fieldUris
      ? Array.isArray(query.fieldUris)
        ? query.fieldUris
        : query.fieldUris.split(',')
      : undefined;

    const params: SearchSubmissionsParams = {
      q: query.q,
      limit,
      cursor: query.cursor,
      author: query.author,
      fieldUris,
      topicUris: query.topicUris
        ? Array.isArray(query.topicUris)
          ? query.topicUris
          : query.topicUris.split(',')
        : undefined,
      facetUris: query.facetUris
        ? Array.isArray(query.facetUris)
          ? query.facetUris
          : query.facetUris.split(',')
        : undefined,
      paperTypeUri: query.paperTypeUri,
      publicationStatusUri: query.publicationStatusUri,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    };

    const user = c.get('user');
    const auth = user ? { did: user.did, iss: user.did } : null;
    const result = await searchSubmissions.handler({ params, input: undefined, auth, c });
    return c.json(result.body);
  });
}
