/**
 * Review domain models.
 *
 * @remarks
 * This module defines domain models for peer reviews and endorsements.
 * All models are immutable (readonly properties).
 *
 * @packageDocumentation
 * @public
 */

import type { AtUri, CID, DID, Timestamp } from '../atproto.js';

/**
 * Review comment on an eprint.
 *
 * @remarks
 * Represents a peer review comment, which can be inline (attached to specific
 * line) or general. Reviews support threaded discussions.
 *
 * @public
 */
export interface Review {
  /**
   * AT URI of the review record.
   */
  readonly uri: AtUri;

  /**
   * CID of this review version.
   */
  readonly cid: CID;

  /**
   * AT URI of the eprint being reviewed.
   */
  readonly eprintUri: AtUri;

  /**
   * DID of the reviewer.
   */
  readonly reviewer: DID;

  /**
   * Review content (Markdown).
   */
  readonly content: string;

  /**
   * Line number for inline comments.
   *
   * @remarks
   * If provided, this review is attached to a specific line in the PDF.
   * Null for general comments.
   */
  readonly lineNumber?: number;

  /**
   * Parent review URI for threaded discussions.
   *
   * @remarks
   * If provided, this review is a reply to another review.
   * Null for top-level comments.
   */
  readonly parentReviewUri?: AtUri;

  /**
   * Review creation timestamp.
   */
  readonly createdAt: Timestamp;

  /**
   * Last update timestamp.
   */
  readonly updatedAt?: Timestamp;
}

/**
 * Endorsement of an eprint.
 *
 * @remarks
 * Formal endorsement indicating that the endorser vouches for specific
 * aspects of the eprint (methods, results, or overall quality).
 *
 * @public
 */
export interface Endorsement {
  /**
   * AT URI of the endorsement record.
   */
  readonly uri: AtUri;

  /**
   * CID of this endorsement.
   */
  readonly cid: CID;

  /**
   * AT URI of the endorsed eprint.
   */
  readonly eprintUri: AtUri;

  /**
   * DID of the endorser.
   */
  readonly endorser: DID;

  /**
   * Type of endorsement.
   *
   * @remarks
   * - `methods`: Endorses experimental/computational methods
   * - `results`: Endorses findings and conclusions
   * - `overall`: General endorsement of quality
   */
  readonly endorsementType: 'methods' | 'results' | 'overall';

  /**
   * Optional comment explaining endorsement.
   */
  readonly comment?: string;

  /**
   * Endorsement creation timestamp.
   */
  readonly createdAt: Timestamp;
}
