/**
 * Endorsement XRPC endpoint exports.
 *
 * @packageDocumentation
 * @public
 */

export {
  listForPreprintEndpoint as listEndorsementsForPreprintEndpoint,
  listForPreprintHandler as listEndorsementsForPreprintHandler,
} from './listForPreprint.js';
export { getSummaryEndpoint, getSummaryHandler } from './getSummary.js';
export { getUserEndorsementEndpoint, getUserEndorsementHandler } from './getUserEndorsement.js';

import { getSummaryEndpoint } from './getSummary.js';
import { getUserEndorsementEndpoint } from './getUserEndorsement.js';
import { listForPreprintEndpoint } from './listForPreprint.js';

/**
 * All endorsement XRPC endpoints.
 */
export const endorsementEndpoints = [
  listForPreprintEndpoint,
  getSummaryEndpoint,
  getUserEndorsementEndpoint,
] as const;
