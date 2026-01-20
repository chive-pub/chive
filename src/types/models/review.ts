/**
 * Review domain models.
 *
 * @remarks
 * This module defines domain models for peer reviews and endorsements.
 * All models are immutable (readonly properties).
 *
 * Models are aligned with lexicon definitions:
 * - Review: pub.chive.review.comment
 * - Endorsement: pub.chive.review.endorsement
 *
 * @packageDocumentation
 * @public
 */

import type { AtUri, CID, DID, Timestamp } from '../atproto.js';

// =============================================================================
// RICH TEXT TYPES
// =============================================================================

/**
 * Plain text item in rich text body.
 */
export interface TextItem {
  readonly type: 'text';
  readonly content: string;
}

/**
 * Reference to a knowledge graph node in rich text.
 */
export interface NodeRefItem {
  readonly type: 'nodeRef';
  readonly nodeUri: AtUri;
  readonly label?: string;
}

/**
 * Reference to another eprint in rich text.
 */
export interface EprintRefItem {
  readonly type: 'eprintRef';
  readonly eprintUri: AtUri;
  readonly label?: string;
}

/**
 * Rich text item (union type).
 */
export type RichTextItem = TextItem | NodeRefItem | EprintRefItem;

/**
 * Target span in PDF for inline comments.
 */
export interface TextSpanTarget {
  readonly page?: number;
  readonly startOffset?: number;
  readonly endOffset?: number;
  readonly selectedText?: string;
}

/**
 * Known motivation types (fallback when URI not available).
 */
export type MotivationType =
  | 'commenting'
  | 'questioning'
  | 'assessing'
  | 'suggesting'
  | 'correcting'
  | 'highlighting';

// =============================================================================
// REVIEW (COMMENT) MODEL
// =============================================================================

/**
 * Review comment on an eprint.
 *
 * @remarks
 * Represents a peer review comment aligned with pub.chive.review.comment lexicon.
 * Supports rich text body with node/eprint references, threaded discussions,
 * and optional PDF targeting.
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
   * Rich text body (array of text/nodeRef/eprintRef items).
   */
  readonly body: readonly RichTextItem[];

  /**
   * Target span in PDF for inline comments.
   */
  readonly target?: TextSpanTarget;

  /**
   * AT URI of motivation node (from knowledge graph).
   */
  readonly motivationUri?: AtUri;

  /**
   * Fallback motivation type if URI not available.
   */
  readonly motivationFallback?: MotivationType;

  /**
   * Parent comment URI for threaded discussions.
   *
   * @remarks
   * If provided, this review is a reply to another review.
   * Null for top-level comments.
   */
  readonly parentComment?: AtUri;

  /**
   * Line number for inline comments (deprecated).
   *
   * @deprecated Use `target` instead. Kept for backward compatibility.
   */
  readonly lineNumber?: number;

  /**
   * Review creation timestamp.
   */
  readonly createdAt: Timestamp;

  /**
   * Last update timestamp.
   */
  readonly updatedAt?: Timestamp;
}

// =============================================================================
// ENDORSEMENT MODEL
// =============================================================================

/**
 * Endorsement of an eprint.
 *
 * @remarks
 * Formal endorsement aligned with pub.chive.review.endorsement lexicon.
 * Endorsers select one or more contribution qualities from the knowledge graph
 * (endorsement-contribution subkind nodes).
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
   * Contribution qualities being endorsed.
   *
   * @remarks
   * Array of slugs from endorsement-contribution nodes in the knowledge graph.
   * Examples: 'methodological', 'empirical', 'reproducibility', 'visualization'
   *
   * Must contain at least one value. Maximum 5 contributions per endorsement.
   *
   * @see pub.chive.review.endorsement lexicon for knownValues
   */
  readonly contributions: readonly string[];

  /**
   * Optional comment explaining endorsement.
   */
  readonly comment?: string;

  /**
   * Endorsement creation timestamp.
   */
  readonly createdAt: Timestamp;
}

// =============================================================================
// LEGACY COMPATIBILITY
// =============================================================================

/**
 * Legacy endorsement type (deprecated).
 *
 * @deprecated Use `contributions` array instead.
 */
export type LegacyEndorsementType = 'methods' | 'results' | 'overall';

/**
 * Maps legacy endorsement types to contribution slugs.
 *
 * @remarks
 * Used during migration and for backward compatibility.
 */
export const LEGACY_TYPE_TO_CONTRIBUTION: Record<LegacyEndorsementType, string> = {
  methods: 'methodological',
  results: 'empirical',
  overall: 'conceptual',
};

/**
 * Maps contribution slugs back to legacy types (for API compatibility).
 *
 * @remarks
 * Takes the first matching contribution if multiple are present.
 */
export const CONTRIBUTION_TO_LEGACY_TYPE: Record<string, LegacyEndorsementType> = {
  methodological: 'methods',
  analytical: 'methods',
  technical: 'methods',
  data: 'results',
  empirical: 'results',
  reproducibility: 'results',
  replication: 'results',
  validation: 'results',
  conceptual: 'overall',
  theoretical: 'overall',
  synthesis: 'overall',
  interdisciplinary: 'overall',
  pedagogical: 'overall',
  visualization: 'overall',
  'societal-impact': 'overall',
  clinical: 'overall',
};
