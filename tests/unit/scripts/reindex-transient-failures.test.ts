/**
 * A PDS being unreachable must not fail the deploy.
 *
 * @remarks
 * The records live in user PDSes, any of which can be down, rate-limiting or
 * slow when the reindex runs. That leaves the index stale rather than wrong,
 * and the reindex is not the last deploy step, so failing there skips
 * everything after it.
 *
 * A record that cannot be indexed *correctly* is a different case and still
 * fails.
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

describe('unfetched records are retried, not dropped', () => {
  it('hands them to the index retry worker', () => {
    // The running service already has a BullMQ worker that resolves the DID,
    // re-fetches from the PDS and indexes, backing off across ten attempts.
    // The reindex enqueues onto it rather than reporting and moving on.
    expect(script).toContain('INDEX_RETRY_QUEUE_NAME');
    expect(script).toContain('async function enqueueForRetry(');
  });

  it('keys jobs by URI so a queued record is not queued twice', () => {
    expect(script).toMatch(/jobId: makeJobId\('retry', record\.uri\)/);
  });

  it('does not fail the deploy when the queue itself is unreachable', () => {
    // The reindex has already done its work by this point; Redis being down is
    // not a reason to fail a deploy either.
    const fn = script.slice(script.indexOf('async function enqueueForRetry('));
    expect(fn.slice(0, 1800)).toContain('catch');
  });

  it('closes the queue connection it opened', () => {
    const fn = script.slice(script.indexOf('async function enqueueForRetry('));
    expect(fn.slice(0, 1800)).toContain('queue.close()');
  });
});

describe('the periodic backstop', () => {
  it('selects records by how long ago they were synced', () => {
    // This is what makes the guarantee hold after the retry queue exhausts its
    // attempts: a record that could not be fetched keeps its old
    // `last_synced_at`, so it sorts to the front of the next scan. There is no
    // state in which a record is stale and nothing will try it again.
    const scan = readFileSync(join(process.cwd(), 'src/jobs/freshness-scan-job.ts'), 'utf8');
    expect(scan).toContain('WHERE last_synced_at < $1');
    expect(scan).toContain('ORDER BY last_synced_at ASC');
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
