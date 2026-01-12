import { render, screen } from '@/tests/test-utils';
import userEvent from '@testing-library/user-event';
import { TagCloud, TagCloudSkeleton } from './tag-cloud';
import { createMockTagSummary } from '@/tests/mock-data';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('TagCloud', () => {
  const mockTags = [
    createMockTagSummary({ displayForms: ['AI'], normalizedForm: 'ai', usageCount: 100 }),
    createMockTagSummary({
      displayForms: ['Machine Learning'],
      normalizedForm: 'machine-learning',
      usageCount: 50,
    }),
    createMockTagSummary({ displayForms: ['NLP'], normalizedForm: 'nlp', usageCount: 25 }),
    createMockTagSummary({
      displayForms: ['Deep Learning'],
      normalizedForm: 'deep-learning',
      usageCount: 10,
    }),
  ];

  describe('empty state', () => {
    it('shows empty message when no tags', () => {
      render(<TagCloud tags={[]} />);

      expect(screen.getByTestId('tag-cloud-empty')).toBeInTheDocument();
      expect(screen.getByText('No tags yet')).toBeInTheDocument();
    });

    it('applies className to empty state', () => {
      render(<TagCloud tags={[]} className="custom-class" />);

      expect(screen.getByTestId('tag-cloud-empty')).toHaveClass('custom-class');
    });
  });

  describe('rendering', () => {
    it('renders tag cloud', () => {
      render(<TagCloud tags={mockTags} />);

      expect(screen.getByTestId('tag-cloud')).toBeInTheDocument();
    });

    it('renders all tags', () => {
      render(<TagCloud tags={mockTags} />);

      expect(screen.getByText('AI')).toBeInTheDocument();
      expect(screen.getByText('Machine Learning')).toBeInTheDocument();
      expect(screen.getByText('NLP')).toBeInTheDocument();
      expect(screen.getByText('Deep Learning')).toBeInTheDocument();
    });

    it('has list ARIA role', () => {
      render(<TagCloud tags={mockTags} />);

      expect(screen.getByRole('list', { name: 'Tag cloud' })).toBeInTheDocument();
    });

    it('renders tags as list items', () => {
      render(<TagCloud tags={mockTags} />);

      expect(screen.getAllByRole('listitem')).toHaveLength(4);
    });
  });

  describe('weighted sizing', () => {
    it('applies larger font to higher count tags', () => {
      render(<TagCloud tags={mockTags} minFontSize={0.75} maxFontSize={1.5} />);

      const aiTag = screen.getByText('AI');
      const deepLearningTag = screen.getByText('Deep Learning');

      // AI has highest count (100), should have larger font
      const aiSize = parseFloat(aiTag.style.fontSize);
      const dlSize = parseFloat(deepLearningTag.style.fontSize);

      expect(aiSize).toBeGreaterThan(dlSize);
    });

    it('uses average font size when all counts are equal', () => {
      const equalTags = [
        createMockTagSummary({ displayForms: ['Tag1'], usageCount: 50 }),
        createMockTagSummary({ displayForms: ['Tag2'], usageCount: 50 }),
      ];

      render(<TagCloud tags={equalTags} minFontSize={1} maxFontSize={2} />);

      const tag1 = screen.getByText('Tag1');
      const tag2 = screen.getByText('Tag2');

      expect(tag1.style.fontSize).toBe('1.5rem');
      expect(tag2.style.fontSize).toBe('1.5rem');
    });

    it('respects custom minFontSize and maxFontSize', () => {
      const tags = [
        createMockTagSummary({ displayForms: ['Small'], usageCount: 1 }),
        createMockTagSummary({ displayForms: ['Large'], usageCount: 100 }),
      ];

      render(<TagCloud tags={tags} minFontSize={0.5} maxFontSize={3} />);

      const smallTag = screen.getByText('Small');
      const largeTag = screen.getByText('Large');

      expect(smallTag.style.fontSize).toBe('0.5rem');
      expect(largeTag.style.fontSize).toBe('3rem');
    });
  });

  describe('weight classes', () => {
    it('applies font-semibold to highest weight tags', () => {
      render(<TagCloud tags={mockTags} />);

      const aiTag = screen.getByText('AI');
      expect(aiTag).toHaveClass('font-semibold');
    });

    it('applies muted color to lowest weight tags', () => {
      render(<TagCloud tags={mockTags} />);

      const deepLearningTag = screen.getByText('Deep Learning');
      // Lowest weight tags use text-muted-foreground/80 for the most muted appearance
      expect(deepLearningTag).toHaveClass('text-muted-foreground/80');
    });
  });

  describe('title attribute', () => {
    it('shows tag count in title', () => {
      render(<TagCloud tags={mockTags} />);

      expect(screen.getByTitle('AI: 100 eprints')).toBeInTheDocument();
    });

    it('shows singular for count of 1', () => {
      const tags = [createMockTagSummary({ displayForms: ['Single'], usageCount: 1 })];

      render(<TagCloud tags={tags} />);

      expect(screen.getByTitle('Single: 1 eprint')).toBeInTheDocument();
    });
  });

  describe('onTagClick callback', () => {
    it('calls onTagClick when tag clicked', async () => {
      const user = userEvent.setup();
      const onTagClick = vi.fn();

      render(<TagCloud tags={mockTags} onTagClick={onTagClick} />);

      await user.click(screen.getByText('AI'));

      expect(onTagClick).toHaveBeenCalledWith(mockTags[0]);
    });
  });

  describe('linkToTags prop', () => {
    it('renders tags as links when linkToTags is true', () => {
      render(<TagCloud tags={mockTags} linkToTags />);

      expect(screen.getAllByRole('link')).toHaveLength(4);
    });

    it('generates correct link URLs', () => {
      render(<TagCloud tags={mockTags} linkToTags />);

      const aiLink = screen.getByRole('link', { name: /ai/i });
      expect(aiLink).toHaveAttribute('href', '/tags/ai');
    });

    it('does not render links when onTagClick is provided', () => {
      render(<TagCloud tags={mockTags} linkToTags onTagClick={() => {}} />);

      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });
  });

  describe('className prop', () => {
    it('applies custom className', () => {
      render(<TagCloud tags={mockTags} className="custom-class" />);

      expect(screen.getByTestId('tag-cloud')).toHaveClass('custom-class');
    });
  });

  describe('sorting', () => {
    it('shuffles tags for visual variety', () => {
      const { container: container1 } = render(<TagCloud tags={mockTags} />);
      const order1 = Array.from(container1.querySelectorAll('[role="listitem"] span')).map(
        (el) => el.textContent
      );

      // The order should be consistent (seeded shuffle) but different from input order
      expect(order1).not.toEqual(['AI', 'Machine Learning', 'NLP', 'Deep Learning']);
    });
  });
});

describe('TagCloudSkeleton', () => {
  it('renders skeleton', () => {
    render(<TagCloudSkeleton />);

    expect(screen.getByTestId('tag-cloud-skeleton')).toBeInTheDocument();
  });

  it('renders default count of 15 skeletons', () => {
    render(<TagCloudSkeleton />);

    const skeletons = screen.getByTestId('tag-cloud-skeleton').querySelectorAll('.animate-pulse');
    expect(skeletons).toHaveLength(15);
  });

  it('renders custom count of skeletons', () => {
    render(<TagCloudSkeleton count={5} />);

    const skeletons = screen.getByTestId('tag-cloud-skeleton').querySelectorAll('.animate-pulse');
    expect(skeletons).toHaveLength(5);
  });

  it('uses varied widths for visual variety', () => {
    render(<TagCloudSkeleton count={6} />);

    const skeletons = screen.getByTestId('tag-cloud-skeleton').querySelectorAll('.animate-pulse');
    const widths = Array.from(skeletons).map((el) => {
      const classes = el.className.split(' ');
      return classes.find((c) => c.startsWith('w-'));
    });

    // Should have varied widths
    const uniqueWidths = new Set(widths);
    expect(uniqueWidths.size).toBeGreaterThan(1);
  });

  it('applies custom className', () => {
    render(<TagCloudSkeleton className="custom-class" />);

    expect(screen.getByTestId('tag-cloud-skeleton')).toHaveClass('custom-class');
  });
});
