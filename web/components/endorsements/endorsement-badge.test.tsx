import { render, screen } from '@/tests/test-utils';
import userEvent from '@testing-library/user-event';
import {
  EndorsementBadge,
  EndorsementBadgeGroup,
  EndorsementSummaryBadge,
  EndorsementBadgeSkeleton,
  CONTRIBUTION_CONFIG,
} from './endorsement-badge';
import { createMockEndorsementSummary } from '@/tests/mock-data';
import type { ContributionType, EndorsementSummary } from '@/lib/api/schema';

describe('EndorsementBadge', () => {
  describe('rendering', () => {
    it('renders with default props', () => {
      render(<EndorsementBadge type="methodological" count={5} />);

      expect(screen.getByTestId('endorsement-badge-methodological')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('renders all 15 contribution types', () => {
      const types: ContributionType[] = [
        'methodological',
        'analytical',
        'theoretical',
        'empirical',
        'conceptual',
        'technical',
        'data',
        'replication',
        'reproducibility',
        'synthesis',
        'interdisciplinary',
        'pedagogical',
        'visualization',
        'societal-impact',
        'clinical',
      ];

      types.forEach((type) => {
        const { unmount } = render(<EndorsementBadge type={type} count={1} />);
        expect(screen.getByTestId(`endorsement-badge-${type}`)).toBeInTheDocument();
        expect(CONTRIBUTION_CONFIG[type]).toBeDefined();
        expect(CONTRIBUTION_CONFIG[type].label).toBeTruthy();
        expect(CONTRIBUTION_CONFIG[type].description).toBeTruthy();
        unmount();
      });
    });

    it('shows label when showLabel is true', () => {
      render(<EndorsementBadge type="methodological" count={5} showLabel />);

      expect(screen.getByText('Methodological')).toBeInTheDocument();
    });

    it('applies correct size classes', () => {
      const { rerender } = render(<EndorsementBadge type="methodological" count={5} size="sm" />);
      expect(screen.getByTestId('endorsement-badge-methodological')).toHaveClass('h-5');

      rerender(<EndorsementBadge type="methodological" count={5} size="md" />);
      expect(screen.getByTestId('endorsement-badge-methodological')).toHaveClass('h-6');

      rerender(<EndorsementBadge type="methodological" count={5} size="lg" />);
      expect(screen.getByTestId('endorsement-badge-methodological')).toHaveClass('h-8');
    });

    it('applies custom className', () => {
      render(<EndorsementBadge type="methodological" count={5} className="custom-class" />);

      expect(screen.getByTestId('endorsement-badge-methodological')).toHaveClass('custom-class');
    });
  });

  describe('tooltip', () => {
    it('shows tooltip when label is hidden', async () => {
      const user = userEvent.setup();
      render(<EndorsementBadge type="methodological" count={5} />);

      const badge = screen.getByTestId('endorsement-badge-methodological');
      await user.hover(badge);

      // Tooltip should show the label and description
      const tooltipContent = await screen.findByRole('tooltip');
      expect(tooltipContent).toHaveTextContent('Methodological');
      expect(tooltipContent).toHaveTextContent('Novel methods, techniques, approaches');
    });
  });

  describe('interactions', () => {
    it('is clickable when interactive', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(<EndorsementBadge type="methodological" count={5} interactive onClick={onClick} />);

      const badge = screen.getByTestId('endorsement-badge-methodological');
      expect(badge).toHaveClass('cursor-pointer');

      await user.click(badge);
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('is not clickable when not interactive', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(<EndorsementBadge type="methodological" count={5} onClick={onClick} />);

      await user.click(screen.getByTestId('endorsement-badge-methodological'));
      expect(onClick).not.toHaveBeenCalled();
    });
  });
});

describe('EndorsementBadgeGroup', () => {
  const mockSummary = createMockEndorsementSummary({
    byType: {
      methodological: 5,
      analytical: 3,
      empirical: 2,
      theoretical: 1,
    },
    total: 11,
    endorserCount: 8,
  });

  describe('rendering', () => {
    it('renders badges for all contribution types with counts', () => {
      render(<EndorsementBadgeGroup summary={mockSummary} />);

      expect(screen.getByTestId('endorsement-badge-group')).toBeInTheDocument();
      expect(screen.getByTestId('endorsement-badge-methodological')).toBeInTheDocument();
      expect(screen.getByTestId('endorsement-badge-analytical')).toBeInTheDocument();
      expect(screen.getByTestId('endorsement-badge-empirical')).toBeInTheDocument();
      expect(screen.getByTestId('endorsement-badge-theoretical')).toBeInTheDocument();
    });

    it('sorts badges by count descending', () => {
      render(<EndorsementBadgeGroup summary={mockSummary} />);

      // Use more specific selector to exclude the group container
      const group = screen.getByTestId('endorsement-badge-group');
      const badges = group.querySelectorAll(
        '[data-testid^="endorsement-badge-"]:not([data-testid="endorsement-badge-group"])'
      );
      expect(badges[0]).toHaveAttribute('data-testid', 'endorsement-badge-methodological');
      expect(badges[1]).toHaveAttribute('data-testid', 'endorsement-badge-analytical');
      expect(badges[2]).toHaveAttribute('data-testid', 'endorsement-badge-empirical');
    });

    it('respects maxBadges limit', () => {
      render(<EndorsementBadgeGroup summary={mockSummary} maxBadges={2} />);

      expect(screen.getByTestId('endorsement-badge-methodological')).toBeInTheDocument();
      expect(screen.getByTestId('endorsement-badge-analytical')).toBeInTheDocument();
      expect(screen.queryByTestId('endorsement-badge-empirical')).not.toBeInTheDocument();
      expect(screen.getByText('+2 more')).toBeInTheDocument();
    });

    it('returns null when no endorsements', () => {
      const emptySummary: EndorsementSummary = {
        byType: {},
        total: 0,
        endorserCount: 0,
      };

      const { container } = render(<EndorsementBadgeGroup summary={emptySummary} />);
      expect(container).toBeEmptyDOMElement();
    });

    it('shows labels when showLabels is true', () => {
      render(<EndorsementBadgeGroup summary={mockSummary} showLabels />);

      expect(screen.getByText('Methodological')).toBeInTheDocument();
      expect(screen.getByText('Analytical')).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('calls onBadgeClick with type when badge clicked', async () => {
      const user = userEvent.setup();
      const onBadgeClick = vi.fn();
      render(
        <EndorsementBadgeGroup summary={mockSummary} interactive onBadgeClick={onBadgeClick} />
      );

      await user.click(screen.getByTestId('endorsement-badge-methodological'));
      expect(onBadgeClick).toHaveBeenCalledWith('methodological');
    });
  });
});

describe('EndorsementSummaryBadge', () => {
  it('renders total and endorser count', async () => {
    const user = userEvent.setup();
    render(<EndorsementSummaryBadge total={10} endorserCount={8} />);

    const badge = screen.getByTestId('endorsement-summary-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('10');
    expect(badge).toHaveTextContent('endorsements');

    // Check tooltip
    await user.hover(badge);
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('10 endorsements');
    expect(tooltip).toHaveTextContent('from 8 endorsers');
  });

  it('returns null when total is 0', () => {
    const { container } = render(<EndorsementSummaryBadge total={0} endorserCount={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('uses singular form for one endorser', async () => {
    const user = userEvent.setup();
    render(<EndorsementSummaryBadge total={1} endorserCount={1} />);

    await user.hover(screen.getByTestId('endorsement-summary-badge'));
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('from 1 endorser');
  });
});

describe('EndorsementBadgeSkeleton', () => {
  it('renders skeleton with correct size', () => {
    const { rerender } = render(<EndorsementBadgeSkeleton size="sm" />);
    expect(screen.getByTestId('endorsement-badge-skeleton')).toHaveClass('h-5');

    rerender(<EndorsementBadgeSkeleton size="md" />);
    expect(screen.getByTestId('endorsement-badge-skeleton')).toHaveClass('h-6');

    rerender(<EndorsementBadgeSkeleton size="lg" />);
    expect(screen.getByTestId('endorsement-badge-skeleton')).toHaveClass('h-8');
  });

  it('has animation class', () => {
    render(<EndorsementBadgeSkeleton />);
    expect(screen.getByTestId('endorsement-badge-skeleton')).toHaveClass('animate-pulse');
  });
});
