'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

import { useAuth, useIsAuthenticated } from '@/lib/auth';
import { useAlphaStatus } from '@/lib/hooks/use-alpha-status';
import { Button } from '@/components/ui/button';

/**
 * Simple pending status page.
 *
 * @remarks
 * Displays a minimal pending message for users who have submitted an application.
 * Shows for both pending AND rejected users (rejected users never see "rejected").
 */
export default function AlphaPendingPage() {
  const router = useRouter();
  const { logout } = useAuth();
  const isAuthenticated = useIsAuthenticated();
  const { data: alphaStatus, isLoading } = useAlphaStatus({
    enabled: isAuthenticated,
  });

  // Redirect based on auth and status
  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/');
      return;
    }

    if (isLoading) return;

    if (alphaStatus?.status === 'approved') {
      router.replace('/dashboard');
    } else if (alphaStatus?.status === 'none' || !alphaStatus) {
      router.replace('/apply');
    }
    // pending and rejected stay on this page
  }, [isAuthenticated, isLoading, alphaStatus, router]);

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  // Show loading while checking status
  if (!isAuthenticated || isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </main>
    );
  }

  // Format the application date
  const appliedAt = alphaStatus?.appliedAt
    ? new Date(alphaStatus.appliedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="max-w-md text-center">
        {/* Logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/chive-logo.svg" alt="Chive" className="mx-auto mb-8 h-16 w-16" />

        {/* Title */}
        <h1 className="mb-2 text-2xl font-bold tracking-tight">Application Under Review</h1>

        {/* Date */}
        {appliedAt && <p className="mb-4 text-sm text-muted-foreground">Applied on {appliedAt}</p>}

        {/* Message */}
        <p className="mb-8 text-muted-foreground">
          Thanks for applying to the Chive alpha! We are reviewing applications and will notify you
          by email when a decision is made.
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Button variant="outline" onClick={handleLogout} className="w-full">
            Sign Out
          </Button>
          <a
            href="https://bsky.app/profile/chive.pub"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Follow us on Bluesky for updates
          </a>
        </div>
      </div>
    </main>
  );
}
