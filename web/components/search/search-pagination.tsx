'use client';

import { useCallback } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Props for the SearchPagination component.
 */
export interface SearchPaginationProps {
  /** Whether there are more results available */
  hasMore: boolean;
  /** Whether there are previous results */
  hasPrevious?: boolean;
  /** Current cursor for next page */
  cursor?: string;
  /** Called to load next page */
  onLoadMore?: () => void;
  /** Called to load previous page */
  onLoadPrevious?: () => void;
  /** Whether currently loading */
  isLoading?: boolean;
  /** Total results count (for display) */
  total?: number;
  /** Current page number (for display) */
  currentPage?: number;
  /** Total pages (if known) */
  totalPages?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Pagination controls for cursor-based search results.
 *
 * @remarks
 * Client component for navigating paginated search results.
 * Supports both cursor-based and page-based pagination display.
 *
 * @example
 * ```tsx
 * <SearchPagination
 *   hasMore={searchResults.hasMore}
 *   cursor={searchResults.cursor}
 *   onLoadMore={() => fetchNextPage()}
 *   isLoading={isFetchingNextPage}
 * />
 * ```
 *
 * @param props - Component props
 * @returns React element with pagination controls
 */
export function SearchPagination({
  hasMore,
  hasPrevious = false,
  cursor: _cursor,
  onLoadMore,
  onLoadPrevious,
  isLoading = false,
  total,
  currentPage,
  totalPages,
  className,
}: SearchPaginationProps) {
  const handleLoadMore = useCallback(() => {
    if (onLoadMore && !isLoading) {
      onLoadMore();
    }
  }, [onLoadMore, isLoading]);

  const handleLoadPrevious = useCallback(() => {
    if (onLoadPrevious && !isLoading) {
      onLoadPrevious();
    }
  }, [onLoadPrevious, isLoading]);

  // Hide if no pagination needed
  if (!hasMore && !hasPrevious) {
    return null;
  }

  return (
    <div className={cn('flex items-center justify-center gap-4 border-t pt-4', className)}>
      {/* Previous button */}
      {onLoadPrevious && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleLoadPrevious}
          disabled={!hasPrevious || isLoading}
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
      )}

      {/* Page info */}
      {(currentPage !== undefined || total !== undefined) && (
        <div className="text-sm text-muted-foreground">
          {currentPage !== undefined && totalPages !== undefined ? (
            <span>
              Page {currentPage} of {totalPages}
            </span>
          ) : total !== undefined ? (
            <span>{total} results</span>
          ) : null}
        </div>
      )}

      {/* Next/Load more button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleLoadMore}
        disabled={!hasMore || isLoading}
        className="gap-1"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </>
        ) : (
          <>
            {onLoadPrevious ? 'Next' : 'Load more'}
            <ChevronRight className="h-4 w-4" />
          </>
        )}
      </Button>
    </div>
  );
}

/**
 * Props for the InfiniteScrollTrigger component.
 */
export interface InfiniteScrollTriggerProps {
  /** Whether there are more results */
  hasMore: boolean;
  /** Called when trigger is visible */
  onTrigger: () => void;
  /** Whether currently loading */
  isLoading?: boolean;
  /** Root margin for intersection observer */
  rootMargin?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Invisible trigger for infinite scroll pagination.
 *
 * @remarks
 * Uses IntersectionObserver to detect when the user scrolls
 * near the end of results and triggers loading more.
 *
 * @example
 * ```tsx
 * <InfiniteScrollTrigger
 *   hasMore={hasNextPage}
 *   onTrigger={fetchNextPage}
 *   isLoading={isFetchingNextPage}
 * />
 * ```
 */
export function InfiniteScrollTrigger({
  hasMore,
  onTrigger,
  isLoading = false,
  rootMargin = '200px',
  className,
}: InfiniteScrollTriggerProps) {
  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasMore && !isLoading) {
        onTrigger();
      }
    },
    [hasMore, isLoading, onTrigger]
  );

  const ref = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return;

      const observer = new IntersectionObserver(handleIntersect, {
        rootMargin,
      });

      observer.observe(node);

      return () => observer.disconnect();
    },
    [handleIntersect, rootMargin]
  );

  if (!hasMore) {
    return null;
  }

  return (
    <div ref={ref} className={cn('flex justify-center py-4', className)}>
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading more results...</span>
        </div>
      )}
    </div>
  );
}

/**
 * Props for the PageNumbers component.
 */
export interface PageNumbersProps {
  /** Current page number (1-indexed) */
  currentPage: number;
  /** Total number of pages */
  totalPages: number;
  /** Called when page changes */
  onPageChange: (page: number) => void;
  /** Number of page buttons to show around current */
  siblingCount?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Page number buttons for offset-based pagination.
 *
 * @remarks
 * Shows page numbers with ellipsis for large page counts.
 * Useful when the API supports offset pagination.
 *
 * @example
 * ```tsx
 * <PageNumbers
 *   currentPage={5}
 *   totalPages={20}
 *   onPageChange={(p) => goToPage(p)}
 * />
 * ```
 */
export function PageNumbers({
  currentPage,
  totalPages,
  onPageChange,
  siblingCount = 1,
  className,
}: PageNumbersProps) {
  // Generate page numbers to display
  const pages = generatePageNumbers(currentPage, totalPages, siblingCount);

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {/* First page button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => onPageChange(1)}
        disabled={currentPage === 1}
      >
        <ChevronsLeft className="h-4 w-4" />
        <span className="sr-only">First page</span>
      </Button>

      {/* Previous button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        <ChevronLeft className="h-4 w-4" />
        <span className="sr-only">Previous page</span>
      </Button>

      {/* Page numbers */}
      {pages.map((page, index) => {
        if (page === 'ellipsis') {
          return (
            <span key={`ellipsis-${index}`} className="px-2 text-muted-foreground">
              ...
            </span>
          );
        }

        return (
          <Button
            key={page}
            variant={page === currentPage ? 'default' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(page)}
          >
            {page}
          </Button>
        );
      })}

      {/* Next button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        <ChevronRight className="h-4 w-4" />
        <span className="sr-only">Next page</span>
      </Button>

      {/* Last page button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => onPageChange(totalPages)}
        disabled={currentPage === totalPages}
      >
        <ChevronsRight className="h-4 w-4" />
        <span className="sr-only">Last page</span>
      </Button>
    </div>
  );
}

/**
 * Generates array of page numbers with ellipsis.
 */
function generatePageNumbers(
  currentPage: number,
  totalPages: number,
  siblingCount: number
): (number | 'ellipsis')[] {
  const totalPageNumbers = siblingCount * 2 + 5; // siblings + first + last + current + 2 ellipsis

  // If we can show all pages
  if (totalPages <= totalPageNumbers) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);
  const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages);

  const showLeftEllipsis = leftSiblingIndex > 2;
  const showRightEllipsis = rightSiblingIndex < totalPages - 1;

  const pages: (number | 'ellipsis')[] = [];

  // Always show first page
  pages.push(1);

  // Left ellipsis
  if (showLeftEllipsis) {
    pages.push('ellipsis');
  } else if (leftSiblingIndex === 2) {
    pages.push(2);
  }

  // Sibling pages
  for (let i = leftSiblingIndex; i <= rightSiblingIndex; i++) {
    if (i !== 1 && i !== totalPages) {
      pages.push(i);
    }
  }

  // Right ellipsis
  if (showRightEllipsis) {
    pages.push('ellipsis');
  } else if (rightSiblingIndex === totalPages - 1) {
    pages.push(totalPages - 1);
  }

  // Always show last page
  if (totalPages > 1) {
    pages.push(totalPages);
  }

  return pages;
}
