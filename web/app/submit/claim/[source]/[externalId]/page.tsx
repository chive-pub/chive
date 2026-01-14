'use client';

/**
 * Import submission page.
 *
 * @remarks
 * Imports an external paper by rendering the submission wizard with prefilled data.
 * This enables importing from external sources like arXiv, with fields prefilled
 * from the external source.
 *
 * Route: /submit/claim/[source]/[externalId]
 * Example: /submit/claim/arxiv/2301.12345
 *
 * @packageDocumentation
 */

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, ExternalLink, Users, Loader2 } from 'lucide-react';

import { useSubmissionData, useExternalPdf, type SubmissionData } from '@/lib/hooks/use-claiming';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { SubmissionWizard, type PrefilledData } from '@/components/submit/submission-wizard';

/**
 * Loading skeleton for the import page.
 */
function ImportPageSkeleton() {
  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <Skeleton className="h-10 w-32" />
      <div>
        <Skeleton className="h-9 w-96" />
        <Skeleton className="h-5 w-64 mt-2" />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-10 w-32" />
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Error state for the import page.
 */
function ImportPageError({ message }: { message: string }) {
  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <Button variant="ghost" asChild>
        <Link href="/dashboard/claims">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Import
        </Link>
      </Button>

      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    </div>
  );
}

/**
 * Duplicate paper warning component.
 */
function DuplicateWarning({
  existingPaper,
}: {
  existingPaper: NonNullable<SubmissionData['existingChivePaper']>;
}) {
  return (
    <Alert>
      <Users className="h-4 w-4" />
      <AlertTitle>This paper already exists on Chive</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>
          <strong>{existingPaper.title}</strong> was imported by{' '}
          {existingPaper.authors[0]?.name ?? 'another user'} on{' '}
          {new Date(existingPaper.createdAt).toLocaleDateString()}.
        </p>
        <div className="flex gap-2 mt-3">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/eprints/${encodeURIComponent(existingPaper.uri)}`}>
              <ExternalLink className="mr-2 h-4 w-4" />
              View existing paper
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/claim/coauthor/${encodeURIComponent(existingPaper.uri)}`}>
              <Users className="mr-2 h-4 w-4" />
              Request co-authorship
            </Link>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          You can still import this paper separately if you prefer to have your own record.
        </p>
      </AlertDescription>
    </Alert>
  );
}

/**
 * Paper preview card shown before the wizard.
 */
function PaperPreview({
  submissionData,
  onContinue,
}: {
  submissionData: SubmissionData;
  onContinue: () => void;
}) {
  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <Button variant="ghost" asChild>
        <Link href="/dashboard/claims">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Import
        </Link>
      </Button>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Import This Paper</h1>
        <p className="text-muted-foreground">
          Review the paper details and continue to add it to your collection
        </p>
      </div>

      {submissionData.existingChivePaper && (
        <DuplicateWarning existingPaper={submissionData.existingChivePaper} />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{submissionData.title}</CardTitle>
          <CardDescription className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium capitalize">{submissionData.source}</span>
              <span className="text-muted-foreground">•</span>
              <span>{submissionData.externalId}</span>
              {submissionData.doi && (
                <>
                  <span className="text-muted-foreground">•</span>
                  <span>DOI: {submissionData.doi}</span>
                </>
              )}
            </div>
            <div>
              {submissionData.authors.map((a, i) => (
                <span key={i}>
                  {i > 0 && ', '}
                  {a.name}
                </span>
              ))}
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {submissionData.abstract && (
            <div className="text-sm text-muted-foreground line-clamp-4">
              {submissionData.abstract}
            </div>
          )}

          <div className="flex items-center gap-4">
            <Button onClick={onContinue}>Continue to Submission</Button>
            <Button variant="outline" asChild>
              <a href={submissionData.externalUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                View on {submissionData.source}
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Transforms API submission data to wizard prefilled data format.
 */
function transformToPrefilledData(data: SubmissionData, documentFile?: File): PrefilledData {
  return {
    title: data.title,
    abstract: data.abstract,
    authors: data.authors,
    keywords: data.keywords,
    doi: data.doi,
    pdfUrl: data.pdfUrl,
    documentFile,
    source: data.source,
    externalId: data.externalId,
    externalUrl: data.externalUrl,
    publicationDate: data.publicationDate,
    externalIds: data.externalIds,
  };
}

/**
 * Main import submission page component.
 */
export default function ImportSubmitPage() {
  const params = useParams();
  const router = useRouter();

  const source = params.source as string;
  const externalId = params.externalId as string;

  const { data: submissionData, isLoading, error } = useSubmissionData(source, externalId);

  // Track whether user has confirmed and is in wizard mode
  const [showWizard, setShowWizard] = useState(false);

  // Fetch the PDF when user confirms and enters wizard mode
  // Only fetch if pdfUrl is available
  const {
    data: pdfFile,
    isLoading: isPdfLoading,
    error: pdfError,
  } = useExternalPdf(source, externalId, {
    enabled: showWizard && !!submissionData?.pdfUrl,
  });

  if (isLoading) {
    return <ImportPageSkeleton />;
  }

  if (error) {
    return <ImportPageError message={error.message} />;
  }

  if (!submissionData) {
    return <ImportPageError message="Paper not found" />;
  }

  // Show preview first, then wizard after confirmation
  if (!showWizard) {
    return <PaperPreview submissionData={submissionData} onContinue={() => setShowWizard(true)} />;
  }

  // Show loading state while fetching PDF
  if (isPdfLoading && submissionData.pdfUrl) {
    return (
      <div className="container max-w-4xl py-8 space-y-6">
        <Button variant="ghost" onClick={() => setShowWizard(false)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Preview
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Fetching PDF
            </CardTitle>
            <CardDescription>Downloading the paper PDF from {source}...</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This may take a moment depending on the file size.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show warning if PDF fetch failed (but allow proceeding)
  const pdfFetchFailed = pdfError && submissionData.pdfUrl;

  // Render the submission wizard with prefilled data
  return (
    <div className="container max-w-5xl py-8 space-y-6">
      <Button variant="ghost" onClick={() => setShowWizard(false)}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Preview
      </Button>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Import Paper</h1>
        <p className="text-muted-foreground">
          Complete the submission wizard to add this paper to your collection
        </p>
      </div>

      {pdfFetchFailed && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>PDF Download Failed</AlertTitle>
          <AlertDescription>
            Could not fetch the PDF from {source}. You can still proceed and upload the PDF
            manually.
          </AlertDescription>
        </Alert>
      )}

      <SubmissionWizard
        prefilled={transformToPrefilledData(submissionData, pdfFile)}
        isClaimMode={true}
        onSuccess={(result) => router.push(`/eprints/${encodeURIComponent(result.uri)}`)}
        onCancel={() => setShowWizard(false)}
      />
    </div>
  );
}
