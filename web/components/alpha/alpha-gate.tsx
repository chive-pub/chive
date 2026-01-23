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
 * Check if alpha gate should be bypassed in development.
 *
 * @remarks
 * When NEXT_PUBLIC_DEV_MODE=local, the alpha gate is bypassed to allow
 * testing without OAuth (which requires tunneling).
 */
function shouldBypassAlphaGate(): boolean {
  return process.env.NEXT_PUBLIC_DEV_MODE === 'local';
}

/**
 * Alpha gate component that restricts access to approved alpha testers.
 *
 * @remarks
 * This component should wrap ALL routes that require alpha access.
 * During the alpha period, ALL pages are gated except for:
 * - Landing page (`/`)
 * - Apply page (`/apply`)
 * - Pending page (`/pending`)
 * - Login page (`/login`)
 * - OAuth callback (`/oauth/callback`)
 *
 * Users who are not approved alpha testers are redirected to the homepage
 * where they can see the signup form or their application status.
 *
 * In local development mode (NEXT_PUBLIC_DEV_MODE=local), the gate is
 * bypassed to allow testing without OAuth.
 *
 * @example
 * ```tsx
 * // In a layout file like app/eprints/layout.tsx
 * export default function EprintsLayout({ children }) {
 *   return <AlphaGate>{children}</AlphaGate>;
 * }
 * ```
 */
export function AlphaGate({ children, allowUnauthenticated = false }: AlphaGateProps) {
  // All hooks must be called unconditionally at the top of the component
  const router = useRouter();
  const { logout } = useAuth();
  const isAuthenticated = useIsAuthenticated();
  const bypassGate = shouldBypassAlphaGate();
  const {
    data: alphaStatus,
    isLoading,
    isError,
    error,
  } = useAlphaStatus({
    // Skip the query if bypassing or not authenticated
    enabled: isAuthenticated && !bypassGate,
  });

  // Check if error is an authentication error (401)
  const isAuthError = error instanceof APIError && error.statusCode === 401;

  useEffect(() => {
    // No redirects needed when bypassing
    if (bypassGate) {
      return;
    }
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
    bypassGate,
    isAuthenticated,
    isLoading,
    isError,
    isAuthError,
    alphaStatus,
    allowUnauthenticated,
    router,
    logout,
  ]);

  // Bypass alpha gate in local development mode
  if (bypassGate) {
    return <>{children}</>;
  }

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
