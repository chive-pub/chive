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
import { autocompleteEndpoint } from './autocomplete.js';
import { collectEvidenceEndpoint } from './collectEvidence.js';
import { completeClaimEndpoint } from './completeClaim.js';
import { findClaimableEndpoint } from './findClaimable.js';
import { getClaimEndpoint } from './getClaim.js';
import { getPendingClaimsEndpoint } from './getPendingClaims.js';
import { getSuggestionsEndpoint } from './getSuggestions.js';
import { getUserClaimsEndpoint } from './getUserClaims.js';
import { rejectClaimEndpoint } from './rejectClaim.js';
import { searchPreprintsEndpoint } from './searchPreprints.js';
import { startClaimEndpoint } from './startClaim.js';
import { startClaimFromExternalEndpoint } from './startClaimFromExternal.js';

export { startClaimEndpoint, startClaimHandler } from './startClaim.js';
export { collectEvidenceEndpoint, collectEvidenceHandler } from './collectEvidence.js';
export { completeClaimEndpoint, completeClaimHandler } from './completeClaim.js';
export { approveClaimEndpoint, approveClaimHandler } from './approveClaim.js';
export { rejectClaimEndpoint, rejectClaimHandler } from './rejectClaim.js';
export { getClaimEndpoint, getClaimHandler } from './getClaim.js';
export { getUserClaimsEndpoint, getUserClaimsHandler } from './getUserClaims.js';
export { findClaimableEndpoint, findClaimableHandler } from './findClaimable.js';
export { getPendingClaimsEndpoint, getPendingClaimsHandler } from './getPendingClaims.js';
export { searchPreprintsEndpoint, searchPreprintsHandler } from './searchPreprints.js';
export { autocompleteEndpoint, autocompleteHandler } from './autocomplete.js';
export {
  getSuggestionsEndpoint as getClaimSuggestionsEndpoint,
  getSuggestionsHandler as getClaimSuggestionsHandler,
} from './getSuggestions.js';
export {
  startClaimFromExternalEndpoint,
  startClaimFromExternalHandler,
} from './startClaimFromExternal.js';

/**
 * All claiming endpoints.
 *
 * @public
 */
export const claimingEndpoints = [
  startClaimEndpoint,
  collectEvidenceEndpoint,
  completeClaimEndpoint,
  approveClaimEndpoint,
  rejectClaimEndpoint,
  getClaimEndpoint,
  getUserClaimsEndpoint,
  findClaimableEndpoint,
  getPendingClaimsEndpoint,
  searchPreprintsEndpoint,
  autocompleteEndpoint,
  getSuggestionsEndpoint,
  startClaimFromExternalEndpoint,
] as const;
