import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useShareToBluesky } from './use-share-to-bluesky';
import * as auth from '@/lib/auth';
import * as bluesky from '@/lib/bluesky';
import type { ShareContent, CreateBlueskyPostResult } from '@/lib/bluesky';
import type { ReactNode } from 'react';

// Mock auth module
vi.mock('@/lib/auth', () => ({
  useAgent: vi.fn(),
  useAuth: vi.fn(),
}));

// Mock bluesky module
vi.mock('@/lib/bluesky', () => ({
  createBlueskyPost: vi.fn(),
}));

const mockAgent = {
  did: 'did:plc:test123',
};

const mockContent: ShareContent = {
  type: 'preprint',
  url: 'https://chive.pub/preprints/test',
  title: 'Test Preprint',
  description: 'Test description',
  ogImageUrl: '/api/og?type=preprint',
};

describe('useShareToBluesky', () => {
  let queryClient: QueryClient;
  let wrapper: ({ children }: { children: ReactNode }) => ReactNode;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    // Default mocks
    vi.mocked(auth.useAgent).mockReturnValue(
      mockAgent as unknown as ReturnType<typeof auth.useAgent>
    );
    vi.mocked(auth.useAuth).mockReturnValue({ isAuthenticated: true } as ReturnType<
      typeof auth.useAuth
    >);
    vi.mocked(bluesky.createBlueskyPost).mockResolvedValue({
      uri: 'at://did:plc:test123/app.bsky.feed.post/abc123',
      cid: 'bafytest',
      rkey: 'abc123',
    });
  });

  it('returns isAuthenticated based on auth state', () => {
    const { result } = renderHook(() => useShareToBluesky(), { wrapper });
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('returns isAuthenticated false when not logged in', () => {
    vi.mocked(auth.useAuth).mockReturnValue({ isAuthenticated: false } as ReturnType<
      typeof auth.useAuth
    >);
    const { result } = renderHook(() => useShareToBluesky(), { wrapper });
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('initially not posting', () => {
    const { result } = renderHook(() => useShareToBluesky(), { wrapper });
    expect(result.current.isPosting).toBe(false);
  });

  it('initially no error', () => {
    const { result } = renderHook(() => useShareToBluesky(), { wrapper });
    expect(result.current.error).toBeNull();
  });

  it('posts to Bluesky successfully', async () => {
    const { result } = renderHook(() => useShareToBluesky(), { wrapper });

    let postResult: Awaited<ReturnType<typeof result.current.postToBluesky>>;

    await act(async () => {
      postResult = await result.current.postToBluesky('Hello world!', mockContent);
    });

    expect(postResult!.rkey).toBe('abc123');
    expect(bluesky.createBlueskyPost).toHaveBeenCalledWith(mockAgent, {
      text: 'Hello world!',
      embed: {
        uri: mockContent.url,
        title: mockContent.title,
        description: mockContent.description,
        thumbBlob: undefined,
      },
    });
  });

  it('includes thumbnail when provided', async () => {
    const { result } = renderHook(() => useShareToBluesky(), { wrapper });
    const thumbBlob = new Uint8Array([1, 2, 3]);

    await act(async () => {
      await result.current.postToBluesky('Hello!', mockContent, thumbBlob);
    });

    expect(bluesky.createBlueskyPost).toHaveBeenCalledWith(
      mockAgent,
      expect.objectContaining({
        embed: expect.objectContaining({
          thumbBlob,
        }),
      })
    );
  });

  it('calls onSuccess callback on success', async () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useShareToBluesky({ onSuccess }), { wrapper });

    await act(async () => {
      await result.current.postToBluesky('Hello!', mockContent);
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
      // React Query passes multiple args to callbacks, check the first arg contains expected data
      const firstArg = onSuccess.mock.calls[0][0];
      expect(firstArg).toEqual(expect.objectContaining({ rkey: 'abc123' }));
    });
  });

  it('calls onError callback on failure', async () => {
    const error = new Error('Post failed');
    vi.mocked(bluesky.createBlueskyPost).mockRejectedValue(error);

    const onError = vi.fn();
    const { result } = renderHook(() => useShareToBluesky({ onError }), { wrapper });

    await act(async () => {
      try {
        await result.current.postToBluesky('Hello!', mockContent);
      } catch {
        // Expected to throw
      }
    });

    await waitFor(() => {
      expect(onError).toHaveBeenCalled();
      // React Query passes multiple args to callbacks, check the first arg is the error
      const firstArg = onError.mock.calls[0][0];
      expect(firstArg).toBe(error);
    });
  });

  it('throws error when not authenticated', async () => {
    vi.mocked(auth.useAgent).mockReturnValue(null);
    const { result } = renderHook(() => useShareToBluesky(), { wrapper });

    await expect(
      act(async () => {
        await result.current.postToBluesky('Hello!', mockContent);
      })
    ).rejects.toThrow('Not authenticated');
  });

  it('sets isPosting to true while posting', async () => {
    let resolvePost: (value: CreateBlueskyPostResult) => void;
    vi.mocked(bluesky.createBlueskyPost).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePost = resolve;
        })
    );

    const { result } = renderHook(() => useShareToBluesky(), { wrapper });

    // Start posting
    act(() => {
      result.current.postToBluesky('Hello!', mockContent);
    });

    await waitFor(() => {
      expect(result.current.isPosting).toBe(true);
    });

    // Complete posting
    await act(async () => {
      resolvePost!({ uri: 'at://test', cid: 'bafytest', rkey: 'abc123' });
    });

    await waitFor(() => {
      expect(result.current.isPosting).toBe(false);
    });
  });

  it('sets error on failure', async () => {
    const error = new Error('Network error');
    vi.mocked(bluesky.createBlueskyPost).mockRejectedValue(error);

    const { result } = renderHook(() => useShareToBluesky(), { wrapper });

    await act(async () => {
      try {
        await result.current.postToBluesky('Hello!', mockContent);
      } catch {
        // Expected
      }
    });

    await waitFor(() => {
      expect(result.current.error).toEqual(error);
    });
  });
});
