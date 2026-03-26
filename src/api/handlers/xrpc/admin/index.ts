/**
 * Admin XRPC handlers.
 *
 * @remarks
 * Handles pub.chive.admin.* endpoints for the admin dashboard.
 * All endpoints require admin authentication.
 *
 * @packageDocumentation
 * @public
 */

import type { XRPCMethod } from '../../../xrpc/types.js';

import { assignRole } from './assignRole.js';
import { cancelBackfill } from './cancelBackfill.js';
import { deleteContent } from './deleteContent.js';
import { dismissDLQEntry } from './dismissDLQEntry.js';
import { getActivityCorrelation } from './getActivityCorrelation.js';
import { getAuditLog } from './getAuditLog.js';
import { getBackfillHistory } from './getBackfillHistory.js';
import { getBackfillStatus } from './getBackfillStatus.js';
import { getEndpointMetrics } from './getEndpointMetrics.js';
import { getFirehoseStatus } from './getFirehoseStatus.js';
import { getGraphStats } from './getGraphStats.js';
import { getMetricsOverview } from './getMetricsOverview.js';
import { getNodeMetrics } from './getNodeMetrics.js';
import { getOverview } from './getOverview.js';
import { getPrometheusMetrics } from './getPrometheusMetrics.js';
import { getSearchAnalytics } from './getSearchAnalytics.js';
import { getSystemHealth } from './getSystemHealth.js';
import { getTrendingVelocity } from './getTrendingVelocity.js';
import { getUserDetail } from './getUserDetail.js';
import { getViewDownloadTimeSeries } from './getViewDownloadTimeSeries.js';
import { listDLQEntries } from './listDLQEntries.js';
import { listEndorsements } from './listEndorsements.js';
import { listEprints } from './listEprints.js';
import { listImports } from './listImports.js';
import { listPDSes } from './listPDSes.js';
import { listReviews } from './listReviews.js';
import { listViolations } from './listViolations.js';
import { listWarnings } from './listWarnings.js';
import { purgeOldDLQ } from './purgeOldDLQ.js';
import { rescanPDS } from './rescanPDS.js';
import { retryAllDLQ } from './retryAllDLQ.js';
import { retryDLQEntry } from './retryDLQEntry.js';
import { revokeRole } from './revokeRole.js';
import { searchUsers } from './searchUsers.js';
import { triggerBackfill } from './triggerBackfill.js';
import { triggerCitationExtraction } from './triggerCitationExtraction.js';
import { triggerDIDSync } from './triggerDIDSync.js';
import { triggerFreshnessScan } from './triggerFreshnessScan.js';
import { triggerFullReindex } from './triggerFullReindex.js';
import { triggerGovernanceSync } from './triggerGovernanceSync.js';
import { triggerPDSScan } from './triggerPDSScan.js';
/**
 * Admin methods map keyed by NSID.
 *
 * @remarks
 * Using `any` here is intentional; TypeScript's type variance rules make
 * heterogeneous handler maps impossible to type safely. The handlers themselves
 * are type-safe; only the collection type uses `any`.
 *
 * @public
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const adminMethods: Record<string, XRPCMethod<any, any, any>> = {
  // Overview and health
  'pub.chive.admin.getOverview': getOverview,
  'pub.chive.admin.getSystemHealth': getSystemHealth,
  'pub.chive.admin.getPrometheusMetrics': getPrometheusMetrics,

  // User management
  'pub.chive.admin.searchUsers': searchUsers,
  'pub.chive.admin.getUserDetail': getUserDetail,
  'pub.chive.admin.assignRole': assignRole,
  'pub.chive.admin.revokeRole': revokeRole,

  // Content management
  'pub.chive.admin.listEprints': listEprints,
  'pub.chive.admin.listReviews': listReviews,
  'pub.chive.admin.listEndorsements': listEndorsements,
  'pub.chive.admin.deleteContent': deleteContent,

  // Firehose and DLQ
  'pub.chive.admin.getFirehoseStatus': getFirehoseStatus,
  'pub.chive.admin.listDLQEntries': listDLQEntries,
  'pub.chive.admin.retryDLQEntry': retryDLQEntry,
  'pub.chive.admin.retryAllDLQ': retryAllDLQ,
  'pub.chive.admin.dismissDLQEntry': dismissDLQEntry,
  'pub.chive.admin.purgeOldDLQ': purgeOldDLQ,

  // Backfill operations
  'pub.chive.admin.triggerPDSScan': triggerPDSScan,
  'pub.chive.admin.triggerFreshnessScan': triggerFreshnessScan,
  'pub.chive.admin.triggerCitationExtraction': triggerCitationExtraction,
  'pub.chive.admin.triggerFullReindex': triggerFullReindex,
  'pub.chive.admin.triggerGovernanceSync': triggerGovernanceSync,
  'pub.chive.admin.triggerDIDSync': triggerDIDSync,
  'pub.chive.admin.getBackfillStatus': getBackfillStatus,
  'pub.chive.admin.getBackfillHistory': getBackfillHistory,
  'pub.chive.admin.triggerBackfill': triggerBackfill,
  'pub.chive.admin.cancelBackfill': cancelBackfill,

  // PDS and imports
  'pub.chive.admin.listPDSes': listPDSes,
  'pub.chive.admin.rescanPDS': rescanPDS,
  'pub.chive.admin.listImports': listImports,

  // Knowledge graph
  'pub.chive.admin.getGraphStats': getGraphStats,

  // Analytics and metrics
  'pub.chive.admin.getMetricsOverview': getMetricsOverview,
  'pub.chive.admin.getSearchAnalytics': getSearchAnalytics,
  'pub.chive.admin.getActivityCorrelation': getActivityCorrelation,
  'pub.chive.admin.getTrendingVelocity': getTrendingVelocity,
  'pub.chive.admin.getViewDownloadTimeSeries': getViewDownloadTimeSeries,
  'pub.chive.admin.getEndpointMetrics': getEndpointMetrics,
  'pub.chive.admin.getNodeMetrics': getNodeMetrics,

  // Audit and moderation
  'pub.chive.admin.getAuditLog': getAuditLog,
  'pub.chive.admin.listWarnings': listWarnings,
  'pub.chive.admin.listViolations': listViolations,
};
