import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShareToBlueskyDialog } from './share-to-bluesky-dialog';
import type { ShareContent } from '@/lib/bluesky';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock fetch for OG image
beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3]).buffer),
  });
});

const mockContent: ShareContent = {
  type: 'eprint',
  url: 'https://chive.pub/eprints/test',
  title: 'Test Eprint',
  description: 'Test description',
  ogImageUrl: '/api/og?type=eprint',
};

const mockUser = {
  did: 'did:plc:test123',
  displayName: 'Test User',
  handle: 'testuser.bsky.social',
  avatar: 'https://example.com/avatar.jpg',
};

describe('ShareToBlueskyDialog', () => {
  it('renders nothing when not open', () => {
    const { container } = render(
      <ShareToBlueskyDialog
        open={false}
        onOpenChange={() => {}}
        content={mockContent}
        user={mockUser}
        onSubmit={async () => ({ rkey: 'abc123' })}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders dialog when open', () => {
    render(
      <ShareToBlueskyDialog
        open={true}
        onOpenChange={() => {}}
        content={mockContent}
        user={mockUser}
        onSubmit={async () => ({ rkey: 'abc123' })}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Share to Bluesky')).toBeInTheDocument();
  });

  it('displays user information', () => {
    render(
      <ShareToBlueskyDialog
        open={true}
        onOpenChange={() => {}}
        content={mockContent}
        user={mockUser}
        onSubmit={async () => ({ rkey: 'abc123' })}
      />
    );

    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('@testuser.bsky.social')).toBeInTheDocument();
  });

  it('shows composer textarea', () => {
    render(
      <ShareToBlueskyDialog
        open={true}
        onOpenChange={() => {}}
        content={mockContent}
        user={mockUser}
        onSubmit={async () => ({ rkey: 'abc123' })}
      />
    );

    expect(screen.getByPlaceholderText("What's on your mind?")).toBeInTheDocument();
  });

  it('shows grapheme counter', () => {
    render(
      <ShareToBlueskyDialog
        open={true}
        onOpenChange={() => {}}
        content={mockContent}
        user={mockUser}
        onSubmit={async () => ({ rkey: 'abc123' })}
      />
    );

    expect(screen.getByText('0/300')).toBeInTheDocument();
  });

  it('shows post preview', async () => {
    render(
      <ShareToBlueskyDialog
        open={true}
        onOpenChange={() => {}}
        content={mockContent}
        user={mockUser}
        onSubmit={async () => ({ rkey: 'abc123' })}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Preview')).toBeInTheDocument();
    });
  });

  it('disables Post button when text is empty', () => {
    render(
      <ShareToBlueskyDialog
        open={true}
        onOpenChange={() => {}}
        content={mockContent}
        user={mockUser}
        onSubmit={async () => ({ rkey: 'abc123' })}
      />
    );

    const postButton = screen.getByRole('button', { name: /post/i });
    expect(postButton).toBeDisabled();
  });

  it('enables Post button when text is entered', async () => {
    const user = userEvent.setup();
    render(
      <ShareToBlueskyDialog
        open={true}
        onOpenChange={() => {}}
        content={mockContent}
        user={mockUser}
        onSubmit={async () => ({ rkey: 'abc123' })}
      />
    );

    const textarea = screen.getByPlaceholderText("What's on your mind?");
    await user.type(textarea, 'Hello world!');

    const postButton = screen.getByRole('button', { name: /post/i });
    expect(postButton).not.toBeDisabled();
  });

  it('calls onSubmit with text when Post is clicked', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ rkey: 'abc123' });
    const user = userEvent.setup();

    render(
      <ShareToBlueskyDialog
        open={true}
        onOpenChange={() => {}}
        content={mockContent}
        user={mockUser}
        onSubmit={onSubmit}
      />
    );

    // Wait for image to load
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    const textarea = screen.getByPlaceholderText("What's on your mind?");
    await user.type(textarea, 'Hello world!');

    const postButton = screen.getByRole('button', { name: /post/i });
    await user.click(postButton);

    expect(onSubmit).toHaveBeenCalledWith('Hello world!', expect.any(Uint8Array));
  });

  it('shows loading state while posting', async () => {
    const onSubmit = vi
      .fn()
      .mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ rkey: 'abc123' }), 100))
      );
    const user = userEvent.setup();

    render(
      <ShareToBlueskyDialog
        open={true}
        onOpenChange={() => {}}
        content={mockContent}
        user={mockUser}
        onSubmit={onSubmit}
      />
    );

    // Wait for image to load
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    const textarea = screen.getByPlaceholderText("What's on your mind?");
    await user.type(textarea, 'Hello');

    const postButton = screen.getByRole('button', { name: /post/i });
    await user.click(postButton);

    expect(screen.getByText('Posting...')).toBeInTheDocument();
  });

  it('shows success toast on successful post', async () => {
    const { toast } = await import('sonner');
    const onSubmit = vi.fn().mockResolvedValue({ rkey: 'abc123' });
    const user = userEvent.setup();

    render(
      <ShareToBlueskyDialog
        open={true}
        onOpenChange={() => {}}
        content={mockContent}
        user={mockUser}
        onSubmit={onSubmit}
      />
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    const textarea = screen.getByPlaceholderText("What's on your mind?");
    await user.type(textarea, 'Hello');

    const postButton = screen.getByRole('button', { name: /post/i });
    await user.click(postButton);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Posted to Bluesky', expect.anything());
    });
  });

  it('shows error toast on failed post', async () => {
    const { toast } = await import('sonner');
    const onSubmit = vi.fn().mockRejectedValue(new Error('Failed to post'));
    const user = userEvent.setup();

    render(
      <ShareToBlueskyDialog
        open={true}
        onOpenChange={() => {}}
        content={mockContent}
        user={mockUser}
        onSubmit={onSubmit}
      />
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    const textarea = screen.getByPlaceholderText("What's on your mind?");
    await user.type(textarea, 'Hello');

    const postButton = screen.getByRole('button', { name: /post/i });
    await user.click(postButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to post');
    });
  });

  it('closes dialog when Cancel is clicked', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    render(
      <ShareToBlueskyDialog
        open={true}
        onOpenChange={onOpenChange}
        content={mockContent}
        user={mockUser}
        onSubmit={async () => ({ rkey: 'abc123' })}
      />
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('closes dialog when X button is clicked', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    render(
      <ShareToBlueskyDialog
        open={true}
        onOpenChange={onOpenChange}
        content={mockContent}
        user={mockUser}
        onSubmit={async () => ({ rkey: 'abc123' })}
      />
    );

    const closeButton = screen.getByRole('button', { name: /close/i });
    await user.click(closeButton);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('closes dialog on Escape key', async () => {
    const onOpenChange = vi.fn();

    render(
      <ShareToBlueskyDialog
        open={true}
        onOpenChange={onOpenChange}
        content={mockContent}
        user={mockUser}
        onSubmit={async () => ({ rkey: 'abc123' })}
      />
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('closes dialog on backdrop click', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    render(
      <ShareToBlueskyDialog
        open={true}
        onOpenChange={onOpenChange}
        content={mockContent}
        user={mockUser}
        onSubmit={async () => ({ rkey: 'abc123' })}
      />
    );

    // Click the backdrop
    const backdrop = document.querySelector('[aria-hidden="true"]');
    if (backdrop) {
      await user.click(backdrop);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    }
  });

  it('updates grapheme counter as user types', async () => {
    const user = userEvent.setup();

    render(
      <ShareToBlueskyDialog
        open={true}
        onOpenChange={() => {}}
        content={mockContent}
        user={mockUser}
        onSubmit={async () => ({ rkey: 'abc123' })}
      />
    );

    const textarea = screen.getByPlaceholderText("What's on your mind?");
    await user.type(textarea, 'Hello');

    expect(screen.getByText('5/300')).toBeInTheDocument();
  });

  it('resets text when dialog reopens', async () => {
    const { rerender } = render(
      <ShareToBlueskyDialog
        open={true}
        onOpenChange={() => {}}
        content={mockContent}
        user={mockUser}
        onSubmit={async () => ({ rkey: 'abc123' })}
      />
    );

    const textarea = screen.getByPlaceholderText("What's on your mind?");
    fireEvent.change(textarea, { target: { value: 'Hello' } });

    // Close and reopen
    rerender(
      <ShareToBlueskyDialog
        open={false}
        onOpenChange={() => {}}
        content={mockContent}
        user={mockUser}
        onSubmit={async () => ({ rkey: 'abc123' })}
      />
    );

    rerender(
      <ShareToBlueskyDialog
        open={true}
        onOpenChange={() => {}}
        content={mockContent}
        user={mockUser}
        onSubmit={async () => ({ rkey: 'abc123' })}
      />
    );

    expect(screen.getByText('0/300')).toBeInTheDocument();
  });
});
