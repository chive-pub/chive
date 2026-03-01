/**
 * Collection wizard step components.
 *
 * @packageDocumentation
 */

export { StepBasics } from './step-basics';
export { StepItems, useNodeSearch } from './step-items';
export { StepEdges } from './step-edges';
export { StepStructure } from './step-structure';
export { StepCosmik } from './step-cosmik';
export { StepReview } from './step-review';

export type {
  CollectionFormValues,
  CollectionItemFormData,
  CollectionEdgeFormData,
  SubcollectionFormData,
  CollectionWizardProps,
} from './types';

export { collectionFormSchema, stepSchemas, WIZARD_STEPS, ITEM_TYPE_CONFIG } from './types';
