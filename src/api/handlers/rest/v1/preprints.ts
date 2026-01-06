/**
 * REST API v1 preprint endpoints.
 *
 * @remarks
 * Provides REST-style endpoints that delegate to XRPC handlers.
 * Offers familiar REST patterns for non-ATProto clients.
 *
 * @packageDocumentation
 * @public
 */

import type { Hono } from 'hono';
import { z } from 'zod';

import { REST_PATH_PREFIX } from '../../../config.js';
import { validateQuery, validateParams } from '../../../middleware/validation.js';
import { getSubmissionParamsSchema, listByAuthorParamsSchema } from '../../../schemas/preprint.js';
import { searchPreprintsParamsSchema } from '../../../schemas/preprint.js';
import type { ChiveEnv } from '../../../types/context.js';
import {
  getSubmissionHandler,
  listByAuthorHandler,
  searchSubmissionsHandler,
} from '../../xrpc/preprint/index.js';

/**
 * URI path parameter schema.
 */
const uriPathParamSchema = z.object({
  uri: z.string().describe('URL-encoded AT URI'),
});

/**
 * DID path parameter schema.
 */
const didPathParamSchema = z.object({
  did: z.string().startsWith('did:').describe('Author DID'),
});

/**
 * Registers REST v1 preprint routes.
 *
 * @param app - Hono application
 *
 * @remarks
 * Routes:
 * - `GET /api/v1/preprints` - Search/list preprints
 * - `GET /api/v1/preprints/:uri` - Get preprint by URI
 * - `GET /api/v1/authors/:did/preprints` - List preprints by author
 *
 * @example
 * ```http
 * GET /api/v1/preprints?q=quantum
 * GET /api/v1/preprints/at%3A%2F%2Fdid%3Aplc%3Aabc%2Fpub.chive.preprint.submission%2Fxyz
 * GET /api/v1/authors/did:plc:abc/preprints
 * ```
 *
 * @public
 */
export function registerPreprintRoutes(app: Hono<ChiveEnv>): void {
  const basePath = `${REST_PATH_PREFIX}/preprints`;
  const authorsPath = `${REST_PATH_PREFIX}/authors`;

  // GET /api/v1/preprints: Search preprints
  app.get(basePath, validateQuery(searchPreprintsParamsSchema), async (c) => {
    const params = c.get('validatedInput') as z.infer<typeof searchPreprintsParamsSchema>;
    const result = await searchSubmissionsHandler(c, params);
    return c.json(result);
  });

  // GET /api/v1/preprints/:uri: Get preprint by URI
  app.get(`${basePath}/:uri`, validateParams(uriPathParamSchema), async (c) => {
    const pathParams = c.get('validatedInput') as z.infer<typeof uriPathParamSchema>;
    // Decode URL-encoded URI
    const decodedUri = decodeURIComponent(pathParams.uri);
    const params = getSubmissionParamsSchema.parse({ uri: decodedUri });
    const result = await getSubmissionHandler(c, params);
    return c.json(result);
  });

  // GET /api/v1/authors/:did/preprints: List preprints by author
  app.get(
    `${authorsPath}/:did/preprints`,
    validateParams(didPathParamSchema),
    validateQuery(listByAuthorParamsSchema.omit({ did: true })),
    async (c) => {
      const pathParams = c.req.param() as { did: string };
      const queryParams = c.get('validatedInput') as Omit<
        z.infer<typeof listByAuthorParamsSchema>,
        'did'
      >;

      const params = {
        ...queryParams,
        did: pathParams.did,
      };

      const result = await listByAuthorHandler(
        c,
        params as z.infer<typeof listByAuthorParamsSchema>
      );
      return c.json(result);
    }
  );
}
