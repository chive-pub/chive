/**
 * @vitest-environment jsdom
 */

/**
 * Unit tests for the AdminGuard component.
 *
 * @remarks
 * Tests three states: loading skeleton, admin access granted,
 * and non-admin redirect to /dashboard.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import { render, screen } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: mockReplace,
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  usePathname: () => '/admin',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// Default: loading state
const mockUseAuth = vi.fn().mockReturnValue({
  isAuthenticated: false,
  isLoading: true,
  user: null,
});

vi.mock('@/lib/auth', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: { className?: string }) =>
    createElement('div', { 'data-testid': 'skeleton', className }),
}));

// Import after mocks are set up
import { AdminGuard } from '@/components/auth/admin-guard';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AdminGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
      user: null,
    });
  });

  it('renders loading skeleton while auth is loading', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
      user: null,
    });

    render(
      createElement(AdminGuard, null, createElement('div', { 'data-testid': 'admin-content' }))
    );

    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('admin-content')).toBeNull();
  });

  it('renders loading skeleton when user.isAdmin is undefined', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { did: 'did:plc:test', handle: 'test.bsky.social', pdsEndpoint: 'https://bsky.social' },
    });

    render(
      createElement(AdminGuard, null, createElement('div', { 'data-testid': 'admin-content' }))
    );

    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('admin-content')).toBeNull();
  });

  it('renders children when user is admin', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: {
        did: 'did:plc:admin',
        handle: 'admin.bsky.social',
        pdsEndpoint: 'https://bsky.social',
        isAdmin: true,
      },
    });

    render(
      createElement(AdminGuard, null, createElement('div', { 'data-testid': 'admin-content' }))
    );

    expect(screen.getByTestId('admin-content')).toBeTruthy();
    expect(screen.queryByTestId('skeleton')).toBeNull();
  });

  it('redirects to /dashboard when user is not admin', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: {
        did: 'did:plc:regular',
        handle: 'regular.bsky.social',
        pdsEndpoint: 'https://bsky.social',
        isAdmin: false,
      },
    });

    render(
      createElement(AdminGuard, null, createElement('div', { 'data-testid': 'admin-content' }))
    );

    expect(mockReplace).toHaveBeenCalledWith('/dashboard');
    expect(screen.queryByTestId('admin-content')).toBeNull();
  });

  it('does not redirect while still loading', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
      user: null,
    });

    render(
      createElement(AdminGuard, null, createElement('div', { 'data-testid': 'admin-content' }))
    );

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('does not redirect when user is admin', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: {
        did: 'did:plc:admin',
        handle: 'admin.bsky.social',
        pdsEndpoint: 'https://bsky.social',
        isAdmin: true,
      },
    });

    render(
      createElement(AdminGuard, null, createElement('div', { 'data-testid': 'admin-content' }))
    );

    expect(mockReplace).not.toHaveBeenCalled();
  });
});
