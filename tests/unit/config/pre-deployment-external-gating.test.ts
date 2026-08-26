/**
 * Unit tests for how the pre-deployment suite handles external services.
 *
 * @remarks
 * `tests/pre-deployment/script-execution.test.ts` talks to a real user PDS and
 * the governance PDS, and the `Pre-Deployment Verification` job that runs it is
 * a required check on both `staging` and `main`. That coupling meant somebody
 * else's outage red-lined this repository: while bsky.social was unreachable,
 * no pull request could merge, however unrelated the change. The file's own
 * docblock stated the intent — "These tests MUST pass. They do NOT skip" — so
 * this was a deliberate choice rather than an oversight, and changing it is a
 * change of policy worth recording.
 *
 * The distinction the new behaviour draws is between *unreachable* and *wrong*.
 * A service that cannot be contacted teaches nothing, so the suite skips. A
 * service that answers incorrectly is a real integration failure, and the tests
 * run and fail exactly as before.
 *
 * A skipped run must never read as a verified one, which is why the skip prints
 * its reason and says explicitly that nothing was checked.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

const source = readFileSync(
  join(process.cwd(), 'tests/pre-deployment/script-execution.test.ts'),
  'utf8'
);

describe('external dependency gating', () => {
  it('probes the services before running the suite', () => {
    expect(source).toMatch(/async function externalServicesReachable/);
  });

  it('gates the suite on that probe', () => {
    expect(source).toMatch(/describe\.skipIf\(!externalAvailable\)/);
  });

  it.each([['userPdsEndpoint'], ['graphPdsUrl']])('probes %s', (endpoint) => {
    expect(source).toMatch(new RegExp(`TEST_CONFIG\\.${endpoint}`));
  });

  // A 5xx means up-but-broken, which is as unusable as unreachable and equally
  // not this repository's fault.
  it('treats a server error as unreachable', () => {
    expect(source).toMatch(/response\.status >= 500/);
  });

  it('bounds the probe so a hang cannot stall the job', () => {
    expect(source).toMatch(/AbortSignal\.timeout\(\d+\)/);
  });
});

describe('a skip is not a pass', () => {
  it('prints why it skipped', () => {
    expect(source).toMatch(/skipping external suite/);
  });

  it('says plainly that nothing was verified', () => {
    expect(source).toMatch(/This is not a pass/);
  });

  // The old docblock promised the opposite behaviour; leaving it would have
  // made the file describe a policy it no longer follows.
  it('no longer claims the suite never skips', () => {
    expect(source).not.toMatch(/They do NOT skip/);
  });
});
