/**
 * Review API schemas.
 *
 * @remarks
 * Zod schemas for review-related API requests and responses.
 * Reviews support unlimited-depth threading and W3C-compliant text span targeting.
 *
 * @packageDocumentation
 * @public
 */

import { z } from 'zod';

import { atUriSchema, didSchema, authorRefSchema, paginationQuerySchema } from './common.js';

/**
 * Annotation motivation schema (W3C Web Annotation Data Model).
 *
 * @public
 */
export const annotationMotivationSchema = z.enum([
  'commenting',
  'highlighting',
  'questioning',
  'replying',
  'assessing',
  'bookmarking',
  'classifying',
  'describing',
  'editing',
  'linking',
  'moderating',
  'tagging',
]);

/**
 * Annotation motivation type.
 *
 * @public
 */
export type AnnotationMotivation = z.infer<typeof annotationMotivationSchema>;

/**
 * Text quote selector schema (W3C Web Annotation).
 *
 * @remarks
 * TextQuoteSelector identifies content by exact text match with optional context.
 *
 * @see {@link https://www.w3.org/TR/annotation-model/#text-quote-selector}
 * @public
 */
export const textQuoteSelectorSchema = z.object({
  type: z.literal('TextQuoteSelector'),
  exact: z.string().describe('Exact text to match'),
  prefix: z.string().optional().describe('Text immediately before the match'),
  suffix: z.string().optional().describe('Text immediately after the match'),
});

/**
 * Text position selector schema (W3C Web Annotation).
 *
 * @remarks
 * TextPositionSelector identifies content by character offsets.
 *
 * @see {@link https://www.w3.org/TR/annotation-model/#text-position-selector}
 * @public
 */
export const textPositionSelectorSchema = z.object({
  type: z.literal('TextPositionSelector'),
  start: z.number().int().min(0).describe('Start character offset'),
  end: z.number().int().min(0).describe('End character offset'),
});

/**
 * Bounding rectangle schema for visual positioning.
 *
 * @remarks
 * Stores normalized coordinates (0-1) relative to page dimensions.
 *
 * @public
 */
export const boundingRectSchema = z.object({
  x1: z.number().min(0).max(1).describe('Left edge (normalized 0-1)'),
  y1: z.number().min(0).max(1).describe('Top edge (normalized 0-1)'),
  x2: z.number().min(0).max(1).describe('Right edge (normalized 0-1)'),
  y2: z.number().min(0).max(1).describe('Bottom edge (normalized 0-1)'),
  width: z.number().min(0).describe('Page width in pixels'),
  height: z.number().min(0).describe('Page height in pixels'),
});

/**
 * Refinement for text selectors with position and page info.
 *
 * @remarks
 * Used to refine a TextQuoteSelector with precise positioning.
 * Includes optional boundingRect for visual highlighting.
 *
 * @public
 */
export const selectorRefinementSchema = z.object({
  type: z.literal('TextPositionSelector'),
  start: z.number().int().min(0).describe('Start character offset'),
  end: z.number().int().min(0).describe('End character offset'),
  pageNumber: z.number().int().min(1).optional().describe('Page number in PDF'),
  boundingRect: boundingRectSchema.optional().describe('Visual bounding rectangle'),
});

/**
 * Text span target schema (W3C Web Annotation compliant).
 *
 * @remarks
 * Supports both TextQuoteSelector (for text matching) and refinement
 * via TextPositionSelector (for precise positioning).
 *
 * @public
 */
export const textSpanTargetSchema = z.object({
  source: atUriSchema.describe('Preprint AT-URI'),
  selector: textQuoteSelectorSchema.optional().describe('Text quote selector'),
  refinedBy: selectorRefinementSchema.optional().describe('Position refinement with page info'),
  page: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe('Page number (deprecated, use refinedBy.pageNumber)'),
});

/**
 * Text span target type.
 *
 * @public
 */
export type TextSpanTarget = z.infer<typeof textSpanTargetSchema>;

/**
 * Rich text facet schema.
 *
 * @public
 */
export const richTextFacetSchema = z.object({
  index: z.object({
    byteStart: z.number().int().min(0),
    byteEnd: z.number().int().min(0),
  }),
  features: z.array(
    z.discriminatedUnion('$type', [
      z.object({
        $type: z.literal('app.bsky.richtext.facet#mention'),
        did: didSchema,
      }),
      z.object({
        $type: z.literal('app.bsky.richtext.facet#link'),
        uri: z.string().url(),
      }),
      z.object({
        $type: z.literal('app.bsky.richtext.facet#tag'),
        tag: z.string(),
      }),
    ])
  ),
});

/**
 * Annotation body schema.
 *
 * @public
 */
export const annotationBodySchema = z.object({
  text: z.string().max(10000).describe('Plain text content'),
  facets: z.array(richTextFacetSchema).optional().describe('Rich text facets'),
});

/**
 * Annotation body type.
 *
 * @public
 */
export type AnnotationBody = z.infer<typeof annotationBodySchema>;

/**
 * Review schema.
 *
 * @public
 */
export const reviewSchema = z.object({
  uri: atUriSchema.describe('Review AT-URI'),
  cid: z.string().describe('Content identifier'),
  author: authorRefSchema.describe('Review author'),
  preprintUri: atUriSchema.describe('Preprint being reviewed'),
  content: z.string().describe('Plain text content'),
  body: annotationBodySchema.optional().describe('Rich text body'),
  target: textSpanTargetSchema.optional().describe('Target span for inline annotations'),
  motivation: annotationMotivationSchema.default('commenting').describe('Motivation'),
  parentReviewUri: atUriSchema.optional().describe('Parent review URI for replies'),
  replyCount: z.number().int().default(0).describe('Number of direct replies'),
  createdAt: z.string().datetime().describe('Creation timestamp'),
  indexedAt: z.string().datetime().describe('Index timestamp'),
});

/**
 * Review type.
 *
 * @public
 */
export type Review = z.infer<typeof reviewSchema>;

/**
 * Review thread schema.
 *
 * @public
 */
export const reviewThreadSchema = z.object({
  parent: reviewSchema.describe('Parent review'),
  replies: z.array(reviewSchema).describe('Direct replies'),
  totalReplies: z.number().int().describe('Total replies (recursive)'),
});

/**
 * Review thread type.
 *
 * @public
 */
export type ReviewThread = z.infer<typeof reviewThreadSchema>;

/**
 * List reviews for preprint params schema.
 *
 * @public
 */
export const listReviewsForPreprintParamsSchema = paginationQuerySchema.extend({
  preprintUri: atUriSchema.describe('Preprint AT-URI'),
  motivation: annotationMotivationSchema.optional().describe('Filter by motivation'),
  inlineOnly: z.coerce.boolean().optional().describe('Only include inline annotations'),
});

/**
 * List reviews for preprint params type.
 *
 * @public
 */
export type ListReviewsForPreprintParams = z.infer<typeof listReviewsForPreprintParamsSchema>;

/**
 * Get review thread params schema.
 *
 * @public
 */
export const getReviewThreadParamsSchema = z.object({
  uri: atUriSchema.describe('Review AT-URI'),
});

/**
 * Get review thread params type.
 *
 * @public
 */
export type GetReviewThreadParams = z.infer<typeof getReviewThreadParamsSchema>;

/**
 * Create review input schema.
 *
 * @public
 */
export const createReviewInputSchema = z.object({
  preprintUri: atUriSchema.describe('Preprint AT-URI'),
  content: z.string().min(1).max(10000).describe('Plain text content'),
  body: annotationBodySchema.optional().describe('Rich text body'),
  target: textSpanTargetSchema.optional().describe('Target span'),
  motivation: annotationMotivationSchema.default('commenting').describe('Motivation'),
  parentReviewUri: atUriSchema.optional().describe('Parent review URI'),
});

/**
 * Create review input type.
 *
 * @public
 */
export type CreateReviewInput = z.infer<typeof createReviewInputSchema>;

/**
 * Delete review input schema.
 *
 * @public
 */
export const deleteReviewInputSchema = z.object({
  uri: atUriSchema.describe('Review AT-URI to delete'),
});

/**
 * Delete review input type.
 *
 * @public
 */
export type DeleteReviewInput = z.infer<typeof deleteReviewInputSchema>;

/**
 * List reviews for author params schema.
 *
 * @public
 */
export const listReviewsForAuthorParamsSchema = paginationQuerySchema.extend({
  reviewerDid: didSchema.describe('Reviewer DID'),
  motivation: annotationMotivationSchema.optional().describe('Filter by motivation'),
  inlineOnly: z.coerce.boolean().optional().describe('Only include inline annotations'),
});

/**
 * List reviews for author params type.
 *
 * @public
 */
export type ListReviewsForAuthorParams = z.infer<typeof listReviewsForAuthorParamsSchema>;

/**
 * Reviews response schema.
 *
 * @public
 */
export const reviewsResponseSchema = z.object({
  reviews: z.array(reviewSchema).describe('List of reviews'),
  cursor: z.string().optional().describe('Cursor for next page'),
  hasMore: z.boolean().describe('Whether more results exist'),
  total: z.number().int().optional().describe('Total count'),
});

/**
 * Reviews response type.
 *
 * @public
 */
export type ReviewsResponse = z.infer<typeof reviewsResponseSchema>;
