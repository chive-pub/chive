import { render, screen, waitFor } from '@/tests/test-utils';
import userEvent from '@testing-library/user-event';
import { WikidataSearch } from './wikidata-search';

// Mock fetch for Wikidata API
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('WikidataSearch', () => {
  const defaultProps = {
    query: '',
    onSelect: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('rendering', () => {
    it('renders search component', () => {
      render(<WikidataSearch {...defaultProps} />);

      expect(screen.getByTestId('wikidata-search')).toBeInTheDocument();
    });
  });

  describe('short query handling', () => {
    it('shows message for query less than 2 characters', () => {
      render(<WikidataSearch {...defaultProps} query="a" />);

      expect(screen.getByText('Type at least 2 characters to search')).toBeInTheDocument();
    });

    it('does not fetch for short queries', () => {
      render(<WikidataSearch {...defaultProps} query="a" />);

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('search functionality', () => {
    it('fetches results after debounce', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            search: [
              {
                id: 'Q123',
                label: 'Test Entity',
                description: 'A test entity',
                url: 'https://www.wikidata.org/wiki/Q123',
              },
            ],
          }),
      });

      render(<WikidataSearch {...defaultProps} query="neural" />);

      // Advance past debounce
      await vi.advanceTimersByTimeAsync(300);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('wbsearchentities'));
      });
    });

    it('sends correct query parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ search: [] }),
      });

      render(<WikidataSearch {...defaultProps} query="test" language="de" limit={5} />);

      await vi.advanceTimersByTimeAsync(300);

      await waitFor(() => {
        const url = mockFetch.mock.calls[0][0];
        expect(url).toContain('search=test');
        expect(url).toContain('language=de');
        expect(url).toContain('limit=5');
      });
    });

    it('uses English as default language', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ search: [] }),
      });

      render(<WikidataSearch {...defaultProps} query="test" />);

      await vi.advanceTimersByTimeAsync(300);

      await waitFor(() => {
        const url = mockFetch.mock.calls[0][0];
        expect(url).toContain('language=en');
      });
    });

    it('uses default limit of 10', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ search: [] }),
      });

      render(<WikidataSearch {...defaultProps} query="test" />);

      await vi.advanceTimersByTimeAsync(300);

      await waitFor(() => {
        const url = mockFetch.mock.calls[0][0];
        expect(url).toContain('limit=10');
      });
    });
  });

  describe('loading state', () => {
    it('shows loading spinner while fetching', async () => {
      // Mock a fetch that never resolves
      mockFetch.mockImplementation(() => new Promise(() => {}));

      render(<WikidataSearch {...defaultProps} query="neural" />);

      // Advance past debounce to trigger fetch
      await vi.advanceTimersByTimeAsync(300);

      // Loading state should be visible while fetch is pending
      await waitFor(() => {
        expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
      });
    });
  });

  describe('error handling', () => {
    it('shows error message on fetch failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      render(<WikidataSearch {...defaultProps} query="neural" />);

      await vi.advanceTimersByTimeAsync(300);

      await waitFor(() => {
        expect(screen.getByText('Search failed. Try again.')).toBeInTheDocument();
      });
    });
  });

  describe('empty results', () => {
    it('shows empty message when no results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ search: [] }),
      });

      render(<WikidataSearch {...defaultProps} query="xyznonexistent" />);

      await vi.advanceTimersByTimeAsync(300);

      await waitFor(() => {
        expect(screen.getByText('No Wikidata entities found')).toBeInTheDocument();
      });
    });
  });

  describe('displaying results', () => {
    const mockResults = [
      {
        id: 'Q43479',
        label: 'Neural network',
        description: 'Computing system inspired by biological neural networks',
        url: 'https://www.wikidata.org/wiki/Q43479',
      },
      {
        id: 'Q12345',
        label: 'Neural pathway',
        description: 'Connection in the brain',
      },
    ];

    beforeEach(() => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ search: mockResults }),
      });
    });

    it('displays result labels', async () => {
      render(<WikidataSearch {...defaultProps} query="neural" />);

      await vi.advanceTimersByTimeAsync(300);

      await waitFor(() => {
        expect(screen.getByText('Neural network')).toBeInTheDocument();
        expect(screen.getByText('Neural pathway')).toBeInTheDocument();
      });
    });

    it('displays Q-IDs', async () => {
      render(<WikidataSearch {...defaultProps} query="neural" />);

      await vi.advanceTimersByTimeAsync(300);

      await waitFor(() => {
        expect(screen.getByText('Q43479')).toBeInTheDocument();
        expect(screen.getByText('Q12345')).toBeInTheDocument();
      });
    });

    it('displays descriptions', async () => {
      render(<WikidataSearch {...defaultProps} query="neural" />);

      await vi.advanceTimersByTimeAsync(300);

      await waitFor(() => {
        expect(
          screen.getByText('Computing system inspired by biological neural networks')
        ).toBeInTheDocument();
      });
    });

    it('shows Wikidata group heading', async () => {
      render(<WikidataSearch {...defaultProps} query="neural" />);

      await vi.advanceTimersByTimeAsync(300);

      await waitFor(() => {
        expect(screen.getByText('Wikidata')).toBeInTheDocument();
      });
    });
  });

  describe('selection', () => {
    it('calls onSelect with entity data when clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onSelect = vi.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            search: [
              {
                id: 'Q123',
                label: 'Test Entity',
                description: 'Description',
                url: 'https://www.wikidata.org/wiki/Q123',
              },
            ],
          }),
      });

      render(<WikidataSearch {...defaultProps} query="test" onSelect={onSelect} />);

      await vi.advanceTimersByTimeAsync(300);

      await waitFor(() => {
        expect(screen.getByText('Test Entity')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Test Entity'));

      expect(onSelect).toHaveBeenCalledWith({
        qid: 'Q123',
        label: 'Test Entity',
        description: 'Description',
        url: 'https://www.wikidata.org/wiki/Q123',
      });
    });

    it('generates default URL when not provided', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onSelect = vi.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            search: [{ id: 'Q456', label: 'No URL Entity' }],
          }),
      });

      render(<WikidataSearch {...defaultProps} query="test" onSelect={onSelect} />);

      await vi.advanceTimersByTimeAsync(300);

      await waitFor(() => {
        expect(screen.getByText('No URL Entity')).toBeInTheDocument();
      });

      await user.click(screen.getByText('No URL Entity'));

      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://www.wikidata.org/wiki/Q456',
        })
      );
    });
  });

  describe('className prop', () => {
    it('applies custom className', () => {
      render(<WikidataSearch {...defaultProps} query="" className="custom-class" />);

      expect(screen.getByTestId('wikidata-search')).toHaveClass('custom-class');
    });
  });
});
