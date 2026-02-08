'use client';

/**
 * Prompt for paper account authentication.
 *
 * @remarks
 * Displays a prompt to authenticate as a paper account for editing
 * or deleting paper-centric eprints. Uses OAuth popup for authentication.
 *
 * The user must enter the paper's handle (which they should know if they
 * control the paper account). The handle is validated against the expected
 * DID before completing authentication.
 *
 * @packageDocumentation
 */

import { AlertCircle, KeyRound, Loader2 } from 'lucide-react';
import { useState, useCallback } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authenticatePaperInPopup, resolveHandle } from '@/lib/auth';
import { logger } from '@/lib/observability';

const paperAuthLogger = logger.child({ component: 'paper-auth-prompt' });

/**
 * Props for PaperAuthPrompt.
 */
interface PaperAuthPromptProps {
  /** Paper account DID */
  paperDid: string;
  /** Callback when authentication succeeds */
  onSuccess: () => void;
  /** Optional callback when authentication fails */
  onError?: (error: Error) => void;
}

/**
 * Paper account authentication prompt.
 *
 * @remarks
 * For paper-centric eprints, the user must authenticate as the paper
 * account to perform modifications. This component provides the UI
 * for initiating that authentication flow.
 *
 * The user enters the paper's handle, which is validated against the
 * expected DID. This ensures the user actually controls the paper account
 * rather than attempting unauthorized access.
 *
 * @param props - component props
 * @param props.paperDid - DID of the paper account to authenticate as
 * @param props.onSuccess - callback invoked when authentication succeeds
 * @param props.onError - callback invoked when authentication fails (optional)
 * @returns React element rendering the authentication card
 *
 * @example
 * ```tsx
 * <PaperAuthPrompt
 *   paperDid={eprint.paperDid}
 *   onSuccess={() => setIsPaperAuthenticated(true)}
 *   onError={(err) => toast.error(err.message)}
 * />
 * ```
 */
export function PaperAuthPrompt({ paperDid, onSuccess, onError }: PaperAuthPromptProps) {
  const [paperHandle, setPaperHandle] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuthenticate = useCallback(async () => {
    if (!paperHandle.trim()) {
      setError('Please enter the paper account handle');
      return;
    }

    setIsAuthenticating(true);
    setError(null);

    try {
      // First, resolve the handle to verify it matches the expected DID
      const resolved = await resolveHandle(paperHandle.trim());

      if (resolved.did !== paperDid) {
        setError(
          `Handle "${paperHandle}" resolves to a different DID. ` +
            'Please enter the correct handle for this paper account.'
        );
        setIsAuthenticating(false);
        return;
      }

      // Handle matches expected DID, proceed with OAuth popup
      paperAuthLogger.info('Starting paper OAuth popup', { paperHandle, paperDid });

      const session = await authenticatePaperInPopup(paperHandle.trim());

      // Verify the authenticated DID matches
      if (session.paperDid !== paperDid) {
        setError('Authenticated DID does not match the expected paper DID.');
        setIsAuthenticating(false);
        return;
      }

      paperAuthLogger.info('Paper OAuth successful', { paperDid: session.paperDid });
      onSuccess();
    } catch (err) {
      paperAuthLogger.error('Paper OAuth failed', err, { paperHandle, paperDid });
      const errorMessage = err instanceof Error ? err.message : 'Authentication failed';
      setError(errorMessage);
      onError?.(err instanceof Error ? err : new Error(errorMessage));
    } finally {
      setIsAuthenticating(false);
    }
  }, [paperHandle, paperDid, onSuccess, onError]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !isAuthenticating) {
        handleAuthenticate();
      }
    },
    [handleAuthenticate, isAuthenticating]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" />
          Paper Account Authentication Required
        </CardTitle>
        <CardDescription>
          This eprint is stored in a paper account PDS. To edit or delete it, you must authenticate
          as the paper account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertTitle>Paper DID</AlertTitle>
          <AlertDescription className="font-mono text-sm break-all">{paperDid}</AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="paper-handle">Paper Account Handle</Label>
          <Input
            id="paper-handle"
            type="text"
            placeholder="paper.example.com"
            value={paperHandle}
            onChange={(e) => setPaperHandle(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isAuthenticating}
            aria-describedby="paper-handle-description"
          />
          <p id="paper-handle-description" className="text-sm text-muted-foreground">
            Enter the ATProto handle for this paper account. This will open a popup window for you
            to sign in.
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Authentication Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button
          onClick={handleAuthenticate}
          disabled={isAuthenticating || !paperHandle.trim()}
          className="w-full"
        >
          {isAuthenticating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Authenticating...
            </>
          ) : (
            <>
              <KeyRound className="h-4 w-4 mr-2" />
              Authenticate as Paper Account
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
