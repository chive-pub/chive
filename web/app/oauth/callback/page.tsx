import { Suspense } from 'react';
import type { Metadata } from 'next';

import { OAuthCallbackContent } from './callback-content';

/**
 * OAuth callback page metadata.
 */
export const metadata: Metadata = {
  title: 'Authenticating...',
  robots: 'noindex',
};

/**
 * OAuth callback page.
 *
 * @remarks
 * Handles OAuth authorization code callback from user's PDS.
 * Exchanges code for tokens and redirects to dashboard.
 */
export default function OAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
            <p className="mt-4 text-muted-foreground">Authenticating...</p>
          </div>
        </div>
      }
    >
      <OAuthCallbackContent />
    </Suspense>
  );
}
