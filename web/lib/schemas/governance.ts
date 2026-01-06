/**
 * Governance proposal validation schemas.
 *
 * @remarks
 * Zod schemas that match the `pub.chive.graph.fieldProposal` lexicon specification.
 * Used for client-side validation before creating ATProto records in user PDSes.
 *
 * @see https://atproto.com/guides/lexicon
 * @packageDocumentation
 */

import { z } from 'zod';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Proposal types for knowledge graph changes.
 */
export const PROPOSAL_TYPES = ['create', 'modify', 'merge', 'deprecate'] as const;

/**
 * Field hierarchy levels.
 */
export const FIELD_TYPES = ['root', 'field', 'subfield', 'topic'] as const;

/**
 * Relationship types between fields.
 */
export const RELATIONSHIP_TYPES = [
  'broader',
  'narrower',
  'related',
  'equivalent',
  'interdisciplinary-with',
] as const;

/**
 * External mapping sources for field proposals.
 */
export const EXTERNAL_MAPPING_SOURCES = [
  'wikidata',
  'fast',
  'lcsh',
  'viaf',
  'ror',
  'openalex',
] as const;

/**
 * Evidence types for proposals.
 */
export const EVIDENCE_TYPES = [
  'usage-patterns',
  'tag-frequency',
  'expert-survey',
  'curriculum-analysis',
  'fast-mapping',
  'literature-review',
] as const;

// =============================================================================
// EXTERNAL MAPPING SCHEMAS
// =============================================================================

/**
 * External knowledge base mapping.
 *
 * @remarks
 * Links proposed fields to external authority records.
 */
export const externalMappingSchema = z.object({
  /** Source knowledge base */
  source: z.enum(EXTERNAL_MAPPING_SOURCES),

  /** External identifier */
  id: z.string().min(1, 'Identifier is required'),

  /** Resolvable URL */
  url: z.string().url().optional(),

  /** Human-readable label from source */
  label: z.string().max(200).optional(),

  /** Match type (SKOS) */
  matchType: z
    .enum(['exactMatch', 'closeMatch', 'broadMatch', 'narrowMatch', 'relatedMatch'])
    .optional(),

  /** Confidence score (0-1) */
  confidence: z.number().min(0).max(1).optional(),
});

export type ExternalMapping = z.infer<typeof externalMappingSchema>;

/**
 * Reference supporting a proposal.
 */
export const referenceSchema = z.object({
  /** Reference URL (DOI, paper, website) */
  url: z.string().url(),

  /** Reference title */
  title: z.string().max(500).optional(),

  /** Reference type */
  type: z.enum(['doi', 'paper', 'website', 'curriculum', 'other']).optional(),
});

export type Reference = z.infer<typeof referenceSchema>;

/**
 * Evidence supporting a proposal.
 */
export const evidenceSchema = z.object({
  /** Evidence type */
  type: z.enum(EVIDENCE_TYPES),

  /** Description of evidence */
  description: z.string().max(2000).optional(),

  /** Quantitative metrics */
  metrics: z.record(z.string(), z.unknown()).optional(),
});

export type Evidence = z.infer<typeof evidenceSchema>;

// =============================================================================
// FIELD PROPOSAL SCHEMA
// =============================================================================

/**
 * Field proposal for creating or modifying knowledge graph nodes.
 *
 * @remarks
 * Matches the `pub.chive.graph.fieldProposal` lexicon specification.
 * Proposals are created in user PDSes and indexed by Chive AppView.
 *
 * @example
 * ```typescript
 * const result = fieldProposalSchema.safeParse(formData);
 * if (result.success) {
 *   await agent.com.atproto.repo.createRecord({
 *     repo: agent.session.did,
 *     collection: 'pub.chive.graph.fieldProposal',
 *     record: { $type: 'pub.chive.graph.fieldProposal', ...result.data }
 *   });
 * }
 * ```
 */
export const fieldProposalSchema = z
  .object({
    // Required fields
    /** Proposed field name (max 200 chars) */
    fieldName: z
      .string()
      .min(2, 'Field name must be at least 2 characters')
      .max(200, 'Field name must be at most 200 characters'),

    /** Field description (max 5000 chars) */
    description: z
      .string()
      .min(20, 'Description must be at least 20 characters')
      .max(5000, 'Description must be at most 5,000 characters'),

    /** Proposal type */
    proposalType: z.enum(PROPOSAL_TYPES),

    /** Creation timestamp (ISO 8601) */
    createdAt: z.string().datetime().optional(),

    // Conditional fields
    /** AT-URI of existing field (required for modify/deprecate) */
    existingFieldUri: z.string().optional(),

    /** AT-URI of merge target (required for merge) */
    mergeTargetUri: z.string().optional(),

    // Optional fields
    /** Alternative names for the field */
    alternateNames: z.array(z.string().max(200)).max(10).optional(),

    /** Hierarchy level */
    fieldType: z.enum(FIELD_TYPES).optional(),

    /** Parent field URI */
    parentFieldUri: z.string().optional(),

    /** External knowledge base mappings */
    externalMappings: z.array(externalMappingSchema).max(10).optional(),

    /** Rationale for the proposal */
    rationale: z.string().max(5000).optional(),

    /** Supporting references */
    references: z.array(referenceSchema).max(20).optional(),

    /** Supporting evidence */
    evidence: z.array(evidenceSchema).max(10).optional(),

    /** Link to discussion thread */
    discussionUri: z.string().optional(),
  })
  .refine(
    (data) => {
      // existingFieldUri required for modify/deprecate
      if (data.proposalType === 'modify' || data.proposalType === 'deprecate') {
        return !!data.existingFieldUri;
      }
      return true;
    },
    {
      message: 'Existing field URI is required for modify/deprecate proposals',
      path: ['existingFieldUri'],
    }
  )
  .refine(
    (data) => {
      // mergeTargetUri required for merge
      if (data.proposalType === 'merge') {
        return !!data.mergeTargetUri;
      }
      return true;
    },
    {
      message: 'Merge target URI is required for merge proposals',
      path: ['mergeTargetUri'],
    }
  );

export type FieldProposal = z.infer<typeof fieldProposalSchema>;

// =============================================================================
// VOTE SCHEMA
// =============================================================================

/**
 * Vote values.
 */
export const VOTE_VALUES = ['approve', 'reject', 'abstain', 'request-changes'] as const;

/**
 * Voter roles with different weights.
 */
export const VOTER_ROLES = [
  'community-member',
  'reviewer',
  'domain-expert',
  'administrator',
] as const;

/**
 * Vote on a governance proposal.
 *
 * @remarks
 * Matches the `pub.chive.graph.vote` lexicon specification.
 * Votes are created in voter's PDSes.
 */
export const voteSchema = z.object({
  /** AT-URI of the proposal being voted on */
  proposalUri: z.string().min(1, 'Proposal URI is required'),

  /** Vote value */
  vote: z.enum(VOTE_VALUES),

  /** Rationale for the vote (recommended) */
  rationale: z.string().max(2000).optional(),

  /** Creation timestamp (ISO 8601) */
  createdAt: z.string().datetime().optional(),
});

export type Vote = z.infer<typeof voteSchema>;

// =============================================================================
// FORM-SPECIFIC SCHEMAS
// =============================================================================

/**
 * Create field proposal form data.
 *
 * @remarks
 * Used for the create proposal type.
 */
export const createFieldProposalFormSchema = z.object({
  fieldName: z
    .string()
    .min(2, 'Field name must be at least 2 characters')
    .max(200, 'Field name must be at most 200 characters'),

  description: z
    .string()
    .min(20, 'Description must be at least 20 characters')
    .max(5000, 'Description must be at most 5,000 characters'),

  alternateNames: z.array(z.string().max(200)).max(10).optional(),

  fieldType: z.enum(FIELD_TYPES).default('field'),

  parentFieldUri: z.string().optional(),

  wikidataId: z.string().optional(),

  fastId: z.string().optional(),

  rationale: z.string().max(5000).optional(),
});

export type CreateFieldProposalFormData = z.infer<typeof createFieldProposalFormSchema>;

/**
 * Modify field proposal form data.
 */
export const modifyFieldProposalFormSchema = z.object({
  existingFieldUri: z.string().min(1, 'Existing field is required'),

  fieldName: z.string().max(200).optional(),

  description: z.string().max(5000).optional(),

  alternateNames: z.array(z.string().max(200)).max(10).optional(),

  fieldType: z.enum(FIELD_TYPES).optional(),

  parentFieldUri: z.string().optional(),

  wikidataId: z.string().optional(),

  fastId: z.string().optional(),

  rationale: z.string().min(10, 'Rationale is required for modifications').max(5000),
});

export type ModifyFieldProposalFormData = z.infer<typeof modifyFieldProposalFormSchema>;

/**
 * Merge field proposal form data.
 */
export const mergeFieldProposalFormSchema = z.object({
  existingFieldUri: z.string().min(1, 'Source field is required'),

  mergeTargetUri: z.string().min(1, 'Target field is required'),

  rationale: z.string().min(20, 'Rationale is required for merges').max(5000),
});

export type MergeFieldProposalFormData = z.infer<typeof mergeFieldProposalFormSchema>;

/**
 * Deprecate field proposal form data.
 */
export const deprecateFieldProposalFormSchema = z.object({
  existingFieldUri: z.string().min(1, 'Field to deprecate is required'),

  replacementFieldUri: z.string().optional(),

  rationale: z.string().min(20, 'Rationale is required for deprecation').max(5000),
});

export type DeprecateFieldProposalFormData = z.infer<typeof deprecateFieldProposalFormSchema>;

/**
 * Vote form data.
 */
export const voteFormSchema = z.object({
  vote: z.enum(VOTE_VALUES),

  rationale: z.string().max(2000).optional(),
});

export type VoteFormData = z.infer<typeof voteFormSchema>;

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Validate Wikidata Q-ID format.
 *
 * @param qid - Wikidata Q-ID to validate
 * @returns True if valid Q-ID format
 *
 * @example
 * ```typescript
 * isValidWikidataId('Q12345'); // true
 * isValidWikidataId('12345'); // false
 * ```
 */
export function isValidWikidataId(qid: string): boolean {
  return /^Q\d+$/.test(qid);
}

/**
 * Validate FAST ID format.
 *
 * @param id - FAST ID to validate
 * @returns True if valid FAST ID format
 *
 * @example
 * ```typescript
 * isValidFastId('fst00977641'); // true
 * isValidFastId('977641'); // false
 * ```
 */
export function isValidFastId(id: string): boolean {
  return /^fst\d{8}$/.test(id);
}

/**
 * Build Wikidata URL from Q-ID.
 *
 * @param qid - Wikidata Q-ID
 * @returns Wikidata entity URL
 */
export function wikidataUrl(qid: string): string {
  return `https://www.wikidata.org/wiki/${qid}`;
}

/**
 * Build FAST URL from ID.
 *
 * @param id - FAST ID
 * @returns FAST authority URL
 */
export function fastUrl(id: string): string {
  return `http://id.worldcat.org/fast/${id.replace('fst', '')}`;
}

/**
 * Extract Q-ID from Wikidata URL or return Q-ID if already in that format.
 *
 * @param input - Wikidata URL or Q-ID
 * @returns Q-ID or null if invalid
 */
export function extractWikidataId(input: string): string | null {
  const trimmed = input.trim();

  // Already a Q-ID
  if (isValidWikidataId(trimmed)) {
    return trimmed;
  }

  // Extract from URL
  const match = /(?:wikidata\.org\/(?:wiki|entity)\/)(Q\d+)/.exec(trimmed);
  return match ? match[1] : null;
}
