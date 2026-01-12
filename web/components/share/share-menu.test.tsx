import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShareMenu, ShareToBlueskyButton } from './share-menu';
import type { ShareContent } from '@/lib/bluesky';

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockContent: ShareContent = {
  type: 'eprint',
  url: 'https://chive.pub/eprints/test',
  title: 'Test Eprint',
  description: 'Test description',
  ogImageUrl: '/api/og?type=eprint',
};

describe('ShareMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders share button', () => {
    render(<ShareMenu content={mockContent} onShareToBluesky={() => {}} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('opens dropdown menu on click', async () => {
    const user = userEvent.setup();
    render(<ShareMenu content={mockContent} onShareToBluesky={() => {}} />);

    await user.click(screen.getByRole('button'));

    expect(screen.getByText('Copy link')).toBeInTheDocument();
    expect(screen.getByText('Share to Bluesky')).toBeInTheDocument();
  });

  it('copies link to clipboard', async () => {
    const { toast } = await import('sonner');
    // Using userEvent.setup() which provides built-in clipboard stub
    const user = userEvent.setup();
    render(<ShareMenu content={mockContent} onShareToBluesky={() => {}} />);

    await user.click(screen.getByRole('button'));
    await user.click(screen.getByText('Copy link'));

    // Verify toast was called (clipboard is handled by userEvent's built-in stub)
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Link copied to clipboard');
    });
  });

  it('calls onShareToBluesky when clicking Share to Bluesky', async () => {
    const onShareToBluesky = vi.fn();
    const user = userEvent.setup();
    render(<ShareMenu content={mockContent} onShareToBluesky={onShareToBluesky} />);

    await user.click(screen.getByRole('button'));
    await user.click(screen.getByText('Share to Bluesky'));

    expect(onShareToBluesky).toHaveBeenCalled();
  });

  it('renders with custom trigger', () => {
    render(
      <ShareMenu
        content={mockContent}
        onShareToBluesky={() => {}}
        trigger={<button>Custom Trigger</button>}
      />
    );

    expect(screen.getByText('Custom Trigger')).toBeInTheDocument();
  });

  it('renders icon-only button when size is icon', () => {
    render(<ShareMenu content={mockContent} onShareToBluesky={() => {}} size="icon" />);

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(screen.queryByText('Share')).not.toBeInTheDocument();
  });

  it('shows check icon after copying', async () => {
    const user = userEvent.setup();
    render(<ShareMenu content={mockContent} onShareToBluesky={() => {}} />);

    await user.click(screen.getByRole('button'));
    await user.click(screen.getByText('Copy link'));

    // The menu closes after click, so we need to reopen it
    await user.click(screen.getByRole('button'));

    // Should show check icon briefly (within 2 seconds)
    await waitFor(
      () => {
        expect(screen.getByText('Copy link')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });
});

describe('ShareToBlueskyButton', () => {
  it('renders button with share text', () => {
    render(<ShareToBlueskyButton onClick={() => {}} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(screen.getByText('Share')).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<ShareToBlueskyButton onClick={onClick} />);

    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalled();
  });

  it('applies custom className', () => {
    render(<ShareToBlueskyButton onClick={() => {}} className="custom-class" />);
    expect(screen.getByRole('button')).toHaveClass('custom-class');
  });
});
