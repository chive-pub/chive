/**
 * Claiming API schemas.
 *
 * @remarks
 * Zod schemas for claiming-related XRPC endpoints.
 * Claiming allows authors to claim ownership of eprints imported
 * from external sources (arXiv, LingBuzz, etc.).
 *
 * @packageDocumentation
 * @public
 */

import { z } from './base.js';

/**
 * Claim status schema.
 */
export const claimRequestStatusSchema = z.enum(['pending', 'approved', 'rejected', 'expired']);

export type ClaimRequestStatus = z.infer<typeof claimRequestStatusSchema>;

/**
 * Claim request schema.
 */
export const claimRequestSchema = z.object({
  id: z.number().int(),
  importId: z.number().int(),
  claimantDid: z.string(),
  status: claimRequestStatusSchema,
  canonicalUri: z.string().optional(),
  rejectionReason: z.string().optional(),
  reviewedBy: z.string().optional(),
  reviewedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
});

export type ClaimRequest = z.infer<typeof claimRequestSchema>;

// ============================================================================
// Request/Response Schemas
// ============================================================================

/**
 * Parameters for starting a claim.
 */
export const startClaimParamsSchema = z.object({
  importId: z.coerce.number().int().describe('ID of the imported eprint to claim'),
});

export type StartClaimParams = z.infer<typeof startClaimParamsSchema>;

/**
 * Response for starting a claim.
 */
export const startClaimResponseSchema = z.object({
  claim: claimRequestSchema,
});

export type StartClaimResponse = z.infer<typeof startClaimResponseSchema>;

/**
 * Parameters for completing a claim.
 */
export const completeClaimParamsSchema = z.object({
  claimId: z.coerce.number().int().describe('ID of the claim request'),
  canonicalUri: z.string().describe('AT-URI of the canonical record in user PDS'),
});

export type CompleteClaimParams = z.infer<typeof completeClaimParamsSchema>;

/**
 * Response for completing a claim.
 */
export const completeClaimResponseSchema = z.object({
  success: z.boolean(),
});

export type CompleteClaimResponse = z.infer<typeof completeClaimResponseSchema>;

/**
 * Parameters for approving a claim (admin only).
 */
export const approveClaimParamsSchema = z.object({
  claimId: z.coerce.number().int().describe('ID of the claim request'),
});

export type ApproveClaimParams = z.infer<typeof approveClaimParamsSchema>;

/**
 * Response for approving a claim.
 */
export const approveClaimResponseSchema = z.object({
  success: z.boolean(),
});

export type ApproveClaimResponse = z.infer<typeof approveClaimResponseSchema>;

/**
 * Parameters for rejecting a claim (admin only).
 */
export const rejectClaimParamsSchema = z.object({
  claimId: z.coerce.number().int().describe('ID of the claim request'),
  reason: z.string().min(1).max(500).describe('Rejection reason'),
});

export type RejectClaimParams = z.infer<typeof rejectClaimParamsSchema>;

/**
 * Response for rejecting a claim.
 */
export const rejectClaimResponseSchema = z.object({
  success: z.boolean(),
});

export type RejectClaimResponse = z.infer<typeof rejectClaimResponseSchema>;

/**
 * Parameters for getting a claim.
 */
export const getClaimParamsSchema = z.object({
  claimId: z.coerce.number().int().describe('ID of the claim request'),
});

export type GetClaimParams = z.infer<typeof getClaimParamsSchema>;

/**
 * Response for getting a claim.
 */
export const getClaimResponseSchema = z.object({
  claim: claimRequestSchema.nullable(),
});

export type GetClaimResponse = z.infer<typeof getClaimResponseSchema>;

/**
 * Parameters for getting user's claims.
 */
export const getUserClaimsParamsSchema = z.object({
  status: claimRequestStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
});

export type GetUserClaimsParams = z.infer<typeof getUserClaimsParamsSchema>;

/**
 * Response for getting user's claims.
 *
 * @remarks
 * Returns claims with full paper details for comprehensive display.
 * Uses inline paper schema since claimRequestWithPaperSchema is defined later.
 */
export const getUserClaimsResponseSchema = z.object({
  claims: z.array(
    claimRequestSchema.extend({
      paper: z.object({
        source: z.string(),
        externalId: z.string(),
        externalUrl: z.string(),
        title: z.string(),
        authors: z.array(
          z.object({
            name: z.string(),
            orcid: z.string().optional(),
            affiliation: z.string().optional(),
            email: z.string().optional(),
          })
        ),
        publicationDate: z.string().optional(),
        doi: z.string().optional(),
      }),
    })
  ),
  cursor: z.string().optional(),
  hasMore: z.boolean(),
});

export type GetUserClaimsResponse = z.infer<typeof getUserClaimsResponseSchema>;

/**
 * Parameters for finding claimable eprints.
 */
export const findClaimableParamsSchema = z.object({
  q: z.string().optional().describe('Search query (title, author name, DOI)'),
  source: z.string().optional().describe('Filter by source (arxiv, biorxiv, medrxiv, etc.)'),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
});

export type FindClaimableParams = z.infer<typeof findClaimableParamsSchema>;

/**
 * Response for finding claimable eprints.
 */
export const findClaimableResponseSchema = z.object({
  eprints: z.array(
    z.object({
      id: z.number().int(),
      source: z.string(),
      externalId: z.string(),
      url: z.string().url(),
      title: z.string(),
      authors: z.array(
        z.object({
          name: z.string(),
          orcid: z.string().optional(),
          affiliation: z.string().optional(),
        })
      ),
      publicationDate: z.string().datetime().optional(),
      doi: z.string().optional(),
    })
  ),
  cursor: z.string().optional(),
  hasMore: z.boolean(),
});

export type FindClaimableResponse = z.infer<typeof findClaimableResponseSchema>;

/**
 * Parameters for getting pending claims (admin only).
 */
export const getPendingClaimsParamsSchema = z.object({
  minScore: z.coerce.number().min(0).max(1).optional(),
  maxScore: z.coerce.number().min(0).max(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
});

export type GetPendingClaimsParams = z.infer<typeof getPendingClaimsParamsSchema>;

/**
 * Response for getting pending claims.
 */
export const getPendingClaimsResponseSchema = z.object({
  claims: z.array(claimRequestSchema),
  cursor: z.string().optional(),
  hasMore: z.boolean(),
});

export type GetPendingClaimsResponse = z.infer<typeof getPendingClaimsResponseSchema>;

// ============================================================================
// External Search Schemas
// ============================================================================

/**
 * Import source identifier schema.
 *
 * @remarks
 * Import sources are EXTENSIBLE - any plugin can introduce its own source identifier.
 * This is intentionally NOT an enum to allow third-party plugins to add new sources
 * without modifying core Chive code.
 *
 * **Format requirements:**
 * - Lowercase alphanumeric characters only (a-z, 0-9)
 * - 2-50 characters long
 * - No special characters, hyphens, or underscores
 *
 * **Known built-in sources (for documentation, not validation):**
 * - Eprint servers: arxiv, biorxiv, medrxiv, psyarxiv, lingbuzz, semanticsarchive, openreview, ssrn, osf
 * - Data/code repositories: zenodo, figshare, dryad, softwareheritage, gitlab
 * - Academic databases: openalex, semanticscholar, crossref, philpapers
 * - Authority/vocabulary: ror, wikidata, fast
 * - Fallback: other
 *
 * @example
 * // Valid source identifiers
 * 'arxiv'
 * 'semanticscholar'
 * 'mybiorxiv2'
 *
 * // Invalid source identifiers
 * 'my-arxiv'    // No hyphens
 * 'MY_SOURCE'   // No uppercase or underscores
 * 'a'           // Too short (min 2 chars)
 */
export const importSourceSchema = z
  .string()
  .min(2, 'Import source must be at least 2 characters')
  .max(50, 'Import source must be at most 50 characters')
  .regex(/^[a-z0-9]+$/, 'Import source must be lowercase alphanumeric only (a-z, 0-9)')
  .describe('External source identifier (e.g., arxiv, semanticscholar)');

export type ImportSourceType = z.infer<typeof importSourceSchema>;

/**
 * Well-known import sources for UI display and autocomplete.
 *
 * @remarks
 * This is NOT used for validation - any valid source string is accepted.
 * These are provided for UI convenience (dropdowns, icons, display names).
 * Plugins may add their own sources without being listed here.
 */
export const WELL_KNOWN_SOURCES = {
  // Eprint servers
  arxiv: { name: 'arXiv', category: 'eprint' },
  biorxiv: { name: 'bioRxiv', category: 'eprint' },
  medrxiv: { name: 'medRxiv', category: 'eprint' },
  psyarxiv: { name: 'PsyArXiv', category: 'eprint' },
  lingbuzz: { name: 'LingBuzz', category: 'eprint' },
  semanticsarchive: { name: 'Semantics Archive', category: 'eprint' },
  openreview: { name: 'OpenReview', category: 'eprint' },
  ssrn: { name: 'SSRN', category: 'eprint' },
  osf: { name: 'OSF Eprints', category: 'eprint' },
  // Data/code repositories
  zenodo: { name: 'Zenodo', category: 'repository' },
  figshare: { name: 'figshare', category: 'repository' },
  dryad: { name: 'Dryad', category: 'repository' },
  softwareheritage: { name: 'Software Heritage', category: 'repository' },
  gitlab: { name: 'GitLab', category: 'repository' },
  // Academic databases
  openalex: { name: 'OpenAlex', category: 'database' },
  semanticscholar: { name: 'Semantic Scholar', category: 'database' },
  crossref: { name: 'Crossref', category: 'database' },
  philpapers: { name: 'PhilPapers', category: 'database' },
  // Authority/vocabulary
  ror: { name: 'ROR', category: 'authority' },
  wikidata: { name: 'Wikidata', category: 'authority' },
  fast: { name: 'FAST', category: 'authority' },
  // Fallback
  other: { name: 'Other', category: 'other' },
} as const;

/**
 * External eprint author schema.
 */
export const externalEprintAuthorSchema = z.object({
  name: z.string(),
  orcid: z.string().optional(),
  affiliation: z.string().optional(),
  email: z.string().email().optional(),
});

export type ExternalEprintAuthor = z.infer<typeof externalEprintAuthorSchema>;

/**
 * Paper details embedded in claim response.
 */
export const claimPaperDetailsSchema = z.object({
  source: importSourceSchema.describe('Source system'),
  externalId: z.string().describe('Source-specific identifier'),
  externalUrl: z.string().url().describe('URL to the eprint'),
  title: z.string().describe('Eprint title'),
  authors: z.array(externalEprintAuthorSchema).describe('Author list'),
  publicationDate: z.string().optional().describe('Publication date'),
  doi: z.string().optional().describe('DOI if assigned'),
});

export type ClaimPaperDetails = z.infer<typeof claimPaperDetailsSchema>;

/**
 * Claim request with paper details for display.
 */
export const claimRequestWithPaperSchema = claimRequestSchema.extend({
  paper: claimPaperDetailsSchema.describe('Paper details from import'),
});

export type ClaimRequestWithPaper = z.infer<typeof claimRequestWithPaperSchema>;

/**
 * Existing Chive paper reference for duplicate detection.
 */
export const existingChivePaperSchema = z.object({
  uri: z.string().describe('AT-URI of the existing paper'),
  title: z.string().describe('Paper title'),
  authors: z
    .array(
      z.object({
        did: z.string().optional(),
        name: z.string(),
      })
    )
    .describe('Author list'),
  createdAt: z.string().datetime().describe('When the paper was indexed'),
});

export type ExistingChivePaper = z.infer<typeof existingChivePaperSchema>;

/**
 * External eprint schema.
 */
export const externalEprintSchema = z.object({
  externalId: z.string().describe('Source-specific identifier'),
  url: z.string().url().describe('Full URL to the eprint'),
  title: z.string().describe('Eprint title'),
  abstract: z.string().optional().describe('Abstract text'),
  authors: z.array(externalEprintAuthorSchema).describe('Author list'),
  publicationDate: z.string().datetime().optional().describe('Publication date'),
  doi: z.string().optional().describe('DOI if assigned'),
  pdfUrl: z.string().url().optional().describe('URL to PDF'),
  categories: z.array(z.string()).optional().describe('Subject categories'),
  source: importSourceSchema.describe('Source system'),
  /** Existing Chive paper if this is a duplicate */
  existingChivePaper: existingChivePaperSchema.optional(),
});

export type ExternalEprintResponse = z.infer<typeof externalEprintSchema>;

/**
 * Parameters for searching external eprint sources.
 */
export const searchEprintsParamsSchema = z.object({
  query: z.string().optional().describe('Title or keyword search query'),
  author: z.string().optional().describe('Author name to search for'),
  sources: z.string().optional().describe('Comma-separated list of sources to search'),
  limit: z.coerce.number().int().min(1).max(50).optional().describe('Maximum results'),
});

export type SearchEprintsParams = z.infer<typeof searchEprintsParamsSchema>;

/**
 * Response for searching external eprint sources.
 */
export const searchEprintsResponseSchema = z.object({
  eprints: z.array(externalEprintSchema),
  facets: z
    .object({
      sources: z.record(z.string(), z.number()).describe('Result counts by source'),
    })
    .optional(),
});

export type SearchEprintsResponse = z.infer<typeof searchEprintsResponseSchema>;

/**
 * Parameters for autocomplete search.
 */
export const autocompleteParamsSchema = z.object({
  query: z.string().min(2).describe('Search query prefix'),
  limit: z.coerce.number().int().min(1).max(10).optional().describe('Maximum suggestions'),
});

export type AutocompleteParams = z.infer<typeof autocompleteParamsSchema>;

/**
 * Autocomplete suggestion schema.
 */
export const autocompleteSuggestionSchema = z.object({
  title: z.string().describe('Eprint title'),
  authors: z.string().describe('First 2 authors joined'),
  source: importSourceSchema.describe('Source system'),
  externalId: z.string().describe('Source-specific identifier'),
  highlightedTitle: z.string().optional().describe('Title with query portion highlighted'),
  fieldMatchScore: z.number().optional().describe('User field relevance score'),
});

export type AutocompleteSuggestion = z.infer<typeof autocompleteSuggestionSchema>;

/**
 * Response for autocomplete search.
 */
export const autocompleteResponseSchema = z.object({
  suggestions: z.array(autocompleteSuggestionSchema),
});

export type AutocompleteResponse = z.infer<typeof autocompleteResponseSchema>;

/**
 * Parameters for starting a claim from external search.
 */
export const startClaimFromExternalParamsSchema = z.object({
  source: importSourceSchema.describe('External source'),
  externalId: z.string().describe('Source-specific identifier'),
});

export type StartClaimFromExternalParams = z.infer<typeof startClaimFromExternalParamsSchema>;

/**
 * Response for starting a claim from external search.
 */
export const startClaimFromExternalResponseSchema = z.object({
  claim: claimRequestSchema,
});

export type StartClaimFromExternalResponse = z.infer<typeof startClaimFromExternalResponseSchema>;

// ============================================================================
// Paper Suggestions Schemas
// ============================================================================

/**
 * Suggested paper with match score.
 */
export const suggestedPaperSchema = z.object({
  externalId: z.string().describe('Source-specific identifier'),
  url: z.string().url().describe('Full URL to the eprint'),
  title: z.string().describe('Eprint title'),
  abstract: z.string().optional().describe('Abstract text'),
  authors: z.array(externalEprintAuthorSchema).describe('Author list'),
  publicationDate: z.string().datetime().optional().describe('Publication date'),
  doi: z.string().optional().describe('DOI if assigned'),
  pdfUrl: z.string().url().optional().describe('URL to PDF'),
  categories: z.array(z.string()).optional().describe('Subject categories'),
  source: importSourceSchema.describe('Source system'),
  matchScore: z.number().min(0).max(100).describe('Match confidence score (0-100)'),
  matchReason: z.string().describe('Human-readable match reason'),
});

export type SuggestedPaper = z.infer<typeof suggestedPaperSchema>;

/**
 * Parameters for getting suggested papers.
 */
export const getSuggestionsParamsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().describe('Maximum results'),
});

export type GetSuggestionsParams = z.infer<typeof getSuggestionsParamsSchema>;

/**
 * Profile metadata used for suggestions.
 */
export const suggestionsProfileMetadataSchema = z.object({
  displayName: z.string().optional().describe('User display name'),
  nameVariants: z.array(z.string()).describe('Name variants used for matching'),
  hasOrcid: z.boolean().describe('Whether user has ORCID linked'),
  hasExternalIds: z.boolean().describe('Whether user has external authority IDs'),
});

export type SuggestionsProfileMetadata = z.infer<typeof suggestionsProfileMetadataSchema>;

/**
 * Response for getting suggested papers.
 */
export const getSuggestionsResponseSchema = z.object({
  papers: z.array(suggestedPaperSchema).describe('Suggested papers sorted by match score'),
  profileUsed: suggestionsProfileMetadataSchema.describe('Profile data used for matching'),
});

export type GetSuggestionsResponse = z.infer<typeof getSuggestionsResponseSchema>;

// ============================================================================
// Co-Author Claim Schemas
// ============================================================================

/**
 * Co-author claim status.
 */
export const coauthorClaimStatusSchema = z.enum(['pending', 'approved', 'rejected']);

export type CoauthorClaimStatus = z.infer<typeof coauthorClaimStatusSchema>;

/**
 * Co-author claim request.
 */
export const coauthorClaimRequestSchema = z.object({
  id: z.number().int(),
  eprintUri: z.string().describe('AT-URI of the eprint record'),
  eprintOwnerDid: z.string().describe('DID of the PDS owner'),
  claimantDid: z.string().describe('DID of the claimant'),
  claimantName: z.string().describe('Display name at time of request'),
  authorIndex: z.number().int().describe('Index of the author entry being claimed (0-based)'),
  authorName: z.string().describe('Name of the author entry being claimed'),
  status: coauthorClaimStatusSchema,
  message: z.string().optional().describe('Message from claimant'),
  rejectionReason: z.string().optional().describe('Rejection reason'),
  createdAt: z.string().datetime(),
  reviewedAt: z.string().datetime().optional(),
});

export type CoauthorClaimRequestResponse = z.infer<typeof coauthorClaimRequestSchema>;

/**
 * Parameters for requesting co-authorship.
 */
export const requestCoauthorshipParamsSchema = z.object({
  eprintUri: z.string().describe('AT-URI of the eprint record'),
  eprintOwnerDid: z.string().describe('DID of the PDS owner'),
  claimantName: z.string().min(1).max(200).describe('Display name for the request'),
  authorIndex: z.coerce
    .number()
    .int()
    .min(0)
    .describe('Index of the author entry being claimed (0-based)'),
  authorName: z.string().min(1).max(200).describe('Name of the author entry being claimed'),
  message: z.string().max(1000).optional().describe('Optional message to PDS owner'),
});

export type RequestCoauthorshipParams = z.infer<typeof requestCoauthorshipParamsSchema>;

/**
 * Response for requesting co-authorship.
 */
export const requestCoauthorshipResponseSchema = z.object({
  request: coauthorClaimRequestSchema,
});

export type RequestCoauthorshipResponse = z.infer<typeof requestCoauthorshipResponseSchema>;

/**
 * Parameters for getting co-author requests (for owner).
 */
export const getCoauthorRequestsParamsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
});

export type GetCoauthorRequestsParams = z.infer<typeof getCoauthorRequestsParamsSchema>;

/**
 * Response for getting co-author requests.
 */
export const getCoauthorRequestsResponseSchema = z.object({
  requests: z.array(coauthorClaimRequestSchema),
  cursor: z.string().optional(),
});

export type GetCoauthorRequestsResponse = z.infer<typeof getCoauthorRequestsResponseSchema>;

/**
 * Parameters for approving a co-author request.
 */
export const approveCoauthorParamsSchema = z.object({
  requestId: z.coerce.number().int().describe('ID of the co-author request'),
});

export type ApproveCoauthorParams = z.infer<typeof approveCoauthorParamsSchema>;

/**
 * Response for approving a co-author request.
 */
export const approveCoauthorResponseSchema = z.object({
  success: z.boolean(),
});

export type ApproveCoauthorResponse = z.infer<typeof approveCoauthorResponseSchema>;

/**
 * Parameters for rejecting a co-author request.
 */
export const rejectCoauthorParamsSchema = z.object({
  requestId: z.coerce.number().int().describe('ID of the co-author request'),
  reason: z.string().max(500).optional().describe('Rejection reason'),
});

export type RejectCoauthorParams = z.infer<typeof rejectCoauthorParamsSchema>;

/**
 * Response for rejecting a co-author request.
 */
export const rejectCoauthorResponseSchema = z.object({
  success: z.boolean(),
});

export type RejectCoauthorResponse = z.infer<typeof rejectCoauthorResponseSchema>;

/**
 * Parameters for getting my co-author requests (as claimant).
 */
export const getMyCoauthorRequestsParamsSchema = z.object({
  status: coauthorClaimStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
});

export type GetMyCoauthorRequestsParams = z.infer<typeof getMyCoauthorRequestsParamsSchema>;

/**
 * Response for getting my co-author requests.
 */
export const getMyCoauthorRequestsResponseSchema = z.object({
  requests: z.array(coauthorClaimRequestSchema),
  cursor: z.string().optional(),
});

export type GetMyCoauthorRequestsResponse = z.infer<typeof getMyCoauthorRequestsResponseSchema>;
