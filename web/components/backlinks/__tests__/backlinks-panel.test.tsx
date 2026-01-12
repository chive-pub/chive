import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { BacklinksPanel, BacklinksPanelSkeleton } from '../backlinks-panel';

// Mock functions must be hoisted along with vi.mock
const { mockGet } = vi.hoisted(() => ({
  mockGet: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  api: {
    GET: mockGet,
  },
}));

// Test wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const mockCounts = {
  sembleCollections: 2,
  blueskyPosts: 3,
  blueskyEmbeds: 0,
  whitewindBlogs: 1,
  leafletLists: 0,
  other: 0,
  total: 6,
};

const _mockBacklinks = [
  {
    id: 1,
    sourceUri: 'at://did:plc:abc123/semble.collection/xyz',
    sourceType: 'semble.collection' as const,
    targetUri: 'at://did:plc:user1/pub.chive.eprint/paper1',
    context: 'Added to ML Papers collection',
    indexedAt: '2024-01-15T10:30:00Z',
    deleted: false,
  },
  {
    id: 2,
    sourceUri: 'at://did:plc:def456/semble.collection/abc',
    sourceType: 'semble.collection' as const,
    targetUri: 'at://did:plc:user1/pub.chive.eprint/paper1',
    context: 'Added to NLP collection',
    indexedAt: '2024-01-16T14:00:00Z',
    deleted: false,
  },
];

describe('BacklinksPanelSkeleton', () => {
  it('should render skeleton loader', () => {
    render(<BacklinksPanelSkeleton />);

    expect(screen.getByText('Backlinks')).toBeInTheDocument();
    // Should have skeleton elements
    const skeletons = document.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should apply custom className', () => {
    const { container } = render(<BacklinksPanelSkeleton className="custom-class" />);

    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });
});

describe('BacklinksPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReset();
  });

  it('should render loading state initially', () => {
    mockGet.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<BacklinksPanel eprintUri="at://did:plc:user1/pub.chive.eprint/paper1" />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText('Backlinks')).toBeInTheDocument();
  });

  it('should render nothing when no backlinks', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        sembleCollections: 0,
        blueskyPosts: 0,
        blueskyEmbeds: 0,
        whitewindBlogs: 0,
        leafletLists: 0,
        other: 0,
        total: 0,
      },
      error: undefined,
    });

    const { container } = render(
      <BacklinksPanel eprintUri="at://did:plc:user1/pub.chive.eprint/paper1" />,
      { wrapper: createWrapper() }
    );

    // Wait for the query to complete
    await vi.waitFor(() => {
      expect(mockGet).toHaveBeenCalled();
    });

    // Should render nothing when total is 0
    await vi.waitFor(() => {
      expect(container.querySelector('[class*="card"]')).not.toBeInTheDocument();
    });
  });

  it('should render backlinks panel with counts', async () => {
    mockGet.mockResolvedValueOnce({
      data: mockCounts,
      error: undefined,
    });

    render(<BacklinksPanel eprintUri="at://did:plc:user1/pub.chive.eprint/paper1" />, {
      wrapper: createWrapper(),
    });

    await vi.waitFor(() => {
      expect(screen.getByText('6')).toBeInTheDocument(); // Total count badge
    });

    // Should show source type sections
    expect(screen.getByText('Semble Collections')).toBeInTheDocument();
    expect(screen.getByText('Bluesky Posts')).toBeInTheDocument();
    expect(screen.getByText('WhiteWind Blogs')).toBeInTheDocument();
  });

  it('should expand section and load backlinks on click', async () => {
    const user = userEvent.setup();

    // First call returns counts
    mockGet.mockResolvedValueOnce({
      data: mockCounts,
      error: undefined,
    });

    render(<BacklinksPanel eprintUri="at://did:plc:user1/pub.chive.eprint/paper1" />, {
      wrapper: createWrapper(),
    });

    await vi.waitFor(() => {
      expect(screen.getByText('Semble Collections')).toBeInTheDocument();
    });

    // First section is expanded by default, let's check for Bluesky which is not
    // Click to expand Bluesky Posts section
    mockGet.mockResolvedValueOnce({
      data: {
        backlinks: [
          {
            id: 3,
            sourceUri: 'at://did:plc:xyz/app.bsky.feed.post/123',
            sourceType: 'bluesky.post',
            targetUri: 'at://did:plc:user1/pub.chive.eprint/paper1',
            context: 'Great paper!',
            indexedAt: '2024-01-17T09:00:00Z',
            deleted: false,
          },
        ],
        hasMore: false,
      },
      error: undefined,
    });

    const blueskyButton = screen.getByText('Bluesky Posts');
    await user.click(blueskyButton);

    await vi.waitFor(() => {
      expect(screen.getByText('Great paper!')).toBeInTheDocument();
    });
  });
});
