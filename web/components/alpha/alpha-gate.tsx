'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

import { useAuth, useIsAuthenticated } from '@/lib/auth';
import { useAlphaStatus } from '@/lib/hooks/use-alpha-status';
import { APIError } from '@/lib/errors';

/**
 * Props for AlphaGate component.
 */
interface AlphaGateProps {
  /** Content to render when user is approved */
  children: React.ReactNode;
  /**
   * Whether to allow unauthenticated users through.
   * If true, unauthenticated users can view the content (for public pages).
   * If false, they are redirected to login.
   * @default false
   */
  allowUnauthenticated?: boolean;
}

/**
 * Alpha gate component that restricts access to approved alpha testers.
 *
 * @remarks
 * This component should wrap protected routes that require alpha access.
 * Users who are not approved alpha testers are redirected to the homepage
 * where they can see the signup form or their application status.
 *
 * Public routes (eprints, search, authors) should NOT use this gate.
 *
 * @example
 * ```tsx
 * // In a protected layout like app/dashboard/layout.tsx
 * export default function DashboardLayout({ children }) {
 *   return <AlphaGate>{children}</AlphaGate>;
 * }
 * ```
 */
export function AlphaGate({ children, allowUnauthenticated = false }: AlphaGateProps) {
  const router = useRouter();
  const { logout } = useAuth();
  const isAuthenticated = useIsAuthenticated();
  const {
    data: alphaStatus,
    isLoading,
    isError,
    error,
  } = useAlphaStatus({
    enabled: isAuthenticated,
  });

  // Check if error is an authentication error (401)
  const isAuthError = error instanceof APIError && error.statusCode === 401;

  useEffect(() => {
    // If unauthenticated and not allowed, redirect to landing page
    if (!isAuthenticated && !allowUnauthenticated) {
      router.replace('/');
      return;
    }

    // Handle 401 errors by logging out and redirecting to landing
    if (isAuthenticated && isError && isAuthError) {
      logout();
      router.replace('/');
      return;
    }

    // Handle other errors by redirecting to landing page
    if (isAuthenticated && isError && !isAuthError) {
      router.replace('/');
      return;
    }

    // If authenticated, check alpha status once loaded
    if (isAuthenticated && !isLoading && !isError) {
      // Only approved users can access protected routes
      if (alphaStatus?.status !== 'approved') {
        // Redirect to apply or pending based on status
        if (alphaStatus?.status === 'none' || !alphaStatus) {
          router.replace('/apply');
        } else {
          // pending or rejected go to pending page
          router.replace('/pending');
        }
      }
    }
  }, [
    isAuthenticated,
    isLoading,
    isError,
    isAuthError,
    alphaStatus,
    allowUnauthenticated,
    router,
    logout,
  ]);

  // Allow unauthenticated users through if configured
  if (!isAuthenticated) {
    if (allowUnauthenticated) {
      return <>{children}</>;
    }
    // Show loading while redirecting
    return <AlphaGateLoading />;
  }

  // Show loading while checking alpha status
  if (isLoading) {
    return <AlphaGateLoading />;
  }

  // Show loading while redirecting on error
  if (isError) {
    return <AlphaGateLoading />;
  }

  // Only render children if approved
  if (alphaStatus?.status === 'approved') {
    return <>{children}</>;
  }

  // Show loading while redirecting (status is not approved)
  return <AlphaGateLoading />;
}

/**
 * Loading state shown while checking alpha status or redirecting.
 */
function AlphaGateLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Checking access...</p>
      </div>
    </div>
  );
}

export default AlphaGate;
