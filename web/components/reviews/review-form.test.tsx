import { render, screen } from '@/tests/test-utils';
import userEvent from '@testing-library/user-event';
import {
  ReviewForm,
  InlineReplyForm,
  TargetSpanPreview,
  ParentReviewPreview,
  type ReviewFormData,
} from './review-form';
import {
  createMockReview,
  createMockTextSpanTarget,
  createMockReviewAuthor,
} from '@/tests/mock-data';

describe('ReviewForm', () => {
  const defaultProps = {
    eprintUri: 'at://did:plc:test/pub.chive.eprint.submission/abc123',
    onSubmit: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders form with default state', () => {
      render(<ReviewForm {...defaultProps} />);

      expect(screen.getByTestId('review-form')).toBeInTheDocument();
      expect(screen.getByLabelText(/write a review/i)).toBeInTheDocument();
      expect(screen.getByTestId('review-content-input')).toBeInTheDocument();
    });

    it('shows character count', () => {
      const { container } = render(<ReviewForm {...defaultProps} />);

      // Character count is split across multiple text nodes, query by container id
      const charCount = container.querySelector('#review-char-count');
      expect(charCount).toBeInTheDocument();
      expect(charCount?.textContent).toContain('0');
      expect(charCount?.textContent).toContain('10000');
    });

    it('shows keyboard shortcut hint', () => {
      render(<ReviewForm {...defaultProps} />);

      expect(screen.getByText(/press/i)).toBeInTheDocument();
      expect(screen.getByText(/enter/i)).toBeInTheDocument();
    });

    it('shows submit button', () => {
      render(<ReviewForm {...defaultProps} />);

      expect(screen.getByRole('button', { name: /post review/i })).toBeInTheDocument();
    });

    it('shows cancel button when onCancel provided', () => {
      const onCancel = vi.fn();
      render(<ReviewForm {...defaultProps} onCancel={onCancel} />);

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('hides cancel button when onCancel not provided', () => {
      render(<ReviewForm {...defaultProps} />);

      expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
    });
  });

  describe('input handling', () => {
    it('updates content as user types', async () => {
      const user = userEvent.setup();
      const { container } = render(<ReviewForm {...defaultProps} />);

      const textarea = screen.getByTestId('review-content-input');
      await user.type(textarea, 'Great paper!');

      expect(textarea).toHaveValue('Great paper!');
      // Character count is split across multiple text nodes
      const charCount = container.querySelector('#review-char-count');
      expect(charCount?.textContent).toContain('12');
    });

    it('focuses textarea on mount', () => {
      render(<ReviewForm {...defaultProps} />);

      expect(screen.getByTestId('review-content-input')).toHaveFocus();
    });
  });

  describe('validation', () => {
    it('disables submit when content too short', () => {
      render(<ReviewForm {...defaultProps} minLength={10} />);

      expect(screen.getByRole('button', { name: /post review/i })).toBeDisabled();
    });

    it('enables submit when content meets minimum', async () => {
      const user = userEvent.setup();
      render(<ReviewForm {...defaultProps} minLength={5} />);

      const textarea = screen.getByTestId('review-content-input');
      await user.type(textarea, 'Hello world!');

      expect(screen.getByRole('button', { name: /post review/i })).toBeEnabled();
    });

    it('shows minimum length indicator', async () => {
      const user = userEvent.setup();
      render(<ReviewForm {...defaultProps} minLength={20} />);

      const textarea = screen.getByTestId('review-content-input');
      await user.type(textarea, 'Short');

      expect(screen.getByText(/min 20/)).toBeInTheDocument();
    });
  });

  describe('submission', () => {
    it('calls onSubmit with form data', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      render(<ReviewForm {...defaultProps} onSubmit={onSubmit} minLength={1} />);

      const textarea = screen.getByTestId('review-content-input');
      await user.type(textarea, 'Great methodology and analysis!');
      await user.click(screen.getByRole('button', { name: /post review/i }));

      expect(onSubmit).toHaveBeenCalledWith({
        content: 'Great methodology and analysis!',
        eprintUri: 'at://did:plc:test/pub.chive.eprint.submission/abc123',
        target: undefined,
        parentReviewUri: undefined,
        motivation: 'commenting',
      } satisfies ReviewFormData);
    });

    it('trims whitespace from content', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      render(<ReviewForm {...defaultProps} onSubmit={onSubmit} minLength={1} />);

      const textarea = screen.getByTestId('review-content-input');
      await user.type(textarea, '  Content with spaces  ');
      await user.click(screen.getByRole('button', { name: /post review/i }));

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Content with spaces',
        })
      );
    });

    it('submits with Cmd+Enter', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      render(<ReviewForm {...defaultProps} onSubmit={onSubmit} minLength={1} />);

      const textarea = screen.getByTestId('review-content-input');
      await user.type(textarea, 'Review content');
      await user.keyboard('{Meta>}{Enter}{/Meta}');

      expect(onSubmit).toHaveBeenCalled();
    });

    it('does not submit when invalid', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      render(<ReviewForm {...defaultProps} onSubmit={onSubmit} minLength={100} />);

      const textarea = screen.getByTestId('review-content-input');
      await user.type(textarea, 'Short');
      await user.keyboard('{Meta>}{Enter}{/Meta}');

      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('reply mode', () => {
    it('shows reply label when parentReview provided', () => {
      const parentReview = createMockReview();
      render(<ReviewForm {...defaultProps} parentReview={parentReview} />);

      expect(screen.getByLabelText(/write a reply/i)).toBeInTheDocument();
    });

    it('shows parent review preview', () => {
      const parentReview = createMockReview({
        content: 'This is the parent review content',
      });
      render(<ReviewForm {...defaultProps} parentReview={parentReview} />);

      expect(screen.getByTestId('parent-review-preview')).toBeInTheDocument();
    });

    it('sets motivation to replying', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      const parentReview = createMockReview();
      render(
        <ReviewForm
          {...defaultProps}
          onSubmit={onSubmit}
          parentReview={parentReview}
          minLength={1}
        />
      );

      await user.type(screen.getByTestId('review-content-input'), 'Reply content');
      await user.click(screen.getByRole('button', { name: /reply/i }));

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          motivation: 'replying',
          parentReviewUri: parentReview.uri,
        })
      );
    });

    it('shows Reply button text', () => {
      const parentReview = createMockReview();
      render(<ReviewForm {...defaultProps} parentReview={parentReview} />);

      expect(screen.getByRole('button', { name: /reply/i })).toBeInTheDocument();
    });
  });

  describe('annotation mode', () => {
    it('shows annotation label when target provided', () => {
      const target = createMockTextSpanTarget();
      render(<ReviewForm {...defaultProps} target={target} />);

      expect(screen.getByLabelText(/add annotation/i)).toBeInTheDocument();
    });

    it('shows target span preview', () => {
      const target = createMockTextSpanTarget();
      render(<ReviewForm {...defaultProps} target={target} />);

      expect(screen.getByTestId('target-span-preview')).toBeInTheDocument();
    });

    it('allows removing target span', async () => {
      const user = userEvent.setup();
      const target = createMockTextSpanTarget();
      render(<ReviewForm {...defaultProps} target={target} />);

      await user.click(screen.getByRole('button', { name: /remove target/i }));

      expect(screen.queryByTestId('target-span-preview')).not.toBeInTheDocument();
    });
  });

  describe('edit mode', () => {
    it('shows edit label when editingReview provided', () => {
      const editingReview = createMockReview({ content: 'Original content' });
      render(<ReviewForm {...defaultProps} editingReview={editingReview} />);

      expect(screen.getByLabelText(/edit your review/i)).toBeInTheDocument();
    });

    it('pre-fills content from editing review', () => {
      const editingReview = createMockReview({ content: 'Original content' });
      render(<ReviewForm {...defaultProps} editingReview={editingReview} />);

      expect(screen.getByTestId('review-content-input')).toHaveValue('Original content');
    });

    it('shows Save changes button', () => {
      const editingReview = createMockReview();
      render(<ReviewForm {...defaultProps} editingReview={editingReview} />);

      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('shows loading indicator when isLoading', () => {
      render(<ReviewForm {...defaultProps} isLoading />);

      expect(screen.getByText(/posting/i)).toBeInTheDocument();
    });

    it('shows Saving indicator when editing and loading', () => {
      const editingReview = createMockReview();
      render(<ReviewForm {...defaultProps} editingReview={editingReview} isLoading />);

      expect(screen.getByText(/saving/i)).toBeInTheDocument();
    });

    it('disables textarea when loading', () => {
      render(<ReviewForm {...defaultProps} isLoading />);

      expect(screen.getByTestId('review-content-input')).toBeDisabled();
    });

    it('disables buttons when loading', () => {
      render(<ReviewForm {...defaultProps} isLoading onCancel={() => {}} />);

      expect(screen.getByRole('button', { name: /posting/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
    });
  });

  describe('error handling', () => {
    it('displays error message', () => {
      render(<ReviewForm {...defaultProps} error="Failed to post review" />);

      expect(screen.getByText('Failed to post review')).toBeInTheDocument();
    });
  });

  describe('cancel action', () => {
    it('calls onCancel when cancel button clicked', async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();
      render(<ReviewForm {...defaultProps} onCancel={onCancel} />);

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });
});

describe('TargetSpanPreview', () => {
  const mockTarget = createMockTextSpanTarget({
    selector: {
      type: 'TextQuoteSelector',
      exact: 'neural network architecture',
    },
    refinedBy: {
      type: 'TextPositionSelector',
      start: 100,
      end: 125,
      pageNumber: 3,
    },
  });

  it('renders target span text', () => {
    render(<TargetSpanPreview target={mockTarget} />);

    expect(screen.getByText(/neural network architecture/)).toBeInTheDocument();
  });

  it('shows page number', () => {
    render(<TargetSpanPreview target={mockTarget} />);

    expect(screen.getByText('Page 3')).toBeInTheDocument();
  });

  it('shows remove button when onRemove provided', () => {
    const onRemove = vi.fn();
    render(<TargetSpanPreview target={mockTarget} onRemove={onRemove} />);

    expect(screen.getByRole('button', { name: /remove target/i })).toBeInTheDocument();
  });

  it('calls onRemove when button clicked', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<TargetSpanPreview target={mockTarget} onRemove={onRemove} />);

    await user.click(screen.getByRole('button', { name: /remove target/i }));

    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});

describe('ParentReviewPreview', () => {
  it('renders parent review content', () => {
    const review = createMockReview({
      content: 'This is the parent review',
      author: createMockReviewAuthor({ displayName: 'Dr. Parent' }),
    });

    render(<ParentReviewPreview review={review} />);

    expect(screen.getByTestId('parent-review-preview')).toBeInTheDocument();
    expect(screen.getByText(/replying to dr\. parent/i)).toBeInTheDocument();
    expect(screen.getByText(/this is the parent review/i)).toBeInTheDocument();
  });

  it('truncates long content', () => {
    const longContent = 'A'.repeat(150);
    const review = createMockReview({ content: longContent });

    render(<ParentReviewPreview review={review} />);

    expect(screen.getByText(/\.\.\.$/)).toBeInTheDocument();
  });
});

describe('InlineReplyForm', () => {
  const parentReview = createMockReview({
    author: createMockReviewAuthor({ displayName: 'Dr. Parent' }),
  });

  const defaultProps = {
    eprintUri: 'at://did:plc:test/pub.chive.eprint.submission/abc123',
    parentReview,
    onSubmit: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders inline form', () => {
    render(<InlineReplyForm {...defaultProps} />);

    expect(screen.getByTestId('inline-reply-form')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/reply to dr\. parent/i)).toBeInTheDocument();
  });

  it('submits reply content', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<InlineReplyForm {...defaultProps} onSubmit={onSubmit} />);

    const input = screen.getByPlaceholderText(/reply to/i);
    await user.type(input, 'Quick reply');
    await user.click(screen.getByRole('button', { name: '' })); // Submit button has no text

    expect(onSubmit).toHaveBeenCalledWith({
      content: 'Quick reply',
      eprintUri: 'at://did:plc:test/pub.chive.eprint.submission/abc123',
      parentReviewUri: parentReview.uri,
      motivation: 'replying',
    });
  });

  it('disables submit when empty', () => {
    render(<InlineReplyForm {...defaultProps} />);

    const buttons = screen.getAllByRole('button');
    const submitButton = buttons[0];
    expect(submitButton).toBeDisabled();
  });

  it('shows cancel button when onCancel provided', () => {
    const onCancel = vi.fn();
    render(<InlineReplyForm {...defaultProps} onCancel={onCancel} />);

    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('calls onCancel when cancel clicked', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<InlineReplyForm {...defaultProps} onCancel={onCancel} />);

    const buttons = screen.getAllByRole('button');
    await user.click(buttons[1]); // Cancel is second button

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
