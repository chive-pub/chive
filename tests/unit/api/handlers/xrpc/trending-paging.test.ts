/**
 * Unit tests for trending pagination.
 *
 * @remarks
 * The cursor is an offset into the ranked list. It was parsed only at the end of
 * the handler, to construct the *next* cursor, and never passed to either data
 * source — so every request returned the same first `limit` entries while the
 * cursor kept advancing. Paging appeared to work and never moved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { getTrending } from '@/api/handlers/xrpc/metrics/getTrending.js';

describe('trending pagination', () => {
  const getTrendingMetrics = vi.fn();
  const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

  const context = (): unknown => ({
    get: (key: string) => {
      if (key === 'logger') return logger;
      if (key === 'services') {
        return {
          metrics: { getTrending: getTrendingMetrics },
          eprint: { getEprint: vi.fn().mockResolvedValue(null) },
          graph: undefined,
          graphAlgorithmCache: undefined,
        };
      }
      return undefined;
    },
  });

  const call = async (cursor?: string, limit = 20): Promise<unknown> =>
    getTrending.handler({
      params: { window: '7d', limit, ...(cursor === undefined ? {} : { cursor }) },
      input: undefined,
      auth: null,
      c: context(),
    } as never);

  beforeEach(() => {
    vi.clearAllMocks();
    getTrendingMetrics.mockResolvedValue([]);
  });

  it('requests the first page when no cursor is supplied', async () => {
    await call();
    expect(getTrendingMetrics).toHaveBeenCalledWith('7d', 20, 0);
  });

  it('passes the cursor through as an offset', async () => {
    await call('40');
    expect(getTrendingMetrics).toHaveBeenCalledWith('7d', 20, 40);
  });

  // A malformed or negative cursor must not produce a negative slice bound.
  it.each([['not-a-number'], ['-5'], ['']])('treats %s as the first page', async (cursor) => {
    await call(cursor);
    expect(getTrendingMetrics).toHaveBeenCalledWith('7d', 20, 0);
  });
});
