'use client';

import * as React from 'react';
import { Check, ChevronRight, Link2, ExternalLink, Sparkles } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import {
  AuthorIdDiscovery,
  type AuthorIdDiscoveryProps,
} from '@/components/settings/author-id-discovery';

type WizardStep = 'start' | 'orcid' | 'discover' | 'complete';

interface LinkedIds {
  orcid?: string;
  openAlexId?: string;
  semanticScholarId?: string;
  dblpId?: string;
}

interface AccountLinkingWizardProps {
  /** User's display name for ID discovery */
  displayName?: string;
  /** Existing linked IDs */
  existingIds?: LinkedIds;
  /** Callback when IDs are linked */
  onComplete?: (ids: LinkedIds) => void;
  /** Callback to cancel */
  onCancel?: () => void;
  /** Additional class name */
  className?: string;
}

/**
 * Step indicator component.
 */
function StepIndicator({
  step,
  current,
  label,
  completed,
}: {
  step: number;
  current: number;
  label: string;
  completed: boolean;
}) {
  const isActive = step === current;
  const isPast = step < current || completed;

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors',
          isPast && 'border-primary bg-primary text-primary-foreground',
          isActive && !isPast && 'border-primary text-primary',
          !isActive && !isPast && 'border-muted-foreground/30 text-muted-foreground'
        )}
      >
        {isPast ? <Check className="h-4 w-4" /> : step}
      </div>
      <span
        className={cn(
          'text-sm',
          isActive ? 'font-medium' : 'text-muted-foreground',
          isPast && 'text-muted-foreground'
        )}
      >
        {label}
      </span>
    </div>
  );
}

/**
 * Account linking wizard for onboarding.
 *
 * @remarks
 * Guides users through linking their academic accounts (ORCID, OpenAlex, Semantic Scholar)
 * to enable personalized discovery features.
 */
export function AccountLinkingWizard({
  displayName = '',
  existingIds = {},
  onComplete,
  onCancel,
  className,
}: AccountLinkingWizardProps) {
  const [step, setStep] = React.useState<WizardStep>('start');
  const [linkedIds, setLinkedIds] = React.useState<LinkedIds>(existingIds);
  const [manualOrcid, setManualOrcid] = React.useState(existingIds.orcid ?? '');

  const handleOrcidNext = () => {
    if (manualOrcid.trim()) {
      setLinkedIds((prev) => ({ ...prev, orcid: manualOrcid.trim() }));
    }
    setStep('discover');
  };

  const handleDiscoverySelect: AuthorIdDiscoveryProps['onSelectIds'] = (ids) => {
    setLinkedIds((prev) => ({
      ...prev,
      openAlexId: ids.openAlexId ?? prev.openAlexId,
      semanticScholarId: ids.semanticScholarId ?? prev.semanticScholarId,
      dblpId: ids.dblpId ?? prev.dblpId,
      orcid: ids.orcid ?? prev.orcid,
    }));
  };

  const handleComplete = () => {
    setStep('complete');
    onComplete?.(linkedIds);
  };

  const hasAnyId = linkedIds.orcid || linkedIds.openAlexId || linkedIds.semanticScholarId;

  const currentStepNum = step === 'start' ? 1 : step === 'orcid' ? 2 : step === 'discover' ? 3 : 4;

  return (
    <Card className={cn('w-full max-w-2xl', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          Link Your Academic Accounts
        </CardTitle>
        <CardDescription>
          Connect your academic profiles to get personalized paper recommendations.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress Steps */}
        <div className="flex items-center justify-between border-b pb-4">
          <StepIndicator
            step={1}
            current={currentStepNum}
            label="Start"
            completed={currentStepNum > 1}
          />
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <StepIndicator
            step={2}
            current={currentStepNum}
            label="ORCID"
            completed={currentStepNum > 2 || !!linkedIds.orcid}
          />
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <StepIndicator
            step={3}
            current={currentStepNum}
            label="Discover"
            completed={
              currentStepNum > 3 || !!linkedIds.openAlexId || !!linkedIds.semanticScholarId
            }
          />
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <StepIndicator
            step={4}
            current={currentStepNum}
            label="Done"
            completed={step === 'complete'}
          />
        </div>

        {/* Step Content */}
        {step === 'start' && (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-4">
              <h3 className="font-medium flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4" />
                Why Link Your Accounts?
              </h3>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>
                  <strong>Personalized recommendations</strong> based on your research interests
                </li>
                <li>
                  <strong>Citation alerts</strong> when your work is referenced
                </li>
                <li>
                  <strong>Automatic paper matching</strong> for claiming preprints
                </li>
                <li>
                  <strong>Collaborator discovery</strong> to find related researchers
                </li>
              </ul>
            </div>

            <div className="flex justify-between pt-4">
              {onCancel && (
                <Button variant="ghost" onClick={onCancel}>
                  Skip for now
                </Button>
              )}
              <Button onClick={() => setStep('orcid')} className="ml-auto">
                Get Started
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 'orcid' && (
          <div className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">Connect Your ORCID</h3>
              <p className="text-sm text-muted-foreground mb-4">
                ORCID provides a unique identifier for researchers and helps us verify your
                authorship.
              </p>
            </div>

            <div className="space-y-4">
              {/* OAuth Button (placeholder for future implementation) */}
              <Button variant="outline" className="w-full justify-start h-auto py-3" disabled>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded bg-[#A6CE39] flex items-center justify-center text-white font-bold text-sm">
                    iD
                  </div>
                  <div className="text-left">
                    <div className="font-medium">Sign in with ORCID</div>
                    <div className="text-xs text-muted-foreground">Coming soon</div>
                  </div>
                </div>
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or enter manually
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="orcid">ORCID iD</Label>
                <div className="flex gap-2">
                  <Input
                    id="orcid"
                    value={manualOrcid}
                    onChange={(e) => setManualOrcid(e.target.value)}
                    placeholder="0000-0002-1825-0097"
                    pattern="\d{4}-\d{4}-\d{4}-\d{3}[\dX]"
                  />
                  <Button variant="outline" size="icon" asChild>
                    <a
                      href="https://orcid.org/signin"
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Find your ORCID"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Don&apos;t have an ORCID?{' '}
                  <a
                    href="https://orcid.org/register"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-foreground"
                  >
                    Create one for free
                  </a>
                </p>
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="ghost" onClick={() => setStep('start')}>
                Back
              </Button>
              <Button onClick={handleOrcidNext}>
                {manualOrcid.trim() ? 'Continue' : 'Skip ORCID'}
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 'discover' && (
          <div className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">Discover Your Author IDs</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Search academic databases to automatically find and link your author profiles.
              </p>
            </div>

            <AuthorIdDiscovery
              displayName={displayName}
              onSelectIds={handleDiscoverySelect}
              className="border-0 shadow-none p-0"
            />

            {/* Currently Linked IDs */}
            {hasAnyId && (
              <div className="rounded-lg bg-muted/50 p-4 mt-4">
                <h4 className="text-sm font-medium mb-2">Linked Accounts</h4>
                <div className="flex flex-wrap gap-2">
                  {linkedIds.orcid && (
                    <div className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                      <Check className="h-3 w-3" />
                      ORCID: {linkedIds.orcid}
                    </div>
                  )}
                  {linkedIds.openAlexId && (
                    <div className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                      <Check className="h-3 w-3" />
                      OpenAlex: {linkedIds.openAlexId}
                    </div>
                  )}
                  {linkedIds.semanticScholarId && (
                    <div className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                      <Check className="h-3 w-3" />
                      S2: {linkedIds.semanticScholarId}
                    </div>
                  )}
                  {linkedIds.dblpId && (
                    <div className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                      <Check className="h-3 w-3" />
                      DBLP
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-between pt-4">
              <Button variant="ghost" onClick={() => setStep('orcid')}>
                Back
              </Button>
              <Button onClick={handleComplete}>
                {hasAnyId ? 'Complete Setup' : 'Skip for Now'}
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 'complete' && (
          <div className="text-center space-y-4 py-6">
            <div className="mx-auto h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="font-medium text-lg">You&apos;re All Set!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {hasAnyId
                  ? 'Your academic accounts are linked. Check out your personalized recommendations!'
                  : 'You can link your accounts anytime from Settings.'}
              </p>
            </div>

            {hasAnyId && (
              <div className="flex flex-wrap justify-center gap-2">
                {linkedIds.orcid && (
                  <div className="text-xs px-2 py-1 rounded bg-muted">ORCID linked</div>
                )}
                {linkedIds.openAlexId && (
                  <div className="text-xs px-2 py-1 rounded bg-muted">OpenAlex linked</div>
                )}
                {linkedIds.semanticScholarId && (
                  <div className="text-xs px-2 py-1 rounded bg-muted">Semantic Scholar linked</div>
                )}
              </div>
            )}

            <Button onClick={() => onComplete?.(linkedIds)} className="mt-4">
              <Sparkles className="mr-2 h-4 w-4" />
              View Recommendations
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Account linking dialog trigger.
 *
 * @remarks
 * Wraps the wizard in a dialog for use in navigation or other contexts.
 */
export function AccountLinkingDialog({
  children,
  displayName,
  existingIds,
  onComplete,
}: {
  children: React.ReactNode;
  displayName?: string;
  existingIds?: LinkedIds;
  onComplete?: (ids: LinkedIds) => void;
}) {
  const [open, setOpen] = React.useState(false);

  const handleComplete = (ids: LinkedIds) => {
    onComplete?.(ids);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl p-0">
        <AccountLinkingWizard
          displayName={displayName}
          existingIds={existingIds}
          onComplete={handleComplete}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
