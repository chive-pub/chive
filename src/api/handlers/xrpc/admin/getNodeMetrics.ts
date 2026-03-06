/**
 * XRPC handler for pub.chive.admin.getNodeMetrics.
 *
 * @remarks
 * Returns Node.js runtime metrics from Prometheus and structured
 * process information with fields matching the lexicon schema.
 *
 * @packageDocumentation
 * @public
 */

import { AuthorizationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

interface NodeMetricEntry {
  readonly name: string;
  readonly value: string;
  readonly type: string;
  readonly unit?: string;
}

interface ProcessInfo {
  readonly pid: number;
  readonly uptime: number;
  readonly heapUsed: number;
  readonly heapTotal: number;
  readonly rss: number;
  readonly external?: number;
  readonly cpuUser?: number;
  readonly cpuSystem?: number;
  readonly eventLoopLag?: number;
}

export const getNodeMetrics: XRPCMethod<void, void, unknown> = {
  auth: true,
  handler: async ({ c }): Promise<XRPCResponse<unknown>> => {
    const user = c.get('user');
    if (!user?.isAdmin) {
      throw new AuthorizationError('Admin access required', 'admin');
    }

    // Collect structured metrics from Prometheus
    const metrics: NodeMetricEntry[] = [];
    let eventLoopLag: number | undefined;

    try {
      const promClient = await import('prom-client');
      const allMetrics = await promClient.register.getMetricsAsJSON();
      const nodeMetrics = allMetrics.filter((m: { name?: string }) => {
        const name = m.name ?? '';
        return (
          name.startsWith('nodejs_') || name.startsWith('process_') || name.startsWith('chive_')
        );
      });

      for (const metric of nodeMetrics as unknown as {
        name?: string;
        type?: string;
        help?: string;
        values?: { value: number; labels?: Record<string, string>; metricName?: string }[];
      }[]) {
        const name = metric.name ?? '';
        const type = metric.type ?? 'gauge';

        // Extract event loop lag if available
        if (name === 'nodejs_eventloop_lag_seconds' && metric.values?.length) {
          const lagValue = metric.values[0]?.value;
          if (lagValue !== undefined) {
            eventLoopLag = Math.round(lagValue * 1_000_000);
          }
        }

        // Add simple gauge/counter values
        if (metric.values?.length) {
          for (const v of metric.values) {
            const metricName = v.metricName ?? name;
            // Skip histogram sub-metrics (buckets, sum, count)
            if (
              metricName.endsWith('_bucket') ||
              metricName.endsWith('_sum') ||
              metricName.endsWith('_count')
            ) {
              continue;
            }
            const unit = name.includes('bytes')
              ? 'bytes'
              : name.includes('seconds')
                ? 'seconds'
                : undefined;

            metrics.push({
              name: metricName,
              value: String(v.value),
              type,
              ...(unit ? { unit } : {}),
            });
          }
        }
      }
    } catch {
      // prom-client may not be configured
    }

    // Build structured processInfo from Node.js APIs
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const processInfo: ProcessInfo = {
      pid: process.pid,
      uptime: Math.round(process.uptime()),
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      rss: memUsage.rss,
      external: memUsage.external,
      cpuUser: cpuUsage.user,
      cpuSystem: cpuUsage.system,
      eventLoopLag,
    };

    return {
      encoding: 'application/json',
      body: { metrics, processInfo },
    };
  },
};
