/**
 * XRPC handler for pub.chive.admin.dismissDLQEntry.
 *
 * @remarks
 * Removes a single DLQ entry without retrying. Requires admin authentication.
 *
 * @packageDocumentation
 * @public
 */

import { dlqMetrics } from '../../../../observability/prometheus-registry.js';
import { AuthorizationError, ValidationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

interface DismissDLQInput {
  readonly index: number;
}

interface DismissDLQOutput {
  readonly success: boolean;
  readonly message: string;
}

export const dismissDLQEntry: XRPCMethod<void, DismissDLQInput, DismissDLQOutput> = {
  type: 'procedure',
  auth: true,
  handler: async ({ input, c }): Promise<XRPCResponse<DismissDLQOutput>> => {
    const user = c.get('user');
    if (!user?.isAdmin) {
      throw new AuthorizationError('Admin access required', 'admin');
    }

    if (input?.index === undefined || input.index === null) {
      throw new ValidationError('Index is required', 'index', 'required');
    }

    const redis = c.get('redis');
    const logger = c.get('logger');

    // Mark the entry with a sentinel value and then remove it
    const sentinel = `__DISMISSED_${Date.now()}__`;
    await redis.lset('chive:firehose:dlq', input.index, sentinel);
    await redis.lrem('chive:firehose:dlq', 1, sentinel);

    dlqMetrics.entriesTotal.dec();

    logger.info('DLQ entry dismissed', { index: input.index, dismissedBy: user.did });

    return {
      encoding: 'application/json',
      body: { success: true, message: 'Entry dismissed' },
    };
  },
};
