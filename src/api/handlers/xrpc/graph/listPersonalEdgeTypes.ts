/**
 * XRPC handler for pub.chive.graph.listPersonalEdgeTypes.
 *
 * @remarks
 * Lists the distinct relation types used in the authenticated user's
 * personal graph edges. Useful for populating filter dropdowns in the UI.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/graph/listPersonalEdgeTypes.js';
import { AuthenticationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/** Re-exported query parameters for pub.chive.graph.listPersonalEdgeTypes. */
export type ListPersonalEdgeTypesParams = QueryParams;

/** Re-exported output schema for pub.chive.graph.listPersonalEdgeTypes. */
export type ListPersonalEdgeTypesOutput = OutputSchema;

/**
 * XRPC method for pub.chive.graph.listPersonalEdgeTypes query.
 *
 * @public
 */
export const listPersonalEdgeTypes: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: true,
  handler: async ({ c }): Promise<XRPCResponse<OutputSchema>> => {
    const { personalGraph } = c.get('services');
    const logger = c.get('logger');
    const user = c.get('user');

    if (!user?.did) {
      throw new AuthenticationError('Authentication required');
    }

    if (!personalGraph) {
      return {
        encoding: 'application/json',
        body: { relationTypes: [] },
      };
    }

    logger.debug('Listing personal edge types', { did: user.did });

    const relationTypes = await personalGraph.listPersonalRelationTypes(user.did);

    const response: OutputSchema = {
      relationTypes,
    };

    logger.info('Personal edge types listed', {
      did: user.did,
      count: relationTypes.length,
    });

    return { encoding: 'application/json', body: response };
  },
};
