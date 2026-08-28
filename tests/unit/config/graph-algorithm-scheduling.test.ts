import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const entrypoint = readFileSync(join(REPO_ROOT, 'src/index.ts'), 'utf8');

/**
 * `GraphAlgorithmJob` is the only producer for the cache
 * `pub.chive.graph.getCommunities` reads. It was written, tested, and never
 * constructed. 0.9.0 built the cache the handler reads — which had never
 * existed — and stopped there, so the endpoint went from failing on an
 * undefined service to succeeding with an empty list, which is harder to
 * notice than the failure it replaced.
 *
 * These assertions are structural because the defect was structural: the job
 * was correct and simply never ran.
 */
describe('the graph algorithm job is scheduled', () => {
  it('is constructed at startup', () => {
    expect(entrypoint).toContain('new GraphAlgorithmJob(');
  });

  it('is started, not merely constructed', () => {
    expect(entrypoint).toContain('createGraphAlgorithmJobScheduler(');
    expect(entrypoint).toContain('state.graphAlgorithmScheduler.start()');
  });

  it('is stopped on shutdown', () => {
    // An interval left running holds the process open past SIGTERM.
    expect(entrypoint).toContain('state.graphAlgorithmScheduler.stop()');
  });

  it('writes into the same cache the handler reads', () => {
    const construction = entrypoint.slice(
      entrypoint.indexOf('new GraphAlgorithmJob('),
      entrypoint.indexOf('createGraphAlgorithmJobScheduler(')
    );
    expect(construction).toContain('serverConfig.graphAlgorithmCache');
  });

  it('says so when the cache is absent rather than starting nothing quietly', () => {
    expect(entrypoint).toMatch(/getCommunities will return an empty list/);
  });

  it('has an interval that is configurable and defaults to daily', () => {
    expect(entrypoint).toContain('GRAPH_ALGORITHM_INTERVAL_MS');
    expect(entrypoint).toContain('24 * 60 * 60 * 1000');
  });
});
