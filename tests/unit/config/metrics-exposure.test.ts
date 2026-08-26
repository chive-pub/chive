/**
 * Unit tests for the network exposure of the Prometheus scrape endpoint.
 *
 * @remarks
 * `/metrics` is unauthenticated by default so an in-network collector needs no
 * credentials — the usual arrangement for a metrics port on a private network.
 * Chive's API is fronted by two public Traefik routers, so on this deployment
 * that default made the endpoint world-readable: request rates, per-endpoint
 * latencies and error counts, and queue depths. It was verified returning 200
 * from the public internet after v0.8.0 shipped.
 *
 * The fix is a network control rather than an application one, so that it holds
 * whether or not `METRICS_TOKEN` is configured. Prometheus reaches the API
 * directly over the compose network and never traverses Traefik, so denying at
 * the edge costs nothing internally.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

const read = (relative: string): string => readFileSync(join(process.cwd(), relative), 'utf8');

describe('public metrics exposure', () => {
  const compose = read('docker/docker-compose.prod.yml');

  it('defines a router for the metrics path', () => {
    expect(compose).toMatch(/routers\.api-metrics\.rule=.*Path\(`\/metrics`\)/);
  });

  // Both public routers serve the API, so the path has to be denied on each.
  it('covers the path-prefixed route as well as the api subdomain', () => {
    expect(compose).toMatch(/Path\(`\/api\/metrics`\)/);
  });

  // Without a higher priority the broader PathPrefix(`/api`) rule wins and the
  // deny never applies.
  it('outranks the broader api route', () => {
    expect(compose).toMatch(/routers\.api-metrics\.priority=200/);
  });

  it('restricts the source range so public requests are refused', () => {
    expect(compose).toMatch(/middlewares\.metrics-deny\.ipallowlist\.sourcerange=127\.0\.0\.1\/32/);
    expect(compose).toMatch(/routers\.api-metrics\.middlewares=metrics-deny/);
  });
});

describe('internal scraping still works', () => {
  const prometheus = read('docker/prometheus.yml');

  it('scrapes the API over the compose network', () => {
    expect(prometheus).toMatch(/job_name: 'chive-api'/);
    expect(prometheus).toMatch(/targets: \['chive-api:3000'\]/);
  });

  it('scrapes the metrics path', () => {
    expect(prometheus).toMatch(/metrics_path: \/metrics/);
  });

  // The target is a compose service name, which only resolves inside the
  // network — so the scrape never passes through the router that denies it.
  it('does not scrape through the public hostname', () => {
    expect(prometheus).not.toMatch(/targets: \['(api\.)?chive\.pub'\]/);
  });
});
