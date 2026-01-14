'use client';

import { useRouter } from 'next/navigation';
import { useState, useCallback, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

import { useAuth, useIsAuthenticated } from '@/lib/auth';
import { useAlphaStatus } from '@/lib/hooks/use-alpha-status';
import { HandleInput } from '@/components/auth/handle-input';
import { Button } from '@/components/ui/button';
import { APIError } from '@/lib/errors';

/**
 * Simple alpha landing page.
 *
 * @remarks
 * Displays a minimal landing page matching the static landing.html design.
 * Instead of "Alpha Coming Soon", shows a handle input field for login.
 * After login, routes based on alpha status:
 * - No application: /apply
 * - Pending/Rejected: /pending
 * - Approved: / (main app)
 */
export default function AlphaLandingPage() {
  const router = useRouter();
  const { login, logout } = useAuth();
  const isAuthenticated = useIsAuthenticated();
  const [handle, setHandle] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      // Session is invalid - clear it and stay on landing page
      logout();
    }
  }, [isStatusError, isAuthError, logout]);

  // Route authenticated users based on their alpha status
  useEffect(() => {
    // Don't redirect while loading, if there's an error, or if we're handling auth error
    if (!isAuthenticated || isStatusLoading || isStatusError) return;

    if (alphaStatus?.status === 'approved') {
      // Approved users go to the main app
      router.replace('/dashboard');
    } else if (alphaStatus?.status === 'pending' || alphaStatus?.status === 'rejected') {
      // Pending or rejected users see the pending page (never show rejected)
      router.replace('/pending');
    } else if (alphaStatus?.status === 'none') {
      // Users without an application go to apply
      router.replace('/apply');
    }
  }, [isAuthenticated, isStatusLoading, isStatusError, alphaStatus, router]);

  const handleLogin = useCallback(async () => {
    if (!handle.trim()) {
      setError('Please enter your handle');
      return;
    }

    setError(null);
    setIsLoggingIn(true);

    try {
      await login({ handle });
      // OAuth will redirect, so we don't need to do anything here
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setIsLoggingIn(false);
    }
  }, [handle, login]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && handle.trim()) {
        handleLogin();
      }
    },
    [handle, handleLogin]
  );

  // Show loading while checking auth status
  if (isAuthenticated && isStatusLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </main>
    );
  }

  // Show error if status check failed for authenticated user (non-auth errors only)
  // Auth errors (401) are handled by logging out, so user sees landing page
  // Other errors (500, network) show an error page with retry option
  if (isAuthenticated && isStatusError && !isAuthError) {
    const errorMessage =
      statusError instanceof Error ? statusError.message : 'Failed to check alpha status';
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-16">
        <div className="max-w-[600px] text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/chive-logo.svg"
            alt="Chive"
            className="mx-auto mb-8 h-[100px] w-[100px] rounded-[20px]"
          />
          <h1 className="mb-2 text-3xl font-bold tracking-tight">Connection Error</h1>
          <p className="mb-6 text-lg text-muted-foreground">
            We couldn&apos;t verify your alpha status. Please try again.
          </p>
          <p className="mb-6 text-sm text-destructive">{errorMessage}</p>
          <Button
            onClick={() => window.location.reload()}
            className="bg-[#157200] hover:bg-[#125f00]"
          >
            Retry
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="max-w-[600px] text-center">
        {/* Logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/chive-logo.svg"
          alt="Chive"
          className="mx-auto mb-8 h-[100px] w-[100px] rounded-[20px]"
        />

        {/* Title */}
        <h1 className="mb-2 text-5xl font-bold tracking-tight">Chive</h1>
        <p className="mb-6 text-2xl text-muted-foreground">Decentralized Eprints</p>

        {/* Description */}
        <p className="mb-8 text-lg leading-relaxed text-muted-foreground">
          Decentralized eprints on ATProto. Share your research with full data sovereignty, open
          federation, and community governance.
        </p>

        {/* Handle Input */}
        <div className="mx-auto mb-6 max-w-sm">
          <div className="mb-3">
            <HandleInput
              value={handle}
              onChange={setHandle}
              onSelect={(actor) => setHandle(actor.handle)}
              placeholder="yourhandle.bsky.social"
              disabled={isLoggingIn}
              className="w-full"
            />
          </div>
          <Button
            onClick={handleLogin}
            onKeyDown={handleKeyDown}
            disabled={isLoggingIn || !handle.trim()}
            className="w-full bg-[#157200] hover:bg-[#125f00]"
          >
            {isLoggingIn ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign in with Bluesky'
            )}
          </Button>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </div>

        {/* Links */}
        <div className="flex flex-wrap justify-center gap-3">
          <a
            href="https://docs.chive.pub"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-transparent px-6 py-3 text-base font-medium transition-colors hover:bg-muted"
          >
            Read the Docs
          </a>
          <a
            href="https://github.com/chive-pub/chive"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-transparent px-6 py-3 text-base font-medium transition-colors hover:bg-muted"
          >
            GitHub
          </a>
          <a
            href="https://bsky.app/profile/chive.pub"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-transparent px-6 py-3 text-base font-medium transition-colors hover:bg-muted"
          >
            Bluesky
          </a>
        </div>
      </div>
    </main>
  );
}
