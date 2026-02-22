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

import { AuthenticationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * Query parameters for pub.chive.graph.listPersonalEdgeTypes (none required).
 *
 * @public
 */
export type ListPersonalEdgeTypesParams = Record<string, never>;

/**
 * Output schema for pub.chive.graph.listPersonalEdgeTypes.
 *
 * @public
 */
export interface ListPersonalEdgeTypesOutput {
  /** Distinct relation slug strings used in the user's personal edges. */
  relationTypes: string[];
}

/**
 * XRPC method for pub.chive.graph.listPersonalEdgeTypes query.
 *
 * @public
 */
export const listPersonalEdgeTypes: XRPCMethod<
  ListPersonalEdgeTypesParams,
  void,
  ListPersonalEdgeTypesOutput
> = {
  auth: true,
  handler: async ({ c }): Promise<XRPCResponse<ListPersonalEdgeTypesOutput>> => {
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

    const response: ListPersonalEdgeTypesOutput = {
      relationTypes,
    };

    logger.info('Personal edge types listed', {
      did: user.did,
      count: relationTypes.length,
    });

    return { encoding: 'application/json', body: response };
  },
};
