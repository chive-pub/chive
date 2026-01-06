import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { useBacklinks, useBacklinkCounts, backlinkKeys, type Backlink } from './use-backlinks';

// Mock functions using vi.hoisted for proper hoisting
const { mockGet } = vi.hoisted(() => ({
  mockGet: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  api: {
    GET: mockGet,
  },
}));

// Test wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

// Sample backlink data
const mockBacklinks: Backlink[] = [
  {
    id: 1,
    sourceUri: 'at://did:plc:abc123/semble.collection/xyz',
    sourceType: 'semble.collection',
    targetUri: 'at://did:plc:user1/pub.chive.preprint/paper1',
    context: 'Added to "Machine Learning Papers" collection',
    indexedAt: '2024-01-15T10:30:00Z',
    deleted: false,
  },
  {
    id: 2,
    sourceUri: 'at://did:plc:def456/app.bsky.feed.post/abc',
    sourceType: 'bluesky.post',
    targetUri: 'at://did:plc:user1/pub.chive.preprint/paper1',
    context: 'This paper is groundbreaking!',
    indexedAt: '2024-01-16T14:00:00Z',
    deleted: false,
  },
];

const mockCounts = {
  sembleCollections: 3,
  blueskyPosts: 5,
  blueskyEmbeds: 2,
  whitewindBlogs: 1,
  leafletLists: 0,
  other: 0,
  total: 11,
};

describe('useBacklinks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReset();
  });

  it('should fetch backlinks for a preprint', async () => {
    mockGet.mockResolvedValueOnce({
      data: { backlinks: mockBacklinks, hasMore: false },
      error: undefined,
    });

    const { result } = renderHook(
      () => useBacklinks('at://did:plc:user1/pub.chive.preprint/paper1'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.pages[0].backlinks).toEqual(mockBacklinks);
    expect(mockGet).toHaveBeenCalledWith('/xrpc/pub.chive.backlink.list', {
      params: {
        query: expect.objectContaining({
          targetUri: 'at://did:plc:user1/pub.chive.preprint/paper1',
        }),
      },
    });
  });

  it('should filter by source type', async () => {
    mockGet.mockResolvedValueOnce({
      data: { backlinks: [mockBacklinks[0]], hasMore: false },
      error: undefined,
    });

    const { result } = renderHook(
      () =>
        useBacklinks('at://did:plc:user1/pub.chive.preprint/paper1', {
          sourceType: 'semble.collection',
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/xrpc/pub.chive.backlink.list', {
      params: {
        query: expect.objectContaining({
          sourceType: 'semble.collection',
        }),
      },
    });
  });

  it('should not fetch when disabled', () => {
    renderHook(
      () =>
        useBacklinks('at://did:plc:user1/pub.chive.preprint/paper1', {
          enabled: false,
        }),
      { wrapper: createWrapper() }
    );

    expect(mockGet).not.toHaveBeenCalled();
  });

  it('should handle pagination', async () => {
    mockGet
      .mockResolvedValueOnce({
        data: { backlinks: [mockBacklinks[0]], cursor: 'cursor1', hasMore: true },
        error: undefined,
      })
      .mockResolvedValueOnce({
        data: { backlinks: [mockBacklinks[1]], hasMore: false },
        error: undefined,
      });

    const { result } = renderHook(
      () =>
        useBacklinks('at://did:plc:user1/pub.chive.preprint/paper1', {
          limit: 1,
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);

    result.current.fetchNextPage();

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
  });
});

describe('useBacklinkCounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReset();
  });

  it('should fetch backlink counts', async () => {
    mockGet.mockResolvedValueOnce({
      data: mockCounts,
      error: undefined,
    });

    const { result } = renderHook(
      () => useBacklinkCounts('at://did:plc:user1/pub.chive.preprint/paper1'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockCounts);
    expect(result.current.data?.total).toBe(11);
    expect(mockGet).toHaveBeenCalledWith('/xrpc/pub.chive.backlink.getCounts', {
      params: {
        query: { targetUri: 'at://did:plc:user1/pub.chive.preprint/paper1' },
      },
    });
  });

  it('should not fetch when disabled', () => {
    renderHook(
      () =>
        useBacklinkCounts('at://did:plc:user1/pub.chive.preprint/paper1', {
          enabled: false,
        }),
      { wrapper: createWrapper() }
    );

    expect(mockGet).not.toHaveBeenCalled();
  });
});

describe('backlinkKeys', () => {
  it('should generate correct query keys', () => {
    expect(backlinkKeys.all).toEqual(['backlinks']);

    expect(backlinkKeys.list('at://did:plc:user1/pub.chive.preprint/paper1')).toEqual([
      'backlinks',
      'list',
      'at://did:plc:user1/pub.chive.preprint/paper1',
      undefined,
    ]);

    expect(
      backlinkKeys.list('at://did:plc:user1/pub.chive.preprint/paper1', {
        sourceType: 'semble.collection',
        limit: 10,
      })
    ).toEqual([
      'backlinks',
      'list',
      'at://did:plc:user1/pub.chive.preprint/paper1',
      { sourceType: 'semble.collection', limit: 10 },
    ]);

    expect(backlinkKeys.counts('at://did:plc:user1/pub.chive.preprint/paper1')).toEqual([
      'backlinks',
      'counts',
      'at://did:plc:user1/pub.chive.preprint/paper1',
    ]);
  });
});
