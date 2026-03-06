/**
 * XRPC handler for pub.chive.admin.getEndpointMetrics.
 *
 * @remarks
 * Parses Prometheus histogram and counter metrics into structured
 * per-endpoint performance data.
 *
 * @packageDocumentation
 * @public
 */

import { AuthorizationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

interface EndpointMetric {
  readonly method: string;
  readonly path: string;
  readonly requestCount: number;
  readonly errorCount: number;
  readonly errorRate: number;
  readonly p50: number;
  readonly p95: number;
  readonly p99: number;
}

/**
 * Accumulator for building per-endpoint metrics from Prometheus data.
 */
interface EndpointAccumulator {
  method: string;
  path: string;
  requestCount: number;
  errorCount: number;
  buckets: { le: number; count: number }[];
  sum: number;
  count: number;
}

/**
 * Computes a percentile from histogram buckets.
 *
 * @param buckets - sorted histogram buckets with cumulative counts
 * @param totalCount - total number of observations
 * @param percentile - target percentile (0-1)
 * @returns estimated value at percentile in microseconds
 */
function computePercentile(
  buckets: { le: number; count: number }[],
  totalCount: number,
  percentile: number
): number {
  if (totalCount === 0 || buckets.length === 0) return 0;

  const target = totalCount * percentile;
  let prevCount = 0;
  let prevBound = 0;

  for (const bucket of buckets) {
    if (bucket.count >= target) {
      // Linear interpolation within the bucket
      const bucketCount = bucket.count - prevCount;
      if (bucketCount === 0) return Math.round(bucket.le * 1_000_000);
      const fraction = (target - prevCount) / bucketCount;
      const value = prevBound + fraction * (bucket.le - prevBound);
      return Math.round(value * 1_000_000);
    }
    prevCount = bucket.count;
    prevBound = bucket.le;
  }

  // Beyond the last finite bucket
  const lastBucket = buckets[buckets.length - 1];
  return lastBucket ? Math.round(lastBucket.le * 1_000_000) : 0;
}

export const getEndpointMetrics: XRPCMethod<void, void, unknown> = {
  auth: true,
  handler: async ({ c }): Promise<XRPCResponse<unknown>> => {
    const user = c.get('user');
    if (!user?.isAdmin) {
      throw new AuthorizationError('Admin access required', 'admin');
    }

    const endpointMap = new Map<string, EndpointAccumulator>();

    try {
      const promClient = await import('prom-client');
      const allMetrics = await promClient.register.getMetricsAsJSON();

      // Process the chive_http_requests_total counter
      const requestsMetric = allMetrics.find(
        (m: { name?: string }) => m.name === 'chive_http_requests_total'
      ) as { values?: { labels: Record<string, string>; value: number }[] } | undefined;

      if (requestsMetric?.values) {
        for (const v of requestsMetric.values) {
          const method = v.labels.method ?? 'GET';
          const path = v.labels.endpoint ?? v.labels.path ?? '/unknown';
          const status = v.labels.status ?? '200';
          const key = `${method}:${path}`;

          let acc = endpointMap.get(key);
          if (!acc) {
            acc = {
              method,
              path,
              requestCount: 0,
              errorCount: 0,
              buckets: [],
              sum: 0,
              count: 0,
            };
            endpointMap.set(key, acc);
          }

          acc.requestCount += v.value;
          const statusCode = parseInt(status, 10);
          if (statusCode >= 400) {
            acc.errorCount += v.value;
          }
        }
      }

      // Process the chive_http_request_duration_seconds histogram
      const durationMetric = allMetrics.find(
        (m: { name?: string }) => m.name === 'chive_http_request_duration_seconds'
      ) as
        | {
            values?: {
              labels: Record<string, string>;
              value: number;
              metricName?: string;
            }[];
          }
        | undefined;

      if (durationMetric?.values) {
        for (const v of durationMetric.values) {
          const method = v.labels.method ?? 'GET';
          const path = v.labels.endpoint ?? v.labels.path ?? '/unknown';
          const key = `${method}:${path}`;
          const metricName = v.metricName ?? '';

          let acc = endpointMap.get(key);
          if (!acc) {
            acc = {
              method,
              path,
              requestCount: 0,
              errorCount: 0,
              buckets: [],
              sum: 0,
              count: 0,
            };
            endpointMap.set(key, acc);
          }

          if (metricName.endsWith('_bucket')) {
            const le = parseFloat(v.labels.le ?? 'Inf');
            if (isFinite(le)) {
              acc.buckets.push({ le, count: v.value });
            }
          } else if (metricName.endsWith('_sum')) {
            acc.sum += v.value;
          } else if (metricName.endsWith('_count')) {
            acc.count += v.value;
          }
        }
      }
    } catch {
      // prom-client may not be configured
    }

    // Build structured metrics from the accumulators
    const metrics: EndpointMetric[] = [];

    for (const acc of endpointMap.values()) {
      // Sort buckets by upper bound
      acc.buckets.sort((a, b) => a.le - b.le);

      const totalCount = acc.count || acc.requestCount;
      const p50 = computePercentile(acc.buckets, totalCount, 0.5);
      const p95 = computePercentile(acc.buckets, totalCount, 0.95);
      const p99 = computePercentile(acc.buckets, totalCount, 0.99);

      // Error rate in basis points (100 = 1%)
      const errorRate =
        acc.requestCount > 0 ? Math.round((acc.errorCount / acc.requestCount) * 10000) : 0;

      metrics.push({
        method: acc.method,
        path: acc.path,
        requestCount: acc.requestCount,
        errorCount: acc.errorCount,
        errorRate,
        p50,
        p95,
        p99,
      });
    }

    // Sort by request count descending
    metrics.sort((a, b) => b.requestCount - a.requestCount);

    return { encoding: 'application/json', body: { metrics } };
  },
};
