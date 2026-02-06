'use client';

/**
 * AuthorEndorsements component displays endorsements received on an author's papers.
 *
 * @remarks
 * Shows all endorsements that have been made on eprints authored by the specified user.
 * This represents recognition received, not endorsements given.
 *
 * @packageDocumentation
 */

import { ThumbsUp, User } from 'lucide-react';
import Link from 'next/link';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useAuthorPaperEndorsements,
  CONTRIBUTION_TYPE_LABELS,
  type EndorsementWithEprint,
} from '@/lib/hooks/use-endorsement';
import { cn } from '@/lib/utils';
import { formatRelativeDate } from '@/lib/utils/format-date';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for the AuthorEndorsements component.
 */
export interface AuthorEndorsementsProps {
  /** Author DID */
  did: string;
  /** Number of endorsements per page */
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
  return eprintUri.replace('at://', '');
}

/**
 * Formats a contribution type for display.
 */
function formatContribution(type: string): string {
  return CONTRIBUTION_TYPE_LABELS[type] ?? type;
}

// =============================================================================
// COMPONENTS
// =============================================================================

/**
 * Single endorsement item in the author endorsements list.
 */
function AuthorEndorsementItem({ endorsement }: { endorsement: EndorsementWithEprint }) {
  const endorser = endorsement.endorser;

  return (
    <Card className="transition-colors hover:bg-accent/50" data-testid="author-endorsement-item">
      <CardContent className="p-4">
        {/* Eprint title */}
        <Link
          href={`/eprints/${formatEprintLink(endorsement.eprintUri)}`}
          className="mb-2 block font-medium hover:underline line-clamp-2"
        >
          {endorsement.eprintTitle ?? 'Untitled eprint'}
        </Link>

        {/* Contribution types */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {endorsement.contributions.map((type) => (
            <Badge key={type} variant="secondary" className="text-xs">
              {formatContribution(type)}
            </Badge>
          ))}
        </div>

        {/* Comment if present */}
        {endorsement.comment && (
          <p className="mb-3 text-sm text-muted-foreground line-clamp-2">{endorsement.comment}</p>
        )}

        {/* Endorser info and timestamp */}
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Avatar className="h-5 w-5">
              {endorser.avatar ? (
                <AvatarImage src={endorser.avatar} alt={endorser.displayName ?? endorser.handle} />
              ) : null}
              <AvatarFallback>
                <User className="h-3 w-3" />
              </AvatarFallback>
            </Avatar>
            <span>
              {endorser.displayName ?? endorser.handle ?? `${endorser.did.slice(0, 12)}...`}
            </span>
          </div>

          <time
            dateTime={endorsement.createdAt}
            title={new Date(endorsement.createdAt).toLocaleString()}
          >
            {formatRelativeDate(endorsement.createdAt)}
          </time>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Displays endorsements received on an author's papers with pagination.
 */
export function AuthorEndorsements({ did, limit = 20, className }: AuthorEndorsementsProps) {
  const { data, isLoading, error } = useAuthorPaperEndorsements(did, { limit });

  if (isLoading) {
    return <AuthorEndorsementsSkeleton count={5} className={className} />;
  }

  if (error) {
    return (
      <div
        className={cn(
          'rounded-lg border border-destructive/50 bg-destructive/5 p-6 text-center',
          className
        )}
      >
        <p className="text-destructive">Failed to load endorsements</p>
        <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
      </div>
    );
  }

  const endorsements = data?.endorsements ?? [];

  if (endorsements.length === 0) {
    return (
      <div className={cn('rounded-lg border bg-muted/50 p-8 text-center', className)}>
        <ThumbsUp className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 font-medium">No endorsements yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          This author&apos;s eprints haven&apos;t received any endorsements.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Total count header */}
      {data?.total !== undefined && data.total > 0 && (
        <p className="text-sm text-muted-foreground">
          {data.total} endorsement{data.total !== 1 ? 's' : ''} received across all eprints
        </p>
      )}

      {endorsements.map((endorsement) => (
        <AuthorEndorsementItem key={endorsement.uri} endorsement={endorsement} />
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
 * Props for the AuthorEndorsementsSkeleton component.
 */
export interface AuthorEndorsementsSkeletonProps {
  /** Number of skeleton cards */
  count?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Loading skeleton for AuthorEndorsements component.
 */
export function AuthorEndorsementsSkeleton({
  count = 5,
  className,
}: AuthorEndorsementsSkeletonProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="animate-pulse">
          <CardContent className="p-4">
            <Skeleton className="mb-2 h-5 w-3/4" />
            <div className="mb-3 flex gap-1.5">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-16" />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-5 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
