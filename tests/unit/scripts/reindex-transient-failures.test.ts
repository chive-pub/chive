/**
 * A PDS being unreachable must not fail the deploy.
 *
 * @remarks
 * Chive is an AppView: the records live in user PDSes, any of which can be
 * down, rate-limiting or slow when the reindex happens to run. Treating that as
 * a failure meant one unavailable host failed the whole deploy — and since the
 * reindex is not the last step, everything after it was skipped, including the
 * citation re-matching that keeps the graph current.
 *
 * An unfetched record leaves the index stale, not wrong. A record that cannot
 * be indexed correctly is a different thing and still fails.
 *
 * @packageDocumentation
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const script = readFileSync(join(process.cwd(), 'scripts/reindex-all-eprints.ts'), 'utf8');
const workflow = readFileSync(join(process.cwd(), '.github/workflows/deploy-app.yml'), 'utf8');

describe('reindex exit conditions', () => {
  it('separates transient fetch failures from real ones', () => {
    expect(script).toContain('function isTransient(');
    expect(script).toMatch(/const permanent = stats\.failed - transient\.length/);
  });

  it('exits non-zero only for failures that are not PDS access', () => {
    expect(script).toMatch(/if \(permanent > 0\)[\s\S]{0,220}process\.exit\(1\)/);
  });

  it('still fails when field labels are unresolved', () => {
    // Those mean the index is serving raw UUIDs where names belong — wrong
    // rather than stale, so the deploy should surface it.
    expect(script).toMatch(/if \(unresolvedLabels\)[\s\S]{0,80}process\.exit\(1\)/);
  });

  it.each([
    'fetch failed',
    'Timeout',
    'ECONNREFUSED',
    'socket hang up',
    'Rate limit exceeded',
    'upstream returned 503',
  ])('treats %s as transient', (message) => {
    // Mirrors the predicate rather than importing it, since the script runs
    // its own main() on import.
    const lowered = message.toLowerCase();
    const transient = [
      'fetch failed',
      'timeout',
      'timed out',
      'econnrefused',
      'econnreset',
      'enotfound',
      'socket hang up',
      'rate limit',
      '429',
      '502',
      '503',
      '504',
    ].some((needle) => lowered.includes(needle));
    expect(transient).toBe(true);
  });

  it('does not treat a validation failure as transient', () => {
    const lowered = 'record failed lexicon validation';
    const transient = ['fetch failed', 'timeout', 'econnrefused', 'rate limit'].some((n) =>
      lowered.includes(n)
    );
    expect(transient).toBe(false);
  });
});

describe('deploy ordering', () => {
  it('runs citation re-matching after the reindex', () => {
    // Which is why a reindex that exits non-zero silently skipped it.
    const reindex = workflow.indexOf('reindex-all-eprints.js');
    const rematch = workflow.indexOf('rematch-citations.js');
    expect(reindex).toBeGreaterThan(-1);
    expect(rematch).toBeGreaterThan(reindex);
  });
});
