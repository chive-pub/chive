/**
 * XRPC handler for pub.chive.admin.listDLQEntries.
 *
 * @remarks
 * Queries the firehose dead-letter queue. Requires admin authentication.
 *
 * @packageDocumentation
 * @public
 */

import { dlqMetrics } from '../../../../observability/prometheus-registry.js';
import { AuthorizationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

interface ListDLQParams {
  readonly limit?: number;
  readonly offset?: number;
}

export const listDLQEntries: XRPCMethod<ListDLQParams, void, unknown> = {
  auth: true,
  handler: async ({ params, c }): Promise<XRPCResponse<unknown>> => {
    const user = c.get('user');
    if (!user?.isAdmin) {
      throw new AuthorizationError('Admin access required', 'admin');
    }

    const redis = c.get('redis');
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    const entries = await redis.lrange('chive:firehose:dlq', offset, offset + limit - 1);
    const total = await redis.llen('chive:firehose:dlq');
    dlqMetrics.entriesTotal.set(total);

    const parsed: unknown[] = entries.map((entry) => {
      try {
        return JSON.parse(entry) as unknown;
      } catch {
        return { raw: entry };
      }
    });

    return {
      encoding: 'application/json',
      body: { entries: parsed, total },
    };
  },
};
