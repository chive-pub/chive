/**
 * Chive Frontend Library
 *
 * @remarks
 * This module exports all frontend utilities, hooks, and API clients
 * for the Chive eprint service web application.
 *
 * @packageDocumentation
 */

// API Client
export * from './api/client';
export * from './api/query-client';

// Authentication
export * from './auth';

// ATProto utilities
export * from './atproto';

// React hooks
export * from './hooks';

// Schemas - explicit re-exports to avoid conflicts with hooks
export {
  // Constants
  MAX_DOCUMENT_SIZE_BYTES,
  MAX_SUPPLEMENTARY_SIZE_BYTES,
  SUPPORTED_DOCUMENT_FORMATS,
  SUPPORTED_LICENSES,
  SUPPLEMENTARY_CATEGORIES,
  EXTERNAL_LINK_TYPES,
  PROPOSAL_TYPES,
  FIELD_TYPES,
  RELATIONSHIP_TYPES,
  EXTERNAL_MAPPING_SOURCES,
  EVIDENCE_TYPES,
  VOTE_VALUES,
  VOTER_ROLES,
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
  stepFilesSchema,
  stepMetadataSchema,
  stepAuthorsSchema,
  stepFieldsSchema,
  eprintFormDataSchema,
  externalMappingSchema,
  referenceSchema,
  evidenceSchema,
  fieldProposalSchema,
  voteSchema,
  createFieldProposalFormSchema,
  modifyFieldProposalFormSchema,
  mergeFieldProposalFormSchema,
  deprecateFieldProposalFormSchema,
  voteFormSchema,
  // Helpers
  isValidOrcid,
  isValidAtUri,
  normalizeOrcid,
  isValidWikidataId,
  isValidFastId,
  wikidataUrl,
  fastUrl,
  extractWikidataId,
  // Types - use schema versions explicitly (FacetValue and Vote conflict with hooks)
  type ReconciliationStatus,
  type ExternalProfile,
  type AuthorRef,
  type FieldNodeRef,
  type FacetValue as SchemaFacetValue,
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
  type ExternalMapping,
  type Reference,
  type Evidence,
  type FieldProposal,
  type Vote as SchemaVote,
  type CreateFieldProposalFormData,
  type ModifyFieldProposalFormData,
  type MergeFieldProposalFormData,
  type DeprecateFieldProposalFormData,
  type VoteFormData,
} from './schemas';

// Utilities
export * from './utils';

// Error types
export * from './errors';

// Bluesky integration
export * from './bluesky';
