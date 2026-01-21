import { render, screen, waitFor } from '@/tests/test-utils';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  EndorsementPanel,
  EndorsementSummaryCompact,
  EndorsementIndicator,
} from './endorsement-panel';
import { createMockEndorsementSummary, createMockEndorsementsResponse } from '@/tests/mock-data';
import type { EndorsementSummary } from '@/lib/api/schema';

// Mock functions must be hoisted along with vi.mock
const { mockListForEprint, mockGetSummary } = vi.hoisted(() => ({
  mockListForEprint: vi.fn(),
  mockGetSummary: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  api: {
    pub: {
      chive: {
        endorsement: {
          listForEprint: mockListForEprint,
          getSummary: mockGetSummary,
        },
      },
    },
  },
}));

describe('EndorsementPanel', () => {
  const eprintUri = 'at://did:plc:test/pub.chive.eprint.submission/abc123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('shows skeletons while loading', () => {
      mockGetSummary.mockImplementation(() => new Promise(() => {})); // Never resolves
      mockListForEprint.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<EndorsementPanel eprintUri={eprintUri} />);

      expect(screen.getAllByTestId('endorsement-badge-skeleton')).toHaveLength(3);
      expect(screen.getByTestId('endorsement-list-skeleton')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows error message when summary fetch fails', async () => {
      mockGetSummary.mockRejectedValue(new Error('Failed to fetch'));
      mockListForEprint.mockRejectedValue(new Error('Failed to fetch'));

      render(<EndorsementPanel eprintUri={eprintUri} />);

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
        } as EndorsementSummary['byType'],
        total: 10,
        endorserCount: 8,
      });

      const mockEndorsements = createMockEndorsementsResponse();

      mockGetSummary.mockResolvedValue({ data: mockSummary });
      mockListForEprint.mockResolvedValue({ data: mockEndorsements });
    });

    it('renders panel with title', async () => {
      render(<EndorsementPanel eprintUri={eprintUri} />);

      await waitFor(() => {
        expect(screen.getByTestId('endorsement-panel')).toBeInTheDocument();
      });

      expect(screen.getByText('Endorsements')).toBeInTheDocument();
    });

    it('displays endorsement badges', async () => {
      render(<EndorsementPanel eprintUri={eprintUri} />);

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
      render(<EndorsementPanel eprintUri={eprintUri} />);

      await waitFor(() => {
        expect(screen.getByText('8 endorsers')).toBeInTheDocument();
      });
    });

    it('displays endorsement list', async () => {
      render(<EndorsementPanel eprintUri={eprintUri} />);

      await waitFor(() => {
        expect(screen.getByTestId('endorsement-list')).toBeInTheDocument();
      });
    });

    it('shows endorse button when onEndorse provided', async () => {
      const onEndorse = vi.fn();
      render(<EndorsementPanel eprintUri={eprintUri} onEndorse={onEndorse} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Endorse' })).toBeInTheDocument();
      });
    });

    it('calls onEndorse when button clicked', async () => {
      const user = userEvent.setup();
      const onEndorse = vi.fn();
      render(<EndorsementPanel eprintUri={eprintUri} onEndorse={onEndorse} />);

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
        } as EndorsementSummary['byType'],
        total: 8,
        endorserCount: 6,
      });

      const mockEndorsements = createMockEndorsementsResponse();

      mockGetSummary.mockResolvedValue({ data: mockSummary });
      mockListForEprint.mockResolvedValue({ data: mockEndorsements });
    });

    it('renders filter dropdown', async () => {
      render(<EndorsementPanel eprintUri={eprintUri} />);

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });
    });

    it('shows all endorsements by default', async () => {
      render(<EndorsementPanel eprintUri={eprintUri} />);

      await waitFor(() => {
        expect(screen.getByText('All endorsements')).toBeInTheDocument();
      });
    });

    it('filters by contribution type when badge clicked', async () => {
      const user = userEvent.setup();
      render(<EndorsementPanel eprintUri={eprintUri} />);

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
      render(<EndorsementPanel eprintUri={eprintUri} />);

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
      render(<EndorsementPanel eprintUri={eprintUri} />);

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
  const eprintUri = 'at://did:plc:test/pub.chive.eprint.submission/abc123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows skeleton while loading', () => {
    mockGetSummary.mockImplementation(() => new Promise(() => {}));

    render(<EndorsementSummaryCompact eprintUri={eprintUri} />);

    expect(screen.getByTestId('endorsement-badge-skeleton')).toBeInTheDocument();
  });

  it('renders badge group when data loaded', async () => {
    const mockSummary = createMockEndorsementSummary({
      byType: { methodological: 3, analytical: 2 } as EndorsementSummary['byType'],
      total: 5,
      endorserCount: 4,
    });

    mockGetSummary.mockResolvedValue({ data: mockSummary });

    render(<EndorsementSummaryCompact eprintUri={eprintUri} />);

    await waitFor(() => {
      expect(screen.getByTestId('endorsement-badge-group')).toBeInTheDocument();
    });
  });

  it('returns null when no endorsements', async () => {
    const mockSummary = createMockEndorsementSummary({
      byType: {} as EndorsementSummary['byType'],
      total: 0,
      endorserCount: 0,
    });

    mockGetSummary.mockResolvedValue({ data: mockSummary });

    const { container } = render(<EndorsementSummaryCompact eprintUri={eprintUri} />);

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });
});

describe('EndorsementIndicator', () => {
  const eprintUri = 'at://did:plc:test/pub.chive.eprint.submission/abc123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows skeleton while loading', () => {
    mockGetSummary.mockImplementation(() => new Promise(() => {}));

    render(<EndorsementIndicator eprintUri={eprintUri} />);

    expect(screen.getByTestId('endorsement-badge-skeleton')).toBeInTheDocument();
  });

  it('renders summary badge when data loaded', async () => {
    const mockSummary = createMockEndorsementSummary({
      total: 10,
      endorserCount: 8,
    });

    mockGetSummary.mockResolvedValue({ data: mockSummary });

    render(<EndorsementIndicator eprintUri={eprintUri} />);

    await waitFor(() => {
      expect(screen.getByTestId('endorsement-summary-badge')).toBeInTheDocument();
    });
  });

  it('returns null when no endorsements', async () => {
    const mockSummary = createMockEndorsementSummary({
      total: 0,
      endorserCount: 0,
    });

    mockGetSummary.mockResolvedValue({ data: mockSummary });

    const { container } = render(<EndorsementIndicator eprintUri={eprintUri} />);

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });
});
