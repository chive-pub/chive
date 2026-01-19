/**
 * Eprint domain models.
 *
 * @remarks
 * This module defines domain models for eprints, eprint versions,
 * user-generated tags, and comprehensive publication metadata.
 * All models are immutable (readonly properties).
 *
 * @packageDocumentation
 * @public
 */

import type { AtUri, BlobRef, CID, DID, Timestamp } from '../atproto.js';
import type { Facet } from '../interfaces/graph.interface.js';

import type { DocumentFormat, RichTextBody } from './annotation.js';
import type { EprintAuthor } from './author.js';

// Re-export DocumentFormat for consumers (canonical definition in annotation.js)
export type { DocumentFormat };

/**
 * Categories for supplementary materials.
 *
 * @remarks
 * Auto-detected from file type and filename patterns, but can be
 * overridden by users.
 *
 * @public
 */
export type SupplementaryCategory =
  | 'appendix'
  | 'figure'
  | 'table'
  | 'dataset'
  | 'code'
  | 'notebook'
  | 'video'
  | 'audio'
  | 'presentation'
  | 'protocol'
  | 'questionnaire'
  | 'other';

/**
 * Supplementary material item with metadata.
 *
 * @remarks
 * Attached to eprints as additional files (appendices, data, code, figures).
 * Format and category are auto-detected but can be overridden.
 *
 * @public
 */
export interface SupplementaryMaterial {
  /**
   * Blob reference to supplementary file in user's PDS.
   */
  readonly blobRef: BlobRef;

  /**
   * User-provided label.
   *
   * @example "Appendix A", "Figure S1", "Raw data"
   */
  readonly label: string;

  /**
   * Description of the supplementary material.
   */
  readonly description?: string;

  /**
   * Material category (auto-detected or user-specified).
   */
  readonly category: SupplementaryCategory;

  /**
   * Auto-detected file format.
   *
   * @example "pdf", "csv", "ipynb", "mp4"
   */
  readonly detectedFormat?: string;

  /**
   * Display order (1-indexed).
   */
  readonly order: number;
}

// =============================================================================
// Publication Status & Version Linking
// =============================================================================

/**
 * Publication lifecycle status.
 *
 * @remarks
 * Tracks the progression from eprint to published article.
 *
 * @public
 */
export type PublicationStatus =
  | 'eprint'
  | 'under_review'
  | 'revision_requested'
  | 'accepted'
  | 'in_press'
  | 'published'
  | 'retracted';

/**
 * Open access status types.
 *
 * @public
 */
export type AccessType =
  | 'open_access'
  | 'green_oa'
  | 'gold_oa'
  | 'hybrid_oa'
  | 'bronze_oa'
  | 'closed';

/**
 * Published version metadata (Version of Record).
 *
 * @remarks
 * Comprehensive metadata about the published version of an eprint,
 * following CrossRef and DataCite standards.
 *
 * @public
 */
export interface PublishedVersion {
  /**
   * DOI of the published version.
   *
   * @example "10.1038/s41586-024-07345-1"
   */
  readonly doi?: string;

  /**
   * URL to the published version.
   */
  readonly url?: string;

  /**
   * Publication date.
   */
  readonly publishedAt?: Timestamp;

  /**
   * Journal name.
   */
  readonly journal?: string;

  /**
   * Journal abbreviation.
   *
   * @example "Nat. Commun."
   */
  readonly journalAbbreviation?: string;

  /**
   * Journal ISSN.
   */
  readonly journalIssn?: string;

  /**
   * Publisher name.
   */
  readonly publisher?: string;

  /**
   * Volume number.
   */
  readonly volume?: string;

  /**
   * Issue number.
   */
  readonly issue?: string;

  /**
   * Page range.
   *
   * @example "123-145"
   */
  readonly pages?: string;

  /**
   * Article number.
   */
  readonly articleNumber?: string;

  /**
   * Electronic location ID for online-only journals.
   */
  readonly eLocationId?: string;

  /**
   * Open access status.
   */
  readonly accessType?: AccessType;

  /**
   * License URL.
   */
  readonly licenseUrl?: string;
}

// =============================================================================
// Related Works (DataCite-style)
// =============================================================================

/**
 * Identifier types for related works.
 *
 * @public
 */
export type RelatedWorkIdentifierType =
  | 'doi'
  | 'arxiv'
  | 'pmid'
  | 'pmcid'
  | 'url'
  | 'urn'
  | 'handle'
  | 'isbn'
  | 'issn'
  | 'at-uri';

/**
 * DataCite-compatible relation types.
 *
 * @see {@link https://support.datacite.org/docs/connecting-versions-with-related-identifiers | DataCite Related Identifiers}
 * @public
 */
export type RelationType =
  | 'isPreprintOf'
  | 'hasPreprint'
  | 'isVersionOf'
  | 'hasVersion'
  | 'isNewVersionOf'
  | 'isPreviousVersionOf'
  | 'isPartOf'
  | 'hasPart'
  | 'references'
  | 'isReferencedBy'
  | 'isSupplementTo'
  | 'isSupplementedBy'
  | 'isContinuedBy'
  | 'continues'
  | 'isDocumentedBy'
  | 'documents'
  | 'isCompiledBy'
  | 'compiles'
  | 'isVariantFormOf'
  | 'isOriginalFormOf'
  | 'isIdenticalTo'
  | 'isReviewedBy'
  | 'reviews'
  | 'isDerivedFrom'
  | 'isSourceOf'
  | 'isRequiredBy'
  | 'requires'
  | 'isObsoletedBy'
  | 'obsoletes';

/**
 * Related work reference.
 *
 * @remarks
 * Links to related eprints, datasets, software, and prior versions
 * using DataCite-compatible relation types.
 *
 * @public
 */
export interface RelatedWork {
  /**
   * Identifier value.
   *
   * @example "10.1234/example", "arXiv:2401.12345", "at://did:plc:xyz/pub.chive.eprint.submission/abc"
   */
  readonly identifier: string;

  /**
   * Type of identifier.
   */
  readonly identifierType: RelatedWorkIdentifierType;

  /**
   * Relation type (DataCite-compatible).
   */
  readonly relationType: RelationType;

  /**
   * Title of the related work.
   */
  readonly title?: string;

  /**
   * Description of the relation.
   */
  readonly description?: string;
}

// =============================================================================
// External Identifiers
// =============================================================================

/**
 * External persistent identifiers.
 *
 * @remarks
 * Links to external systems for discovery and interoperability.
 *
 * @public
 */
export interface ExternalIds {
  /**
   * arXiv identifier.
   *
   * @example "2401.12345"
   */
  readonly arxivId?: string;

  /**
   * PubMed ID.
   */
  readonly pmid?: string;

  /**
   * PubMed Central ID.
   */
  readonly pmcid?: string;

  /**
   * SSRN identifier.
   */
  readonly ssrnId?: string;

  /**
   * OSF identifier.
   */
  readonly osf?: string;

  /**
   * Zenodo DOI.
   */
  readonly zenodoDoi?: string;

  /**
   * OpenAlex identifier.
   *
   * @example "W2741809807"
   */
  readonly openAlexId?: string;

  /**
   * Semantic Scholar identifier.
   */
  readonly semanticScholarId?: string;

  /**
   * CORE identifier.
   */
  readonly coreSid?: string;

  /**
   * Microsoft Academic Graph ID (legacy).
   */
  readonly magId?: string;
}

// =============================================================================
// Repository Links
// =============================================================================

/**
 * Code repository platforms.
 *
 * @public
 */
export type CodePlatform =
  | 'github'
  | 'gitlab'
  | 'bitbucket'
  | 'codeberg'
  | 'sourcehut'
  | 'software_heritage'
  | 'other';

/**
 * Data repository platforms.
 *
 * @public
 */
export type DataPlatform =
  | 'zenodo'
  | 'figshare'
  | 'dryad'
  | 'osf'
  | 'dataverse'
  | 'mendeley_data'
  | 'other';

/**
 * Pre-registration platforms.
 *
 * @public
 */
export type PreregistrationPlatform =
  | 'osf'
  | 'aspredicted'
  | 'clinicaltrials'
  | 'prospero'
  | 'other';

/**
 * Protocol repository platforms.
 *
 * @public
 */
export type ProtocolPlatform = 'protocols_io' | 'bio_protocol' | 'other';

/**
 * Code repository link.
 *
 * @public
 */
export interface CodeRepository {
  /**
   * Repository URL.
   */
  readonly url?: string;

  /**
   * Hosting platform.
   */
  readonly platform?: CodePlatform;

  /**
   * User-provided label.
   */
  readonly label?: string;

  /**
   * Software Heritage archive URL.
   */
  readonly archiveUrl?: string;

  /**
   * Software Heritage Identifier.
   *
   * @example "swh:1:rev:309cf2674ee7a0749978cf8265ab91a60aea0f7d"
   */
  readonly swhid?: string;
}

/**
 * Data repository link.
 *
 * @public
 */
export interface DataRepository {
  /**
   * Repository URL.
   */
  readonly url?: string;

  /**
   * Dataset DOI.
   */
  readonly doi?: string;

  /**
   * Hosting platform.
   */
  readonly platform?: DataPlatform;

  /**
   * User-provided label.
   */
  readonly label?: string;

  /**
   * Data availability statement.
   */
  readonly accessStatement?: string;
}

/**
 * Pre-registration link.
 *
 * @public
 */
export interface Preregistration {
  /**
   * Pre-registration URL.
   */
  readonly url?: string;

  /**
   * Hosting platform.
   */
  readonly platform?: PreregistrationPlatform;

  /**
   * Registration date.
   */
  readonly registrationDate?: Timestamp;
}

/**
 * Protocol link.
 *
 * @public
 */
export interface Protocol {
  /**
   * Protocol URL.
   */
  readonly url?: string;

  /**
   * Protocol DOI.
   */
  readonly doi?: string;

  /**
   * Hosting platform.
   */
  readonly platform?: ProtocolPlatform;
}

/**
 * Physical material, reagent, or plasmid link.
 *
 * @public
 */
export interface Material {
  /**
   * Material URL.
   */
  readonly url?: string;

  /**
   * Research Resource Identifier.
   *
   * @see {@link https://scicrunch.org/resources | RRID}
   */
  readonly rrid?: string;

  /**
   * User-provided label.
   */
  readonly label?: string;
}

/**
 * Linked code, data, and materials repositories.
 *
 * @public
 */
export interface Repositories {
  /**
   * Code repositories.
   */
  readonly code?: readonly CodeRepository[];

  /**
   * Data repositories.
   */
  readonly data?: readonly DataRepository[];

  /**
   * Pre-registration or registered report link.
   */
  readonly preregistration?: Preregistration;

  /**
   * Protocol links.
   */
  readonly protocols?: readonly Protocol[];

  /**
   * Physical materials, reagents, plasmids, etc.
   */
  readonly materials?: readonly Material[];
}

// =============================================================================
// Funding & Conference
// =============================================================================

/**
 * Funding source information.
 *
 * @remarks
 * Links to CrossRef Funder Registry and ROR for standardized funder IDs.
 *
 * @public
 */
export interface FundingSource {
  /**
   * Funder name.
   */
  readonly funderName?: string;

  /**
   * CrossRef Funder Registry DOI.
   *
   * @example "10.13039/100000001"
   */
  readonly funderDoi?: string;

  /**
   * ROR identifier.
   *
   * @example "https://ror.org/021nxhr62"
   */
  readonly funderRor?: string;

  /**
   * Grant number.
   */
  readonly grantNumber?: string;

  /**
   * Grant title.
   */
  readonly grantTitle?: string;

  /**
   * Grant URL.
   */
  readonly grantUrl?: string;
}

/**
 * Presentation types at conferences.
 *
 * @public
 */
export type PresentationType = 'oral' | 'poster' | 'keynote' | 'workshop' | 'demo' | 'other';

/**
 * Conference presentation information.
 *
 * @public
 */
export interface ConferencePresentation {
  /**
   * Conference name.
   */
  readonly conferenceName?: string;

  /**
   * Conference acronym.
   *
   * @example "NeurIPS 2024"
   */
  readonly conferenceAcronym?: string;

  /**
   * Conference website URL.
   */
  readonly conferenceUrl?: string;

  /**
   * Conference location.
   *
   * @example "Vancouver, Canada"
   */
  readonly conferenceLocation?: string;

  /**
   * Presentation date.
   */
  readonly presentationDate?: Timestamp;

  /**
   * Type of presentation.
   */
  readonly presentationType?: PresentationType;

  /**
   * Proceedings DOI.
   */
  readonly proceedingsDoi?: string;
}

// =============================================================================
// Main Eprint Model
// =============================================================================

/**
 * Eprint domain model.
 *
 * @remarks
 * Represents a scholarly eprint indexed by Chive. This model captures
 * comprehensive metadata from the user's PDS record including publication
 * status, linked published versions, external identifiers, repositories,
 * funding, and conference presentations.
 *
 * **ATProto Compliance**:
 * - `documentBlobRef` is a reference (CID pointer), not blob data
 * - Actual document remains in user's PDS
 * - Record is rebuildable from firehose
 *
 * @public
 */
export interface Eprint {
  /**
   * AT URI of the eprint record.
   */
  readonly uri: AtUri;

  /**
   * CID of this eprint version.
   */
  readonly cid: CID;

  /**
   * All authors with contributions, affiliations, and metadata.
   *
   * @remarks
   * Unified author list including primary and co-authors.
   * Order is determined by each author's `order` property.
   */
  readonly authors: readonly EprintAuthor[];

  /**
   * DID of the human user who submitted this eprint.
   *
   * @remarks
   * Always set to the human who performed the submission.
   * May or may not appear in the authors list.
   */
  readonly submittedBy: DID;

  /**
   * DID of the paper's own account (if paper has its own PDS).
   *
   * @remarks
   * Optional field for paper-centric account model.
   * When set, blobs and the record itself live in the paper's PDS.
   * When undefined, they live in the submitter's PDS.
   *
   * @see {@link https://github.com/chive-pub/chive/discussions/3 | Discussion #3}
   */
  readonly paperDid?: DID;

  /**
   * Eprint title.
   */
  readonly title: string;

  /**
   * Eprint abstract (rich text with embedded references).
   *
   * @remarks
   * Supports @ triggers for object nodes (institutions, persons, topics)
   * and # triggers for type nodes (fields, facets, contribution-types).
   */
  readonly abstract: RichTextBody;

  /**
   * Plain text version of the abstract for search indexing.
   *
   * @remarks
   * Auto-generated from the rich text abstract by extracting plain text
   * from all items. Used for full-text search and display in contexts
   * that don't support rich text. Optional since it can be derived from
   * the abstract field at indexing time.
   */
  readonly abstractPlainText?: string;

  /**
   * Blob reference to primary document in user's PDS.
   *
   * @remarks
   * This is a BlobRef (metadata), not the document itself. Supports
   * multiple formats (PDF, DOCX, HTML, Markdown, LaTeX, Jupyter, etc.).
   * Fetch document via `IRepository.getBlob()` for proxying.
   */
  readonly documentBlobRef: BlobRef;

  /**
   * Detected or user-specified document format.
   *
   * @remarks
   * Auto-detected from MIME type and magic bytes, but can be
   * overridden by user if detection is incorrect.
   */
  readonly documentFormat: DocumentFormat;

  /**
   * Supplementary materials attached to this eprint.
   *
   * @remarks
   * Additional files (appendices, figures, data, code, notebooks).
   * Each item has metadata including category and display order.
   */
  readonly supplementaryMaterials?: readonly SupplementaryMaterial[];

  /**
   * Author-provided keywords.
   */
  readonly keywords: readonly string[];

  /**
   * Faceted classification values.
   *
   * @remarks
   * Optional facets for additional classification dimensions.
   */
  readonly facets: readonly Facet[];

  /**
   * Research field references from the knowledge graph.
   *
   * @remarks
   * Links to field nodes in the knowledge graph for categorization.
   * These are knowledge graph nodes, not a fixed taxonomy.
   */
  readonly fields?: readonly {
    readonly uri: string;
    readonly label: string;
    readonly id?: string;
  }[];

  /**
   * Version number (1-indexed).
   *
   * @remarks
   * Increments with each new version posted by author.
   */
  readonly version: number;

  /**
   * AT URI of previous version (if this is an update).
   */
  readonly previousVersionUri?: AtUri;

  /**
   * Changelog describing changes in this version.
   *
   * @remarks
   * Optional field provided by authors when uploading a new version.
   * Describes what changed compared to the previous version.
   *
   * @example "Fixed typos in section 3, updated methodology, added new references"
   */
  readonly versionNotes?: string;

  /**
   * License (SPDX identifier).
   *
   * @example "CC-BY-4.0", "MIT", "Apache-2.0"
   *
   * @see {@link https://spdx.org/licenses/ | SPDX License List}
   */
  readonly license: string;

  /**
   * Current publication status.
   *
   * @remarks
   * Tracks progression from eprint through review to publication.
   * Defaults to 'eprint' for new submissions.
   */
  readonly publicationStatus: PublicationStatus;

  /**
   * Link to the published version (Version of Record).
   *
   * @remarks
   * Populated when eprint has been published in a journal.
   * Uses CrossRef `isPreprintOf` relation pattern.
   */
  readonly publishedVersion?: PublishedVersion;

  /**
   * Related works.
   *
   * @remarks
   * Links to related eprints, datasets, software, and prior versions
   * using DataCite-compatible relation types.
   */
  readonly relatedWorks?: readonly RelatedWork[];

  /**
   * External persistent identifiers.
   *
   * @remarks
   * Links to external systems (arXiv, PubMed, SSRN, OpenAlex, etc.)
   * for discovery and interoperability.
   */
  readonly externalIds?: ExternalIds;

  /**
   * Linked repositories.
   *
   * @remarks
   * Code, data, protocols, and materials repositories.
   * Supports Software Heritage archival and RRIDs.
   */
  readonly repositories?: Repositories;

  /**
   * Funding sources.
   *
   * @remarks
   * Links to CrossRef Funder Registry and ROR for standardized IDs.
   */
  readonly funding?: readonly FundingSource[];

  /**
   * Conference presentation.
   *
   * @remarks
   * Information about conference where this work was presented.
   */
  readonly conferencePresentation?: ConferencePresentation;

  /**
   * Eprint creation timestamp.
   */
  readonly createdAt: Timestamp;

  /**
   * Last update timestamp.
   */
  readonly updatedAt?: Timestamp;
}

/**
 * Eprint version metadata.
 *
 * @remarks
 * Tracks version history for eprints with multiple revisions.
 *
 * @public
 */
export interface EprintVersion {
  /**
   * AT URI of this version's record.
   */
  readonly uri: AtUri;

  /**
   * CID of this version.
   */
  readonly cid: CID;

  /**
   * Version number (1-indexed).
   */
  readonly versionNumber: number;

  /**
   * AT URI of previous version.
   */
  readonly previousVersionUri?: AtUri;

  /**
   * Changelog describing changes in this version.
   */
  readonly changes: string;

  /**
   * Version creation timestamp.
   */
  readonly createdAt: Timestamp;
}

/**
 * User-generated tag on an eprint.
 *
 * @remarks
 * Tags provide folksonomy-style classification alongside formal facets.
 * Users can tag eprints with arbitrary strings for discovery.
 *
 * @public
 */
export interface UserTag {
  /**
   * AT URI of the tag record (in tagger's PDS).
   */
  readonly uri: AtUri;

  /**
   * AT URI of the eprint being tagged.
   */
  readonly eprintUri: AtUri;

  /**
   * DID of user who created the tag.
   */
  readonly tagger: DID;

  /**
   * Tag value.
   *
   * @remarks
   * Normalized to lowercase, hyphen-separated.
   * Display form may differ.
   */
  readonly tag: string;

  /**
   * Tag creation timestamp.
   */
  readonly createdAt: Timestamp;
}
