'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { getApiBaseUrl } from '@/lib/api/client';
import { getServiceAuthToken } from '@/lib/auth/service-auth';
import { getCurrentAgent } from '@/lib/auth/oauth-client';
import { updateChiveProfileRecord } from '@/lib/atproto/record-creator';

interface UseOrcidOAuthOptions {
  onSuccess?: (orcid: string) => void;
}

/**
 * Hook for initiating ORCID OAuth verification.
 *
 * @remarks
 * Opens a popup window for the ORCID OAuth flow. On completion,
 * the popup posts a message back to the opener with the verified ORCID.
 * Invalidates author and profile query caches on success.
 *
 * If the server does not have ORCID OAuth configured, `isAvailable`
 * is set to false so the UI can hide the button.
 *
 * @param options - optional callbacks
 * @returns state and trigger function for the ORCID OAuth flow
 */
export function useOrcidOAuth(options?: UseOrcidOAuthOptions) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verifiedOrcid, setVerifiedOrcid] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const popupRef = useRef<Window | null>(null);

  // Handle a verified ORCID from the popup (via postMessage or localStorage)
  const handleVerified = useCallback(
    (orcid: string) => {
      setVerifiedOrcid(orcid);
      setIsVerifying(false);
      setError(null);

      // Write the verified ORCID to the user's PDS profile record
      const agent = getCurrentAgent();
      if (agent) {
        updateChiveProfileRecord(agent, { orcid }).catch(() => {
          // Non-critical: the index already has the verified ORCID
        });
      }

      // Invalidate profile queries so the verified badge shows
      queryClient.invalidateQueries({ queryKey: ['author'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });

      options?.onSuccess?.(orcid);
    },
    [queryClient, options]
  );

  // Listen for postMessage from popup
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== 'orcid-oauth-complete') return;
      handleVerified(event.data.orcid as string);
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleVerified]);

  // Listen for localStorage storage event (works when postMessage is blocked
  // because the popup navigated cross-origin through orcid.org)
  useEffect(() => {
    const STORAGE_KEY = 'chive_orcid_oauth_result';

    function handleStorage(event: StorageEvent) {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try {
        const data = JSON.parse(event.newValue) as { orcid: string; timestamp: number };
        // Only accept results from the last 60 seconds
        if (Date.now() - data.timestamp < 60_000) {
          handleVerified(data.orcid);
        }
      } catch {
        // Ignore malformed data
      }
      // Clean up the key
      localStorage.removeItem(STORAGE_KEY);
    }

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [handleVerified]);

  const initiateOrcidOAuth = useCallback(async () => {
    setError(null);
    setIsVerifying(true);

    try {
      const agent = getCurrentAgent();
      if (!agent) {
        throw new Error('Not authenticated');
      }

      const token = await getServiceAuthToken(agent, 'pub.chive.author.initiateOrcidVerification');

      const response = await fetch(
        `${getApiBaseUrl()}/xrpc/pub.chive.author.initiateOrcidVerification`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
        };

        // If the server says ORCID OAuth isn't configured, disable the button
        if (body.error === 'OrcidNotConfigured' || response.status === 501) {
          setIsAvailable(false);
          setIsVerifying(false);
          return;
        }

        throw new Error(body.message ?? 'Failed to initiate ORCID verification');
      }

      const data = (await response.json()) as { authorizeUrl: string };

      // Open popup
      const popup = window.open(
        data.authorizeUrl,
        'orcid-oauth',
        'width=600,height=700,menubar=no,toolbar=no,location=yes,status=no'
      );

      if (!popup) {
        throw new Error('Popup blocked. Please allow popups for this site and try again.');
      }

      popupRef.current = popup;

      // Monitor popup closing without completing
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          // Only reset if we didn't get a success message
          setIsVerifying((current) => {
            if (current) {
              setError(null); // User just closed the popup, not an error
              return false;
            }
            return current;
          });
        }
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsVerifying(false);
    }
  }, []);

  return { initiateOrcidOAuth, isVerifying, isAvailable, error, verifiedOrcid };
}
