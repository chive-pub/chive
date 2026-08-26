/**
 * Unit tests for wiring the graph algorithm cache into the request context.
 *
 * @remarks
 * Two handlers read `services.graphAlgorithmCache`. `ServerConfig` had no field
 * for it and nothing ever constructed one, so it was always `undefined`:
 * `getCommunities` returned an empty list on every request, and `getTrending`
 * fell through to the metrics service every time.
 *
 * The graph algorithm job builds the same cache and populates it, so the
 * precomputed results were being written and never read — the work happened, on
 * schedule, and no request ever benefited from it.
 *
 * Asserted against the source because the alternative is booting the whole
 * server: the defect was a missing field in composition, not logic inside a
 * function that can be called in isolation.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

const read = (relative: string): string => readFileSync(join(process.cwd(), relative), 'utf8');

describe('graph algorithm cache wiring', () => {
  const server = read('src/api/server.ts');
  const entry = read('src/index.ts');

  it('ServerConfig declares the cache', () => {
    expect(server).toMatch(/readonly graphAlgorithmCache\?: GraphAlgorithmCache;/);
  });

  it('the request context exposes it', () => {
    expect(server).toMatch(/graphAlgorithmCache: config\.graphAlgorithmCache,/);
  });

  it('the composition root constructs one', () => {
    expect(entry).toMatch(/new GraphAlgorithmCache\(\{ redis, logger \}\)/);
  });

  it('and passes it through the server config', () => {
    expect(entry).toMatch(/^\s+graphAlgorithmCache,$/m);
  });

  // Sharing the job's Redis is what makes the precomputed results readable;
  // a separate client would read an empty key space and look identical to the
  // bug being fixed.
  it('uses the same Redis client the rest of the services use', () => {
    const construction = /new GraphAlgorithmCache\(\{ redis, logger \}\)/.exec(entry);
    expect(construction).not.toBeNull();
  });
});
