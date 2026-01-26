/**
 * Types for rich text editor components.
 *
 * @remarks
 * Defines types for rich text content with ATProto-compatible facets.
 *
 * @packageDocumentation
 */

// =============================================================================
// FACET FEATURES
// =============================================================================

/**
 * Bold text formatting feature.
 */
export interface BoldFeature {
  $type: 'pub.chive.richtext.facets#bold';
}

/**
 * Italic text formatting feature.
 */
export interface ItalicFeature {
  $type: 'pub.chive.richtext.facets#italic';
}

/**
 * Strikethrough text formatting feature.
 */
export interface StrikethroughFeature {
  $type: 'pub.chive.richtext.facets#strikethrough';
}

/**
 * Inline code formatting feature.
 */
export interface CodeFeature {
  $type: 'pub.chive.richtext.facets#code';
}

/**
 * LaTeX math expression feature.
 */
export interface LatexFeature {
  $type: 'pub.chive.richtext.facets#latex';
  /** True for block display ($$...$$), false for inline ($...$) */
  displayMode: boolean;
}

/**
 * Heading formatting feature.
 */
export interface HeadingFeature {
  $type: 'pub.chive.richtext.facets#heading';
  /** Heading level (1-6) */
  level: number;
}

/**
 * Blockquote formatting feature.
 */
export interface BlockquoteFeature {
  $type: 'pub.chive.richtext.facets#blockquote';
}

/**
 * Code block formatting feature.
 */
export interface CodeBlockFeature {
  $type: 'pub.chive.richtext.facets#codeBlock';
  /** Programming language for syntax highlighting */
  language?: string;
}

/**
 * List item formatting feature.
 */
export interface ListItemFeature {
  $type: 'pub.chive.richtext.facets#listItem';
  /** Type of list */
  listType: 'bullet' | 'ordered';
  /** Nesting depth (0-indexed) */
  depth?: number;
  /** Item number for ordered lists */
  ordinal?: number;
}

/**
 * ATProto mention feature (from Bluesky).
 */
export interface MentionFeature {
  $type: 'app.bsky.richtext.facet#mention';
  did: string;
}

/**
 * ATProto link feature (from Bluesky).
 */
export interface LinkFeature {
  $type: 'app.bsky.richtext.facet#link';
  uri: string;
}

/**
 * ATProto tag feature (from Bluesky).
 */
export interface TagFeature {
  $type: 'app.bsky.richtext.facet#tag';
  tag: string;
}

/**
 * Union of all facet features.
 */
export type RichTextFeature =
  | BoldFeature
  | ItalicFeature
  | StrikethroughFeature
  | CodeFeature
  | LatexFeature
  | HeadingFeature
  | BlockquoteFeature
  | CodeBlockFeature
  | ListItemFeature
  | MentionFeature
  | LinkFeature
  | TagFeature;

// =============================================================================
// FACETS
// =============================================================================

/**
 * Byte index range for a facet.
 */
export interface FacetIndex {
  /** Start byte position (inclusive) */
  byteStart: number;
  /** End byte position (exclusive) */
  byteEnd: number;
}

/**
 * ATProto-compatible rich text facet.
 */
export interface RichTextFacet {
  /** Byte range for this facet */
  index: FacetIndex;
  /** Features applied to this range */
  features: RichTextFeature[];
}

// =============================================================================
// CONTENT
// =============================================================================

/**
 * Rich text content with plain text and facets.
 *
 * @remarks
 * This format is compatible with ATProto's rich text conventions.
 * The `text` field contains plain text, while `facets` array contains
 * formatting annotations with byte ranges.
 */
export interface RichTextContent {
  /** Plain text content */
  text: string;
  /** Optional HTML representation for preview */
  html?: string;
  /** ATProto-compatible facets array */
  facets?: RichTextFacet[];
}

/**
 * Convert RichTextContent to ATProto record format.
 *
 * @param content - Rich text content
 * @returns Object suitable for ATProto record
 */
export function toAtprotoRichText(content: RichTextContent): {
  text: string;
  facets?: RichTextFacet[];
} {
  return {
    text: content.text,
    facets: content.facets && content.facets.length > 0 ? content.facets : undefined,
  };
}

/**
 * Create empty rich text content.
 */
export function createEmptyContent(): RichTextContent {
  return {
    text: '',
    html: '',
    facets: [],
  };
}

/**
 * Create rich text content from plain text.
 */
export function createFromPlainText(text: string): RichTextContent {
  return {
    text,
    html: text,
    facets: [],
  };
}
