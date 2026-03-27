'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'chive_orcid_oauth_result';

function OrcidCompleteContent() {
  const searchParams = useSearchParams();
  const status = searchParams.get('status');
  const orcid = searchParams.get('orcid');
  const message = searchParams.get('message');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (status === 'success' && orcid) {
      // Write to localStorage - the parent window listens for storage events
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ orcid, timestamp: Date.now() }));

      // Also try postMessage as a fallback
      if (window.opener) {
        try {
          window.opener.postMessage(
            { type: 'orcid-oauth-complete', orcid },
            window.location.origin
          );
        } catch {
          // Cross-origin opener, localStorage will handle it
        }
      }

      setSent(true);
      setTimeout(() => window.close(), 1500);
    }
  }, [status, orcid]);

  if (status === 'success') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-3">
          <CheckCircle2 className="h-12 w-12 text-[#A6CE39] mx-auto" />
          <h1 className="text-lg font-semibold">ORCID Verified</h1>
          <p className="text-sm text-muted-foreground">
            {sent ? 'This window will close automatically.' : 'Verification complete.'}
          </p>
          {typeof window !== 'undefined' && !window.opener && (
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/settings">Return to Settings</Link>
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-3">
        <XCircle className="h-12 w-12 text-destructive mx-auto" />
        <h1 className="text-lg font-semibold">Verification Failed</h1>
        <p className="text-sm text-muted-foreground">
          {message ?? 'An error occurred during ORCID verification.'}
        </p>
        <Button onClick={() => window.close()} variant="outline" size="sm">
          Close
        </Button>
      </div>
    </div>
  );
}

export default function OrcidCompletePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p>Loading...</p>
        </div>
      }
    >
      <OrcidCompleteContent />
    </Suspense>
  );
}
