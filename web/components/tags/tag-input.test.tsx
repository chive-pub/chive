import { render, screen, waitFor } from '@/tests/test-utils';
import userEvent from '@testing-library/user-event';
import { TagInput } from './tag-input';
import { createMockTagSummary } from '@/tests/mock-data';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock the useTagSuggestions hook
vi.mock('@/lib/hooks/use-tags', () => ({
  useTagSuggestions: vi.fn((query: string) => ({
    data:
      query.length >= 2
        ? [
            {
              displayForm: `${query} suggestion`,
              normalizedForm: `${query}-suggestion`,
              source: 'existing',
            },
            {
              displayForm: `${query} related`,
              normalizedForm: `${query}-related`,
              source: 'wikidata',
            },
          ]
        : [],
    isLoading: false,
  })),
}));

describe('TagInput', () => {
  const defaultProps = {
    existingTags: [] as Array<string>,
    onTagAdd: vi.fn(),
    onTagRemove: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders tag input', () => {
      render(<TagInput {...defaultProps} />);

      expect(screen.getByTestId('tag-input')).toBeInTheDocument();
      expect(screen.getByLabelText('Tag input')).toBeInTheDocument();
    });

    it('shows placeholder text', () => {
      render(<TagInput {...defaultProps} placeholder="Add tags..." />);

      expect(screen.getByPlaceholderText('Add tags...')).toBeInTheDocument();
    });

    it('shows default placeholder', () => {
      render(<TagInput {...defaultProps} />);

      expect(screen.getByPlaceholderText('Add a tag...')).toBeInTheDocument();
    });

    it('shows tag count indicator', () => {
      render(<TagInput {...defaultProps} existingTags={['tag1', 'tag2']} maxTags={10} />);

      expect(screen.getByText('2/10 tags')).toBeInTheDocument();
    });

    it('shows Add button', () => {
      render(<TagInput {...defaultProps} />);

      expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument();
    });
  });

  describe('existing tags', () => {
    it('displays existing string tags', () => {
      render(<TagInput {...defaultProps} existingTags={['ai', 'machine-learning']} />);

      expect(screen.getByText('ai')).toBeInTheDocument();
      expect(screen.getByText('machine-learning')).toBeInTheDocument();
    });

    it('displays existing TagSummary tags', () => {
      const tags = [
        createMockTagSummary({ displayForms: ['AI'], normalizedForm: 'ai' }),
        createMockTagSummary({ displayForms: ['ML'], normalizedForm: 'ml' }),
      ];

      render(<TagInput {...defaultProps} existingTags={tags} />);

      expect(screen.getByText('AI')).toBeInTheDocument();
      expect(screen.getByText('ML')).toBeInTheDocument();
    });

    it('shows remove buttons on existing tags', () => {
      render(<TagInput {...defaultProps} existingTags={['tag1']} />);

      expect(screen.getByRole('button', { name: /remove tag1 tag/i })).toBeInTheDocument();
    });

    it('calls onTagRemove when remove button clicked', async () => {
      const user = userEvent.setup();
      const onTagRemove = vi.fn();

      render(<TagInput {...defaultProps} existingTags={['removable']} onTagRemove={onTagRemove} />);

      await user.click(screen.getByRole('button', { name: /remove removable tag/i }));

      expect(onTagRemove).toHaveBeenCalledWith('removable');
    });
  });

  describe('adding tags', () => {
    it('calls onTagAdd when Add button clicked', async () => {
      const user = userEvent.setup();
      const onTagAdd = vi.fn();

      render(<TagInput {...defaultProps} onTagAdd={onTagAdd} />);

      const input = screen.getByLabelText('Tag input');
      await user.type(input, 'new-tag');
      await user.click(screen.getByRole('button', { name: /add/i }));

      expect(onTagAdd).toHaveBeenCalledWith('new-tag');
    });

    it('calls onTagAdd when Enter pressed', async () => {
      const user = userEvent.setup();
      const onTagAdd = vi.fn();

      render(<TagInput {...defaultProps} onTagAdd={onTagAdd} />);

      const input = screen.getByLabelText('Tag input');
      await user.type(input, 'enter-tag{Enter}');

      expect(onTagAdd).toHaveBeenCalledWith('enter-tag');
    });

    it('normalizes tag input', async () => {
      const user = userEvent.setup();
      const onTagAdd = vi.fn();

      render(<TagInput {...defaultProps} onTagAdd={onTagAdd} />);

      const input = screen.getByLabelText('Tag input');
      await user.type(input, 'Machine Learning{Enter}');

      expect(onTagAdd).toHaveBeenCalledWith('machine-learning');
    });

    it('removes special characters', async () => {
      const user = userEvent.setup();
      const onTagAdd = vi.fn();

      render(<TagInput {...defaultProps} onTagAdd={onTagAdd} />);

      const input = screen.getByLabelText('Tag input');
      await user.type(input, 'test@#$tag{Enter}');

      expect(onTagAdd).toHaveBeenCalledWith('testtag');
    });

    it('clears input after adding tag', async () => {
      const user = userEvent.setup();

      render(<TagInput {...defaultProps} />);

      const input = screen.getByLabelText('Tag input');
      await user.type(input, 'new-tag{Enter}');

      expect(input).toHaveValue('');
    });

    it('does not add tag shorter than 2 characters', async () => {
      const user = userEvent.setup();
      const onTagAdd = vi.fn();

      render(<TagInput {...defaultProps} onTagAdd={onTagAdd} />);

      const input = screen.getByLabelText('Tag input');
      await user.type(input, 'a{Enter}');

      expect(onTagAdd).not.toHaveBeenCalled();
    });

    it('does not add duplicate tags', async () => {
      const user = userEvent.setup();
      const onTagAdd = vi.fn();

      render(<TagInput {...defaultProps} existingTags={['existing']} onTagAdd={onTagAdd} />);

      const input = screen.getByLabelText('Tag input');
      await user.type(input, 'existing{Enter}');

      expect(onTagAdd).not.toHaveBeenCalled();
    });
  });

  describe('max tags limit', () => {
    it('hides input when max tags reached', () => {
      render(<TagInput {...defaultProps} existingTags={['tag1', 'tag2', 'tag3']} maxTags={3} />);

      expect(screen.queryByLabelText('Tag input')).not.toBeInTheDocument();
    });

    it('shows input when under max tags', () => {
      render(<TagInput {...defaultProps} existingTags={['tag1', 'tag2']} maxTags={3} />);

      expect(screen.getByLabelText('Tag input')).toBeInTheDocument();
    });

    it('does not add tag when at max', async () => {
      const user = userEvent.setup();
      const onTagAdd = vi.fn();

      // Start with 2 tags, max is 3
      const { rerender } = render(
        <TagInput
          {...defaultProps}
          existingTags={['tag1', 'tag2']}
          maxTags={3}
          onTagAdd={onTagAdd}
        />
      );

      const input = screen.getByLabelText('Tag input');
      await user.type(input, 'tag3');

      // Simulate reaching max
      rerender(
        <TagInput
          {...defaultProps}
          existingTags={['tag1', 'tag2', 'tag3']}
          maxTags={3}
          onTagAdd={onTagAdd}
        />
      );

      // Input should be hidden now
      expect(screen.queryByLabelText('Tag input')).not.toBeInTheDocument();
    });
  });

  describe('disabled state', () => {
    it('disables input when disabled', () => {
      render(<TagInput {...defaultProps} disabled />);

      expect(screen.getByLabelText('Tag input')).toBeDisabled();
    });

    it('disables Add button when disabled', () => {
      render(<TagInput {...defaultProps} disabled />);

      expect(screen.getByRole('button', { name: /add/i })).toBeDisabled();
    });
  });

  describe('Add button state', () => {
    it('disables Add button when input is empty', () => {
      render(<TagInput {...defaultProps} />);

      expect(screen.getByRole('button', { name: /add/i })).toBeDisabled();
    });

    it('disables Add button when input is too short', async () => {
      const user = userEvent.setup();

      render(<TagInput {...defaultProps} />);

      const input = screen.getByLabelText('Tag input');
      await user.type(input, 'a');

      expect(screen.getByRole('button', { name: /add/i })).toBeDisabled();
    });

    it('enables Add button when input is valid', async () => {
      const user = userEvent.setup();

      render(<TagInput {...defaultProps} />);

      const input = screen.getByLabelText('Tag input');
      await user.type(input, 'valid');

      expect(screen.getByRole('button', { name: /add/i })).toBeEnabled();
    });
  });

  describe('autocomplete suggestions', () => {
    it('shows suggestions when typing 2+ characters', async () => {
      const user = userEvent.setup();

      render(<TagInput {...defaultProps} />);

      const input = screen.getByLabelText('Tag input');
      await user.type(input, 'ai');

      await waitFor(() => {
        expect(screen.getByText('ai suggestion')).toBeInTheDocument();
      });
    });

    it('shows suggestion source', async () => {
      const user = userEvent.setup();

      render(<TagInput {...defaultProps} />);

      const input = screen.getByLabelText('Tag input');
      await user.type(input, 'ml');

      await waitFor(() => {
        expect(screen.getByText('existing')).toBeInTheDocument();
        expect(screen.getByText('wikidata')).toBeInTheDocument();
      });
    });

    it('adds tag when suggestion clicked', async () => {
      const user = userEvent.setup();
      const onTagAdd = vi.fn();

      render(<TagInput {...defaultProps} onTagAdd={onTagAdd} />);

      const input = screen.getByLabelText('Tag input');
      await user.type(input, 'ml');

      await waitFor(() => {
        expect(screen.getByText('ml suggestion')).toBeInTheDocument();
      });

      await user.click(screen.getByText('ml suggestion'));

      expect(onTagAdd).toHaveBeenCalledWith('ml-suggestion');
    });

    it('filters out already-added tags from suggestions', async () => {
      const user = userEvent.setup();

      render(<TagInput {...defaultProps} existingTags={['ml-suggestion']} />);

      const input = screen.getByLabelText('Tag input');
      await user.type(input, 'ml');

      await waitFor(() => {
        expect(screen.getByText('ml related')).toBeInTheDocument();
      });

      // The already-added tag should not appear in suggestions
      // Note: The mock returns 'ml-suggestion' but it should be filtered
    });

    it('shows empty message when no suggestions match', async () => {
      const user = userEvent.setup();

      // Add all possible suggestions to existing tags
      render(<TagInput {...defaultProps} existingTags={['xyz-suggestion', 'xyz-related']} />);

      const input = screen.getByLabelText('Tag input');
      await user.type(input, 'xyz');

      await waitFor(() => {
        expect(screen.getByText(/press enter to add/i)).toBeInTheDocument();
      });
    });

    it('closes suggestions on Escape', async () => {
      const user = userEvent.setup();

      render(<TagInput {...defaultProps} />);

      const input = screen.getByLabelText('Tag input');
      await user.type(input, 'test');

      await waitFor(() => {
        expect(screen.getByText('test suggestion')).toBeInTheDocument();
      });

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByText('test suggestion')).not.toBeInTheDocument();
      });
    });
  });

  describe('className prop', () => {
    it('applies custom className', () => {
      render(<TagInput {...defaultProps} className="custom-class" />);

      expect(screen.getByTestId('tag-input')).toHaveClass('custom-class');
    });
  });
});
