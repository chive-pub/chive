'use client';

import { useCallback, useMemo } from 'react';

import { EprintCard, EprintCardSkeleton } from './eprint-card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { EprintSummary } from '@/lib/api/schema';

/**
 * Props for the EprintList component.
 */
export interface EprintListProps {
  /** Array of eprint summaries to display */
  eprints: EprintSummary[];
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
 * Displays a list of eprints with optional pagination.
 *
 * @remarks
 * Client component that handles load more pagination and hover prefetch.
 * Supports both grid and list layouts with different card variants.
 *
 * @example
 * ```tsx
 * <EprintList
 *   eprints={searchResults.hits}
 *   hasMore={searchResults.hasMore}
 *   onLoadMore={loadMore}
 *   isLoadingMore={isFetchingNextPage}
 * />
 * ```
 *
 * @param props - Component props
 * @returns React element displaying the eprint list
 */
export function EprintList({
  eprints,
  hasMore = false,
  onLoadMore,
  isLoadingMore = false,
  layout = 'list',
  cardVariant = 'default',
  onPrefetch,
  className,
}: EprintListProps) {
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

  if (eprints.length === 0) {
    return <EprintListEmpty className={className} />;
  }

  return (
    <div className={cn('space-y-6', className)}>
      <div className={layoutClasses}>
        {eprints.map((eprint) => (
          <EprintCard
            key={eprint.uri}
            eprint={eprint}
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
 * Props for the EprintListSkeleton component.
 */
export interface EprintListSkeletonProps {
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
 * Loading skeleton for the EprintList component.
 *
 * @example
 * ```tsx
 * {isLoading ? <EprintListSkeleton count={5} /> : <EprintList eprints={data} />}
 * ```
 */
export function EprintListSkeleton({
  count = 5,
  layout = 'list',
  cardVariant = 'default',
  className,
}: EprintListSkeletonProps) {
  const layoutClasses = useMemo(() => {
    if (layout === 'grid') {
      return 'grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3';
    }
    return 'flex flex-col gap-4';
  }, [layout]);

  return (
    <div className={cn(layoutClasses, className)}>
      {Array.from({ length: count }).map((_, index) => (
        <EprintCardSkeleton key={index} variant={cardVariant} />
      ))}
    </div>
  );
}

/**
 * Props for the EprintListEmpty component.
 */
export interface EprintListEmptyProps {
  /** Custom message to display */
  message?: string;
  /** Custom description */
  description?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Empty state for the EprintList component.
 *
 * @example
 * ```tsx
 * <EprintListEmpty message="No eprints found" />
 * ```
 */
export function EprintListEmpty({
  message = 'No eprints found',
  description = 'Try adjusting your search or filters.',
  className,
}: EprintListEmptyProps) {
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
 * Props for the InfiniteEprintList component.
 */
export interface InfiniteEprintListProps {
  /** Array of eprint summaries to display */
  eprints: EprintSummary[];
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
 * Infinite scroll variant of EprintList using intersection observer.
 *
 * @remarks
 * Uses a sentinel element at the end of the list to trigger loading
 * more results when scrolled into view.
 *
 * @example
 * ```tsx
 * <InfiniteEprintList
 *   eprints={allEprints}
 *   hasMore={hasNextPage}
 *   onIntersect={fetchNextPage}
 *   isLoadingMore={isFetchingNextPage}
 * />
 * ```
 */
export function InfiniteEprintList({
  eprints,
  hasMore = false,
  onIntersect,
  isLoadingMore = false,
  layout = 'list',
  cardVariant = 'default',
  onPrefetch,
  className,
}: InfiniteEprintListProps) {
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

  if (eprints.length === 0) {
    return <EprintListEmpty className={className} />;
  }

  return (
    <div className={cn('space-y-6', className)}>
      <div className={layoutClasses}>
        {eprints.map((eprint) => (
          <EprintCard
            key={eprint.uri}
            eprint={eprint}
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
