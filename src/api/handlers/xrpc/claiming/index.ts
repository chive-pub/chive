/**
 * Claiming XRPC endpoints.
 *
 * @remarks
 * Exports all claiming-related XRPC endpoint definitions.
 *
 * @packageDocumentation
 * @public
 */

import { approveClaimEndpoint } from './approveClaim.js';
import { approveCoauthorEndpoint } from './approveCoauthor.js';
import { autocompleteEndpoint } from './autocomplete.js';
import { completeClaimEndpoint } from './completeClaim.js';
import { fetchExternalPdfEndpoint } from './fetchExternalPdf.js';
import { findClaimableEndpoint } from './findClaimable.js';
import { getClaimEndpoint } from './getClaim.js';
import { getCoauthorRequestsEndpoint } from './getCoauthorRequests.js';
import { getMyCoauthorRequestsEndpoint } from './getMyCoauthorRequests.js';
import { getPendingClaimsEndpoint } from './getPendingClaims.js';
import { getSubmissionDataEndpoint } from './getSubmissionData.js';
import { getSuggestionsEndpoint } from './getSuggestions.js';
import { getUserClaimsEndpoint } from './getUserClaims.js';
import { rejectClaimEndpoint } from './rejectClaim.js';
import { rejectCoauthorEndpoint } from './rejectCoauthor.js';
import { requestCoauthorshipEndpoint } from './requestCoauthorship.js';
import { searchEprintsEndpoint } from './searchEprints.js';
import { startClaimEndpoint } from './startClaim.js';
import { startClaimFromExternalEndpoint } from './startClaimFromExternal.js';

export { startClaimEndpoint, startClaimHandler } from './startClaim.js';
export { completeClaimEndpoint, completeClaimHandler } from './completeClaim.js';
export { approveClaimEndpoint, approveClaimHandler } from './approveClaim.js';
export { rejectClaimEndpoint, rejectClaimHandler } from './rejectClaim.js';
export { getClaimEndpoint, getClaimHandler } from './getClaim.js';
export { getUserClaimsEndpoint, getUserClaimsHandler } from './getUserClaims.js';
export { findClaimableEndpoint, findClaimableHandler } from './findClaimable.js';
export { getPendingClaimsEndpoint, getPendingClaimsHandler } from './getPendingClaims.js';
export { searchEprintsEndpoint, searchEprintsHandler } from './searchEprints.js';
export { autocompleteEndpoint, autocompleteHandler } from './autocomplete.js';
export {
  getSuggestionsEndpoint as getClaimSuggestionsEndpoint,
  getSuggestionsHandler as getClaimSuggestionsHandler,
} from './getSuggestions.js';
export {
  startClaimFromExternalEndpoint,
  startClaimFromExternalHandler,
} from './startClaimFromExternal.js';
export { getSubmissionDataEndpoint, getSubmissionDataHandler } from './getSubmissionData.js';
export type { GetSubmissionDataParams, GetSubmissionDataResponse } from './getSubmissionData.js';
// REST endpoint for binary data (PDF proxy)
export { fetchExternalPdfEndpoint, fetchExternalPdfHandler } from './fetchExternalPdf.js';

// Co-author claim exports
export { requestCoauthorshipEndpoint, requestCoauthorshipHandler } from './requestCoauthorship.js';
export { getCoauthorRequestsEndpoint, getCoauthorRequestsHandler } from './getCoauthorRequests.js';
export {
  getMyCoauthorRequestsEndpoint,
  getMyCoauthorRequestsHandler,
} from './getMyCoauthorRequests.js';
export { approveCoauthorEndpoint, approveCoauthorHandler } from './approveCoauthor.js';
export { rejectCoauthorEndpoint, rejectCoauthorHandler } from './rejectCoauthor.js';

/**
 * All claiming endpoints.
 *
 * @public
 */
export const claimingEndpoints = [
  startClaimEndpoint,
  completeClaimEndpoint,
  approveClaimEndpoint,
  rejectClaimEndpoint,
  getClaimEndpoint,
  getUserClaimsEndpoint,
  findClaimableEndpoint,
  getPendingClaimsEndpoint,
  searchEprintsEndpoint,
  autocompleteEndpoint,
  getSuggestionsEndpoint,
  startClaimFromExternalEndpoint,
  getSubmissionDataEndpoint,
  // Co-author claim endpoints
  requestCoauthorshipEndpoint,
  getCoauthorRequestsEndpoint,
  getMyCoauthorRequestsEndpoint,
  approveCoauthorEndpoint,
  rejectCoauthorEndpoint,
] as const;

/**
 * REST endpoints for claiming (binary data handlers).
 *
 * @public
 */
export const claimingRestEndpoints = [fetchExternalPdfEndpoint] as const;
