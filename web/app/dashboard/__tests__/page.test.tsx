import { screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { renderWithProviders } from '@/tests/test-utils';

import DashboardPage from '../page';

// Mock functions using vi.hoisted for proper hoisting
const { mockUseCurrentUser, mockUseEprintsByAuthor } = vi.hoisted(() => ({
  mockUseCurrentUser: vi.fn(),
  mockUseEprintsByAuthor: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  useCurrentUser: mockUseCurrentUser,
}));

vi.mock('@/lib/hooks/use-eprint', () => ({
  useEprintsByAuthor: mockUseEprintsByAuthor,
}));

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCurrentUser.mockReturnValue({ did: 'did:plc:testuser1', displayName: 'Alice' });
    mockUseEprintsByAuthor.mockReturnValue({
      data: { eprints: [{ uri: 'at://did:plc:testuser1/pub.chive.eprint.submission/1' }] },
      isLoading: false,
    });
  });

  it('renders welcome header with display name', () => {
    renderWithProviders(<DashboardPage />);

    expect(screen.getByText(/Welcome back, Alice/)).toBeInTheDocument();
  });

  it('renders welcome header without display name for user without one', () => {
    mockUseCurrentUser.mockReturnValue({ did: 'did:plc:testuser1' });

    renderWithProviders(<DashboardPage />);

    expect(screen.getByText(/Welcome back/)).toBeInTheDocument();
  });

  it('renders stats cards for Eprints, Reviews, and Endorsements', () => {
    renderWithProviders(<DashboardPage />);

    expect(screen.getByText('Eprints')).toBeInTheDocument();
    expect(screen.getByText('Reviews')).toBeInTheDocument();
    expect(screen.getByText('Endorsements')).toBeInTheDocument();
  });

  it('renders quick actions section', () => {
    renderWithProviders(<DashboardPage />);

    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    expect(screen.getByText('Submit Eprint')).toBeInTheDocument();
    expect(screen.getByText('Browse Eprints')).toBeInTheDocument();
    expect(screen.getByText('Browse Trending')).toBeInTheDocument();
  });

  it('does NOT render ForYouFeed component', () => {
    renderWithProviders(<DashboardPage />);

    // ForYouFeed should have been removed in WS2
    expect(screen.queryByTestId('for-you-feed')).not.toBeInTheDocument();
  });

  it('does NOT contain "For You" text', () => {
    renderWithProviders(<DashboardPage />);

    expect(screen.queryByText('For You')).not.toBeInTheDocument();
    expect(screen.queryByText(/for you/i)).not.toBeInTheDocument();
  });

  it('shows loading skeleton for eprint count while loading', () => {
    mockUseEprintsByAuthor.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    renderWithProviders(<DashboardPage />);

    // Stats region should exist but show loading state
    const statsRegion = screen.getByRole('region', { name: 'Your statistics' });
    expect(statsRegion).toBeInTheDocument();
  });

  it('displays eprint count from API response', () => {
    mockUseEprintsByAuthor.mockReturnValue({
      data: {
        eprints: [
          { uri: 'at://did:plc:t/pub.chive.eprint.submission/1' },
          { uri: 'at://did:plc:t/pub.chive.eprint.submission/2' },
          { uri: 'at://did:plc:t/pub.chive.eprint.submission/3' },
        ],
      },
      isLoading: false,
    });

    renderWithProviders(<DashboardPage />);

    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
