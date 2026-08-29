import { describe, it, expect, vi, beforeEach } from 'vitest';

import { fetchAllPages } from './paginate';

const { mockWarn } = vi.hoisted(() => ({ mockWarn: vi.fn() }));

vi.mock('@/lib/observability', () => ({
  logger: { warn: mockWarn, info: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

describe('fetchAllPages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a single page unchanged when there is no cursor', async () => {
    const result = await fetchAllPages(async () => ({ items: [1, 2, 3] }));

    expect(result).toEqual({ items: [1, 2, 3], truncated: false });
  });

  it('follows the cursor past the first page', async () => {
    // The bug this exists for: a user with more than one page of collections
    // used to see only the first.
    const pages = [{ items: [1, 2], cursor: 'a' }, { items: [3, 4], cursor: 'b' }, { items: [5] }];
    let call = 0;

    const result = await fetchAllPages(async () => pages[call++]);

    expect(result.items).toEqual([1, 2, 3, 4, 5]);
    expect(result.truncated).toBe(false);
  });

  it('passes each page its predecessor cursor', async () => {
    const seen: Array<string | undefined> = [];
    const pages = [{ items: [1], cursor: 'a' }, { items: [2], cursor: 'b' }, { items: [3] }];
    let call = 0;

    await fetchAllPages(async (cursor) => {
      seen.push(cursor);
      return pages[call++];
    });

    expect(seen).toEqual([undefined, 'a', 'b']);
  });

  it('stops at the ceiling rather than walking forever', async () => {
    let page = 0;
    const result = await fetchAllPages(async () => ({ items: [1], cursor: `p${page++}` }), {
      maxPages: 3,
    });

    expect(result.items).toHaveLength(3);
    expect(result.truncated).toBe(true);
  });

  it('says out loud that it truncated, so a cap is never silent', async () => {
    let page = 0;
    await fetchAllPages(async () => ({ items: [1], cursor: `p${page++}` }), {
      maxPages: 2,
      label: 'collections',
    });

    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringContaining('incomplete'),
      expect.objectContaining({ label: 'collections', items: 2 })
    );
  });

  it('does not warn when the walk finished on its own', async () => {
    await fetchAllPages(async () => ({ items: [1] }), { label: 'collections' });

    expect(mockWarn).not.toHaveBeenCalled();
  });

  it('stops when a server repeats a cursor instead of looping on it', async () => {
    // Not the ceiling: this terminates immediately and is not a truncation.
    const result = await fetchAllPages(async () => ({ items: [1], cursor: 'same' }), {
      maxPages: 100,
    });

    expect(result.items).toEqual([1, 1]);
    expect(result.truncated).toBe(false);
    expect(mockWarn).not.toHaveBeenCalled();
  });

  it('stops on an empty page even when a cursor comes with it', async () => {
    const result = await fetchAllPages(async () => ({ items: [], cursor: 'next' }));

    expect(result).toEqual({ items: [], truncated: false });
  });

  it('lets a failure propagate rather than returning a partial list as complete', async () => {
    let call = 0;
    await expect(
      fetchAllPages(async () => {
        if (call++ === 1) throw new Error('network');
        return { items: [1], cursor: 'a' };
      })
    ).rejects.toThrow('network');
  });
});
