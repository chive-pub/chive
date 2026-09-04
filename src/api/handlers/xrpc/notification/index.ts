/**
 * Notification XRPC method exports.
 *
 * @packageDocumentation
 * @public
 */

export { listReviewsOnMyPapers } from './listReviewsOnMyPapers.js';
export { listEndorsementsOnMyPapers } from './listEndorsementsOnMyPapers.js';
export { listFollowers } from './listFollowers.js';
export { listCollectionAdds } from './listCollectionAdds.js';

import { listCollectionAdds } from './listCollectionAdds.js';
import { listEndorsementsOnMyPapers } from './listEndorsementsOnMyPapers.js';
import { listFollowers } from './listFollowers.js';
import { listReviewsOnMyPapers } from './listReviewsOnMyPapers.js';

/**
 * All notification XRPC methods keyed by NSID.
 */
export const notificationMethods = {
  'pub.chive.notification.listReviewsOnMyPapers': listReviewsOnMyPapers,
  'pub.chive.notification.listEndorsementsOnMyPapers': listEndorsementsOnMyPapers,
  'pub.chive.notification.listFollowers': listFollowers,
  'pub.chive.notification.listCollectionAdds': listCollectionAdds,
} as const;
