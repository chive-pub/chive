/**
 * Preprint domain models.
 *
 * @remarks
 * This module defines domain models for preprints, preprint versions,
 * and user-generated tags. All models are immutable (readonly properties).
 *
 * @packageDocumentation
 * @public
 */

import type { AtUri, BlobRef, CID, DID, Timestamp } from '../atproto.js';
import type { Facet } from '../interfaces/graph.interface.js';

/**
 * Preprint domain model.
 *
 * @remarks
 * Represents a scholarly preprint indexed by Chive. This model captures
 * the essential metadata from the user's PDS record.
 *
 * **ATProto Compliance**:
 * - `pdfBlobRef` is a reference (CID pointer), not blob data
 * - Actual PDF remains in user's PDS
 * - Record is rebuildable from firehose
 *
 * @public
 */
export interface Preprint {
  /**
   * AT URI of the preprint record.
   */
  readonly uri: AtUri;

  /**
   * CID of this preprint version.
   */
  readonly cid: CID;

  /**
   * Primary author's DID.
   */
  readonly author: DID;

  /**
   * Co-authors' DIDs.
   *
   * @remarks
   * Empty array if single-authored.
   */
  readonly coAuthors?: readonly DID[];

  /**
   * Preprint title.
   */
  readonly title: string;

  /**
   * Preprint abstract.
   */
  readonly abstract: string;

  /**
   * Blob reference to PDF in user's PDS.
   *
   * @remarks
   * This is a BlobRef (metadata), not the PDF itself. Fetch PDF via
   * `IRepository.getBlob()` for proxying.
   */
  readonly pdfBlobRef: BlobRef;

  /**
   * Blob references to supplementary materials.
   *
   * @remarks
   * Optional additional files (datasets, code, figures).
   */
  readonly supplementaryBlobRefs?: readonly BlobRef[];

  /**
   * Author-provided keywords.
   */
  readonly keywords: readonly string[];

  /**
   * Faceted classification values.
   *
   * @remarks
   * 10-dimensional PMEST + FAST facets for precise classification.
   */
  readonly facets: readonly Facet[];

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
   * Preprint creation timestamp.
   */
  readonly createdAt: Timestamp;

  /**
   * Last update timestamp.
   */
  readonly updatedAt?: Timestamp;
}

/**
 * Preprint version metadata.
 *
 * @remarks
 * Tracks version history for preprints with multiple revisions.
 *
 * @public
 */
export interface PreprintVersion {
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
 * User-generated tag on a preprint.
 *
 * @remarks
 * Tags provide folksonomy-style classification alongside formal facets.
 * Users can tag preprints with arbitrary strings for discovery.
 *
 * @public
 */
export interface UserTag {
  /**
   * AT URI of the tag record (in tagger's PDS).
   */
  readonly uri: AtUri;

  /**
   * AT URI of the preprint being tagged.
   */
  readonly preprintUri: AtUri;

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
