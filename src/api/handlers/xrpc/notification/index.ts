/**
 * Notification XRPC endpoint exports.
 *
 * @packageDocumentation
 * @public
 */

export {
  listReviewsOnMyPapersEndpoint,
  listReviewsOnMyPapersHandler,
} from './listReviewsOnMyPapers.js';

export {
  listEndorsementsOnMyPapersEndpoint,
  listEndorsementsOnMyPapersHandler,
} from './listEndorsementsOnMyPapers.js';

import { listEndorsementsOnMyPapersEndpoint } from './listEndorsementsOnMyPapers.js';
import { listReviewsOnMyPapersEndpoint } from './listReviewsOnMyPapers.js';

/**
 * All notification XRPC endpoints.
 */
export const notificationEndpoints = [
  listReviewsOnMyPapersEndpoint,
  listEndorsementsOnMyPapersEndpoint,
] as const;
