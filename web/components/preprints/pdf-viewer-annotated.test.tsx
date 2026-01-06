import { render, screen, waitFor } from '@/tests/test-utils';
import userEvent from '@testing-library/user-event';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import { AnnotatedPDFViewer, AnnotatedPDFViewerSkeleton } from './pdf-viewer-annotated';
import { createMockBlobRef, createMockInlineReview, createMockAuthor } from '@/tests/mock-data';
import { mockHighlighterUtils } from '@/__mocks__/react-pdf-highlighter-extended';

// =============================================================================
// MOCKS
// =============================================================================

// Mock useInlineReviews hook
const mockUseInlineReviews = vi.fn();
vi.mock('@/lib/hooks/use-review', () => ({
  useInlineReviews: (preprintUri: string, options?: { enabled?: boolean }) => {
    return mockUseInlineReviews(preprintUri, options);
  },
}));

// Mock auth hooks
const mockIsAuthenticated = vi.fn();
vi.mock('@/lib/auth', () => ({
  useIsAuthenticated: () => mockIsAuthenticated(),
}));

// =============================================================================
// TEST DATA
// =============================================================================

const defaultProps = {
  blobRef: createMockBlobRef(),
  pdsEndpoint: 'https://bsky.social',
  did: 'did:plc:testauthor',
  preprintUri: 'at://did:plc:testauthor/pub.chive.preprint.submission/abc123',
};

const mockReviews = [
  createMockInlineReview({
    uri: 'at://review/1',
    content: 'First inline review',
    author: createMockAuthor({ displayName: 'Dr. First' }),
  }),
  createMockInlineReview({
    uri: 'at://review/2',
    content: 'Second inline review',
    author: createMockAuthor({ displayName: 'Dr. Second' }),
  }),
];

// =============================================================================
// TESTS
// =============================================================================

describe('AnnotatedPDFViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAuthenticated.mockReturnValue(true);
    mockUseInlineReviews.mockReturnValue({
      data: { reviews: mockReviews },
      isLoading: false,
      error: null,
    });
  });

  describe('rendering', () => {
    it('renders the PDF viewer container', () => {
      render(<AnnotatedPDFViewer {...defaultProps} />);

      expect(screen.getByTestId('pdf-loader')).toBeInTheDocument();
      expect(screen.getByTestId('pdf-highlighter')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(
        <AnnotatedPDFViewer {...defaultProps} className="custom-viewer-class" />
      );

      expect(container.firstChild).toHaveClass('custom-viewer-class');
    });

    it('constructs correct PDF URL from props', () => {
      render(<AnnotatedPDFViewer {...defaultProps} />);

      const pdfLoader = screen.getByTestId('pdf-loader');
      const documentUrl = pdfLoader.getAttribute('data-document') ?? '';
      expect(documentUrl).toContain(defaultProps.pdsEndpoint);
      // DID is URL-encoded in the query string
      expect(documentUrl).toContain(encodeURIComponent(defaultProps.did));
      expect(documentUrl).toContain(defaultProps.blobRef.ref);
    });
  });

  describe('toolbar controls', () => {
    it('renders zoom controls', () => {
      render(<AnnotatedPDFViewer {...defaultProps} />);

      // Find zoom buttons by their icon classes
      const buttons = screen.getAllByRole('button');
      const zoomOutBtn = buttons.find((btn) => btn.querySelector('.lucide-zoom-out'));
      const zoomInBtn = buttons.find((btn) => btn.querySelector('.lucide-zoom-in'));

      expect(zoomOutBtn).toBeInTheDocument();
      expect(zoomInBtn).toBeInTheDocument();
      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('increases zoom on zoom in click', async () => {
      const user = userEvent.setup();
      render(<AnnotatedPDFViewer {...defaultProps} />);

      const buttons = screen.getAllByRole('button');
      const zoomInBtn = buttons.find((btn) => btn.querySelector('.lucide-zoom-in'));
      expect(zoomInBtn).toBeDefined();

      await user.click(zoomInBtn!);

      expect(screen.getByText('125%')).toBeInTheDocument();
    });

    it('decreases zoom on zoom out click', async () => {
      const user = userEvent.setup();
      render(<AnnotatedPDFViewer {...defaultProps} />);

      const buttons = screen.getAllByRole('button');
      const zoomInBtn = buttons.find((btn) => btn.querySelector('.lucide-zoom-in'));
      const zoomOutBtn = buttons.find((btn) => btn.querySelector('.lucide-zoom-out'));

      // First zoom in
      await user.click(zoomInBtn!);
      expect(screen.getByText('125%')).toBeInTheDocument();

      // Then zoom out
      await user.click(zoomOutBtn!);
      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('disables zoom out at minimum scale', async () => {
      const user = userEvent.setup();
      render(<AnnotatedPDFViewer {...defaultProps} />);

      const buttons = screen.getAllByRole('button');
      const zoomOutBtn = buttons.find((btn) => btn.querySelector('.lucide-zoom-out'));

      // Zoom out to minimum (0.5 = 50%)
      await user.click(zoomOutBtn!);
      await user.click(zoomOutBtn!);

      expect(screen.getByText('50%')).toBeInTheDocument();
      expect(zoomOutBtn).toBeDisabled();
    });

    it('disables zoom in at maximum scale', async () => {
      const user = userEvent.setup();
      render(<AnnotatedPDFViewer {...defaultProps} />);

      const buttons = screen.getAllByRole('button');
      const zoomInBtn = buttons.find((btn) => btn.querySelector('.lucide-zoom-in'));

      // Zoom in to maximum (3.0 = 300%)
      for (let i = 0; i < 8; i++) {
        await user.click(zoomInBtn!);
      }

      expect(screen.getByText('300%')).toBeInTheDocument();
      expect(zoomInBtn).toBeDisabled();
    });

    it('renders annotation toggle', () => {
      render(<AnnotatedPDFViewer {...defaultProps} />);

      // Toggle button with eye icon
      const toggleButton = screen.getByRole('button', { pressed: true });
      expect(toggleButton).toBeInTheDocument();
    });

    it('toggles annotation visibility', async () => {
      const user = userEvent.setup();
      render(<AnnotatedPDFViewer {...defaultProps} />);

      // Initially annotations are shown
      expect(screen.getByTestId('pdf-highlighter').getAttribute('data-highlight-count')).toBe('2');

      // Find and click the toggle button (it has pressed=true initially)
      const toggleButton = screen.getByRole('button', { pressed: true });
      await user.click(toggleButton);

      // Highlights should be hidden (0)
      expect(screen.getByTestId('pdf-highlighter').getAttribute('data-highlight-count')).toBe('0');
    });

    it('shows highlight count badge when annotations exist', () => {
      render(<AnnotatedPDFViewer {...defaultProps} />);

      // The badge should show the count
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('renders fullscreen toggle', () => {
      render(<AnnotatedPDFViewer {...defaultProps} />);

      // Fullscreen button (Maximize icon initially)
      const buttons = screen.getAllByRole('button');
      const fullscreenButton = buttons.find((btn) => btn.querySelector('.lucide-maximize'));
      expect(fullscreenButton).toBeInTheDocument();
    });

    it('renders download button', () => {
      render(<AnnotatedPDFViewer {...defaultProps} />);

      const buttons = screen.getAllByRole('button');
      const downloadButton = buttons.find((btn) => btn.querySelector('.lucide-download'));
      expect(downloadButton).toBeInTheDocument();
    });
  });

  describe('annotations loading', () => {
    it('shows loading state when fetching annotations', () => {
      mockUseInlineReviews.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      render(<AnnotatedPDFViewer {...defaultProps} />);

      // Should still render the viewer
      expect(screen.getByTestId('pdf-highlighter')).toBeInTheDocument();
      // No highlights during loading
      expect(screen.getByTestId('pdf-highlighter').getAttribute('data-highlight-count')).toBe('0');
    });

    it('displays highlights after loading', () => {
      render(<AnnotatedPDFViewer {...defaultProps} />);

      expect(screen.getByTestId('pdf-highlighter').getAttribute('data-highlight-count')).toBe('2');
    });

    it('handles empty reviews', () => {
      mockUseInlineReviews.mockReturnValue({
        data: { reviews: [] },
        isLoading: false,
        error: null,
      });

      render(<AnnotatedPDFViewer {...defaultProps} />);

      expect(screen.getByTestId('pdf-highlighter').getAttribute('data-highlight-count')).toBe('0');
    });
  });

  describe('authentication states', () => {
    it('shows auth hint when not authenticated', () => {
      mockIsAuthenticated.mockReturnValue(false);

      render(<AnnotatedPDFViewer {...defaultProps} />);

      expect(
        screen.getByText(/sign in to highlight text and add inline annotations/i)
      ).toBeInTheDocument();
    });

    it('hides auth hint when authenticated', () => {
      mockIsAuthenticated.mockReturnValue(true);

      render(<AnnotatedPDFViewer {...defaultProps} />);

      expect(
        screen.queryByText(/sign in to highlight text and add inline annotations/i)
      ).not.toBeInTheDocument();
    });
  });

  describe('scroll to annotation', () => {
    it('scrolls to annotation when scrollToAnnotationUri changes', async () => {
      const { rerender } = render(<AnnotatedPDFViewer {...defaultProps} />);

      // Initially no scroll
      expect(mockHighlighterUtils.scrollToHighlight).not.toHaveBeenCalled();

      // Trigger scroll to a specific annotation
      rerender(<AnnotatedPDFViewer {...defaultProps} scrollToAnnotationUri="at://review/1" />);

      await waitFor(() => {
        expect(mockHighlighterUtils.scrollToHighlight).toHaveBeenCalled();
      });
    });

    it('does not scroll if annotation URI not found', async () => {
      const { rerender } = render(<AnnotatedPDFViewer {...defaultProps} />);

      rerender(
        <AnnotatedPDFViewer {...defaultProps} scrollToAnnotationUri="at://review/nonexistent" />
      );

      // Should not call scroll since highlight doesn't exist
      await waitFor(() => {
        expect(mockHighlighterUtils.scrollToHighlight).not.toHaveBeenCalled();
      });
    });
  });

  describe('annotation callbacks', () => {
    it('calls onAnnotationSelect when highlight is clicked', async () => {
      const onAnnotationSelect = vi.fn();

      render(<AnnotatedPDFViewer {...defaultProps} onAnnotationSelect={onAnnotationSelect} />);

      // The MonitoredHighlightContainer renders a "View annotation" button
      const viewButton = screen.getByRole('button', { name: /view annotation/i });
      await userEvent.click(viewButton);

      expect(onAnnotationSelect).toHaveBeenCalledWith('at://test/review/1');
    });
  });

  describe('highlight container', () => {
    it('renders highlight tooltip with author name', () => {
      render(<AnnotatedPDFViewer {...defaultProps} />);

      expect(screen.getByText('Dr. Test')).toBeInTheDocument();
    });

    it('renders highlight tooltip with excerpt', () => {
      render(<AnnotatedPDFViewer {...defaultProps} />);

      expect(screen.getByText('Test excerpt')).toBeInTheDocument();
    });

    it('shows reply count in tooltip', () => {
      render(<AnnotatedPDFViewer {...defaultProps} />);

      expect(screen.getByText('2 replies')).toBeInTheDocument();
    });
  });
});

describe('AnnotatedPDFViewerSkeleton', () => {
  it('renders loading skeleton', () => {
    render(<AnnotatedPDFViewerSkeleton />);

    expect(screen.getByText('Loading PDF...')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<AnnotatedPDFViewerSkeleton className="custom-skeleton" />);

    expect(container.firstChild).toHaveClass('custom-skeleton');
  });

  it('shows loading spinner', () => {
    render(<AnnotatedPDFViewerSkeleton />);

    // Loader2 icon with animate-spin
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });
});

describe('coordinate conversion utilities', () => {
  it('converts reviews with targets to highlights', () => {
    render(<AnnotatedPDFViewer {...defaultProps} />);

    // Verify highlights are created from reviews
    expect(screen.getByTestId('pdf-highlighter').getAttribute('data-highlight-count')).toBe('2');
  });

  it('filters out reviews without targets', () => {
    const reviewsWithAndWithoutTargets = [
      createMockInlineReview({ uri: 'at://review/with-target' }),
      {
        ...createMockInlineReview({ uri: 'at://review/without-target' }),
        target: undefined,
      },
    ];

    mockUseInlineReviews.mockReturnValue({
      data: { reviews: reviewsWithAndWithoutTargets },
      isLoading: false,
      error: null,
    });

    render(<AnnotatedPDFViewer {...defaultProps} />);

    // Only the review with target should be converted to highlight
    expect(screen.getByTestId('pdf-highlighter').getAttribute('data-highlight-count')).toBe('1');
  });
});
