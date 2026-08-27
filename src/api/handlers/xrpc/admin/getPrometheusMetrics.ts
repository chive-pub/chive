/**
 * XRPC handler for pub.chive.admin.getPrometheusMetrics.
 *
 * @remarks
 * Returns Prometheus metrics as JSON. Requires admin authentication.
 *
 * @packageDocumentation
 * @public
 */

import { AuthorizationError, ServiceUnavailableError } from '../../../../types/errors.js';
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

    // Read the prom-client registry.
    //
    // The catch used to be empty, so an import or registry failure returned
    // `metrics: []` — indistinguishable from a registry with nothing in it, and
    // silent. An administrator looking at an empty metrics page had no way to
    // tell "nothing recorded yet" from "the metrics library failed to load".
    const logger = c.get('logger');
    let metrics: unknown[] = [];
    try {
      const promClient = await import('prom-client');
      metrics = await promClient.register.getMetricsAsJSON();
    } catch (error) {
      logger.error(
        'Failed to read the prom-client registry',
        error instanceof Error ? error : undefined
      );
      throw new ServiceUnavailableError('Metrics registry unavailable', 'prom-client');
    }

    return {
      encoding: 'application/json',
      body: { metrics, timestamp: new Date().toISOString() },
    };
  },
};
