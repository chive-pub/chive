/**
 * Preprint submission validation schemas.
 *
 * @remarks
 * Zod schemas that match the `pub.chive.preprint.submission` lexicon specification.
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
 * Maximum file size for PDF documents (50MB).
 */
export const MAX_PDF_SIZE_BYTES = 52_428_800;

/**
 * Maximum file size for supplementary materials (100MB).
 */
export const MAX_SUPPLEMENTARY_SIZE_BYTES = 104_857_600;

/**
 * Supported content licenses.
 */
export const SUPPORTED_LICENSES = [
  'cc-by-4.0',
  'cc-by-sa-4.0',
  'cc-by-nc-4.0',
  'cc-by-nc-sa-4.0',
  'cc0-1.0',
  'arxiv-perpetual',
] as const;

/**
 * Supplementary material types.
 */
export const SUPPLEMENTARY_TYPES = ['data', 'code', 'figure', 'appendix', 'other'] as const;

/**
 * External link types for repositories.
 */
export const EXTERNAL_LINK_TYPES = [
  'github',
  'gitlab',
  'zenodo',
  'osf',
  'figshare',
  'dryad',
  'dataverse',
  'other',
] as const;

/**
 * PMEST facet dimensions (Ranganathan's Colon Classification).
 */
export const PMEST_DIMENSIONS = ['personality', 'matter', 'energy', 'space', 'time'] as const;

/**
 * FAST entity facet types.
 */
export const FAST_FACET_TYPES = ['person', 'organization', 'event', 'work', 'form-genre'] as const;

/**
 * All facet types (PMEST + FAST).
 */
export const ALL_FACET_TYPES = [...PMEST_DIMENSIONS, ...FAST_FACET_TYPES] as const;

// =============================================================================
// AUTHOR SCHEMAS
// =============================================================================

/**
 * Author reconciliation status.
 */
export const reconciliationStatusSchema = z.enum([
  'verified',
  'suggested',
  'unreconciled',
  'disputed',
]);

export type ReconciliationStatus = z.infer<typeof reconciliationStatusSchema>;

/**
 * External author profile link.
 */
export const externalProfileSchema = z.object({
  /** Platform name */
  platform: z.string().max(50),
  /** Profile URL */
  url: z.string().url(),
  /** Profile identifier */
  identifier: z.string().optional(),
});

export type ExternalProfile = z.infer<typeof externalProfileSchema>;

/**
 * Author reference for preprint submissions.
 *
 * @remarks
 * Supports extensive external identifier linking for author disambiguation.
 * Required fields: did, order. All others are optional but recommended.
 */
export const authorRefSchema = z.object({
  /** Author's decentralized identifier (required) */
  did: z.string().regex(/^did:[a-z]+:[a-zA-Z0-9._:%-]+$/, 'Invalid DID format'),

  /** Author order in byline (required, 1-indexed) */
  order: z.number().int().min(1),

  /** Display name */
  name: z.string().max(200).optional(),

  /** Institutional affiliation (free text) */
  affiliation: z.string().max(500).optional(),

  /** ROR identifier for institution (https://ror.org/...) */
  affiliationRor: z.string().url().optional(),

  /** ORCID identifier (https://orcid.org/...) */
  orcid: z
    .string()
    .regex(/^https:\/\/orcid\.org\/\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/, 'Invalid ORCID format')
    .optional(),

  /** ISNI identifier */
  isni: z.string().url().optional(),

  /** Scopus Author ID */
  scopusAuthorId: z.string().optional(),

  /** Semantic Scholar Author ID */
  semanticScholarId: z.string().optional(),

  /** OpenAlex author identifier */
  openAlexId: z.string().url().optional(),

  /** Google Scholar user ID */
  googleScholarId: z.string().optional(),

  /** Web of Science Researcher ID */
  researcherId: z.string().optional(),

  /** Additional external profiles */
  externalProfiles: z.array(externalProfileSchema).max(10).optional(),

  /** Reconciliation status */
  reconciliationStatus: reconciliationStatusSchema.optional(),

  /** Whether this is the corresponding author */
  corresponding: z.boolean().optional(),

  /** Indicates equal contribution */
  equalContribution: z.boolean().optional(),
});

export type AuthorRef = z.infer<typeof authorRefSchema>;

// =============================================================================
// FIELD AND FACET SCHEMAS
// =============================================================================

/**
 * Knowledge graph field node reference.
 *
 * @remarks
 * References an existing field in the knowledge graph.
 * Weight is optional but recommended for multi-field papers.
 */
export const fieldNodeRefSchema = z.object({
  /** AT-URI of the field node */
  uri: z
    .string()
    .regex(/^at:\/\/did:[a-z]+:[a-zA-Z0-9._:%-]+\/[a-z.]+\/[a-zA-Z0-9]+$/, 'Invalid AT-URI'),

  /** Relevance weight (0-1) for multi-field papers */
  weight: z.number().min(0).max(1).optional(),
});

export type FieldNodeRef = z.infer<typeof fieldNodeRefSchema>;

/**
 * Facet value for multi-dimensional classification.
 *
 * @remarks
 * Supports both PMEST and FAST facet dimensions.
 */
export const facetValueSchema = z.object({
  /** Facet dimension type */
  type: z.enum(ALL_FACET_TYPES),

  /** AT-URI of the facet value */
  value: z.string(),

  /** Human-readable label */
  label: z.string().max(200).optional(),
});

export type FacetValue = z.infer<typeof facetValueSchema>;

// =============================================================================
// SUPPLEMENTARY MATERIAL SCHEMAS
// =============================================================================

/**
 * Supplementary material blob reference.
 *
 * @remarks
 * Used for data, code, figures, and appendices.
 */
export const supplementaryBlobSchema = z.object({
  /** File reference (set after upload to PDS) */
  file: z.any().optional(), // BlobRef (runtime type)

  /** Description of this material */
  description: z.string().max(500),

  /** Type of supplementary material */
  type: z.enum(SUPPLEMENTARY_TYPES).optional(),

  /** Original filename */
  filename: z.string().max(255).optional(),
});

export type SupplementaryBlob = z.infer<typeof supplementaryBlobSchema>;

// =============================================================================
// EXTERNAL LINK AND FUNDING SCHEMAS
// =============================================================================

/**
 * External link to repositories or datasets.
 */
export const externalLinkSchema = z.object({
  /** Link URL */
  url: z.string().url(),

  /** Type of resource */
  type: z.enum(EXTERNAL_LINK_TYPES),

  /** Description of the link */
  description: z.string().max(200).optional(),
});

export type ExternalLink = z.infer<typeof externalLinkSchema>;

/**
 * Funding source information.
 */
export const fundingSourceSchema = z.object({
  /** Funding organization name */
  funder: z.string().max(200),

  /** Grant number */
  grantNumber: z.string().max(100).optional(),

  /** Funder DOI or ROR identifier */
  funderId: z.string().url().optional(),
});

export type FundingSource = z.infer<typeof fundingSourceSchema>;

/**
 * External identifier for external knowledge bases.
 */
export const externalIdentifierSchema = z.object({
  /** Identifier scheme (wikidata, doi, arxiv, pubmed, etc.) */
  scheme: z.string().max(50),

  /** Identifier value */
  value: z.string().max(200),

  /** Resolvable URL (if available) */
  url: z.string().url().optional(),
});

export type ExternalIdentifier = z.infer<typeof externalIdentifierSchema>;

// =============================================================================
// VERSION REFERENCE SCHEMA
// =============================================================================

/**
 * Reference to a previous version of the preprint.
 */
export const versionRefSchema = z.object({
  /** AT-URI of previous version record */
  uri: z.string(),

  /** CID of previous version */
  cid: z.string(),
});

export type VersionRef = z.infer<typeof versionRefSchema>;

// =============================================================================
// MAIN PREPRINT SUBMISSION SCHEMA
// =============================================================================

/**
 * Complete preprint submission schema.
 *
 * @remarks
 * Matches the `pub.chive.preprint.submission` lexicon specification.
 * Required fields: title, abstract, authors, document, fieldNodes, createdAt.
 *
 * @example
 * ```typescript
 * const result = preprintSubmissionSchema.safeParse(formData);
 * if (result.success) {
 *   // Create ATProto record
 *   await agent.com.atproto.repo.createRecord({
 *     repo: agent.session.did,
 *     collection: 'pub.chive.preprint.submission',
 *     record: { $type: 'pub.chive.preprint.submission', ...result.data }
 *   });
 * }
 * ```
 */
export const preprintSubmissionSchema = z.object({
  // Required fields
  /** Preprint title (max 500 chars) */
  title: z.string().min(1, 'Title is required').max(500, 'Title must be at most 500 characters'),

  /** Abstract or summary (max 10000 chars) */
  abstract: z
    .string()
    .min(50, 'Abstract must be at least 50 characters')
    .max(10000, 'Abstract must be at most 10,000 characters'),

  /** List of authors with DIDs */
  authors: z
    .array(authorRefSchema)
    .min(1, 'At least one author is required')
    .refine((authors) => authors.some((a) => a.order === 1), 'First author (order 1) is required'),

  /** PDF document blob reference (set after upload) */
  document: z.any().optional(), // BlobRef (runtime validation)

  /** Knowledge graph field nodes (1-10 required) */
  fieldNodes: z
    .array(fieldNodeRefSchema)
    .min(1, 'At least one field is required')
    .max(10, 'Maximum 10 fields allowed'),

  /** Creation timestamp (ISO 8601) */
  createdAt: z.string().datetime().optional(),

  // Optional fields
  /** Supplementary materials */
  supplementaryMaterials: z.array(supplementaryBlobSchema).max(20).optional(),

  /** Multi-dimensional faceted classification */
  facets: z.array(facetValueSchema).max(30).optional(),

  /** Free-text keywords */
  keywords: z.array(z.string().max(100)).max(20).optional(),

  /** Content license */
  license: z.enum(SUPPORTED_LICENSES).optional(),

  /** DOI if assigned */
  doi: z.string().url().optional(),

  /** Reference to previous version */
  previousVersion: versionRefSchema.optional(),

  /** External links (repositories, datasets) */
  externalLinks: z.array(externalLinkSchema).max(10).optional(),

  /** Funding sources */
  fundingInfo: z.array(fundingSourceSchema).optional(),

  /** Conflict of interest statement */
  conflictOfInterest: z.string().max(2000).optional(),

  /** Preregistration link */
  preregistration: z.string().url().optional(),

  /** External identifiers (Wikidata, DOI, arXiv, PubMed, etc.) */
  externalIdentifiers: z.array(externalIdentifierSchema).max(20).optional(),
});

export type PreprintSubmission = z.infer<typeof preprintSubmissionSchema>;

// =============================================================================
// FORM-SPECIFIC SCHEMAS
// =============================================================================

/**
 * Step 1: Files - PDF and supplementary materials.
 *
 * @remarks
 * Used for validating the first step of the submission wizard.
 */
export const stepFilesSchema = z.object({
  /** PDF file (File object before upload) */
  pdfFile: z
    .instanceof(File, { message: 'PDF file is required' })
    .refine((file) => file.size <= MAX_PDF_SIZE_BYTES, 'PDF must be at most 50MB')
    .refine((file) => file.type === 'application/pdf', 'File must be a PDF'),

  /** Supplementary files */
  supplementaryFiles: z
    .array(
      z.object({
        file: z
          .instanceof(File)
          .refine((f) => f.size <= MAX_SUPPLEMENTARY_SIZE_BYTES, 'File must be at most 100MB'),
        description: z.string().max(500),
        type: z.enum(SUPPLEMENTARY_TYPES).optional(),
      })
    )
    .max(20)
    .optional(),
});

export type StepFilesData = z.infer<typeof stepFilesSchema>;

/**
 * Step 2: Metadata - Title, abstract, keywords, license.
 */
export const stepMetadataSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500, 'Title must be at most 500 characters'),

  abstract: z
    .string()
    .min(50, 'Abstract must be at least 50 characters')
    .max(10000, 'Abstract must be at most 10,000 characters'),

  keywords: z.array(z.string().max(100)).max(20).optional(),

  license: z.enum(SUPPORTED_LICENSES).default('cc-by-4.0'),

  doi: z.string().url().optional().or(z.literal('')),

  preregistration: z.string().url().optional().or(z.literal('')),

  conflictOfInterest: z.string().max(2000).optional(),
});

export type StepMetadataData = z.infer<typeof stepMetadataSchema>;

/**
 * Step 3: Authors - Co-author management.
 */
export const stepAuthorsSchema = z.object({
  authors: z.array(authorRefSchema).min(1, 'At least one author is required'),

  fundingInfo: z.array(fundingSourceSchema).optional(),

  externalLinks: z.array(externalLinkSchema).max(10).optional(),
});

export type StepAuthorsData = z.infer<typeof stepAuthorsSchema>;

/**
 * Step 4: Fields - Knowledge graph classification.
 */
export const stepFieldsSchema = z.object({
  fieldNodes: z
    .array(fieldNodeRefSchema)
    .min(1, 'At least one field is required')
    .max(10, 'Maximum 10 fields allowed'),

  facets: z.array(facetValueSchema).max(30).optional(),
});

export type StepFieldsData = z.infer<typeof stepFieldsSchema>;

/**
 * Combined form data for all wizard steps.
 */
export const preprintFormDataSchema = stepFilesSchema
  .merge(stepMetadataSchema)
  .merge(stepAuthorsSchema)
  .merge(stepFieldsSchema);

export type PreprintFormData = z.infer<typeof preprintFormDataSchema>;

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Validate ORCID format.
 *
 * @param orcid - ORCID string to validate
 * @returns True if valid ORCID format
 *
 * @example
 * ```typescript
 * isValidOrcid('https://orcid.org/0000-0002-1825-0097'); // true
 * isValidOrcid('0000-0002-1825-0097'); // false (missing URL prefix)
 * ```
 */
export function isValidOrcid(orcid: string): boolean {
  return /^https:\/\/orcid\.org\/\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(orcid);
}

/**
 * Validate AT-URI format.
 *
 * @param uri - AT-URI string to validate
 * @returns True if valid AT-URI format
 */
export function isValidAtUri(uri: string): boolean {
  return /^at:\/\/did:[a-z]+:[a-zA-Z0-9._:%-]+\/[a-z.]+\/[a-zA-Z0-9]+$/.test(uri);
}

/**
 * Normalize ORCID to URL format.
 *
 * @param orcid - ORCID in any format (URL or bare ID)
 * @returns ORCID in URL format or null if invalid
 *
 * @example
 * ```typescript
 * normalizeOrcid('0000-0002-1825-0097'); // 'https://orcid.org/0000-0002-1825-0097'
 * normalizeOrcid('https://orcid.org/0000-0002-1825-0097'); // 'https://orcid.org/0000-0002-1825-0097'
 * ```
 */
export function normalizeOrcid(orcid: string): string | null {
  const bareOrcidPattern = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;
  const urlOrcidPattern = /^https:\/\/orcid\.org\/(\d{4}-\d{4}-\d{4}-\d{3}[\dX])$/;

  if (bareOrcidPattern.test(orcid)) {
    return `https://orcid.org/${orcid}`;
  }

  const match = urlOrcidPattern.exec(orcid);
  if (match) {
    return `https://orcid.org/${match[1]}`;
  }

  return null;
}
