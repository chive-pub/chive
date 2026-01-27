/**
 * Transform PDS records to internal Eprint domain model.
 *
 * @remarks
 * This module bridges the gap between what the frontend writes to PDSes
 * and what the backend expects. It handles schema evolution by accepting
 * multiple formats and normalizing to the current internal model.
 *
 * **Key Transformations:**
 * - `document` → `documentBlobRef`
 * - `supplementaryMaterials[].blob` → `supplementaryMaterials[].blobRef`
 * - `abstract` (string OR RichTextItem[]) → `abstract` (RichTextBody)
 * - BlobRef structure: `ref.$link` → `ref` (CID string)
 *
 * **Schema Evolution:**
 * The transformer detects which format was used for each field and includes
 * compatibility metadata in the result. This enables API responses to include
 * schema hints for clients using legacy formats.
 *
 * @packageDocumentation
 * @public
 */

import { toTimestamp } from '../../types/atproto-validators.js';
import type { AtUri, BlobRef, CID, DID } from '../../types/atproto.js';
import { ValidationError } from '../../types/errors.js';
import type { Facet } from '../../types/interfaces/graph.interface.js';
import type {
  AnnotationBodyItem,
  DocumentFormat,
  RichTextBody,
} from '../../types/models/annotation.js';
import type {
  EprintAuthor,
  EprintAuthorAffiliation,
  EprintAuthorContribution,
} from '../../types/models/author.js';
import type {
  Eprint,
  SupplementaryMaterial,
  SupplementaryCategory,
} from '../../types/models/eprint.js';
import type { SchemaDetectionResult } from '../../types/schema-compatibility.js';
import { SchemaCompatibilityService } from '../schema/schema-compatibility.js';

// =============================================================================
// PDS RECORD TYPES (what frontend actually writes)
// =============================================================================

/**
 * BlobRef structure as stored in ATProto records.
 *
 * @remarks
 * ATProto BlobRefs use a nested structure with `ref.$link` containing the CID.
 * Our internal BlobRef uses `ref` directly as the CID string.
 */
interface PDSBlobRef {
  $type: 'blob';
  ref: { $link: string };
  mimeType: string;
  size: number;
}

/**
 * Author reference as stored in PDS.
 */
interface PDSAuthorRef {
  did?: string;
  name: string;
  order: number;
  email?: string;
  orcid?: string;
  handle?: string;
  avatarUrl?: string;
  affiliations?: { name: string; rorId?: string; department?: string }[];
  contributions?: {
    typeUri: string;
    typeId?: string;
    typeLabel?: string;
    degree: 'lead' | 'equal' | 'supporting';
  }[];
  isCorrespondingAuthor?: boolean;
  isHighlighted?: boolean;
}

/**
 * Supplementary material as stored in PDS.
 *
 * @remarks
 * Uses `blob` not `blobRef`.
 */
interface PDSSupplementaryMaterial {
  blob: PDSBlobRef;
  label: string;
  description?: string;
  category: string;
  detectedFormat?: string;
  order: number;
}

/**
 * Field node reference as stored in PDS.
 */
interface PDSFieldNode {
  uri: string;
  weight?: number;
}

/**
 * Facet value as stored in PDS.
 */
interface PDSFacetValue {
  type?: string;
  dimension?: string;
  label: string;
  value: string;
  nodeUri?: string;
}

/**
 * Rich text item as stored in current lexicon schema.
 *
 * @remarks
 * This is the current format for abstract items (schema >= 1.1.0).
 */
interface PDSRichTextItem {
  type: 'text' | 'nodeRef';
  content?: string;
  uri?: string;
  label?: string;
  subkind?: string;
}

/**
 * Eprint record structure as actually written by frontend to PDS.
 *
 * @remarks
 * This differs from both the lexicon schema AND the internal model.
 * The transformer normalizes this to the internal Eprint model.
 *
 * **Abstract Field Evolution:**
 * - Schema 1.0.0: `abstract` is a plain string
 * - Schema 1.1.0+: `abstract` is an array of RichTextItem
 *
 * **Title Field Evolution:**
 * - `title` is always a plain string (required)
 * - `titleRich` is an optional array of RichTextItem for formatted titles
 *   (contains LaTeX, entity references, etc.)
 *
 * The transformer accepts both formats for backward compatibility.
 */
export interface PDSEprintRecord {
  $type: 'pub.chive.eprint.submission';

  // REQUIRED FIELDS
  title: string;
  /**
   * Optional rich title array for formatted display.
   *
   * @remarks
   * Used when title contains LaTeX, subscripts, superscripts, or entity references.
   * The plain `title` field is kept for search indexing and fallback display.
   */
  titleRich?: PDSRichTextItem[];
  document: PDSBlobRef;
  authors: PDSAuthorRef[];
  createdAt: string;

  // OPTIONAL FIELDS
  submittedBy?: string;
  /**
   * Abstract can be either:
   * - string (legacy, schema 1.0.0)
   * - PDSRichTextItem[] (current, schema 1.1.0+)
   */
  abstract?: string | PDSRichTextItem[];
  documentFormat?: string;
  supplementaryMaterials?: PDSSupplementaryMaterial[];
  fieldNodes?: PDSFieldNode[];
  facets?: PDSFacetValue[];
  keywords?: string[];
  /** AT-URI to license node (subkind=license) - current format */
  licenseUri?: string;
  /** SPDX license identifier for display fallback - current format */
  licenseSlug?: string;
  /** Legacy license field (SPDX identifier) - for backward compatibility */
  license?: string;
  paperDid?: string;
  doi?: string;
  previousVersion?: { uri: string; cid: string };
  version?: number;
  externalLinks?: { type: string; url: string; label?: string }[];
  fundingInfo?: {
    funderName?: string;
    funderDoi?: string;
    funderRor?: string;
    grantNumber?: string;
    grantTitle?: string;
    grantUrl?: string;
  }[];
  conflictOfInterest?: string;
  preregistration?: string;
}

// =============================================================================
// TRANSFORMATION RESULT WITH SCHEMA METADATA
// =============================================================================

/**
 * Result of PDS record transformation.
 *
 * @remarks
 * Includes both the transformed Eprint model and schema compatibility
 * metadata. The schema metadata can be used to include migration hints
 * in API responses.
 *
 * @public
 */
export interface TransformResult {
  /**
   * Transformed eprint in internal model format.
   */
  readonly eprint: Eprint;

  /**
   * Schema compatibility detection results.
   *
   * @remarks
   * Includes information about detected legacy formats, deprecated fields,
   * and available migrations. Use this to generate API schema hints.
   */
  readonly schemaDetection: SchemaDetectionResult;

  /**
   * Detected format of the abstract field.
   *
   * @remarks
   * Indicates whether the source record used:
   * - 'string': Legacy plain text format (schema 1.0.0)
   * - 'rich-text-array': Current array format (schema 1.1.0+)
   * - 'empty': Abstract was missing or null
   */
  readonly abstractFormat: 'string' | 'rich-text-array' | 'empty';

  /**
   * Detected format of the title field.
   *
   * @remarks
   * Indicates whether the source record:
   * - 'plain': Plain title with no special formatting needed
   * - 'plain-needs-rich': Plain title with special characters that would benefit from titleRich
   * - 'with-rich': Title has accompanying titleRich array
   * - 'empty': Title was missing (invalid record)
   */
  readonly titleFormat: 'plain' | 'plain-needs-rich' | 'with-rich' | 'empty';
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Transform a PDS BlobRef to internal BlobRef format.
 *
 * @param pdsBlobRef - BlobRef from PDS with nested ref.$link structure
 * @returns Internal BlobRef with CID as string
 */
function transformBlobRef(pdsBlobRef: PDSBlobRef): BlobRef {
  // Handle both raw JSON format and AtpAgent-parsed CID objects
  // Raw JSON: ref: { $link: "bafkrei..." }
  // AtpAgent: ref: CID(bafkrei...) - already a CID object with .toString()
  let cidString: string;

  if (pdsBlobRef.ref && typeof pdsBlobRef.ref === 'object') {
    if ('$link' in pdsBlobRef.ref) {
      // Raw JSON format from fetch()
      cidString = (pdsBlobRef.ref as { $link: string }).$link;
    } else if (typeof (pdsBlobRef.ref as { toString: () => string }).toString === 'function') {
      // AtpAgent-parsed CID object
      cidString = (pdsBlobRef.ref as { toString: () => string }).toString();
    } else {
      throw new ValidationError('Invalid blob ref structure', 'ref');
    }
  } else if (typeof pdsBlobRef.ref === 'string') {
    // Already a string
    cidString = pdsBlobRef.ref;
  } else {
    throw new ValidationError('Invalid blob ref structure', 'ref');
  }

  // Validate mimeType
  if (typeof pdsBlobRef.mimeType !== 'string') {
    throw new ValidationError('Invalid blob ref: missing mimeType', 'mimeType');
  }

  // Validate size
  if (typeof pdsBlobRef.size !== 'number' || !Number.isFinite(pdsBlobRef.size)) {
    throw new ValidationError('Invalid blob ref: invalid size', 'size');
  }

  return {
    $type: 'blob',
    ref: cidString as CID,
    mimeType: pdsBlobRef.mimeType,
    size: pdsBlobRef.size,
  };
}

/**
 * Transform PDS author to internal EprintAuthor model.
 */
function transformAuthor(pdsAuthor: PDSAuthorRef, index: number): EprintAuthor {
  const affiliations: readonly EprintAuthorAffiliation[] = (pdsAuthor.affiliations ?? []).map(
    (aff) => ({
      name: aff.name,
      rorId: aff.rorId,
      department: aff.department,
    })
  );

  // Transform contributions with proper AtUri casting
  const contributions: readonly EprintAuthorContribution[] = (pdsAuthor.contributions ?? []).map(
    (contrib) => ({
      typeUri: contrib.typeUri as AtUri,
      typeId: contrib.typeId,
      typeLabel: contrib.typeLabel,
      degree: contrib.degree,
    })
  );

  return {
    did: pdsAuthor.did as DID | undefined,
    name: pdsAuthor.name,
    order: pdsAuthor.order ?? index + 1,
    email: pdsAuthor.email,
    orcid: pdsAuthor.orcid,
    handle: pdsAuthor.handle,
    avatarUrl: pdsAuthor.avatarUrl,
    affiliations,
    contributions,
    isCorrespondingAuthor: pdsAuthor.isCorrespondingAuthor ?? false,
    isHighlighted: pdsAuthor.isHighlighted ?? false,
  };
}

/**
 * Transform supplementary material from PDS format.
 *
 * @remarks
 * Maps `blob` to `blobRef`.
 */
function transformSupplementaryMaterial(
  pdsMaterial: PDSSupplementaryMaterial,
  index: number
): SupplementaryMaterial {
  return {
    blobRef: transformBlobRef(pdsMaterial.blob),
    label: pdsMaterial.label,
    description: pdsMaterial.description,
    category: (pdsMaterial.category || 'other') as SupplementaryCategory,
    detectedFormat: pdsMaterial.detectedFormat,
    order: pdsMaterial.order ?? index + 1,
  };
}

/**
 * Detected abstract format from PDS record.
 */
type DetectedAbstractFormat = 'string' | 'rich-text-array' | 'empty';

/**
 * Result of abstract transformation.
 */
interface AbstractTransformResult {
  richTextBody: RichTextBody;
  plainText: string | undefined;
  detectedFormat: DetectedAbstractFormat;
}

/**
 * Detected title format from PDS record.
 */
type DetectedTitleFormat = 'plain' | 'plain-needs-rich' | 'with-rich' | 'empty';

/**
 * Result of title transformation.
 */
interface TitleTransformResult {
  /**
   * Plain text title for search and display.
   */
  title: string;
  /**
   * Rich text body for formatted display (if titleRich is present).
   */
  titleRich: RichTextBody | undefined;
  /**
   * Detected format.
   */
  detectedFormat: DetectedTitleFormat;
}

/**
 * Regular expression patterns for detecting special formatting in titles.
 */
const LATEX_INLINE_PATTERN = /\$[^$]+\$/;
const LATEX_DISPLAY_PATTERN = /\$\$[^$]+\$\$/;
const LATEX_COMMAND_PATTERN = /\\[a-zA-Z]+(\{[^}]*\}|\[[^\]]*\])*/;
const SUBSCRIPT_PATTERN = /_\{[^}]+\}|_[a-zA-Z0-9]/;
const SUPERSCRIPT_PATTERN = /\^\{[^}]+\}|\^[a-zA-Z0-9]/;

/**
 * Transform abstract from PDS format to internal RichTextBody.
 *
 * @remarks
 * Handles both legacy string format and current RichTextItem[] format.
 * This is the key schema evolution point for the abstract field.
 *
 * **Format Detection:**
 * - If `abstract` is undefined/null: returns empty RichTextBody
 * - If `abstract` is a string: wraps in single text item (legacy format)
 * - If `abstract` is an array: transforms each item (current format)
 *
 * @param abstract - Abstract from PDS record (string or RichTextItem[])
 * @returns Transformed RichTextBody with format detection
 */
function transformAbstract(abstract: unknown): AbstractTransformResult {
  // Empty or missing
  if (abstract === undefined || abstract === null) {
    return {
      richTextBody: {
        type: 'RichText',
        items: [],
        format: 'application/x-chive-gloss+json',
      },
      plainText: undefined,
      detectedFormat: 'empty',
    };
  }

  // Legacy string format (schema 1.0.0)
  if (typeof abstract === 'string') {
    return {
      richTextBody: {
        type: 'RichText',
        items: abstract ? [{ type: 'text', content: abstract }] : [],
        format: 'application/x-chive-gloss+json',
      },
      plainText: abstract || undefined,
      detectedFormat: 'string',
    };
  }

  // Current array format (schema 1.1.0+)
  if (Array.isArray(abstract)) {
    const items: AnnotationBodyItem[] = [];
    const plainTextParts: string[] = [];

    for (const item of abstract) {
      // Skip malformed items (non-objects). This is intentional: we preserve
      // well-formed items and silently skip invalid ones to maintain forward
      // compatibility with future item types that may be added to the schema.
      if (typeof item !== 'object' || item === null) {
        continue;
      }

      const typedItem = item as PDSRichTextItem;

      if (typedItem.type === 'text' && typeof typedItem.content === 'string') {
        items.push({ type: 'text', content: typedItem.content });
        plainTextParts.push(typedItem.content);
      } else if (typedItem.type === 'nodeRef' && typeof typedItem.uri === 'string') {
        items.push({
          type: 'nodeRef',
          uri: typedItem.uri as AtUri,
          label: typedItem.label ?? '',
          subkind: typedItem.subkind,
        });
        // Include label in plain text for node refs
        if (typedItem.label) {
          plainTextParts.push(typedItem.label);
        }
      }
      // Unknown item types are silently skipped. This is intentional for forward
      // compatibility: if future schema versions add new item types, older code
      // will gracefully ignore them rather than failing. The items array will
      // contain all recognized types, preserving as much content as possible.
    }

    return {
      richTextBody: {
        type: 'RichText',
        items,
        format: 'application/x-chive-gloss+json',
      },
      plainText: plainTextParts.length > 0 ? plainTextParts.join('') : undefined,
      detectedFormat: 'rich-text-array',
    };
  }

  // Unknown format, treat as empty
  return {
    richTextBody: {
      type: 'RichText',
      items: [],
      format: 'application/x-chive-gloss+json',
    },
    plainText: undefined,
    detectedFormat: 'empty',
  };
}

/**
 * Check if a title contains special formatting that would benefit from rich text.
 *
 * @param title - Plain text title
 * @returns True if title contains LaTeX, subscripts, superscripts, etc.
 */
function titleContainsSpecialFormatting(title: string): boolean {
  return (
    LATEX_INLINE_PATTERN.test(title) ||
    LATEX_DISPLAY_PATTERN.test(title) ||
    LATEX_COMMAND_PATTERN.test(title) ||
    SUBSCRIPT_PATTERN.test(title) ||
    SUPERSCRIPT_PATTERN.test(title)
  );
}

/**
 * Transform title from PDS format to internal representation.
 *
 * @remarks
 * Handles both plain titles and titles with rich formatting.
 *
 * **Format Detection:**
 * - If `titleRich` is present and valid: returns with-rich format
 * - If `title` contains special chars but no `titleRich`: returns plain-needs-rich
 * - If `title` is plain text: returns plain format
 *
 * @param title - Plain text title string
 * @param titleRich - Optional rich text array for formatted title
 * @returns Transformed title with format detection
 */
function transformTitle(title: unknown, titleRich: unknown): TitleTransformResult {
  // Handle missing or invalid title
  if (title === undefined || title === null || title === '') {
    return {
      title: '',
      titleRich: undefined,
      detectedFormat: 'empty',
    };
  }

  if (typeof title !== 'string') {
    return {
      title: '', // Invalid title type; treat as empty
      titleRich: undefined,
      detectedFormat: 'empty',
    };
  }

  // Check if titleRich is present and valid
  if (titleRich !== undefined && titleRich !== null && Array.isArray(titleRich)) {
    const items: AnnotationBodyItem[] = [];

    for (const item of titleRich) {
      if (typeof item !== 'object' || item === null) {
        continue;
      }

      const typedItem = item as PDSRichTextItem;

      // Type the item as a generic rich text item for type checking
      const itemType = (typedItem as { type: string }).type;

      if (itemType === 'text' && typeof typedItem.content === 'string') {
        items.push({ type: 'text', content: typedItem.content });
      } else if (itemType === 'nodeRef' && typeof typedItem.uri === 'string') {
        items.push({
          type: 'nodeRef',
          uri: typedItem.uri as AtUri,
          label: typedItem.label ?? '',
          subkind: typedItem.subkind,
        });
      } else if (itemType === 'latex') {
        // Handle latex items by converting to text with LaTeX delimiters
        const latexContent = (typedItem as { content?: string }).content;
        if (typeof latexContent === 'string') {
          items.push({
            type: 'text',
            content: `$${latexContent}$`,
          });
        }
      }
      // Unknown item types are silently skipped for forward compatibility
    }

    return {
      title,
      titleRich: {
        type: 'RichText',
        items,
        format: 'application/x-chive-gloss+json',
      },
      detectedFormat: 'with-rich',
    };
  }

  // No titleRich, check if title contains special formatting
  if (titleContainsSpecialFormatting(title)) {
    return {
      title,
      titleRich: undefined,
      detectedFormat: 'plain-needs-rich',
    };
  }

  // Plain title with no special formatting needed
  return {
    title,
    titleRich: undefined,
    detectedFormat: 'plain',
  };
}

/**
 * Transform PDS facets to internal Facet model.
 */
function transformFacets(pdsFacets?: PDSFacetValue[]): readonly Facet[] {
  if (!pdsFacets) {
    return [];
  }

  return pdsFacets.map((f) => ({
    dimension: f.dimension ?? f.type ?? 'unknown',
    value: f.value,
    label: f.label,
    nodeUri: f.nodeUri,
  }));
}

/**
 * Transform PDS field nodes to field references.
 *
 * @remarks
 * Field nodes are knowledge graph nodes representing research fields.
 * They are stored directly as field references, not as facets.
 *
 * The `id` field is extracted from the AT-URI to get the UUID/rkey,
 * which is used for Elasticsearch filtering. The full AT-URI is kept
 * in `uri` for knowledge graph lookups.
 */
function transformFieldNodes(
  fieldNodes?: PDSFieldNode[]
): readonly { uri: string; label: string; id?: string }[] {
  if (!fieldNodes || fieldNodes.length === 0) {
    return [];
  }

  return fieldNodes.map((f) => {
    // Extract UUID from AT-URI: at://did:plc:xyz/collection/UUID -> UUID
    const rkey = f.uri.split('/').pop() ?? f.uri;
    return {
      uri: f.uri,
      label: f.uri, // Label should be resolved from knowledge graph
      id: rkey,
    };
  });
}

// =============================================================================
// SCHEMA COMPATIBILITY SERVICE INSTANCE
// =============================================================================

const schemaService = new SchemaCompatibilityService();

// =============================================================================
// MAIN TRANSFORMER
// =============================================================================

/**
 * Transform a PDS record to internal Eprint model with schema metadata.
 *
 * @param raw - Raw record value from PDS
 * @param uri - AT-URI of the record
 * @param cid - CID of the record
 * @returns Transform result with Eprint model and schema detection
 *
 * @throws ValidationError if required fields are missing
 *
 * @remarks
 * This function handles schema evolution by accepting both legacy and current
 * formats for fields like `abstract`. The returned `schemaDetection` can be
 * used to generate API hints for clients using legacy formats.
 *
 * @example
 * ```typescript
 * const result = transformPDSRecordWithSchema(record.value, uri, cid);
 *
 * // Use the transformed eprint
 * await eprintService.indexEprint(result.eprint, metadata);
 *
 * // Check for legacy formats
 * if (!result.schemaDetection.isCurrentSchema) {
 *   logger.info('Legacy record format detected', {
 *     deprecatedFields: result.schemaDetection.compatibility.deprecatedFields,
 *   });
 * }
 * ```
 *
 * @public
 */
export function transformPDSRecordWithSchema(raw: unknown, uri: AtUri, cid: CID): TransformResult {
  // ==========================================================================
  // VALIDATE RECORD STRUCTURE
  // ==========================================================================

  if (typeof raw !== 'object' || raw === null) {
    throw new ValidationError('Record must be an object', 'record');
  }

  const record = raw as PDSEprintRecord;

  // ==========================================================================
  // VALIDATE REQUIRED FIELDS
  // ==========================================================================

  if (!record.document) {
    throw new ValidationError('Missing required field: document', 'document');
  }
  if (!record.title) {
    throw new ValidationError('Missing required field: title', 'title');
  }
  if (!record.authors || record.authors.length === 0) {
    throw new ValidationError('Missing required field: authors', 'authors');
  }
  if (!record.createdAt) {
    throw new ValidationError('Missing required field: createdAt', 'createdAt');
  }

  // ==========================================================================
  // DETECT SCHEMA COMPATIBILITY
  // ==========================================================================

  const schemaDetection = schemaService.analyzeEprintRecord(raw);

  // ==========================================================================
  // TRANSFORM FIELDS
  // ==========================================================================

  // Transform document BlobRef (document → documentBlobRef)
  const documentBlobRef = transformBlobRef(record.document);

  // Transform authors
  const authors = record.authors.map((author, index) => transformAuthor(author, index));

  // Transform supplementary materials (blob → blobRef)
  const supplementaryMaterials = record.supplementaryMaterials?.map((mat, index) =>
    transformSupplementaryMaterial(mat, index)
  );

  // Transform abstract with format detection
  const abstractResult = transformAbstract(record.abstract);

  // Transform title with format detection
  const titleResult = transformTitle(record.title, record.titleRich);

  // Transform facets
  const facets = transformFacets(record.facets);

  // Transform field nodes (knowledge graph references)
  const fields = transformFieldNodes(record.fieldNodes);

  // submittedBy should be the actual user who submitted the eprint.
  // If present in the record, use it. Otherwise, fall back to the DID from the
  // AT-URI, which is the PDS owner who created the record.
  let submittedBy: DID;
  if (record.submittedBy) {
    submittedBy = record.submittedBy as DID;
  } else {
    // Extract DID from AT-URI: at://did:plc:xyz/collection/rkey -> did:plc:xyz
    const uriMatch = /^at:\/\/(did:[^/]+)\//.exec(uri);
    if (!uriMatch) {
      throw new ValidationError('Cannot determine submittedBy: invalid AT-URI', 'uri');
    }
    submittedBy = uriMatch[1] as DID;
  }

  // Transform funding
  const funding = record.fundingInfo?.map((f) => ({
    funderName: f.funderName,
    funderDoi: f.funderDoi,
    funderRor: f.funderRor,
    grantNumber: f.grantNumber,
    grantTitle: f.grantTitle,
    grantUrl: f.grantUrl,
  }));

  // ==========================================================================
  // BUILD EPRINT MODEL
  // ==========================================================================

  const eprint: Eprint = {
    uri,
    cid,

    // Required fields
    title: titleResult.title,
    titleRich: titleResult.titleRich,
    documentBlobRef,
    documentFormat: (record.documentFormat ?? 'pdf') as DocumentFormat,
    authors,
    submittedBy,
    createdAt: toTimestamp(new Date(record.createdAt)),
    abstract: abstractResult.richTextBody,
    abstractPlainText: abstractResult.plainText,
    // License field handling with backward compatibility:
    // 1. Use licenseSlug if present (current format)
    // 2. Fall back to license if present (legacy format)
    // 3. Default to CC-BY-4.0 if nothing provided
    license: record.licenseSlug ?? record.license ?? 'CC-BY-4.0',
    // Store licenseUri for knowledge graph reference (optional)
    licenseUri: record.licenseUri as AtUri | undefined,
    keywords: record.keywords ?? [],
    facets,
    fields: fields.length > 0 ? fields : undefined,

    // Optional fields
    paperDid: record.paperDid as DID | undefined,
    supplementaryMaterials,
    version: record.version ?? 1,
    previousVersionUri: record.previousVersion?.uri as AtUri | undefined,
    publicationStatus: 'eprint',

    // Funding
    funding,
  };

  return {
    eprint,
    schemaDetection,
    abstractFormat: abstractResult.detectedFormat,
    titleFormat: titleResult.detectedFormat,
  };
}

/**
 * Transform a PDS record to internal Eprint model.
 *
 * @param raw - Raw record value from PDS
 * @param uri - AT-URI of the record
 * @param cid - CID of the record
 * @returns Internal Eprint model
 *
 * @throws ValidationError if required fields are missing
 *
 * @remarks
 * This is the legacy function that returns only the Eprint model without
 * schema metadata. Use `transformPDSRecordWithSchema` for full schema
 * evolution support.
 *
 * @example
 * ```typescript
 * const record = await fetchRecordFromPds(pdsUrl, did, collection, rkey);
 * const eprint = transformPDSRecord(record.value, uri, cid);
 * await eprintService.indexEprint(eprint, metadata);
 * ```
 *
 * @public
 */
export function transformPDSRecord(raw: unknown, uri: AtUri, cid: CID): Eprint {
  return transformPDSRecordWithSchema(raw, uri, cid).eprint;
}

/**
 * Check if a raw record looks like a valid PDS eprint record.
 *
 * @remarks
 * Performs basic structure validation without throwing.
 * Useful for filtering in event processors.
 *
 * @param raw - Raw record value
 * @returns True if record has required structure
 *
 * @public
 */
export function isPDSEprintRecord(raw: unknown): raw is PDSEprintRecord {
  if (!raw || typeof raw !== 'object') {
    return false;
  }

  const record = raw as Record<string, unknown>;

  return (
    record.$type === 'pub.chive.eprint.submission' &&
    typeof record.title === 'string' &&
    record.document !== null &&
    typeof record.document === 'object' &&
    Array.isArray(record.authors) &&
    record.authors.length > 0 &&
    typeof record.createdAt === 'string'
  );
}
