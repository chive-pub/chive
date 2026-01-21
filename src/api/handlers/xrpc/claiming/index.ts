/**
 * Claiming XRPC methods.
 *
 * @remarks
 * Exports all claiming-related XRPC method definitions as a map keyed by NSID.
 *
 * @packageDocumentation
 * @public
 */

import type { XRPCMethod } from '../../../xrpc/types.js';

import { approveClaim } from './approveClaim.js';
import { approveCoauthor } from './approveCoauthor.js';
import { autocomplete } from './autocomplete.js';
import { completeClaim } from './completeClaim.js';
import { fetchExternalPdfEndpoint } from './fetchExternalPdf.js';
import { findClaimable } from './findClaimable.js';
import { getClaim } from './getClaim.js';
import { getCoauthorRequests } from './getCoauthorRequests.js';
import { getMyCoauthorRequests } from './getMyCoauthorRequests.js';
import { getPendingClaims } from './getPendingClaims.js';
import { getSubmissionData } from './getSubmissionData.js';
import { getSuggestions } from './getSuggestions.js';
import { getUserClaims } from './getUserClaims.js';
import { rejectClaim } from './rejectClaim.js';
import { rejectCoauthor } from './rejectCoauthor.js';
import { requestCoauthorship } from './requestCoauthorship.js';
import { searchEprints } from './searchEprints.js';
import { startClaim } from './startClaim.js';
import { startClaimFromExternal } from './startClaimFromExternal.js';

// Re-export individual methods for direct import
export { approveClaim } from './approveClaim.js';
export { approveCoauthor } from './approveCoauthor.js';
export { autocomplete } from './autocomplete.js';
export { completeClaim } from './completeClaim.js';
export { findClaimable } from './findClaimable.js';
export { getClaim } from './getClaim.js';
export { getCoauthorRequests } from './getCoauthorRequests.js';
export { getMyCoauthorRequests } from './getMyCoauthorRequests.js';
export { getPendingClaims } from './getPendingClaims.js';
export { getSubmissionData } from './getSubmissionData.js';
export { getSuggestions } from './getSuggestions.js';
export { getUserClaims } from './getUserClaims.js';
export { rejectClaim } from './rejectClaim.js';
export { rejectCoauthor } from './rejectCoauthor.js';
export { requestCoauthorship } from './requestCoauthorship.js';
export { searchEprints } from './searchEprints.js';
export { startClaim } from './startClaim.js';
export { startClaimFromExternal } from './startClaimFromExternal.js';

// REST endpoint for binary data (PDF proxy)
export { fetchExternalPdfEndpoint, fetchExternalPdfHandler } from './fetchExternalPdf.js';

/**
 * All claiming XRPC methods keyed by NSID.
 *
 * @public
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const claimingMethods: Record<string, XRPCMethod<any, any, any>> = {
  'pub.chive.claiming.approveClaim': approveClaim,
  'pub.chive.claiming.approveCoauthor': approveCoauthor,
  'pub.chive.claiming.autocomplete': autocomplete,
  'pub.chive.claiming.completeClaim': completeClaim,
  'pub.chive.claiming.findClaimable': findClaimable,
  'pub.chive.claiming.getClaim': getClaim,
  'pub.chive.claiming.getCoauthorRequests': getCoauthorRequests,
  'pub.chive.claiming.getMyCoauthorRequests': getMyCoauthorRequests,
  'pub.chive.claiming.getPendingClaims': getPendingClaims,
  'pub.chive.claiming.getSubmissionData': getSubmissionData,
  'pub.chive.claiming.getSuggestions': getSuggestions,
  'pub.chive.claiming.getUserClaims': getUserClaims,
  'pub.chive.claiming.rejectClaim': rejectClaim,
  'pub.chive.claiming.rejectCoauthor': rejectCoauthor,
  'pub.chive.claiming.requestCoauthorship': requestCoauthorship,
  'pub.chive.claiming.searchEprints': searchEprints,
  'pub.chive.claiming.startClaim': startClaim,
  'pub.chive.claiming.startClaimFromExternal': startClaimFromExternal,
};

/**
 * REST endpoints for claiming (binary data handlers).
 *
 * @public
 */
export const claimingRestEndpoints = [fetchExternalPdfEndpoint] as const;
