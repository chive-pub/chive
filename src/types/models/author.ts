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

import type { BlobRef, DID } from '../atproto.js';

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
   * Total number of preprints authored or co-authored.
   */
  readonly preprintCount: number;

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
