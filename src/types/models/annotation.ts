/**
 * Annotation domain models following W3C Web Annotation Data Model.
 *
 * @remarks
 * This module defines domain models for W3C-compliant text annotations.
 * Annotations support:
 * - Text span targeting (TextQuoteSelector + TextPositionSelector)
 * - Rich text bodies with embedded references (FOVEA GlossItem pattern)
 * - Entity linking to Wikidata, authorities, and knowledge graph
 *
 * @see {@link https://www.w3.org/TR/annotation-model/ | W3C Web Annotation Data Model}
 *
 * @packageDocumentation
 * @public
 */

import type { DocumentFormat } from '../../lexicons/generated/types/pub/chive/defs.js';
import type { AtUri, CID, DID, Timestamp } from '../atproto.js';

// =============================================================================
// W3C WEB ANNOTATION: TARGET SELECTORS
// =============================================================================

/**
 * W3C TextQuoteSelector for resilient text matching.
 *
 * @remarks
 * Identifies text by copying the exact phrase plus surrounding context.
 * This allows matching even if the document is slightly modified.
 *
 * @see {@link https://www.w3.org/TR/annotation-model/#text-quote-selector | W3C TextQuoteSelector}
 *
 * @public
 */
export interface TextQuoteSelector {
  /** Selector type identifier */
  readonly type: 'TextQuoteSelector';
  /** The exact text that was selected */
  readonly exact: string;
  /** Context before the selection (up to 32 chars) */
  readonly prefix?: string;
  /** Context after the selection (up to 32 chars) */
  readonly suffix?: string;
}

/**
 * Supported document formats for annotations.
 *
 * @public
 */
export type { DocumentFormat };

/**
 * Document format capabilities hint.
 *
 * @remarks
 * Indicates which targeting features are available for a given document format.
 * Used by viewers to determine how to resolve selectors.
 *
 * @public
 */
export interface DocumentFormatHint {
  /** Document format */
  readonly format: DocumentFormat;
  /** Whether the format has discrete pages (PDF, EPUB) */
  readonly hasPages: boolean;
  /** Whether the format has semantic sections (HTML, Markdown, LaTeX) */
  readonly hasSections: boolean;
  /** Whether the format has cells (Jupyter notebooks) */
  readonly hasCells: boolean;
  /** Whether the format has line numbers (code, LaTeX) */
  readonly hasLineNumbers: boolean;
}

/**
 * Document format capability mappings.
 *
 * @public
 */
export const DOCUMENT_FORMAT_HINTS: Record<DocumentFormat, DocumentFormatHint> = {
  pdf: {
    format: 'pdf',
    hasPages: true,
    hasSections: false,
    hasCells: false,
    hasLineNumbers: false,
  },
  docx: {
    format: 'docx',
    hasPages: true,
    hasSections: true,
    hasCells: false,
    hasLineNumbers: false,
  },
  html: {
    format: 'html',
    hasPages: false,
    hasSections: true,
    hasCells: false,
    hasLineNumbers: false,
  },
  markdown: {
    format: 'markdown',
    hasPages: false,
    hasSections: true,
    hasCells: false,
    hasLineNumbers: true,
  },
  latex: {
    format: 'latex',
    hasPages: false,
    hasSections: true,
    hasCells: false,
    hasLineNumbers: true,
  },
  jupyter: {
    format: 'jupyter',
    hasPages: false,
    hasSections: false,
    hasCells: true,
    hasLineNumbers: true,
  },
  odt: { format: 'odt', hasPages: true, hasSections: true, hasCells: false, hasLineNumbers: false },
  rtf: {
    format: 'rtf',
    hasPages: false,
    hasSections: false,
    hasCells: false,
    hasLineNumbers: false,
  },
  epub: {
    format: 'epub',
    hasPages: true,
    hasSections: true,
    hasCells: false,
    hasLineNumbers: false,
  },
  txt: {
    format: 'txt',
    hasPages: false,
    hasSections: false,
    hasCells: false,
    hasLineNumbers: true,
  },
};

/**
 * W3C TextPositionSelector extended for multi-format documents.
 *
 * @remarks
 * Uses character offsets within the normalized text of a resource.
 * The first character is position 0. Start is inclusive, end is exclusive.
 *
 * Extended fields support different document formats:
 * - pageNumber: For PDF, DOCX, EPUB (1-indexed)
 * - sectionId: For HTML/Markdown/LaTeX headings
 * - cellId: For Jupyter notebook cells
 * - lineNumber/columnStart/columnEnd: For code in Markdown, LaTeX, Jupyter
 *
 * @see {@link https://www.w3.org/TR/annotation-model/#text-position-selector | W3C TextPositionSelector}
 *
 * @public
 */
export interface TextPositionSelector {
  /** Selector type identifier */
  readonly type: 'TextPositionSelector';
  /** Starting character offset (inclusive) */
  readonly start: number;
  /** Ending character offset (exclusive) */
  readonly end: number;
  /** Page number for paginated formats (PDF, DOCX, EPUB) - 1-indexed */
  readonly pageNumber?: number;
  /** Section ID for structured documents (HTML heading id, Markdown heading slug) */
  readonly sectionId?: string;
  /** Cell ID for Jupyter notebooks */
  readonly cellId?: string;
  /** Line number for code-based formats - 1-indexed */
  readonly lineNumber?: number;
  /** Starting column for code spans - 0-indexed */
  readonly columnStart?: number;
  /** Ending column for code spans - 0-indexed */
  readonly columnEnd?: number;
}

/**
 * Combined text span target using W3C SpecificResource pattern.
 *
 * @remarks
 * Combines TextQuoteSelector (for resilience) with TextPositionSelector
 * (for precise highlighting) to maximize the chances of finding the
 * annotated text across document changes.
 *
 * @public
 */
export interface TextSpanTarget {
  /** AT-URI of the eprint being annotated */
  readonly source: AtUri;
  /** Primary selector using text quote matching */
  readonly selector: TextQuoteSelector;
  /** Optional position selector for precise highlighting */
  readonly refinedBy?: TextPositionSelector;
}

// =============================================================================
// ANNOTATION BODY: FOVEA GLOSSITEM PATTERN
// =============================================================================

/**
 * Plain text content in an annotation body.
 *
 * @public
 */
export interface TextBodyItem {
  readonly type: 'text';
  /** The text content */
  readonly content: string;
}

/**
 * Reference to a Wikidata entity.
 *
 * @public
 */
export interface WikidataRefBodyItem {
  readonly type: 'wikidataRef';
  /** Wikidata Q-identifier (e.g., 'Q76') */
  readonly qid: string;
  /** Human-readable label */
  readonly label: string;
  /** Full Wikidata URL */
  readonly url?: string;
}

/**
 * Reference to a Chive authority record.
 *
 * @public
 */
export interface AuthorityRefBodyItem {
  readonly type: 'authorityRef';
  /** AT-URI of the authority record */
  readonly uri: AtUri;
  /** Authorized form of the term */
  readonly label: string;
}

/**
 * Reference to a knowledge graph field.
 *
 * @public
 */
export interface FieldRefBodyItem {
  readonly type: 'fieldRef';
  /** AT-URI or ID of the field */
  readonly uri: AtUri;
  /** Field display name */
  readonly label: string;
}

/**
 * Reference to a PMEST/FAST facet value.
 *
 * @public
 */
export interface FacetRefBodyItem {
  readonly type: 'facetRef';
  /** Facet dimension (personality, matter, energy, space, time, person, organization, event, work, form-genre) */
  readonly dimension: string;
  /** Facet value */
  readonly value: string;
}

/**
 * Reference to another eprint.
 *
 * @public
 */
export interface EprintRefBodyItem {
  readonly type: 'eprintRef';
  /** AT-URI of the referenced eprint */
  readonly uri: AtUri;
  /** Eprint title */
  readonly title: string;
}

/**
 * Reference to another annotation (for cross-referencing).
 *
 * @public
 */
export interface AnnotationRefBodyItem {
  readonly type: 'annotationRef';
  /** AT-URI of the referenced annotation */
  readonly uri: AtUri;
  /** Short excerpt from the referenced annotation */
  readonly excerpt: string;
}

/**
 * Reference to an author/researcher.
 *
 * @public
 */
export interface AuthorRefBodyItem {
  readonly type: 'authorRef';
  /** Author's DID */
  readonly did: DID;
  /** Author's display name */
  readonly displayName: string;
}

/**
 * Reference to a knowledge graph node (unified model).
 *
 * @remarks
 * Used for referencing any type of node in the unified knowledge graph,
 * including fields, facets, contribution types, institutions, persons, etc.
 * The subkind determines the styling.
 *
 * @public
 */
export interface NodeRefBodyItem {
  readonly type: 'nodeRef';
  /** AT-URI of the referenced node */
  readonly uri: AtUri;
  /** Human-readable label */
  readonly label: string;
  /** Subkind slug for styling (e.g., 'field', 'institution', 'person') */
  readonly subkind?: string;
}

/**
 * Union type for all annotation body item types.
 *
 * @remarks
 * Follows the FOVEA GlossItem pattern for rich text with embedded references.
 * Use trigger characters in the editor:
 * - `@` for object nodes (institutions, persons, topics, geographic, events)
 * - `#` for type nodes (fields, facets, contribution-types, licenses, etc.)
 * - `@eprint:` for other eprints
 * - `^` for other annotations
 *
 * @public
 */
export type AnnotationBodyItem =
  | TextBodyItem
  | WikidataRefBodyItem
  | AuthorityRefBodyItem
  | FieldRefBodyItem
  | FacetRefBodyItem
  | EprintRefBodyItem
  | AnnotationRefBodyItem
  | AuthorRefBodyItem
  | NodeRefBodyItem;

/**
 * Rich text annotation body with embedded references.
 *
 * @remarks
 * The body is an ordered list of items that can be text or references.
 * When rendered, text items are displayed inline and references are
 * rendered as interactive chips.
 *
 * @public
 */
export interface AnnotationBody {
  /** Body type identifier */
  readonly type: 'RichText';
  /** Ordered list of text and reference items */
  readonly items: readonly AnnotationBodyItem[];
  /** MIME type for the gloss format */
  readonly format: 'application/x-chive-gloss+json';
}

/**
 * Generic rich text body type alias.
 *
 * @remarks
 * Used for rich text content outside of annotations (e.g., eprint abstracts, author bios).
 * Structurally identical to AnnotationBody.
 *
 * @public
 */
export type RichTextBody = AnnotationBody;

// =============================================================================
// ENTITY LINKING
// =============================================================================

/**
 * Wikidata entity link.
 *
 * @public
 */
export interface WikidataEntityLink {
  readonly type: 'wikidata';
  /** Wikidata Q-identifier */
  readonly qid: string;
  /** Human-readable label */
  readonly label: string;
  /** Full Wikidata URL */
  readonly url: string;
}

/**
 * Authority record entity link.
 *
 * @public
 */
export interface AuthorityEntityLink {
  readonly type: 'authority';
  /** AT-URI of the authority record */
  readonly uri: AtUri;
  /** Authorized (preferred) form */
  readonly authorizedForm: string;
  /** Alternative forms that map to this authority */
  readonly variantForms?: readonly string[];
}

/**
 * Knowledge graph field entity link.
 *
 * @public
 */
export interface FieldEntityLink {
  readonly type: 'field';
  /** Field AT-URI or ID */
  readonly uri: AtUri;
  /** Field name */
  readonly label: string;
  /** Breadcrumb path to root */
  readonly hierarchy?: readonly string[];
}

/**
 * Author entity link.
 *
 * @public
 */
export interface AuthorEntityLink {
  readonly type: 'author';
  /** Author's DID */
  readonly did: DID;
  /** Display name */
  readonly displayName: string;
  /** ORCID identifier if available */
  readonly orcid?: string;
}

/**
 * Eprint entity link.
 *
 * @public
 */
export interface EprintEntityLink {
  readonly type: 'eprint';
  /** Eprint AT-URI */
  readonly uri: AtUri;
  /** Eprint title */
  readonly title: string;
}

/**
 * Union type for all entity link types.
 *
 * @remarks
 * Entity links associate a text span directly with a knowledge graph entity.
 * This is separate from the annotation body - it represents what the span IS,
 * not what someone is saying ABOUT it.
 *
 * @public
 */
export type EntityLinkType =
  | WikidataEntityLink
  | AuthorityEntityLink
  | FieldEntityLink
  | AuthorEntityLink
  | EprintEntityLink;

/**
 * A span-to-entity link associating selected text with a knowledge graph entity.
 *
 * @remarks
 * This is different from an annotation body reference. A SpanEntityLink says
 * "this text span refers to this entity" (identification), while body references
 * are part of a comment about the text.
 *
 * @public
 */
export interface SpanEntityLink {
  /** The text span being linked */
  readonly target: TextSpanTarget;
  /** The entity the span refers to */
  readonly linkedEntity: EntityLinkType;
  /** Confidence score (0-1) */
  readonly confidence?: number;
  /** DID of the user who created the link */
  readonly createdBy: DID;
  /** Timestamp of creation */
  readonly createdAt: Timestamp;
}

// =============================================================================
// ANNOTATION MOTIVATIONS (W3C)
// =============================================================================

/**
 * W3C Web Annotation motivation types.
 *
 * @see {@link https://www.w3.org/TR/annotation-model/#motivation-and-purpose | W3C Motivations}
 *
 * @public
 */
export type AnnotationMotivation =
  /** General review comment */
  | 'commenting'
  /** Highlight without text body */
  | 'highlighting'
  /** Identify/link span to entity */
  | 'identifying'
  /** Link to external resource */
  | 'linking'
  /** Question about the text */
  | 'questioning'
  /** Reply to another annotation */
  | 'replying';

// =============================================================================
// COMPLETE ANNOTATION STRUCTURE
// =============================================================================

/**
 * Complete annotation structure following W3C Web Annotation model.
 *
 * @remarks
 * Annotations are stored in the user's PDS and indexed by Chive.
 * They combine:
 * - Target: What text span is being annotated (optional for general reviews)
 * - Entity Link: What entity the span represents (optional)
 * - Body: Rich text comment with embedded references
 * - Motivation: Why the annotation was made
 * - Threading: Link to parent annotation for replies
 *
 * @public
 */
export interface Annotation {
  /** AT-URI of the annotation in the user's PDS */
  readonly uri: AtUri;

  /** Content hash (CID) for verification */
  readonly cid: CID;

  /** AT-URI of the annotated eprint */
  readonly eprintUri: AtUri;

  /** Target text span (undefined for general reviews) */
  readonly target?: TextSpanTarget;

  /** Entity link for the span (optional) */
  readonly entityLink?: EntityLinkType;

  /** Rich text body with references */
  readonly body: AnnotationBody;

  /** Why the annotation was made */
  readonly motivation: AnnotationMotivation;

  /** Parent annotation URI for threading */
  readonly parentAnnotationUri?: AtUri;

  /** DID of the annotation creator */
  readonly creator: DID;

  /** Annotation creation timestamp */
  readonly createdAt: Timestamp;

  /** Last update timestamp */
  readonly updatedAt?: Timestamp;
}

/**
 * Thread metadata for annotations.
 *
 * @public
 */
export interface AnnotationThread {
  /** Nesting depth (0 = top-level) */
  readonly depth: number;
  /** Parent annotation URI */
  readonly parentUri?: AtUri;
  /** Number of direct replies */
  readonly replyCount: number;
}
