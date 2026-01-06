import { render, screen } from '@/tests/test-utils';
import userEvent from '@testing-library/user-event';
import { TrendingTags } from './trending-tags';
import { createMockTagSummary } from '@/tests/mock-data';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock the useTrendingTags hook
const mockUseTrendingTags = vi.fn();

vi.mock('@/lib/hooks/use-tags', () => ({
  useTrendingTags: (options: { limit: number; timeWindow: string }) => mockUseTrendingTags(options),
}));

describe('TrendingTags', () => {
  const mockTags = [
    createMockTagSummary({ displayForms: ['AI'], normalizedForm: 'ai', usageCount: 100 }),
    createMockTagSummary({
      displayForms: ['Machine Learning'],
      normalizedForm: 'machine-learning',
      usageCount: 80,
    }),
    createMockTagSummary({ displayForms: ['NLP'], normalizedForm: 'nlp', usageCount: 50 }),
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseTrendingTags.mockReturnValue({
      data: { tags: mockTags },
      isLoading: false,
      error: null,
    });
  });

  describe('card variant (default)', () => {
    it('renders trending tags card', () => {
      render(<TrendingTags />);

      expect(screen.getByTestId('trending-tags')).toBeInTheDocument();
      expect(screen.getByText('Trending tags')).toBeInTheDocument();
    });

    it('displays trending tags', () => {
      render(<TrendingTags />);

      expect(screen.getByText('AI')).toBeInTheDocument();
      expect(screen.getByText('Machine Learning')).toBeInTheDocument();
      expect(screen.getByText('NLP')).toBeInTheDocument();
    });

    it('shows usage counts', () => {
      render(<TrendingTags />);

      expect(screen.getByText('(100)')).toBeInTheDocument();
      expect(screen.getByText('(80)')).toBeInTheDocument();
      expect(screen.getByText('(50)')).toBeInTheDocument();
    });

    it('shows loading skeleton', () => {
      mockUseTrendingTags.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      render(<TrendingTags />);

      expect(screen.getByTestId('tag-list-skeleton')).toBeInTheDocument();
    });

    it('shows error message', () => {
      mockUseTrendingTags.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Failed'),
      });

      render(<TrendingTags />);

      expect(screen.getByText('Failed to load tags')).toBeInTheDocument();
    });

    it('shows empty message when no tags', () => {
      mockUseTrendingTags.mockReturnValue({
        data: { tags: [] },
        isLoading: false,
        error: null,
      });

      render(<TrendingTags />);

      expect(screen.getByText('No trending tags')).toBeInTheDocument();
    });
  });

  describe('inline variant', () => {
    it('renders tags without card wrapper', () => {
      render(<TrendingTags variant="inline" />);

      expect(screen.queryByTestId('trending-tags')).not.toBeInTheDocument();
      expect(screen.getByTestId('tag-list')).toBeInTheDocument();
    });

    it('shows skeleton while loading', () => {
      mockUseTrendingTags.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      render(<TrendingTags variant="inline" />);

      expect(screen.getByTestId('tag-list-skeleton')).toBeInTheDocument();
    });

    it('returns null on error', () => {
      mockUseTrendingTags.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Failed'),
      });

      const { container } = render(<TrendingTags variant="inline" />);

      expect(container).toBeEmptyDOMElement();
    });

    it('returns null when no tags', () => {
      mockUseTrendingTags.mockReturnValue({
        data: { tags: [] },
        isLoading: false,
        error: null,
      });

      const { container } = render(<TrendingTags variant="inline" />);

      expect(container).toBeEmptyDOMElement();
    });

    it('uses small size chips', () => {
      render(<TrendingTags variant="inline" />);

      expect(screen.getAllByTestId('tag-chip')[0]).toHaveClass('h-5');
    });
  });

  describe('limit prop', () => {
    it('applies client-side limiting', () => {
      // The component applies limit client-side after fetching all tags
      render(<TrendingTags limit={2} />);

      // Only first 2 tags should be shown
      expect(screen.getByText('AI')).toBeInTheDocument();
      expect(screen.getByText('Machine Learning')).toBeInTheDocument();
      expect(screen.queryByText('NLP')).not.toBeInTheDocument();
    });

    it('shows all tags when limit exceeds tag count', () => {
      render(<TrendingTags limit={10} />);

      expect(screen.getByText('AI')).toBeInTheDocument();
      expect(screen.getByText('Machine Learning')).toBeInTheDocument();
      expect(screen.getByText('NLP')).toBeInTheDocument();
    });
  });

  describe('timeWindow prop', () => {
    it('passes timeWindow to hook', () => {
      render(<TrendingTags timeWindow="month" />);

      // useTrendingTags is called with timeWindow string directly
      expect(mockUseTrendingTags).toHaveBeenCalledWith('month');
    });

    it('defaults to week', () => {
      render(<TrendingTags />);

      // useTrendingTags is called with timeWindow string directly
      expect(mockUseTrendingTags).toHaveBeenCalledWith('week');
    });

    it('supports day timeWindow', () => {
      render(<TrendingTags timeWindow="day" />);

      // useTrendingTags is called with timeWindow string directly
      expect(mockUseTrendingTags).toHaveBeenCalledWith('day');
    });
  });

  describe('onTagClick callback', () => {
    it('calls onTagClick when tag clicked in card variant', async () => {
      const user = userEvent.setup();
      const onTagClick = vi.fn();

      render(<TrendingTags onTagClick={onTagClick} />);

      await user.click(screen.getByText('AI'));

      // onTagClick receives the normalized form string, not the full TagSummary
      expect(onTagClick).toHaveBeenCalledWith('ai');
    });

    it('calls onTagClick when tag clicked in inline variant', async () => {
      const user = userEvent.setup();
      const onTagClick = vi.fn();

      render(<TrendingTags variant="inline" onTagClick={onTagClick} />);

      await user.click(screen.getByText('AI'));

      // onTagClick receives the normalized form string, not the full TagSummary
      expect(onTagClick).toHaveBeenCalledWith('ai');
    });
  });

  describe('linkToTags prop', () => {
    it('links tags by default', () => {
      render(<TrendingTags />);

      expect(screen.getAllByRole('link')).toHaveLength(3);
    });

    it('does not link when linkToTags is false', () => {
      render(<TrendingTags linkToTags={false} />);

      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('does not link when onTagClick is provided', () => {
      render(<TrendingTags linkToTags onTagClick={() => {}} />);

      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('generates correct link URLs', () => {
      render(<TrendingTags />);

      const links = screen.getAllByRole('link');
      expect(links[0]).toHaveAttribute('href', '/tags/ai');
      expect(links[1]).toHaveAttribute('href', '/tags/machine-learning');
    });
  });

  describe('className prop', () => {
    it('applies custom className to card variant', () => {
      render(<TrendingTags className="custom-class" />);

      expect(screen.getByTestId('trending-tags')).toHaveClass('custom-class');
    });

    it('applies custom className to inline variant', () => {
      render(<TrendingTags variant="inline" className="custom-class" />);

      expect(screen.getByTestId('tag-list')).toHaveClass('custom-class');
    });

    it('applies custom className to inline skeleton', () => {
      mockUseTrendingTags.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      render(<TrendingTags variant="inline" className="custom-class" />);

      expect(screen.getByTestId('tag-list-skeleton')).toHaveClass('custom-class');
    });
  });

  describe('wrap layout', () => {
    it('uses wrap layout for tags', () => {
      render(<TrendingTags />);

      expect(screen.getByTestId('tag-list')).toHaveClass('flex-wrap');
    });
  });
});
