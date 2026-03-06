/**
 * XRPC handler for pub.chive.admin.purgeOldDLQ.
 *
 * @remarks
 * Purges DLQ entries older than the specified number of days.
 * Requires admin authentication.
 *
 * @packageDocumentation
 * @public
 */

import { dlqMetrics } from '../../../../observability/prometheus-registry.js';
import { AuthorizationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

interface PurgeDLQInput {
  readonly olderThanDays?: number;
}

interface PurgeDLQOutput {
  readonly success: boolean;
  readonly purgedCount: number;
}

export const purgeOldDLQ: XRPCMethod<void, PurgeDLQInput, PurgeDLQOutput> = {
  type: 'procedure',
  auth: true,
  handler: async ({ input, c }): Promise<XRPCResponse<PurgeDLQOutput>> => {
    const user = c.get('user');
    if (!user?.isAdmin) {
      throw new AuthorizationError('Admin access required', 'admin');
    }

    const redis = c.get('redis');
    const logger = c.get('logger');
    const olderThanDays = input?.olderThanDays ?? 7;
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

    const entries = await redis.lrange('chive:firehose:dlq', 0, -1);
    let purgedCount = 0;

    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];
      if (!entry) continue;

      try {
        const parsed = JSON.parse(entry) as { timestamp?: string; createdAt?: string };
        const timestamp = parsed.timestamp ?? parsed.createdAt;
        if (timestamp && new Date(timestamp) < cutoff) {
          const sentinel = `__PURGED_${Date.now()}_${i}__`;
          await redis.lset('chive:firehose:dlq', i, sentinel);
          await redis.lrem('chive:firehose:dlq', 1, sentinel);
          purgedCount++;
        }
      } catch {
        // Skip entries that cannot be parsed
      }
    }

    dlqMetrics.entriesTotal.dec(purgedCount);

    logger.info('DLQ purged', { olderThanDays, purgedCount, purgedBy: user.did });

    return {
      encoding: 'application/json',
      body: { success: true, purgedCount },
    };
  },
};
