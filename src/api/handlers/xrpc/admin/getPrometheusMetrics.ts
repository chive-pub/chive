/**
 * XRPC handler for pub.chive.admin.getPrometheusMetrics.
 *
 * @remarks
 * Returns Prometheus metrics as JSON. Requires admin authentication.
 *
 * @packageDocumentation
 * @public
 */

import { AuthorizationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

interface PrometheusMetricsOutput {
  readonly metrics: unknown[];
  readonly timestamp: string;
}

export const getPrometheusMetrics: XRPCMethod<void, void, PrometheusMetricsOutput> = {
  auth: true,
  handler: async ({ c }): Promise<XRPCResponse<PrometheusMetricsOutput>> => {
    const user = c.get('user');
    if (!user?.isAdmin) {
      throw new AuthorizationError('Admin access required', 'admin');
    }

    // Attempt to read from prom-client registry if available
    let metrics: unknown[] = [];
    try {
      const promClient = await import('prom-client');
      const jsonMetrics = await promClient.register.getMetricsAsJSON();
      metrics = jsonMetrics;
    } catch {
      // prom-client may not be configured; return empty
    }

    return {
      encoding: 'application/json',
      body: { metrics, timestamp: new Date().toISOString() },
    };
  },
};
