'use client';

import Link from 'next/link';
import { MessageSquare, FileText, ExternalLink } from 'lucide-react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentUser } from '@/lib/auth';
import { useAuthorReviews } from '@/lib/hooks/use-review';

/**
 * Formats a date for display.
 */
function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

/**
 * Extracts the eprint path from an AT-URI.
 */
function getEprintPath(uri: string): string {
  return `/eprints/${encodeURIComponent(uri)}`;
}

/**
 * Review view type from the API.
 */
interface ReviewView {
  uri: string;
  cid: string;
  eprintUri: string;
  eprintTitle?: string;
  content: string;
  motivation?: string;
  createdAt: string;
}

/**
 * Single review card component.
 */
function ReviewCard({ review }: { review: ReviewView }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <Link
              href={getEprintPath(review.eprintUri)}
              className="font-medium hover:underline line-clamp-2"
            >
              {review.eprintTitle ?? 'Untitled eprint'}
            </Link>
          </div>
          <Link
            href={getEprintPath(review.eprintUri)}
            className="text-muted-foreground hover:text-foreground flex-shrink-0"
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground line-clamp-3">{review.content}</p>
        <p className="text-xs text-muted-foreground">{formatDate(review.createdAt)}</p>
      </CardContent>
    </Card>
  );
}

/**
 * Loading skeleton for review list.
 */
function ReviewListSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-3/4" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-3 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * Empty state when user has no reviews.
 */
function EmptyState() {
  return (
    <div className="rounded-lg border-2 border-dashed p-12 text-center">
      <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground" />
      <h3 className="mt-4 text-lg font-semibold">No reviews yet</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Reviews you write on eprints will appear here
      </p>
      <Link
        href="/browse"
        className="mt-4 inline-flex items-center gap-2 text-sm text-primary hover:underline"
      >
        <FileText className="h-4 w-4" />
        Browse eprints to review
      </Link>
    </div>
  );
}

/**
 * User's reviews page.
 */
export default function MyReviewsPage() {
  const currentUser = useCurrentUser();
  const { data, isLoading, error } = useAuthorReviews(currentUser?.did ?? '', {
    enabled: !!currentUser?.did,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Reviews</h1>
        <p className="text-muted-foreground">
          Reviews you have written
          {data?.total !== undefined && data.total > 0 && ` (${data.total})`}
        </p>
      </div>

      {/* Content */}
      {isLoading ? (
        <ReviewListSkeleton />
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-8 text-center">
          <h3 className="font-semibold text-destructive">Failed to load reviews</h3>
          <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        </div>
      ) : !data?.reviews?.length ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          {data.reviews.map((review) => (
            <ReviewCard key={review.uri} review={review as ReviewView} />
          ))}
        </div>
      )}
    </div>
  );
}
