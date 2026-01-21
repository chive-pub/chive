/**
 * Notification XRPC method exports.
 *
 * @packageDocumentation
 * @public
 */

export { listReviewsOnMyPapers } from './listReviewsOnMyPapers.js';
export { listEndorsementsOnMyPapers } from './listEndorsementsOnMyPapers.js';

import { listEndorsementsOnMyPapers } from './listEndorsementsOnMyPapers.js';
import { listReviewsOnMyPapers } from './listReviewsOnMyPapers.js';

/**
 * All notification XRPC methods keyed by NSID.
 */
export const notificationMethods = {
  'pub.chive.notification.listReviewsOnMyPapers': listReviewsOnMyPapers,
  'pub.chive.notification.listEndorsementsOnMyPapers': listEndorsementsOnMyPapers,
} as const;
