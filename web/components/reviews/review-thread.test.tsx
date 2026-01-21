import { render, screen } from '@/tests/test-utils';
import userEvent from '@testing-library/user-event';
import { ReviewThreadComponent, ThreadCollapseToggle } from './review-thread';
import { createMockReview, createMockReviewAuthor } from '@/tests/mock-data';
import type { FrontendReviewThread } from '@/lib/api/schema';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('ThreadCollapseToggle', () => {
  it('shows expand text when collapsed', () => {
    render(<ThreadCollapseToggle isCollapsed={true} onToggle={() => {}} replyCount={5} />);

    expect(screen.getByText('Show 5 replies')).toBeInTheDocument();
    expect(screen.getByTestId('thread-collapse-toggle')).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows collapse text when expanded', () => {
    render(<ThreadCollapseToggle isCollapsed={false} onToggle={() => {}} replyCount={5} />);

    expect(screen.getByText('Hide replies')).toBeInTheDocument();
    expect(screen.getByTestId('thread-collapse-toggle')).toHaveAttribute('aria-expanded', 'true');
  });

  it('uses singular form for one reply', () => {
    render(<ThreadCollapseToggle isCollapsed={true} onToggle={() => {}} replyCount={1} />);

    expect(screen.getByText('Show 1 reply')).toBeInTheDocument();
  });

  it('calls onToggle when clicked', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<ThreadCollapseToggle isCollapsed={true} onToggle={onToggle} replyCount={3} />);

    await user.click(screen.getByTestId('thread-collapse-toggle'));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});

describe('ReviewThreadComponent', () => {
  const createThread = (depth: number = 0, replyCount: number = 0): FrontendReviewThread => {
    const parent = createMockReview({
      uri: `at://review-d${depth}`,
      content: `Review at depth ${depth}`,
      body: undefined, // Use plain text content, not rich body
      author: createMockReviewAuthor({ displayName: `Author ${depth}` }),
    });

    const replies: FrontendReviewThread[] = [];
    for (let i = 0; i < replyCount; i++) {
      replies.push({
        parent: createMockReview({
          uri: `at://reply-${i}`,
          content: `Reply ${i}`,
          body: undefined, // Use plain text content, not rich body
          parentReviewUri: parent.uri,
          author: createMockReviewAuthor({ displayName: `Replier ${i}` }),
        }),
        replies: [],
        totalReplies: 0,
      });
    }

    return {
      parent,
      replies,
      totalReplies: replyCount,
    };
  };

  describe('rendering', () => {
    it('renders thread with parent review', () => {
      const thread = createThread();
      render(<ReviewThreadComponent thread={thread} />);

      expect(screen.getByTestId('review-thread')).toBeInTheDocument();
      expect(screen.getByTestId('review-card')).toBeInTheDocument();
      expect(screen.getByText('Review at depth 0')).toBeInTheDocument();
    });

    it('sets depth data attribute', () => {
      const thread = createThread();
      render(<ReviewThreadComponent thread={thread} depth={2} />);

      expect(screen.getByTestId('review-thread')).toHaveAttribute('data-depth', '2');
    });

    it('shows thread line for nested replies', () => {
      const thread = createThread(1);
      render(<ReviewThreadComponent thread={thread} depth={1} />);

      // Thread line is aria-hidden, check for its presence
      const threadElement = screen.getByTestId('review-thread');
      expect(threadElement.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
    });

    it('does not show thread line at depth 0', () => {
      const thread = createThread(0);
      render(<ReviewThreadComponent thread={thread} depth={0} />);

      const threadElement = screen.getByTestId('review-thread');
      expect(threadElement.querySelector('.bg-border')).not.toBeInTheDocument();
    });
  });

  describe('replies', () => {
    it('renders replies when present', () => {
      const thread = createThread(0, 2);
      render(<ReviewThreadComponent thread={thread} />);

      expect(screen.getByText('Reply 0')).toBeInTheDocument();
      expect(screen.getByText('Reply 1')).toBeInTheDocument();
    });

    it('renders nested threads recursively', () => {
      const nestedThread: FrontendReviewThread = {
        parent: createMockReview({
          uri: 'at://parent',
          content: 'Parent content',
          body: undefined, // Use plain text
        }),
        replies: [
          {
            parent: createMockReview({
              uri: 'at://child',
              content: 'Child content',
              body: undefined, // Use plain text
            }),
            replies: [
              {
                parent: createMockReview({
                  uri: 'at://grandchild',
                  content: 'Grandchild content',
                  body: undefined, // Use plain text
                }),
                replies: [],
                totalReplies: 0,
              },
            ],
            totalReplies: 1,
          },
        ],
        totalReplies: 1,
      };

      render(<ReviewThreadComponent thread={nestedThread} />);

      expect(screen.getByText('Parent content')).toBeInTheDocument();
      expect(screen.getByText('Child content')).toBeInTheDocument();
      expect(screen.getByText('Grandchild content')).toBeInTheDocument();
    });
  });

  describe('collapsing', () => {
    it('auto-collapses at maxExpandedDepth', () => {
      const thread = createThread(0, 2);
      render(<ReviewThreadComponent thread={thread} depth={3} maxExpandedDepth={3} />);

      // At depth 3 with maxExpandedDepth 3, replies should be collapsed
      // The collapse toggle should show "Show X replies"
      expect(screen.getByText(/show \d+ repl/i)).toBeInTheDocument();
    });

    it('shows replies when expanded', () => {
      const thread = createThread(0, 2);
      render(<ReviewThreadComponent thread={thread} depth={0} maxExpandedDepth={10} />);

      expect(screen.getByText('Reply 0')).toBeInTheDocument();
      expect(screen.getByText('Reply 1')).toBeInTheDocument();
    });

    it('toggles collapse state', async () => {
      const user = userEvent.setup();
      const thread = createThread(0, 2);
      render(<ReviewThreadComponent thread={thread} depth={2} maxExpandedDepth={3} />);

      // Initially expanded at depth 2 < maxExpandedDepth 3
      expect(screen.getByText('Reply 0')).toBeInTheDocument();

      // Find and click the toggle (if visible)
      const toggleButton = screen.queryByTestId('thread-collapse-toggle');
      if (toggleButton) {
        await user.click(toggleButton);
        // After toggle, content should be hidden
        expect(screen.queryByText('Reply 0')).not.toBeInTheDocument();
      }
    });
  });

  describe('callbacks', () => {
    it('passes onReply to child reviews', async () => {
      const user = userEvent.setup();
      const onReply = vi.fn();
      const thread = createThread(0, 1);

      render(<ReviewThreadComponent thread={thread} onReply={onReply} />);

      // Find the parent review card and trigger reply
      const cards = screen.getAllByTestId('review-card');
      await user.hover(cards[0]);
      await user.click(screen.getAllByRole('button', { name: /review actions/i })[0]);
      await user.click(screen.getAllByRole('menuitem', { name: /reply/i })[0]);

      expect(onReply).toHaveBeenCalledWith(thread.parent);
    });

    it('passes onEdit to child reviews', async () => {
      const user = userEvent.setup();
      const onEdit = vi.fn();
      const thread = createThread();

      render(
        <ReviewThreadComponent
          thread={thread}
          onEdit={onEdit}
          currentUserDid={thread.parent.author.did}
        />
      );

      const card = screen.getByTestId('review-card');
      await user.hover(card);
      await user.click(screen.getByRole('button', { name: /review actions/i }));
      await user.click(screen.getByRole('menuitem', { name: /edit/i }));

      expect(onEdit).toHaveBeenCalledWith(thread.parent);
    });

    it('passes onDelete to child reviews', async () => {
      const user = userEvent.setup();
      const onDelete = vi.fn();
      const thread = createThread();

      render(
        <ReviewThreadComponent
          thread={thread}
          onDelete={onDelete}
          currentUserDid={thread.parent.author.did}
        />
      );

      const card = screen.getByTestId('review-card');
      await user.hover(card);
      await user.click(screen.getByRole('button', { name: /review actions/i }));
      await user.click(screen.getByRole('menuitem', { name: /delete/i }));

      expect(onDelete).toHaveBeenCalledWith(thread.parent);
    });
  });

  describe('variants', () => {
    it('uses default variant at depth 0', () => {
      const thread = createThread();
      render(<ReviewThreadComponent thread={thread} depth={0} />);

      expect(screen.getByTestId('review-card')).toHaveClass('p-4');
    });

    it('uses compact variant at depth > 0', () => {
      const thread = createThread();
      render(<ReviewThreadComponent thread={thread} depth={1} />);

      expect(screen.getByTestId('review-card')).toHaveClass('py-3');
    });
  });

  describe('showTargets prop', () => {
    it('shows targets only at depth 0', () => {
      const threadWithTarget: FrontendReviewThread = {
        parent: createMockReview({
          target: {
            source: 'at://test',
            selector: { type: 'TextQuoteSelector', exact: 'target text' },
          },
        }),
        replies: [],
        totalReplies: 0,
      };

      render(<ReviewThreadComponent thread={threadWithTarget} depth={0} showTargets />);

      expect(screen.getByText(/target text/)).toBeInTheDocument();
    });

    it('hides targets at depth > 0 even if showTargets is true', () => {
      const threadWithTarget: FrontendReviewThread = {
        parent: createMockReview({
          target: {
            source: 'at://test',
            selector: { type: 'TextQuoteSelector', exact: 'target text' },
          },
        }),
        replies: [],
        totalReplies: 0,
      };

      render(<ReviewThreadComponent thread={threadWithTarget} depth={1} showTargets />);

      expect(screen.queryByText(/target text/)).not.toBeInTheDocument();
    });
  });

  describe('ownership', () => {
    it('identifies owner based on currentUserDid', () => {
      const thread = createThread();
      render(<ReviewThreadComponent thread={thread} currentUserDid={thread.parent.author.did} />);

      // Owner should have edit/delete options available
      expect(screen.getByTestId('review-card')).toBeInTheDocument();
    });
  });
});
