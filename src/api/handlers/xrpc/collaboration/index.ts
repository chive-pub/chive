/**
 * XRPC collaboration handler exports.
 *
 * @remarks
 * Generic collaboration (invite / accept / list) endpoints. v1 consumers
 * are collections; the same endpoints will serve eprint co-authorship and
 * collaborative reviews in future iterations.
 *
 * @packageDocumentation
 * @public
 */

import type { XRPCMethod } from '../../../xrpc/types.js';

import { listCollaborators } from './listCollaborators.js';
import { listInvites } from './listInvites.js';

export { listInvites } from './listInvites.js';
export { listCollaborators } from './listCollaborators.js';
export type { ListInvitesParams, ListInvitesOutput } from './listInvites.js';
export type { ListCollaboratorsParams, ListCollaboratorsOutput } from './listCollaborators.js';

/**
 * All collaboration XRPC methods keyed by NSID.
 *
 * @public
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const collaborationMethods: Record<string, XRPCMethod<any, any, any>> = {
  'pub.chive.collaboration.listInvites': listInvites,
  'pub.chive.collaboration.listCollaborators': listCollaborators,
};
