/**
 * Activity XRPC handlers index.
 *
 * @packageDocumentation
 * @public
 */

import { getActivityFeed } from './getActivityFeed.js';
import { getCorrelationMetrics } from './getCorrelationMetrics.js';
import { logActivity } from './logActivity.js';
import { markFailed } from './markFailed.js';

export { getActivityFeed } from './getActivityFeed.js';
export { getCorrelationMetrics } from './getCorrelationMetrics.js';
export { logActivity } from './logActivity.js';
export { markFailed } from './markFailed.js';

/**
 * Activity XRPC methods keyed by NSID.
 *
 * @public
 */
export const activityMethods = {
  'pub.chive.activity.log': logActivity,
  'pub.chive.activity.markFailed': markFailed,
  'pub.chive.activity.getFeed': getActivityFeed,
  'pub.chive.activity.getCorrelationMetrics': getCorrelationMetrics,
} as const;
