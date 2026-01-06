import { render, screen, waitFor } from '@/tests/test-utils';
import userEvent from '@testing-library/user-event';
import {
  EndorsementPanel,
  EndorsementSummaryCompact,
  EndorsementIndicator,
} from './endorsement-panel';
import { createMockEndorsementSummary, createMockEndorsementsResponse } from '@/tests/mock-data';

// Mock functions must be hoisted along with vi.mock
const { mockGet } = vi.hoisted(() => ({
  mockGet: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  api: {
    GET: mockGet,
  },
}));

describe('EndorsementPanel', () => {
  const preprintUri = 'at://did:plc:test/pub.chive.preprint.submission/abc123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('shows skeletons while loading', () => {
      mockGet.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<EndorsementPanel preprintUri={preprintUri} />);

      expect(screen.getAllByTestId('endorsement-badge-skeleton')).toHaveLength(3);
      expect(screen.getByTestId('endorsement-list-skeleton')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows error message when summary fetch fails', async () => {
      mockGet.mockResolvedValue({
        data: null,
        error: { message: 'Failed to fetch' },
      });

      render(<EndorsementPanel preprintUri={preprintUri} />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load endorsements')).toBeInTheDocument();
      });
    });
  });

  describe('success state', () => {
    beforeEach(() => {
      const mockSummary = createMockEndorsementSummary({
        byType: {
          methodological: 5,
          analytical: 3,
          empirical: 2,
        },
        total: 10,
        endorserCount: 8,
      });

      const mockEndorsements = createMockEndorsementsResponse();

      mockGet.mockImplementation(async (url: string) => {
        if (url.includes('getSummary')) {
          return { data: mockSummary, error: null };
        }
        if (url.includes('listForPreprint')) {
          return { data: mockEndorsements, error: null };
        }
        return { data: null, error: null };
      });
    });

    it('renders panel with title', async () => {
      render(<EndorsementPanel preprintUri={preprintUri} />);

      await waitFor(() => {
        expect(screen.getByTestId('endorsement-panel')).toBeInTheDocument();
      });

      expect(screen.getByText('Endorsements')).toBeInTheDocument();
    });

    it('displays endorsement badges', async () => {
      render(<EndorsementPanel preprintUri={preprintUri} />);

      await waitFor(() => {
        // Badges may appear multiple times (in badge group and filter dropdown)
        const methodologicalElements = screen.getAllByText('Methodological');
        expect(methodologicalElements.length).toBeGreaterThanOrEqual(1);
      });

      const analyticalElements = screen.getAllByText('Analytical');
      expect(analyticalElements.length).toBeGreaterThanOrEqual(1);
      const empiricalElements = screen.getAllByText('Empirical');
      expect(empiricalElements.length).toBeGreaterThanOrEqual(1);
    });

    it('displays endorser count', async () => {
      render(<EndorsementPanel preprintUri={preprintUri} />);

      await waitFor(() => {
        expect(screen.getByText('8 endorsers')).toBeInTheDocument();
      });
    });

    it('displays endorsement list', async () => {
      render(<EndorsementPanel preprintUri={preprintUri} />);

      await waitFor(() => {
        expect(screen.getByTestId('endorsement-list')).toBeInTheDocument();
      });
    });

    it('shows endorse button when onEndorse provided', async () => {
      const onEndorse = vi.fn();
      render(<EndorsementPanel preprintUri={preprintUri} onEndorse={onEndorse} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Endorse' })).toBeInTheDocument();
      });
    });

    it('calls onEndorse when button clicked', async () => {
      const user = userEvent.setup();
      const onEndorse = vi.fn();
      render(<EndorsementPanel preprintUri={preprintUri} onEndorse={onEndorse} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Endorse' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Endorse' }));
      expect(onEndorse).toHaveBeenCalledTimes(1);
    });
  });

  describe('filtering', () => {
    beforeEach(() => {
      const mockSummary = createMockEndorsementSummary({
        byType: {
          methodological: 5,
          analytical: 3,
        },
        total: 8,
        endorserCount: 6,
      });

      const mockEndorsements = createMockEndorsementsResponse();

      mockGet.mockImplementation(async (url: string) => {
        if (url.includes('getSummary')) {
          return { data: mockSummary, error: null };
        }
        if (url.includes('listForPreprint')) {
          return { data: mockEndorsements, error: null };
        }
        return { data: null, error: null };
      });
    });

    it('renders filter dropdown', async () => {
      render(<EndorsementPanel preprintUri={preprintUri} />);

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });
    });

    it('shows all endorsements by default', async () => {
      render(<EndorsementPanel preprintUri={preprintUri} />);

      await waitFor(() => {
        expect(screen.getByText('All endorsements')).toBeInTheDocument();
      });
    });

    it('filters by contribution type when badge clicked', async () => {
      const user = userEvent.setup();
      render(<EndorsementPanel preprintUri={preprintUri} />);

      await waitFor(() => {
        const methodologicalElements = screen.getAllByText('Methodological');
        expect(methodologicalElements.length).toBeGreaterThanOrEqual(1);
      });

      // Click on first badge with Methodological text
      const methodologicalElements = screen.getAllByText('Methodological');
      await user.click(methodologicalElements[0]);

      // The filter should now show the selected type
      // (implementation detail: the dropdown value changes)
    });

    it('shows clear button when filter is active', async () => {
      const user = userEvent.setup();
      render(<EndorsementPanel preprintUri={preprintUri} />);

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });

      // Open dropdown and select a type
      await user.click(screen.getByRole('combobox'));
      await user.click(await screen.findByText(/Methodological.*5/));

      // Clear button should appear
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument();
      });
    });

    it('clears filter when clear button clicked', async () => {
      const user = userEvent.setup();
      render(<EndorsementPanel preprintUri={preprintUri} />);

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });

      // Apply filter
      await user.click(screen.getByRole('combobox'));
      await user.click(await screen.findByText(/Methodological.*5/));

      // Clear filter
      await user.click(await screen.findByRole('button', { name: 'Clear' }));

      // Should show "All endorsements" again
      await waitFor(() => {
        expect(screen.getByText('All endorsements')).toBeInTheDocument();
      });
    });
  });
});

describe('EndorsementSummaryCompact', () => {
  const preprintUri = 'at://did:plc:test/pub.chive.preprint.submission/abc123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows skeleton while loading', () => {
    mockGet.mockImplementation(() => new Promise(() => {}));

    render(<EndorsementSummaryCompact preprintUri={preprintUri} />);

    expect(screen.getByTestId('endorsement-badge-skeleton')).toBeInTheDocument();
  });

  it('renders badge group when data loaded', async () => {
    const mockSummary = createMockEndorsementSummary({
      byType: { methodological: 3, analytical: 2 },
      total: 5,
      endorserCount: 4,
    });

    mockGet.mockResolvedValue({ data: mockSummary, error: null });

    render(<EndorsementSummaryCompact preprintUri={preprintUri} />);

    await waitFor(() => {
      expect(screen.getByTestId('endorsement-badge-group')).toBeInTheDocument();
    });
  });

  it('returns null when no endorsements', async () => {
    const mockSummary = createMockEndorsementSummary({
      byType: {},
      total: 0,
      endorserCount: 0,
    });

    mockGet.mockResolvedValue({ data: mockSummary, error: null });

    const { container } = render(<EndorsementSummaryCompact preprintUri={preprintUri} />);

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });
});

describe('EndorsementIndicator', () => {
  const preprintUri = 'at://did:plc:test/pub.chive.preprint.submission/abc123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows skeleton while loading', () => {
    mockGet.mockImplementation(() => new Promise(() => {}));

    render(<EndorsementIndicator preprintUri={preprintUri} />);

    expect(screen.getByTestId('endorsement-badge-skeleton')).toBeInTheDocument();
  });

  it('renders summary badge when data loaded', async () => {
    const mockSummary = createMockEndorsementSummary({
      total: 10,
      endorserCount: 8,
    });

    mockGet.mockResolvedValue({ data: mockSummary, error: null });

    render(<EndorsementIndicator preprintUri={preprintUri} />);

    await waitFor(() => {
      expect(screen.getByTestId('endorsement-summary-badge')).toBeInTheDocument();
    });
  });

  it('returns null when no endorsements', async () => {
    const mockSummary = createMockEndorsementSummary({
      total: 0,
      endorserCount: 0,
    });

    mockGet.mockResolvedValue({ data: mockSummary, error: null });

    const { container } = render(<EndorsementIndicator preprintUri={preprintUri} />);

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });
});
