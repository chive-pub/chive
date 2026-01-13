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
import { z } from 'zod';

import { REST_PATH_PREFIX } from '../../../config.js';
import { validateQuery, validateParams } from '../../../middleware/validation.js';
import { getSubmissionParamsSchema, listByAuthorParamsSchema } from '../../../schemas/eprint.js';
import { searchEprintsParamsSchema } from '../../../schemas/eprint.js';
import type { ChiveEnv } from '../../../types/context.js';
import {
  getSubmissionHandler,
  listByAuthorHandler,
  searchSubmissionsHandler,
} from '../../xrpc/eprint/index.js';

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
  app.get(basePath, validateQuery(searchEprintsParamsSchema), async (c) => {
    const params = c.get('validatedInput') as z.infer<typeof searchEprintsParamsSchema>;
    const result = await searchSubmissionsHandler(c, params);
    return c.json(result);
  });

  // GET /api/v1/eprints/:uri: Get eprint by URI
  app.get(`${basePath}/:uri`, validateParams(uriPathParamSchema), async (c) => {
    const pathParams = c.get('validatedInput') as z.infer<typeof uriPathParamSchema>;
    // Decode URL-encoded URI
    const decodedUri = decodeURIComponent(pathParams.uri);
    const params = getSubmissionParamsSchema.parse({ uri: decodedUri });
    const result = await getSubmissionHandler(c, params);
    return c.json(result);
  });

  // GET /api/v1/authors/:did/eprints: List eprints by author
  app.get(
    `${authorsPath}/:did/eprints`,
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
