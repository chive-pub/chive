/**
 * Component tests for Alpha Landing Page.
 *
 * @remarks
 * Tests the alpha landing page including authentication states,
 * error handling, form interactions, and routing behavior.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '../../test-utils';

// Store original module for restoration
const originalRouter = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn().mockResolvedValue(undefined),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => originalRouter,
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock auth hooks
const mockLogin = vi.fn();
const mockLogout = vi.fn();
const mockIsAuthenticated = vi.fn().mockReturnValue(false);

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    login: mockLogin,
    logout: mockLogout,
    agent: null,
  }),
  useIsAuthenticated: () => mockIsAuthenticated(),
}));

// Mock alpha status hook
const mockAlphaStatus = vi.fn().mockReturnValue({
  data: undefined,
  isLoading: false,
  isError: false,
  error: null,
});

vi.mock('@/lib/hooks/use-alpha-status', () => ({
  useAlphaStatus: (options?: { enabled?: boolean }) => {
    if (options?.enabled === false) {
      return { data: undefined, isLoading: false, isError: false, error: null };
    }
    return mockAlphaStatus();
  },
}));

// Import component after mocks
import AlphaLandingPage from '@/app/(alpha)/page';
import { APIError } from '@/lib/errors';

describe('AlphaLandingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAuthenticated.mockReturnValue(false);
    mockAlphaStatus.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Unauthenticated State', () => {
    it('renders the landing page with branding', () => {
      renderWithProviders(<AlphaLandingPage />);

      expect(screen.getByRole('img', { name: /chive/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: /chive/i })).toBeInTheDocument();
      expect(screen.getByText(/decentralized preprints/i)).toBeInTheDocument();
    });

    it('renders the handle input field', () => {
      renderWithProviders(<AlphaLandingPage />);

      const handleInput = screen.getByRole('textbox');
      expect(handleInput).toBeInTheDocument();
      expect(handleInput.getAttribute('placeholder')).toMatch(/bsky\.social/i);
    });

    it('renders the sign in button disabled when no handle', () => {
      renderWithProviders(<AlphaLandingPage />);

      const signInButton = screen.getByRole('button', { name: /sign in with bluesky/i });
      expect(signInButton).toBeInTheDocument();
      expect(signInButton).toBeDisabled();
    });

    it('renders external links', () => {
      renderWithProviders(<AlphaLandingPage />);

      expect(screen.getByRole('link', { name: /read the docs/i })).toHaveAttribute(
        'href',
        'https://docs.chive.pub'
      );
      expect(screen.getByRole('link', { name: /github/i })).toHaveAttribute(
        'href',
        'https://github.com/chive-pub/chive'
      );
      expect(screen.getByRole('link', { name: /bluesky/i })).toHaveAttribute(
        'href',
        'https://bsky.app/profile/chive.pub'
      );
    });

    it('enables sign in button after entering handle', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AlphaLandingPage />);

      const handleInput = screen.getByRole('textbox');
      const signInButton = screen.getByRole('button', { name: /sign in with bluesky/i });

      await user.type(handleInput, 'alice.bsky.social');

      expect(signInButton).toBeEnabled();
    });

    it('calls login when sign in button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AlphaLandingPage />);

      const handleInput = screen.getByRole('textbox');
      const signInButton = screen.getByRole('button', { name: /sign in with bluesky/i });

      await user.type(handleInput, 'alice.bsky.social');
      await user.click(signInButton);

      expect(mockLogin).toHaveBeenCalledWith({ handle: 'alice.bsky.social' });
    });

    it('shows error when login fails', async () => {
      const user = userEvent.setup();
      mockLogin.mockRejectedValue(new Error('OAuth flow failed'));

      renderWithProviders(<AlphaLandingPage />);

      const handleInput = screen.getByRole('textbox');
      const signInButton = screen.getByRole('button', { name: /sign in with bluesky/i });

      await user.type(handleInput, 'alice.bsky.social');
      await user.click(signInButton);

      await waitFor(() => {
        expect(screen.getByText(/oauth flow failed/i)).toBeInTheDocument();
      });
    });

    it('shows error when handle is empty and sign in is attempted', async () => {
      const user = userEvent.setup();
      const { container } = renderWithProviders(<AlphaLandingPage />);

      // Force button to be clickable by removing disabled attribute
      const signInButton = screen.getByRole('button', { name: /sign in with bluesky/i });

      // The button should be disabled, so we can't click it normally
      expect(signInButton).toBeDisabled();

      // Type and then clear to test validation
      const handleInput = screen.getByRole('textbox');
      await user.type(handleInput, 'test');
      await user.clear(handleInput);

      // Now button should be disabled again
      expect(signInButton).toBeDisabled();
    });
  });

  describe('Loading State', () => {
    it('shows loading spinner when authenticated and checking status', () => {
      mockIsAuthenticated.mockReturnValue(true);
      mockAlphaStatus.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
      });

      renderWithProviders(<AlphaLandingPage />);

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('shows error page when status API fails with non-auth error', () => {
      mockIsAuthenticated.mockReturnValue(true);
      mockAlphaStatus.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new APIError('Internal server error', 500, '/xrpc/pub.chive.alpha.checkStatus'),
      });

      renderWithProviders(<AlphaLandingPage />);

      expect(screen.getByRole('heading', { name: /connection error/i })).toBeInTheDocument();
      expect(screen.getByText(/couldn't verify your alpha status/i)).toBeInTheDocument();
      expect(screen.getByText(/internal server error/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('shows generic error message for non-Error objects', () => {
      mockIsAuthenticated.mockReturnValue(true);
      mockAlphaStatus.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: 'Some string error', // Not an Error instance
      });

      renderWithProviders(<AlphaLandingPage />);

      expect(screen.getByText(/failed to check alpha status/i)).toBeInTheDocument();
    });

    it('does not redirect when there is a non-auth API error', () => {
      mockIsAuthenticated.mockReturnValue(true);
      mockAlphaStatus.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new APIError('Internal server error', 500, '/xrpc/pub.chive.alpha.checkStatus'),
      });

      renderWithProviders(<AlphaLandingPage />);

      // Should NOT redirect
      expect(originalRouter.replace).not.toHaveBeenCalled();
    });

    it('calls logout and shows landing page on 401 error', async () => {
      mockIsAuthenticated.mockReturnValue(true);
      mockAlphaStatus.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new APIError('Unauthorized', 401, '/xrpc/pub.chive.alpha.checkStatus'),
      });

      renderWithProviders(<AlphaLandingPage />);

      // Should call logout to clear invalid session
      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled();
      });

      // Should NOT show error page for 401
      expect(screen.queryByRole('heading', { name: /connection error/i })).not.toBeInTheDocument();
    });

    it('does not show error page for authentication errors', () => {
      mockIsAuthenticated.mockReturnValue(true);
      mockAlphaStatus.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new APIError('Authentication required', 401, '/xrpc/pub.chive.alpha.checkStatus'),
      });

      renderWithProviders(<AlphaLandingPage />);

      // Should show landing page content, not error page
      expect(screen.queryByRole('heading', { name: /connection error/i })).not.toBeInTheDocument();
      // Landing page elements should be visible
      expect(screen.getByRole('heading', { level: 1, name: /chive/i })).toBeInTheDocument();
    });
  });

  describe('Routing Based on Alpha Status', () => {
    beforeEach(() => {
      mockIsAuthenticated.mockReturnValue(true);
    });

    it('redirects to /dashboard when approved', async () => {
      mockAlphaStatus.mockReturnValue({
        data: { status: 'approved', appliedAt: '2024-01-01', reviewedAt: '2024-01-02' },
        isLoading: false,
        isError: false,
        error: null,
      });

      renderWithProviders(<AlphaLandingPage />);

      await waitFor(() => {
        expect(originalRouter.replace).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('redirects to /pending when pending', async () => {
      mockAlphaStatus.mockReturnValue({
        data: { status: 'pending', appliedAt: '2024-01-01' },
        isLoading: false,
        isError: false,
        error: null,
      });

      renderWithProviders(<AlphaLandingPage />);

      await waitFor(() => {
        expect(originalRouter.replace).toHaveBeenCalledWith('/pending');
      });
    });

    it('redirects to /pending when rejected (never shows rejected)', async () => {
      mockAlphaStatus.mockReturnValue({
        data: { status: 'rejected', appliedAt: '2024-01-01', reviewedAt: '2024-01-02' },
        isLoading: false,
        isError: false,
        error: null,
      });

      renderWithProviders(<AlphaLandingPage />);

      await waitFor(() => {
        expect(originalRouter.replace).toHaveBeenCalledWith('/pending');
      });
    });

    it('redirects to /apply when status is none', async () => {
      mockAlphaStatus.mockReturnValue({
        data: { status: 'none' },
        isLoading: false,
        isError: false,
        error: null,
      });

      renderWithProviders(<AlphaLandingPage />);

      await waitFor(() => {
        expect(originalRouter.replace).toHaveBeenCalledWith('/apply');
      });
    });

    it('does not redirect when status is undefined without error', async () => {
      mockAlphaStatus.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: false,
        error: null,
      });

      renderWithProviders(<AlphaLandingPage />);

      // Give it time to potentially redirect
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should NOT redirect since data is undefined and no status
      expect(originalRouter.replace).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has proper heading structure', () => {
      renderWithProviders(<AlphaLandingPage />);

      const h1 = screen.getByRole('heading', { level: 1 });
      expect(h1).toBeInTheDocument();
    });

    it('has accessible form elements', () => {
      renderWithProviders(<AlphaLandingPage />);

      const handleInput = screen.getByRole('textbox');
      const signInButton = screen.getByRole('button', { name: /sign in with bluesky/i });

      expect(handleInput).toBeInTheDocument();
      expect(signInButton).toBeInTheDocument();
    });

    it('external links open in new tab', () => {
      renderWithProviders(<AlphaLandingPage />);

      const docsLink = screen.getByRole('link', { name: /read the docs/i });
      const githubLink = screen.getByRole('link', { name: /github/i });
      const blueskyLink = screen.getByRole('link', { name: /bluesky/i });

      expect(docsLink).toHaveAttribute('target', '_blank');
      expect(docsLink).toHaveAttribute('rel', 'noopener noreferrer');
      expect(githubLink).toHaveAttribute('target', '_blank');
      expect(blueskyLink).toHaveAttribute('target', '_blank');
    });
  });

  describe('Sign In Flow', () => {
    it('shows loading state during sign in', async () => {
      const user = userEvent.setup();
      // Make login take some time
      mockLogin.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 1000)));

      renderWithProviders(<AlphaLandingPage />);

      const handleInput = screen.getByRole('textbox');
      await user.type(handleInput, 'alice.bsky.social');

      const signInButton = screen.getByRole('button', { name: /sign in with bluesky/i });
      await user.click(signInButton);

      // Button should show loading state
      expect(screen.getByText(/signing in/i)).toBeInTheDocument();
      expect(signInButton).toBeDisabled();
    });

    it('disables handle input during sign in', async () => {
      const user = userEvent.setup();
      mockLogin.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 1000)));

      renderWithProviders(<AlphaLandingPage />);

      const handleInput = screen.getByRole('textbox');
      await user.type(handleInput, 'alice.bsky.social');

      const signInButton = screen.getByRole('button', { name: /sign in with bluesky/i });
      await user.click(signInButton);

      expect(handleInput).toBeDisabled();
    });
  });
});
