/**
 * `/api/og` must reach the frontend, not the API.
 *
 * @remarks
 * The main domain routes `/api` to the API container, which strips the prefix
 * before handling. `/api/og` is a Next.js route handler, so under that rule it
 * arrives at the API as `/og`, which does not exist there.
 *
 * It is the only Next.js route under `/api`, and it renders every OpenGraph
 * image on the site — the preview card for any Chive link shared on Bluesky or
 * anywhere else. A more specific router at higher priority keeps it with the
 * frontend, the same way the metrics endpoint is carved out of the same prefix.
 *
 * @packageDocumentation
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const compose = readFileSync(join(process.cwd(), 'docker/docker-compose.prod.yml'), 'utf8');

describe('OpenGraph image routing', () => {
  it('has a router for /api/og', () => {
    expect(compose).toContain('traefik.http.routers.og-image.rule');
    expect(compose).toContain('PathPrefix(`/api/og`)');
  });

  it('sends it to the web service', () => {
    expect(compose).toContain('traefik.http.routers.og-image.service=web');
  });

  it('outranks the broader /api router', () => {
    // Without a higher priority the `/api` rule can win and the request is
    // handed to the API with its prefix stripped.
    expect(compose).toMatch(/routers\.og-image\.priority=(\d+)/);
    const priority = Number(/routers\.og-image\.priority=(\d+)/.exec(compose)?.[1]);
    expect(priority).toBeGreaterThan(0);
  });

  it('does not pass through the prefix-stripping middleware', () => {
    // `api-strip` removes `/api`, which would leave Next.js looking for `/og`.
    const line = compose.split('\n').find((l) => l.includes('routers.og-image.middlewares'));
    expect(line).toBeUndefined();
  });
});

describe('Next.js routes under /api', () => {
  it('are all accounted for by a Traefik rule', () => {
    // A second route added under `/api` would silently be swallowed by the
    // API router, so adding one means adding a rule.
    const apiDir = join(process.cwd(), 'web/app/api');
    const routes = readdirSync(apiDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    expect(routes).toEqual(['og']);
  });
});
