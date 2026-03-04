/**
 * XRPC handler for pub.chive.admin.retryDLQEntry.
 *
 * @remarks
 * Requeues a single DLQ entry for reprocessing. Requires admin authentication.
 *
 * @packageDocumentation
 * @public
 */

import { dlqMetrics } from '../../../../observability/prometheus-registry.js';
import { AuthorizationError, ValidationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

interface RetryDLQInput {
  readonly index: number;
}

interface RetryDLQOutput {
  readonly success: boolean;
  readonly message: string;
}

export const retryDLQEntry: XRPCMethod<void, RetryDLQInput, RetryDLQOutput> = {
  type: 'procedure',
  auth: true,
  handler: async ({ input, c }): Promise<XRPCResponse<RetryDLQOutput>> => {
    const user = c.get('user');
    if (!user?.isAdmin) {
      throw new AuthorizationError('Admin access required', 'admin');
    }

    if (input?.index === undefined || input.index === null) {
      throw new ValidationError('Index is required', 'index', 'required');
    }

    const redis = c.get('redis');

    // Get the entry at the specified index
    const entries = await redis.lrange('chive:firehose:dlq', input.index, input.index);
    if (entries.length === 0) {
      dlqMetrics.retriesTotal.inc({ status: 'failure' });
      return {
        encoding: 'application/json',
        body: { success: false, message: 'Entry not found at index' },
      };
    }

    // Push to retry queue
    const entry = entries[0];
    if (entry) {
      await redis.rpush('chive:firehose:retry', entry);
    }

    dlqMetrics.retriesTotal.inc({ status: 'success' });

    const logger = c.get('logger');
    logger.info('DLQ entry requeued for retry', { index: input.index });

    return {
      encoding: 'application/json',
      body: { success: true, message: 'Entry requeued for retry' },
    };
  },
};
