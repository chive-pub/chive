'use client';

import { useCallback } from 'react';

import { PreprintList, PreprintListSkeleton, PreprintListEmpty } from '@/components/preprints';
import { useFieldPreprints } from '@/lib/hooks/use-field';
import { cn } from '@/lib/utils';
import type { PreprintSummary } from '@/lib/api/schema';

/**
 * Props for the FieldPreprints component.
 */
export interface FieldPreprintsProps {
  /** Field ID */
  fieldId: string;
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
 * Displays preprints in a field with pagination.
 *
 * @remarks
 * Client component that fetches and displays preprints for a field.
 * Supports load more pagination and different layouts.
 *
 * @example
 * ```tsx
 * <FieldPreprints fieldId="computer-science" layout="list" />
 * ```
 *
 * @param props - Component props
 * @returns React element displaying the field's preprints
 */
export function FieldPreprints({
  fieldId,
  layout = 'list',
  cardVariant = 'default',
  limit = 10,
  className,
}: FieldPreprintsProps) {
  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, error } =
    useFieldPreprints(fieldId, { limit });

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
        message="No preprints in this field"
        description="Be the first to publish a preprint in this field."
        className={className}
      />
    );
  }

  return (
    <PreprintList
      preprints={preprints as unknown as PreprintSummary[]}
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
 * Props for the FieldPreprintsSkeleton component.
 */
export interface FieldPreprintsSkeletonProps {
  /** Number of skeleton cards */
  count?: number;
  /** Display layout */
  layout?: 'list' | 'grid';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Loading skeleton for FieldPreprints component.
 */
export function FieldPreprintsSkeleton({
  count = 5,
  layout = 'list',
  className,
}: FieldPreprintsSkeletonProps) {
  return <PreprintListSkeleton count={count} layout={layout} className={className} />;
}
