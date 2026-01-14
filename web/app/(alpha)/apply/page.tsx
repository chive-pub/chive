'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

import { useIsAuthenticated } from '@/lib/auth';
import { useAlphaStatus } from '@/lib/hooks/use-alpha-status';
import { AlphaSignupForm } from '@/components/alpha/signup-form';

/**
 * Simple alpha application page.
 *
 * @remarks
 * Displays a minimal application form for alpha signup.
 * Only accessible to authenticated users without an existing application.
 */
export default function AlphaApplyPage() {
  const router = useRouter();
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
    } else if (alphaStatus?.status === 'pending' || alphaStatus?.status === 'rejected') {
      router.replace('/pending');
    }
  }, [isAuthenticated, isLoading, alphaStatus, router]);

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

  // Only show form if no application exists
  if (alphaStatus && alphaStatus.status !== 'none') {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Redirecting...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg">
        {/* Logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/chive-logo.svg" alt="Chive" className="mx-auto mb-8 h-16 w-16" />

        {/* Form */}
        <AlphaSignupForm
          onSuccess={() => {
            router.push('/pending');
          }}
        />
      </div>
    </main>
  );
}
