import { render, screen } from '@/tests/test-utils';
import userEvent from '@testing-library/user-event';
import { EndorsementForm, type EndorsementFormData } from './endorsement-form';

// Mock the endorsement data hook to return test categories
vi.mock('@/lib/hooks/use-endorsement-data', () => ({
  useEndorsementCategories: () => ({
    data: [
      {
        name: 'Core Research',
        kind: {
          id: 'core-research',
          uri: '',
          kind: 'type',
          subkind: 'endorsement-kind',
          label: 'Core Research',
          status: 'established',
          createdAt: '',
        },
        types: [
          {
            id: 'methodological',
            uri: 'at://test/node/1',
            kind: 'type',
            subkind: 'endorsement-type',
            label: 'Methodological',
            description: 'Research methods',
            status: 'established',
            createdAt: '',
            metadata: { slug: 'methodological' },
          },
          {
            id: 'analytical',
            uri: 'at://test/node/2',
            kind: 'type',
            subkind: 'endorsement-type',
            label: 'Analytical',
            description: 'Analysis quality',
            status: 'established',
            createdAt: '',
            metadata: { slug: 'analytical' },
          },
          {
            id: 'theoretical',
            uri: 'at://test/node/3',
            kind: 'type',
            subkind: 'endorsement-type',
            label: 'Theoretical',
            description: 'Theory development',
            status: 'established',
            createdAt: '',
            metadata: { slug: 'theoretical' },
          },
        ],
      },
      {
        name: 'Technical',
        kind: {
          id: 'technical',
          uri: '',
          kind: 'type',
          subkind: 'endorsement-kind',
          label: 'Technical',
          status: 'established',
          createdAt: '',
        },
        types: [
          {
            id: 'empirical',
            uri: 'at://test/node/4',
            kind: 'type',
            subkind: 'endorsement-type',
            label: 'Empirical',
            description: 'Empirical work',
            status: 'established',
            createdAt: '',
            metadata: { slug: 'empirical' },
          },
          {
            id: 'technical',
            uri: 'at://test/node/5',
            kind: 'type',
            subkind: 'endorsement-type',
            label: 'Technical',
            description: 'Technical quality',
            status: 'established',
            createdAt: '',
            metadata: { slug: 'technical' },
          },
          {
            id: 'data',
            uri: 'at://test/node/6',
            kind: 'type',
            subkind: 'endorsement-type',
            label: 'Data',
            description: 'Data quality',
            status: 'established',
            createdAt: '',
            metadata: { slug: 'data' },
          },
        ],
      },
      {
        name: 'Validation',
        kind: {
          id: 'validation',
          uri: '',
          kind: 'type',
          subkind: 'endorsement-kind',
          label: 'Validation',
          status: 'established',
          createdAt: '',
        },
        types: [
          {
            id: 'replication',
            uri: 'at://test/node/7',
            kind: 'type',
            subkind: 'endorsement-type',
            label: 'Replication',
            description: 'Replication study',
            status: 'established',
            createdAt: '',
            metadata: { slug: 'replication' },
          },
          {
            id: 'reproducibility',
            uri: 'at://test/node/8',
            kind: 'type',
            subkind: 'endorsement-type',
            label: 'Reproducibility',
            description: 'Reproducible',
            status: 'established',
            createdAt: '',
            metadata: { slug: 'reproducibility' },
          },
        ],
      },
      {
        name: 'Synthesis',
        kind: {
          id: 'synthesis',
          uri: '',
          kind: 'type',
          subkind: 'endorsement-kind',
          label: 'Synthesis',
          status: 'established',
          createdAt: '',
        },
        types: [
          {
            id: 'synthesis',
            uri: 'at://test/node/9',
            kind: 'type',
            subkind: 'endorsement-type',
            label: 'Synthesis',
            description: 'Synthesis work',
            status: 'established',
            createdAt: '',
            metadata: { slug: 'synthesis' },
          },
          {
            id: 'conceptual',
            uri: 'at://test/node/10',
            kind: 'type',
            subkind: 'endorsement-type',
            label: 'Conceptual',
            description: 'Conceptual work',
            status: 'established',
            createdAt: '',
            metadata: { slug: 'conceptual' },
          },
          {
            id: 'interdisciplinary',
            uri: 'at://test/node/11',
            kind: 'type',
            subkind: 'endorsement-type',
            label: 'Interdisciplinary',
            description: 'Cross-discipline',
            status: 'established',
            createdAt: '',
            metadata: { slug: 'interdisciplinary' },
          },
        ],
      },
      {
        name: 'Communication',
        kind: {
          id: 'communication',
          uri: '',
          kind: 'type',
          subkind: 'endorsement-kind',
          label: 'Communication',
          status: 'established',
          createdAt: '',
        },
        types: [
          {
            id: 'pedagogical',
            uri: 'at://test/node/12',
            kind: 'type',
            subkind: 'endorsement-type',
            label: 'Pedagogical',
            description: 'Teaching quality',
            status: 'established',
            createdAt: '',
            metadata: { slug: 'pedagogical' },
          },
          {
            id: 'visualization',
            uri: 'at://test/node/13',
            kind: 'type',
            subkind: 'endorsement-type',
            label: 'Visualization',
            description: 'Visualization quality',
            status: 'established',
            createdAt: '',
            metadata: { slug: 'visualization' },
          },
        ],
      },
      {
        name: 'Impact',
        kind: {
          id: 'impact',
          uri: '',
          kind: 'type',
          subkind: 'endorsement-kind',
          label: 'Impact',
          status: 'established',
          createdAt: '',
        },
        types: [
          {
            id: 'societal-impact',
            uri: 'at://test/node/14',
            kind: 'type',
            subkind: 'endorsement-type',
            label: 'Societal Impact',
            description: 'Social impact',
            status: 'established',
            createdAt: '',
            metadata: { slug: 'societal-impact' },
          },
          {
            id: 'clinical',
            uri: 'at://test/node/15',
            kind: 'type',
            subkind: 'endorsement-type',
            label: 'Clinical',
            description: 'Clinical relevance',
            status: 'established',
            createdAt: '',
            metadata: { slug: 'clinical' },
          },
        ],
      },
    ],
    isLoading: false,
  }),
}));

describe('EndorsementForm', () => {
  const defaultProps = {
    eprintUri: 'at://did:plc:test/pub.chive.eprint.submission/abc123',
    open: true,
    onOpenChange: vi.fn(),
    onSubmit: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders dialog when open', () => {
      render(<EndorsementForm {...defaultProps} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Endorse this eprint')).toBeInTheDocument();
      expect(
        screen.getByText('Select one or more contribution types that you are endorsing.')
      ).toBeInTheDocument();
    });

    it('does not render dialog when closed', () => {
      render(<EndorsementForm {...defaultProps} open={false} />);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders all 6 contribution categories', () => {
      render(<EndorsementForm {...defaultProps} />);

      // Categories are rendered as headings, use role or specific class
      const categories = [
        'Core Research',
        'Technical',
        'Validation',
        'Synthesis',
        'Communication',
        'Impact',
      ];
      categories.forEach((category) => {
        // There may be multiple matches for some names (Technical, Synthesis appear as both category and type)
        // Use getAllBy and check at least one exists
        const elements = screen.getAllByText(category);
        expect(elements.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('renders all 15 contribution type options', () => {
      render(<EndorsementForm {...defaultProps} />);

      // Contribution types are rendered with checkboxes
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBe(15);
    });

    it('renders comment textarea', () => {
      render(<EndorsementForm {...defaultProps} />);

      expect(screen.getByLabelText(/Comment/)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Add a brief comment/)).toBeInTheDocument();
    });

    it('renders cancel and submit buttons', () => {
      render(<EndorsementForm {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Submit endorsement/ })).toBeInTheDocument();
    });
  });

  describe('contribution type selection', () => {
    it('shows selected count', async () => {
      const user = userEvent.setup();
      render(<EndorsementForm {...defaultProps} />);

      expect(screen.getByText('0 selected')).toBeInTheDocument();

      // Click checkboxes directly, this should work
      await user.click(screen.getByRole('checkbox', { name: 'Methodological' }));
      expect(screen.getByText('1 selected')).toBeInTheDocument();

      await user.click(screen.getByRole('checkbox', { name: 'Analytical' }));
      expect(screen.getByText('2 selected')).toBeInTheDocument();
    });

    it('toggles contribution types via container click', async () => {
      const user = userEvent.setup();
      render(<EndorsementForm {...defaultProps} />);

      // Get the checkbox and its container
      const checkbox = screen.getByRole('checkbox', { name: 'Methodological' });
      const optionContainer = checkbox.closest('div[class*="cursor-pointer"]');

      // Select via container click (clicking on the container directly, not the checkbox)
      // Note: Click on the icon or text area within the container
      const icon = optionContainer!.querySelector('svg');
      await user.click(icon!);
      expect(optionContainer).toHaveClass('border-primary');
      expect(screen.getByText('1 selected')).toBeInTheDocument();

      // Deselect via another container area click
      await user.click(icon!);
      expect(optionContainer).not.toHaveClass('border-primary');
      expect(screen.getByText('0 selected')).toBeInTheDocument();
    });

    it('toggles via checkbox click', async () => {
      const user = userEvent.setup();
      render(<EndorsementForm {...defaultProps} />);

      // Direct checkbox click - works with properly configured Radix mock
      const checkbox = screen.getByRole('checkbox', { name: 'Methodological' });
      await user.click(checkbox);
      expect(screen.getByText('1 selected')).toBeInTheDocument();

      await user.click(checkbox);
      expect(screen.getByText('0 selected')).toBeInTheDocument();
    });

    it('supports initial contributions for editing', () => {
      render(
        <EndorsementForm
          {...defaultProps}
          initialContributions={['methodological', 'analytical']}
        />
      );

      expect(screen.getByText('2 selected')).toBeInTheDocument();
    });
  });

  describe('comment input', () => {
    it('accepts comment text', async () => {
      const user = userEvent.setup();
      render(<EndorsementForm {...defaultProps} />);

      const textarea = screen.getByPlaceholderText(/Add a brief comment/);
      await user.type(textarea, 'Great methodology!');

      expect(textarea).toHaveValue('Great methodology!');
    });

    it('shows character count', async () => {
      const user = userEvent.setup();
      render(<EndorsementForm {...defaultProps} />);

      expect(screen.getByText('0/5000')).toBeInTheDocument();

      const textarea = screen.getByPlaceholderText(/Add a brief comment/);
      await user.type(textarea, 'Test comment');

      expect(screen.getByText('12/5000')).toBeInTheDocument();
    });

    it('supports initial comment for editing', () => {
      render(<EndorsementForm {...defaultProps} initialComment="Existing comment" />);

      expect(screen.getByPlaceholderText(/Add a brief comment/)).toHaveValue('Existing comment');
    });
  });

  describe('validation', () => {
    it('shows validation error when no contribution types selected', () => {
      render(<EndorsementForm {...defaultProps} />);

      expect(screen.getByText('Please select at least one contribution type.')).toBeInTheDocument();
    });

    it('hides validation error when contribution type selected', async () => {
      const user = userEvent.setup();
      render(<EndorsementForm {...defaultProps} />);

      // Click on the checkbox for Methodological
      await user.click(screen.getByRole('checkbox', { name: 'Methodological' }));

      expect(
        screen.queryByText('Please select at least one contribution type.')
      ).not.toBeInTheDocument();
    });

    it('disables submit button when invalid', () => {
      render(<EndorsementForm {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Submit endorsement/ })).toBeDisabled();
    });

    it('enables submit button when valid', async () => {
      const user = userEvent.setup();
      render(<EndorsementForm {...defaultProps} />);

      await user.click(screen.getByRole('checkbox', { name: 'Methodological' }));

      expect(screen.getByRole('button', { name: /Submit endorsement/ })).toBeEnabled();
    });
  });

  describe('submission', () => {
    it('calls onSubmit with form data', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      render(<EndorsementForm {...defaultProps} onSubmit={onSubmit} />);

      // Select contribution types via checkboxes
      await user.click(screen.getByRole('checkbox', { name: 'Methodological' }));
      await user.click(screen.getByRole('checkbox', { name: 'Analytical' }));

      // Add comment
      const textarea = screen.getByPlaceholderText(/Add a brief comment/);
      await user.type(textarea, 'Great work!');

      // Submit
      await user.click(screen.getByRole('button', { name: /Submit endorsement/ }));

      expect(onSubmit).toHaveBeenCalledWith({
        eprintUri: 'at://did:plc:test/pub.chive.eprint.submission/abc123',
        contributions: ['methodological', 'analytical'],
        comment: 'Great work!',
      } satisfies EndorsementFormData);
    });

    it('omits comment when empty', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      render(<EndorsementForm {...defaultProps} onSubmit={onSubmit} />);

      await user.click(screen.getByRole('checkbox', { name: 'Methodological' }));
      await user.click(screen.getByRole('button', { name: /Submit endorsement/ }));

      expect(onSubmit).toHaveBeenCalledWith({
        eprintUri: 'at://did:plc:test/pub.chive.eprint.submission/abc123',
        contributions: ['methodological'],
        comment: undefined,
      });
    });

    it('trims whitespace from comment', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      render(<EndorsementForm {...defaultProps} onSubmit={onSubmit} />);

      await user.click(screen.getByRole('checkbox', { name: 'Methodological' }));

      const textarea = screen.getByPlaceholderText(/Add a brief comment/);
      await user.type(textarea, '  Comment with whitespace  ');

      await user.click(screen.getByRole('button', { name: /Submit endorsement/ }));

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          comment: 'Comment with whitespace',
        })
      );
    });

    it('does not submit when contributions array is empty', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      render(<EndorsementForm {...defaultProps} onSubmit={onSubmit} />);

      // Submit button should be disabled
      const submitButton = screen.getByRole('button', { name: /Submit endorsement/ });
      expect(submitButton).toBeDisabled();

      // Try clicking anyway (should not work)
      await user.click(submitButton);
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('loading state', () => {
    it('shows loading indicator when isLoading', () => {
      render(<EndorsementForm {...defaultProps} isLoading />);

      expect(screen.getByText('Submitting...')).toBeInTheDocument();
    });

    it('disables buttons when loading', () => {
      render(<EndorsementForm {...defaultProps} isLoading />);

      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
      expect(screen.getByRole('button', { name: /Submitting/ })).toBeDisabled();
    });

    it('disables textarea when loading', () => {
      render(<EndorsementForm {...defaultProps} isLoading />);

      expect(screen.getByPlaceholderText(/Add a brief comment/)).toBeDisabled();
    });
  });

  describe('error handling', () => {
    it('displays error message', () => {
      render(<EndorsementForm {...defaultProps} error="Failed to submit endorsement" />);

      expect(screen.getByText('Failed to submit endorsement')).toBeInTheDocument();
    });
  });

  describe('dialog controls', () => {
    it('calls onOpenChange(false) when cancel clicked', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(<EndorsementForm {...defaultProps} onOpenChange={onOpenChange} />);

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
