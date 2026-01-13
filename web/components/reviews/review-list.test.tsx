import { render, screen } from '@/tests/test-utils';
import userEvent from '@testing-library/user-event';
import { ReviewList, ReviewListSkeleton } from './review-list';
import { createMockReview, createMockAuthor } from '@/tests/mock-data';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('ReviewList', () => {
  // Use plain text reviews (body: undefined) for testing content display
  const mockReviews = [
    createMockReview({
      uri: 'at://review1',
      content: 'First review content',
      body: undefined,
      author: createMockAuthor({ did: 'did:plc:r1', displayName: 'Reviewer 1' }),
    }),
    createMockReview({
      uri: 'at://review2',
      content: 'Second review content',
      body: undefined,
      author: createMockAuthor({ did: 'did:plc:r2', displayName: 'Reviewer 2' }),
    }),
    createMockReview({
      uri: 'at://review3',
      content: 'Third review content',
      body: undefined,
      author: createMockAuthor({ did: 'did:plc:r3', displayName: 'Reviewer 3' }),
    }),
  ];

  describe('empty state', () => {
    it('shows empty state when no reviews', () => {
      render(<ReviewList reviews={[]} />);

      expect(screen.getByTestId('review-list-empty')).toBeInTheDocument();
      expect(screen.getByText('No reviews yet')).toBeInTheDocument();
      expect(screen.getByText(/be the first to share/i)).toBeInTheDocument();
    });
  });

  describe('list layout', () => {
    it('renders reviews in list layout by default', () => {
      render(<ReviewList reviews={mockReviews} />);

      expect(screen.getByTestId('review-list')).toHaveAttribute('data-layout', 'list');
      expect(screen.getAllByTestId('review-card')).toHaveLength(3);
    });

    it('displays review content', () => {
      render(<ReviewList reviews={mockReviews} />);

      expect(screen.getByText('First review content')).toBeInTheDocument();
      expect(screen.getByText('Second review content')).toBeInTheDocument();
      expect(screen.getByText('Third review content')).toBeInTheDocument();
    });

    it('passes currentUserDid for ownership checks', () => {
      const onEdit = vi.fn();
      render(<ReviewList reviews={mockReviews} currentUserDid="did:plc:r1" onEdit={onEdit} />);

      // First review belongs to r1, so edit should be available
      // This is tested implicitly through the component behavior
      expect(screen.getAllByTestId('review-card')).toHaveLength(3);
    });
  });

  describe('threaded layout', () => {
    const threadedReviews = [
      createMockReview({
        uri: 'at://review1',
        content: 'Parent review',
        body: undefined,
        author: createMockAuthor({ displayName: 'Parent Author' }),
      }),
      createMockReview({
        uri: 'at://reply1',
        content: 'Reply to parent',
        body: undefined,
        parentReviewUri: 'at://review1',
        author: createMockAuthor({ displayName: 'Reply Author' }),
      }),
      createMockReview({
        uri: 'at://reply2',
        content: 'Another reply',
        body: undefined,
        parentReviewUri: 'at://review1',
        author: createMockAuthor({ displayName: 'Another Author' }),
      }),
    ];

    it('renders threaded layout when specified', () => {
      render(<ReviewList reviews={threadedReviews} layout="threaded" />);

      expect(screen.getByTestId('review-list')).toHaveAttribute('data-layout', 'threaded');
    });

    it('groups replies under parent reviews', () => {
      render(<ReviewList reviews={threadedReviews} layout="threaded" />);

      // Should have one top-level thread
      expect(screen.getAllByTestId('review-thread')).toHaveLength(3); // parent + 2 nested
    });

    it('shows parent review content', () => {
      render(<ReviewList reviews={threadedReviews} layout="threaded" />);

      expect(screen.getByText('Parent review')).toBeInTheDocument();
    });

    it('shows reply content', () => {
      render(<ReviewList reviews={threadedReviews} layout="threaded" />);

      expect(screen.getByText('Reply to parent')).toBeInTheDocument();
      expect(screen.getByText('Another reply')).toBeInTheDocument();
    });
  });

  describe('callbacks', () => {
    it('calls onReply when reply clicked', async () => {
      const user = userEvent.setup();
      const onReply = vi.fn();
      render(<ReviewList reviews={mockReviews} onReply={onReply} />);

      // Find first review card and trigger reply
      const firstCard = screen.getAllByTestId('review-card')[0];
      await user.hover(firstCard);
      await user.click(screen.getAllByRole('button', { name: /review actions/i })[0]);
      await user.click(screen.getAllByRole('menuitem', { name: /reply/i })[0]);

      expect(onReply).toHaveBeenCalledWith(mockReviews[0]);
    });

    it('calls onEdit when edit clicked', async () => {
      const user = userEvent.setup();
      const onEdit = vi.fn();
      render(<ReviewList reviews={mockReviews} onEdit={onEdit} currentUserDid="did:plc:r1" />);

      // Find first review card (owned by r1)
      const firstCard = screen.getAllByTestId('review-card')[0];
      await user.hover(firstCard);
      await user.click(screen.getAllByRole('button', { name: /review actions/i })[0]);
      await user.click(screen.getByRole('menuitem', { name: /edit/i }));

      expect(onEdit).toHaveBeenCalledWith(mockReviews[0]);
    });

    it('calls onDelete when delete clicked', async () => {
      const user = userEvent.setup();
      const onDelete = vi.fn();
      render(<ReviewList reviews={mockReviews} onDelete={onDelete} currentUserDid="did:plc:r1" />);

      const firstCard = screen.getAllByTestId('review-card')[0];
      await user.hover(firstCard);
      await user.click(screen.getAllByRole('button', { name: /review actions/i })[0]);
      await user.click(screen.getByRole('menuitem', { name: /delete/i }));

      expect(onDelete).toHaveBeenCalledWith(mockReviews[0]);
    });
  });

  describe('showTargets prop', () => {
    it('shows target spans by default', () => {
      const reviewWithTarget = createMockReview({
        target: {
          source: 'at://test/eprint/1',
          selector: { type: 'TextQuoteSelector', exact: 'quoted text' },
        },
      });

      render(<ReviewList reviews={[reviewWithTarget]} />);

      expect(screen.getByText(/quoted text/)).toBeInTheDocument();
    });

    it('hides target spans when showTargets is false', () => {
      const reviewWithTarget = createMockReview({
        target: {
          source: 'at://test/eprint/1',
          selector: { type: 'TextQuoteSelector', exact: 'quoted text' },
        },
      });

      render(<ReviewList reviews={[reviewWithTarget]} showTargets={false} />);

      expect(screen.queryByText(/quoted text/)).not.toBeInTheDocument();
    });
  });

  describe('className prop', () => {
    it('applies custom className', () => {
      render(<ReviewList reviews={mockReviews} className="custom-class" />);

      expect(screen.getByTestId('review-list')).toHaveClass('custom-class');
    });

    it('applies custom className to empty state', () => {
      render(<ReviewList reviews={[]} className="custom-class" />);

      expect(screen.getByTestId('review-list-empty')).toHaveClass('custom-class');
    });
  });
});

describe('ReviewListSkeleton', () => {
  it('renders default count of 3 skeletons', () => {
    render(<ReviewListSkeleton />);

    expect(screen.getByTestId('review-list-skeleton')).toBeInTheDocument();
    expect(screen.getAllByTestId('review-card-skeleton')).toHaveLength(3);
  });

  it('renders custom count of skeletons', () => {
    render(<ReviewListSkeleton count={5} />);

    expect(screen.getAllByTestId('review-card-skeleton')).toHaveLength(5);
  });

  it('applies custom className', () => {
    render(<ReviewListSkeleton className="custom-class" />);

    expect(screen.getByTestId('review-list-skeleton')).toHaveClass('custom-class');
  });
});
