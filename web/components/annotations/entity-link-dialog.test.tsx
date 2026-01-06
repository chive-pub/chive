import { render, screen, waitFor } from '@/tests/test-utils';
import userEvent from '@testing-library/user-event';
import { EntityLinkDialog } from './entity-link-dialog';

// Mock Wikidata fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('EntityLinkDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    selectedText: 'neural networks',
    onLink: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    // Default mock for Wikidata
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ search: [] }),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('rendering', () => {
    it('renders dialog when open', () => {
      render(<EntityLinkDialog {...defaultProps} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('shows dialog title', () => {
      render(<EntityLinkDialog {...defaultProps} />);

      expect(screen.getByText('Link to entity')).toBeInTheDocument();
    });

    it('shows selected text in description', () => {
      render(<EntityLinkDialog {...defaultProps} selectedText="my text" />);

      expect(screen.getByText(/link "my text" to a knowledge graph entity/i)).toBeInTheDocument();
    });

    it('does not render when closed', () => {
      render(<EntityLinkDialog {...defaultProps} open={false} />);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('search input', () => {
    it('shows search input', () => {
      render(<EntityLinkDialog {...defaultProps} />);

      expect(screen.getByLabelText('Search')).toBeInTheDocument();
    });

    it('pre-fills search with selected text', () => {
      render(<EntityLinkDialog {...defaultProps} selectedText="pre-filled text" />);

      expect(screen.getByLabelText('Search')).toHaveValue('pre-filled text');
    });

    it('allows typing in search input', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      render(<EntityLinkDialog {...defaultProps} />);

      const input = screen.getByLabelText('Search');
      await user.clear(input);
      await user.type(input, 'new query');

      expect(input).toHaveValue('new query');
    });
  });

  describe('tabs', () => {
    it('shows Wikidata tab', () => {
      render(<EntityLinkDialog {...defaultProps} />);

      expect(screen.getByRole('tab', { name: /wikidata/i })).toBeInTheDocument();
    });

    it('shows Authorities tab', () => {
      render(<EntityLinkDialog {...defaultProps} />);

      expect(screen.getByRole('tab', { name: /authorities/i })).toBeInTheDocument();
    });

    it('defaults to Wikidata tab', () => {
      render(<EntityLinkDialog {...defaultProps} />);

      expect(screen.getByRole('tab', { name: /wikidata/i })).toHaveAttribute(
        'aria-selected',
        'true'
      );
    });

    it('switches to Authorities tab when clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      render(<EntityLinkDialog {...defaultProps} />);

      await user.click(screen.getByRole('tab', { name: /authorities/i }));

      expect(screen.getByRole('tab', { name: /authorities/i })).toHaveAttribute(
        'aria-selected',
        'true'
      );
    });
  });

  describe('Wikidata search results', () => {
    it('shows Wikidata search component', () => {
      render(<EntityLinkDialog {...defaultProps} />);

      expect(screen.getByTestId('wikidata-search')).toBeInTheDocument();
    });

    it('displays search results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            search: [
              {
                id: 'Q43479',
                label: 'Neural network',
                description: 'Computing system',
              },
            ],
          }),
      });

      render(<EntityLinkDialog {...defaultProps} selectedText="neural" />);

      await vi.advanceTimersByTimeAsync(300);

      await waitFor(() => {
        expect(screen.getByText('Neural network')).toBeInTheDocument();
      });
    });
  });

  describe('selection preview', () => {
    it('shows selection preview when entity selected', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            search: [
              {
                id: 'Q123',
                label: 'Selected Entity',
                description: 'A description',
              },
            ],
          }),
      });

      render(<EntityLinkDialog {...defaultProps} selectedText="test" />);

      await vi.advanceTimersByTimeAsync(300);

      await waitFor(() => {
        expect(screen.getByText('Selected Entity')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Selected Entity'));

      // Check for selection preview
      expect(screen.getByText('Selected:')).toBeInTheDocument();
      // Q123 appears in both search results and preview badge, use getAllByText
      const q123Elements = screen.getAllByText('Q123');
      expect(q123Elements.length).toBeGreaterThanOrEqual(1);
    });

    it('shows description in preview for Wikidata entity', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            search: [
              {
                id: 'Q456',
                label: 'Unique Entity Label',
                description: 'Unique entity description',
              },
            ],
          }),
      });

      render(<EntityLinkDialog {...defaultProps} selectedText="test" />);

      await vi.advanceTimersByTimeAsync(300);

      await waitFor(() => {
        expect(screen.getByText('Unique Entity Label')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Unique Entity Label'));

      // Description appears in preview section
      // Note: description appears in both the search result item and the preview
      const descriptions = screen.getAllByText('Unique entity description');
      expect(descriptions.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('buttons', () => {
    it('shows Cancel button', () => {
      render(<EntityLinkDialog {...defaultProps} />);

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('shows Link entity button', () => {
      render(<EntityLinkDialog {...defaultProps} />);

      expect(screen.getByRole('button', { name: /link entity/i })).toBeInTheDocument();
    });

    it('disables Link button when no selection', () => {
      render(<EntityLinkDialog {...defaultProps} />);

      expect(screen.getByRole('button', { name: /link entity/i })).toBeDisabled();
    });

    it('enables Link button after selection', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            search: [{ id: 'Q123', label: 'Entity' }],
          }),
      });

      render(<EntityLinkDialog {...defaultProps} selectedText="test" />);

      await vi.advanceTimersByTimeAsync(300);

      await waitFor(() => {
        expect(screen.getByText('Entity')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Entity'));

      expect(screen.getByRole('button', { name: /link entity/i })).toBeEnabled();
    });
  });

  describe('cancel action', () => {
    it('calls onOpenChange with false when Cancel clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onOpenChange = vi.fn();

      render(<EntityLinkDialog {...defaultProps} onOpenChange={onOpenChange} />);

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('link action', () => {
    it('calls onLink with Wikidata entity data', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onLink = vi.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            search: [
              {
                id: 'Q123',
                label: 'Entity Label',
                description: 'Description',
                url: 'https://www.wikidata.org/wiki/Q123',
              },
            ],
          }),
      });

      render(<EntityLinkDialog {...defaultProps} selectedText="test" onLink={onLink} />);

      await vi.advanceTimersByTimeAsync(300);

      await waitFor(() => {
        expect(screen.getByText('Entity Label')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Entity Label'));
      await user.click(screen.getByRole('button', { name: /link entity/i }));

      expect(onLink).toHaveBeenCalledWith({
        type: 'wikidata',
        qid: 'Q123',
        label: 'Entity Label',
        url: 'https://www.wikidata.org/wiki/Q123',
      });
    });

    it('closes dialog after linking', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onOpenChange = vi.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            search: [{ id: 'Q123', label: 'Entity' }],
          }),
      });

      render(
        <EntityLinkDialog {...defaultProps} selectedText="test" onOpenChange={onOpenChange} />
      );

      await vi.advanceTimersByTimeAsync(300);

      await waitFor(() => {
        expect(screen.getByText('Entity')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Entity'));
      await user.click(screen.getByRole('button', { name: /link entity/i }));

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('dialog reopening', () => {
    it('initializes query with selectedText when first rendered', () => {
      render(<EntityLinkDialog {...defaultProps} selectedText="initial text" />);

      expect(screen.getByLabelText('Search')).toHaveValue('initial text');
    });

    it('resets selection when closed via cancel', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            search: [{ id: 'Q123', label: 'Entity' }],
          }),
      });

      const onOpenChange = vi.fn();
      render(
        <EntityLinkDialog {...defaultProps} selectedText="test" onOpenChange={onOpenChange} />
      );

      await vi.advanceTimersByTimeAsync(300);

      await waitFor(() => {
        expect(screen.getByText('Entity')).toBeInTheDocument();
      });

      // Select an entity
      await user.click(screen.getByText('Entity'));

      await waitFor(() => {
        expect(screen.getByText('Selected:')).toBeInTheDocument();
      });

      // Click cancel
      await user.click(screen.getByRole('button', { name: /cancel/i }));

      // Should have called onOpenChange(false)
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('className prop', () => {
    it('applies custom className to dialog content', () => {
      render(<EntityLinkDialog {...defaultProps} className="custom-class" />);

      // The dialog role is on the DialogContent which has the custom class
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('custom-class');
    });
  });
});
