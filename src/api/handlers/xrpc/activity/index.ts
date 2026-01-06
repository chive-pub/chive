/**
 * Activity XRPC handlers index.
 *
 * @packageDocumentation
 * @public
 */

export { logActivityEndpoint, logActivityHandler } from './logActivity.js';
export { markFailedEndpoint, markFailedHandler } from './markFailed.js';
export { getActivityFeedEndpoint, getActivityFeedHandler } from './getActivityFeed.js';
export {
  getCorrelationMetricsEndpoint,
  getCorrelationMetricsHandler,
} from './getCorrelationMetrics.js';

import { getActivityFeedEndpoint } from './getActivityFeed.js';
import { getCorrelationMetricsEndpoint } from './getCorrelationMetrics.js';
import { logActivityEndpoint } from './logActivity.js';
import { markFailedEndpoint } from './markFailed.js';

/**
 * All activity XRPC endpoints.
 *
 * @public
 */
export const activityEndpoints = [
  logActivityEndpoint,
  markFailedEndpoint,
  getActivityFeedEndpoint,
  getCorrelationMetricsEndpoint,
] as const;
