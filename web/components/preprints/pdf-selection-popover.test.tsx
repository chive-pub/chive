import { render, screen } from '@/tests/test-utils';
import userEvent from '@testing-library/user-event';
import { PDFSelectionPopover } from './pdf-selection-popover';
import { createMockTextSpanTarget } from '@/tests/mock-data';
import type { TextSpanTarget } from '@/lib/api/schema';

describe('PDFSelectionPopover', () => {
  const mockTarget: TextSpanTarget = createMockTextSpanTarget({
    selector: { type: 'TextQuoteSelector', exact: 'selected text' },
    refinedBy: { type: 'TextPositionSelector', start: 10, end: 25, pageNumber: 1 },
  });

  const defaultProps = {
    selectedText: 'selected text',
    target: mockTarget,
    position: { x: 100, y: 200 },
    onAddReview: vi.fn(),
    onLinkEntity: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders popover', () => {
      render(<PDFSelectionPopover {...defaultProps} />);

      expect(screen.getByTestId('pdf-selection-popover')).toBeInTheDocument();
    });

    it('displays selected text preview', () => {
      render(<PDFSelectionPopover {...defaultProps} selectedText="neural networks" />);

      expect(screen.getByText(/"neural networks"/)).toBeInTheDocument();
    });

    it('truncates long selected text', () => {
      const longText = 'A'.repeat(100);
      render(<PDFSelectionPopover {...defaultProps} selectedText={longText} />);

      const preview = screen.getByText(/^"A+\.\.\."/);
      expect(preview).toBeInTheDocument();
    });

    it('positions at specified coordinates', () => {
      render(<PDFSelectionPopover {...defaultProps} position={{ x: 150, y: 250 }} />);

      const popover = screen.getByTestId('pdf-selection-popover');
      expect(popover).toHaveStyle({ left: '150px', top: '250px' });
    });

    it('centers horizontally with transform', () => {
      render(<PDFSelectionPopover {...defaultProps} />);

      const popover = screen.getByTestId('pdf-selection-popover');
      expect(popover).toHaveStyle({ transform: 'translateX(-50%)' });
    });
  });

  describe('action buttons', () => {
    it('shows Comment button', () => {
      render(<PDFSelectionPopover {...defaultProps} />);

      expect(screen.getByRole('button', { name: /comment/i })).toBeInTheDocument();
    });

    it('shows Link button', () => {
      render(<PDFSelectionPopover {...defaultProps} />);

      expect(screen.getByRole('button', { name: /link/i })).toBeInTheDocument();
    });

    it('shows Highlight button when onHighlight provided', () => {
      const onHighlight = vi.fn();
      render(<PDFSelectionPopover {...defaultProps} onHighlight={onHighlight} />);

      expect(screen.getByRole('button', { name: /highlight/i })).toBeInTheDocument();
    });

    it('hides Highlight button when onHighlight not provided', () => {
      render(<PDFSelectionPopover {...defaultProps} />);

      expect(screen.queryByRole('button', { name: /highlight/i })).not.toBeInTheDocument();
    });
  });

  describe('close button', () => {
    it('shows close button', () => {
      render(<PDFSelectionPopover {...defaultProps} />);

      expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
    });

    it('calls onClose when clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(<PDFSelectionPopover {...defaultProps} onClose={onClose} />);

      await user.click(screen.getByRole('button', { name: /close/i }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Comment action', () => {
    it('calls onAddReview with target when Comment clicked', async () => {
      const user = userEvent.setup();
      const onAddReview = vi.fn();

      render(<PDFSelectionPopover {...defaultProps} onAddReview={onAddReview} />);

      await user.click(screen.getByRole('button', { name: /comment/i }));

      expect(onAddReview).toHaveBeenCalledWith(mockTarget);
    });
  });

  describe('Link action', () => {
    it('calls onLinkEntity with target and text when Link clicked', async () => {
      const user = userEvent.setup();
      const onLinkEntity = vi.fn();

      render(
        <PDFSelectionPopover
          {...defaultProps}
          selectedText="neural networks"
          onLinkEntity={onLinkEntity}
        />
      );

      await user.click(screen.getByRole('button', { name: /link/i }));

      expect(onLinkEntity).toHaveBeenCalledWith(mockTarget, 'neural networks');
    });
  });

  describe('Highlight action', () => {
    it('calls onHighlight with target when Highlight clicked', async () => {
      const user = userEvent.setup();
      const onHighlight = vi.fn();

      render(<PDFSelectionPopover {...defaultProps} onHighlight={onHighlight} />);

      await user.click(screen.getByRole('button', { name: /highlight/i }));

      expect(onHighlight).toHaveBeenCalledWith(mockTarget);
    });
  });

  describe('className prop', () => {
    it('applies custom className', () => {
      render(<PDFSelectionPopover {...defaultProps} className="custom-class" />);

      expect(screen.getByTestId('pdf-selection-popover')).toHaveClass('custom-class');
    });
  });

  describe('styling', () => {
    it('has proper z-index for overlay', () => {
      render(<PDFSelectionPopover {...defaultProps} />);

      expect(screen.getByTestId('pdf-selection-popover')).toHaveClass('z-50');
    });

    it('has border and shadow styling', () => {
      render(<PDFSelectionPopover {...defaultProps} />);

      const popover = screen.getByTestId('pdf-selection-popover');
      expect(popover).toHaveClass('border', 'shadow-lg', 'rounded-lg');
    });
  });
});
