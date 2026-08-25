/**
 * Unit tests for the isolation of the developer test stack from production.
 *
 * @remarks
 * The test stack in `docker/docker-compose.yml` originally named its containers
 * `chive-postgres`, `chive-grobid` and so on, which are the same names the
 * production compose file uses. Two problems followed. Running the test stack on
 * a host that also runs production collided outright on `chive-grobid`, and the
 * deploy workflows sweep leftovers with
 * `docker ps -a --filter "name=chive-" | xargs docker rm -f`, which matched every
 * test container and destroyed a running test stack mid-deploy.
 *
 * Prefixing alone does not fix the second problem — `chive-test-postgres` still
 * matches a `name=chive-` filter — so the sweep has to exclude the prefix
 * explicitly. Both halves are pinned here, since either one alone leaves the
 * hazard in place.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

const read = (relative: string): string => readFileSync(join(process.cwd(), relative), 'utf8');

const DEPLOY_WORKFLOWS = [
  '.github/workflows/deploy-app.yml',
  '.github/workflows/deploy-staging.yml',
];

describe('test stack isolation', () => {
  const compose = read('docker/docker-compose.yml');

  it('prefixes every test stack container with chive-test-', () => {
    const names = [...compose.matchAll(/container_name:\s*(\S+)/g)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(name).toMatch(/^chive-test-/);
    }
  });

  it('points the test stack at the test database rather than the production name', () => {
    expect(compose).toMatch(/POSTGRES_DB:\s*chive_test/);
    expect(compose).not.toMatch(/POSTGRES_DB:\s*chive\s*$/m);
  });

  // The prefix shares `chive-`, so the deploy sweep must filter it out by name.
  it.each(DEPLOY_WORKFLOWS)(
    'excludes the test stack from the container sweep in %s',
    (workflow) => {
      const contents = read(workflow);
      const sweeps = contents.split('\n').filter((line) => line.includes('--filter "name=chive-"'));
      expect(sweeps.length).toBeGreaterThan(0);
      expect(contents).toMatch(/grep -v '\^chive-test-'/);
    }
  );
});
