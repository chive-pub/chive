/**
 * XRPC resolve handler exports.
 *
 * @remarks
 * Entity-resolution endpoints mapping external identifiers (DOI, arXiv,
 * ORCID, ROR, ISBN, PMID, Wikidata) to Chive-native entities.
 *
 * @packageDocumentation
 * @public
 */

import type { XRPCMethod } from '../../../xrpc/types.js';

import { byExternalId } from './byExternalId.js';

export { byExternalId } from './byExternalId.js';
export type { ResolveByExternalIdParams, ResolveByExternalIdOutput } from './byExternalId.js';

/**
 * All resolve XRPC methods keyed by NSID.
 *
 * @public
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resolveMethods: Record<string, XRPCMethod<any, any, any>> = {
  'pub.chive.resolve.byExternalId': byExternalId,
};
