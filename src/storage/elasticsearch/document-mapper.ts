/**
 * Document mapper for transforming Preprint domain models to Elasticsearch documents.
 *
 * @remarks
 * Maps Preprint records from the domain model to indexable Elasticsearch documents.
 * Handles:
 * - Facet extraction and formatting
 * - Author information normalization
 * - BlobRef metadata extraction (no blob data)
 * - PDS tracking for ATProto compliance
 * - Optional enrichment data (citations, endorsements)
 *
 * @packageDocumentation
 */

import type { AtUri, BlobRef, DID } from '../../types/atproto.js';
import type { Facet } from '../../types/interfaces/graph.interface.js';
import type { Preprint } from '../../types/models/preprint.js';

/**
 * Indexable preprint document for Elasticsearch.
 *
 * @remarks
 * This structure matches the Elasticsearch index template mappings.
 * All fields are optional to handle partial updates.
 *
 * @public
 */
export interface IndexablePreprintDocument {
  /** Required timestamp for data streams (event occurrence time). */
  readonly '@timestamp': string;
  readonly uri: string;
  readonly cid: string;
  readonly rkey: string;
  readonly title: string;
  readonly abstract: string;
  readonly authors?: readonly AuthorDocument[];
  readonly field_nodes?: readonly string[];
  readonly primary_field?: string;
  readonly keywords?: readonly string[];
  readonly facets?: FacetDocument;
  readonly authorities?: readonly string[];
  readonly authority_uris?: readonly string[];
  readonly tags?: readonly string[];
  readonly tag_count?: number;
  readonly doi?: string;
  readonly version?: number;
  readonly previous_version?: string;
  readonly license: string;
  readonly citation_count?: number;
  readonly endorsement_count?: number;
  readonly view_count?: number;
  readonly download_count?: number;
  readonly created_at: string;
  readonly updated_at?: string;
  readonly language?: string;
  readonly pdf_metadata?: PdfMetadata;
  readonly pdf_blob_ref?: BlobRefDocument;
  readonly pdf_base64?: string;
  readonly pds_url: string;
  readonly pds_endpoint?: string;
}

/**
 * Author document for nested mapping.
 *
 * @public
 */
export interface AuthorDocument {
  readonly did: string;
  readonly name: string;
  readonly orcid?: string;
  readonly affiliation?: string;
  readonly order: number;
}

/**
 * Facet document with all 10 dimensions.
 *
 * @remarks
 * PMEST (5): matter, energy, space, time, personality
 * FAST entities (5): person, organization, event, work, form_genre
 *
 * @public
 */
export interface FacetDocument {
  readonly matter?: readonly string[];
  readonly energy?: readonly string[];
  readonly space?: readonly string[];
  readonly time?: readonly string[];
  readonly personality?: readonly string[];
  readonly person?: readonly string[];
  readonly organization?: readonly string[];
  readonly event?: readonly string[];
  readonly work?: readonly string[];
  readonly form_genre?: readonly string[];
}

/**
 * PDF metadata.
 *
 * @public
 */
export interface PdfMetadata {
  readonly page_count?: number;
  readonly file_size: number;
  readonly content_type: string;
}

/**
 * BlobRef document (metadata only, no blob data).
 *
 * @public
 */
export interface BlobRefDocument {
  readonly cid: string;
  readonly mime_type: string;
  readonly size: number;
}

/**
 * Enrichment data fetched from cache or database.
 *
 * @remarks
 * This data augments the base Preprint record with computed metrics.
 * All fields are optional (defaults to 0 if missing).
 *
 * @public
 */
export interface EnrichmentData {
  readonly citationCount?: number;
  readonly endorsementCount?: number;
  readonly viewCount?: number;
  readonly downloadCount?: number;
  readonly tags?: readonly string[];
  readonly pdfBase64?: string;
}

/**
 * Maps Preprint domain model to Elasticsearch indexable document.
 *
 * @param preprint - Preprint domain model
 * @param pdsUrl - Source PDS URL (for ATProto compliance tracking)
 * @param enrichment - Optional enrichment data
 * @returns Indexable document ready for Elasticsearch
 *
 * @remarks
 * **ATProto Compliance:**
 * - BlobRef is stored as metadata (CID, size, mime type)
 * - No blob data is stored in the index
 * - PDS URL is tracked for source attribution
 * - Document can be rebuilt from firehose
 *
 * @example
 * ```typescript
 * const document = mapPreprintToDocument(
 *   preprint,
 *   'https://example.pds.host',
 *   { citationCount: 42, tags: ['ml', 'nlp'] }
 * );
 * await elasticsearchClient.index({
 *   index: 'preprints',
 *   id: preprint.uri,
 *   document
 * });
 * ```
 *
 * @public
 */
export function mapPreprintToDocument(
  preprint: Preprint,
  pdsUrl: string,
  enrichment?: EnrichmentData
): IndexablePreprintDocument {
  return {
    // Required for data streams: use indexed time as event time.
    '@timestamp': new Date().toISOString(),
    uri: preprint.uri,
    cid: preprint.cid,
    rkey: extractRkey(preprint.uri),
    title: preprint.title,
    abstract: preprint.abstract,
    authors: mapAuthors(preprint.author, preprint.coAuthors),
    field_nodes: extractFieldNodes(preprint.facets),
    primary_field: extractPrimaryField(preprint.facets),
    keywords: preprint.keywords ? [...preprint.keywords] : undefined,
    facets: mapFacets(preprint.facets),
    authorities: extractAuthorities(preprint.facets),
    authority_uris: extractAuthorityUris(preprint.facets),
    tags: enrichment?.tags ? [...enrichment.tags] : undefined,
    tag_count: enrichment?.tags?.length ?? 0,
    doi: undefined,
    version: preprint.version,
    previous_version: preprint.previousVersionUri,
    license: preprint.license,
    citation_count: enrichment?.citationCount ?? 0,
    endorsement_count: enrichment?.endorsementCount ?? 0,
    view_count: enrichment?.viewCount ?? 0,
    download_count: enrichment?.downloadCount ?? 0,
    created_at: timestampToIso(preprint.createdAt),
    updated_at: preprint.updatedAt ? timestampToIso(preprint.updatedAt) : undefined,
    pdf_metadata: mapPdfMetadata(preprint.pdfBlobRef),
    pdf_blob_ref: mapBlobRef(preprint.pdfBlobRef),
    pdf_base64: enrichment?.pdfBase64,
    pds_url: pdsUrl,
    pds_endpoint: extractPdsEndpoint(pdsUrl),
  };
}

/**
 * Converts branded Timestamp (number) to ISO 8601 string.
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @returns ISO 8601 date string
 */
function timestampToIso(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

/**
 * Extracts rkey (record key) from AT-URI.
 *
 * @param uri - AT-URI
 * @returns Record key (TID)
 *
 * @example "at://did:plc:abc/pub.chive.preprint/tid123" → "tid123"
 */
function extractRkey(uri: AtUri): string {
  const parts = uri.split('/');
  return parts[parts.length - 1] ?? '';
}

/**
 * Maps author DID(s) to author documents.
 *
 * @param primaryAuthor - Primary author DID
 * @param coAuthors - Co-author DIDs
 * @returns Array of author documents
 *
 * @remarks
 * Author names are not available in the Preprint model.
 * They must be enriched from author profile service.
 * For now, we use DID as placeholder name.
 */
function mapAuthors(primaryAuthor: DID, coAuthors?: readonly DID[]): readonly AuthorDocument[] {
  const authors: AuthorDocument[] = [
    {
      did: primaryAuthor,
      name: primaryAuthor,
      order: 0,
    },
  ];

  if (coAuthors) {
    coAuthors.forEach((did, index) => {
      authors.push({
        did,
        name: did,
        order: index + 1,
      });
    });
  }

  return authors;
}

/**
 * Extracts field nodes from facets.
 *
 * @param facets - Facet array
 * @returns Field node URIs
 *
 * @remarks
 * Field nodes are facets with dimension "topical" or "matter" (subject matter).
 */
function extractFieldNodes(facets: readonly Facet[]): readonly string[] | undefined {
  const fieldFacets = facets.filter((f) => f.dimension === 'topical' || f.dimension === 'matter');
  return fieldFacets.length > 0 ? fieldFacets.map((f) => f.value) : undefined;
}

/**
 * Extracts primary field from facets.
 *
 * @param facets - Facet array
 * @returns Primary field URI (first field node)
 */
function extractPrimaryField(facets: readonly Facet[]): string | undefined {
  const fieldNodes = extractFieldNodes(facets);
  return fieldNodes?.[0];
}

/**
 * Maps facets to 10-dimensional facet document.
 *
 * @param facets - Facet array
 * @returns Facet document with dimension arrays
 *
 * @remarks
 * Groups facets by dimension. Maps existing dimensions to new schema:
 * - matter: subject matter
 * - energy: methods/approaches
 * - space/geographic: spatial aspects
 * - time/chronological: temporal aspects
 * - personality: focus/perspective
 * - form: document type
 * - topical: subject topics
 * - event: named events
 */
function mapFacets(facets: readonly Facet[]): FacetDocument {
  const grouped: Record<string, string[]> = {};

  for (const facet of facets) {
    const dim = facet.dimension;
    grouped[dim] ??= [];
    grouped[dim].push(facet.value);
  }

  return {
    matter: grouped.matter ?? grouped.topical,
    energy: grouped.energy,
    space: grouped.space ?? grouped.geographic,
    time: grouped.time ?? grouped.chronological,
    personality: grouped.personality,
    person: undefined,
    organization: undefined,
    event: grouped.event,
    work: undefined,
    form_genre: grouped.form,
  };
}

/**
 * Extracts authority-controlled terms from facets.
 *
 * @param facets - Facet array
 * @returns Authority terms (values with authority records)
 */
function extractAuthorities(facets: readonly Facet[]): readonly string[] | undefined {
  const authorities = facets.filter((f) => f.authorityRecordId !== undefined).map((f) => f.value);

  return authorities.length > 0 ? authorities : undefined;
}

/**
 * Extracts authority record URIs from facets.
 *
 * @param facets - Facet array
 * @returns Authority record URIs
 */
function extractAuthorityUris(facets: readonly Facet[]): readonly string[] | undefined {
  const uris = facets
    .filter((f) => f.authorityRecordId !== undefined)
    .map((f) => f.authorityRecordId)
    .filter((id): id is string => id !== undefined);

  return uris.length > 0 ? uris : undefined;
}

/**
 * Maps BlobRef to PDF metadata.
 *
 * @param blobRef - PDF BlobRef
 * @returns PDF metadata
 */
function mapPdfMetadata(blobRef: BlobRef): PdfMetadata {
  return {
    file_size: blobRef.size,
    content_type: blobRef.mimeType,
  };
}

/**
 * Maps BlobRef to document structure.
 *
 * @param blobRef - BlobRef
 * @returns BlobRef document (metadata only)
 *
 * @remarks
 * This stores only metadata (CID, size, mime type); no blob data is stored
 * in Elasticsearch per ATProto compliance requirements.
 */
function mapBlobRef(blobRef: BlobRef): BlobRefDocument {
  return {
    cid: blobRef.ref,
    mime_type: blobRef.mimeType,
    size: blobRef.size,
  };
}

/**
 * Extracts PDS endpoint from PDS URL.
 *
 * @param pdsUrl - Full PDS URL
 * @returns PDS endpoint (host:port)
 *
 * @example "https://example.pds.host:3000/xrpc/..." → "example.pds.host:3000"
 */
function extractPdsEndpoint(pdsUrl: string): string {
  try {
    const url = new URL(pdsUrl);
    return url.host;
  } catch {
    return pdsUrl;
  }
}
