'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

import { useAuth } from '@/lib/auth';

/**
 * Props for the AuthGuard component.
 */
export interface AuthGuardProps {
  /**
   * Children to render when authenticated.
   */
  children: ReactNode;

  /**
   * Custom loading component.
   */
  loadingComponent?: ReactNode;

  /**
   * URL to redirect to when not authenticated.
   * @defaultValue '/login'
   */
  redirectTo?: string;

  /**
   * Whether to show loading state during auth check.
   * @defaultValue true
   */
  showLoading?: boolean;
}

/**
 * Auth guard component.
 *
 * @remarks
 * Protects routes that require authentication.
 * Redirects unauthenticated users to login page.
 *
 * @example
 * ```tsx
 * // In a page component
 * export default function DashboardPage() {
 *   return (
 *     <AuthGuard>
 *       <DashboardContent />
 *     </AuthGuard>
 *   );
 * }
 * ```
 */
export function AuthGuard({
  children,
  loadingComponent,
  redirectTo = '/login',
  showLoading = true,
}: AuthGuardProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Store current URL for redirect after login
      const currentPath = window.location.pathname + window.location.search;
      const loginUrl = `${redirectTo}?redirect=${encodeURIComponent(currentPath)}`;
      router.push(loginUrl);
    }
  }, [isLoading, isAuthenticated, router, redirectTo]);

  // Still loading auth state
  if (isLoading && showLoading) {
    return (
      loadingComponent ?? (
        <div className="flex min-h-[400px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )
    );
  }

  // Not authenticated: will redirect.
  if (!isAuthenticated) {
    return null;
  }

  // Authenticated: render children.
  return <>{children}</>;
}

/**
 * Higher-order component for auth guard.
 *
 * @example
 * ```tsx
 * const ProtectedPage = withAuthGuard(MyPageComponent);
 * ```
 */
export function withAuthGuard<P extends object>(
  Component: React.ComponentType<P>,
  authGuardProps?: Omit<AuthGuardProps, 'children'>
) {
  return function ProtectedComponent(props: P) {
    return (
      <AuthGuard {...authGuardProps}>
        <Component {...props} />
      </AuthGuard>
    );
  };
}
