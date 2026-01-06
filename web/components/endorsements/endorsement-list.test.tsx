import { render, screen } from '@/tests/test-utils';
import userEvent from '@testing-library/user-event';
import {
  EndorsementList,
  EndorsementItem,
  EndorserAvatarStack,
  EndorsementListSkeleton,
} from './endorsement-list';
import { createMockEndorsement } from '@/tests/mock-data';

describe('EndorsementItem', () => {
  const mockEndorsement = createMockEndorsement({
    endorser: {
      did: 'did:plc:endorser1',
      handle: 'endorser.bsky.social',
      displayName: 'Dr. Endorser',
      avatar: 'https://example.com/avatar.jpg',
    },
    contributions: ['methodological', 'analytical', 'empirical'],
    comment: 'Excellent methodology and analysis.',
    createdAt: '2024-06-20T14:00:00Z',
  });

  describe('rendering', () => {
    it('renders endorser information', () => {
      render(<EndorsementItem endorsement={mockEndorsement} />);

      expect(screen.getByTestId('endorsement-item')).toBeInTheDocument();
      expect(screen.getByText('Dr. Endorser')).toBeInTheDocument();
      // Avatar uses link with name for accessibility
      expect(screen.getByRole('link', { name: 'Dr. Endorser' })).toBeInTheDocument();
    });

    it('renders contribution type badges', () => {
      render(<EndorsementItem endorsement={mockEndorsement} />);

      expect(screen.getByText('Methodological')).toBeInTheDocument();
      expect(screen.getByText('Analytical')).toBeInTheDocument();
      expect(screen.getByText('Empirical')).toBeInTheDocument();
    });

    it('limits visible badges by maxBadges prop', () => {
      render(<EndorsementItem endorsement={mockEndorsement} maxBadges={2} />);

      expect(screen.getByText('Methodological')).toBeInTheDocument();
      expect(screen.getByText('Analytical')).toBeInTheDocument();
      expect(screen.queryByText('Empirical')).not.toBeInTheDocument();
      expect(screen.getByText('+1')).toBeInTheDocument();
    });

    it('renders comment when showComment is true', () => {
      render(<EndorsementItem endorsement={mockEndorsement} showComment />);

      expect(screen.getByText('Excellent methodology and analysis.')).toBeInTheDocument();
    });

    it('hides comment when showComment is false', () => {
      render(<EndorsementItem endorsement={mockEndorsement} showComment={false} />);

      expect(screen.queryByText('Excellent methodology and analysis.')).not.toBeInTheDocument();
    });

    it('shows relative date', () => {
      render(<EndorsementItem endorsement={mockEndorsement} />);

      // The date should be rendered as a time element
      expect(screen.getByRole('time')).toHaveAttribute('dateTime', '2024-06-20T14:00:00Z');
    });

    it('uses compact variant styling', () => {
      const { rerender } = render(<EndorsementItem endorsement={mockEndorsement} variant="list" />);
      expect(screen.getByTestId('endorsement-item')).toHaveClass('py-3');

      rerender(<EndorsementItem endorsement={mockEndorsement} variant="compact" />);
      expect(screen.getByTestId('endorsement-item')).toHaveClass('py-2');
    });

    it('links to endorser profile', () => {
      render(<EndorsementItem endorsement={mockEndorsement} />);

      const links = screen.getAllByRole('link');
      expect(links[0]).toHaveAttribute('href', '/authors/did%3Aplc%3Aendorser1');
    });

    it('falls back to handle when displayName is empty', () => {
      const endorsementNoName = createMockEndorsement({
        endorser: {
          did: 'did:plc:test',
          handle: 'user.bsky.social',
          displayName: '',
          avatar: undefined,
        },
      });

      render(<EndorsementItem endorsement={endorsementNoName} />);

      expect(screen.getByText('user.bsky.social')).toBeInTheDocument();
    });

    it('falls back to Anonymous when no name or handle', () => {
      const endorsementAnon = createMockEndorsement({
        endorser: {
          did: 'did:plc:test',
          handle: '',
          displayName: '',
          avatar: undefined,
        },
      });

      render(<EndorsementItem endorsement={endorsementAnon} />);

      expect(screen.getByText('Anonymous')).toBeInTheDocument();
    });
  });
});

describe('EndorserAvatarStack', () => {
  const mockEndorsements = [
    createMockEndorsement({
      uri: 'at://e1',
      endorser: { did: 'did:plc:e1', handle: 'e1.bsky.social', displayName: 'Endorser 1' },
      contributions: ['methodological'],
    }),
    createMockEndorsement({
      uri: 'at://e2',
      endorser: { did: 'did:plc:e2', handle: 'e2.bsky.social', displayName: 'Endorser 2' },
      contributions: ['analytical', 'empirical'],
    }),
    createMockEndorsement({
      uri: 'at://e3',
      endorser: { did: 'did:plc:e3', handle: 'e3.bsky.social', displayName: 'Endorser 3' },
      contributions: ['data'],
    }),
  ];

  it('renders avatar stack', () => {
    render(<EndorserAvatarStack endorsements={mockEndorsements} />);

    expect(screen.getByTestId('endorser-avatar-stack')).toBeInTheDocument();
  });

  it('limits displayed avatars by limit prop', () => {
    render(<EndorserAvatarStack endorsements={mockEndorsements} limit={2} />);

    expect(screen.getByText('+1')).toBeInTheDocument();
  });

  it('applies size classes', () => {
    const { rerender } = render(<EndorserAvatarStack endorsements={mockEndorsements} size="sm" />);
    const stack = screen.getByTestId('endorser-avatar-stack');
    const avatarLinks = stack.querySelectorAll('a');
    expect(avatarLinks[0]).toHaveClass('h-5', 'w-5');

    rerender(<EndorserAvatarStack endorsements={mockEndorsements} size="md" />);
    expect(stack.querySelectorAll('a')[0]).toHaveClass('h-6', 'w-6');

    rerender(<EndorserAvatarStack endorsements={mockEndorsements} size="lg" />);
    expect(stack.querySelectorAll('a')[0]).toHaveClass('h-8', 'w-8');
  });

  it('shows tooltip on hover with endorser info', async () => {
    const user = userEvent.setup();
    render(<EndorserAvatarStack endorsements={mockEndorsements} />);

    const stack = screen.getByTestId('endorser-avatar-stack');
    const firstAvatar = stack.querySelector('a');

    await user.hover(firstAvatar!);

    // Tooltip shows endorser name, may appear multiple times (avatar + tooltip)
    const endorserNames = await screen.findAllByText('Endorser 1');
    expect(endorserNames.length).toBeGreaterThanOrEqual(1);
    // The text "1 contribution type" may appear multiple times due to Radix tooltip behavior
    const contributionTexts = await screen.findAllByText(/1 contribution type$/);
    expect(contributionTexts.length).toBeGreaterThanOrEqual(1);
  });

  it('uses plural form for multiple contribution types', async () => {
    const user = userEvent.setup();
    render(<EndorserAvatarStack endorsements={mockEndorsements} />);

    const stack = screen.getByTestId('endorser-avatar-stack');
    const avatars = stack.querySelectorAll('a');

    await user.hover(avatars[1]!);

    // Tooltip shows endorser name, may appear multiple times
    const endorserNames = await screen.findAllByText('Endorser 2');
    expect(endorserNames.length).toBeGreaterThanOrEqual(1);
    // The text "2 contribution types" may appear multiple times due to Radix tooltip behavior
    const contributionTexts = await screen.findAllByText(/2 contribution types$/);
    expect(contributionTexts.length).toBeGreaterThanOrEqual(1);
  });
});

describe('EndorsementList', () => {
  const mockEndorsements = [
    createMockEndorsement({
      uri: 'at://e1',
      endorser: { did: 'did:plc:e1', handle: 'e1.bsky.social', displayName: 'Endorser 1' },
      contributions: ['methodological'],
    }),
    createMockEndorsement({
      uri: 'at://e2',
      endorser: { did: 'did:plc:e2', handle: 'e2.bsky.social', displayName: 'Endorser 2' },
      contributions: ['analytical'],
    }),
    createMockEndorsement({
      uri: 'at://e3',
      endorser: { did: 'did:plc:e3', handle: 'e3.bsky.social', displayName: 'Endorser 3' },
      contributions: ['empirical', 'methodological'],
    }),
  ];

  describe('rendering', () => {
    it('renders list of endorsements', () => {
      render(<EndorsementList endorsements={mockEndorsements} />);

      expect(screen.getByTestId('endorsement-list')).toBeInTheDocument();
      expect(screen.getAllByTestId('endorsement-item')).toHaveLength(3);
    });

    it('shows empty state when no endorsements', () => {
      render(<EndorsementList endorsements={[]} />);

      expect(screen.getByTestId('endorsement-list-empty')).toBeInTheDocument();
      expect(screen.getByText('No endorsements yet')).toBeInTheDocument();
    });

    it('respects limit prop', () => {
      render(<EndorsementList endorsements={mockEndorsements} limit={2} />);

      expect(screen.getAllByTestId('endorsement-item')).toHaveLength(2);
      expect(screen.getByText('+1 more endorsement')).toBeInTheDocument();
    });

    it('uses plural form for multiple remaining', () => {
      render(<EndorsementList endorsements={mockEndorsements} limit={1} />);

      expect(screen.getByText('+2 more endorsements')).toBeInTheDocument();
    });
  });

  describe('filtering', () => {
    it('filters by contribution type', () => {
      render(<EndorsementList endorsements={mockEndorsements} contributionType="methodological" />);

      // Only endorsements with 'methodological' should be shown
      expect(screen.getAllByTestId('endorsement-item')).toHaveLength(2);
      expect(screen.getByText('Endorser 1')).toBeInTheDocument();
      expect(screen.getByText('Endorser 3')).toBeInTheDocument();
      expect(screen.queryByText('Endorser 2')).not.toBeInTheDocument();
    });

    it('shows empty state when filter matches nothing', () => {
      render(<EndorsementList endorsements={mockEndorsements} contributionType="clinical" />);

      expect(screen.getByTestId('endorsement-list-empty')).toBeInTheDocument();
    });
  });

  describe('variants', () => {
    it('renders compact variant', () => {
      render(<EndorsementList endorsements={mockEndorsements} variant="compact" />);

      expect(screen.getAllByTestId('endorsement-item')[0]).toHaveClass('py-2');
    });

    it('renders avatars-only variant', () => {
      render(<EndorsementList endorsements={mockEndorsements} variant="avatars-only" />);

      expect(screen.getByTestId('endorser-avatar-stack')).toBeInTheDocument();
      expect(screen.queryByTestId('endorsement-list')).not.toBeInTheDocument();
    });
  });

  describe('comments', () => {
    it('shows comments by default', () => {
      const endorsementsWithComments = [
        createMockEndorsement({
          uri: 'at://e1',
          comment: 'Great work!',
        }),
      ];

      render(<EndorsementList endorsements={endorsementsWithComments} />);

      expect(screen.getByText('Great work!')).toBeInTheDocument();
    });

    it('hides comments when showComments is false', () => {
      const endorsementsWithComments = [
        createMockEndorsement({
          uri: 'at://e1',
          comment: 'Great work!',
        }),
      ];

      render(<EndorsementList endorsements={endorsementsWithComments} showComments={false} />);

      expect(screen.queryByText('Great work!')).not.toBeInTheDocument();
    });
  });
});

describe('EndorsementListSkeleton', () => {
  it('renders skeleton items', () => {
    render(<EndorsementListSkeleton count={3} />);

    expect(screen.getByTestId('endorsement-list-skeleton')).toBeInTheDocument();
    expect(screen.getByTestId('endorsement-list-skeleton').children).toHaveLength(3);
  });

  it('renders default count of 3', () => {
    render(<EndorsementListSkeleton />);

    expect(screen.getByTestId('endorsement-list-skeleton').children).toHaveLength(3);
  });

  it('applies compact variant styling', () => {
    render(<EndorsementListSkeleton variant="compact" />);

    const firstItem = screen.getByTestId('endorsement-list-skeleton').firstChild as HTMLElement;
    expect(firstItem).toHaveClass('py-2');
  });

  it('has animation class', () => {
    render(<EndorsementListSkeleton />);

    const firstItem = screen.getByTestId('endorsement-list-skeleton').firstChild as HTMLElement;
    expect(firstItem).toHaveClass('animate-pulse');
  });
});
