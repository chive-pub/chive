/**
 * Transform PDS records to internal Eprint domain model.
 *
 * @remarks
 * This module bridges the gap between what the frontend writes to PDSes
 * and what the backend expects. The frontend uses simplified field names
 * and structures that don't match the internal Eprint model.
 *
 * **Key Mismatches Fixed:**
 * - `document` → `documentBlobRef`
 * - `supplementaryMaterials[].blob` → `supplementaryMaterials[].blobRef`
 * - `abstract` (string) → `abstract` (RichTextBody)
 * - BlobRef structure: `ref.$link` → `ref` (CID string)
 *
 * @packageDocumentation
 * @public
 */

import { toTimestamp } from '../../types/atproto-validators.js';
import type { AtUri, BlobRef, CID, DID } from '../../types/atproto.js';
import { ValidationError } from '../../types/errors.js';
import type { Facet } from '../../types/interfaces/graph.interface.js';
import type { DocumentFormat, RichTextBody } from '../../types/models/annotation.js';
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
 * Eprint record structure as actually written by frontend to PDS.
 *
 * @remarks
 * This differs from both the lexicon schema AND the internal model.
 * The transformer normalizes this to the internal Eprint model.
 */
export interface PDSEprintRecord {
  $type: 'pub.chive.eprint.submission';

  // REQUIRED FIELDS
  title: string;
  document: PDSBlobRef;
  authors: PDSAuthorRef[];
  createdAt: string;

  // OPTIONAL FIELDS
  submittedBy?: string;
  abstract?: string;
  documentFormat?: string;
  supplementaryMaterials?: PDSSupplementaryMaterial[];
  fieldNodes?: PDSFieldNode[];
  facets?: PDSFacetValue[];
  keywords?: string[];
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
// HELPER FUNCTIONS
// =============================================================================

/**
 * Transform a PDS BlobRef to internal BlobRef format.
 *
 * @param pdsBlobRef - BlobRef from PDS with nested ref.$link structure
 * @returns Internal BlobRef with CID as string
 */
function transformBlobRef(pdsBlobRef: PDSBlobRef): BlobRef {
  return {
    $type: 'blob',
    ref: pdsBlobRef.ref.$link as CID,
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
 * Transform abstract string to RichTextBody.
 *
 * @remarks
 * The frontend sends abstract as a plain string. The internal model
 * expects a RichTextBody object. For simple strings, we wrap it in
 * a RichTextBody with a single text item.
 */
function transformAbstract(abstract?: string): RichTextBody {
  if (!abstract) {
    return {
      type: 'RichText',
      items: [],
      format: 'application/x-chive-gloss+json',
    };
  }

  return {
    type: 'RichText',
    items: [{ type: 'text', content: abstract }],
    format: 'application/x-chive-gloss+json',
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

// =============================================================================
// MAIN TRANSFORMER
// =============================================================================

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

  // Transform abstract (string → RichTextBody)
  const abstract = transformAbstract(record.abstract);
  const abstractPlainText = record.abstract;

  // Transform facets
  const facets = transformFacets(record.facets);

  // Determine submittedBy - use explicit field or infer from first author with DID
  let submittedBy: DID;
  if (record.submittedBy) {
    submittedBy = record.submittedBy as DID;
  } else {
    const authorWithDid = authors.find((a) => a.did);
    if (authorWithDid?.did) {
      submittedBy = authorWithDid.did;
    } else {
      // Extract DID from URI: at://did:plc:xxx/collection/rkey
      submittedBy = uri.split('/')[2] as DID;
    }
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

  return {
    uri,
    cid,

    // Required fields
    title: record.title,
    documentBlobRef,
    documentFormat: (record.documentFormat ?? 'pdf') as DocumentFormat,
    authors,
    submittedBy,
    createdAt: toTimestamp(new Date(record.createdAt)),
    abstract,
    abstractPlainText,
    license: record.license ?? 'CC-BY-4.0',
    keywords: record.keywords ?? [],
    facets,

    // Optional fields
    paperDid: record.paperDid as DID | undefined,
    supplementaryMaterials,
    version: record.version ?? 1,
    previousVersionUri: record.previousVersion?.uri as AtUri | undefined,
    publicationStatus: 'eprint',

    // Funding
    funding,
  };
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
