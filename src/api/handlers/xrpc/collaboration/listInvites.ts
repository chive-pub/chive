/**
 * XRPC handler for pub.chive.collaboration.listInvites.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/collaboration/listInvites.js';
import type { AtUri, DID } from '../../../../types/atproto.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/** Re-exported params. */
export type ListInvitesParams = QueryParams;

/** Re-exported output. */
export type ListInvitesOutput = OutputSchema;

/**
 * XRPC method for pub.chive.collaboration.listInvites query.
 *
 * @public
 */
export const listInvites: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: 'optional',
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const { collaborationService } = c.get('services');
    if (!collaborationService) {
      return { encoding: 'application/json', body: { invites: [] } };
    }

    const result = await collaborationService.listInvites({
      invitee: params.invitee as DID | undefined,
      inviter: params.inviter as DID | undefined,
      subjectUri: params.subjectUri as AtUri | undefined,
      subjectCollection: params.subjectCollection,
      state: params.state as 'pending' | 'accepted' | 'rejected' | 'expired' | 'all' | undefined,
      limit: params.limit,
      cursor: params.cursor,
    });

    return {
      encoding: 'application/json',
      body: {
        invites: result.invites.map((inv) => ({
          uri: inv.uri,
          inviter: inv.inviter,
          invitee: inv.invitee,
          subjectUri: inv.subjectUri,
          subjectCollection: inv.subjectCollection,
          role: inv.role,
          message: inv.message,
          state: inv.state,
          acceptanceUri: inv.acceptanceUri,
          createdAt: inv.createdAt.toISOString(),
          expiresAt: inv.expiresAt?.toISOString(),
          acceptedAt: inv.acceptedAt?.toISOString(),
        })),
        cursor: result.cursor,
        hasMore: result.hasMore,
        total: result.total,
      },
    };
  },
};
