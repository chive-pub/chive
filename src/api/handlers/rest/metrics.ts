/**
 * Prometheus scrape endpoint.
 *
 * @remarks
 * The service registered Prometheus metrics but exposed no scrape endpoint. The
 * only way to read them was `pub.chive.admin.getPrometheusMetrics`, an
 * admin-authenticated XRPC method returning JSON — which Prometheus cannot
 * scrape, since it speaks neither the auth flow nor that format. The metrics
 * existed and nothing could collect them.
 *
 * Access: the endpoint is unauthenticated by default so an in-network scraper
 * works without credentials, which is the usual arrangement for a metrics port
 * on a private network. That is only safe while the endpoint is not reachable
 * from outside, and this deployment fronts the API with a public router, so
 * `METRICS_TOKEN` is supported and enforced whenever it is set. Operators
 * exposing the API publicly should set it, or block `/metrics` at the edge.
 *
 * @packageDocumentation
 * @public
 */

import type { Hono } from 'hono';

import { getMetrics, metricsContentType } from '../../../observability/prometheus-registry.js';
import type { ChiveEnv } from '../../types/context.js';

/**
 * Path the metrics are served on.
 *
 * @public
 */
export const METRICS_PATH = '/metrics';

/**
 * Registers the Prometheus scrape endpoint.
 *
 * @param app - Hono application instance
 *
 * @public
 */
export function registerMetricsRoutes(app: Hono<ChiveEnv>): void {
  app.get(METRICS_PATH, async (c) => {
    const token = process.env.METRICS_TOKEN?.trim();

    if (token) {
      const provided = c.req.header('authorization');
      if (provided !== `Bearer ${token}`) {
        return c.text('Unauthorized', 401);
      }
    }

    const body = await getMetrics();
    return c.text(body, 200, { 'Content-Type': metricsContentType });
  });
}
