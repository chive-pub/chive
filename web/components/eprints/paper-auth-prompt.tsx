'use client';

/**
 * Prompt for paper account authentication.
 *
 * @remarks
 * Displays a prompt to authenticate as a paper account for editing
 * or deleting paper-centric eprints. Uses OAuth popup for authentication.
 *
 * @packageDocumentation
 */

import { KeyRound, Loader2 } from 'lucide-react';
import { useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleAuthenticate = async () => {
    setIsAuthenticating(true);
    try {
      // In a real implementation, this would open an OAuth popup
      // for the paper account and handle the callback
      // For now, we simulate the flow

      // TODO: Implement actual OAuth popup flow for paper account
      // const session = await authenticatePaperInPopup(paperDid);
      // if (session) onSuccess(session);

      // Simulate delay for demo purposes
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // For now, just call onSuccess
      // In production, this should be called after successful OAuth
      console.warn('Paper account authentication not yet implemented');
      onSuccess();
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error('Authentication failed'));
    } finally {
      setIsAuthenticating(false);
    }
  };

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
        <p className="text-sm text-muted-foreground">
          Click the button below to authenticate as the paper account. This will open a popup window
          for you to sign in.
        </p>
        <Button onClick={handleAuthenticate} disabled={isAuthenticating} className="w-full">
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
