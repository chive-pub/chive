'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoginForm } from '@/components/auth/login-form';

/**
 * Login page content component.
 *
 * @remarks
 * Displays the ATProto OAuth login form.
 * Handles redirect parameter for post-login navigation.
 */
function LoginContent() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect');

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
