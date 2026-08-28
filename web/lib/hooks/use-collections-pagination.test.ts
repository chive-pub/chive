/**
 * Tests that a user's own collection list is complete.
 *
 * @remarks
 * `useMyCollections` asked for one page of 100 and returned it. A user with
 * more than a hundred collections saw the first hundred, with nothing in the
 * UI indicating there were more.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

import { createWrapper } from '@/tests/test-utils';

const { mockListByOwner } = vi.hoisted(() => ({ mockListByOwner: vi.fn() }));

vi.mock('@/lib/api/client', () => ({
  api: { pub: { chive: {} } },
  authApi: { pub: { chive: { collection: { listByOwner: mockListByOwner } } } },
}));

vi.mock('@/lib/auth/oauth-client', () => ({ getCurrentAgent: () => null }));

const { useMyCollections } = await import('./use-collections');

const DID = 'did:plc:owner';

function collection(id: number) {
  return { uri: `at://${DID}/pub.chive.collection.list/${id}`, name: `Collection ${id}` };
}

describe('useMyCollections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a single page unchanged', async () => {
    mockListByOwner.mockResolvedValue({ data: { collections: [collection(1)] } });

    const { result } = renderHook(() => useMyCollections(DID), {
      wrapper: createWrapper().Wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.collections).toHaveLength(1);
  });

  it('follows the cursor so a user past 100 collections sees them all', async () => {
    mockListByOwner
      .mockResolvedValueOnce({
        data: { collections: [collection(1), collection(2)], cursor: 'p1' },
      })
      .mockResolvedValueOnce({ data: { collections: [collection(3)] } });

    const { result } = renderHook(() => useMyCollections(DID), {
      wrapper: createWrapper().Wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.collections).toHaveLength(3);
    expect(mockListByOwner).toHaveBeenCalledTimes(2);
  });

  it('passes the cursor back on the following request', async () => {
    mockListByOwner
      .mockResolvedValueOnce({ data: { collections: [collection(1)], cursor: 'p1' } })
      .mockResolvedValueOnce({ data: { collections: [collection(2)] } });

    const { result } = renderHook(() => useMyCollections(DID), {
      wrapper: createWrapper().Wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockListByOwner).toHaveBeenNthCalledWith(1, { did: DID, limit: 100 });
    expect(mockListByOwner).toHaveBeenNthCalledWith(2, { did: DID, limit: 100, cursor: 'p1' });
  });

  it('does not ask again when the first page is the last', async () => {
    mockListByOwner.mockResolvedValue({ data: { collections: [collection(1)] } });

    const { result } = renderHook(() => useMyCollections(DID), {
      wrapper: createWrapper().Wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockListByOwner).toHaveBeenCalledOnce();
  });
});
