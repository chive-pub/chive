'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense, useEffect } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoginForm } from '@/components/auth/login-form';
import { useIsAuthenticated } from '@/lib/auth';

/**
 * Login page content component.
 *
 * @remarks
 * Displays the ATProto OAuth login form.
 * Redirects authenticated users to the dashboard or a redirect target.
 */
function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect');
  const isAuthenticated = useIsAuthenticated();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace(redirectTo ? decodeURIComponent(redirectTo) : '/dashboard');
    }
  }, [isAuthenticated, router, redirectTo]);

  // Show login form for unauthenticated users
  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col items-center justify-center px-4 py-8">
      <Card className="w-full">
        <CardHeader className="text-center">
          <CardTitle asChild>
            <h1 className="text-2xl font-bold">Sign in to Chive</h1>
          </CardTitle>
          <CardDescription>
            Use your AT Protocol handle to sign in. Your data stays in your Personal Data Server.
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
          <Link href="/about/terms" className="underline hover:text-foreground">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/about/privacy" className="underline hover:text-foreground">
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
 * Users sign in with their AT Protocol handle.
 * Already authenticated users are redirected to the dashboard.
 *
 * @see {@link https://atproto.com/specs/oauth} - ATProto OAuth Specification
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
