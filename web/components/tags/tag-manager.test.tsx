import { render, screen, waitFor } from '@/tests/test-utils';
import userEvent from '@testing-library/user-event';
import { TagManager } from './tag-manager';
import { createMockUserTag, createMockTagAuthor } from '@/tests/mock-data';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock the tag hooks
const mockUseEprintTags = vi.fn();
const mockUseCreateTag = vi.fn();
const mockUseDeleteTag = vi.fn();

vi.mock('@/lib/hooks/use-tags', () => ({
  useEprintTags: (uri: string) => mockUseEprintTags(uri),
  useCreateTag: () => mockUseCreateTag(),
  useDeleteTag: () => mockUseDeleteTag(),
  useTagSuggestions: () => ({ data: [], isLoading: false }),
}));

describe('TagManager', () => {
  const eprintUri = 'at://did:plc:test/pub.chive.eprint.submission/abc123';
  const currentUserDid = 'did:plc:currentuser';

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockUseEprintTags.mockReturnValue({
      data: { tags: [] },
      isLoading: false,
      error: null,
    });

    mockUseCreateTag.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({}),
      isPending: false,
    });

    mockUseDeleteTag.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({}),
      isPending: false,
    });
  });

  describe('rendering', () => {
    it('renders tag manager', () => {
      render(<TagManager eprintUri={eprintUri} />);

      expect(screen.getByTestId('tag-manager')).toBeInTheDocument();
      expect(screen.getByText('Community Tags')).toBeInTheDocument();
    });

    it('shows loading skeleton', () => {
      mockUseEprintTags.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      render(<TagManager eprintUri={eprintUri} />);

      expect(screen.getByTestId('tag-list-skeleton')).toBeInTheDocument();
    });

    it('shows error state', () => {
      mockUseEprintTags.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Failed to fetch'),
      });

      render(<TagManager eprintUri={eprintUri} />);

      expect(screen.getByText('Failed to load tags')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows empty message when no tags', () => {
      render(<TagManager eprintUri={eprintUri} />);

      expect(screen.getByText(/no tags yet/i)).toBeInTheDocument();
    });

    it('shows add prompt when editable and no tags', () => {
      render(<TagManager eprintUri={eprintUri} editable />);

      expect(screen.getByText('Add the first tag')).toBeInTheDocument();
    });

    it('does not show add prompt when not editable', () => {
      render(<TagManager eprintUri={eprintUri} editable={false} />);

      expect(screen.queryByText('Add the first tag')).not.toBeInTheDocument();
    });
  });

  describe('displaying tags', () => {
    it('displays all tags when no currentUserDid', () => {
      const tags = [
        createMockUserTag({
          normalizedForm: 'ai',
          displayForm: 'AI',
          author: createMockTagAuthor({ did: 'did:plc:user1' }),
        }),
        createMockUserTag({
          normalizedForm: 'ml',
          displayForm: 'ML',
          author: createMockTagAuthor({ did: 'did:plc:user2' }),
        }),
      ];

      mockUseEprintTags.mockReturnValue({
        data: { tags },
        isLoading: false,
        error: null,
      });

      render(<TagManager eprintUri={eprintUri} />);

      expect(screen.getByText('AI')).toBeInTheDocument();
      expect(screen.getByText('ML')).toBeInTheDocument();
    });

    it('separates user tags from community tags', () => {
      const tags = [
        createMockUserTag({
          normalizedForm: 'my-tag',
          displayForm: 'My Tag',
          author: createMockTagAuthor({ did: currentUserDid }),
        }),
        createMockUserTag({
          normalizedForm: 'other-tag',
          displayForm: 'Other Tag',
          author: createMockTagAuthor({ did: 'did:plc:other' }),
        }),
      ];

      mockUseEprintTags.mockReturnValue({
        data: { tags },
        isLoading: false,
        error: null,
      });

      render(<TagManager eprintUri={eprintUri} currentUserDid={currentUserDid} />);

      expect(screen.getByText('Your tags')).toBeInTheDocument();
      expect(screen.getByText('Community tags')).toBeInTheDocument();
    });

    it('does not show community heading when only user tags exist', () => {
      const tags = [
        createMockUserTag({
          normalizedForm: 'my-tag',
          displayForm: 'My Tag',
          author: createMockTagAuthor({ did: currentUserDid }),
        }),
      ];

      mockUseEprintTags.mockReturnValue({
        data: { tags },
        isLoading: false,
        error: null,
      });

      render(<TagManager eprintUri={eprintUri} currentUserDid={currentUserDid} />);

      expect(screen.getByText('Your tags')).toBeInTheDocument();
      expect(screen.queryByText('Community tags')).not.toBeInTheDocument();
    });
  });

  describe('add tag button', () => {
    it('shows Add tag button when editable', () => {
      render(<TagManager eprintUri={eprintUri} editable />);

      expect(screen.getByRole('button', { name: /add tag/i })).toBeInTheDocument();
    });

    it('hides Add tag button when not editable', () => {
      render(<TagManager eprintUri={eprintUri} editable={false} />);

      expect(screen.queryByRole('button', { name: /add tag/i })).not.toBeInTheDocument();
    });

    it('opens tag input when Add tag clicked', async () => {
      const user = userEvent.setup();

      render(<TagManager eprintUri={eprintUri} editable />);

      await user.click(screen.getByRole('button', { name: /add tag/i }));

      expect(screen.getByTestId('tag-input')).toBeInTheDocument();
    });

    it('hides Add tag button when adding', async () => {
      const user = userEvent.setup();

      render(<TagManager eprintUri={eprintUri} editable />);

      await user.click(screen.getByRole('button', { name: /add tag/i }));

      expect(screen.queryByRole('button', { name: /add tag/i })).not.toBeInTheDocument();
    });

    it('shows Done button when adding', async () => {
      const user = userEvent.setup();

      render(<TagManager eprintUri={eprintUri} editable />);

      await user.click(screen.getByRole('button', { name: /add tag/i }));

      expect(screen.getByRole('button', { name: /done/i })).toBeInTheDocument();
    });

    it('closes input when Done clicked', async () => {
      const user = userEvent.setup();

      render(<TagManager eprintUri={eprintUri} editable />);

      await user.click(screen.getByRole('button', { name: /add tag/i }));
      await user.click(screen.getByRole('button', { name: /done/i }));

      expect(screen.queryByTestId('tag-input')).not.toBeInTheDocument();
    });
  });

  describe('adding tags', () => {
    it('calls createTag mutation when tag added', async () => {
      const user = userEvent.setup();
      const mutateAsync = vi.fn().mockResolvedValue({});
      mockUseCreateTag.mockReturnValue({
        mutateAsync,
        isPending: false,
      });

      render(<TagManager eprintUri={eprintUri} editable />);

      await user.click(screen.getByRole('button', { name: /add tag/i }));

      const input = screen.getByLabelText('Tag input');
      await user.type(input, 'new-tag{Enter}');

      expect(mutateAsync).toHaveBeenCalledWith({
        eprintUri,
        displayForm: 'new-tag',
      });
    });

    it('closes input after successful add', async () => {
      const user = userEvent.setup();
      const mutateAsync = vi.fn().mockResolvedValue({});
      mockUseCreateTag.mockReturnValue({
        mutateAsync,
        isPending: false,
      });

      render(<TagManager eprintUri={eprintUri} editable />);

      await user.click(screen.getByRole('button', { name: /add tag/i }));

      const input = screen.getByLabelText('Tag input');
      await user.type(input, 'new-tag{Enter}');

      await waitFor(() => {
        expect(screen.queryByTestId('tag-input')).not.toBeInTheDocument();
      });
    });

    it('disables input while creating', async () => {
      const user = userEvent.setup();
      mockUseCreateTag.mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: true,
      });

      render(<TagManager eprintUri={eprintUri} editable />);

      await user.click(screen.getByRole('button', { name: /add tag/i }));

      expect(screen.getByLabelText('Tag input')).toBeDisabled();
    });
  });

  describe('removing tags', () => {
    it('shows remove buttons on user tags when editable', () => {
      const tags = [
        createMockUserTag({
          normalizedForm: 'my-tag',
          displayForm: 'My Tag',
          author: createMockTagAuthor({ did: currentUserDid }),
        }),
      ];

      mockUseEprintTags.mockReturnValue({
        data: { tags },
        isLoading: false,
        error: null,
      });

      render(<TagManager eprintUri={eprintUri} currentUserDid={currentUserDid} editable />);

      expect(screen.getByRole('button', { name: /remove my tag tag/i })).toBeInTheDocument();
    });

    it('hides remove buttons when not editable', () => {
      const tags = [
        createMockUserTag({
          normalizedForm: 'my-tag',
          displayForm: 'My Tag',
          author: createMockTagAuthor({ did: currentUserDid }),
        }),
      ];

      mockUseEprintTags.mockReturnValue({
        data: { tags },
        isLoading: false,
        error: null,
      });

      render(<TagManager eprintUri={eprintUri} currentUserDid={currentUserDid} editable={false} />);

      expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();
    });

    it('calls deleteTag mutation when tag removed', async () => {
      const user = userEvent.setup();
      const mutateAsync = vi.fn().mockResolvedValue({});
      mockUseDeleteTag.mockReturnValue({
        mutateAsync,
        isPending: false,
      });

      const tags = [
        createMockUserTag({
          normalizedForm: 'removable',
          displayForm: 'Removable',
          author: createMockTagAuthor({ did: currentUserDid }),
        }),
      ];

      mockUseEprintTags.mockReturnValue({
        data: { tags },
        isLoading: false,
        error: null,
      });

      render(<TagManager eprintUri={eprintUri} currentUserDid={currentUserDid} editable />);

      await user.click(screen.getByRole('button', { name: /remove removable tag/i }));

      // Delete mutation receives uri and eprintUri from the tag
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          eprintUri,
          uri: expect.any(String),
        })
      );
    });
  });

  describe('clicking add first tag link', () => {
    it('opens tag input when empty state link clicked', async () => {
      const user = userEvent.setup();

      render(<TagManager eprintUri={eprintUri} editable />);

      await user.click(screen.getByText('Add the first tag'));

      expect(screen.getByTestId('tag-input')).toBeInTheDocument();
    });
  });

  describe('className prop', () => {
    it('applies custom className', () => {
      render(<TagManager eprintUri={eprintUri} className="custom-class" />);

      expect(screen.getByTestId('tag-manager')).toHaveClass('custom-class');
    });
  });

  describe('tags are linked', () => {
    it('links tags to tag browse pages', () => {
      const tags = [
        createMockUserTag({
          normalizedForm: 'linked-tag',
          displayForm: 'Linked Tag',
          author: createMockTagAuthor({ did: 'did:plc:other' }),
        }),
      ];

      mockUseEprintTags.mockReturnValue({
        data: { tags },
        isLoading: false,
        error: null,
      });

      render(<TagManager eprintUri={eprintUri} />);

      expect(screen.getByRole('link')).toHaveAttribute('href', '/tags/linked-tag');
    });
  });
});
