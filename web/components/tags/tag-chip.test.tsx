import { render, screen } from '@/tests/test-utils';
import userEvent from '@testing-library/user-event';
import { TagChip, TagChipWithQuality, TagChipSkeleton } from './tag-chip';
import { createMockTagSummary } from '@/tests/mock-data';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('TagChip', () => {
  describe('rendering with string tag', () => {
    it('renders tag display text', () => {
      render(<TagChip tag="machine-learning" />);

      expect(screen.getByTestId('tag-chip')).toBeInTheDocument();
      expect(screen.getByText('machine-learning')).toBeInTheDocument();
    });

    it('normalizes string tags for links', () => {
      render(<TagChip tag="Machine Learning" linkToTag />);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/tags/machine-learning');
    });
  });

  describe('rendering with TagSummary', () => {
    it('renders display form from TagSummary', () => {
      const tag = createMockTagSummary({
        displayForms: ['Machine Learning'],
        normalizedForm: 'machine-learning',
      });

      render(<TagChip tag={tag} />);

      expect(screen.getByText('Machine Learning')).toBeInTheDocument();
    });

    it('uses normalized form for link', () => {
      const tag = createMockTagSummary({
        displayForms: ['Machine Learning'],
        normalizedForm: 'machine-learning',
      });

      render(<TagChip tag={tag} linkToTag />);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/tags/machine-learning');
    });

    it('shows usage count when showCount is true', () => {
      const tag = createMockTagSummary({
        displayForms: ['AI'],
        usageCount: 42,
      });

      render(<TagChip tag={tag} showCount />);

      expect(screen.getByText('(42)')).toBeInTheDocument();
    });

    it('hides count when showCount is false', () => {
      const tag = createMockTagSummary({
        displayForms: ['AI'],
        usageCount: 42,
      });

      render(<TagChip tag={tag} showCount={false} />);

      expect(screen.queryByText('(42)')).not.toBeInTheDocument();
    });
  });

  describe('size variants', () => {
    it('renders small size', () => {
      render(<TagChip tag="test" size="sm" />);

      expect(screen.getByTestId('tag-chip')).toHaveClass('h-5', 'px-1.5', 'text-xs');
    });

    it('renders medium size (default)', () => {
      render(<TagChip tag="test" size="md" />);

      expect(screen.getByTestId('tag-chip')).toHaveClass('h-6', 'px-2', 'text-sm');
    });

    it('renders large size', () => {
      render(<TagChip tag="test" size="lg" />);

      expect(screen.getByTestId('tag-chip')).toHaveClass('h-8', 'px-3', 'text-base');
    });
  });

  describe('onClick handler', () => {
    it('calls onClick when clicked', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();

      render(<TagChip tag="clickable" onClick={onClick} />);

      await user.click(screen.getByTestId('tag-chip'));

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('applies cursor-pointer when clickable', () => {
      render(<TagChip tag="clickable" onClick={() => {}} />);

      expect(screen.getByTestId('tag-chip')).toHaveClass('cursor-pointer');
    });
  });

  describe('onRemove handler', () => {
    it('shows remove button when onRemove provided', () => {
      render(<TagChip tag="removable" onRemove={() => {}} />);

      expect(screen.getByRole('button', { name: /remove removable tag/i })).toBeInTheDocument();
    });

    it('hides remove button when onRemove not provided', () => {
      render(<TagChip tag="not-removable" />);

      expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();
    });

    it('calls onRemove when remove button clicked', async () => {
      const user = userEvent.setup();
      const onRemove = vi.fn();

      render(<TagChip tag="removable" onRemove={onRemove} />);

      await user.click(screen.getByRole('button', { name: /remove removable tag/i }));

      expect(onRemove).toHaveBeenCalledTimes(1);
    });

    it('stops propagation when remove clicked', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      const onRemove = vi.fn();

      render(<TagChip tag="test" onClick={onClick} onRemove={onRemove} />);

      await user.click(screen.getByRole('button', { name: /remove/i }));

      expect(onRemove).toHaveBeenCalled();
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('linkToTag prop', () => {
    it('renders as link when linkToTag is true', () => {
      render(<TagChip tag="linked" linkToTag />);

      expect(screen.getByRole('link')).toBeInTheDocument();
    });

    it('does not render as link when linkToTag is false', () => {
      render(<TagChip tag="not-linked" linkToTag={false} />);

      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('encodes special characters in link URL', () => {
      render(<TagChip tag="tag with spaces" linkToTag />);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/tags/tag-with-spaces');
    });
  });

  describe('className prop', () => {
    it('applies custom className', () => {
      render(<TagChip tag="styled" className="custom-class" />);

      expect(screen.getByTestId('tag-chip')).toHaveClass('custom-class');
    });
  });

  describe('truncation', () => {
    it('truncates long tag names', () => {
      render(<TagChip tag="very-long-tag-name-that-should-be-truncated" />);

      const textElement = screen.getByText('very-long-tag-name-that-should-be-truncated');
      expect(textElement).toHaveClass('truncate', 'max-w-[150px]');
    });
  });
});

describe('TagChipWithQuality', () => {
  it('renders basic TagChip when showQuality is false', () => {
    const tag = createMockTagSummary({ qualityScore: 0.5 });

    render(<TagChipWithQuality tag={tag} showQuality={false} />);

    expect(screen.getByTestId('tag-chip')).toBeInTheDocument();
    // No quality border
    expect(screen.getByTestId('tag-chip')).not.toHaveClass('border-green-500/50');
  });

  it('renders basic TagChip for string tags', () => {
    render(<TagChipWithQuality tag="string-tag" showQuality />);

    expect(screen.getByTestId('tag-chip')).toBeInTheDocument();
  });

  it('shows green border for high quality score', () => {
    const tag = createMockTagSummary({ qualityScore: 0.9 });

    render(<TagChipWithQuality tag={tag} showQuality />);

    expect(screen.getByTestId('tag-chip')).toHaveClass('border-green-500/50');
  });

  it('shows yellow border for medium quality score', () => {
    const tag = createMockTagSummary({ qualityScore: 0.5 });

    render(<TagChipWithQuality tag={tag} showQuality />);

    expect(screen.getByTestId('tag-chip')).toHaveClass('border-yellow-500/50');
  });

  it('shows red border for low quality score', () => {
    const tag = createMockTagSummary({ qualityScore: 0.1 });

    render(<TagChipWithQuality tag={tag} showQuality />);

    expect(screen.getByTestId('tag-chip')).toHaveClass('border-red-500/50');
  });

  it('shows quality percentage in tooltip', async () => {
    const user = userEvent.setup();
    const tag = createMockTagSummary({ qualityScore: 0.8, usageCount: 5 });

    render(<TagChipWithQuality tag={tag} showQuality />);

    // Hover to trigger tooltip
    await user.hover(screen.getByTestId('tag-chip'));

    // Wait for tooltip to appear with quality percentage
    // Quality is qualityScore * 100 = 80%
    // Tooltip renders content in visible div and hidden accessibility span
    const qualityElements = await screen.findAllByText(/Quality:.*80%/);
    expect(qualityElements.length).toBeGreaterThanOrEqual(1);

    // Check usage count is displayed (usageCount instead of userCount)
    const usageCountElements = screen.getAllByText(/5 uses/);
    expect(usageCountElements.length).toBeGreaterThanOrEqual(1);
  });

  it('shows singular usage for count of 1', async () => {
    const user = userEvent.setup();
    const tag = createMockTagSummary({ qualityScore: 0.9, usageCount: 1 });

    render(<TagChipWithQuality tag={tag} showQuality />);

    await user.hover(screen.getByTestId('tag-chip'));

    // Wait for tooltip to appear
    // Tooltip renders content in visible div and hidden accessibility span
    const usageElements = await screen.findAllByText(/1 use$/);
    expect(usageElements.length).toBeGreaterThanOrEqual(1);

    // Ensure we're testing singular form (not "uses")
    expect(screen.queryByText(/1 uses/)).not.toBeInTheDocument();
  });
});

describe('TagChipSkeleton', () => {
  it('renders skeleton', () => {
    render(<TagChipSkeleton />);

    expect(screen.getByTestId('tag-chip-skeleton')).toBeInTheDocument();
  });

  it('has animation class', () => {
    render(<TagChipSkeleton />);

    expect(screen.getByTestId('tag-chip-skeleton')).toHaveClass('animate-pulse');
  });

  it('renders small size', () => {
    render(<TagChipSkeleton size="sm" />);

    expect(screen.getByTestId('tag-chip-skeleton')).toHaveClass('w-12');
  });

  it('renders medium size', () => {
    render(<TagChipSkeleton size="md" />);

    expect(screen.getByTestId('tag-chip-skeleton')).toHaveClass('w-16');
  });

  it('renders large size', () => {
    render(<TagChipSkeleton size="lg" />);

    expect(screen.getByTestId('tag-chip-skeleton')).toHaveClass('w-20');
  });
});
