/**
 * Tests that batch staleness checks use one array parameter.
 *
 * @remarks
 * `checkBatch` built one placeholder per URI — `IN ($1, $2, ... $n)`. The
 * PostgreSQL wire protocol caps a statement at 65535 parameters, so a large
 * enough batch fails in the driver before the query is ever sent, and every
 * distinct batch size produces a differently-shaped statement for the planner
 * to parse afresh.
 *
 * `= ANY($1)` takes the whole list as one array parameter: no ceiling worth
 * hitting, one plan.
 */

import { describe, it, expect, vi } from 'vitest';

import { StalenessDetector } from '../../../src/storage/postgresql/staleness-detector.js';
import type { AtUri } from '../../../src/types/atproto.js';

interface CapturedQuery {
  text: string;
  values: unknown[];
}

function detectorWithCapture(captured: CapturedQuery[]) {
  const pool = {
    query: vi.fn((text: string, values: unknown[]) => {
      captured.push({ text, values });
      return Promise.resolve({ rows: [] });
    }),
  };

  // The constructor takes the pool directly.
  const detector = new StalenessDetector(pool as never);

  return { detector, pool };
}

const uri = (n: number): AtUri =>
  `at://did:plc:author/pub.chive.eprint.submission/rec${n}` as AtUri;

describe('StalenessDetector.checkBatch', () => {
  it('passes the URIs as a single array parameter', async () => {
    const captured: CapturedQuery[] = [];
    const { detector } = detectorWithCapture(captured);

    await detector.checkBatch([uri(1), uri(2), uri(3)]);

    expect(captured).toHaveLength(1);
    expect(captured[0]?.values).toHaveLength(1);
    expect(captured[0]?.values[0]).toEqual([uri(1), uri(2), uri(3)]);
  });

  it('queries with = ANY rather than an expanded IN list', async () => {
    const captured: CapturedQuery[] = [];
    const { detector } = detectorWithCapture(captured);

    await detector.checkBatch([uri(1), uri(2)]);

    expect(captured[0]?.text).toMatch(/=\s*ANY\(\$1\)/);
    expect(captured[0]?.text).not.toMatch(/\$2/);
  });

  it('sends one parameter for a batch far past the protocol ceiling', async () => {
    // 70,000 placeholders would have failed in the driver before reaching
    // PostgreSQL at all.
    const captured: CapturedQuery[] = [];
    const { detector } = detectorWithCapture(captured);

    const many = Array.from({ length: 70_000 }, (_, i) => uri(i));
    await detector.checkBatch(many);

    expect(captured[0]?.values).toHaveLength(1);
    expect((captured[0]?.values[0] as unknown[]).length).toBe(70_000);
  });

  it('does not query at all for an empty batch', async () => {
    const captured: CapturedQuery[] = [];
    const { detector, pool } = detectorWithCapture(captured);

    const result = await detector.checkBatch([]);

    expect(pool.query).not.toHaveBeenCalled();
    expect(result.size).toBe(0);
  });
});
