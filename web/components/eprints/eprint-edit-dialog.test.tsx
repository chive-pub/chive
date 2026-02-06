import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EprintEditDialog, type EprintEditData } from './eprint-edit-dialog';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock the auth context
const mockAgent = {
  uploadBlob: vi.fn(),
  com: {
    atproto: {
      repo: {
        getRecord: vi.fn(),
        putRecord: vi.fn(),
      },
    },
  },
};

vi.mock('@/lib/auth/auth-context', () => ({
  useAgent: () => mockAgent,
}));

// Mock the update mutation
const mockMutateAsync = vi.fn();
vi.mock('@/lib/hooks/use-eprint-mutations', () => ({
  useUpdateEprint: () => ({
    mutateAsync: mockMutateAsync,
  }),
  formatVersion: (version: { major: number; minor: number; patch: number }) =>
    `${version.major}.${version.minor}.${version.patch}`,
}));

// Mock logger
vi.mock('@/lib/observability', () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

const mockEprint: EprintEditData = {
  uri: 'at://did:plc:test123/pub.chive.eprint.submission/3abc123',
  rkey: '3abc123',
  collection: 'pub.chive.eprint.submission',
  title: 'Test Eprint Title',
  keywords: ['machine learning', 'NLP'],
  version: { major: 1, minor: 0, patch: 0 },
  repo: 'did:plc:test123',
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  Wrapper.displayName = 'TestQueryClientWrapper';
  return Wrapper;
}

describe('EprintEditDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockMutateAsync.mockResolvedValue({
      uri: mockEprint.uri,
      version: { major: 1, minor: 0, patch: 1 },
      expectedCid: 'bafyreiabc123',
    });

    mockAgent.com.atproto.repo.getRecord.mockResolvedValue({
      data: {
        value: {
          title: mockEprint.title,
          keywords: mockEprint.keywords,
          version: mockEprint.version,
        },
      },
    });

    mockAgent.com.atproto.repo.putRecord.mockResolvedValue({});
  });

  it('renders trigger button when canEdit is true', () => {
    render(<EprintEditDialog eprint={mockEprint} canEdit={true} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit/i })).not.toBeDisabled();
  });

  it('renders disabled trigger button when canEdit is false', () => {
    render(<EprintEditDialog eprint={mockEprint} canEdit={false} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByRole('button', { name: /edit/i })).toBeDisabled();
  });

  it('renders custom trigger when children provided', () => {
    render(
      <EprintEditDialog eprint={mockEprint} canEdit={true}>
        <button>Custom Edit Button</button>
      </EprintEditDialog>,
      { wrapper: createWrapper() }
    );

    expect(screen.getByRole('button', { name: /custom edit button/i })).toBeInTheDocument();
  });

  it('opens dialog when trigger is clicked', async () => {
    const user = userEvent.setup();

    render(<EprintEditDialog eprint={mockEprint} canEdit={true} />, {
      wrapper: createWrapper(),
    });

    await user.click(screen.getByRole('button', { name: /edit/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Edit Eprint')).toBeInTheDocument();
  });

  it('pre-populates form with existing eprint data', async () => {
    const user = userEvent.setup();

    render(<EprintEditDialog eprint={mockEprint} canEdit={true} />, {
      wrapper: createWrapper(),
    });

    await user.click(screen.getByRole('button', { name: /edit/i }));

    // Title is in PlainMarkdownEditor (uses aria-label)
    const titleEditor = screen.getByLabelText('Title editor');
    expect(titleEditor).toHaveValue('Test Eprint Title');
    expect(screen.getByDisplayValue('machine learning, NLP')).toBeInTheDocument();
  });

  it('displays current version in version selector', async () => {
    const user = userEvent.setup();

    render(<EprintEditDialog eprint={mockEprint} canEdit={true} />, {
      wrapper: createWrapper(),
    });

    await user.click(screen.getByRole('button', { name: /edit/i }));

    expect(screen.getByText('Current: v1.0.0')).toBeInTheDocument();
  });

  it('shows version selector with options', async () => {
    const user = userEvent.setup();

    render(<EprintEditDialog eprint={mockEprint} canEdit={true} />, {
      wrapper: createWrapper(),
    });

    await user.click(screen.getByRole('button', { name: /edit/i }));

    expect(screen.getByText('Version Bump Type')).toBeInTheDocument();
    expect(screen.getByText('Patch')).toBeInTheDocument();
    expect(screen.getByText('Minor')).toBeInTheDocument();
    expect(screen.getByText('Major')).toBeInTheDocument();
  });

  it('shows changelog details collapsible section', async () => {
    const user = userEvent.setup();

    render(<EprintEditDialog eprint={mockEprint} canEdit={true} />, {
      wrapper: createWrapper(),
    });

    await user.click(screen.getByRole('button', { name: /edit/i }));

    // Should show the changelog details button (collapsed by default)
    expect(screen.getByRole('button', { name: /changelog details/i })).toBeInTheDocument();
  });

  it('shows document replacement section', async () => {
    const user = userEvent.setup();

    render(<EprintEditDialog eprint={mockEprint} canEdit={true} />, {
      wrapper: createWrapper(),
    });

    await user.click(screen.getByRole('button', { name: /edit/i }));

    expect(screen.getByText('Replace Document (Optional)')).toBeInTheDocument();
    expect(screen.getByText(/supported formats/i)).toBeInTheDocument();
  });

  it('calls mutation and PDS on form submission', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();

    render(<EprintEditDialog eprint={mockEprint} canEdit={true} onSuccess={onSuccess} />, {
      wrapper: createWrapper(),
    });

    await user.click(screen.getByRole('button', { name: /edit/i }));

    // Update the title (in PlainMarkdownEditor)
    const titleInput = screen.getByLabelText('Title editor');
    await user.clear(titleInput);
    await user.type(titleInput, 'Updated Title');

    // Submit without expanding changelog (no changelog data)
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        uri: mockEprint.uri,
        versionBump: 'patch',
        title: 'Updated Title',
        keywords: ['machine learning', 'NLP'],
        changelog: undefined,
      });
    });

    await waitFor(() => {
      expect(mockAgent.com.atproto.repo.putRecord).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it(
    'calls mutation with changelog data when changelog is expanded and filled',
    async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();

      render(<EprintEditDialog eprint={mockEprint} canEdit={true} onSuccess={onSuccess} />, {
        wrapper: createWrapper(),
      });

      await user.click(screen.getByRole('button', { name: /edit/i }));

      // Expand the changelog section
      await user.click(screen.getByRole('button', { name: /changelog details/i }));

      // Add changelog summary using paste for speed
      const summaryInput = screen.getByPlaceholderText('One-line summary of changes (optional)');
      await user.click(summaryInput);
      await user.paste('Fixed typos');

      // Submit
      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            uri: mockEprint.uri,
            versionBump: 'patch',
            changelog: expect.objectContaining({
              summary: 'Fixed typos',
              sections: [],
            }),
          })
        );
      });

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });
    },
    { timeout: 10000 }
  );

  it('shows success toast after successful submission', async () => {
    const { toast } = await import('sonner');
    const user = userEvent.setup();

    render(<EprintEditDialog eprint={mockEprint} canEdit={true} />, {
      wrapper: createWrapper(),
    });

    await user.click(screen.getByRole('button', { name: /edit/i }));
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Eprint updated successfully', expect.anything());
    });
  });

  it('shows error toast when mutation fails', async () => {
    const { toast } = await import('sonner');
    mockMutateAsync.mockRejectedValue(new Error('Authorization failed'));

    const user = userEvent.setup();

    render(<EprintEditDialog eprint={mockEprint} canEdit={true} />, {
      wrapper: createWrapper(),
    });

    await user.click(screen.getByRole('button', { name: /edit/i }));
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to update eprint', expect.anything());
    });
  });

  it('shows specific error for unauthorized access', async () => {
    const { toast } = await import('sonner');
    mockMutateAsync.mockRejectedValue(new Error('Unauthorized'));

    const user = userEvent.setup();

    render(<EprintEditDialog eprint={mockEprint} canEdit={true} />, {
      wrapper: createWrapper(),
    });

    await user.click(screen.getByRole('button', { name: /edit/i }));
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Not authorized to edit this eprint');
    });
  });

  it('shows specific error for swap record conflict', async () => {
    const { toast } = await import('sonner');
    mockAgent.com.atproto.repo.putRecord.mockRejectedValue(
      new Error('swapRecord check failed: expected bafyreiabc123')
    );

    const user = userEvent.setup();

    render(<EprintEditDialog eprint={mockEprint} canEdit={true} />, {
      wrapper: createWrapper(),
    });

    await user.click(screen.getByRole('button', { name: /edit/i }));
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Update conflict', expect.anything());
    });
  });

  it('shows loading state while submitting', async () => {
    mockMutateAsync.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({ version: { major: 1, minor: 0, patch: 1 }, expectedCid: 'bafyreiabc123' }),
            500
          )
        )
    );

    const user = userEvent.setup();

    render(<EprintEditDialog eprint={mockEprint} canEdit={true} />, {
      wrapper: createWrapper(),
    });

    await user.click(screen.getByRole('button', { name: /edit/i }));
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    // The loading state should appear while the mutation is pending
    await waitFor(() => {
      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });
  });

  it('closes dialog on cancel', async () => {
    const user = userEvent.setup();

    render(<EprintEditDialog eprint={mockEprint} canEdit={true} />, {
      wrapper: createWrapper(),
    });

    await user.click(screen.getByRole('button', { name: /edit/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('resets form when dialog reopens', async () => {
    const user = userEvent.setup();

    const { rerender } = render(<EprintEditDialog eprint={mockEprint} canEdit={true} />, {
      wrapper: createWrapper(),
    });

    // Open and modify
    await user.click(screen.getByRole('button', { name: /edit/i }));
    const titleInput = screen.getByLabelText('Title editor');
    await user.clear(titleInput);
    await user.type(titleInput, 'Modified Title');

    // Close
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // Rerender and reopen
    rerender(<EprintEditDialog eprint={mockEprint} canEdit={true} />);
    await user.click(screen.getByRole('button', { name: /edit/i }));

    // Should be reset to original value
    const resetTitleInput = screen.getByLabelText('Title editor');
    expect(resetTitleInput).toHaveValue('Test Eprint Title');
  });

  it('validates title is required', async () => {
    const user = userEvent.setup();

    render(<EprintEditDialog eprint={mockEprint} canEdit={true} />, {
      wrapper: createWrapper(),
    });

    await user.click(screen.getByRole('button', { name: /edit/i }));

    // Clear the title using clear method
    const titleInput = screen.getByLabelText('Title editor');
    await user.clear(titleInput);

    // Submit
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    // Wait for validation message
    await waitFor(
      () => {
        expect(screen.getByText('Title is required')).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('validates title max length', async () => {
    const user = userEvent.setup();

    render(<EprintEditDialog eprint={mockEprint} canEdit={true} />, {
      wrapper: createWrapper(),
    });

    await user.click(screen.getByRole('button', { name: /edit/i }));

    // Enter very long title using fireEvent.change to avoid slow character-by-character typing
    const titleInput = screen.getByLabelText('Title editor');
    const longTitle = 'A'.repeat(501);

    // Use fireEvent.change for long strings instead of user.type() which is extremely slow
    // for 501 characters (each char triggers full event cycle)
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value'
    )?.set;
    nativeInputValueSetter?.call(titleInput, longTitle);
    titleInput.dispatchEvent(new Event('input', { bubbles: true }));

    // Submit
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    // MarkdownEditor displays character count but doesn't enforce maxLength,
    // so form validation will catch the over-limit title and show an error
    await waitFor(() => {
      expect(screen.getByText(/title must be 300 characters or fewer/i)).toBeInTheDocument();
    });

    // The mutation should NOT be called because validation failed
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('parses keywords correctly from comma-separated input', async () => {
    const user = userEvent.setup();

    render(<EprintEditDialog eprint={mockEprint} canEdit={true} />, {
      wrapper: createWrapper(),
    });

    await user.click(screen.getByRole('button', { name: /edit/i }));

    // Update keywords
    const keywordsInput = screen.getByDisplayValue('machine learning, NLP');
    await user.clear(keywordsInput);
    await user.type(keywordsInput, 'AI, deep learning, transformers');

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          keywords: ['AI', 'deep learning', 'transformers'],
        })
      );
    });
  });

  it('handles file selection for document replacement', async () => {
    const user = userEvent.setup();

    render(<EprintEditDialog eprint={mockEprint} canEdit={true} />, {
      wrapper: createWrapper(),
    });

    await user.click(screen.getByRole('button', { name: /edit/i }));

    // Create a mock file
    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(fileInput, file);

    expect(screen.getByText('test.pdf')).toBeInTheDocument();
  });

  it('clears selected file when remove button clicked', async () => {
    const user = userEvent.setup();

    render(<EprintEditDialog eprint={mockEprint} canEdit={true} />, {
      wrapper: createWrapper(),
    });

    await user.click(screen.getByRole('button', { name: /edit/i }));

    // Upload a file
    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);

    expect(screen.getByText('test.pdf')).toBeInTheDocument();

    // Clear the file
    await user.click(screen.getByRole('button', { name: /remove file/i }));

    expect(screen.queryByText('test.pdf')).not.toBeInTheDocument();
  });

  it('shows selected file name and remove button', async () => {
    const user = userEvent.setup();

    render(<EprintEditDialog eprint={mockEprint} canEdit={true} />, {
      wrapper: createWrapper(),
    });

    await user.click(screen.getByRole('button', { name: /edit/i }));

    // Upload a file
    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);

    // Verify file is shown with remove button
    expect(screen.getByText('test.pdf')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove file/i })).toBeInTheDocument();
  });

  it('shows error toast when agent is not available', async () => {
    const { toast } = await import('sonner');

    // Temporarily mock useAgent to return null
    vi.mocked(await import('@/lib/auth/auth-context')).useAgent = vi.fn().mockReturnValue(null);

    const user = userEvent.setup();

    render(<EprintEditDialog eprint={mockEprint} canEdit={true} />, {
      wrapper: createWrapper(),
    });

    await user.click(screen.getByRole('button', { name: /edit/i }));
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Not authenticated. Please log in and try again.');
    });

    // Reset the mock
    vi.mocked(await import('@/lib/auth/auth-context')).useAgent = vi
      .fn()
      .mockReturnValue(mockAgent);
  });

  it('handles eprint without version gracefully', async () => {
    const user = userEvent.setup();
    const eprintNoVersion: EprintEditData = {
      ...mockEprint,
      version: undefined,
    };

    render(<EprintEditDialog eprint={eprintNoVersion} canEdit={true} />, {
      wrapper: createWrapper(),
    });

    await user.click(screen.getByRole('button', { name: /edit/i }));

    // Should not show current version
    expect(screen.queryByText(/current:/i)).not.toBeInTheDocument();
  });

  it('handles eprint without keywords gracefully', async () => {
    const user = userEvent.setup();
    const eprintNoKeywords: EprintEditData = {
      ...mockEprint,
      keywords: undefined,
    };

    render(<EprintEditDialog eprint={eprintNoKeywords} canEdit={true} />, {
      wrapper: createWrapper(),
    });

    await user.click(screen.getByRole('button', { name: /edit/i }));

    // Keywords field should be empty
    const keywordsInput = screen.getByPlaceholderText('Enter keywords, separated by commas');
    expect(keywordsInput).toHaveValue('');
  });

  it('allows selecting different version bump types', async () => {
    const user = userEvent.setup();

    render(<EprintEditDialog eprint={mockEprint} canEdit={true} />, {
      wrapper: createWrapper(),
    });

    await user.click(screen.getByRole('button', { name: /edit/i }));

    // Click on Minor option
    await user.click(screen.getByText('Minor'));

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          versionBump: 'minor',
        })
      );
    });
  });
});
