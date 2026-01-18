/**
 * Eprint submission components for Chive.
 *
 * @remarks
 * Multi-step wizard for submitting eprints to a PDS.
 * Users can submit to their own Personal Data Server (default) or
 * to a paper's dedicated PDS for papers as first-class ATProto citizens.
 * All data is written directly to the target PDS, following ATProto
 * compliance principles.
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
export { StepDestination, type StepDestinationProps } from './step-destination';
export { StepSupplementary, type StepSupplementaryProps } from './step-supplementary';
export { StepMetadata, type StepMetadataProps } from './step-metadata';
export { StepAuthors, type StepAuthorsProps } from './step-authors';
export { StepFields, type StepFieldsProps } from './step-fields';
export { StepFacets, type StepFacetsProps } from './step-facets';
export { StepPublication, type StepPublicationProps } from './step-publication';
export { StepReview, type StepReviewProps } from './step-review';
