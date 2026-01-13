/**
 * Eprint submission components for Chive.
 *
 * @remarks
 * Multi-step wizard for submitting eprints to the user's PDS.
 * All data is written directly to the user's Personal Data Server,
 * following ATProto compliance principles.
 *
 * @packageDocumentation
 */

export {
  SubmissionWizard,
  type SubmissionWizardProps,
  type EprintFormValues,
} from './submission-wizard';

export {
  WizardProgress,
  WizardProgressCompact,
  type WizardProgressProps,
  type WizardStep,
} from './wizard-progress';

export { StepFiles, type StepFilesProps } from './step-files';
export { StepMetadata, type StepMetadataProps } from './step-metadata';
export { StepAuthors, type StepAuthorsProps } from './step-authors';
export { StepFields, type StepFieldsProps } from './step-fields';
export { StepReview, type StepReviewProps } from './step-review';
