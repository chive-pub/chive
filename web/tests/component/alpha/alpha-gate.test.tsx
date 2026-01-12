/**
 * Component tests for AlphaGate.
 *
 * @remarks
 * Tests the alpha gating component that restricts access to approved alpha testers.
 * Verifies redirects for different authentication and alpha status combinations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock router
const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
}));

// Mock auth hooks
const mockIsAuthenticated = vi.fn();
const mockLogout = vi.fn();
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    logout: mockLogout,
  }),
  useIsAuthenticated: () => mockIsAuthenticated(),
}));

// Mock alpha status hook
const mockAlphaStatus = vi.fn();
vi.mock('@/lib/hooks/use-alpha-status', () => ({
  useAlphaStatus: (options?: { enabled?: boolean }) => {
    if (options?.enabled === false) {
      return { data: undefined, isLoading: false, isError: false };
    }
    return mockAlphaStatus();
  },
}));

import { AlphaGate } from '@/components/alpha/alpha-gate';
import { APIError } from '@/lib/errors';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createTestQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('AlphaGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAuthenticated.mockReturnValue(false);
    mockAlphaStatus.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    });
  });

  describe('Unauthenticated Users', () => {
    beforeEach(() => {
      mockIsAuthenticated.mockReturnValue(false);
    });

    it('redirects unauthenticated users to landing page', async () => {
      renderWithProviders(
        <AlphaGate>
          <div>Protected Content</div>
        </AlphaGate>
      );

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/');
      });
    });

    it('does not render children for unauthenticated users', () => {
      renderWithProviders(
        <AlphaGate>
          <div>Protected Content</div>
        </AlphaGate>
      );

      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('shows loading state while redirecting', () => {
      renderWithProviders(
        <AlphaGate>
          <div>Protected Content</div>
        </AlphaGate>
      );

      expect(screen.getByText(/checking access/i)).toBeInTheDocument();
    });

    it('allows unauthenticated users through when allowUnauthenticated is true', () => {
      renderWithProviders(
        <AlphaGate allowUnauthenticated>
          <div>Public Content</div>
        </AlphaGate>
      );

      expect(screen.getByText('Public Content')).toBeInTheDocument();
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  describe('Authenticated Users - No Application', () => {
    beforeEach(() => {
      mockIsAuthenticated.mockReturnValue(true);
      mockAlphaStatus.mockReturnValue({
        data: { status: 'none' },
        isLoading: false,
        isError: false,
      });
    });

    it('redirects users without application to /apply', async () => {
      renderWithProviders(
        <AlphaGate>
          <div>Protected Content</div>
        </AlphaGate>
      );

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/apply');
      });
    });

    it('does not render children for users without application', () => {
      renderWithProviders(
        <AlphaGate>
          <div>Protected Content</div>
        </AlphaGate>
      );

      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });
  });

  describe('Authenticated Users - Pending Application', () => {
    beforeEach(() => {
      mockIsAuthenticated.mockReturnValue(true);
      mockAlphaStatus.mockReturnValue({
        data: { status: 'pending' },
        isLoading: false,
        isError: false,
      });
    });

    it('redirects pending users to /pending', async () => {
      renderWithProviders(
        <AlphaGate>
          <div>Protected Content</div>
        </AlphaGate>
      );

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/pending');
      });
    });

    it('does not render children for pending users', () => {
      renderWithProviders(
        <AlphaGate>
          <div>Protected Content</div>
        </AlphaGate>
      );

      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });
  });

  describe('Authenticated Users - Rejected Application', () => {
    beforeEach(() => {
      mockIsAuthenticated.mockReturnValue(true);
      mockAlphaStatus.mockReturnValue({
        data: { status: 'rejected' },
        isLoading: false,
        isError: false,
      });
    });

    it('redirects rejected users to /pending (never shows rejection)', async () => {
      renderWithProviders(
        <AlphaGate>
          <div>Protected Content</div>
        </AlphaGate>
      );

      // CRITICAL: Rejected users go to /pending, NOT a rejected page
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/pending');
      });
    });

    it('does not render children for rejected users', () => {
      renderWithProviders(
        <AlphaGate>
          <div>Protected Content</div>
        </AlphaGate>
      );

      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });
  });

  describe('Authenticated Users - Approved', () => {
    beforeEach(() => {
      mockIsAuthenticated.mockReturnValue(true);
      mockAlphaStatus.mockReturnValue({
        data: { status: 'approved' },
        isLoading: false,
        isError: false,
      });
    });

    it('renders children for approved users', () => {
      renderWithProviders(
        <AlphaGate>
          <div>Protected Content</div>
        </AlphaGate>
      );

      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });

    it('does not redirect approved users', async () => {
      renderWithProviders(
        <AlphaGate>
          <div>Protected Content</div>
        </AlphaGate>
      );

      // Wait a tick to ensure no redirect happens
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  describe('Loading States', () => {
    it('shows loading while fetching alpha status', () => {
      mockIsAuthenticated.mockReturnValue(true);
      mockAlphaStatus.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
      });

      renderWithProviders(
        <AlphaGate>
          <div>Protected Content</div>
        </AlphaGate>
      );

      expect(screen.getByText(/checking access/i)).toBeInTheDocument();
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('does not redirect while loading', () => {
      mockIsAuthenticated.mockReturnValue(true);
      mockAlphaStatus.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
      });

      renderWithProviders(
        <AlphaGate>
          <div>Protected Content</div>
        </AlphaGate>
      );

      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  describe('Error States', () => {
    it('shows loading state on error (while redirecting)', () => {
      mockIsAuthenticated.mockReturnValue(true);
      mockAlphaStatus.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new APIError('Internal server error', 500, '/xrpc/pub.chive.alpha.checkStatus'),
      });

      renderWithProviders(
        <AlphaGate>
          <div>Protected Content</div>
        </AlphaGate>
      );

      expect(screen.getByText(/checking access/i)).toBeInTheDocument();
    });

    it('redirects to landing page on non-auth error', async () => {
      mockIsAuthenticated.mockReturnValue(true);
      mockAlphaStatus.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new APIError('Internal server error', 500, '/xrpc/pub.chive.alpha.checkStatus'),
      });

      renderWithProviders(
        <AlphaGate>
          <div>Protected Content</div>
        </AlphaGate>
      );

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/');
      });
    });

    it('calls logout and redirects on 401 error', async () => {
      mockIsAuthenticated.mockReturnValue(true);
      mockAlphaStatus.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new APIError('Unauthorized', 401, '/xrpc/pub.chive.alpha.checkStatus'),
      });

      renderWithProviders(
        <AlphaGate>
          <div>Protected Content</div>
        </AlphaGate>
      );

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled();
        expect(mockReplace).toHaveBeenCalledWith('/');
      });
    });

    it('does not render children on error', () => {
      mockIsAuthenticated.mockReturnValue(true);
      mockAlphaStatus.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new Error('Some error'),
      });

      renderWithProviders(
        <AlphaGate>
          <div>Protected Content</div>
        </AlphaGate>
      );

      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });
  });

  describe('Redirect Behavior Comprehensive', () => {
    it('handles undefined alphaStatus gracefully', async () => {
      mockIsAuthenticated.mockReturnValue(true);
      mockAlphaStatus.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: false,
      });

      renderWithProviders(
        <AlphaGate>
          <div>Protected Content</div>
        </AlphaGate>
      );

      // Should redirect to /apply when no alpha status data
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/apply');
      });
    });

    it('handles null alphaStatus gracefully', async () => {
      mockIsAuthenticated.mockReturnValue(true);
      mockAlphaStatus.mockReturnValue({
        data: null,
        isLoading: false,
        isError: false,
      });

      renderWithProviders(
        <AlphaGate>
          <div>Protected Content</div>
        </AlphaGate>
      );

      // Should redirect to /apply when alphaStatus is null
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/apply');
      });
    });
  });
});
