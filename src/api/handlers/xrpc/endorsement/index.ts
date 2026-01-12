/**
 * Endorsement XRPC endpoint exports.
 *
 * @packageDocumentation
 * @public
 */

export {
  listForEprintEndpoint as listEndorsementsForEprintEndpoint,
  listForEprintHandler as listEndorsementsForEprintHandler,
} from './listForEprint.js';
export { getSummaryEndpoint, getSummaryHandler } from './getSummary.js';
export { getUserEndorsementEndpoint, getUserEndorsementHandler } from './getUserEndorsement.js';

import { getSummaryEndpoint } from './getSummary.js';
import { getUserEndorsementEndpoint } from './getUserEndorsement.js';
import { listForEprintEndpoint } from './listForEprint.js';

/**
 * All endorsement XRPC endpoints.
 */
export const endorsementEndpoints = [
  listForEprintEndpoint,
  getSummaryEndpoint,
  getUserEndorsementEndpoint,
] as const;
