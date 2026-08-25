/**
 * Unit tests for the scheduled health-check workflow's probes.
 *
 * @remarks
 * The workflow probed `/api/health`, which is a static 200 that reports nothing
 * about dependencies. `/ready` — the readiness path Kubernetes uses, and the
 * only endpoint that actually checks PostgreSQL, Elasticsearch, Neo4j and Redis
 * — was never probed by any workflow. A datastore outage was therefore
 * invisible to monitoring: the API answered 200 from a pod that could not serve
 * a single query.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

const workflow = readFileSync(join(process.cwd(), '.github/workflows/health-check.yml'), 'utf8');

describe('health-check workflow', () => {
  it('probes the readiness endpoint', () => {
    expect(workflow).toMatch(/\/api\/ready/);
  });

  it('still probes liveness', () => {
    expect(workflow).toMatch(/\/api\/health/);
  });

  // Every probe is continue-on-error so that one failure does not hide the
  // others, which means each outcome has to be folded into the summary
  // explicitly or the job reports success regardless.
  it('folds the readiness outcome into the failure list', () => {
    expect(workflow).toMatch(/steps\.api_ready\.outcome/);
    expect(workflow).toMatch(/failures="\$\{failures\}APIReadiness,"/);
  });

  it('reports readiness in the run summary', () => {
    expect(workflow).toMatch(/API Readiness/);
  });
});
