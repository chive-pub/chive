'use client';

/**
 * Eprint submission wizard component.
 *
 * @remarks
 * Multi-step form wizard for submitting eprints to the user's PDS.
 * Follows ATProto compliance: all data is written to the user's PDS,
 * never to Chive's backend.
 *
 * @example
 * ```tsx
 * <SubmissionWizard onSuccess={(uri) => router.push(`/eprints/${uri}`)} />
 * ```
 *
 * @packageDocumentation
 */

import { useState, useCallback, useEffect } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, ArrowRight, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { logger } from '@/lib/observability';
import { Button } from '@/components/ui/button';

const submitLogger = logger.child({ component: 'submission-wizard' });
import { cn } from '@/lib/utils';
import { useAuth, useAgent } from '@/lib/auth/auth-context';
import { createEprintRecord, createStandardDocument, type CreateRecordResult } from '@/lib/atproto';
import { SUPPORTED_DOCUMENT_FORMATS } from '@/lib/schemas/eprint';
import { authApi } from '@/lib/api/client';

import { WizardProgress, WizardProgressCompact, type WizardStep } from './wizard-progress';
import { StepFiles } from './step-files';
import { StepDestination } from './step-destination';
import { StepSupplementary } from './step-supplementary';
import { StepMetadata } from './step-metadata';
import { StepAuthors } from './step-authors';
import { StepFields } from './step-fields';
import { StepFacets } from './step-facets';
import { StepPublication } from './step-publication';
import { StepReview } from './step-review';
import { getActivePaperSession, clearAllPaperSessions } from '@/lib/auth/paper-session';
import type { EprintAuthorFormData } from '@/components/forms/eprint-author-editor';

// =============================================================================
// TYPES
// =============================================================================

import type { DocumentFormat, PublicationStatus } from '@/lib/api/generated/types/pub/chive/defs';

/**
 * Supplementary material input with metadata.
 *
 * @remarks
 * Uses knowledge graph nodes for category. The `category` field stores the
 * slug (e.g., 'dataset', 'code') for auto-detection and icon display.
 * The `categoryUri` and `categoryName` store the knowledge graph reference.
 */
export interface SupplementaryMaterialInput {
  file: File;
  label: string;
  description?: string;
  /** Category slug for auto-detection and icon display */
  category: string;
  /** Knowledge graph node AT-URI */
  categoryUri?: string;
  /** Knowledge graph node display name */
  categoryName?: string;
  detectedFormat: string;
  order: number;
}

/**
 * Form values for the submission wizard.
 */
export type PublicationStatusValue = PublicationStatus;

// Platform and presentation types are now sourced from the knowledge graph
// via NodeAutocomplete. URIs (e.g., at://did:plc:governance/pub.chive.graph.node/uuid)
// are stored in platformUri/presentationTypeUri fields.
// Display names are stored in platformName/presentationTypeName fields.

export interface EprintFormValues {
  // Step 1: Files
  documentFile?: File;
  documentFormat?: DocumentFormat;
  supplementaryFiles?: File[];

  // Step 1.5: Destination (where to submit)
  usePaperPds?: boolean;
  paperDid?: string;

  // Step 2: Supplementary Materials
  supplementaryMaterials?: SupplementaryMaterialInput[];

  // Cross-platform discovery (standard.site)
  /** Whether to create a site.standard.document record for cross-platform discovery */
  enableCrossPlatformDiscovery?: boolean;

  // Step 3: Metadata
  title: string;
  abstract: string;
  keywords?: string[];
  /** AT-URI to license node (subkind=license) */
  licenseUri?: string;
  /** SPDX identifier for display fallback (e.g., 'CC-BY-4.0') */
  licenseSlug: string;

  // Step 4: Authors
  authors: EprintAuthorFormData[];

  // Step 5: Fields (matches FieldNodeRef schema)
  fieldNodes: Array<{
    uri: string;
    label: string;
  }>;

  // Step 6: Facets (optional)
  facets?: Array<{
    slug: string;
    value: string;
    label?: string;
  }>;

  // Step 7: Publication Metadata
  publicationStatus?: PublicationStatusValue;
  publishedVersion?: {
    doi?: string;
    url?: string;
    journal?: string;
    publisher?: string;
  };
  externalIds?: {
    arxivId?: string;
    pmid?: string;
    ssrnId?: string;
    osf?: string;
    zenodoDoi?: string;
    openAlexId?: string;
  };
  codeRepositories?: Array<{
    url?: string;
    platformUri?: string;
    platformName?: string;
    label?: string;
  }>;
  dataRepositories?: Array<{
    url?: string;
    platformUri?: string;
    platformName?: string;
    label?: string;
  }>;
  preregistration?: {
    url?: string;
    platformUri?: string;
    platformName?: string;
  };
  funding?: Array<{
    funderName?: string;
    funderUri?: string;
    funderDoi?: string;
    funderRor?: string;
    grantNumber?: string;
  }>;
  conferencePresentation?: {
    conferenceName?: string;
    conferenceUri?: string;
    conferenceIteration?: string;
    conferenceLocation?: string;
    presentationDate?: string;
    presentationTypeUri?: string;
    presentationTypeName?: string;
    conferenceUrl?: string;
  };
}

/**
 * Prefilled data from external sources for claim mode.
 *
 * @remarks
 * Maps to the getSubmissionData API response format.
 */
export interface PrefilledData {
  title?: string;
  abstract?: string;
  authors?: Array<{
    order: number;
    name: string;
    orcid?: string;
    email?: string;
    affiliation?: string;
  }>;
  keywords?: string[];
  doi?: string;
  pdfUrl?: string;
  /** Pre-fetched PDF file from external source */
  documentFile?: File;
  source?: string;
  externalId?: string;
  externalUrl?: string;
  publicationDate?: string;
  externalIds?: {
    arxivId?: string;
    doi?: string;
  };
}

/**
 * Props for SubmissionWizard component.
 */
export interface SubmissionWizardProps {
  /** Callback when submission succeeds */
  onSuccess?: (result: CreateRecordResult) => void;
  /** Callback when user cancels */
  onCancel?: () => void;
  /** Prefilled data from external source (for claim mode) */
  prefilled?: PrefilledData;
  /** Whether this is a claim flow (vs new submission) */
  isClaimMode?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// UTILITIES
// =============================================================================

interface FacetEntry {
  slug: string;
  value: string;
  label?: string;
}

/**
 * Merge selected field nodes into the facets array as personality (discipline) facets.
 * Deduplicates against any personality facets the user already selected manually.
 */
export function mergeFieldsIntoFacets(
  facets: FacetEntry[],
  fieldNodes: ReadonlyArray<{ uri: string; label: string }>
): FacetEntry[] {
  const existing = new Set(facets.filter((f) => f.slug === 'personality').map((f) => f.value));
  const additions: FacetEntry[] = [];
  for (const field of fieldNodes) {
    if (!existing.has(field.uri)) {
      additions.push({ slug: 'personality', value: field.uri, label: field.label });
    }
  }
  return [...facets, ...additions];
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Wizard steps configuration.
 */
const WIZARD_STEPS: WizardStep[] = [
  { id: 'files', title: 'Files', description: 'Upload your eprint' },
  { id: 'destination', title: 'Destination', description: 'Choose where to submit' },
  { id: 'supplementary', title: 'Supplementary', description: 'Add supporting files' },
  { id: 'metadata', title: 'Metadata', description: 'Title & abstract' },
  { id: 'authors', title: 'Authors', description: 'Add co-authors' },
  { id: 'fields', title: 'Fields', description: 'Categorize your work' },
  { id: 'facets', title: 'Facets', description: 'Add classifications' },
  { id: 'publication', title: 'Publication', description: 'Status & links' },
  { id: 'review', title: 'Review', description: 'Confirm & submit' },
];

/**
 * Document format values for validation.
 */
const DOCUMENT_FORMAT_VALUES = [
  'pdf',
  'docx',
  'html',
  'markdown',
  'latex',
  'jupyter',
  'odt',
  'rtf',
  'epub',
  'txt',
] as const;

/**
 * Supplementary material schema for validation.
 */
const supplementaryMaterialSchema = z.object({
  file: z.instanceof(File),
  label: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  category: z.string().min(1), // Slug for auto-detection and icons
  categoryUri: z.string().optional(), // Knowledge graph AT-URI
  categoryName: z.string().optional(), // Display name
  detectedFormat: z.string(),
  order: z.number().int().min(1),
});

/**
 * Validation schema for the full form.
 */
const formSchema = z.object({
  // Step 1: Files
  documentFile: z.instanceof(File, { message: 'Document file is required' }).optional(),
  documentFormat: z.enum(DOCUMENT_FORMAT_VALUES).optional(),
  supplementaryFiles: z.array(z.instanceof(File)).optional(),

  // Step 2: Supplementary Materials
  supplementaryMaterials: z.array(supplementaryMaterialSchema).max(50).optional(),

  // Step 3: Metadata
  title: z.string().min(1, 'Title is required').max(500, 'Title too long'),
  abstract: z.string().min(50, 'Abstract must be at least 50 characters').max(10000),
  keywords: z.array(z.string()).max(20).optional(),
  licenseUri: z.string().optional(),
  licenseSlug: z.string().min(1, 'License is required'),

  // Step 4: Authors
  // Note: Using nullish() to allow null values and external collaborators without DIDs
  authors: z
    .array(
      z.object({
        did: z.string().nullish(),
        name: z.string().min(1, 'Author name is required'),
        handle: z.string().nullish(),
        avatar: z.string().nullish(),
        orcid: z.string().nullish(),
        email: z.union([z.email(), z.literal('')]).nullish(),
        order: z.number().int().min(1),
        affiliations: z.array(
          z.object({
            name: z.string(),
            rorId: z.string().nullish(),
            department: z.string().nullish(),
          })
        ),
        contributions: z.array(
          z.object({
            typeUri: z.string(),
            typeId: z.string().nullish(),
            typeLabel: z.string().nullish(),
            degree: z.string(),
          })
        ),
        isCorrespondingAuthor: z.boolean(),
        isHighlighted: z.boolean(),
      })
    )
    .min(1, 'At least one author is required'),

  // Step 5: Fields (matches FieldNodeRef schema)
  fieldNodes: z
    .array(
      z.object({
        uri: z.string(),
        label: z.string(),
      })
    )
    .min(1, 'At least one field is required')
    .max(10),
});

/**
 * Step-specific validation schemas.
 */
const stepSchemas = {
  files: z.object({
    documentFile: z.instanceof(File, { message: 'Document file is required' }),
    documentFormat: z.enum(DOCUMENT_FORMAT_VALUES).optional(),
    supplementaryFiles: z.array(z.instanceof(File)).optional(),
  }),
  destination: z
    .object({
      usePaperPds: z.boolean().optional(),
      paperDid: z.string().optional(),
    })
    .refine((data) => !data.usePaperPds || data.paperDid, {
      message: 'Paper authentication required when submitting to paper PDS',
    }),
  supplementary: z.object({
    supplementaryMaterials: z.array(supplementaryMaterialSchema).max(50).optional(),
  }),
  metadata: z.object({
    title: z.string().min(1, 'Title is required').max(500),
    abstract: z.string().min(50, 'Abstract must be at least 50 characters').max(10000),
    keywords: z.array(z.string()).max(20).optional(),
    licenseUri: z.string().optional(),
    licenseSlug: z.string().min(1, 'License is required'),
  }),
  authors: z.object({
    authors: z
      .array(
        z.object({
          did: z.string().nullish(),
          name: z.string().min(1, 'Author name is required'),
          handle: z.string().nullish(),
          avatar: z.string().nullish(),
          orcid: z.string().nullish(),
          email: z.union([z.email(), z.literal('')]).nullish(),
          order: z.number().int().min(1),
          affiliations: z.array(
            z.object({
              name: z.string(),
              rorId: z.string().nullish(),
              department: z.string().nullish(),
            })
          ),
          contributions: z.array(
            z.object({
              typeUri: z.string(),
              typeId: z.string().nullish(),
              typeLabel: z.string().nullish(),
              degree: z.string(),
            })
          ),
          isCorrespondingAuthor: z.boolean(),
          isHighlighted: z.boolean(),
        })
      )
      .min(1, 'At least one author is required'),
  }),
  fields: z.object({
    fieldNodes: z
      .array(
        z.object({
          uri: z.string(),
          label: z.string(),
        })
      )
      .min(1, 'At least one field is required')
      .max(10),
  }),
  facets: z.object({
    facets: z
      .array(
        z.object({
          slug: z.string(),
          value: z.string(),
          label: z.string().optional(),
        })
      )
      .max(30)
      .optional(),
  }),
  publication: z.object({
    publicationStatus: z.string().optional(),
    publishedVersion: z
      .object({
        doi: z.string().optional(),
        url: z.union([z.url(), z.literal('')]).optional(),
        journal: z.string().optional(),
        publisher: z.string().optional(),
      })
      .optional(),
    externalIds: z
      .object({
        arxivId: z.string().optional(),
        pmid: z.string().optional(),
        ssrnId: z.string().optional(),
        osf: z.string().optional(),
        zenodoDoi: z.string().optional(),
        openAlexId: z.string().optional(),
      })
      .optional(),
    codeRepositories: z
      .array(
        z.object({
          url: z.union([z.url(), z.literal('')]).optional(),
          platformUri: z.string().optional(),
          platformName: z.string().optional(),
          label: z.string().optional(),
        })
      )
      .optional(),
    dataRepositories: z
      .array(
        z.object({
          url: z.union([z.url(), z.literal('')]).optional(),
          platformUri: z.string().optional(),
          platformName: z.string().optional(),
          label: z.string().optional(),
        })
      )
      .optional(),
    preregistration: z
      .object({
        url: z.union([z.url(), z.literal('')]).optional(),
        platformUri: z.string().optional(),
        platformName: z.string().optional(),
      })
      .optional(),
    funding: z
      .array(
        z.object({
          funderName: z.string().optional(),
          funderUri: z.string().optional(),
          funderDoi: z.string().optional(),
          funderRor: z.string().optional(),
          grantNumber: z.string().optional(),
        })
      )
      .optional(),
    conferencePresentation: z
      .object({
        conferenceName: z.string().optional(),
        conferenceUri: z.string().optional(),
        conferenceIteration: z.string().optional(),
        conferenceLocation: z.string().optional(),
        presentationDate: z.string().optional(),
        presentationTypeUri: z.string().optional(),
        presentationTypeName: z.string().optional(),
        conferenceUrl: z.union([z.url(), z.literal('')]).optional(),
      })
      .optional(),
  }),
  review: z.object({}), // No additional validation for review step
};

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Multi-step eprint submission wizard.
 *
 * @param props - Component props
 * @returns Wizard element
 */
export function SubmissionWizard({
  onSuccess,
  onCancel,
  prefilled,
  isClaimMode = false,
  className,
}: SubmissionWizardProps) {
  const { isAuthenticated, user: _user } = useAuth();
  const agent = useAgent();

  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Clean up paper sessions when wizard unmounts
  useEffect(() => {
    return () => {
      clearAllPaperSessions();
    };
  }, []);

  // Transform prefilled author data to form format
  const prefilledAuthors: EprintAuthorFormData[] = (prefilled?.authors ?? []).map((a, index) => ({
    did: undefined,
    name: a.name,
    handle: undefined,
    avatar: undefined,
    orcid: a.orcid,
    email: a.email,
    order: a.order ?? index + 1,
    affiliations: a.affiliation
      ? [{ name: a.affiliation, rorId: undefined, department: undefined }]
      : [],
    contributions: [],
    isCorrespondingAuthor: (a.order ?? index + 1) === 1,
    isHighlighted: false,
  }));

  // Initialize form with react-hook-form
  // Note: Using explicit type assertion since zodResolver inference
  // doesn't perfectly match our EprintFormValues interface
  const form = useForm<EprintFormValues>({
    resolver: zodResolver(formSchema) as never,
    mode: 'onChange',
    defaultValues: {
      // In claim mode, use prefilled document file if available
      documentFile: prefilled?.documentFile,
      // Destination defaults to user's own PDS
      usePaperPds: false,
      paperDid: undefined,
      title: prefilled?.title ?? '',
      abstract: prefilled?.abstract ?? '',
      keywords: prefilled?.keywords ?? [],
      licenseUri: undefined,
      licenseSlug: 'CC-BY-4.0',
      authors: prefilledAuthors,
      fieldNodes: [],
      facets: [],
      supplementaryFiles: [],
      supplementaryMaterials: [],
      publicationStatus: 'eprint',
      publishedVersion: prefilled?.doi ? { doi: prefilled.doi } : {},
      externalIds: {
        arxivId: prefilled?.externalIds?.arxivId,
      },
      codeRepositories: [],
      dataRepositories: [],
      preregistration: {},
      funding: [],
      conferencePresentation: {},
      // Cross-platform discovery is enabled by default
      enableCrossPlatformDiscovery: true,
    },
  });

  // Get current step key
  const currentStepKey = WIZARD_STEPS[currentStep].id as keyof typeof stepSchemas;

  // Validate current step
  const validateCurrentStep = useCallback(async (): Promise<boolean> => {
    const schema = stepSchemas[currentStepKey];
    if (!schema) return true;

    const values = form.getValues();
    const result = schema.safeParse(values);

    if (!result.success) {
      // Trigger validation errors on the form
      result.error.issues.forEach((issue) => {
        const path = issue.path.join('.') as keyof EprintFormValues;
        form.setError(path, { message: issue.message });
      });
      return false;
    }

    return true;
  }, [form, currentStepKey]);

  // Trigger full form validation when entering the review step
  // This ensures form.formState.errors is updated with the current values
  // which is needed for the "Ready to Submit" vs "Missing Required Information" display
  useEffect(() => {
    if (currentStep === WIZARD_STEPS.length - 1) {
      // On the review step: trigger full form validation.
      form.trigger();
    }
  }, [currentStep, form]);

  // Go to next step
  const handleNext = useCallback(async () => {
    const isValid = await validateCurrentStep();
    if (isValid && currentStep < WIZARD_STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  }, [currentStep, validateCurrentStep]);

  // Go to previous step
  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  // Handle step click (only allow going back)
  const handleStepClick = useCallback(
    (stepIndex: number) => {
      if (stepIndex < currentStep) {
        setCurrentStep(stepIndex);
      }
    },
    [currentStep]
  );

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    if (!agent || !isAuthenticated) {
      setSubmitError('You must be logged in to submit an eprint');
      return;
    }

    // Validate entire form
    const isValid = await form.trigger();
    if (!isValid) {
      setSubmitError('Please fix all validation errors before submitting');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const values = form.getValues();

      // Transform wizard data to match EprintFormData schema
      // Use author data directly since it already matches the unified model
      const transformedAuthors = values.authors.map((a, index) => ({
        did: a.did,
        order: a.order ?? index + 1,
        name: a.name,
        orcid: a.orcid,
        email: a.email,
        affiliations: a.affiliations,
        contributions: a.contributions,
        isCorrespondingAuthor: a.isCorrespondingAuthor,
        isHighlighted: a.isHighlighted,
      }));

      // Field nodes: uri is already the full AT-URI, weight is optional
      const transformedFieldNodes = values.fieldNodes.map((f) => ({
        uri: f.uri,
        weight: undefined,
      }));

      // Transform supplementary materials with full metadata
      const transformedSupplementary = (values.supplementaryMaterials ?? []).map((m) => ({
        file: m.file,
        label: m.label,
        description: m.description,
        category: m.category,
        detectedFormat: m.detectedFormat,
        order: m.order,
      }));

      // Transform facets and auto-add fields as personality (discipline) facets
      const baseFacets = (values.facets ?? []).map((f) => ({
        slug: f.slug,
        value: f.value,
        label: f.label,
      }));
      const transformedFacets = mergeFieldsIntoFacets(baseFacets, values.fieldNodes);

      // Determine target agent (user's or paper's PDS)
      let targetAgent = undefined;
      if (values.usePaperPds) {
        const paperSession = getActivePaperSession();
        if (!paperSession) {
          setSubmitError(
            'Paper account authentication required. Please authenticate on the Destination step.'
          );
          return;
        }
        targetAgent = paperSession.agent;
      }

      // Create the eprint record in the target PDS (user's or paper's)
      const result = await createEprintRecord(
        agent,
        {
          documentFile: values.documentFile!,
          documentFormat: values.documentFormat as
            | (typeof SUPPORTED_DOCUMENT_FORMATS)[number]
            | undefined,
          supplementaryMaterials: transformedSupplementary,
          title: values.title,
          abstract: values.abstract,
          keywords: values.keywords ?? [],
          licenseUri: values.licenseUri,
          licenseSlug: values.licenseSlug,
          authors: transformedAuthors,
          fieldNodes: transformedFieldNodes,
          facets: transformedFacets.length > 0 ? transformedFacets : undefined,
        },
        targetAgent
      );

      // Optionally create a standard.site document for cross-platform discovery
      if (values.enableCrossPlatformDiscovery && agent) {
        try {
          submitLogger.info('Creating standard.site document', { eprintUri: result.uri });
          await createStandardDocument(agent, {
            title: values.title,
            description: values.abstract?.substring(0, 2000),
            eprintUri: result.uri,
            eprintCid: result.cid,
          });
          submitLogger.info('Standard.site document created for cross-platform discovery');
        } catch (standardDocError) {
          // Log but don't fail; the eprint is the primary record
          submitLogger.warn(
            'Failed to create standard.site document; eprint was created successfully',
            {
              error:
                standardDocError instanceof Error
                  ? standardDocError.message
                  : String(standardDocError),
            }
          );
        }
      }

      // Request immediate indexing as a UX optimization.
      // The firehose is the primary indexing mechanism (Jetstream broadcasts all
      // pub.chive.* records), but there may be latency. This call ensures the
      // record appears immediately in Chive's index for a better user experience.
      // If this fails, the firehose will eventually index the record.
      try {
        const indexResult = await authApi.pub.chive.sync.indexRecord({ uri: result.uri });

        // Check if indexing succeeded (API returns { indexed: false, error: "..." } on failure)
        if (!indexResult.data.indexed) {
          submitLogger.warn('Immediate indexing failed; firehose will retry', {
            error: indexResult.data.error,
          });
          toast.info('Your paper was saved to your PDS.', {
            description: 'It will appear in search results shortly via the firehose.',
          });
        }
      } catch (syncError) {
        // Log but don't fail; the firehose will index the record
        submitLogger.warn('Immediate indexing request failed; firehose will handle', {
          error: syncError instanceof Error ? syncError.message : String(syncError),
        });
        toast.info('Your paper was saved to your PDS.', {
          description: 'It will appear in search results shortly via the firehose.',
        });
      }

      // Clean up paper session after successful submission
      clearAllPaperSessions();

      onSuccess?.(result);
    } catch (error) {
      submitLogger.error('Submission error', error);
      setSubmitError(
        error instanceof Error ? error.message : 'An error occurred while submitting your eprint'
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [agent, isAuthenticated, form, onSuccess]);

  // Render current step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return <StepFiles form={form} />;
      case 1:
        return <StepDestination form={form} />;
      case 2:
        return <StepSupplementary form={form} />;
      case 3:
        return <StepMetadata form={form} />;
      case 4:
        return <StepAuthors form={form} isImportMode={isClaimMode} />;
      case 5:
        return <StepFields form={form} />;
      case 6:
        return <StepFacets form={form} />;
      case 7:
        return <StepPublication form={form} />;
      case 8:
        return <StepReview form={form} isSubmitting={isSubmitting} submitError={submitError} />;
      default:
        return null;
    }
  };

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === WIZARD_STEPS.length - 1;

  return (
    <div className={cn('space-y-8', className)}>
      {/* Progress indicator - desktop */}
      <div className="hidden md:block">
        <WizardProgress
          steps={WIZARD_STEPS}
          currentStep={currentStep}
          onStepClick={handleStepClick}
        />
      </div>

      {/* Progress indicator - mobile */}
      <div className="md:hidden">
        <WizardProgressCompact steps={WIZARD_STEPS} currentStep={currentStep} />
      </div>

      {/* Form wrapper */}
      <FormProvider {...form}>
        <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
          {/* Step content */}
          <div className="min-h-[400px]">{renderStepContent()}</div>

          {/* Navigation buttons */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div>
              {onCancel && (
                <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
                  Cancel
                </Button>
              )}
            </div>

            <div className="flex gap-3">
              {!isFirstStep && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  disabled={isSubmitting}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              )}

              {!isLastStep ? (
                <Button type="button" onClick={handleNext}>
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting || !isAuthenticated}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {isClaimMode ? 'Importing...' : 'Submitting...'}
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      {isClaimMode ? 'Import Paper' : 'Submit Eprint'}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </form>
      </FormProvider>
    </div>
  );
}
