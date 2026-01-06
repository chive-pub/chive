/**
 * XRPC metrics handler exports.
 *
 * @packageDocumentation
 * @public
 */

import { getMetricsEndpoint } from './getMetrics.js';
import { getTrendingEndpoint } from './getTrending.js';
import { getViewCountEndpoint } from './getViewCount.js';
import { recordDownloadEndpoint } from './recordDownload.js';
import { recordDwellTimeEndpoint } from './recordDwellTime.js';
import { recordSearchClickEndpoint } from './recordSearchClick.js';
import { recordSearchDownloadEndpoint } from './recordSearchDownload.js';
import { recordViewEndpoint } from './recordView.js';

export {
  getTrendingHandler,
  getTrendingEndpoint,
  getTrendingParamsSchema,
  getTrendingResponseSchema,
  type GetTrendingParams,
  type GetTrendingResponse,
} from './getTrending.js';

export { recordViewHandler, recordViewEndpoint } from './recordView.js';
export { recordDownloadHandler, recordDownloadEndpoint } from './recordDownload.js';
export { getMetricsHandler, getMetricsEndpoint } from './getMetrics.js';
export { getViewCountHandler, getViewCountEndpoint } from './getViewCount.js';

// LTR training data endpoints
export { recordSearchClickHandler, recordSearchClickEndpoint } from './recordSearchClick.js';
export { recordDwellTimeHandler, recordDwellTimeEndpoint } from './recordDwellTime.js';
export {
  recordSearchDownloadHandler,
  recordSearchDownloadEndpoint,
} from './recordSearchDownload.js';

/**
 * All metrics XRPC endpoints.
 */
export const metricsEndpoints = [
  getTrendingEndpoint,
  recordViewEndpoint,
  recordDownloadEndpoint,
  getMetricsEndpoint,
  getViewCountEndpoint,
  // LTR training data endpoints
  recordSearchClickEndpoint,
  recordDwellTimeEndpoint,
  recordSearchDownloadEndpoint,
] as const;
