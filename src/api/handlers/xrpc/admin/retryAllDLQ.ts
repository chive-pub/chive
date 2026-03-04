/**
 * XRPC handler for pub.chive.admin.retryAllDLQ.
 *
 * @remarks
 * Batch retry all DLQ entries, optionally filtered by error type.
 * Requires admin authentication.
 *
 * @packageDocumentation
 * @public
 */

import { dlqMetrics } from '../../../../observability/prometheus-registry.js';
import { AuthorizationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

interface RetryAllDLQInput {
  readonly errorType?: string;
}

interface RetryAllDLQOutput {
  readonly success: boolean;
  readonly retriedCount: number;
}

export const retryAllDLQ: XRPCMethod<void, RetryAllDLQInput, RetryAllDLQOutput> = {
  type: 'procedure',
  auth: true,
  handler: async ({ input, c }): Promise<XRPCResponse<RetryAllDLQOutput>> => {
    const user = c.get('user');
    if (!user?.isAdmin) {
      throw new AuthorizationError('Admin access required', 'admin');
    }

    const redis = c.get('redis');
    const logger = c.get('logger');

    const entries = await redis.lrange('chive:firehose:dlq', 0, -1);
    let retriedCount = 0;

    for (const entry of entries) {
      // Optionally filter by error type
      if (input?.errorType) {
        try {
          const parsed = JSON.parse(entry) as { error?: string; errorType?: string };
          if (parsed.errorType !== input.errorType && parsed.error !== input.errorType) {
            continue;
          }
        } catch {
          continue;
        }
      }

      await redis.rpush('chive:firehose:retry', entry);
      retriedCount++;
    }

    // Clear the DLQ after requeueing
    if (!input?.errorType) {
      await redis.del('chive:firehose:dlq');
    }

    dlqMetrics.retriesTotal.inc({ status: 'success' }, retriedCount);

    logger.info('DLQ batch retry', { retriedCount, errorType: input?.errorType });

    return {
      encoding: 'application/json',
      body: { success: true, retriedCount },
    };
  },
};
