/**
 * Review components for displaying and creating peer reviews.
 *
 * @remarks
 * This module provides a complete review system with:
 * - Thread-based discussions with unlimited nesting depth
 * - Rich text support via FOVEA GlossItem pattern
 * - Inline PDF annotations with W3C Web Annotation targets
 * - Review creation and editing forms
 *
 * @example
 * ```tsx
 * import {
 *   ReviewList,
 *   ReviewCard,
 *   ReviewForm,
 *   ReviewThreadComponent,
 * } from '@/components/reviews';
 *
 * // Display reviews in threaded layout
 * <ReviewList
 *   reviews={reviews}
 *   layout="threaded"
 *   onReply={handleReply}
 * />
 *
 * // Create a new review
 * <ReviewForm
 *   preprintUri={preprintUri}
 *   onSubmit={handleSubmit}
 * />
 * ```
 *
 * @packageDocumentation
 */

// =============================================================================
// REVIEW CARD
// =============================================================================

export { ReviewCard, ReviewCardSkeleton, type ReviewCardProps } from './review-card';

// =============================================================================
// REVIEW LIST
// =============================================================================

export {
  ReviewList,
  ReviewListSkeleton,
  type ReviewListProps,
  type ReviewListSkeletonProps,
} from './review-list';

// =============================================================================
// REVIEW THREAD
// =============================================================================

export {
  ReviewThreadComponent,
  ThreadCollapseToggle,
  type ReviewThreadProps,
  type ThreadCollapseToggleProps,
} from './review-thread';

// =============================================================================
// REVIEW FORM
// =============================================================================

export {
  ReviewForm,
  InlineReplyForm,
  TargetSpanPreview,
  ParentReviewPreview,
  type ReviewFormProps,
  type ReviewFormData,
  type TargetSpanPreviewProps,
  type ParentReviewPreviewProps,
} from './review-form';

// =============================================================================
// ANNOTATION BODY RENDERER
// =============================================================================

export {
  AnnotationBodyRenderer,
  type AnnotationBodyRendererProps,
} from './annotation-body-renderer';
