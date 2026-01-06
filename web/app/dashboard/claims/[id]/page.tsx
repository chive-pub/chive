'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Loader2, ExternalLink } from 'lucide-react';

import { useClaim, useCollectEvidence, useCompleteClaim } from '@/lib/hooks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { ClaimEvidenceType } from '@/lib/api/schema';

/**
 * Evidence authority options with descriptions.
 */
const EVIDENCE_AUTHORITIES: {
  type: ClaimEvidenceType;
  name: string;
  description: string;
  url: string;
}[] = [
  {
    type: 'orcid-match',
    name: 'ORCID',
    description: 'Connect your ORCID profile to verify authorship',
    url: 'https://orcid.org',
  },
  {
    type: 'semantic-scholar-match',
    name: 'Semantic Scholar',
    description: 'Verify through your Semantic Scholar author page',
    url: 'https://www.semanticscholar.org',
  },
  {
    type: 'openalex-match',
    name: 'OpenAlex',
    description: 'Verify through OpenAlex author records',
    url: 'https://openalex.org',
  },
  {
    type: 'openreview-match',
    name: 'OpenReview',
    description: 'Verify through your OpenReview profile',
    url: 'https://openreview.net',
  },
];

/**
 * Claim verification flow page.
 *
 * @remarks
 * Multi-step process to verify claim through external authorities.
 */
export default function ClaimDetailPage() {
  const params = useParams();
  const router = useRouter();
  const claimId = parseInt(params.id as string, 10);

  const { data: claim, isLoading } = useClaim(claimId);
  const collectEvidence = useCollectEvidence();
  const completeClaim = useCompleteClaim();

  const [selectedAuthorities, setSelectedAuthorities] = useState<ClaimEvidenceType[]>([
    'orcid-match',
  ]);
  const [step, setStep] = useState<'select' | 'collecting' | 'review' | 'complete'>('select');

  if (isLoading) {
    return <ClaimDetailSkeleton />;
  }

  if (!claim) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" asChild>
          <Link href="/dashboard/claims">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Claims
          </Link>
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Claim not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleToggleAuthority = (authority: ClaimEvidenceType) => {
    setSelectedAuthorities((prev) =>
      prev.includes(authority) ? prev.filter((a) => a !== authority) : [...prev, authority]
    );
  };

  const handleCollectEvidence = async () => {
    setStep('collecting');
    try {
      await collectEvidence.mutateAsync({
        claimId: claim.id,
        authorities: selectedAuthorities,
      });
      setStep('review');
    } catch {
      setStep('select');
    }
  };

  const handleCompleteClaim = async () => {
    // In a real implementation, this would create the canonical record first
    // For now, we'll just simulate completion
    const canonicalUri = `at://did:plc:example/pub.chive.preprint.submission/${Date.now()}`;
    try {
      await completeClaim.mutateAsync({
        claimId: claim.id,
        canonicalUri,
      });
      router.push('/dashboard/claims');
    } catch {
      // Error handling
    }
  };

  const hasEvidence = claim.evidence.length > 0;
  const currentStep = hasEvidence ? 'review' : step;

  return (
    <div className="space-y-6">
      <Button variant="ghost" asChild>
        <Link href="/dashboard/claims">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Claims
        </Link>
      </Button>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Verify Your Claim</h1>
        <p className="text-muted-foreground">
          Complete the verification steps to claim this preprint
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-4">
        <StepIndicator
          step={1}
          label="Select Authorities"
          isComplete={currentStep !== 'select'}
          isActive={currentStep === 'select'}
        />
        <div className="h-px flex-1 bg-border" />
        <StepIndicator
          step={2}
          label="Verify Identity"
          isComplete={currentStep === 'review' || currentStep === 'complete'}
          isActive={currentStep === 'collecting'}
        />
        <div className="h-px flex-1 bg-border" />
        <StepIndicator
          step={3}
          label="Complete Claim"
          isComplete={currentStep === 'complete'}
          isActive={currentStep === 'review'}
        />
      </div>

      {/* Step Content */}
      {currentStep === 'select' && (
        <Card>
          <CardHeader>
            <CardTitle>Select Verification Authorities</CardTitle>
            <CardDescription>
              Choose which services to use for verifying your authorship. More authorities provide
              stronger verification.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {EVIDENCE_AUTHORITIES.map((authority) => (
              <div
                key={authority.type}
                className="flex items-start space-x-4 rounded-lg border p-4"
              >
                <Checkbox
                  id={authority.type}
                  checked={selectedAuthorities.includes(authority.type)}
                  onCheckedChange={() => handleToggleAuthority(authority.type)}
                />
                <div className="flex-1 space-y-1">
                  <Label htmlFor={authority.type} className="text-base font-medium cursor-pointer">
                    {authority.name}
                  </Label>
                  <p className="text-sm text-muted-foreground">{authority.description}</p>
                </div>
                <a
                  href={authority.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            ))}

            <div className="pt-4">
              <Button onClick={handleCollectEvidence} disabled={selectedAuthorities.length === 0}>
                Collect Evidence
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 'collecting' && (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">
              Collecting evidence from {selectedAuthorities.length} authorities...
            </p>
            <p className="text-sm text-muted-foreground">This may take a few moments</p>
          </CardContent>
        </Card>
      )}

      {currentStep === 'review' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Verification Results</CardTitle>
              <CardDescription>Evidence collected from external authorities</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {claim.evidence.map((evidence, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-1">
                    <p className="font-medium capitalize">{evidence.type.replace('_', ' ')}</p>
                    <p className="text-sm text-muted-foreground">{evidence.details}</p>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant={
                        evidence.score >= 0.7
                          ? 'default'
                          : evidence.score >= 0.4
                            ? 'secondary'
                            : 'outline'
                      }
                    >
                      {Math.round(evidence.score * 100)}% match
                    </Badge>
                  </div>
                </div>
              ))}

              <div className="border-t pt-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium">Overall Verification Score</p>
                  <p className="text-2xl font-bold">{Math.round(claim.verificationScore * 100)}%</p>
                </div>
                {claim.verificationScore >= 0.6 ? (
                  <p className="text-sm text-green-600 mt-1">
                    Score is sufficient for automatic approval
                  </p>
                ) : (
                  <p className="text-sm text-yellow-600 mt-1">
                    Low score - claim will require manual review
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Complete Your Claim</CardTitle>
              <CardDescription>
                Finalize the claim to create your official preprint record on Chive
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                By completing this claim, you confirm that you are the author of this work and agree
                to Chive&apos;s terms of service.
              </p>
              <Button onClick={handleCompleteClaim} disabled={completeClaim.isPending}>
                {completeClaim.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Complete Claim
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

/**
 * Step indicator component.
 */
function StepIndicator({
  step,
  label,
  isComplete,
  isActive,
}: {
  step: number;
  label: string;
  isComplete: boolean;
  isActive: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`
          flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium
          ${
            isComplete
              ? 'bg-primary text-primary-foreground'
              : isActive
                ? 'border-2 border-primary text-primary'
                : 'border-2 border-muted text-muted-foreground'
          }
        `}
      >
        {isComplete ? <CheckCircle2 className="h-4 w-4" /> : step}
      </div>
      <span
        className={`text-sm ${isActive || isComplete ? 'text-foreground' : 'text-muted-foreground'}`}
      >
        {label}
      </span>
    </div>
  );
}

function ClaimDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-32" />
      <div>
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-96 mt-2" />
      </div>
      <div className="flex items-center gap-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-px flex-1" />
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-px flex-1" />
        <Skeleton className="h-8 w-40" />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
