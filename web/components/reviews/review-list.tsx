'use client';

/**
 * ReviewList component for displaying a list of reviews.
 *
 * @remarks
 * Displays reviews in a list format with optional threading support.
 * Supports two layouts:
 * - `list`: Simple chronological list
 * - `threaded`: Nested threaded view with unlimited depth
 *
 * @example
 * ```tsx
 * <ReviewList
 *   reviews={reviews}
 *   layout="threaded"
 *   onReply={handleReply}
 * />
 * ```
 *
 * @packageDocumentation
 */

import { cn } from '@/lib/utils';
import type { Review, FrontendReviewThread } from '@/lib/api/schema';
import { ReviewCard, ReviewCardSkeleton } from './review-card';
import { ReviewThreadComponent } from './review-thread';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for the ReviewList component.
 */
export interface ReviewListProps {
  /** Reviews to display */
  reviews: Review[];

  /** Layout mode */
  layout?: 'list' | 'threaded';

  /** Callback when reply button is clicked */
  onReply?: (review: Review) => void;

  /** Callback when edit button is clicked */
  onEdit?: (review: Review) => void;

  /** Callback when delete button is clicked */
  onDelete?: (review: Review) => void;

  /** Callback when share button is clicked */
  onShare?: (review: Review) => void;

  /** Current user's DID for ownership checks */
  currentUserDid?: string;

  /** Whether to show target span excerpts */
  showTargets?: boolean;

  /** Additional CSS classes */
  className?: string;
}

/**
 * Props for the ReviewListSkeleton component.
 */
export interface ReviewListSkeletonProps {
  /** Number of skeleton items to show */
  count?: number;

  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Displays a list of reviews.
 *
 * @param props - Component props
 * @returns Review list element
 */
export function ReviewList({
  reviews,
  layout = 'list',
  onReply,
  onEdit,
  onDelete,
  onShare,
  currentUserDid,
  showTargets = true,
  className,
}: ReviewListProps) {
  if (reviews.length === 0) {
    return (
      <div
        className={cn('flex flex-col items-center justify-center py-12 text-center', className)}
        data-testid="review-list-empty"
      >
        <p className="text-muted-foreground">No reviews yet</p>
        <p className="text-sm text-muted-foreground">
          Be the first to share your thoughts on this eprint.
        </p>
      </div>
    );
  }

  if (layout === 'threaded') {
    // Group reviews by parent
    const topLevel = reviews.filter((r) => !r.parentReviewUri);
    const repliesByParent = reviews.reduce(
      (acc, review) => {
        if (review.parentReviewUri) {
          const parentUri = review.parentReviewUri;
          if (!acc[parentUri]) {
            acc[parentUri] = [];
          }
          acc[parentUri].push(review);
        }
        return acc;
      },
      {} as Record<string, Review[]>
    );

    // Build thread structure
    const buildThread = (review: Review, depth: number = 0): FrontendReviewThread => {
      const replies = repliesByParent[review.uri] || [];
      return {
        parent: review,
        replies: replies.map((r) => buildThread(r, depth + 1)),
        totalReplies: replies.length,
      };
    };

    const threads = topLevel.map((r) => buildThread(r));

    return (
      <div className={cn('space-y-4', className)} data-testid="review-list" data-layout="threaded">
        {threads.map((thread) => (
          <ReviewThreadComponent
            key={thread.parent.uri}
            thread={thread}
            onReply={onReply}
            onEdit={onEdit}
            onDelete={onDelete}
            onShare={onShare}
            currentUserDid={currentUserDid}
            showTargets={showTargets}
          />
        ))}
      </div>
    );
  }

  // Simple list layout
  return (
    <div className={cn('space-y-4', className)} data-testid="review-list" data-layout="list">
      {reviews.map((review) => (
        <ReviewCard
          key={review.uri}
          review={review}
          onReply={onReply ? () => onReply(review) : undefined}
          onEdit={onEdit ? () => onEdit(review) : undefined}
          onDelete={onDelete ? () => onDelete(review) : undefined}
          onShare={onShare ? () => onShare(review) : undefined}
          isOwner={currentUserDid === review.author.did}
          showTarget={showTargets}
        />
      ))}
    </div>
  );
}

/**
 * Skeleton loading state for ReviewList.
 */
export function ReviewListSkeleton({ count = 3, className }: ReviewListSkeletonProps) {
  return (
    <div className={cn('space-y-4', className)} data-testid="review-list-skeleton">
      {Array.from({ length: count }, (_, i) => (
        <ReviewCardSkeleton key={i} />
      ))}
    </div>
  );
}
