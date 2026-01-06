import { render, screen } from '@/tests/test-utils';
import userEvent from '@testing-library/user-event';
import { TagList, TagListSkeleton } from './tag-list';
import { createMockTagSummary } from '@/tests/mock-data';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('TagList', () => {
  const mockTags = [
    createMockTagSummary({ displayForms: ['AI'], normalizedForm: 'ai' }),
    createMockTagSummary({
      displayForms: ['Machine Learning'],
      normalizedForm: 'machine-learning',
    }),
    createMockTagSummary({ displayForms: ['NLP'], normalizedForm: 'nlp' }),
  ];

  describe('empty state', () => {
    it('returns null when tags array is empty', () => {
      const { container } = render(<TagList tags={[]} />);

      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('rendering tags', () => {
    it('renders tag list with tags', () => {
      render(<TagList tags={mockTags} />);

      expect(screen.getByTestId('tag-list')).toBeInTheDocument();
      expect(screen.getAllByTestId('tag-chip')).toHaveLength(3);
    });

    it('renders tag display forms', () => {
      render(<TagList tags={mockTags} />);

      expect(screen.getByText('AI')).toBeInTheDocument();
      expect(screen.getByText('Machine Learning')).toBeInTheDocument();
      expect(screen.getByText('NLP')).toBeInTheDocument();
    });

    it('renders string tags', () => {
      render(<TagList tags={['tag-one', 'tag-two']} />);

      expect(screen.getByText('tag-one')).toBeInTheDocument();
      expect(screen.getByText('tag-two')).toBeInTheDocument();
    });

    it('has list ARIA role', () => {
      render(<TagList tags={mockTags} />);

      expect(screen.getByRole('list', { name: 'Tags' })).toBeInTheDocument();
    });

    it('renders tags as list items', () => {
      render(<TagList tags={mockTags} />);

      expect(screen.getAllByRole('listitem')).toHaveLength(3);
    });
  });

  describe('layout variants', () => {
    it('renders wrap layout by default', () => {
      render(<TagList tags={mockTags} />);

      expect(screen.getByTestId('tag-list')).toHaveClass('flex-wrap');
    });

    it('renders inline layout', () => {
      render(<TagList tags={mockTags} layout="inline" />);

      expect(screen.getByTestId('tag-list')).toHaveClass('overflow-x-auto');
    });
  });

  describe('limit prop', () => {
    it('shows all tags when no limit', () => {
      render(<TagList tags={mockTags} />);

      expect(screen.getAllByTestId('tag-chip')).toHaveLength(3);
    });

    it('limits displayed tags', () => {
      render(<TagList tags={mockTags} limit={2} />);

      expect(screen.getAllByTestId('tag-chip')).toHaveLength(2);
    });

    it('shows overflow indicator', () => {
      render(<TagList tags={mockTags} limit={1} />);

      expect(screen.getByText('+2')).toBeInTheDocument();
    });

    it('shows correct overflow title', () => {
      render(<TagList tags={mockTags} limit={2} />);

      expect(screen.getByTitle('1 more tag')).toBeInTheDocument();
    });

    it('shows plural in overflow title', () => {
      render(<TagList tags={mockTags} limit={1} />);

      expect(screen.getByTitle('2 more tags')).toBeInTheDocument();
    });

    it('does not show overflow when all tags displayed', () => {
      render(<TagList tags={mockTags} limit={10} />);

      expect(screen.queryByText(/\+\d+/)).not.toBeInTheDocument();
    });
  });

  describe('onTagClick callback', () => {
    it('calls onTagClick when tag clicked', async () => {
      const user = userEvent.setup();
      const onTagClick = vi.fn();

      render(<TagList tags={mockTags} onTagClick={onTagClick} />);

      await user.click(screen.getByText('AI'));

      expect(onTagClick).toHaveBeenCalledWith(mockTags[0]);
    });

    it('does not add onClick when onTagClick not provided', () => {
      render(<TagList tags={mockTags} />);

      // Tags should not have cursor-pointer class when not clickable
      expect(screen.getAllByTestId('tag-chip')[0]).not.toHaveClass('cursor-pointer');
    });
  });

  describe('onTagRemove callback', () => {
    it('shows remove buttons when onTagRemove provided', () => {
      render(<TagList tags={mockTags} onTagRemove={() => {}} />);

      expect(screen.getAllByRole('button', { name: /remove/i })).toHaveLength(3);
    });

    it('calls onTagRemove when remove clicked', async () => {
      const user = userEvent.setup();
      const onTagRemove = vi.fn();

      render(<TagList tags={mockTags} onTagRemove={onTagRemove} />);

      await user.click(screen.getByRole('button', { name: /remove ai tag/i }));

      expect(onTagRemove).toHaveBeenCalledWith(mockTags[0]);
    });

    it('hides remove buttons when onTagRemove not provided', () => {
      render(<TagList tags={mockTags} />);

      expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();
    });
  });

  describe('linkToTags prop', () => {
    it('renders tags as links when linkToTags is true', () => {
      render(<TagList tags={mockTags} linkToTags />);

      expect(screen.getAllByRole('link')).toHaveLength(3);
    });

    it('does not link when onTagClick is provided', () => {
      render(<TagList tags={mockTags} linkToTags onTagClick={() => {}} />);

      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });
  });

  describe('showCounts prop', () => {
    it('shows usage counts when showCounts is true', () => {
      const tagsWithCounts = [
        createMockTagSummary({ displayForms: ['AI'], usageCount: 10 }),
        createMockTagSummary({ displayForms: ['ML'], usageCount: 5 }),
      ];

      render(<TagList tags={tagsWithCounts} showCounts />);

      expect(screen.getByText('(10)')).toBeInTheDocument();
      expect(screen.getByText('(5)')).toBeInTheDocument();
    });

    it('hides counts when showCounts is false', () => {
      const tagsWithCounts = [createMockTagSummary({ displayForms: ['AI'], usageCount: 10 })];

      render(<TagList tags={tagsWithCounts} showCounts={false} />);

      expect(screen.queryByText('(10)')).not.toBeInTheDocument();
    });
  });

  describe('size prop', () => {
    it('passes size to tag chips', () => {
      render(<TagList tags={['tag']} size="lg" />);

      expect(screen.getByTestId('tag-chip')).toHaveClass('h-8');
    });
  });

  describe('className prop', () => {
    it('applies custom className', () => {
      render(<TagList tags={mockTags} className="custom-class" />);

      expect(screen.getByTestId('tag-list')).toHaveClass('custom-class');
    });
  });
});

describe('TagListSkeleton', () => {
  it('renders skeleton', () => {
    render(<TagListSkeleton />);

    expect(screen.getByTestId('tag-list-skeleton')).toBeInTheDocument();
  });

  it('renders default count of 3 skeletons', () => {
    render(<TagListSkeleton />);

    expect(screen.getAllByTestId('tag-chip-skeleton')).toHaveLength(3);
  });

  it('renders custom count of skeletons', () => {
    render(<TagListSkeleton count={5} />);

    expect(screen.getAllByTestId('tag-chip-skeleton')).toHaveLength(5);
  });

  it('renders wrap layout by default', () => {
    render(<TagListSkeleton />);

    expect(screen.getByTestId('tag-list-skeleton')).toHaveClass('flex-wrap');
  });

  it('renders inline layout', () => {
    render(<TagListSkeleton layout="inline" />);

    expect(screen.getByTestId('tag-list-skeleton')).not.toHaveClass('flex-wrap');
  });

  it('passes size to chip skeletons', () => {
    render(<TagListSkeleton size="lg" />);

    expect(screen.getAllByTestId('tag-chip-skeleton')[0]).toHaveClass('w-20');
  });

  it('applies custom className', () => {
    render(<TagListSkeleton className="custom-class" />);

    expect(screen.getByTestId('tag-list-skeleton')).toHaveClass('custom-class');
  });
});
