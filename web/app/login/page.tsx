'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoginForm } from '@/components/auth/login-form';
import { useAuth, useIsAuthenticated } from '@/lib/auth';
import { useAlphaStatus } from '@/lib/hooks/use-alpha-status';
import { APIError } from '@/lib/errors';

/**
 * Login page content component.
 *
 * @remarks
 * Displays the ATProto OAuth login form.
 * Routes authenticated users based on their alpha status.
 * Handles redirect parameter for post-login navigation.
 */
function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect');
  const { logout } = useAuth();
  const isAuthenticated = useIsAuthenticated();

  const {
    data: alphaStatus,
    isLoading: isStatusLoading,
    isError: isStatusError,
    error: statusError,
  } = useAlphaStatus({
    enabled: isAuthenticated,
  });

  // Check if the error is an authentication error (401)
  const isAuthError = statusError instanceof APIError && statusError.statusCode === 401;

  // Handle 401 errors by logging out the invalid session
  useEffect(() => {
    if (isStatusError && isAuthError) {
      // Session is invalid - clear it and stay on login page
      logout();
    }
  }, [isStatusError, isAuthError, logout]);

  // Route authenticated users based on their alpha status
  useEffect(() => {
    // Don't redirect while loading, if there's an error, or if we're handling auth error
    if (!isAuthenticated || isStatusLoading || isStatusError) return;

    if (alphaStatus?.status === 'approved') {
      // Approved users go to the redirect target or dashboard
      router.replace(redirectTo ? decodeURIComponent(redirectTo) : '/dashboard');
    } else if (alphaStatus?.status === 'pending' || alphaStatus?.status === 'rejected') {
      // Pending or rejected users see the pending page
      router.replace('/pending');
    } else if (alphaStatus?.status === 'none') {
      // Users without an application go to apply
      router.replace('/apply');
    }
  }, [isAuthenticated, isStatusLoading, isStatusError, alphaStatus, router, redirectTo]);

  // Show loading while checking auth status for authenticated users
  if (isAuthenticated && isStatusLoading) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col items-center justify-center px-4 py-8">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Checking access...</p>
        </div>
      </div>
    );
  }

  // Show loading while redirecting authenticated users
  if (isAuthenticated && !isStatusError) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col items-center justify-center px-4 py-8">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    );
  }

  // Show login form for unauthenticated users (or auth error users after logout)
  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col items-center justify-center px-4 py-8">
      <Card className="w-full">
        <CardHeader className="text-center">
          <CardTitle asChild>
            <h1 className="text-2xl font-bold">Sign in to Chive</h1>
          </CardTitle>
          <CardDescription>
            Use your Bluesky handle or AT Protocol identity to sign in. Your data stays in your
            Personal Data Server.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />

          {redirectTo && (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              You&apos;ll be redirected to {decodeURIComponent(redirectTo)} after signing in.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 text-center text-sm text-muted-foreground">
        <p>
          By signing in, you agree to our{' '}
          <Link href="/terms" className="underline hover:text-foreground">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="underline hover:text-foreground">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

/**
 * Login page component.
 *
 * @remarks
 * ATProto OAuth login page for Chive.
 * Users can sign in with their Bluesky handle or any AT Protocol identity.
 * Already authenticated users are redirected based on their alpha status.
 *
 * @see {@link https://atproto.com/specs/oauth} - ATProto OAuth Specification
 * @see {@link https://docs.bsky.app/docs/advanced-guides/oauth-client} - OAuth Client Implementation Guide
 */
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col items-center justify-center px-4 py-8">
          <Card className="w-full">
            <CardHeader className="text-center">
              <CardTitle asChild>
                <h1 className="text-2xl font-bold">Sign in to Chive</h1>
              </CardTitle>
              <CardDescription>Loading...</CardDescription>
            </CardHeader>
          </Card>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
