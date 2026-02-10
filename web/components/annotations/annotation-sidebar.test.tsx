import { render, screen, waitFor } from '@/tests/test-utils';
import userEvent from '@testing-library/user-event';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import { AnnotationSidebar, AnnotationSidebarSkeleton } from './annotation-sidebar';
import {
  createMockInlineReview,
  createMockAuthor,
  createMockTextSpanTarget,
} from '@/tests/mock-data';

// =============================================================================
// MOCKS
// =============================================================================

const mockUseAnnotations = vi.fn();
vi.mock('@/lib/hooks/use-annotations', () => ({
  useAnnotations: (eprintUri: string) => mockUseAnnotations(eprintUri),
}));

// =============================================================================
// TEST DATA
// =============================================================================

const defaultProps = {
  eprintUri: 'at://did:plc:testauthor/pub.chive.eprint.submission/abc123',
};

function createAnnotationOnPage(
  pageNumber: number,
  overrides: Partial<ReturnType<typeof createMockInlineReview>> = {}
): ReturnType<typeof createMockInlineReview> {
  // The component displays "Page {pageNumber + 1}" so pageNumber=0 shows as "Page 1"
  return createMockInlineReview({
    uri: `at://review/page-${pageNumber}-${Math.random().toString(36).slice(2, 8)}`,
    target: createMockTextSpanTarget({
      selector: {
        type: 'TextQuoteSelector',
        exact: `Selected text on page ${pageNumber + 1}`,
      },
      refinedBy: {
        type: 'TextPositionSelector',
        start: 100,
        end: 150,
        pageNumber,
      },
    }),
    ...overrides,
  });
}

// Page numbers are 0-indexed internally but display as 1-indexed
const mockAnnotations = [
  createAnnotationOnPage(0, {
    uri: 'at://review/1',
    author: createMockAuthor({ displayName: 'Dr. First' }),
    content: 'First annotation content on page 1',
    createdAt: '2024-06-15T10:00:00Z',
  }),
  createAnnotationOnPage(0, {
    uri: 'at://review/2',
    author: createMockAuthor({ displayName: 'Dr. Second' }),
    content: 'Second annotation content on page 1',
    createdAt: '2024-06-15T11:00:00Z',
  }),
  createAnnotationOnPage(1, {
    uri: 'at://review/3',
    author: createMockAuthor({ displayName: 'Dr. Alpha' }),
    content: 'Annotation on page 2',
    createdAt: '2024-06-14T09:00:00Z',
  }),
  createAnnotationOnPage(2, {
    uri: 'at://review/4',
    author: createMockAuthor({ displayName: 'Dr. Beta' }),
    content: 'Annotation on page 3',
    createdAt: '2024-06-16T12:00:00Z',
  }),
];

// =============================================================================
// TESTS
// =============================================================================

describe('AnnotationSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAnnotations.mockReturnValue({
      data: { annotations: mockAnnotations },
      isLoading: false,
      error: null,
    });
  });

  describe('loading state', () => {
    it('shows skeleton when loading', () => {
      mockUseAnnotations.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      render(<AnnotationSidebar {...defaultProps} />);

      // Should render skeleton with animation
      expect(
        screen.getAllByRole('generic').some((el) => el.className.includes('animate-pulse'))
      ).toBe(true);
    });
  });

  describe('error state', () => {
    it('shows error message on fetch error', () => {
      mockUseAnnotations.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Failed to fetch'),
      });

      render(<AnnotationSidebar {...defaultProps} />);

      expect(screen.getByText('Failed to load annotations')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows empty state when no annotations', () => {
      mockUseAnnotations.mockReturnValue({
        data: { annotations: [] },
        isLoading: false,
        error: null,
      });

      render(<AnnotationSidebar {...defaultProps} />);

      expect(screen.getByText('No annotations yet')).toBeInTheDocument();
      expect(screen.getByText(/Select text in the PDF/)).toBeInTheDocument();
    });
  });

  describe('page grouping', () => {
    it('groups annotations by page number', () => {
      render(<AnnotationSidebar {...defaultProps} />);

      expect(screen.getByText('Page 1')).toBeInTheDocument();
      expect(screen.getByText('Page 2')).toBeInTheDocument();
      expect(screen.getByText('Page 3')).toBeInTheDocument();
    });

    it('shows annotation count badge for each page', () => {
      render(<AnnotationSidebar {...defaultProps} />);

      // Page 1 has 2 annotations, pages 2 and 3 have 1 each
      const badges = screen.getAllByText('2');
      expect(badges.length).toBeGreaterThanOrEqual(1);
    });

    it('shows total annotation count in header', () => {
      render(<AnnotationSidebar {...defaultProps} />);

      expect(screen.getByText('4')).toBeInTheDocument(); // Total 4 annotations
    });
  });

  describe('sorting', () => {
    it('sorts by page by default', () => {
      render(<AnnotationSidebar {...defaultProps} />);

      // Default sort is by page
      expect(screen.getByRole('combobox')).toHaveTextContent('By page');
    });

    it('sorts by date when selected', async () => {
      const user = userEvent.setup();
      render(<AnnotationSidebar {...defaultProps} />);

      // Open sort dropdown
      await user.click(screen.getByRole('combobox'));
      await user.click(screen.getByRole('option', { name: 'By date' }));

      expect(screen.getByRole('combobox')).toHaveTextContent('By date');
    });

    it('sorts by author when selected', async () => {
      const user = userEvent.setup();
      render(<AnnotationSidebar {...defaultProps} />);

      // Open sort dropdown
      await user.click(screen.getByRole('combobox'));
      await user.click(screen.getByRole('option', { name: 'By author' }));

      expect(screen.getByRole('combobox')).toHaveTextContent('By author');
    });
  });

  describe('expand/collapse', () => {
    it('expands first page by default', () => {
      render(<AnnotationSidebar {...defaultProps} />);

      // Page 1 should be expanded (showing its content)
      expect(screen.getByText('First annotation content on page 1')).toBeInTheDocument();
    });

    it('expands page group on click', async () => {
      const user = userEvent.setup();
      render(<AnnotationSidebar {...defaultProps} />);

      // Page 3 is collapsed by default
      expect(screen.queryByText('Annotation on page 3')).not.toBeInTheDocument();

      // Click on Page 3 to expand
      await user.click(screen.getByRole('button', { name: /Page 3/i }));

      await waitFor(() => {
        expect(screen.getByText('Annotation on page 3')).toBeInTheDocument();
      });
    });

    it('collapses expanded page on click', async () => {
      const user = userEvent.setup();
      render(<AnnotationSidebar {...defaultProps} />);

      // Page 1 is expanded by default
      expect(screen.getByText('First annotation content on page 1')).toBeInTheDocument();

      // Find the page 1 toggle button (has aria-expanded and contains "Page 1")
      const page1Buttons = screen.getAllByRole('button', { name: /Page 1/i });
      const page1Toggle = page1Buttons.find((btn) => btn.getAttribute('aria-expanded'));
      expect(page1Toggle).toBeDefined();

      // Click to collapse
      await user.click(page1Toggle!);

      await waitFor(() => {
        expect(screen.queryByText('First annotation content on page 1')).not.toBeInTheDocument();
      });
    });

    it('expand all button expands all pages', async () => {
      const user = userEvent.setup();
      render(<AnnotationSidebar {...defaultProps} />);

      // Click expand all
      await user.click(screen.getByRole('button', { name: 'Expand' }));

      await waitFor(() => {
        // All annotations should now be visible
        expect(screen.getByText('First annotation content on page 1')).toBeInTheDocument();
        expect(screen.getByText('Annotation on page 2')).toBeInTheDocument();
        expect(screen.getByText('Annotation on page 3')).toBeInTheDocument();
      });
    });

    it('collapse all button collapses all pages', async () => {
      const user = userEvent.setup();
      render(<AnnotationSidebar {...defaultProps} />);

      // First expand all
      await user.click(screen.getByRole('button', { name: 'Expand' }));

      // Then collapse all
      await user.click(screen.getByRole('button', { name: 'Collapse' }));

      await waitFor(() => {
        // All annotations should now be hidden
        expect(screen.queryByText('First annotation content on page 1')).not.toBeInTheDocument();
        expect(screen.queryByText('Annotation on page 2')).not.toBeInTheDocument();
        expect(screen.queryByText('Annotation on page 3')).not.toBeInTheDocument();
      });
    });
  });

  describe('annotation items', () => {
    it('displays author name', async () => {
      const user = userEvent.setup();
      render(<AnnotationSidebar {...defaultProps} />);

      // Expand all to see all annotations
      await user.click(screen.getByRole('button', { name: 'Expand' }));

      expect(screen.getByText('Dr. First')).toBeInTheDocument();
      expect(screen.getByText('Dr. Second')).toBeInTheDocument();
    });

    it('displays quoted text excerpt', () => {
      render(<AnnotationSidebar {...defaultProps} />);

      // There are two annotations on page 1, so we use getAllByText
      const quotedTexts = screen.getAllByText(/Selected text on page 1/);
      expect(quotedTexts.length).toBeGreaterThan(0);
    });

    it('displays annotation date', () => {
      render(<AnnotationSidebar {...defaultProps} />);

      // Date should be formatted (there may be multiple annotations with this date)
      const dates = screen.getAllByText(/6\/15\/2024/);
      expect(dates.length).toBeGreaterThan(0);
    });

    it('highlights selected annotation', () => {
      render(<AnnotationSidebar {...defaultProps} selectedUri="at://review/1" />);

      // Selected annotation should have special styling
      const buttons = screen.getAllByRole('button');
      const selectedButton = buttons.find((btn) => btn.classList.contains('bg-primary/10'));
      expect(selectedButton).toBeDefined();
    });
  });

  describe('click handling', () => {
    it('calls onAnnotationClick when annotation is clicked', async () => {
      const user = userEvent.setup();
      const onAnnotationClick = vi.fn();

      render(<AnnotationSidebar {...defaultProps} onAnnotationClick={onAnnotationClick} />);

      // Click on an annotation
      const annotationButton = screen
        .getByText('First annotation content on page 1')
        .closest('button');
      expect(annotationButton).toBeDefined();
      await user.click(annotationButton!);

      // pageNumber is 0-indexed internally (0 for "Page 1")
      expect(onAnnotationClick).toHaveBeenCalledWith('at://review/1', 0);
    });

    it('passes page number in callback', async () => {
      const user = userEvent.setup();
      const onAnnotationClick = vi.fn();

      render(<AnnotationSidebar {...defaultProps} onAnnotationClick={onAnnotationClick} />);

      // Expand page 2 (which is pageNumber=1 internally)
      await user.click(screen.getByRole('button', { name: /Page 2/i }));

      // Click on page 2 annotation
      await waitFor(async () => {
        const annotationButton = screen.getByText('Annotation on page 2').closest('button');
        await user.click(annotationButton!);
      });

      // pageNumber is 0-indexed internally (1 for "Page 2")
      expect(onAnnotationClick).toHaveBeenCalledWith('at://review/3', 1);
    });
  });

  describe('className prop', () => {
    it('applies custom className', () => {
      const { container } = render(
        <AnnotationSidebar {...defaultProps} className="custom-sidebar-class" />
      );

      expect(container.firstChild).toHaveClass('custom-sidebar-class');
    });
  });
});

describe('AnnotationSidebarSkeleton', () => {
  it('renders loading skeleton', () => {
    render(<AnnotationSidebarSkeleton />);

    // Should have skeleton elements with animate-pulse
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('applies custom className', () => {
    const { container } = render(<AnnotationSidebarSkeleton className="custom-skeleton" />);

    expect(container.firstChild).toHaveClass('custom-skeleton');
  });
});
