'use client';

/**
 * Review step for preprint submission.
 *
 * @remarks
 * Step 5 (final) of the submission wizard. Shows:
 * - Summary of all entered information
 * - Final confirmation before submission
 * - Submission status and errors
 *
 * @packageDocumentation
 */

import { UseFormReturn } from 'react-hook-form';
import { FileText, User, Network, BookOpen, AlertCircle, CheckCircle2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import type { PreprintFormValues } from './submission-wizard';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for StepReview component.
 */
export interface StepReviewProps {
  /** React Hook Form instance */
  form: UseFormReturn<PreprintFormValues>;
  /** Whether submission is in progress */
  isSubmitting?: boolean;
  /** Submission error message */
  submitError?: string | null;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

interface ReviewSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function ReviewSection({ title, icon, children }: ReviewSectionProps) {
  return (
    <section className="space-y-3">
      <h4 className="font-medium flex items-center gap-2">
        {icon}
        {title}
      </h4>
      <div className="rounded-lg border bg-card p-4">{children}</div>
    </section>
  );
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Review and submit step component.
 *
 * @param props - Component props
 * @returns Review step element
 */
/**
 * Format display labels.
 */
const FORMAT_LABELS: Record<string, string> = {
  pdf: 'PDF',
  docx: 'Word Document',
  html: 'HTML',
  markdown: 'Markdown',
  latex: 'LaTeX',
  jupyter: 'Jupyter Notebook',
  odt: 'OpenDocument',
  rtf: 'Rich Text',
  epub: 'EPUB',
  txt: 'Plain Text',
};

export function StepReview({
  form,
  isSubmitting: _isSubmitting,
  submitError,
  className,
}: StepReviewProps) {
  const values = form.getValues();

  const {
    documentFile,
    documentFormat,
    supplementaryFiles = [],
    title,
    abstract,
    keywords = [],
    license,
    authors = [],
    fieldNodes = [],
  } = values;

  // Format file size for display
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Check if form is valid
  const errors = Object.keys(form.formState.errors);

  return (
    <div className={cn('space-y-6', className)} data-testid="preview-step">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold">Review Your Submission</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Please review all information before submitting. Your preprint will be stored in your
          Personal Data Server (PDS) and indexed by Chive.
        </p>
      </div>

      {/* Validation status */}
      {errors.length > 0 ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Missing Required Information</AlertTitle>
          <AlertDescription>
            Please complete all required fields before submitting.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <AlertTitle>Ready to Submit</AlertTitle>
          <AlertDescription>
            All required information has been provided. Review and click Submit.
          </AlertDescription>
        </Alert>
      )}

      {/* Submission error */}
      {submitError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Submission Failed</AlertTitle>
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      {/* Files Section */}
      <ReviewSection title="Files" icon={<FileText className="h-4 w-4" />}>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">Primary Document</span>
            {documentFile ? (
              <span className="text-sm font-medium">
                {documentFile.name} ({formatSize(documentFile.size)})
                {documentFormat && (
                  <Badge variant="secondary" className="ml-2">
                    {FORMAT_LABELS[documentFormat] ?? documentFormat.toUpperCase()}
                  </Badge>
                )}
              </span>
            ) : (
              <span className="text-sm text-destructive">Not uploaded</span>
            )}
          </div>
          {supplementaryFiles.length > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm">Supplementary Files</span>
              <span className="text-sm">{supplementaryFiles.length} files</span>
            </div>
          )}
        </div>
      </ReviewSection>

      {/* Metadata Section */}
      <ReviewSection title="Metadata" icon={<BookOpen className="h-4 w-4" />}>
        <div className="space-y-4">
          <div>
            <span className="text-xs uppercase text-muted-foreground">Title</span>
            <p className="font-medium">
              {title || <em className="text-destructive">Not provided</em>}
            </p>
          </div>

          <Separator />

          <div>
            <span className="text-xs uppercase text-muted-foreground">Abstract</span>
            <p className="text-sm line-clamp-4">
              {abstract || <em className="text-destructive">Not provided</em>}
            </p>
            {abstract && abstract.length > 300 && (
              <p className="text-xs text-muted-foreground mt-1">{abstract.length} characters</p>
            )}
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <span className="text-xs uppercase text-muted-foreground">License</span>
            <Badge variant="secondary">{license || 'Not selected'}</Badge>
          </div>

          {keywords.length > 0 && (
            <>
              <Separator />
              <div>
                <span className="text-xs uppercase text-muted-foreground">Keywords</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {keywords.map((kw) => (
                    <Badge key={kw} variant="outline" className="text-xs">
                      {kw}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </ReviewSection>

      {/* Authors Section */}
      <ReviewSection title="Authors" icon={<User className="h-4 w-4" />}>
        {authors.length > 0 ? (
          <div className="space-y-2">
            {authors.map((author, index) => (
              <div key={author.did} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {author.name || author.handle || author.did}
                  </span>
                  {index === 0 && (
                    <Badge variant="secondary" className="text-xs">
                      Primary
                    </Badge>
                  )}
                </div>
                {author.orcid && (
                  <span className="text-xs text-muted-foreground">ORCID: {author.orcid}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-destructive">No authors added</p>
        )}
      </ReviewSection>

      {/* Fields Section */}
      <ReviewSection title="Research Fields" icon={<Network className="h-4 w-4" />}>
        {fieldNodes.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {fieldNodes.map((field) => (
              <Badge key={field.id} variant="outline">
                {field.name}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-destructive">No fields selected</p>
        )}
      </ReviewSection>

      {/* Submission notice */}
      <section className="rounded-lg border border-muted bg-muted/30 p-4">
        <h4 className="font-medium mb-2">What Happens Next</h4>
        <ul className="text-sm text-muted-foreground space-y-1 list-inside list-disc">
          <li>Your document will be uploaded to your Personal Data Server (PDS)</li>
          <li>A preprint record will be created in your PDS repository</li>
          <li>Chive will extract and index the text for full-text search</li>
          <li>Your preprint will appear in search and browse results</li>
          <li>You can update or version your preprint at any time</li>
        </ul>
      </section>
    </div>
  );
}
