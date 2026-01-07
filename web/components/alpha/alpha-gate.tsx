'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

import { useIsAuthenticated } from '@/lib/auth';
import { useAlphaStatus } from '@/lib/hooks/use-alpha-status';

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
 * Public routes (preprints, search, authors) should NOT use this gate.
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
  const isAuthenticated = useIsAuthenticated();
  const {
    data: alphaStatus,
    isLoading,
    isError,
  } = useAlphaStatus({
    enabled: isAuthenticated,
  });

  useEffect(() => {
    // If unauthenticated and not allowed, redirect to login
    if (!isAuthenticated && !allowUnauthenticated) {
      router.replace('/login');
      return;
    }

    // If authenticated, check alpha status once loaded
    if (isAuthenticated && !isLoading && !isError) {
      // Only approved users can access protected routes
      if (alphaStatus?.status !== 'approved') {
        router.replace('/');
      }
    }
  }, [isAuthenticated, isLoading, isError, alphaStatus, allowUnauthenticated, router]);

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

  // If error fetching status, redirect to homepage
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
