import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useMentionAutocomplete, type ActorSuggestion } from './use-mention-autocomplete';

const mockActors: ActorSuggestion[] = [
  {
    did: 'did:plc:user1',
    handle: 'alice.bsky.social',
    displayName: 'Alice',
    avatar: 'https://example.com/alice.jpg',
  },
  {
    did: 'did:plc:user2',
    handle: 'bob.bsky.social',
    displayName: 'Bob',
  },
];

// Longer timeout for debounced operations
const DEBOUNCE_WAIT = 500;

describe('useMentionAutocomplete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure real timers are used
    vi.useRealTimers();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ actors: mockActors }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('returns empty suggestions initially', () => {
    const { result } = renderHook(() => useMentionAutocomplete());
    expect(result.current.suggestions).toEqual([]);
  });

  it('returns isLoading false initially', () => {
    const { result } = renderHook(() => useMentionAutocomplete());
    expect(result.current.isLoading).toBe(false);
  });

  it('searches for actors after debounce', async () => {
    // Use short debounce for faster tests
    const { result } = renderHook(() => useMentionAutocomplete(50));

    act(() => {
      result.current.search('alice');
    });

    // Wait for debounce and fetch
    await waitFor(
      () => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('app.bsky.actor.searchActorsTypeahead?q=alice')
        );
      },
      { timeout: DEBOUNCE_WAIT }
    );
  });

  it('updates suggestions after search', async () => {
    const { result } = renderHook(() => useMentionAutocomplete(50));

    act(() => {
      result.current.search('alice');
    });

    await waitFor(
      () => {
        expect(result.current.suggestions).toEqual(mockActors);
      },
      { timeout: DEBOUNCE_WAIT }
    );
  });

  it('clears suggestions when clear is called', async () => {
    const { result } = renderHook(() => useMentionAutocomplete(50));

    act(() => {
      result.current.search('alice');
    });

    // Wait for suggestions to be populated
    await waitFor(
      () => {
        expect(result.current.suggestions.length).toBeGreaterThan(0);
      },
      { timeout: DEBOUNCE_WAIT }
    );

    act(() => {
      result.current.clear();
    });

    expect(result.current.suggestions).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('handles empty query', async () => {
    const { result } = renderHook(() => useMentionAutocomplete(50));

    act(() => {
      result.current.search('');
    });

    // Wait a bit to ensure debounce could have fired
    await new Promise((r) => setTimeout(r, 150));

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.suggestions).toEqual([]);
  });

  it('handles network errors gracefully', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useMentionAutocomplete(50));

    act(() => {
      result.current.search('alice');
    });

    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.suggestions).toEqual([]);
      },
      { timeout: DEBOUNCE_WAIT }
    );
  });

  it('handles non-ok responses', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    const { result } = renderHook(() => useMentionAutocomplete(50));

    act(() => {
      result.current.search('alice');
    });

    await waitFor(
      () => {
        expect(result.current.suggestions).toEqual([]);
      },
      { timeout: DEBOUNCE_WAIT }
    );
  });

  it('uses correct limit parameter', async () => {
    const { result } = renderHook(() => useMentionAutocomplete(50));

    act(() => {
      result.current.search('alice');
    });

    await waitFor(
      () => {
        expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('limit=8'));
      },
      { timeout: DEBOUNCE_WAIT }
    );
  });
});
