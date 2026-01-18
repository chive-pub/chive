'use client';

/**
 * Destination selection step for eprint submission.
 *
 * @remarks
 * Allows users to choose where to submit their eprint:
 * - User's own PDS (default)
 * - Paper's own PDS (requires paper account authentication)
 *
 * Paper PDS submission enables papers as first-class ATProto citizens
 * with their own data sovereignty.
 *
 * @packageDocumentation
 */

import { useState, useCallback, useEffect } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { CheckCircle2, Loader2, User, FileText, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth/auth-context';
import {
  authenticatePaperInPopup,
  isPaperAuthInProgress,
  cancelPaperAuthentication,
} from '@/lib/auth/paper-oauth-popup';
import {
  getActivePaperSession,
  clearPaperSession,
  type PaperSession,
} from '@/lib/auth/paper-session';
import type { EprintFormValues } from './submission-wizard';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for StepDestination component.
 */
export interface StepDestinationProps {
  /** React Hook Form instance */
  form: UseFormReturn<EprintFormValues>;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Destination selection step component.
 *
 * @param props - Component props
 * @returns Destination selection step element
 */
export function StepDestination({ form, className }: StepDestinationProps) {
  const { user } = useAuth();

  // Form values
  const usePaperPds = form.watch('usePaperPds') ?? false;

  // Local state
  const [destination, setDestination] = useState<'user' | 'paper'>(usePaperPds ? 'paper' : 'user');
  const [paperHandle, setPaperHandle] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [paperSession, setPaperSessionState] = useState<PaperSession | null>(getActivePaperSession);

  // Sync destination state with form value
  useEffect(() => {
    if (usePaperPds !== (destination === 'paper')) {
      setDestination(usePaperPds ? 'paper' : 'user');
    }
  }, [usePaperPds, destination]);

  // Check for existing paper session on mount
  useEffect(() => {
    const existing = getActivePaperSession();
    if (existing) {
      setPaperSessionState(existing);
      setPaperHandle(existing.paperHandle);
    }
  }, []);

  // Handle destination change
  const handleDestinationChange = useCallback(
    (value: string) => {
      const newDest = value as 'user' | 'paper';
      setDestination(newDest);
      setAuthError(null);

      if (newDest === 'user') {
        // Clear paper session state
        form.setValue('usePaperPds', false, { shouldValidate: true });
        form.setValue('paperDid', undefined, { shouldValidate: true });
        clearPaperSession();
        setPaperSessionState(null);
      } else {
        form.setValue('usePaperPds', true, { shouldValidate: true });
        // paperDid will be set after successful authentication
      }
    },
    [form]
  );

  // Handle paper account authentication
  const handleAuthenticatePaper = useCallback(async () => {
    if (!paperHandle.trim()) {
      setAuthError('Please enter a paper handle');
      return;
    }

    // Prevent multiple concurrent auth attempts
    if (isPaperAuthInProgress()) {
      return;
    }

    setIsAuthenticating(true);
    setAuthError(null);

    try {
      const session = await authenticatePaperInPopup(paperHandle.trim());
      setPaperSessionState(session);
      form.setValue('paperDid', session.paperDid, { shouldValidate: true });
      form.setValue('usePaperPds', true, { shouldValidate: true });
    } catch (error) {
      console.error('Paper authentication failed:', error);
      setAuthError(error instanceof Error ? error.message : 'Authentication failed');
    } finally {
      setIsAuthenticating(false);
    }
  }, [paperHandle, form]);

  // Handle clearing paper session
  const handleClearPaperSession = useCallback(() => {
    if (isPaperAuthInProgress()) {
      cancelPaperAuthentication();
    }
    clearPaperSession();
    setPaperSessionState(null);
    form.setValue('paperDid', undefined, { shouldValidate: true });
    setPaperHandle('');
    setAuthError(null);
  }, [form]);

  return (
    <div className={cn('space-y-8', className)}>
      {/* Destination Selection */}
      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Submission Destination</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Choose where to store your eprint. By default, eprints are stored in your personal AT
            Protocol repository. Alternatively, you can submit to a paper&apos;s own repository if
            the paper has its own ATProto account.
          </p>
        </div>

        <RadioGroup
          value={destination}
          onValueChange={handleDestinationChange}
          className="space-y-4"
        >
          {/* Option 1: User's PDS */}
          <div
            className={cn(
              'flex items-start space-x-3 rounded-lg border p-4 transition-colors',
              destination === 'user'
                ? 'border-primary bg-primary/5'
                : 'border-muted hover:border-muted-foreground/50'
            )}
          >
            <RadioGroupItem value="user" id="dest-user" className="mt-1" />
            <div className="flex-1 space-y-1">
              <Label htmlFor="dest-user" className="flex items-center gap-2 cursor-pointer">
                <User className="h-4 w-4" />
                Submit to my repository
                <span className="text-xs text-muted-foreground font-normal">(Recommended)</span>
              </Label>
              <p className="text-sm text-muted-foreground">
                The eprint will be stored in your personal AT Protocol repository. You maintain full
                control and ownership of the record.
              </p>
              {destination === 'user' && user && (
                <div className="pt-2">
                  <p className="text-sm text-muted-foreground">
                    Will be submitted as:{' '}
                    <span className="font-medium text-foreground">@{user.handle}</span>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Option 2: Paper's PDS */}
          <div
            className={cn(
              'flex items-start space-x-3 rounded-lg border p-4 transition-colors',
              destination === 'paper'
                ? 'border-primary bg-primary/5'
                : 'border-muted hover:border-muted-foreground/50'
            )}
          >
            <RadioGroupItem value="paper" id="dest-paper" className="mt-1" />
            <div className="flex-1 space-y-1">
              <Label htmlFor="dest-paper" className="flex items-center gap-2 cursor-pointer">
                <FileText className="h-4 w-4" />
                Submit to paper&apos;s repository
              </Label>
              <p className="text-sm text-muted-foreground">
                The eprint will be stored in the paper&apos;s own AT Protocol repository. The paper
                becomes a first-class citizen with its own data sovereignty.
              </p>
            </div>
          </div>
        </RadioGroup>
      </section>

      {/* Paper Authentication (shown when paper destination selected) */}
      {destination === 'paper' && (
        <section className="space-y-4 pl-7">
          <div>
            <h4 className="font-medium">Paper Account Authentication</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Enter the paper&apos;s AT Protocol handle and authenticate to grant submission access.
              You&apos;ll need the paper account credentials.
            </p>
          </div>

          {paperSession ? (
            // Authenticated state
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-green-700 dark:text-green-400">
                    Authenticated as @{paperSession.paperHandle}
                  </p>
                  <p className="text-sm text-muted-foreground">PDS: {paperSession.pdsEndpoint}</p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={handleClearPaperSession}>
                  Change
                </Button>
              </div>
            </div>
          ) : (
            // Unauthenticated state
            <div className="space-y-4">
              <div className="flex gap-3">
                <Input
                  placeholder="paper-handle.bsky.social"
                  value={paperHandle}
                  onChange={(e) => {
                    setPaperHandle(e.target.value);
                    setAuthError(null);
                  }}
                  disabled={isAuthenticating}
                  className="flex-1"
                />
                <Button
                  type="button"
                  onClick={handleAuthenticatePaper}
                  disabled={!paperHandle.trim() || isAuthenticating}
                >
                  {isAuthenticating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Authenticating...
                    </>
                  ) : (
                    'Authenticate'
                  )}
                </Button>
              </div>

              {authError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{authError}</AlertDescription>
                </Alert>
              )}

              <p className="text-xs text-muted-foreground">
                A popup window will open for you to log in with the paper account&apos;s
                credentials. Make sure popups are allowed for this site.
              </p>
            </div>
          )}
        </section>
      )}

      {/* Information Box */}
      <section className="rounded-lg border border-muted bg-muted/30 p-4">
        <h4 className="font-medium mb-2">About Paper Repositories</h4>
        <ul className="text-sm text-muted-foreground space-y-2 list-inside list-disc">
          <li>
            Papers can have their own AT Protocol accounts, giving them data sovereignty independent
            of any single author.
          </li>
          <li>
            The <code className="text-xs bg-muted px-1 rounded">submittedBy</code> field always
            records who submitted the eprint (you), regardless of which repository stores it.
          </li>
          <li>
            Multiple authors can be granted access to a paper&apos;s account to manage updates.
          </li>
          <li>
            If you don&apos;t have a paper account yet, submit to your personal repository for now.
          </li>
        </ul>
      </section>
    </div>
  );
}
