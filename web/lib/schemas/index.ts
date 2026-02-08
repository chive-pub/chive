/**
 * Validation schemas for Chive forms.
 *
 * @remarks
 * Exports Zod schemas for eprint submissions and governance proposals.
 * These schemas match the ATProto lexicon specifications.
 *
 * @packageDocumentation
 */

// Eprint submission schemas
export {
  // Constants (only document formats are hardcoded; other values come from knowledge graph nodes)
  MAX_DOCUMENT_SIZE_BYTES,
  MAX_SUPPLEMENTARY_SIZE_BYTES,
  SUPPORTED_DOCUMENT_FORMATS,
  // Schemas
  reconciliationStatusSchema,
  externalProfileSchema,
  authorRefSchema,
  fieldNodeRefSchema,
  facetValueSchema,
  supplementaryMaterialSchema,
  supplementaryMaterialInputSchema,
  externalLinkSchema,
  fundingSourceSchema,
  externalIdentifierSchema,
  versionRefSchema,
  eprintSubmissionSchema,
  // Step schemas
  stepFilesSchema,
  stepMetadataSchema,
  stepAuthorsSchema,
  stepFieldsSchema,
  eprintFormDataSchema,
  // Types
  type ReconciliationStatus,
  type ExternalProfile,
  type AuthorRef,
  type FieldNodeRef,
  type FacetValue,
  type SupplementaryMaterial,
  type SupplementaryMaterialInput,
  type ExternalLink,
  type FundingSource,
  type ExternalIdentifier,
  type VersionRef,
  type EprintSubmission,
  type StepFilesData,
  type StepMetadataData,
  type StepAuthorsData,
  type StepFieldsData,
  type EprintFormData,
  // Helpers
  isValidOrcid,
  isValidAtUri,
  normalizeOrcid,
} from './eprint';

// Governance proposal schemas
export {
  // Constants
  PROPOSAL_TYPES,
  FIELD_TYPES,
  RELATIONSHIP_TYPES,
  EXTERNAL_MAPPING_SOURCES,
  EVIDENCE_TYPES,
  VOTE_VALUES,
  VOTER_ROLES,
  // Schemas
  externalMappingSchema,
  referenceSchema,
  evidenceSchema,
  fieldProposalSchema,
  voteSchema,
  // Form schemas
  createFieldProposalFormSchema,
  modifyFieldProposalFormSchema,
  mergeFieldProposalFormSchema,
  deprecateFieldProposalFormSchema,
  voteFormSchema,
  // Types
  type ExternalMapping,
  type Reference,
  type Evidence,
  type FieldProposal,
  type Vote,
  type CreateFieldProposalFormData,
  type ModifyFieldProposalFormData,
  type MergeFieldProposalFormData,
  type DeprecateFieldProposalFormData,
  type VoteFormData,
  // Helpers
  isValidWikidataId,
  isValidFastId,
  wikidataUrl,
  fastUrl,
  extractWikidataId,
} from './governance';
