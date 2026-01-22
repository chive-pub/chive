'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { initializeOAuth } from '@/lib/auth';
import { logger } from '@/lib/observability';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const oauthLogger = logger.child({ component: 'oauth-callback' });
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2 } from 'lucide-react';

/**
 * OAuth callback content handler.
 *
 * @remarks
 * The BrowserOAuthClient handles the callback automatically when
 * initializeOAuth() is called and detects callback params in the URL.
 * This page shows a loading state during processing and handles errors.
 */
export function OAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    async function processCallback() {
      try {
        // Check for OAuth error response
        const errorParam = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        if (errorParam) {
          setError(errorDescription || errorParam);
          setIsProcessing(false);
          return;
        }

        // The BrowserOAuthClient handles the callback automatically
        // when it detects code/state in the URL
        const result = await initializeOAuth();

        if (result) {
          // Success: redirect to landing page which handles alpha status routing
          router.push('/');
        } else {
          // No callback params found or session already exists
          // Check if there's a code parameter. If so, there was an error
          const code = searchParams.get('code');
          if (code) {
            setError('Failed to complete authentication. Please try again.');
            setIsProcessing(false);
          } else {
            // No callback params, just redirect to landing page
            router.push('/');
          }
        }
      } catch (err) {
        oauthLogger.error('OAuth callback error', err);
        setError(err instanceof Error ? err.message : 'Authentication failed');
        setIsProcessing(false);
      }
    }

    processCallback();
  }, [searchParams, router]);

  if (isProcessing) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Completing authentication...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Authentication Failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>

          <div className="flex gap-4">
            <Button variant="outline" onClick={() => router.push('/')}>
              Go Home
            </Button>
            <Button onClick={() => router.push('/')}>Try Again</Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
