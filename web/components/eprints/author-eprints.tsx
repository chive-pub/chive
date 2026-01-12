'use client';

import { useCallback } from 'react';

import { EprintList, EprintListSkeleton, EprintListEmpty } from './eprint-list';
import { useAuthorEprints } from '@/lib/hooks/use-author';
import { cn } from '@/lib/utils';

/**
 * Props for the AuthorEprints component.
 */
export interface AuthorEprintsProps {
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
 * Displays an author's eprints with pagination.
 *
 * @remarks
 * Client component that fetches and displays eprints by author.
 * Supports load more pagination and different layouts.
 *
 * @example
 * ```tsx
 * <AuthorEprints did="did:plc:abc123" layout="list" />
 * ```
 *
 * @param props - Component props
 * @returns React element displaying the author's eprints
 */
export function AuthorEprints({
  did,
  layout = 'list',
  cardVariant = 'default',
  limit = 10,
  className,
}: AuthorEprintsProps) {
  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, error } =
    useAuthorEprints(did, { limit });

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Flatten pages into single array
  const eprints = data?.pages.flatMap((page) => page.eprints) ?? [];

  if (isLoading) {
    return (
      <EprintListSkeleton
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
        <p className="text-destructive">Failed to load eprints</p>
        <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
      </div>
    );
  }

  if (eprints.length === 0) {
    return (
      <EprintListEmpty
        message="No eprints yet"
        description="This author hasn't published any eprints."
        className={className}
      />
    );
  }

  return (
    <EprintList
      eprints={eprints}
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
 * Props for the AuthorEprintsSkeleton component.
 */
export interface AuthorEprintsSkeletonProps {
  /** Number of skeleton cards */
  count?: number;
  /** Display layout */
  layout?: 'list' | 'grid';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Loading skeleton for AuthorEprints component.
 */
export function AuthorEprintsSkeleton({
  count = 5,
  layout = 'list',
  className,
}: AuthorEprintsSkeletonProps) {
  return <EprintListSkeleton count={count} layout={layout} className={className} />;
}
