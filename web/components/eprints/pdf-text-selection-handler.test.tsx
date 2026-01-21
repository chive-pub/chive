import { render, screen, fireEvent } from '@/tests/test-utils';
import { PDFTextSelectionHandler } from './pdf-text-selection-handler';
import type { UnifiedTextSpanTarget } from '@/lib/api/schema';

// Mock window.getSelection
const mockGetSelection = vi.fn();
Object.defineProperty(window, 'getSelection', {
  value: mockGetSelection,
  writable: true,
});

describe('PDFTextSelectionHandler', () => {
  const defaultProps = {
    pageNumber: 1,
    eprintUri: 'at://did:plc:author/pub.chive.eprint.submission/abc123',
    onSelect: vi.fn(),
    children: (
      <div className="react-pdf__Page__textContent">
        Page content text here for selection testing
      </div>
    ),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSelection.mockReturnValue(null);
  });

  describe('rendering', () => {
    it('renders handler wrapper', () => {
      render(<PDFTextSelectionHandler {...defaultProps} />);

      expect(screen.getByTestId('pdf-text-selection-handler')).toBeInTheDocument();
    });

    it('renders children', () => {
      render(<PDFTextSelectionHandler {...defaultProps} />);

      expect(screen.getByText(/page content text/i)).toBeInTheDocument();
    });
  });

  describe('text selection', () => {
    it('calls onSelect when text is selected', () => {
      const onSelect = vi.fn();

      // Mock selection
      const mockSelection = {
        isCollapsed: false,
        toString: () => 'selected text',
      };
      mockGetSelection.mockReturnValue(mockSelection);

      render(
        <PDFTextSelectionHandler {...defaultProps} onSelect={onSelect}>
          <div className="react-pdf__Page__textContent">
            Some text that can be selected text for testing
          </div>
        </PDFTextSelectionHandler>
      );

      // Trigger mouseup
      fireEvent.mouseUp(screen.getByTestId('pdf-text-selection-handler'));

      expect(onSelect).toHaveBeenCalled();
    });

    it('does not call onSelect when selection is collapsed', () => {
      const onSelect = vi.fn();

      const mockSelection = {
        isCollapsed: true,
        toString: () => '',
      };
      mockGetSelection.mockReturnValue(mockSelection);

      render(<PDFTextSelectionHandler {...defaultProps} onSelect={onSelect} />);

      fireEvent.mouseUp(screen.getByTestId('pdf-text-selection-handler'));

      expect(onSelect).not.toHaveBeenCalled();
    });

    it('does not call onSelect when selection is null', () => {
      const onSelect = vi.fn();
      mockGetSelection.mockReturnValue(null);

      render(<PDFTextSelectionHandler {...defaultProps} onSelect={onSelect} />);

      fireEvent.mouseUp(screen.getByTestId('pdf-text-selection-handler'));

      expect(onSelect).not.toHaveBeenCalled();
    });

    it('does not call onSelect for very short selections', () => {
      const onSelect = vi.fn();

      const mockSelection = {
        isCollapsed: false,
        toString: () => 'ab', // Less than 3 characters
      };
      mockGetSelection.mockReturnValue(mockSelection);

      render(
        <PDFTextSelectionHandler {...defaultProps} onSelect={onSelect}>
          <div className="react-pdf__Page__textContent">ab</div>
        </PDFTextSelectionHandler>
      );

      fireEvent.mouseUp(screen.getByTestId('pdf-text-selection-handler'));

      expect(onSelect).not.toHaveBeenCalled();
    });

    it('trims whitespace from selection', () => {
      const onSelect = vi.fn();

      const mockSelection = {
        isCollapsed: false,
        toString: () => '   text   ',
      };
      mockGetSelection.mockReturnValue(mockSelection);

      render(
        <PDFTextSelectionHandler {...defaultProps} onSelect={onSelect}>
          <div className="react-pdf__Page__textContent"> text more content</div>
        </PDFTextSelectionHandler>
      );

      fireEvent.mouseUp(screen.getByTestId('pdf-text-selection-handler'));

      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          selector: expect.objectContaining({
            exact: 'text',
          }),
        }),
        'text'
      );
    });
  });

  describe('W3C selector generation', () => {
    it('creates TextQuoteSelector with exact text', () => {
      const onSelect = vi.fn();

      const mockSelection = {
        isCollapsed: false,
        toString: () => 'neural networks',
      };
      mockGetSelection.mockReturnValue(mockSelection);

      render(
        <PDFTextSelectionHandler {...defaultProps} onSelect={onSelect}>
          <div className="react-pdf__Page__textContent">
            Studies of neural networks have shown promising results.
          </div>
        </PDFTextSelectionHandler>
      );

      fireEvent.mouseUp(screen.getByTestId('pdf-text-selection-handler'));

      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          selector: expect.objectContaining({
            type: 'TextQuoteSelector',
            exact: 'neural networks',
          }),
        }),
        'neural networks'
      );
    });

    it('includes prefix in selector', () => {
      const onSelect = vi.fn();

      const mockSelection = {
        isCollapsed: false,
        toString: () => 'neural networks',
      };
      mockGetSelection.mockReturnValue(mockSelection);

      render(
        <PDFTextSelectionHandler {...defaultProps} onSelect={onSelect}>
          <div className="react-pdf__Page__textContent">
            Studies of neural networks have shown results.
          </div>
        </PDFTextSelectionHandler>
      );

      fireEvent.mouseUp(screen.getByTestId('pdf-text-selection-handler'));

      const callArgs = onSelect.mock.calls[0][0] as UnifiedTextSpanTarget;
      expect(callArgs.selector).toBeDefined();
      expect(callArgs.selector!.prefix).toBeDefined();
    });

    it('includes suffix in selector', () => {
      const onSelect = vi.fn();

      const mockSelection = {
        isCollapsed: false,
        toString: () => 'neural networks',
      };
      mockGetSelection.mockReturnValue(mockSelection);

      render(
        <PDFTextSelectionHandler {...defaultProps} onSelect={onSelect}>
          <div className="react-pdf__Page__textContent">
            Studies of neural networks have shown results.
          </div>
        </PDFTextSelectionHandler>
      );

      fireEvent.mouseUp(screen.getByTestId('pdf-text-selection-handler'));

      const callArgs = onSelect.mock.calls[0][0] as UnifiedTextSpanTarget;
      expect(callArgs.selector).toBeDefined();
      expect(callArgs.selector!.suffix).toBeDefined();
    });

    it('creates TextPositionSelector with offsets', () => {
      const onSelect = vi.fn();

      const mockSelection = {
        isCollapsed: false,
        toString: () => 'neural',
      };
      mockGetSelection.mockReturnValue(mockSelection);

      render(
        <PDFTextSelectionHandler {...defaultProps} onSelect={onSelect} pageNumber={3}>
          <div className="react-pdf__Page__textContent">The neural network</div>
        </PDFTextSelectionHandler>
      );

      fireEvent.mouseUp(screen.getByTestId('pdf-text-selection-handler'));

      const callArgs = onSelect.mock.calls[0][0] as UnifiedTextSpanTarget;
      expect(callArgs.refinedBy).toMatchObject({
        type: 'TextPositionSelector',
        pageNumber: 3,
      });
      expect(callArgs.refinedBy?.start).toBeGreaterThanOrEqual(0);
      expect(callArgs.refinedBy?.end).toBeGreaterThan(callArgs.refinedBy?.start || 0);
    });

    it('uses eprintUri as source', () => {
      const onSelect = vi.fn();
      const eprintUri = 'at://did:plc:test/pub.chive.eprint.submission/xyz';

      const mockSelection = {
        isCollapsed: false,
        toString: () => 'selected text',
      };
      mockGetSelection.mockReturnValue(mockSelection);

      render(
        <PDFTextSelectionHandler {...defaultProps} eprintUri={eprintUri} onSelect={onSelect}>
          <div className="react-pdf__Page__textContent">Some selected text here</div>
        </PDFTextSelectionHandler>
      );

      fireEvent.mouseUp(screen.getByTestId('pdf-text-selection-handler'));

      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          source: eprintUri,
        }),
        expect.any(String)
      );
    });
  });

  describe('text layer detection', () => {
    it('requires react-pdf text layer class', () => {
      const onSelect = vi.fn();

      const mockSelection = {
        isCollapsed: false,
        toString: () => 'selected text',
      };
      mockGetSelection.mockReturnValue(mockSelection);

      render(
        <PDFTextSelectionHandler {...defaultProps} onSelect={onSelect}>
          {/* Missing react-pdf__Page__textContent class */}
          <div>No text layer here</div>
        </PDFTextSelectionHandler>
      );

      fireEvent.mouseUp(screen.getByTestId('pdf-text-selection-handler'));

      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe('className prop', () => {
    it('applies custom className', () => {
      render(<PDFTextSelectionHandler {...defaultProps} className="custom-class" />);

      expect(screen.getByTestId('pdf-text-selection-handler')).toHaveClass('custom-class');
    });
  });

  describe('cleanup', () => {
    it('removes event listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(HTMLElement.prototype, 'removeEventListener');

      const { unmount } = render(<PDFTextSelectionHandler {...defaultProps} />);

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));

      removeEventListenerSpy.mockRestore();
    });
  });
});
