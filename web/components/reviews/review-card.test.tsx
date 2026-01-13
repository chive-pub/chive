import { render, screen } from '@/tests/test-utils';
import userEvent from '@testing-library/user-event';
import { ReviewCard, ReviewCardSkeleton } from './review-card';
import { createMockReview, createMockInlineReview, createMockAuthor } from '@/tests/mock-data';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('ReviewCard', () => {
  // Plain text review (no rich body)
  const plainTextReview = createMockReview({
    author: createMockAuthor({
      did: 'did:plc:reviewer1',
      displayName: 'Dr. Reviewer',
      handle: 'reviewer.bsky.social',
      avatar: 'https://example.com/avatar.jpg',
    }),
    content: 'This is an excellent methodology.',
    body: undefined, // No rich body, use plain text
    createdAt: '2024-06-15T10:30:00Z',
    motivation: 'commenting',
  });

  // Rich text review (default mock includes rich body)
  const richTextReview = createMockReview({
    author: createMockAuthor({
      did: 'did:plc:reviewer1',
      displayName: 'Dr. Reviewer',
      handle: 'reviewer.bsky.social',
      avatar: 'https://example.com/avatar.jpg',
    }),
    createdAt: '2024-06-15T10:30:00Z',
    motivation: 'commenting',
  });

  describe('rendering', () => {
    it('renders review card with plain text content', () => {
      render(<ReviewCard review={plainTextReview} />);

      expect(screen.getByTestId('review-card')).toBeInTheDocument();
      expect(screen.getByText('Dr. Reviewer')).toBeInTheDocument();
      expect(screen.getByText('This is an excellent methodology.')).toBeInTheDocument();
    });

    it('renders review card with rich text body', () => {
      render(<ReviewCard review={richTextReview} />);

      expect(screen.getByTestId('review-card')).toBeInTheDocument();
      expect(screen.getByText('Dr. Reviewer')).toBeInTheDocument();
      // Rich body contains text and Wikidata reference
      expect(screen.getByTestId('annotation-body')).toBeInTheDocument();
      expect(screen.getByText('Machine Learning')).toBeInTheDocument();
    });

    it('renders reviewer avatar or fallback', () => {
      render(<ReviewCard review={plainTextReview} />);

      // Avatar renders either the image (if loaded) or fallback initials
      // In tests, image doesn't load so we check for the fallback which shows initials
      const avatarContainer = screen.getByText('DR'); // "Dr. Reviewer" → "DR"
      expect(avatarContainer).toBeInTheDocument();
    });

    it('links to reviewer profile', () => {
      render(<ReviewCard review={plainTextReview} />);

      const links = screen.getAllByRole('link');
      expect(links[0]).toHaveAttribute('href', '/authors/did%3Aplc%3Areviewer1');
    });

    it('shows relative date', () => {
      render(<ReviewCard review={plainTextReview} />);

      const time = screen.getByRole('time');
      expect(time).toHaveAttribute('dateTime', '2024-06-15T10:30:00Z');
    });

    it('shows edited indicator when indexedAt differs from createdAt', () => {
      const editedReview = createMockReview({
        createdAt: '2024-06-15T10:30:00Z',
        indexedAt: '2024-06-15T11:00:00Z',
      });

      render(<ReviewCard review={editedReview} />);

      expect(screen.getByText(/edited/i)).toBeInTheDocument();
    });

    it('stores review URI in data attribute', () => {
      render(<ReviewCard review={plainTextReview} />);

      expect(screen.getByTestId('review-card')).toHaveAttribute(
        'data-review-uri',
        plainTextReview.uri
      );
    });
  });

  describe('motivation badges', () => {
    it('shows question badge for questioning motivation', () => {
      const questionReview = createMockReview({ motivation: 'questioning' });
      render(<ReviewCard review={questionReview} />);

      expect(screen.getByText('Question')).toBeInTheDocument();
    });

    it('shows reply badge for replying motivation', () => {
      const replyReview = createMockReview({ motivation: 'replying' });
      render(<ReviewCard review={replyReview} />);

      expect(screen.getByText('Reply')).toBeInTheDocument();
    });

    it('does not show badge for commenting motivation (default)', () => {
      const commentReview = createMockReview({ motivation: 'commenting' });
      render(<ReviewCard review={commentReview} />);

      expect(screen.queryByText('Comment')).not.toBeInTheDocument();
    });
  });

  describe('target span display', () => {
    it('shows target span excerpt when present', () => {
      const inlineReview = createMockInlineReview({
        target: {
          source: 'at://test/eprint/1',
          selector: {
            type: 'TextQuoteSelector',
            exact: 'neural network architecture',
          },
        },
      });

      render(<ReviewCard review={inlineReview} showTarget />);

      expect(screen.getByText(/neural network architecture/)).toBeInTheDocument();
    });

    it('hides target span when showTarget is false', () => {
      const inlineReview = createMockInlineReview();
      render(<ReviewCard review={inlineReview} showTarget={false} />);

      expect(screen.queryByText(/neural network architecture/)).not.toBeInTheDocument();
    });
  });

  describe('variants', () => {
    it('renders default variant with full styling', () => {
      render(<ReviewCard review={plainTextReview} variant="default" />);

      expect(screen.getByTestId('review-card')).toHaveClass('rounded-lg', 'border', 'p-4');
    });

    it('renders compact variant with reduced padding', () => {
      render(<ReviewCard review={plainTextReview} variant="compact" />);

      expect(screen.getByTestId('review-card')).toHaveClass('py-3');
    });

    it('applies depth styling for nested replies', () => {
      render(<ReviewCard review={plainTextReview} depth={1} />);

      expect(screen.getByTestId('review-card')).toHaveClass('ml-4');
    });
  });

  describe('content truncation', () => {
    it('truncates long plain text content in default variant', () => {
      const longContent = 'A'.repeat(600);
      const longReview = createMockReview({ content: longContent, body: undefined });

      render(<ReviewCard review={longReview} />);

      expect(screen.getByText(/\.\.\.$/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /read more/i })).toBeInTheDocument();
    });

    it('expands plain text content when Read more clicked', async () => {
      const user = userEvent.setup();
      const longContent = 'A'.repeat(600);
      const longReview = createMockReview({ content: longContent, body: undefined });

      render(<ReviewCard review={longReview} />);

      await user.click(screen.getByRole('button', { name: /read more/i }));

      // After expansion, full content should be visible and button should be gone
      expect(screen.queryByRole('button', { name: /read more/i })).not.toBeInTheDocument();
    });
  });

  describe('actions', () => {
    it('shows reply button when onReply provided', async () => {
      const user = userEvent.setup();
      const onReply = vi.fn();
      render(<ReviewCard review={plainTextReview} onReply={onReply} />);

      // Hover to show actions
      await user.hover(screen.getByTestId('review-card'));

      // Open dropdown
      await user.click(screen.getByRole('button', { name: /review actions/i }));

      expect(screen.getByRole('menuitem', { name: /reply/i })).toBeInTheDocument();
    });

    it('calls onReply when reply clicked', async () => {
      const user = userEvent.setup();
      const onReply = vi.fn();
      render(<ReviewCard review={plainTextReview} onReply={onReply} />);

      await user.hover(screen.getByTestId('review-card'));
      await user.click(screen.getByRole('button', { name: /review actions/i }));
      await user.click(screen.getByRole('menuitem', { name: /reply/i }));

      expect(onReply).toHaveBeenCalledTimes(1);
    });

    it('shows edit button for owner', async () => {
      const user = userEvent.setup();
      const onEdit = vi.fn();
      render(<ReviewCard review={plainTextReview} isOwner onEdit={onEdit} />);

      await user.hover(screen.getByTestId('review-card'));
      await user.click(screen.getByRole('button', { name: /review actions/i }));

      expect(screen.getByRole('menuitem', { name: /edit/i })).toBeInTheDocument();
    });

    it('shows delete button for owner', async () => {
      const user = userEvent.setup();
      const onDelete = vi.fn();
      render(<ReviewCard review={plainTextReview} isOwner onDelete={onDelete} />);

      await user.hover(screen.getByTestId('review-card'));
      await user.click(screen.getByRole('button', { name: /review actions/i }));

      expect(screen.getByRole('menuitem', { name: /delete/i })).toBeInTheDocument();
    });

    it('hides owner actions when not owner', async () => {
      const user = userEvent.setup();
      const onEdit = vi.fn();
      const onDelete = vi.fn();
      render(
        <ReviewCard review={plainTextReview} isOwner={false} onEdit={onEdit} onDelete={onDelete} />
      );

      await user.hover(screen.getByTestId('review-card'));
      await user.click(screen.getByRole('button', { name: /review actions/i }));

      expect(screen.queryByRole('menuitem', { name: /edit/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: /delete/i })).not.toBeInTheDocument();
    });

    it('shows inline reply button in default variant', () => {
      const onReply = vi.fn();
      render(<ReviewCard review={plainTextReview} onReply={onReply} variant="default" />);

      expect(screen.getByRole('button', { name: /reply/i })).toBeInTheDocument();
    });
  });

  describe('fallbacks', () => {
    it('falls back to handle when displayName is empty', () => {
      const noNameReview = createMockReview({
        body: undefined,
        author: createMockAuthor({
          displayName: '',
          handle: 'user.bsky.social',
        }),
      });

      render(<ReviewCard review={noNameReview} />);

      expect(screen.getByText('user.bsky.social')).toBeInTheDocument();
    });

    it('shows Anonymous when no name or handle', () => {
      const anonReview = createMockReview({
        body: undefined,
        author: createMockAuthor({
          displayName: '',
          handle: '',
        }),
      });

      render(<ReviewCard review={anonReview} />);

      expect(screen.getByText('Anonymous')).toBeInTheDocument();
    });
  });

  describe('rich text body', () => {
    it('renders rich text body when present', () => {
      const richReview = createMockReview({
        body: {
          text: 'See Machine Learning',
          facets: [
            {
              index: { byteStart: 4, byteEnd: 20 },
              features: [
                {
                  $type: 'app.bsky.richtext.facet#link',
                  uri: 'https://www.wikidata.org/wiki/Q2539',
                },
              ],
            },
          ],
        },
      });

      render(<ReviewCard review={richReview} />);

      // The review card displays content, body is used for rich text if present
      expect(screen.getByTestId('review-card')).toBeInTheDocument();
    });
  });
});

describe('ReviewCardSkeleton', () => {
  it('renders default variant skeleton', () => {
    render(<ReviewCardSkeleton />);

    expect(screen.getByTestId('review-card-skeleton')).toBeInTheDocument();
    expect(screen.getByTestId('review-card-skeleton')).toHaveClass('rounded-lg', 'border', 'p-4');
  });

  it('renders compact variant skeleton', () => {
    render(<ReviewCardSkeleton variant="compact" />);

    expect(screen.getByTestId('review-card-skeleton')).toHaveClass('py-3');
  });

  it('has animation class', () => {
    render(<ReviewCardSkeleton />);

    expect(screen.getByTestId('review-card-skeleton')).toHaveClass('animate-pulse');
  });
});
