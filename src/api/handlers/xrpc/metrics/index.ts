/**
 * Metrics XRPC method exports.
 *
 * @packageDocumentation
 * @public
 */

import { getMetrics } from './getMetrics.js';
import { getTrending } from './getTrending.js';
import { getViewCount } from './getViewCount.js';
import { recordDownload } from './recordDownload.js';
import { recordDwellTime } from './recordDwellTime.js';
import { recordSearchClick } from './recordSearchClick.js';
import { recordSearchDownload } from './recordSearchDownload.js';
import { recordView } from './recordView.js';

export { getMetrics as metricsGetMetrics } from './getMetrics.js';
export { getTrending as metricsGetTrending } from './getTrending.js';
export { getViewCount as metricsGetViewCount } from './getViewCount.js';
export { recordView as metricsRecordView } from './recordView.js';
export { recordDownload as metricsRecordDownload } from './recordDownload.js';
export { recordSearchClick as metricsRecordSearchClick } from './recordSearchClick.js';
export { recordSearchDownload as metricsRecordSearchDownload } from './recordSearchDownload.js';
export { recordDwellTime as metricsRecordDwellTime } from './recordDwellTime.js';

/**
 * Metrics XRPC methods keyed by NSID.
 *
 * @public
 */
export const metricsMethods = {
  'pub.chive.metrics.getMetrics': getMetrics,
  'pub.chive.metrics.getTrending': getTrending,
  'pub.chive.metrics.getViewCount': getViewCount,
  'pub.chive.metrics.recordView': recordView,
  'pub.chive.metrics.recordDownload': recordDownload,
  'pub.chive.metrics.recordSearchClick': recordSearchClick,
  'pub.chive.metrics.recordSearchDownload': recordSearchDownload,
  'pub.chive.metrics.recordDwellTime': recordDwellTime,
} as const;
