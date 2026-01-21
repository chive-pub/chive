import { render, screen } from '@/tests/test-utils';
import userEvent from '@testing-library/user-event';
import {
  PDFAnnotationOverlay,
  reviewsToHighlights,
  type AnnotationHighlight,
} from './pdf-annotation-overlay';
import {
  createMockReview,
  createMockTextSpanTarget,
  createMockReviewAuthor,
} from '@/tests/mock-data';

describe('PDFAnnotationOverlay', () => {
  const createHighlight = (overrides?: Partial<AnnotationHighlight>): AnnotationHighlight => ({
    uri: 'at://annotation/123',
    target: createMockTextSpanTarget({
      refinedBy: { type: 'TextPositionSelector', start: 0, end: 10, pageNumber: 1 },
    }),
    color: 'bg-yellow-200/50',
    excerpt: 'This is a test annotation excerpt',
    replyCount: 0,
    authorName: 'Dr. Test',
    ...overrides,
  });

  describe('rendering', () => {
    it('renders overlay when annotations exist for page', () => {
      const annotations = [createHighlight()];

      render(<PDFAnnotationOverlay annotations={annotations} pageNumber={1} />);

      expect(screen.getByTestId('pdf-annotation-overlay')).toBeInTheDocument();
    });

    it('returns null when no annotations for page', () => {
      const annotations = [
        createHighlight({
          target: createMockTextSpanTarget({
            refinedBy: { type: 'TextPositionSelector', start: 0, end: 10, pageNumber: 2 },
          }),
        }),
      ];

      const { container } = render(
        <PDFAnnotationOverlay annotations={annotations} pageNumber={1} />
      );

      expect(container).toBeEmptyDOMElement();
    });

    it('renders highlights for current page only', () => {
      const annotations = [
        createHighlight({
          uri: 'at://page1/1',
          target: createMockTextSpanTarget({
            refinedBy: { type: 'TextPositionSelector', start: 0, end: 10, pageNumber: 1 },
          }),
        }),
        createHighlight({
          uri: 'at://page2/1',
          target: createMockTextSpanTarget({
            refinedBy: { type: 'TextPositionSelector', start: 0, end: 10, pageNumber: 2 },
          }),
        }),
        createHighlight({
          uri: 'at://page1/2',
          target: createMockTextSpanTarget({
            refinedBy: { type: 'TextPositionSelector', start: 20, end: 30, pageNumber: 1 },
          }),
        }),
      ];

      render(<PDFAnnotationOverlay annotations={annotations} pageNumber={1} />);

      expect(screen.getAllByTestId('annotation-highlight')).toHaveLength(2);
    });
  });

  describe('highlight element', () => {
    it('renders highlight button with ARIA label', () => {
      const annotations = [createHighlight({ authorName: 'Dr. Author' })];

      render(<PDFAnnotationOverlay annotations={annotations} pageNumber={1} />);

      expect(screen.getByRole('button', { name: 'Annotation by Dr. Author' })).toBeInTheDocument();
    });

    it('applies color class to highlight', () => {
      const annotations = [createHighlight({ color: 'bg-blue-200/50 hover:bg-blue-200/70' })];

      render(<PDFAnnotationOverlay annotations={annotations} pageNumber={1} />);

      expect(screen.getByTestId('annotation-highlight')).toHaveClass('bg-blue-200/50');
    });
  });

  describe('tooltip', () => {
    it('shows author name in tooltip', async () => {
      const user = userEvent.setup();
      const annotations = [createHighlight({ authorName: 'Jane Doe' })];

      render(<PDFAnnotationOverlay annotations={annotations} pageNumber={1} />);

      await user.hover(screen.getByTestId('annotation-highlight'));

      // Tooltip content may appear in multiple places (visible and accessibility span)
      const elements = await screen.findAllByText('Jane Doe');
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });

    it('shows excerpt in tooltip', async () => {
      const user = userEvent.setup();
      const annotations = [createHighlight({ excerpt: 'This is the annotation content' })];

      render(<PDFAnnotationOverlay annotations={annotations} pageNumber={1} />);

      await user.hover(screen.getByTestId('annotation-highlight'));

      // Tooltip content may appear in multiple places (visible and accessibility span)
      const elements = await screen.findAllByText('This is the annotation content');
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });

    it('shows reply count in tooltip', async () => {
      const user = userEvent.setup();
      const annotations = [createHighlight({ replyCount: 5 })];

      render(<PDFAnnotationOverlay annotations={annotations} pageNumber={1} />);

      await user.hover(screen.getByTestId('annotation-highlight'));

      // Tooltip content may appear in multiple places (visible and accessibility span)
      const elements = await screen.findAllByText('5 replies');
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });

    it('shows singular reply for count of 1', async () => {
      const user = userEvent.setup();
      const annotations = [createHighlight({ replyCount: 1 })];

      render(<PDFAnnotationOverlay annotations={annotations} pageNumber={1} />);

      await user.hover(screen.getByTestId('annotation-highlight'));

      // Tooltip content may appear in multiple places (visible and accessibility span)
      const elements = await screen.findAllByText('1 reply');
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });

    it('hides reply count when zero', async () => {
      const user = userEvent.setup();
      const annotations = [createHighlight({ replyCount: 0 })];

      render(<PDFAnnotationOverlay annotations={annotations} pageNumber={1} />);

      await user.hover(screen.getByTestId('annotation-highlight'));

      // Wait for tooltip to appear, content may appear multiple times
      const authorElements = await screen.findAllByText(annotations[0].authorName);
      expect(authorElements.length).toBeGreaterThanOrEqual(1);

      // Reply count should not be shown
      expect(screen.queryByText(/repl/i)).not.toBeInTheDocument();
    });
  });

  describe('click handling', () => {
    it('calls onAnnotationClick when highlight clicked', async () => {
      const user = userEvent.setup();
      const onAnnotationClick = vi.fn();
      const annotations = [createHighlight({ uri: 'at://clicked/annotation' })];

      render(
        <PDFAnnotationOverlay
          annotations={annotations}
          pageNumber={1}
          onAnnotationClick={onAnnotationClick}
        />
      );

      await user.click(screen.getByTestId('annotation-highlight'));

      expect(onAnnotationClick).toHaveBeenCalledWith('at://clicked/annotation');
    });

    it('handles click without callback', async () => {
      const user = userEvent.setup();
      const annotations = [createHighlight()];

      render(<PDFAnnotationOverlay annotations={annotations} pageNumber={1} />);

      // Should not throw
      await user.click(screen.getByTestId('annotation-highlight'));
    });
  });

  describe('className prop', () => {
    it('applies custom className', () => {
      const annotations = [createHighlight()];

      render(
        <PDFAnnotationOverlay annotations={annotations} pageNumber={1} className="custom-class" />
      );

      expect(screen.getByTestId('pdf-annotation-overlay')).toHaveClass('custom-class');
    });
  });

  describe('pointer events', () => {
    it('has pointer-events-none on overlay', () => {
      const annotations = [createHighlight()];

      render(<PDFAnnotationOverlay annotations={annotations} pageNumber={1} />);

      expect(screen.getByTestId('pdf-annotation-overlay')).toHaveClass('pointer-events-none');
    });
  });
});

describe('reviewsToHighlights', () => {
  it('converts reviews with targets to highlights', () => {
    const reviews = [
      createMockReview({
        uri: 'at://review/1',
        content: 'Great point about the methodology',
        target: createMockTextSpanTarget(),
        author: createMockReviewAuthor({ displayName: 'Dr. Reviewer' }),
      }),
    ];

    const highlights = reviewsToHighlights(reviews);

    expect(highlights).toHaveLength(1);
    expect(highlights[0]).toMatchObject({
      uri: 'at://review/1',
      authorName: 'Dr. Reviewer',
    });
  });

  it('filters out reviews without targets', () => {
    const reviews = [
      createMockReview({
        uri: 'at://review/with-target',
        target: createMockTextSpanTarget(),
      }),
      createMockReview({
        uri: 'at://review/without-target',
        target: undefined,
      }),
    ];

    const highlights = reviewsToHighlights(reviews);

    expect(highlights).toHaveLength(1);
    expect(highlights[0].uri).toBe('at://review/with-target');
  });

  it('truncates content for excerpt', () => {
    const longContent = 'A'.repeat(200);
    const reviews = [
      createMockReview({
        content: longContent,
        target: createMockTextSpanTarget(),
      }),
    ];

    const highlights = reviewsToHighlights(reviews);

    expect(highlights[0].excerpt.length).toBe(100);
  });

  it('uses default color', () => {
    const reviews = [createMockReview({ target: createMockTextSpanTarget() })];

    const highlights = reviewsToHighlights(reviews);

    expect(highlights[0].color).toContain('yellow');
  });

  it('uses custom default color', () => {
    const reviews = [createMockReview({ target: createMockTextSpanTarget() })];

    const highlights = reviewsToHighlights(reviews, 'bg-blue-200');

    expect(highlights[0].color).toBe('bg-blue-200');
  });

  it('falls back to handle when no displayName', () => {
    const reviews = [
      createMockReview({
        target: createMockTextSpanTarget(),
        author: createMockReviewAuthor({ displayName: '', handle: 'user.bsky.social' }),
      }),
    ];

    const highlights = reviewsToHighlights(reviews);

    expect(highlights[0].authorName).toBe('user.bsky.social');
  });

  it('falls back to Anonymous when no name or handle', () => {
    const reviews = [
      createMockReview({
        target: createMockTextSpanTarget(),
        author: createMockReviewAuthor({ displayName: '', handle: '' }),
      }),
    ];

    const highlights = reviewsToHighlights(reviews);

    expect(highlights[0].authorName).toBe('Anonymous');
  });
});
