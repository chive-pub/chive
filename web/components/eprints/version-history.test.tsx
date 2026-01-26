import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { ChangelogView } from '@/lib/api/generated/types/pub/chive/eprint/listChangelogs';
import { APIError } from '@/lib/errors';

import { VersionHistory, VersionHistorySkeleton, VersionHistoryEmpty } from './version-history';

// Mock the useEprintChangelogs hook
vi.mock('@/lib/hooks/use-eprint-mutations', async () => {
  const actual = await vi.importActual('@/lib/hooks/use-eprint-mutations');
  return {
    ...actual,
    useEprintChangelogs: vi.fn(),
  };
});

import { useEprintChangelogs } from '@/lib/hooks/use-eprint-mutations';

const mockUseEprintChangelogs = vi.mocked(useEprintChangelogs);

/**
 * Response shape from useEprintChangelogs hook.
 */
interface EprintChangelogsResponse {
  changelogs: ChangelogView[];
  cursor?: string;
  hasMore: boolean;
}

/**
 * Common base fields for all query result states.
 */
const baseQueryFields = {
  fetchStatus: 'idle' as const,
  isFetching: false,
  isRefetching: false,
  isLoadingError: false,
  isRefetchError: false,
  isPaused: false,
  isPlaceholderData: false,
  isStale: false,
  isFetched: true,
  isFetchedAfterMount: true,
  isInitialLoading: false,
  isEnabled: true,
  dataUpdatedAt: Date.now(),
  errorUpdatedAt: 0,
  failureCount: 0,
  failureReason: null,
  errorUpdateCount: 0,
  refetch: vi.fn(),
};

/**
 * Creates a loading state mock for useEprintChangelogs.
 */
function createLoadingMock(): ReturnType<typeof useEprintChangelogs> {
  return {
    ...baseQueryFields,
    data: undefined,
    isLoading: true,
    error: null,
    isError: false,
    isPending: true,
    isSuccess: false,
    status: 'pending',
    isFetched: false,
    isFetchedAfterMount: false,
    isInitialLoading: true,
    promise: Promise.resolve({ changelogs: [], hasMore: false }),
  } as ReturnType<typeof useEprintChangelogs>;
}

/**
 * Creates an error state mock for useEprintChangelogs.
 */
function createErrorMock(error: APIError): ReturnType<typeof useEprintChangelogs> {
  // Create a rejected promise that is already caught to avoid unhandled rejection warnings
  const rejectedPromise = Promise.reject(error);
  rejectedPromise.catch(() => {
    // Intentionally empty: prevent unhandled rejection warning in tests
  });

  return {
    ...baseQueryFields,
    data: undefined,
    isLoading: false,
    error,
    isError: true,
    isPending: false,
    isSuccess: false,
    status: 'error',
    promise: rejectedPromise,
  } as ReturnType<typeof useEprintChangelogs>;
}

/**
 * Creates a success state mock for useEprintChangelogs.
 */
function createSuccessMock(data: EprintChangelogsResponse): ReturnType<typeof useEprintChangelogs> {
  return {
    ...baseQueryFields,
    data,
    isLoading: false,
    error: null,
    isError: false,
    isPending: false,
    isSuccess: true,
    status: 'success',
    promise: Promise.resolve(data),
  } as ReturnType<typeof useEprintChangelogs>;
}

/**
 * Creates a mock changelog entry for testing.
 */
function createMockChangelog(overrides?: Partial<ChangelogView>): ChangelogView {
  return {
    uri: 'at://did:plc:test/pub.chive.eprint.changelog/123',
    cid: 'bafyreiabc123',
    eprintUri: 'at://did:plc:test/pub.chive.eprint.submission/456',
    version: { major: 1, minor: 2, patch: 0 },
    sections: [],
    createdAt: '2024-01-15T10:30:00Z',
    ...overrides,
  };
}

/**
 * Wrapper component providing QueryClient for tests.
 */
function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('VersionHistory', () => {
  const testUri = 'at://did:plc:test/pub.chive.eprint.submission/456';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('renders loading skeleton when data is loading', () => {
      mockUseEprintChangelogs.mockReturnValue(createLoadingMock());

      render(
        <TestWrapper>
          <VersionHistory eprintUri={testUri} />
        </TestWrapper>
      );

      expect(screen.getByTestId('version-history-skeleton')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('renders empty state when no changelogs exist', () => {
      mockUseEprintChangelogs.mockReturnValue(
        createSuccessMock({ changelogs: [], hasMore: false })
      );

      render(
        <TestWrapper>
          <VersionHistory eprintUri={testUri} />
        </TestWrapper>
      );

      expect(screen.getByTestId('version-history-empty')).toBeInTheDocument();
      expect(screen.getByText('No version history available for this eprint.')).toBeInTheDocument();
    });

    it('renders skeleton when query is pending', () => {
      mockUseEprintChangelogs.mockReturnValue(createLoadingMock());

      render(
        <TestWrapper>
          <VersionHistory eprintUri={testUri} />
        </TestWrapper>
      );

      expect(screen.getByTestId('version-history-skeleton')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('renders error alert when fetch fails', () => {
      const mockError = new APIError('Failed to fetch changelogs', 500);
      mockUseEprintChangelogs.mockReturnValue(createErrorMock(mockError));

      render(
        <TestWrapper>
          <VersionHistory eprintUri={testUri} />
        </TestWrapper>
      );

      expect(screen.getByText('Error loading version history')).toBeInTheDocument();
      expect(screen.getByText('Failed to fetch changelogs')).toBeInTheDocument();
    });
  });

  describe('version entries', () => {
    it('renders version entries for each changelog', () => {
      const changelogs: ChangelogView[] = [
        createMockChangelog({
          uri: 'at://did:plc:test/pub.chive.eprint.changelog/3',
          version: { major: 1, minor: 2, patch: 0 },
          createdAt: '2024-01-15T10:30:00Z',
        }),
        createMockChangelog({
          uri: 'at://did:plc:test/pub.chive.eprint.changelog/2',
          version: { major: 1, minor: 1, patch: 0 },
          createdAt: '2024-01-10T10:30:00Z',
        }),
        createMockChangelog({
          uri: 'at://did:plc:test/pub.chive.eprint.changelog/1',
          version: { major: 1, minor: 0, patch: 0 },
          createdAt: '2024-01-05T10:30:00Z',
        }),
      ];

      mockUseEprintChangelogs.mockReturnValue(createSuccessMock({ changelogs, hasMore: false }));

      render(
        <TestWrapper>
          <VersionHistory eprintUri={testUri} />
        </TestWrapper>
      );

      const entries = screen.getAllByTestId('version-entry');
      expect(entries).toHaveLength(3);

      // Check version numbers
      expect(screen.getByText('v1.2.0')).toBeInTheDocument();
      expect(screen.getByText('v1.1.0')).toBeInTheDocument();
      expect(screen.getByText('v1.0.0')).toBeInTheDocument();
    });

    it('shows "Latest" badge on first entry', () => {
      const changelogs: ChangelogView[] = [
        createMockChangelog({
          uri: 'at://did:plc:test/pub.chive.eprint.changelog/2',
          version: { major: 1, minor: 1, patch: 0 },
        }),
        createMockChangelog({
          uri: 'at://did:plc:test/pub.chive.eprint.changelog/1',
          version: { major: 1, minor: 0, patch: 0 },
        }),
      ];

      mockUseEprintChangelogs.mockReturnValue(createSuccessMock({ changelogs, hasMore: false }));

      render(
        <TestWrapper>
          <VersionHistory eprintUri={testUri} />
        </TestWrapper>
      );

      const badges = screen.getAllByText('Latest');
      expect(badges).toHaveLength(1);

      // Should be on the first entry
      const firstEntry = screen.getAllByTestId('version-entry')[0];
      expect(within(firstEntry).getByText('Latest')).toBeInTheDocument();
    });

    it('displays formatted date for each version', () => {
      const changelogs: ChangelogView[] = [
        createMockChangelog({
          version: { major: 1, minor: 0, patch: 0 },
          createdAt: '2024-01-15T10:30:00Z',
        }),
      ];

      mockUseEprintChangelogs.mockReturnValue(createSuccessMock({ changelogs, hasMore: false }));

      render(
        <TestWrapper>
          <VersionHistory eprintUri={testUri} />
        </TestWrapper>
      );

      // formatDate returns "Jan 15, 2024" format
      expect(screen.getByTestId('version-date')).toHaveTextContent('Jan 15, 2024');
    });
  });

  describe('expanding details', () => {
    it('shows summary when expanded', async () => {
      const user = userEvent.setup();
      const changelogs: ChangelogView[] = [
        createMockChangelog({
          version: { major: 1, minor: 0, patch: 0 },
          summary: 'Fixed critical bug in methodology section',
        }),
      ];

      mockUseEprintChangelogs.mockReturnValue(createSuccessMock({ changelogs, hasMore: false }));

      render(
        <TestWrapper>
          <VersionHistory eprintUri={testUri} />
        </TestWrapper>
      );

      // Click to expand
      const trigger = screen.getByText('v1.0.0');
      await user.click(trigger);

      expect(screen.getByTestId('version-summary')).toHaveTextContent(
        'Fixed critical bug in methodology section'
      );
    });

    it('shows changelog sections when expanded', async () => {
      const user = userEvent.setup();
      const changelogs: ChangelogView[] = [
        createMockChangelog({
          version: { major: 1, minor: 0, patch: 0 },
          sections: [
            {
              category: 'methodology',
              items: [
                { description: 'Updated sampling method' },
                { description: 'Added control group' },
              ],
            },
            {
              category: 'results',
              items: [
                { description: 'Revised Table 3', changeType: 'changed', location: 'Table 3' },
              ],
            },
          ],
        }),
      ];

      mockUseEprintChangelogs.mockReturnValue(createSuccessMock({ changelogs, hasMore: false }));

      render(
        <TestWrapper>
          <VersionHistory eprintUri={testUri} />
        </TestWrapper>
      );

      // Click to expand
      const trigger = screen.getByText('v1.0.0');
      await user.click(trigger);

      // Check sections
      expect(screen.getByText('Methodology')).toBeInTheDocument();
      expect(screen.getByText('Results')).toBeInTheDocument();

      // Check items
      expect(screen.getByText('Updated sampling method')).toBeInTheDocument();
      expect(screen.getByText('Added control group')).toBeInTheDocument();
      expect(screen.getByText('Revised Table 3')).toBeInTheDocument();

      // Check change type badge
      expect(screen.getByText('Changed')).toBeInTheDocument();

      // Check location
      expect(screen.getByText('(Table 3)')).toBeInTheDocument();
    });

    it('shows reviewer response when present', async () => {
      const user = userEvent.setup();
      const changelogs: ChangelogView[] = [
        createMockChangelog({
          version: { major: 1, minor: 0, patch: 0 },
          reviewerResponse: 'We thank the reviewer for their insightful comments.',
        }),
      ];

      mockUseEprintChangelogs.mockReturnValue(createSuccessMock({ changelogs, hasMore: false }));

      render(
        <TestWrapper>
          <VersionHistory eprintUri={testUri} />
        </TestWrapper>
      );

      // Click to expand
      const trigger = screen.getByText('v1.0.0');
      await user.click(trigger);

      expect(screen.getByText('Response to Peer Review')).toBeInTheDocument();
      expect(
        screen.getByText('We thank the reviewer for their insightful comments.')
      ).toBeInTheDocument();
    });

    it('shows previous version when present', async () => {
      const user = userEvent.setup();
      const changelogs: ChangelogView[] = [
        createMockChangelog({
          version: { major: 1, minor: 1, patch: 0 },
          previousVersion: { major: 1, minor: 0, patch: 0 },
        }),
      ];

      mockUseEprintChangelogs.mockReturnValue(createSuccessMock({ changelogs, hasMore: false }));

      render(
        <TestWrapper>
          <VersionHistory eprintUri={testUri} />
        </TestWrapper>
      );

      // Click to expand
      const trigger = screen.getByText('v1.1.0');
      await user.click(trigger);

      expect(screen.getByText('Updated from v1.0.0')).toBeInTheDocument();
    });

    it('shows review reference in items', async () => {
      const user = userEvent.setup();
      const changelogs: ChangelogView[] = [
        createMockChangelog({
          version: { major: 1, minor: 0, patch: 0 },
          sections: [
            {
              category: 'methodology',
              items: [
                {
                  description: 'Addressed reviewer concern about sample size',
                  reviewReference: 'Reviewer 1, Comment 2',
                },
              ],
            },
          ],
        }),
      ];

      mockUseEprintChangelogs.mockReturnValue(createSuccessMock({ changelogs, hasMore: false }));

      render(
        <TestWrapper>
          <VersionHistory eprintUri={testUri} />
        </TestWrapper>
      );

      // Click to expand
      const trigger = screen.getByText('v1.0.0');
      await user.click(trigger);

      expect(screen.getByText('[Re: Reviewer 1, Comment 2]')).toBeInTheDocument();
    });
  });

  describe('version formatting', () => {
    it('formats version with prerelease tag', () => {
      const changelogs: ChangelogView[] = [
        createMockChangelog({
          version: { major: 1, minor: 0, patch: 0, prerelease: 'draft' },
        }),
      ];

      mockUseEprintChangelogs.mockReturnValue(createSuccessMock({ changelogs, hasMore: false }));

      render(
        <TestWrapper>
          <VersionHistory eprintUri={testUri} />
        </TestWrapper>
      );

      expect(screen.getByText('v1.0.0-draft')).toBeInTheDocument();
    });
  });
});

describe('VersionHistorySkeleton', () => {
  it('renders skeleton elements', () => {
    render(<VersionHistorySkeleton />);

    expect(screen.getByTestId('version-history-skeleton')).toBeInTheDocument();
  });

  it('accepts className prop', () => {
    render(<VersionHistorySkeleton className="custom-class" />);

    const skeleton = screen.getByTestId('version-history-skeleton');
    expect(skeleton).toHaveClass('custom-class');
  });
});

describe('VersionHistoryEmpty', () => {
  it('renders empty state message', () => {
    render(<VersionHistoryEmpty />);

    expect(screen.getByTestId('version-history-empty')).toBeInTheDocument();
    expect(screen.getByText('No version history available for this eprint.')).toBeInTheDocument();
  });

  it('accepts className prop', () => {
    render(<VersionHistoryEmpty className="custom-class" />);

    const empty = screen.getByTestId('version-history-empty');
    expect(empty).toHaveClass('custom-class');
  });
});
