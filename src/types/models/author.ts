/**
 * Author domain models.
 *
 * @remarks
 * This module defines domain models for author profiles and metrics.
 * All models are immutable (readonly properties).
 *
 * @packageDocumentation
 * @public
 */

import type { AtUri, BlobRef, DID } from '../atproto.js';

// =============================================================================
// Eprint Author Models (for submission records)
// =============================================================================

/**
 * Contribution degree modifier for author contributions.
 *
 * @remarks
 * Following CRediT taxonomy conventions:
 * - `lead`: Primary responsibility for this contribution
 * - `equal`: Shared responsibility equally with others
 * - `supporting`: Assisted with this contribution
 *
 * @public
 */
export type ContributionDegree = 'lead' | 'equal' | 'supporting';

/**
 * Author affiliation with optional ROR ID and department.
 *
 * @remarks
 * Used in eprint submission records to capture author affiliations.
 *
 * @public
 */
export interface EprintAuthorAffiliation {
  /**
   * Organization name.
   */
  readonly name: string;

  /**
   * ROR ID (e.g., "https://ror.org/02mhbdp94").
   *
   * @see {@link https://ror.org/ | Research Organization Registry}
   */
  readonly rorId?: string;

  /**
   * Department or division within organization.
   */
  readonly department?: string;
}

/**
 * Author contribution with type URI and degree.
 *
 * @remarks
 * Links to contribution types in the Governance PDS knowledge graph.
 * Based on CRediT (Contributor Roles Taxonomy) standard.
 *
 * @see {@link https://credit.niso.org/ | CRediT}
 * @public
 */
export interface EprintAuthorContribution {
  /**
   * AT-URI to contribution type from knowledge graph.
   *
   * @example "at://did:plc:chive-governance/pub.chive.graph.concept/conceptualization"
   */
  readonly typeUri: AtUri;

  /**
   * Contribution type ID (for display convenience).
   *
   * @example "conceptualization"
   */
  readonly typeId?: string;

  /**
   * Human-readable label.
   *
   * @example "Conceptualization"
   */
  readonly typeLabel?: string;

  /**
   * Contribution degree modifier.
   */
  readonly degree: ContributionDegree;
}

/**
 * Full author entry for eprint submissions.
 *
 * @remarks
 * Represents an author in an eprint submission record. Supports both
 * ATProto users (with DID) and external collaborators (without DID).
 *
 * @public
 */
export interface EprintAuthor {
  /**
   * Author DID if they have an ATProto account.
   *
   * @remarks
   * Optional for external collaborators who don't have ATProto accounts.
   */
  readonly did?: DID;

  /**
   * Author display name (required for all authors).
   */
  readonly name: string;

  /**
   * ATProto handle (e.g., "alice.bsky.social").
   *
   * @remarks
   * Only present for ATProto users, resolved from DID.
   */
  readonly handle?: string;

  /**
   * Avatar URL for the author.
   *
   * @remarks
   * URL to author's avatar image. For ATProto users, this is resolved
   * from their PDS blob storage. For external authors, may be empty.
   */
  readonly avatarUrl?: string;

  /**
   * ORCID identifier.
   *
   * @remarks
   * Format: "0000-0002-1825-0097" (without "https://orcid.org/" prefix)
   */
  readonly orcid?: string;

  /**
   * Contact email (for external authors).
   */
  readonly email?: string;

  /**
   * Position in author list (1-indexed).
   */
  readonly order: number;

  /**
   * Author affiliations.
   */
  readonly affiliations: readonly EprintAuthorAffiliation[];

  /**
   * CRediT-based contributions.
   */
  readonly contributions: readonly EprintAuthorContribution[];

  /**
   * Whether this is a corresponding author.
   */
  readonly isCorrespondingAuthor: boolean;

  /**
   * Whether this author is highlighted (co-first, co-last).
   */
  readonly isHighlighted: boolean;
}

// =============================================================================
// Author Profile Models (for actor profiles)
// =============================================================================

/**
 * Institutional affiliation with optional ROR ID.
 *
 * @public
 */
export interface Affiliation {
  /**
   * Organization name.
   */
  readonly name: string;

  /**
   * ROR ID (e.g., "https://ror.org/02mhbdp94").
   *
   * @see {@link https://ror.org/ | Research Organization Registry}
   */
  readonly rorId?: string;
}

/**
 * Research keyword with optional authority IDs.
 *
 * @public
 */
export interface ResearchKeyword {
  /**
   * Keyword label.
   */
  readonly label: string;

  /**
   * FAST subject heading ID.
   *
   * @see {@link https://fast.oclc.org/ | FAST}
   */
  readonly fastId?: string;

  /**
   * Wikidata entity ID (e.g., "Q12345").
   *
   * @see {@link https://www.wikidata.org/ | Wikidata}
   */
  readonly wikidataId?: string;
}

/**
 * Author profile.
 *
 * @remarks
 * Represents an author's public profile information, fetched from their
 * PDS or aggregated from multiple records.
 *
 * @public
 */
export interface Author {
  /**
   * Author's DID.
   */
  readonly did: DID;

  /**
   * Author's handle (e.g., "alice.bsky.social").
   *
   * @remarks
   * Optional because not all DIDs have handles.
   */
  readonly handle?: string;

  /**
   * Display name.
   */
  readonly displayName?: string;

  /**
   * Biography (Markdown).
   */
  readonly bio?: string;

  /**
   * Avatar image blob reference.
   *
   * @remarks
   * This is a BlobRef (metadata), not image data. Fetch via
   * `IRepository.getBlob()` for display.
   */
  readonly avatarBlobRef?: BlobRef;

  /**
   * ORCID identifier.
   *
   * @remarks
   * Format: "0000-0002-1825-0097" (without "https://orcid.org/" prefix)
   *
   * @see {@link https://orcid.org/ | ORCID}
   */
  readonly orcid?: string;

  /**
   * Current institutional affiliations with optional ROR IDs.
   *
   * @example [{ name: "Stanford University", rorId: "https://ror.org/00f54p054" }]
   */
  readonly affiliations?: readonly Affiliation[];

  /**
   * Research fields (field node IDs).
   *
   * @remarks
   * Links to knowledge graph field nodes.
   */
  readonly fields?: readonly string[];

  /**
   * Alternative name forms for paper matching.
   *
   * @remarks
   * Includes maiden names, transliterations, initials (e.g., "J. Smith"),
   * and other forms the author may have published under.
   *
   * @example ["Jane A. Smith", "J. A. Smith", "Jane Doe"]
   */
  readonly nameVariants?: readonly string[];

  /**
   * Past institutional affiliations.
   *
   * @remarks
   * Previous affiliations that may appear on older papers.
   * Helps match papers published before current affiliation.
   *
   * @example [{ name: "MIT", rorId: "https://ror.org/042nb2s44" }]
   */
  readonly previousAffiliations?: readonly Affiliation[];

  /**
   * Research topics and keywords with optional authority IDs.
   *
   * @remarks
   * User-provided keywords describing research areas.
   * Used for content matching in paper suggestions.
   *
   * @example [{ label: "machine learning", fastId: "1715496" }]
   */
  readonly researchKeywords?: readonly ResearchKeyword[];

  /**
   * Semantic Scholar author ID.
   *
   * @remarks
   * Links to author's Semantic Scholar profile for paper matching.
   *
   * @see {@link https://www.semanticscholar.org/ | Semantic Scholar}
   */
  readonly semanticScholarId?: string;

  /**
   * OpenAlex author ID.
   *
   * @remarks
   * OpenAlex unique identifier (e.g., "A5023888391").
   *
   * @see {@link https://openalex.org/ | OpenAlex}
   */
  readonly openAlexId?: string;

  /**
   * Google Scholar profile ID.
   *
   * @remarks
   * Google Scholar user identifier from profile URL.
   */
  readonly googleScholarId?: string;

  /**
   * arXiv author identifier.
   *
   * @remarks
   * arXiv author ID for matching arXiv submissions.
   */
  readonly arxivAuthorId?: string;

  /**
   * OpenReview profile ID.
   *
   * @remarks
   * OpenReview author profile identifier.
   *
   * @see {@link https://openreview.net/ | OpenReview}
   */
  readonly openReviewId?: string;

  /**
   * DBLP author identifier.
   *
   * @remarks
   * DBLP author key (e.g., "homepages/s/JohnSmith").
   *
   * @see {@link https://dblp.org/ | DBLP}
   */
  readonly dblpId?: string;

  /**
   * Scopus author ID.
   *
   * @remarks
   * Elsevier Scopus author identifier.
   */
  readonly scopusAuthorId?: string;
}

/**
 * Author metrics computed by Chive AppView.
 *
 * @remarks
 * Aggregated metrics about an author's contributions and impact.
 * These are AppView-computed values, not stored in user PDSes.
 *
 * @public
 */
export interface AuthorMetrics {
  /**
   * Author's DID.
   */
  readonly did: DID;

  /**
   * Total number of eprints authored or co-authored.
   */
  readonly eprintCount: number;

  /**
   * Total number of endorsements received.
   */
  readonly endorsementCount: number;

  /**
   * Total citation count (if citation tracking enabled).
   *
   * @remarks
   * Optional feature requiring citation extraction from PDFs.
   */
  readonly citationCount?: number;

  /**
   * h-index (if citation tracking enabled).
   *
   * @remarks
   * Computed from citation counts. Requires citation tracking.
   */
  readonly hIndex?: number;
}
