/**
 * Unit tests for the Prometheus scrape endpoint.
 *
 * @remarks
 * The service registered Prometheus metrics and exposed no way to scrape them:
 * the only reader was an admin-authenticated XRPC method returning JSON, which
 * Prometheus can neither authenticate against nor parse. Metrics existed and
 * nothing could collect them.
 *
 * The endpoint is unauthenticated by default, which is the usual arrangement
 * for a metrics port on a private network and is what lets an in-network
 * scraper work without credentials. Since this deployment fronts the API with a
 * public router, `METRICS_TOKEN` is enforced whenever it is set — both halves
 * are pinned here, because the default-open half is only safe if the token half
 * actually works.
 */

import { Hono } from 'hono';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { registerMetricsRoutes, METRICS_PATH } from '@/api/handlers/rest/metrics.js';
import type { ChiveEnv } from '@/api/types/context.js';

const ORIGINAL = { ...process.env };

const appWithMetrics = (): Hono<ChiveEnv> => {
  const app = new Hono<ChiveEnv>();
  registerMetricsRoutes(app);
  return app;
};

describe('metrics endpoint', () => {
  beforeEach(() => {
    delete process.env.METRICS_TOKEN;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL };
  });

  it('serves metrics in the Prometheus text format', async () => {
    const response = await appWithMetrics().request(METRICS_PATH);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/text\/plain/);
  });

  // Prometheus parses the exposition format, not JSON; the previous admin XRPC
  // method returned JSON, which is why it could not be scraped.
  it('returns an exposition-format body rather than JSON', async () => {
    const body = await (await appWithMetrics().request(METRICS_PATH)).text();
    expect(body.startsWith('{')).toBe(false);
    expect(body).toMatch(/^# HELP |^# TYPE /m);
  });

  it('is served on /metrics', () => {
    expect(METRICS_PATH).toBe('/metrics');
  });

  describe('when METRICS_TOKEN is set', () => {
    beforeEach(() => {
      process.env.METRICS_TOKEN = 'scrape-secret';
    });

    it('rejects a request with no credentials', async () => {
      const response = await appWithMetrics().request(METRICS_PATH);
      expect(response.status).toBe(401);
    });

    it('rejects a request with the wrong token', async () => {
      const response = await appWithMetrics().request(METRICS_PATH, {
        headers: { authorization: 'Bearer wrong' },
      });
      expect(response.status).toBe(401);
    });

    it('accepts the configured token', async () => {
      const response = await appWithMetrics().request(METRICS_PATH, {
        headers: { authorization: 'Bearer scrape-secret' },
      });
      expect(response.status).toBe(200);
    });

    // A blank value is a misconfiguration, not a request to disable auth.
    it('ignores a blank token and stays open', async () => {
      process.env.METRICS_TOKEN = '   ';
      const response = await appWithMetrics().request(METRICS_PATH);
      expect(response.status).toBe(200);
    });
  });
});
