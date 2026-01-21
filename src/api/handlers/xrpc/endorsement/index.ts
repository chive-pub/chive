/**
 * Endorsement XRPC method exports.
 *
 * @packageDocumentation
 * @public
 */

import { getSummary } from './getSummary.js';
import { getUserEndorsement } from './getUserEndorsement.js';
import { listForEprint } from './listForEprint.js';

export { getSummary as endorsementGetSummary } from './getSummary.js';
export { getUserEndorsement as endorsementGetUserEndorsement } from './getUserEndorsement.js';
export { listForEprint as endorsementListForEprint } from './listForEprint.js';

/**
 * Endorsement XRPC methods keyed by NSID.
 *
 * @public
 */
export const endorsementMethods = {
  'pub.chive.endorsement.getSummary': getSummary,
  'pub.chive.endorsement.getUserEndorsement': getUserEndorsement,
  'pub.chive.endorsement.listForEprint': listForEprint,
} as const;
