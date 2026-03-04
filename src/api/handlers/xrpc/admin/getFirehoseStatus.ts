/**
 * XRPC handler for pub.chive.admin.getFirehoseStatus.
 *
 * @remarks
 * Returns firehose cursor position and DLQ entry count.
 * Requires admin authentication.
 *
 * @packageDocumentation
 * @public
 */

import { AuthorizationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

interface FirehoseStatusOutput {
  readonly cursor: string | null;
  readonly dlqCount: number;
  readonly timestamp: string;
}

export const getFirehoseStatus: XRPCMethod<void, void, FirehoseStatusOutput> = {
  auth: true,
  handler: async ({ c }): Promise<XRPCResponse<FirehoseStatusOutput>> => {
    const user = c.get('user');
    if (!user?.isAdmin) {
      throw new AuthorizationError('Admin access required', 'admin');
    }

    const redis = c.get('redis');

    const cursor = await redis.get('chive:firehose:cursor');
    const dlqCount = await redis.llen('chive:firehose:dlq').catch(() => 0);

    return {
      encoding: 'application/json',
      body: {
        cursor,
        dlqCount,
        timestamp: new Date().toISOString(),
      },
    };
  },
};
