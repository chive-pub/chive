'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useAuth } from '@/lib/auth';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Props for the AdminGuard component.
 */
interface AdminGuardProps {
  /** Content to render when user has admin access */
  children: React.ReactNode;
}

/**
 * Guard component that restricts access to admin users.
 *
 * @remarks
 * Renders a loading skeleton while the admin status is being resolved.
 * Redirects non-admin users to `/dashboard` once their role is determined.
 * Should be used inside an `AuthGuard` to ensure the user is authenticated first.
 *
 * @example
 * ```tsx
 * <AuthGuard>
 *   <AdminGuard>
 *     <AdminDashboard />
 *   </AdminGuard>
 * </AuthGuard>
 * ```
 */
export function AdminGuard({ children }: AdminGuardProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated && user?.isAdmin === false) {
      router.replace('/dashboard');
    }
  }, [isLoading, isAuthenticated, user?.isAdmin, router]);

  if (isLoading || user?.isAdmin === undefined) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    );
  }

  if (!user?.isAdmin) {
    return null;
  }

  return <>{children}</>;
}
