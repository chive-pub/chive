/**
 * REST API v1 eprint endpoints.
 *
 * @remarks
 * Provides REST-style endpoints that delegate to XRPC handlers.
 * Offers familiar REST patterns for non-ATProto clients.
 *
 * @packageDocumentation
 * @public
 */

import type { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';

import type { QueryParams as GetSubmissionParams } from '../../../../lexicons/generated/types/pub/chive/eprint/getSubmission.js';
import type { QueryParams as ListByAuthorParams } from '../../../../lexicons/generated/types/pub/chive/eprint/listByAuthor.js';
import type { QueryParams as SearchSubmissionsParams } from '../../../../lexicons/generated/types/pub/chive/eprint/searchSubmissions.js';
import { REST_PATH_PREFIX } from '../../../config.js';
import type { ChiveEnv } from '../../../types/context.js';
import { getSubmission, listByAuthor, searchSubmissions } from '../../xrpc/eprint/index.js';

/**
 * Registers REST v1 eprint routes.
 *
 * @param app - Hono application
 *
 * @remarks
 * Routes:
 * - `GET /api/v1/eprints` - Search/list eprints
 * - `GET /api/v1/eprints/:uri` - Get eprint by URI
 * - `GET /api/v1/authors/:did/eprints` - List eprints by author
 *
 * @example
 * ```http
 * GET /api/v1/eprints?q=quantum
 * GET /api/v1/eprints/at%3A%2F%2Fdid%3Aplc%3Aabc%2Fpub.chive.eprint.submission%2Fxyz
 * GET /api/v1/authors/did:plc:abc/eprints
 * ```
 *
 * @public
 */
export function registerEprintRoutes(app: Hono<ChiveEnv>): void {
  const basePath = `${REST_PATH_PREFIX}/eprints`;
  const authorsPath = `${REST_PATH_PREFIX}/authors`;

  // GET /api/v1/eprints: Search eprints
  // Supports browsing mode when q is omitted
  app.get(basePath, async (c) => {
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

  // GET /api/v1/eprints/:uri: Get eprint by URI
  app.get(`${basePath}/:uri`, async (c) => {
    const uriParam = c.req.param('uri');

    if (!uriParam) {
      throw new HTTPException(400, { message: 'Missing required parameter: uri' });
    }

    // Decode URL-encoded URI
    const decodedUri = decodeURIComponent(uriParam);

    // Validate AT URI format
    if (!decodedUri.startsWith('at://')) {
      throw new HTTPException(400, { message: 'Invalid uri: must be an AT URI (at://...)' });
    }

    const params: GetSubmissionParams = {
      uri: decodedUri,
      cid: c.req.query('cid'),
    };

    const user = c.get('user');
    const auth = user ? { did: user.did, iss: user.did } : null;
    const result = await getSubmission.handler({ params, input: undefined, auth, c });
    return c.json(result.body);
  });

  // GET /api/v1/authors/:did/eprints: List eprints by author
  app.get(`${authorsPath}/:did/eprints`, async (c) => {
    const didParam = c.req.param('did');

    // Validate DID parameter
    if (!didParam) {
      throw new HTTPException(400, { message: 'Missing required parameter: did' });
    }

    if (!didParam.startsWith('did:')) {
      throw new HTTPException(400, { message: 'Invalid did: must start with did:' });
    }

    const query = c.req.query();

    // Parse limit with default
    const limit = query.limit ? parseInt(query.limit, 10) : 50;
    if (isNaN(limit) || limit < 1 || limit > 100) {
      throw new HTTPException(400, { message: 'Invalid limit: must be 1-100' });
    }

    // Validate sortBy
    const validSortBy = ['indexedAt', 'publishedAt', 'updatedAt'];
    const sortBy = query.sortBy ?? 'publishedAt';
    if (!validSortBy.includes(sortBy)) {
      throw new HTTPException(400, {
        message: `Invalid sortBy: must be one of ${validSortBy.join(', ')}`,
      });
    }

    // Validate sortOrder
    const validSortOrder = ['asc', 'desc'];
    const sortOrder = query.sortOrder ?? 'desc';
    if (!validSortOrder.includes(sortOrder)) {
      throw new HTTPException(400, {
        message: `Invalid sortOrder: must be one of ${validSortOrder.join(', ')}`,
      });
    }

    const params: ListByAuthorParams = {
      did: didParam,
      limit,
      cursor: query.cursor,
      sortBy: sortBy as ListByAuthorParams['sortBy'],
      sortOrder: sortOrder as ListByAuthorParams['sortOrder'],
    };

    const user = c.get('user');
    const auth = user ? { did: user.did, iss: user.did } : null;
    const result = await listByAuthor.handler({ params, input: undefined, auth, c });
    return c.json(result.body);
  });
}
