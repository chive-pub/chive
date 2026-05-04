/**
 * XRPC handler for pub.chive.collaboration.listInvites.
 *
 * @remarks
 * Authorization: requires authentication and scopes the result to invites
 * the caller is a party to. The query must satisfy at least one of:
 * - `invitee` equals the caller's DID (inbox view)
 * - `inviter` equals the caller's DID (sent dashboard)
 * - `subjectUri` is authored by the caller (subject owner viewing invites)
 *
 * Without this gate, anyone could enumerate invites for any DID or subject.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/collaboration/listInvites.js';
import type { AtUri, DID } from '../../../../types/atproto.js';
import { AuthenticationError, AuthorizationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/** Re-exported params. */
export type ListInvitesParams = QueryParams;

/** Re-exported output. */
export type ListInvitesOutput = OutputSchema;

/**
 * Extracts the authoring DID from an AT-URI's authority component.
 */
function authorityFromAtUri(uri: string): string | null {
  const match = /^at:\/\/([^/]+)\//.exec(uri);
  return match?.[1] ?? null;
}

/**
 * XRPC method for pub.chive.collaboration.listInvites query.
 *
 * @public
 */
export const listInvites: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: true,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const { collaborationService } = c.get('services');
    const user = c.get('user');

    if (!user) {
      throw new AuthenticationError('Authentication required');
    }

    const inviteeParam = params.invitee as DID | undefined;
    const inviterParam = params.inviter as DID | undefined;
    const subjectUriParam = params.subjectUri as AtUri | undefined;

    const isInviteeMe = inviteeParam !== undefined && inviteeParam === user.did;
    const isInviterMe = inviterParam !== undefined && inviterParam === user.did;
    const isSubjectMine =
      subjectUriParam !== undefined && authorityFromAtUri(subjectUriParam) === user.did;

    if (!isInviteeMe && !isInviterMe && !isSubjectMine) {
      throw new AuthorizationError(
        'Query must be scoped to the caller (invitee, inviter, or subject owner)'
      );
    }

    if (!collaborationService) {
      return { encoding: 'application/json', body: { invites: [] } };
    }

    const result = await collaborationService.listInvites({
      invitee: inviteeParam,
      inviter: inviterParam,
      subjectUri: subjectUriParam,
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
