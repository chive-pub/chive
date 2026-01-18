/**
 * Eprint submission validation schemas.
 *
 * @remarks
 * Zod schemas that match the `pub.chive.eprint.submission` lexicon specification.
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
 * Maximum file size for primary documents (50MB).
 */
export const MAX_DOCUMENT_SIZE_BYTES = 52_428_800;

/**
 * Maximum file size for supplementary materials (100MB).
 */
export const MAX_SUPPLEMENTARY_SIZE_BYTES = 104_857_600;

/**
 * Supported document formats for manuscripts.
 */
export const SUPPORTED_DOCUMENT_FORMATS = [
  'pdf',
  'docx',
  'html',
  'markdown',
  'latex',
  'jupyter',
  'odt',
  'rtf',
  'epub',
  'txt',
] as const;

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
 * Supplementary material categories.
 */
export const SUPPLEMENTARY_CATEGORIES = [
  'appendix',
  'figure',
  'table',
  'dataset',
  'code',
  'notebook',
  'video',
  'audio',
  'presentation',
  'protocol',
  'questionnaire',
  'other',
] as const;

/**
 * External link types for repositories and resources.
 */
export const EXTERNAL_LINK_TYPES = [
  // Code repositories
  'github',
  'gitlab',
  'bitbucket',
  // ML/AI platforms
  'huggingface',
  'kaggle',
  'paperswithcode',
  'wandb',
  'comet',
  // Data repositories
  'zenodo',
  'osf',
  'figshare',
  'dryad',
  'dataverse',
  'mendeley-data',
  // Project pages
  'project-page',
  'demo',
  'documentation',
  // Other
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
 * Author reference for eprint submissions.
 *
 * @remarks
 * Supports extensive external identifier linking for author disambiguation.
 * Required fields: did, order. All others are optional but recommended.
 */
export const authorRefSchema = z.object({
  /** Author's decentralized identifier (optional for external collaborators) */
  did: z
    .string()
    .regex(/^did:[a-z]+:[a-zA-Z0-9._:%-]+$/, 'Invalid DID format')
    .optional(),

  /** Author order in byline (required, 1-indexed) */
  order: z.number().int().min(1),

  /** Display name (required) */
  name: z.string().min(1).max(200),

  /** ORCID identifier */
  orcid: z.string().optional(),

  /** Contact email */
  email: z.string().email().optional().or(z.literal('')),

  /** Author affiliations */
  affiliations: z
    .array(
      z.object({
        name: z.string(),
        rorId: z.string().optional(),
        department: z.string().optional(),
      })
    )
    .default([]),

  /** CRediT contributions */
  contributions: z
    .array(
      z.object({
        typeUri: z.string(),
        typeId: z.string().optional(),
        typeLabel: z.string().optional(),
        degree: z.enum(['lead', 'equal', 'supporting']),
      })
    )
    .default([]),

  /** Whether this is the corresponding author */
  isCorrespondingAuthor: z.boolean().default(false),

  /** Whether this author is highlighted (co-first, co-last) */
  isHighlighted: z.boolean().default(false),

  /** Handle (optional, from ATProto profile) */
  handle: z.string().optional(),

  /** Avatar URL if available */
  avatarUrl: z.string().url().optional(),
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
 * Supplementary material with full metadata.
 *
 * @remarks
 * Used for data, code, figures, appendices, videos, and other materials.
 * Includes user-provided label, description, auto-detected category,
 * and display order.
 */
export const supplementaryMaterialSchema = z.object({
  /** File reference (set after upload to PDS) */
  file: z.any().optional(), // BlobRef (runtime type)

  /** User-provided label (e.g., "Figure S1", "Appendix A") */
  label: z.string().min(1).max(200),

  /** Optional description of this material */
  description: z.string().max(1000).optional(),

  /** Material category (auto-detected or user-specified) */
  category: z.enum(SUPPLEMENTARY_CATEGORIES),

  /** Auto-detected file format */
  detectedFormat: z.string().max(50).optional(),

  /** Display order (1-indexed) */
  order: z.number().int().min(1),
});

export type SupplementaryMaterial = z.infer<typeof supplementaryMaterialSchema>;

// =============================================================================
// EXTERNAL LINK AND FUNDING SCHEMAS
// =============================================================================

/**
 * Resource categories for external links.
 */
export const EXTERNAL_LINK_CATEGORIES = [
  'code',
  'dataset',
  'model',
  'demo',
  'documentation',
  'project-page',
  'video',
  'slides',
  'other',
] as const;

/**
 * External link to repositories or datasets.
 */
export const externalLinkSchema = z.object({
  /** Display label for the link */
  label: z.string().min(1).max(200),

  /** Link URL */
  url: z.string().url(),

  /** Type/platform of resource (auto-detected from URL) */
  type: z.enum(EXTERNAL_LINK_TYPES),

  /** Category of the resource (user-specified) */
  category: z.enum(EXTERNAL_LINK_CATEGORIES),

  /** Optional description */
  description: z.string().max(500).optional(),
});

export type ExternalLink = z.infer<typeof externalLinkSchema>;
export type ExternalLinkType = (typeof EXTERNAL_LINK_TYPES)[number];
export type ExternalLinkCategory = (typeof EXTERNAL_LINK_CATEGORIES)[number];

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
 * Reference to a previous version of the eprint.
 */
export const versionRefSchema = z.object({
  /** AT-URI of previous version record */
  uri: z.string(),

  /** CID of previous version */
  cid: z.string(),
});

export type VersionRef = z.infer<typeof versionRefSchema>;

// =============================================================================
// MAIN EPRINT SUBMISSION SCHEMA
// =============================================================================

/**
 * Complete eprint submission schema.
 *
 * @remarks
 * Matches the `pub.chive.eprint.submission` lexicon specification.
 * Required fields: title, abstract, authors, document, fieldNodes, createdAt.
 *
 * @example
 * ```typescript
 * const result = eprintSubmissionSchema.safeParse(formData);
 * if (result.success) {
 *   // Create ATProto record
 *   await agent.com.atproto.repo.createRecord({
 *     repo: agent.session.did,
 *     collection: 'pub.chive.eprint.submission',
 *     record: { $type: 'pub.chive.eprint.submission', ...result.data }
 *   });
 * }
 * ```
 */
export const eprintSubmissionSchema = z.object({
  // Required fields
  /** Eprint title (max 500 chars) */
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
  supplementaryMaterials: z.array(supplementaryMaterialSchema).max(50).optional(),

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

export type EprintSubmission = z.infer<typeof eprintSubmissionSchema>;

// =============================================================================
// FORM-SPECIFIC SCHEMAS
// =============================================================================

/**
 * Supplementary material input for form handling (with File object).
 */
export const supplementaryMaterialInputSchema = z.object({
  /** File object (before upload) */
  file: z
    .instanceof(File)
    .refine((f) => f.size <= MAX_SUPPLEMENTARY_SIZE_BYTES, 'File must be at most 100MB'),

  /** User-provided label */
  label: z.string().min(1).max(200),

  /** Optional description */
  description: z.string().max(1000).optional(),

  /** Material category */
  category: z.enum(SUPPLEMENTARY_CATEGORIES),

  /** Auto-detected file format */
  detectedFormat: z.string(),

  /** Display order */
  order: z.number().int().min(1),
});

export type SupplementaryMaterialInput = z.infer<typeof supplementaryMaterialInputSchema>;

/**
 * Step 1: Files - Document and supplementary materials.
 *
 * @remarks
 * Used for validating the first step of the submission wizard.
 * Supports multiple document formats (PDF, DOCX, HTML, Markdown, LaTeX, etc.).
 */
export const stepFilesSchema = z.object({
  /** Document file (File object before upload) */
  documentFile: z
    .instanceof(File, { message: 'Document file is required' })
    .refine((file) => file.size <= MAX_DOCUMENT_SIZE_BYTES, 'Document must be at most 50MB'),

  /** Detected document format */
  documentFormat: z.enum(SUPPORTED_DOCUMENT_FORMATS).optional(),

  /** Supplementary materials with full metadata */
  supplementaryMaterials: z.array(supplementaryMaterialInputSchema).max(50).optional(),
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
 * Step: Destination - Choose where to submit (user's PDS or paper's PDS).
 *
 * @remarks
 * This step allows users to choose whether to submit to their own PDS
 * or to a paper's dedicated PDS (for papers as first-class ATProto citizens).
 */
export const stepDestinationSchema = z.object({
  /** Whether to submit to a paper's PDS instead of user's PDS (defaults to false) */
  usePaperPds: z.boolean().optional(),

  /** Paper's DID (required if usePaperPds is true) */
  paperDid: z
    .string()
    .regex(/^did:[a-z]+:[a-zA-Z0-9._:%-]+$/, 'Invalid DID format')
    .optional(),
});

export type StepDestinationData = z.infer<typeof stepDestinationSchema>;

/**
 * Combined form data for all wizard steps.
 */
export const eprintFormDataSchema = stepFilesSchema
  .merge(stepMetadataSchema)
  .merge(stepAuthorsSchema)
  .merge(stepFieldsSchema)
  .merge(stepDestinationSchema);

export type EprintFormData = z.infer<typeof eprintFormDataSchema>;

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
