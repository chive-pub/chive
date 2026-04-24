/**
 * XRPC handler for pub.chive.collaboration.listCollaborators.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/collaboration/listCollaborators.js';
import type { AtUri } from '../../../../types/atproto.js';
import { ValidationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/** Re-exported params. */
export type ListCollaboratorsParams = QueryParams;

/** Re-exported output. */
export type ListCollaboratorsOutput = OutputSchema;

/**
 * XRPC method for pub.chive.collaboration.listCollaborators query.
 *
 * @public
 */
export const listCollaborators: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: 'optional',
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const { collaborationService } = c.get('services');
    if (!params.subjectUri) {
      throw new ValidationError('Missing subjectUri', 'subjectUri');
    }

    if (!collaborationService) {
      return { encoding: 'application/json', body: { collaborators: [] } };
    }

    const collaborators = await collaborationService.getActiveCollaborators(
      params.subjectUri as AtUri
    );

    return {
      encoding: 'application/json',
      body: {
        collaborators: collaborators.map((c) => ({
          did: c.did,
          inviteUri: c.inviteUri,
          acceptanceUri: c.acceptanceUri,
          role: c.role,
          acceptedAt: c.acceptedAt.toISOString(),
        })),
      },
    };
  },
};
