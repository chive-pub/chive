'use client';

/**
 * AuthorReviews component displays reviews created by an author.
 *
 * @remarks
 * Shows all reviews (both general and inline annotations) created by
 * a specific author, with links to the eprints they were written on.
 *
 * @packageDocumentation
 */

import { MessageSquare, FileText } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { RichTextRenderer } from '@/components/editor/rich-text-renderer';
import { useAuthorReviews } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { formatRelativeDate } from '@/lib/utils/format-date';
import type { Review } from '@/lib/api/schema';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for the AuthorReviews component.
 */
export interface AuthorReviewsProps {
  /** Author DID */
  did: string;
  /** Number of reviews per page */
  limit?: number;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Formats eprint URI for display and linking.
 */
function formatEprintLink(eprintUri: string): string {
  // Convert AT-URI to URL-safe path
  // at://did:plc:xxx/pub.chive.eprint.submission/rkey -> did:plc:xxx/pub.chive.eprint.submission/rkey
  return eprintUri.replace('at://', '');
}

// =============================================================================
// COMPONENTS
// =============================================================================

/**
 * Single review item in the author reviews list.
 */
function AuthorReviewItem({ review }: { review: Review }) {
  const hasTarget = !!review.target;

  return (
    <Card className="transition-colors hover:bg-accent/50" data-testid="author-review-item">
      <CardContent className="p-4">
        {/* Review content */}
        <div className="mb-3 text-sm text-foreground line-clamp-4">
          <RichTextRenderer items={review.bodyItems} mode="inline" />
        </div>

        {/* Target span excerpt */}
        {hasTarget && review.target?.selector?.exact && (
          <blockquote className="mb-3 border-l-2 border-primary/50 bg-muted/50 px-3 py-2 text-xs italic text-muted-foreground">
            &ldquo;{review.target.selector.exact}&rdquo;
          </blockquote>
        )}

        {/* Meta info */}
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            {hasTarget && (
              <Badge variant="secondary" className="text-xs">
                Inline annotation
              </Badge>
            )}
            <time dateTime={review.createdAt} title={new Date(review.createdAt).toLocaleString()}>
              {formatRelativeDate(review.createdAt)}
            </time>
          </div>

          {/* Link to eprint */}
          <Link
            href={`/eprints/${formatEprintLink(review.eprintUri)}`}
            className="flex items-center gap-1 hover:text-foreground hover:underline"
          >
            <FileText className="h-3 w-3" />
            <span>View eprint</span>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Displays an author's reviews with pagination.
 */
export function AuthorReviews({ did, limit = 20, className }: AuthorReviewsProps) {
  const { data, isLoading, error } = useAuthorReviews(did, { limit });

  if (isLoading) {
    return <AuthorReviewsSkeleton count={5} className={className} />;
  }

  if (error) {
    return (
      <div
        className={cn(
          'rounded-lg border border-destructive/50 bg-destructive/5 p-6 text-center',
          className
        )}
      >
        <p className="text-destructive">Failed to load reviews</p>
        <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
      </div>
    );
  }

  const reviews = data?.reviews ?? [];

  if (reviews.length === 0) {
    return (
      <div className={cn('rounded-lg border bg-muted/50 p-8 text-center', className)}>
        <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 font-medium">No reviews yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          This author hasn&apos;t written any reviews or annotations.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {reviews.map((review: Review) => (
        <AuthorReviewItem key={review.uri} review={review} />
      ))}

      {data?.hasMore && (
        <div className="text-center">
          <Button variant="outline" disabled>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SKELETON
// =============================================================================

/**
 * Props for the AuthorReviewsSkeleton component.
 */
export interface AuthorReviewsSkeletonProps {
  /** Number of skeleton cards */
  count?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Loading skeleton for AuthorReviews component.
 */
export function AuthorReviewsSkeleton({ count = 5, className }: AuthorReviewsSkeletonProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="animate-pulse">
          <CardContent className="p-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
