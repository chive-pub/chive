'use client';

import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

import { initializeOAuth } from '@/lib/auth';
import { postPaperSessionToOpener, postPaperErrorToOpener } from '@/lib/auth/paper-oauth-popup';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

/**
 * Loading fallback for the callback page.
 */
function CallbackLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="text-muted-foreground">Completing authentication...</p>
      </div>
    </div>
  );
}

/**
 * Paper OAuth callback content component.
 *
 * @remarks
 * Handles OAuth callback for paper account authentication.
 * Posts the session data to the opener window and closes.
 *
 * Unlike the main callback page, this page:
 * - Posts session to opener via postMessage
 * - Closes the popup after success
 * - Does NOT redirect within the popup
 */
function PaperOAuthCallbackContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function processCallback() {
      try {
        // Check for OAuth error response
        const errorParam = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        if (errorParam) {
          const errMsg = errorDescription || errorParam;
          setError(errMsg);
          setStatus('error');
          postPaperErrorToOpener(errMsg);
          return;
        }

        // Check if opener window exists
        if (!window.opener) {
          setError('No opener window found. Please close this window and try again.');
          setStatus('error');
          return;
        }

        // Process the OAuth callback
        const result = await initializeOAuth();

        if (result) {
          // Extract PDS endpoint from session or fetch from DID doc
          let pdsEndpoint = 'unknown';
          try {
            const server = result.session.server;
            if (server instanceof URL) {
              pdsEndpoint = server.toString();
            } else if (typeof server === 'string') {
              pdsEndpoint = server;
            } else if (server && typeof server === 'object') {
              const serverObj = server as { href?: string; origin?: string };
              pdsEndpoint = serverObj.href || serverObj.origin || 'unknown';
            }
          } catch {
            // Keep as unknown
          }

          // Post session to opener
          postPaperSessionToOpener({
            did: result.user.did,
            handle: result.user.handle,
            pdsEndpoint,
          });

          setStatus('success');

          // Close popup after a brief delay
          setTimeout(() => {
            window.close();
          }, 1500);
        } else {
          // No callback params found
          const code = searchParams.get('code');
          if (code) {
            const errMsg = 'Failed to complete authentication';
            setError(errMsg);
            setStatus('error');
            postPaperErrorToOpener(errMsg);
          } else {
            setError('No authentication data received');
            setStatus('error');
          }
        }
      } catch (err) {
        console.error('Paper OAuth callback error:', err);
        const errMsg = err instanceof Error ? err.message : 'Authentication failed';
        setError(errMsg);
        setStatus('error');
        postPaperErrorToOpener(errMsg);
      }
    }

    processCallback();
  }, [searchParams]);

  if (status === 'processing') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Completing authentication...</p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
          <div>
            <p className="font-medium text-lg">Authentication Successful</p>
            <p className="text-sm text-muted-foreground">This window will close automatically...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Authentication Failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>

        <p className="text-sm text-muted-foreground text-center">
          You can close this window and try again.
        </p>
      </div>
    </div>
  );
}

/**
 * Paper OAuth callback page.
 *
 * @remarks
 * Wrapped in Suspense for static export compatibility.
 */
export default function PaperOAuthCallback() {
  return (
    <Suspense fallback={<CallbackLoading />}>
      <PaperOAuthCallbackContent />
    </Suspense>
  );
}
