'use client';

import { useAuth } from '@/lib/auth';
import { LoginDialog } from '@/components/auth/login-dialog';
import { UserMenu } from '@/components/auth/user-menu';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Auth button component for the site header.
 *
 * @remarks
 * Shows login button when unauthenticated, user menu when authenticated.
 * Handles loading state with skeleton.
 */
export function AuthButton() {
  const { isAuthenticated, isLoading } = useAuth();

  // Loading state
  if (isLoading) {
    return <Skeleton className="h-9 w-9 rounded-full" />;
  }

  // Authenticated: show user menu.
  if (isAuthenticated) {
    return <UserMenu />;
  }

  // Not authenticated: show login button.
  return (
    <LoginDialog
      trigger={
        <Button variant="outline" size="sm">
          Sign In
        </Button>
      }
    />
  );
}
