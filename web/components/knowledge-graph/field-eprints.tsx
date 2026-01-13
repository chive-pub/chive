'use client';

import { useCallback } from 'react';

import { EprintList, EprintListSkeleton, EprintListEmpty } from '@/components/eprints';
import { useFieldEprints } from '@/lib/hooks/use-field';
import { cn } from '@/lib/utils';
import type { EprintSummary } from '@/lib/api/schema';

/**
 * Props for the FieldEprints component.
 */
export interface FieldEprintsProps {
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
 * Displays eprints in a field with pagination.
 *
 * @remarks
 * Client component that fetches and displays eprints for a field.
 * Supports load more pagination and different layouts.
 *
 * @example
 * ```tsx
 * <FieldEprints fieldId="computer-science" layout="list" />
 * ```
 *
 * @param props - Component props
 * @returns React element displaying the field's eprints
 */
export function FieldEprints({
  fieldId,
  layout = 'list',
  cardVariant = 'default',
  limit = 10,
  className,
}: FieldEprintsProps) {
  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, error } =
    useFieldEprints(fieldId, { limit });

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
        message="No eprints in this field"
        description="Be the first to publish a eprint in this field."
        className={className}
      />
    );
  }

  return (
    <EprintList
      eprints={eprints as unknown as EprintSummary[]}
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
 * Props for the FieldEprintsSkeleton component.
 */
export interface FieldEprintsSkeletonProps {
  /** Number of skeleton cards */
  count?: number;
  /** Display layout */
  layout?: 'list' | 'grid';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Loading skeleton for FieldEprints component.
 */
export function FieldEprintsSkeleton({
  count = 5,
  layout = 'list',
  className,
}: FieldEprintsSkeletonProps) {
  return <EprintListSkeleton count={count} layout={layout} className={className} />;
}
