'use client';

import { useCallback } from 'react';

import { PreprintList, PreprintListSkeleton, PreprintListEmpty } from './preprint-list';
import { useAuthorPreprints } from '@/lib/hooks/use-author';
import { cn } from '@/lib/utils';

/**
 * Props for the AuthorPreprints component.
 */
export interface AuthorPreprintsProps {
  /** Author DID */
  did: string;
  /** Display layout */
  layout?: 'list' | 'grid';
  /** Card variant */
  cardVariant?: 'default' | 'compact';
  /** Initial page size */
  limit?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays an author's preprints with pagination.
 *
 * @remarks
 * Client component that fetches and displays preprints by author.
 * Supports load more pagination and different layouts.
 *
 * @example
 * ```tsx
 * <AuthorPreprints did="did:plc:abc123" layout="list" />
 * ```
 *
 * @param props - Component props
 * @returns React element displaying the author's preprints
 */
export function AuthorPreprints({
  did,
  layout = 'list',
  cardVariant = 'default',
  limit = 10,
  className,
}: AuthorPreprintsProps) {
  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, error } =
    useAuthorPreprints(did, { limit });

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Flatten pages into single array
  const preprints = data?.pages.flatMap((page) => page.preprints) ?? [];

  if (isLoading) {
    return (
      <PreprintListSkeleton
        count={limit}
        layout={layout}
        cardVariant={cardVariant}
        className={className}
      />
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          'rounded-lg border border-destructive/50 bg-destructive/5 p-6 text-center',
          className
        )}
      >
        <p className="text-destructive">Failed to load preprints</p>
        <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
      </div>
    );
  }

  if (preprints.length === 0) {
    return (
      <PreprintListEmpty
        message="No preprints yet"
        description="This author hasn't published any preprints."
        className={className}
      />
    );
  }

  return (
    <PreprintList
      preprints={preprints}
      hasMore={hasNextPage}
      onLoadMore={handleLoadMore}
      isLoadingMore={isFetchingNextPage}
      layout={layout}
      cardVariant={cardVariant}
      className={className}
    />
  );
}

/**
 * Props for the AuthorPreprintsSkeleton component.
 */
export interface AuthorPreprintsSkeletonProps {
  /** Number of skeleton cards */
  count?: number;
  /** Display layout */
  layout?: 'list' | 'grid';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Loading skeleton for AuthorPreprints component.
 */
export function AuthorPreprintsSkeleton({
  count = 5,
  layout = 'list',
  className,
}: AuthorPreprintsSkeletonProps) {
  return <PreprintListSkeleton count={count} layout={layout} className={className} />;
}
