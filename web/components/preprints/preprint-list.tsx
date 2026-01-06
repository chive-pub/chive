'use client';

import { useCallback, useMemo } from 'react';

import { PreprintCard, PreprintCardSkeleton } from './preprint-card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PreprintSummary } from '@/lib/api/schema';

/**
 * Props for the PreprintList component.
 */
export interface PreprintListProps {
  /** Array of preprint summaries to display */
  preprints: PreprintSummary[];
  /** Whether more results are available */
  hasMore?: boolean;
  /** Callback to load more results */
  onLoadMore?: () => void;
  /** Whether currently loading more results */
  isLoadingMore?: boolean;
  /** Display layout */
  layout?: 'grid' | 'list';
  /** Card variant */
  cardVariant?: 'default' | 'compact';
  /** Optional callback for prefetching on hover */
  onPrefetch?: (uri: string) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays a list of preprints with optional pagination.
 *
 * @remarks
 * Client component that handles load more pagination and hover prefetch.
 * Supports both grid and list layouts with different card variants.
 *
 * @example
 * ```tsx
 * <PreprintList
 *   preprints={searchResults.hits}
 *   hasMore={searchResults.hasMore}
 *   onLoadMore={loadMore}
 *   isLoadingMore={isFetchingNextPage}
 * />
 * ```
 *
 * @param props - Component props
 * @returns React element displaying the preprint list
 */
export function PreprintList({
  preprints,
  hasMore = false,
  onLoadMore,
  isLoadingMore = false,
  layout = 'list',
  cardVariant = 'default',
  onPrefetch,
  className,
}: PreprintListProps) {
  const handleLoadMore = useCallback(() => {
    if (onLoadMore && !isLoadingMore) {
      onLoadMore();
    }
  }, [onLoadMore, isLoadingMore]);

  const layoutClasses = useMemo(() => {
    if (layout === 'grid') {
      return 'grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3';
    }
    return 'flex flex-col gap-4';
  }, [layout]);

  if (preprints.length === 0) {
    return <PreprintListEmpty className={className} />;
  }

  return (
    <div className={cn('space-y-6', className)}>
      <div className={layoutClasses}>
        {preprints.map((preprint) => (
          <PreprintCard
            key={preprint.uri}
            preprint={preprint}
            variant={cardVariant}
            onPrefetch={onPrefetch}
          />
        ))}
      </div>

      {hasMore && onLoadMore && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className="min-w-[200px]"
          >
            {isLoadingMore ? 'Loading...' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Props for the PreprintListSkeleton component.
 */
export interface PreprintListSkeletonProps {
  /** Number of skeleton cards to show */
  count?: number;
  /** Display layout */
  layout?: 'grid' | 'list';
  /** Card variant */
  cardVariant?: 'default' | 'compact';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Loading skeleton for the PreprintList component.
 *
 * @example
 * ```tsx
 * {isLoading ? <PreprintListSkeleton count={5} /> : <PreprintList preprints={data} />}
 * ```
 */
export function PreprintListSkeleton({
  count = 5,
  layout = 'list',
  cardVariant = 'default',
  className,
}: PreprintListSkeletonProps) {
  const layoutClasses = useMemo(() => {
    if (layout === 'grid') {
      return 'grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3';
    }
    return 'flex flex-col gap-4';
  }, [layout]);

  return (
    <div className={cn(layoutClasses, className)}>
      {Array.from({ length: count }).map((_, index) => (
        <PreprintCardSkeleton key={index} variant={cardVariant} />
      ))}
    </div>
  );
}

/**
 * Props for the PreprintListEmpty component.
 */
export interface PreprintListEmptyProps {
  /** Custom message to display */
  message?: string;
  /** Custom description */
  description?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Empty state for the PreprintList component.
 *
 * @example
 * ```tsx
 * <PreprintListEmpty message="No preprints found" />
 * ```
 */
export function PreprintListEmpty({
  message = 'No preprints found',
  description = 'Try adjusting your search or filters.',
  className,
}: PreprintListEmptyProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center',
        className
      )}
    >
      <p className="text-lg font-medium text-muted-foreground">{message}</p>
      <p className="mt-1 text-sm text-muted-foreground/70">{description}</p>
    </div>
  );
}

/**
 * Props for the InfinitePreprintList component.
 */
export interface InfinitePreprintListProps {
  /** Array of preprint summaries to display */
  preprints: PreprintSummary[];
  /** Whether more results are available */
  hasMore?: boolean;
  /** Callback when intersection observer triggers */
  onIntersect?: () => void;
  /** Whether currently loading more results */
  isLoadingMore?: boolean;
  /** Display layout */
  layout?: 'grid' | 'list';
  /** Card variant */
  cardVariant?: 'default' | 'compact';
  /** Optional callback for prefetching on hover */
  onPrefetch?: (uri: string) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Infinite scroll variant of PreprintList using intersection observer.
 *
 * @remarks
 * Uses a sentinel element at the end of the list to trigger loading
 * more results when scrolled into view.
 *
 * @example
 * ```tsx
 * <InfinitePreprintList
 *   preprints={allPreprints}
 *   hasMore={hasNextPage}
 *   onIntersect={fetchNextPage}
 *   isLoadingMore={isFetchingNextPage}
 * />
 * ```
 */
export function InfinitePreprintList({
  preprints,
  hasMore = false,
  onIntersect,
  isLoadingMore = false,
  layout = 'list',
  cardVariant = 'default',
  onPrefetch,
  className,
}: InfinitePreprintListProps) {
  const layoutClasses = useMemo(() => {
    if (layout === 'grid') {
      return 'grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3';
    }
    return 'flex flex-col gap-4';
  }, [layout]);

  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasMore && onIntersect && !isLoadingMore) {
        onIntersect();
      }
    },
    [hasMore, onIntersect, isLoadingMore]
  );

  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return;

      const observer = new IntersectionObserver(handleIntersection, {
        rootMargin: '200px',
      });

      observer.observe(node);

      return () => observer.disconnect();
    },
    [handleIntersection]
  );

  if (preprints.length === 0) {
    return <PreprintListEmpty className={className} />;
  }

  return (
    <div className={cn('space-y-6', className)}>
      <div className={layoutClasses}>
        {preprints.map((preprint) => (
          <PreprintCard
            key={preprint.uri}
            preprint={preprint}
            variant={cardVariant}
            onPrefetch={onPrefetch}
          />
        ))}
      </div>

      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-4">
          {isLoadingMore && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Loading more...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
