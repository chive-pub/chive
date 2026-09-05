/**
 * Tests for the atmosphere panel.
 *
 * @remarks
 * The panel replaced a stack of collapsed accordions whose section headings
 * came from a counts endpoint that buckets five ways -- so talks, standard.site
 * documents and Margin annotations all sat behind one heading called "Other
 * Sources". The behaviours pinned here are the ones that fixes: the references
 * are visible without a click, and the filters name the applications that
 * actually published them.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { BacklinksPanel, BacklinksPanelSkeleton } from '../backlinks-panel';

const { mockList, mockGetCounts } = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockGetCounts: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  api: {
    pub: { chive: { backlink: { list: mockList, getCounts: mockGetCounts } } },
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const DID = 'did:plc:34mbm5v3umztwvvgnttvcz6e';
const EPRINT = 'at://did:plc:user1/pub.chive.eprint.submission/paper1';

function row(id: number, collection: string, sourceType: string, context?: string) {
  return {
    id,
    sourceUri: `at://${DID}/${collection}/rk${id}`,
    sourceType,
    targetUri: EPRINT,
    ...(context ? { context } : {}),
    indexedAt: '2026-09-04T12:00:00Z',
    deleted: false,
  };
}

const BACKLINKS = [
  row(1, 'pub.leaflet.document', 'leaflet.document', 'Probe essay'),
  row(2, 'pub.leaflet.comment', 'leaflet.document', 'Probe comment'),
  row(3, 'community.lexicon.calendar.event', 'calendar.event', 'Probe talk'),
  row(4, 'at.margin.note', 'margin.annotation', 'Probe annotation'),
];

function counts(total: number) {
  return {
    data: {
      cosmikCollections: 0,
      blueskyPosts: 0,
      blueskyEmbeds: 0,
      leafletLists: 0,
      other: total,
      total,
    },
  };
}

describe('BacklinksPanelSkeleton', () => {
  it('renders a placeholder', () => {
    render(<BacklinksPanelSkeleton />);
    expect(screen.getByText('Backlinks')).toBeInTheDocument();
    expect(document.querySelectorAll('[class*="animate-pulse"]').length).toBeGreaterThan(0);
  });

  it('applies a custom class', () => {
    const { container } = render(<BacklinksPanelSkeleton className="custom-class" />);
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });
});

describe('BacklinksPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockReset();
    mockGetCounts.mockReset();
  });

  it('renders every reference without waiting for a click', async () => {
    mockGetCounts.mockResolvedValue(counts(4));
    mockList.mockResolvedValue({ data: { backlinks: BACKLINKS, hasMore: false } });

    render(<BacklinksPanel eprintUri={EPRINT} />, { wrapper: createWrapper() });

    // Previously each of these sat behind its own collapsed section, and three
    // of the four behind one headed "Other Sources".
    expect(await screen.findByText('Probe essay')).toBeInTheDocument();
    expect(screen.getByText('Probe comment')).toBeInTheDocument();
    expect(screen.getByText('Probe talk')).toBeInTheDocument();
    expect(screen.getByText('Probe annotation')).toBeInTheDocument();
    expect(screen.getByTestId('backlinks-count')).toHaveTextContent('4');
  });

  it('filters by the application that published the record', async () => {
    const user = userEvent.setup();
    mockGetCounts.mockResolvedValue(counts(4));
    mockList.mockResolvedValue({ data: { backlinks: BACKLINKS, hasMore: false } });

    render(<BacklinksPanel eprintUri={EPRINT} />, { wrapper: createWrapper() });
    await screen.findByText('Probe essay');

    // Both Leaflet records group under one chip even though one of them is a
    // comment, because the reader is choosing an application, not a record type.
    await user.click(screen.getByRole('button', { name: 'Leaflet 2' }));

    expect(screen.getByText('Probe essay')).toBeInTheDocument();
    expect(screen.getByText('Probe comment')).toBeInTheDocument();
    expect(screen.queryByText('Probe talk')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'All 4' }));
    expect(screen.getByText('Probe talk')).toBeInTheDocument();
  });

  it('offers no filters when everything came from one application', async () => {
    mockGetCounts.mockResolvedValue(counts(1));
    mockList.mockResolvedValue({ data: { backlinks: [BACKLINKS[0]], hasMore: false } });

    render(<BacklinksPanel eprintUri={EPRINT} />, { wrapper: createWrapper() });
    await screen.findByText('Probe essay');

    expect(screen.queryByRole('group', { name: /filter by application/i })).toBeNull();
  });

  it('renders nothing when there are no references and it was not asked to speak up', async () => {
    mockGetCounts.mockResolvedValue(counts(0));
    mockList.mockResolvedValue({ data: { backlinks: [], hasMore: false } });

    const { container } = render(<BacklinksPanel eprintUri={EPRINT} />, {
      wrapper: createWrapper(),
    });

    await vi.waitFor(() => {
      expect(mockGetCounts).toHaveBeenCalled();
    });
    await vi.waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  it('says so when there are no references and it has a tab to itself', async () => {
    mockGetCounts.mockResolvedValue(counts(0));
    mockList.mockResolvedValue({ data: { backlinks: [], hasMore: false } });

    render(<BacklinksPanel eprintUri={EPRINT} showEmpty />, { wrapper: createWrapper() });

    // A blank tab cannot be told from one that failed to load.
    expect(
      await screen.findByText(/nothing on the network refers to this paper yet/i)
    ).toBeInTheDocument();
  });

  it('loads the next page on request', async () => {
    const user = userEvent.setup();
    mockGetCounts.mockResolvedValue(counts(5));
    mockList
      .mockResolvedValueOnce({ data: { backlinks: BACKLINKS, cursor: 'c1', hasMore: true } })
      .mockResolvedValueOnce({
        data: {
          backlinks: [row(5, 'network.cosmik.card', 'cosmik.collection', 'Probe card')],
          hasMore: false,
        },
      });

    render(<BacklinksPanel eprintUri={EPRINT} />, { wrapper: createWrapper() });
    await screen.findByText('Probe essay');

    await user.click(screen.getByRole('button', { name: /load more/i }));

    expect(await screen.findByText('Probe card')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cosmik 1' })).toBeInTheDocument();
  });
});
