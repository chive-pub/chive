import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MentionPopover, type ActorSuggestion } from './mention-popover';
import type { AutocompleteTrigger } from './bluesky-composer';

// Mock the fetch API
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

describe('MentionPopover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ actors: mockActors }),
    });
  });

  const baseTrigger: AutocompleteTrigger = {
    type: 'mention',
    query: 'ali',
    startIndex: 0,
    cursorPosition: 4,
    position: { top: 100, left: 50 },
  };

  it('renders nothing when trigger is null', () => {
    const { container } = render(
      <MentionPopover trigger={null} onSelect={() => {}} onClose={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing for hashtag triggers', () => {
    const hashtagTrigger: AutocompleteTrigger = {
      ...baseTrigger,
      type: 'hashtag',
      query: 'science',
    };
    const { container } = render(
      <MentionPopover trigger={hashtagTrigger} onSelect={() => {}} onClose={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows loading state while fetching', async () => {
    // Delay the fetch response significantly
    let resolvePromise: (value: unknown) => void;
    global.fetch = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePromise = resolve;
        })
    );

    const { container } = render(
      <MentionPopover trigger={baseTrigger} onSelect={() => {}} onClose={() => {}} />
    );

    // Wait for the debounced search to trigger and show loading state
    await waitFor(
      () => {
        const spinner = container.querySelector('.animate-spin');
        expect(spinner).toBeInTheDocument();
      },
      { timeout: 500 }
    );

    // Resolve the promise to clean up
    resolvePromise!({
      ok: true,
      json: () => Promise.resolve({ actors: mockActors }),
    });
  });

  it('displays actor suggestions after fetch', async () => {
    render(<MentionPopover trigger={baseTrigger} onSelect={() => {}} onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('@alice.bsky.social')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });
  });

  it('shows no users found when no results', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ actors: [] }),
    });

    render(<MentionPopover trigger={baseTrigger} onSelect={() => {}} onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('No users found')).toBeInTheDocument();
    });
  });

  it('calls onSelect when clicking a suggestion', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();

    render(<MentionPopover trigger={baseTrigger} onSelect={onSelect} onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Alice'));

    expect(onSelect).toHaveBeenCalledWith(mockActors[0]);
  });

  it('navigates with arrow keys', async () => {
    render(<MentionPopover trigger={baseTrigger} onSelect={() => {}} onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    // First item should be selected by default
    const firstItem = screen.getByRole('option', { selected: true });
    expect(firstItem).toHaveTextContent('Alice');

    // Press arrow down - wrap in act for proper React state update scheduling
    await act(async () => {
      fireEvent.keyDown(document, { key: 'ArrowDown' });
    });

    await waitFor(
      () => {
        const selectedItem = screen.getByRole('option', { selected: true });
        expect(selectedItem).toHaveTextContent('Bob');
      },
      { timeout: 3000 }
    );
  });

  it('selects with Enter key', async () => {
    const onSelect = vi.fn();

    render(<MentionPopover trigger={baseTrigger} onSelect={onSelect} onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    fireEvent.keyDown(document, { key: 'Enter' });

    expect(onSelect).toHaveBeenCalledWith(mockActors[0]);
  });

  it('closes on Escape key', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(<MentionPopover trigger={baseTrigger} onSelect={() => {}} onClose={onClose} />);

    // Wait for suggestions to load
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    // Use userEvent which properly handles React state updates
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('positions popover at trigger position', async () => {
    const { container } = render(
      <MentionPopover trigger={baseTrigger} onSelect={() => {}} onClose={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    const popover = container.firstChild as HTMLElement;
    expect(popover.style.top).toBe('100px');
    expect(popover.style.left).toBe('50px');
  });

  it('handles network errors gracefully', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    render(<MentionPopover trigger={baseTrigger} onSelect={() => {}} onClose={() => {}} />);

    // Should show empty state, not crash
    await waitFor(() => {
      expect(screen.getByText('No users found')).toBeInTheDocument();
    });
  });

  it('displays avatar when available', async () => {
    render(<MentionPopover trigger={baseTrigger} onSelect={() => {}} onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    const avatarImg = screen.getByAltText('');
    expect(avatarImg).toHaveAttribute('src', 'https://example.com/alice.jpg');
  });
});
