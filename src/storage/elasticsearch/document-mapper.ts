/**
 * Document mapper for transforming Eprint domain models to Elasticsearch documents.
 *
 * @remarks
 * Maps Eprint records from the domain model to indexable Elasticsearch documents.
 * Handles:
 * - Facet extraction and formatting
 * - Author information normalization
 * - BlobRef metadata extraction (no blob data)
 * - Publication metadata (status, published version, external IDs)
 * - Repository links (code, data, protocols)
 * - Supplementary materials
 * - PDS tracking for ATProto compliance
 * - Optional enrichment data (citations, endorsements)
 *
 * @packageDocumentation
 */

import type { AtUri, BlobRef } from '../../types/atproto.js';
import type { Facet } from '../../types/interfaces/graph.interface.js';
import type { EprintAuthor } from '../../types/models/author.js';
import type {
  DocumentFormat,
  ExternalIds,
  Eprint,
  PublicationStatus,
  PublishedVersion,
  RelatedWork,
  Repositories,
  SupplementaryMaterial,
  FundingSource,
  ConferencePresentation,
} from '../../types/models/eprint.js';

/**
 * Indexable eprint document for Elasticsearch.
 *
 * @remarks
 * This structure matches the Elasticsearch index template mappings.
 * All fields are optional to handle partial updates.
 *
 * @public
 */
export interface IndexableEprintDocument {
  /** Required timestamp for data streams (event occurrence time). */
  readonly '@timestamp': string;
  readonly uri: string;
  readonly cid: string;
  readonly rkey: string;
  readonly title: string;
  readonly abstract: string;
  readonly authors?: readonly AuthorDocument[];
  readonly submitted_by: string;
  readonly paper_did?: string;
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

  // Document metadata (format-agnostic)
  readonly document_format: DocumentFormat;
  readonly document_metadata?: DocumentMetadata;
  readonly document_blob_ref?: BlobRefDocument;
  readonly document_base64?: string;

  // Supplementary materials
  readonly supplementary_materials?: readonly SupplementaryMaterialDocument[];
  readonly supplementary_count?: number;

  // Publication metadata
  readonly publication_status: PublicationStatus;
  readonly published_version?: PublishedVersionDocument;
  readonly external_ids?: ExternalIdsDocument;
  readonly related_works?: readonly RelatedWorkDocument[];

  // Repository links
  readonly repositories?: RepositoriesDocument;
  readonly has_code_repository?: boolean;
  readonly has_data_repository?: boolean;

  // Funding
  readonly funding?: readonly FundingSourceDocument[];
  readonly funder_names?: readonly string[];

  // Conference
  readonly conference_presentation?: ConferencePresentationDocument;

  // PDS tracking
  readonly pds_url: string;
  readonly pds_endpoint?: string;
}

/**
 * Author affiliation document for nested mapping.
 *
 * @public
 */
export interface AuthorAffiliationDocument {
  readonly name: string;
  readonly rorId?: string;
  readonly department?: string;
}

/**
 * Author contribution document for nested mapping.
 *
 * @public
 */
export interface AuthorContributionDocument {
  readonly typeUri: string;
  readonly typeId?: string;
  readonly typeLabel?: string;
  readonly degree: string;
}

/**
 * Author document for nested mapping.
 *
 * @public
 */
export interface AuthorDocument {
  readonly did?: string;
  readonly name: string;
  readonly orcid?: string;
  readonly email?: string;
  readonly affiliations: readonly AuthorAffiliationDocument[];
  readonly contributions: readonly AuthorContributionDocument[];
  readonly isCorrespondingAuthor: boolean;
  readonly isHighlighted: boolean;
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
 * Document metadata (format-agnostic).
 *
 * @public
 */
export interface DocumentMetadata {
  readonly page_count?: number;
  readonly word_count?: number;
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
 * Supplementary material document for nested mapping.
 *
 * @public
 */
export interface SupplementaryMaterialDocument {
  readonly blob_cid: string;
  readonly label: string;
  readonly description?: string;
  readonly category: string;
  readonly detected_format?: string;
  readonly order: number;
}

/**
 * Published version document.
 *
 * @public
 */
export interface PublishedVersionDocument {
  readonly doi?: string;
  readonly url?: string;
  readonly published_at?: string;
  readonly journal?: string;
  readonly journal_abbreviation?: string;
  readonly journal_issn?: string;
  readonly publisher?: string;
  readonly volume?: string;
  readonly issue?: string;
  readonly pages?: string;
  readonly article_number?: string;
  readonly access_type?: string;
}

/**
 * External identifiers document.
 *
 * @public
 */
export interface ExternalIdsDocument {
  readonly arxiv_id?: string;
  readonly pmid?: string;
  readonly pmcid?: string;
  readonly ssrn_id?: string;
  readonly osf?: string;
  readonly zenodo_doi?: string;
  readonly openalex_id?: string;
  readonly semantic_scholar_id?: string;
}

/**
 * Related work document.
 *
 * @public
 */
export interface RelatedWorkDocument {
  readonly identifier: string;
  readonly identifier_type: string;
  readonly relation_type: string;
  readonly title?: string;
}

/**
 * Code repository document.
 *
 * @public
 */
export interface CodeRepositoryDocument {
  readonly url?: string;
  readonly platform?: string;
  readonly label?: string;
  readonly swhid?: string;
}

/**
 * Data repository document.
 *
 * @public
 */
export interface DataRepositoryDocument {
  readonly url?: string;
  readonly doi?: string;
  readonly platform?: string;
  readonly label?: string;
}

/**
 * Repositories document.
 *
 * @public
 */
export interface RepositoriesDocument {
  readonly code?: readonly CodeRepositoryDocument[];
  readonly data?: readonly DataRepositoryDocument[];
  readonly has_preregistration?: boolean;
  readonly has_protocols?: boolean;
}

/**
 * Funding source document.
 *
 * @public
 */
export interface FundingSourceDocument {
  readonly funder_name?: string;
  readonly funder_doi?: string;
  readonly funder_ror?: string;
  readonly grant_number?: string;
}

/**
 * Conference presentation document.
 *
 * @public
 */
export interface ConferencePresentationDocument {
  readonly conference_name?: string;
  readonly conference_acronym?: string;
  readonly presentation_type?: string;
  readonly presentation_date?: string;
}

/**
 * Enrichment data fetched from cache or database.
 *
 * @remarks
 * This data augments the base Eprint record with computed metrics.
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
  readonly documentBase64?: string;
}

/**
 * Maps Eprint domain model to Elasticsearch indexable document.
 *
 * @param eprint - Eprint domain model
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
 * const document = mapEprintToDocument(
 *   eprint,
 *   'https://example.pds.host',
 *   { citationCount: 42, tags: ['ml', 'nlp'] }
 * );
 * await elasticsearchClient.index({
 *   index: 'eprints',
 *   id: eprint.uri,
 *   document
 * });
 * ```
 *
 * @public
 */
export function mapEprintToDocument(
  eprint: Eprint,
  pdsUrl: string,
  enrichment?: EnrichmentData
): IndexableEprintDocument {
  return {
    // Required for data streams: use indexed time as event time.
    '@timestamp': new Date().toISOString(),
    uri: eprint.uri,
    cid: eprint.cid,
    rkey: extractRkey(eprint.uri),
    title: eprint.title,
    abstract: eprint.abstract,
    authors: mapAuthors(eprint.authors),
    submitted_by: eprint.submittedBy,
    paper_did: eprint.paperDid,
    field_nodes: extractFieldNodes(eprint.facets),
    primary_field: extractPrimaryField(eprint.facets),
    keywords: eprint.keywords ? [...eprint.keywords] : undefined,
    facets: mapFacets(eprint.facets),
    authorities: extractAuthorities(eprint.facets),
    authority_uris: extractAuthorityUris(eprint.facets),
    tags: enrichment?.tags ? [...enrichment.tags] : undefined,
    tag_count: enrichment?.tags?.length ?? 0,
    doi: eprint.publishedVersion?.doi,
    version: eprint.version,
    previous_version: eprint.previousVersionUri,
    license: eprint.license,
    citation_count: enrichment?.citationCount ?? 0,
    endorsement_count: enrichment?.endorsementCount ?? 0,
    view_count: enrichment?.viewCount ?? 0,
    download_count: enrichment?.downloadCount ?? 0,
    created_at: timestampToIso(eprint.createdAt),
    updated_at: eprint.updatedAt ? timestampToIso(eprint.updatedAt) : undefined,

    // Document metadata (format-agnostic)
    document_format: eprint.documentFormat,
    document_metadata: mapDocumentMetadata(eprint.documentBlobRef),
    document_blob_ref: mapBlobRef(eprint.documentBlobRef),
    document_base64: enrichment?.documentBase64,

    // Supplementary materials
    supplementary_materials: mapSupplementaryMaterials(eprint.supplementaryMaterials),
    supplementary_count: eprint.supplementaryMaterials?.length ?? 0,

    // Publication metadata
    publication_status: eprint.publicationStatus,
    published_version: mapPublishedVersion(eprint.publishedVersion),
    external_ids: mapExternalIds(eprint.externalIds),
    related_works: mapRelatedWorks(eprint.relatedWorks),

    // Repository links
    repositories: mapRepositories(eprint.repositories),
    has_code_repository: hasCodeRepository(eprint.repositories),
    has_data_repository: hasDataRepository(eprint.repositories),

    // Funding
    funding: mapFunding(eprint.funding),
    funder_names: extractFunderNames(eprint.funding),

    // Conference
    conference_presentation: mapConferencePresentation(eprint.conferencePresentation),

    // PDS tracking
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
 * @example "at://did:plc:abc/pub.chive.eprint/tid123" → "tid123"
 */
function extractRkey(uri: AtUri): string {
  const parts = uri.split('/');
  return parts[parts.length - 1] ?? '';
}

/**
 * Maps eprint authors to author documents.
 *
 * @param authors - Array of eprint authors
 * @returns Array of author documents
 *
 * @remarks
 * Now uses the full author data from the Eprint model.
 */
function mapAuthors(authors: readonly EprintAuthor[]): readonly AuthorDocument[] {
  return authors.map((author) => ({
    did: author.did,
    name: author.name,
    orcid: author.orcid,
    email: author.email,
    affiliations: author.affiliations.map((aff) => ({
      name: aff.name,
      rorId: aff.rorId,
      department: aff.department,
    })),
    contributions: author.contributions.map((contrib) => ({
      typeUri: contrib.typeUri,
      typeId: contrib.typeId,
      typeLabel: contrib.typeLabel,
      degree: contrib.degree,
    })),
    isCorrespondingAuthor: author.isCorrespondingAuthor,
    isHighlighted: author.isHighlighted,
    order: author.order,
  }));
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
 * Maps BlobRef to document metadata.
 *
 * @param blobRef - Document BlobRef
 * @returns Document metadata
 */
function mapDocumentMetadata(blobRef: BlobRef): DocumentMetadata {
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
 * Maps supplementary materials to document structure.
 *
 * @param materials - Supplementary materials array
 * @returns Supplementary material documents
 */
function mapSupplementaryMaterials(
  materials?: readonly SupplementaryMaterial[]
): readonly SupplementaryMaterialDocument[] | undefined {
  if (!materials || materials.length === 0) return undefined;

  return materials.map((m) => ({
    blob_cid: m.blobRef.ref,
    label: m.label,
    description: m.description,
    category: m.category,
    detected_format: m.detectedFormat,
    order: m.order,
  }));
}

/**
 * Maps published version to document structure.
 *
 * @param version - Published version
 * @returns Published version document
 */
function mapPublishedVersion(version?: PublishedVersion): PublishedVersionDocument | undefined {
  if (!version) return undefined;

  return {
    doi: version.doi,
    url: version.url,
    published_at: version.publishedAt ? timestampToIso(version.publishedAt) : undefined,
    journal: version.journal,
    journal_abbreviation: version.journalAbbreviation,
    journal_issn: version.journalIssn,
    publisher: version.publisher,
    volume: version.volume,
    issue: version.issue,
    pages: version.pages,
    article_number: version.articleNumber,
    access_type: version.accessType,
  };
}

/**
 * Maps external IDs to document structure.
 *
 * @param ids - External identifiers
 * @returns External IDs document
 */
function mapExternalIds(ids?: ExternalIds): ExternalIdsDocument | undefined {
  if (!ids) return undefined;

  return {
    arxiv_id: ids.arxivId,
    pmid: ids.pmid,
    pmcid: ids.pmcid,
    ssrn_id: ids.ssrnId,
    osf: ids.osf,
    zenodo_doi: ids.zenodoDoi,
    openalex_id: ids.openAlexId,
    semantic_scholar_id: ids.semanticScholarId,
  };
}

/**
 * Maps related works to document structure.
 *
 * @param works - Related works array
 * @returns Related work documents
 */
function mapRelatedWorks(
  works?: readonly RelatedWork[]
): readonly RelatedWorkDocument[] | undefined {
  if (!works || works.length === 0) return undefined;

  return works.map((w) => ({
    identifier: w.identifier,
    identifier_type: w.identifierType,
    relation_type: w.relationType,
    title: w.title,
  }));
}

/**
 * Maps repositories to document structure.
 *
 * @param repos - Repositories
 * @returns Repositories document
 */
function mapRepositories(repos?: Repositories): RepositoriesDocument | undefined {
  if (!repos) return undefined;

  return {
    code: repos.code?.map((c) => ({
      url: c.url,
      platform: c.platform,
      label: c.label,
      swhid: c.swhid,
    })),
    data: repos.data?.map((d) => ({
      url: d.url,
      doi: d.doi,
      platform: d.platform,
      label: d.label,
    })),
    has_preregistration: repos.preregistration !== undefined,
    has_protocols: repos.protocols !== undefined && repos.protocols.length > 0,
  };
}

/**
 * Checks if eprint has a code repository.
 *
 * @param repos - Repositories
 * @returns True if code repository exists
 */
function hasCodeRepository(repos?: Repositories): boolean {
  return repos?.code !== undefined && repos.code.length > 0;
}

/**
 * Checks if eprint has a data repository.
 *
 * @param repos - Repositories
 * @returns True if data repository exists
 */
function hasDataRepository(repos?: Repositories): boolean {
  return repos?.data !== undefined && repos.data.length > 0;
}

/**
 * Maps funding sources to document structure.
 *
 * @param funding - Funding sources array
 * @returns Funding source documents
 */
function mapFunding(
  funding?: readonly FundingSource[]
): readonly FundingSourceDocument[] | undefined {
  if (!funding || funding.length === 0) return undefined;

  return funding.map((f) => ({
    funder_name: f.funderName,
    funder_doi: f.funderDoi,
    funder_ror: f.funderRor,
    grant_number: f.grantNumber,
  }));
}

/**
 * Extracts funder names for faceting.
 *
 * @param funding - Funding sources array
 * @returns Funder names
 */
function extractFunderNames(funding?: readonly FundingSource[]): readonly string[] | undefined {
  if (!funding || funding.length === 0) return undefined;

  const names = funding.map((f) => f.funderName).filter((n): n is string => n !== undefined);

  return names.length > 0 ? names : undefined;
}

/**
 * Maps conference presentation to document structure.
 *
 * @param presentation - Conference presentation
 * @returns Conference presentation document
 */
function mapConferencePresentation(
  presentation?: ConferencePresentation
): ConferencePresentationDocument | undefined {
  if (!presentation) return undefined;

  return {
    conference_name: presentation.conferenceName,
    conference_acronym: presentation.conferenceAcronym,
    presentation_type: presentation.presentationType,
    presentation_date: presentation.presentationDate
      ? timestampToIso(presentation.presentationDate)
      : undefined,
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
