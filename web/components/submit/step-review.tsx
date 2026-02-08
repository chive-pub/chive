'use client';

/**
 * Review step for eprint submission.
 *
 * @remarks
 * Step 5 (final) of the submission wizard. Shows:
 * - Summary of all entered information
 * - Final confirmation before submission
 * - Submission status and errors
 *
 * @packageDocumentation
 */

import { useCallback } from 'react';
import { UseFormReturn } from 'react-hook-form';
import {
  FileText,
  User,
  Network,
  BookOpen,
  AlertCircle,
  CheckCircle2,
  Download,
  ExternalLink,
  Mail,
  Star,
  Building,
  Code,
  Database,
  DollarSign,
  Calendar,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { EprintFormValues } from './submission-wizard';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for StepReview component.
 */
export interface StepReviewProps {
  /** React Hook Form instance */
  form: UseFormReturn<EprintFormValues>;
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
    supplementaryMaterials = [],
    title,
    abstract,
    keywords = [],
    licenseSlug,
    authors = [],
    fieldNodes = [],
    publicationStatus,
    publishedVersion,
    externalIds,
    codeRepositories = [],
    dataRepositories = [],
    preregistration,
    funding = [],
    conferencePresentation,
  } = values;

  // Format file size for display
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Download file handler
  const handleDownload = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  // Check if form is valid
  const errors = Object.keys(form.formState.errors);

  // Check if we have publication metadata
  const hasPublicationInfo =
    publishedVersion?.doi ||
    publishedVersion?.journal ||
    externalIds?.arxivId ||
    externalIds?.pmid ||
    codeRepositories.some((r) => r.url) ||
    dataRepositories.some((r) => r.url) ||
    preregistration?.url ||
    funding?.some((f) => f.funderName) ||
    conferencePresentation?.conferenceName;

  return (
    <div className={cn('space-y-6', className)} data-testid="preview-step">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold">Review Your Submission</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Please review all information before submitting. Your eprint will be stored in your
          Personal Data Server (PDS) and indexed by Chive.
        </p>
      </div>

      {/* Validation status */}
      {errors.length > 0 ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Missing Required Information</AlertTitle>
          <AlertDescription>
            <p>Please complete all required fields before submitting.</p>
            <ul className="mt-2 list-disc list-inside text-sm">
              {errors.map((field) => (
                <li key={field} className="capitalize">
                  {field.replace(/([A-Z])/g, ' $1').trim()}
                </li>
              ))}
            </ul>
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
        <div className="space-y-4">
          {/* Primary Document */}
          <div>
            <span className="text-xs uppercase text-muted-foreground">Primary Document</span>
            {documentFile ? (
              <div className="flex items-center justify-between mt-1">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{documentFile.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({formatSize(documentFile.size)})
                  </span>
                  {documentFormat && (
                    <Badge variant="secondary" className="text-xs">
                      {FORMAT_LABELS[documentFormat] ?? documentFormat.toUpperCase()}
                    </Badge>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(documentFile)}
                  className="gap-1"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </Button>
              </div>
            ) : (
              <p className="text-sm text-destructive mt-1">Not uploaded</p>
            )}
          </div>

          {/* Supplementary Materials */}
          {supplementaryMaterials.length > 0 && (
            <>
              <Separator />
              <div>
                <span className="text-xs uppercase text-muted-foreground">
                  Supplementary Materials ({supplementaryMaterials.length})
                </span>
                <div className="space-y-2 mt-2">
                  {supplementaryMaterials.map((material, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-md border p-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{material.label}</span>
                            <Badge variant="outline" className="text-xs shrink-0">
                              {material.category}
                            </Badge>
                          </div>
                          {material.description && (
                            <p className="text-xs text-muted-foreground truncate">
                              {material.description}
                            </p>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {material.file.name} ({formatSize(material.file.size)})
                          </span>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(material.file)}
                        className="shrink-0"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </>
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
            <Badge variant="secondary">{licenseSlug || 'Not selected'}</Badge>
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
          <div className="space-y-3">
            {authors.map((author, index) => (
              <div
                key={author.did ?? `author-${index}`}
                className={cn(
                  'rounded-md border p-3',
                  author.isHighlighted && 'border-primary/50 bg-primary/5'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    {/* Name and badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{author.name}</span>
                      {author.isCorrespondingAuthor && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Mail className="h-3 w-3" />
                          Corresponding
                        </Badge>
                      )}
                      {author.isHighlighted && (
                        <Badge variant="default" className="text-xs gap-1">
                          <Star className="h-3 w-3" />
                          Co-First
                        </Badge>
                      )}
                      {!author.did && (
                        <Badge variant="outline" className="text-xs">
                          External
                        </Badge>
                      )}
                    </div>

                    {/* Handle/DID */}
                    {author.handle && (
                      <p className="text-xs text-muted-foreground">@{author.handle}</p>
                    )}

                    {/* ORCID */}
                    {author.orcid && (
                      <a
                        href={`https://orcid.org/${author.orcid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        ORCID: {author.orcid}
                      </a>
                    )}

                    {/* Email */}
                    {author.email && (
                      <p className="text-xs text-muted-foreground">{author.email}</p>
                    )}

                    {/* Affiliations */}
                    {author.affiliations && author.affiliations.length > 0 && (
                      <div className="flex items-start gap-1 text-xs text-muted-foreground">
                        <Building className="h-3 w-3 mt-0.5 shrink-0" />
                        <span>{author.affiliations.map((aff) => aff.name).join('; ')}</span>
                      </div>
                    )}

                    {/* Contributions */}
                    {author.contributions && author.contributions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {author.contributions.map((contrib, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {contrib.typeLabel || contrib.typeId} ({contrib.degree})
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Order number */}
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium shrink-0">
                    {index + 1}
                  </div>
                </div>
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
              <Badge key={field.uri} variant="outline">
                {field.label}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-destructive">No fields selected</p>
        )}
      </ReviewSection>

      {/* Publication Metadata Section */}
      {hasPublicationInfo && (
        <ReviewSection title="Publication & Links" icon={<ExternalLink className="h-4 w-4" />}>
          <div className="space-y-4">
            {/* Publication Status */}
            {publicationStatus && publicationStatus !== 'eprint' && (
              <div>
                <span className="text-xs uppercase text-muted-foreground">Status</span>
                <Badge variant="secondary" className="ml-2 capitalize">
                  {publicationStatus.replace('_', ' ')}
                </Badge>
              </div>
            )}

            {/* Published Version */}
            {(publishedVersion?.doi || publishedVersion?.journal) && (
              <div>
                <span className="text-xs uppercase text-muted-foreground">Published Version</span>
                <div className="mt-1 space-y-1">
                  {publishedVersion.doi && (
                    <a
                      href={`https://doi.org/${publishedVersion.doi}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      DOI: {publishedVersion.doi}
                    </a>
                  )}
                  {publishedVersion.journal && (
                    <p className="text-sm">{publishedVersion.journal}</p>
                  )}
                  {publishedVersion.publisher && (
                    <p className="text-xs text-muted-foreground">{publishedVersion.publisher}</p>
                  )}
                </div>
              </div>
            )}

            {/* External IDs */}
            {(externalIds?.arxivId || externalIds?.pmid || externalIds?.ssrnId) && (
              <>
                <Separator />
                <div>
                  <span className="text-xs uppercase text-muted-foreground">External IDs</span>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {externalIds.arxivId && (
                      <a
                        href={`https://arxiv.org/abs/${externalIds.arxivId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm hover:underline"
                      >
                        <Badge variant="outline">arXiv: {externalIds.arxivId}</Badge>
                      </a>
                    )}
                    {externalIds.pmid && (
                      <a
                        href={`https://pubmed.ncbi.nlm.nih.gov/${externalIds.pmid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm hover:underline"
                      >
                        <Badge variant="outline">PubMed: {externalIds.pmid}</Badge>
                      </a>
                    )}
                    {externalIds.ssrnId && (
                      <Badge variant="outline">SSRN: {externalIds.ssrnId}</Badge>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Code Repositories */}
            {codeRepositories.some((r) => r.url) && (
              <>
                <Separator />
                <div>
                  <span className="text-xs uppercase text-muted-foreground flex items-center gap-1">
                    <Code className="h-3 w-3" />
                    Code Repositories
                  </span>
                  <div className="mt-1 space-y-1">
                    {codeRepositories
                      .filter((r) => r.url)
                      .map((repo, i) => (
                        <a
                          key={i}
                          href={repo.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-primary hover:underline"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          {repo.label || repo.platformName || repo.url}
                        </a>
                      ))}
                  </div>
                </div>
              </>
            )}

            {/* Data Repositories */}
            {dataRepositories.some((r) => r.url) && (
              <>
                <Separator />
                <div>
                  <span className="text-xs uppercase text-muted-foreground flex items-center gap-1">
                    <Database className="h-3 w-3" />
                    Data Repositories
                  </span>
                  <div className="mt-1 space-y-1">
                    {dataRepositories
                      .filter((r) => r.url)
                      .map((repo, i) => (
                        <a
                          key={i}
                          href={repo.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-primary hover:underline"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          {repo.label || repo.platformName || repo.url}
                        </a>
                      ))}
                  </div>
                </div>
              </>
            )}

            {/* Pre-registration */}
            {preregistration?.url && (
              <>
                <Separator />
                <div>
                  <span className="text-xs uppercase text-muted-foreground">Pre-registration</span>
                  <a
                    href={preregistration.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 mt-1 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {preregistration.platformName || preregistration.url}
                  </a>
                </div>
              </>
            )}

            {/* Funding */}
            {funding?.some((f) => f.funderName) && (
              <>
                <Separator />
                <div>
                  <span className="text-xs uppercase text-muted-foreground flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    Funding
                  </span>
                  <div className="mt-1 space-y-1">
                    {funding
                      .filter((f) => f.funderName)
                      .map((f, i) => (
                        <p key={i} className="text-sm">
                          {f.funderName}
                          {f.grantNumber && (
                            <span className="text-muted-foreground"> ({f.grantNumber})</span>
                          )}
                        </p>
                      ))}
                  </div>
                </div>
              </>
            )}

            {/* Conference */}
            {conferencePresentation?.conferenceName && (
              <>
                <Separator />
                <div>
                  <span className="text-xs uppercase text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Conference Presentation
                  </span>
                  <div className="mt-1">
                    <p className="text-sm font-medium">
                      {conferencePresentation.conferenceName}
                      {conferencePresentation.conferenceIteration && (
                        <span className="text-muted-foreground">
                          {' '}
                          ({conferencePresentation.conferenceIteration})
                        </span>
                      )}
                    </p>
                    {conferencePresentation.conferenceLocation && (
                      <p className="text-xs text-muted-foreground">
                        {conferencePresentation.conferenceLocation}
                      </p>
                    )}
                    {conferencePresentation.presentationDate && (
                      <p className="text-xs text-muted-foreground">
                        {new Date(conferencePresentation.presentationDate).toLocaleDateString()}
                      </p>
                    )}
                    {conferencePresentation.presentationTypeName && (
                      <Badge variant="outline" className="text-xs mt-1 capitalize">
                        {conferencePresentation.presentationTypeName}
                      </Badge>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </ReviewSection>
      )}

      {/* Cross-Platform Discovery Option */}
      <section className="rounded-lg border border-muted bg-muted/30 p-4">
        <div className="flex items-start space-x-3">
          <Checkbox
            id="enableCrossPlatformDiscovery"
            checked={form.watch('enableCrossPlatformDiscovery') ?? true}
            onCheckedChange={(checked) => {
              form.setValue('enableCrossPlatformDiscovery', checked === true);
            }}
          />
          <div className="space-y-1">
            <Label
              htmlFor="enableCrossPlatformDiscovery"
              className="text-sm font-medium leading-none cursor-pointer"
            >
              Make discoverable across ATProto platforms
            </Label>
            <p className="text-xs text-muted-foreground">
              Creates a standard.site document record alongside your eprint. This enables
              cross-platform discovery on other ATProto publishing platforms, such as WhiteWind and
              Frontpage. Your eprint will still appear on Chive regardless of this setting.
            </p>
          </div>
        </div>
      </section>

      {/* Submission notice */}
      <section className="rounded-lg border border-muted bg-muted/30 p-4">
        <h4 className="font-medium mb-2">What Happens Next</h4>
        <ul className="text-sm text-muted-foreground space-y-1 list-inside list-disc">
          <li>Your document will be uploaded to your Personal Data Server (PDS)</li>
          <li>An eprint record will be created in your PDS repository</li>
          <li>Chive will extract and index the text for full-text search</li>
          <li>Your eprint will appear in search and browse results</li>
          <li>You can update or version your eprint at any time</li>
        </ul>
      </section>
    </div>
  );
}
