import { render, screen } from '@/tests/test-utils';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import { AuthorReviews, AuthorReviewsSkeleton } from './author-reviews';
import {
  createMockReview,
  createMockInlineReview,
  createMockReviewAuthor,
  createMockTextSpanTarget,
} from '@/tests/mock-data';

// =============================================================================
// MOCKS
// =============================================================================

const mockUseAuthorReviews = vi.fn();
vi.mock('@/lib/hooks', () => ({
  useAuthorReviews: (did: string, options?: { limit?: number }) =>
    mockUseAuthorReviews(did, options),
}));

// =============================================================================
// TEST DATA
// =============================================================================

const testDid = 'did:plc:testauthor';

const mockReviews = [
  createMockReview({
    uri: 'at://did:plc:testauthor/pub.chive.review.comment/review1',
    author: createMockReviewAuthor({ did: testDid, displayName: 'Test Author' }),
    content: 'This is an excellent paper with solid methodology.',
    eprintUri: 'at://did:plc:other/pub.chive.eprint.submission/eprint1',
    createdAt: '2024-06-15T10:00:00Z',
  }),
  createMockInlineReview({
    uri: 'at://did:plc:testauthor/pub.chive.review.comment/review2',
    author: createMockReviewAuthor({ did: testDid, displayName: 'Test Author' }),
    content: 'The statistical analysis here needs more explanation.',
    eprintUri: 'at://did:plc:other/pub.chive.eprint.submission/eprint2',
    target: createMockTextSpanTarget({
      selector: {
        type: 'TextQuoteSelector',
        exact: 'regression coefficient of 0.85',
      },
    }),
    createdAt: '2024-06-14T09:00:00Z',
  }),
  createMockReview({
    uri: 'at://did:plc:testauthor/pub.chive.review.comment/review3',
    author: createMockReviewAuthor({ did: testDid, displayName: 'Test Author' }),
    content: 'A very long review content that exceeds 200 characters to test truncation. '.repeat(
      3
    ),
    eprintUri: 'at://did:plc:other/pub.chive.eprint.submission/eprint3',
    createdAt: '2024-06-13T08:00:00Z',
  }),
];

// =============================================================================
// TESTS
// =============================================================================

describe('AuthorReviews', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuthorReviews.mockReturnValue({
      data: { reviews: mockReviews, hasMore: false, total: 3 },
      isLoading: false,
      error: null,
    });
  });

  describe('loading state', () => {
    it('shows skeleton when loading', () => {
      mockUseAuthorReviews.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      render(<AuthorReviews did={testDid} />);

      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('error state', () => {
    it('shows error message on fetch error', () => {
      mockUseAuthorReviews.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Failed to fetch reviews'),
      });

      render(<AuthorReviews did={testDid} />);

      expect(screen.getByText('Failed to load reviews')).toBeInTheDocument();
      expect(screen.getByText('Failed to fetch reviews')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows empty state when no reviews', () => {
      mockUseAuthorReviews.mockReturnValue({
        data: { reviews: [], hasMore: false, total: 0 },
        isLoading: false,
        error: null,
      });

      render(<AuthorReviews did={testDid} />);

      expect(screen.getByText('No reviews yet')).toBeInTheDocument();
      expect(
        screen.getByText(/This author hasn't written any reviews or annotations/)
      ).toBeInTheDocument();
    });
  });

  describe('reviews display', () => {
    it('renders all reviews', () => {
      render(<AuthorReviews did={testDid} />);

      expect(
        screen.getByText('This is an excellent paper with solid methodology.')
      ).toBeInTheDocument();
      expect(
        screen.getByText('The statistical analysis here needs more explanation.')
      ).toBeInTheDocument();
    });

    it('truncates long review content', () => {
      render(<AuthorReviews did={testDid} />);

      // The long content should be truncated with ellipsis
      const truncatedReview = screen.getByText(/A very long review content.*\.\.\./);
      expect(truncatedReview).toBeInTheDocument();
    });

    it('shows inline annotation badge for reviews with targets', () => {
      render(<AuthorReviews did={testDid} />);

      expect(screen.getByText('Inline annotation')).toBeInTheDocument();
    });

    it('shows quoted text for inline annotations', () => {
      render(<AuthorReviews did={testDid} />);

      expect(screen.getByText(/regression coefficient of 0.85/)).toBeInTheDocument();
    });

    it('shows relative date for each review', () => {
      render(<AuthorReviews did={testDid} />);

      // Should show relative dates (implementation depends on formatRelativeDate)
      const timeElements = document.querySelectorAll('time');
      expect(timeElements.length).toBe(3);
    });

    it('includes link to eprint for each review', () => {
      render(<AuthorReviews did={testDid} />);

      const eprintLinks = screen.getAllByText('View eprint');
      expect(eprintLinks).toHaveLength(3);
    });
  });

  describe('pagination', () => {
    it('shows load more button when hasMore is true', () => {
      mockUseAuthorReviews.mockReturnValue({
        data: { reviews: mockReviews, hasMore: true, total: 10 },
        isLoading: false,
        error: null,
      });

      render(<AuthorReviews did={testDid} />);

      expect(screen.getByRole('button', { name: 'Load more' })).toBeInTheDocument();
    });

    it('hides load more button when hasMore is false', () => {
      mockUseAuthorReviews.mockReturnValue({
        data: { reviews: mockReviews, hasMore: false, total: 3 },
        isLoading: false,
        error: null,
      });

      render(<AuthorReviews did={testDid} />);

      expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
    });
  });

  describe('props', () => {
    it('passes did and limit to useAuthorReviews', () => {
      render(<AuthorReviews did={testDid} limit={10} />);

      expect(mockUseAuthorReviews).toHaveBeenCalledWith(testDid, { limit: 10 });
    });

    it('uses default limit of 20', () => {
      render(<AuthorReviews did={testDid} />);

      expect(mockUseAuthorReviews).toHaveBeenCalledWith(testDid, { limit: 20 });
    });

    it('applies custom className', () => {
      const { container } = render(<AuthorReviews did={testDid} className="custom-class" />);

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });
});

describe('AuthorReviewsSkeleton', () => {
  it('renders correct number of skeleton cards', () => {
    const { container } = render(<AuthorReviewsSkeleton count={3} />);

    // Count the direct Card children (each has animate-pulse class on the Card itself)
    // The structure is: wrapper div > Card elements
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.children.length).toBe(3);
  });

  it('uses default count of 5', () => {
    const { container } = render(<AuthorReviewsSkeleton />);

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.children.length).toBe(5);
  });

  it('applies custom className', () => {
    const { container } = render(<AuthorReviewsSkeleton className="custom-skeleton" />);

    expect(container.firstChild).toHaveClass('custom-skeleton');
  });
});
