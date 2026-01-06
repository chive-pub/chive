/**
 * Validation schemas for Chive forms.
 *
 * @remarks
 * Exports Zod schemas for preprint submissions and governance proposals.
 * These schemas match the ATProto lexicon specifications.
 *
 * @packageDocumentation
 */

// Preprint submission schemas
export {
  // Constants
  MAX_PDF_SIZE_BYTES,
  MAX_SUPPLEMENTARY_SIZE_BYTES,
  SUPPORTED_LICENSES,
  SUPPLEMENTARY_TYPES,
  EXTERNAL_LINK_TYPES,
  PMEST_DIMENSIONS,
  FAST_FACET_TYPES,
  ALL_FACET_TYPES,
  // Schemas
  reconciliationStatusSchema,
  externalProfileSchema,
  authorRefSchema,
  fieldNodeRefSchema,
  facetValueSchema,
  supplementaryBlobSchema,
  externalLinkSchema,
  fundingSourceSchema,
  externalIdentifierSchema,
  versionRefSchema,
  preprintSubmissionSchema,
  // Step schemas
  stepFilesSchema,
  stepMetadataSchema,
  stepAuthorsSchema,
  stepFieldsSchema,
  preprintFormDataSchema,
  // Types
  type ReconciliationStatus,
  type ExternalProfile,
  type AuthorRef,
  type FieldNodeRef,
  type FacetValue,
  type SupplementaryBlob,
  type ExternalLink,
  type FundingSource,
  type ExternalIdentifier,
  type VersionRef,
  type PreprintSubmission,
  type StepFilesData,
  type StepMetadataData,
  type StepAuthorsData,
  type StepFieldsData,
  type PreprintFormData,
  // Helpers
  isValidOrcid,
  isValidAtUri,
  normalizeOrcid,
} from './preprint';

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
