'use client';

/**
 * Preprint submission wizard component.
 *
 * @remarks
 * Multi-step form wizard for submitting preprints to the user's PDS.
 * Follows ATProto compliance: all data is written to the user's PDS,
 * never to Chive's backend.
 *
 * @example
 * ```tsx
 * <SubmissionWizard onSuccess={(uri) => router.push(`/preprints/${uri}`)} />
 * ```
 *
 * @packageDocumentation
 */

import { useState, useCallback, useEffect } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, ArrowRight, Send, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth, useAgent } from '@/lib/auth/auth-context';
import { createPreprintRecord, type CreateRecordResult } from '@/lib/atproto';

import { WizardProgress, WizardProgressCompact, type WizardStep } from './wizard-progress';
import { StepFiles } from './step-files';
import { StepMetadata } from './step-metadata';
import { StepAuthors } from './step-authors';
import { StepFields } from './step-fields';
import { StepReview } from './step-review';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Supported license values.
 */
type LicenseValue =
  | 'cc-by-4.0'
  | 'cc-by-sa-4.0'
  | 'cc-by-nc-4.0'
  | 'cc-by-nc-sa-4.0'
  | 'cc0-1.0'
  | 'arxiv-perpetual';

/**
 * Form values for the submission wizard.
 */
export interface PreprintFormValues {
  // Step 1: Files
  pdfFile?: File;
  supplementaryFiles?: File[];

  // Step 2: Metadata
  title: string;
  abstract: string;
  keywords?: string[];
  license: LicenseValue;

  // Step 3: Authors
  authors: Array<{
    did: string;
    displayName?: string;
    handle?: string;
    avatar?: string;
    orcid?: string;
    isPrimary?: boolean;
  }>;

  // Step 4: Fields
  fieldNodes: Array<{
    id: string;
    name: string;
  }>;
}

/**
 * Props for SubmissionWizard component.
 */
export interface SubmissionWizardProps {
  /** Callback when submission succeeds */
  onSuccess?: (result: CreateRecordResult) => void;
  /** Callback when user cancels */
  onCancel?: () => void;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Wizard steps configuration.
 */
const WIZARD_STEPS: WizardStep[] = [
  { id: 'files', title: 'Files', description: 'Upload your preprint' },
  { id: 'metadata', title: 'Metadata', description: 'Title & abstract' },
  { id: 'authors', title: 'Authors', description: 'Add co-authors' },
  { id: 'fields', title: 'Fields', description: 'Categorize your work' },
  { id: 'review', title: 'Review', description: 'Confirm & submit' },
];

/**
 * License values for validation.
 */
const LICENSE_VALUES = [
  'cc-by-4.0',
  'cc-by-sa-4.0',
  'cc-by-nc-4.0',
  'cc-by-nc-sa-4.0',
  'cc0-1.0',
  'arxiv-perpetual',
] as const;

/**
 * Validation schema for the full form.
 */
const formSchema = z.object({
  // Step 1
  pdfFile: z.instanceof(File, { message: 'PDF file is required' }).optional(),
  supplementaryFiles: z.array(z.instanceof(File)).optional(),

  // Step 2
  title: z.string().min(1, 'Title is required').max(500, 'Title too long'),
  abstract: z.string().min(50, 'Abstract must be at least 50 characters').max(10000),
  keywords: z.array(z.string()).max(20).optional(),
  license: z.enum(LICENSE_VALUES),

  // Step 3
  // Note: Using nullish() to allow null values from E2E test session data
  authors: z
    .array(
      z.object({
        did: z.string().min(1),
        displayName: z.string().nullish(),
        handle: z.string().nullish(),
        avatar: z.string().nullish(),
        orcid: z.string().nullish(),
        isPrimary: z.boolean().optional(),
      })
    )
    .min(1, 'At least one author is required'),

  // Step 4
  fieldNodes: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
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
    pdfFile: z.instanceof(File, { message: 'PDF file is required' }),
    supplementaryFiles: z.array(z.instanceof(File)).optional(),
  }),
  metadata: z.object({
    title: z.string().min(1, 'Title is required').max(500),
    abstract: z.string().min(50, 'Abstract must be at least 50 characters').max(10000),
    keywords: z.array(z.string()).max(20).optional(),
    license: z.enum(LICENSE_VALUES),
  }),
  authors: z.object({
    authors: z
      .array(
        z.object({
          did: z.string().min(1),
          displayName: z.string().nullish(),
          handle: z.string().nullish(),
          avatar: z.string().nullish(),
          orcid: z.string().nullish(),
          isPrimary: z.boolean().optional(),
        })
      )
      .min(1, 'At least one author is required'),
  }),
  fields: z.object({
    fieldNodes: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
        })
      )
      .min(1, 'At least one field is required')
      .max(10),
  }),
  review: z.object({}), // No additional validation for review step
};

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Multi-step preprint submission wizard.
 *
 * @param props - Component props
 * @returns Wizard element
 */
export function SubmissionWizard({ onSuccess, onCancel, className }: SubmissionWizardProps) {
  const { isAuthenticated, user: _user } = useAuth();
  const agent = useAgent();

  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Initialize form with react-hook-form
  // Note: Using explicit type assertion since zodResolver inference
  // doesn't perfectly match our PreprintFormValues interface
  const form = useForm<PreprintFormValues>({
    resolver: zodResolver(formSchema) as never,
    mode: 'onChange',
    defaultValues: {
      title: '',
      abstract: '',
      keywords: [],
      license: 'cc-by-4.0',
      authors: [],
      fieldNodes: [],
      supplementaryFiles: [],
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
        const path = issue.path.join('.') as keyof PreprintFormValues;
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
      setSubmitError('You must be logged in to submit a preprint');
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

      // Transform wizard data to match PreprintFormData schema
      // Authors need: did, order, name (optional), orcid (optional)
      const transformedAuthors = values.authors.map((a, index) => ({
        did: a.did,
        order: index + 1,
        name: a.displayName,
        orcid: a.orcid,
      }));

      // Field nodes need: uri (use id as AT-URI), weight (optional)
      const transformedFieldNodes = values.fieldNodes.map((f) => ({
        uri: f.id, // The id should be the AT-URI
        weight: undefined,
      }));

      // Supplementary files need: file, description, type
      // For now, convert bare files to objects with default descriptions
      const transformedSupplementary = (values.supplementaryFiles ?? []).map((file) => ({
        file,
        description: file.name,
        type: undefined,
      }));

      // Create the preprint record in the user's PDS
      const result = await createPreprintRecord(agent, {
        pdfFile: values.pdfFile!,
        supplementaryFiles: transformedSupplementary,
        title: values.title,
        abstract: values.abstract,
        keywords: values.keywords ?? [],
        license: values.license,
        authors: transformedAuthors,
        fieldNodes: transformedFieldNodes,
      });

      onSuccess?.(result);
    } catch (error) {
      console.error('Submission error:', error);
      setSubmitError(
        error instanceof Error ? error.message : 'An error occurred while submitting your preprint'
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
        return <StepMetadata form={form} />;
      case 2:
        return <StepAuthors form={form} />;
      case 3:
        return <StepFields form={form} />;
      case 4:
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
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Submit Preprint
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
