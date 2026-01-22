'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, AlertCircle } from 'lucide-react';

import { startLogin } from '@/lib/auth';
import { logger } from '@/lib/observability';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const paperPopupLogger = logger.child({ component: 'paper-oauth-popup' });

/**
 * Loading fallback for the popup page.
 */
function PopupLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

/**
 * Paper OAuth popup content component.
 *
 * @remarks
 * Landing page for paper account OAuth flow.
 * Receives the paper handle and initiates OAuth redirect.
 *
 * URL: /oauth/paper-popup?handle=paper.bsky.social
 *
 * After OAuth completes, the user is redirected to /oauth/paper-callback
 * which posts the session data back to the opener window.
 */
function PaperOAuthPopupContent() {
  const searchParams = useSearchParams();
  const handle = searchParams.get('handle');
  const [error, setError] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    async function startOAuth() {
      if (!handle) {
        setError('No paper handle provided');
        return;
      }

      try {
        setIsRedirecting(true);

        // Start the OAuth flow for the paper account
        // This will redirect to the paper's PDS authorization server
        const authUrl = await startLogin({ handle });

        // Modify the redirect_uri to point to paper-callback instead of callback
        const url = new URL(authUrl);
        const currentRedirectUri = url.searchParams.get('redirect_uri');
        if (currentRedirectUri) {
          const newRedirectUri = currentRedirectUri.replace(
            '/oauth/callback',
            '/oauth/paper-callback'
          );
          url.searchParams.set('redirect_uri', newRedirectUri);
        }

        window.location.href = url.toString();
      } catch (err) {
        paperPopupLogger.error('Failed to start paper OAuth', err, { handle });
        setError(err instanceof Error ? err.message : 'Failed to start authentication');
        setIsRedirecting(false);
      }
    }

    startOAuth();
  }, [handle]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-background">
        <div className="w-full max-w-md space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Authentication Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>

          <p className="text-sm text-muted-foreground text-center">
            You can close this window and try again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <div>
          <p className="font-medium">Authenticating Paper Account</p>
          {handle && <p className="text-sm text-muted-foreground">@{handle}</p>}
        </div>
        {isRedirecting && (
          <p className="text-sm text-muted-foreground">Redirecting to authorization server...</p>
        )}
      </div>
    </div>
  );
}

/**
 * Paper OAuth popup page.
 *
 * @remarks
 * Wrapped in Suspense for static export compatibility.
 */
export default function PaperOAuthPopup() {
  return (
    <Suspense fallback={<PopupLoading />}>
      <PaperOAuthPopupContent />
    </Suspense>
  );
}
