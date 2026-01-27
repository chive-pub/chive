/**
 * Endorsement XRPC method exports.
 *
 * @packageDocumentation
 * @public
 */

import { getSummary } from './getSummary.js';
import { getUserEndorsement } from './getUserEndorsement.js';
import { listForAuthorPapers } from './listForAuthorPapers.js';
import { listForEprint } from './listForEprint.js';
import { listForUser } from './listForUser.js';

export { getSummary as endorsementGetSummary } from './getSummary.js';
export { getUserEndorsement as endorsementGetUserEndorsement } from './getUserEndorsement.js';
export { listForAuthorPapers as endorsementListForAuthorPapers } from './listForAuthorPapers.js';
export { listForEprint as endorsementListForEprint } from './listForEprint.js';
export { listForUser as endorsementListForUser } from './listForUser.js';

/**
 * Endorsement XRPC methods keyed by NSID.
 *
 * @public
 */
export const endorsementMethods = {
  'pub.chive.endorsement.getSummary': getSummary,
  'pub.chive.endorsement.getUserEndorsement': getUserEndorsement,
  'pub.chive.endorsement.listForAuthorPapers': listForAuthorPapers,
  'pub.chive.endorsement.listForEprint': listForEprint,
  'pub.chive.endorsement.listForUser': listForUser,
} as const;
