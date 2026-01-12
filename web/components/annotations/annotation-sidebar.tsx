'use client';

/**
 * Sidebar for displaying and navigating inline annotations.
 *
 * @remarks
 * Shows a list of inline reviews (span annotations) for a eprint.
 * Clicking an annotation scrolls to its location in the PDF.
 *
 * @example
 * ```tsx
 * <AnnotationSidebar
 *   eprintUri={eprintUri}
 *   onAnnotationClick={handleScrollToAnnotation}
 *   selectedUri={selectedAnnotationUri}
 * />
 * ```
 *
 * @packageDocumentation
 */

import { useState, useMemo } from 'react';
import { MessageSquare, ChevronDown, ChevronRight, User, Filter, FileText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useInlineReviews } from '@/lib/hooks/use-review';
import type { Review } from '@/lib/api/schema';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for AnnotationSidebar.
 */
export interface AnnotationSidebarProps {
  /** AT-URI of the eprint */
  eprintUri: string;
  /** Currently selected annotation URI */
  selectedUri?: string;
  /** Callback when annotation is clicked */
  onAnnotationClick?: (uri: string, pageNumber?: number) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Grouped annotations by page.
 */
interface PageGroup {
  pageNumber: number;
  annotations: Review[];
}

/**
 * Sort options for annotations.
 */
type SortOption = 'page' | 'date' | 'author';

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Sidebar displaying inline annotations.
 *
 * @param props - Component props
 * @returns Sidebar element
 */
export function AnnotationSidebar({
  eprintUri,
  selectedUri,
  onAnnotationClick,
  className,
}: AnnotationSidebarProps) {
  const [sortBy, setSortBy] = useState<SortOption>('page');
  const [expandedPages, setExpandedPages] = useState<Set<number>>(new Set([1]));

  const { data, isLoading, error } = useInlineReviews(eprintUri);

  // Group annotations by page
  const pageGroups = useMemo<PageGroup[]>(() => {
    if (!data?.reviews) return [];

    const groups = new Map<number, Review[]>();

    data.reviews.forEach((review) => {
      const pageNumber = review.target?.refinedBy?.pageNumber ?? 0;
      const existing = groups.get(pageNumber) ?? [];
      groups.set(pageNumber, [...existing, review]);
    });

    // Sort groups by page number
    const sorted = Array.from(groups.entries())
      .map(([pageNumber, annotations]) => ({ pageNumber, annotations }))
      .sort((a, b) => a.pageNumber - b.pageNumber);

    // Sort annotations within each group
    if (sortBy === 'date') {
      sorted.forEach((group) => {
        group.annotations.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });
    } else if (sortBy === 'author') {
      sorted.forEach((group) => {
        group.annotations.sort((a, b) =>
          (a.author.displayName ?? a.author.handle ?? '').localeCompare(
            b.author.displayName ?? b.author.handle ?? ''
          )
        );
      });
    }

    return sorted;
  }, [data?.reviews, sortBy]);

  // Toggle page expansion
  const togglePage = (pageNumber: number) => {
    setExpandedPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageNumber)) {
        next.delete(pageNumber);
      } else {
        next.add(pageNumber);
      }
      return next;
    });
  };

  // Expand all pages
  const expandAll = () => {
    setExpandedPages(new Set(pageGroups.map((g) => g.pageNumber)));
  };

  // Collapse all pages
  const collapseAll = () => {
    setExpandedPages(new Set());
  };

  if (isLoading) {
    return <AnnotationSidebarSkeleton className={className} />;
  }

  if (error) {
    return (
      <div className={cn('rounded-lg border bg-card p-4', className)}>
        <p className="text-sm text-destructive text-center">Failed to load annotations</p>
      </div>
    );
  }

  const totalAnnotations = data?.reviews?.length ?? 0;

  return (
    <div className={cn('flex flex-col rounded-lg border bg-card', className)}>
      {/* Header */}
      <div className="border-b px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-sm flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Annotations
          </h3>
          <Badge variant="secondary" className="text-xs">
            {totalAnnotations}
          </Badge>
        </div>

        {/* Controls */}
        {totalAnnotations > 0 && (
          <div className="flex items-center gap-2">
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="h-7 text-xs flex-1">
                <Filter className="h-3 w-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="page">By page</SelectItem>
                <SelectItem value="date">By date</SelectItem>
                <SelectItem value="author">By author</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={expandAll}>
                Expand
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={collapseAll}>
                Collapse
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Annotation list */}
      <ScrollArea className="flex-1">
        {totalAnnotations === 0 ? (
          <div className="p-8 text-center">
            <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No annotations yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Select text in the PDF to add annotations
            </p>
          </div>
        ) : (
          <div className="py-1">
            {pageGroups.map((group) => (
              <PageAnnotationGroup
                key={group.pageNumber}
                pageNumber={group.pageNumber}
                annotations={group.annotations}
                isExpanded={expandedPages.has(group.pageNumber)}
                onToggle={() => togglePage(group.pageNumber)}
                selectedUri={selectedUri}
                onAnnotationClick={onAnnotationClick}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// =============================================================================
// PAGE GROUP
// =============================================================================

/**
 * Props for PageAnnotationGroup.
 */
interface PageAnnotationGroupProps {
  pageNumber: number;
  annotations: Review[];
  isExpanded: boolean;
  onToggle: () => void;
  selectedUri?: string;
  onAnnotationClick?: (uri: string, pageNumber?: number) => void;
}

/**
 * Collapsible group of annotations for a page.
 */
function PageAnnotationGroup({
  pageNumber,
  annotations,
  isExpanded,
  onToggle,
  selectedUri,
  onAnnotationClick,
}: PageAnnotationGroupProps) {
  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <button
          className="flex items-center justify-between w-full px-4 py-2 hover:bg-muted/50 transition-colors text-left"
          type="button"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <FileText className="h-4 w-4 text-muted-foreground" />
            Page {pageNumber}
          </span>
          <Badge variant="outline" className="text-xs">
            {annotations.length}
          </Badge>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pl-6 pr-2 pb-2 space-y-1">
          {annotations.map((annotation) => (
            <AnnotationItem
              key={annotation.uri}
              annotation={annotation}
              isSelected={selectedUri === annotation.uri}
              onClick={() => onAnnotationClick?.(annotation.uri, pageNumber)}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// =============================================================================
// ANNOTATION ITEM
// =============================================================================

/**
 * Props for AnnotationItem.
 */
interface AnnotationItemProps {
  annotation: Review;
  isSelected?: boolean;
  onClick?: () => void;
}

/**
 * Single annotation item in the sidebar.
 */
function AnnotationItem({ annotation, isSelected, onClick }: AnnotationItemProps) {
  const authorName = annotation.author.displayName ?? annotation.author.handle ?? 'Anonymous';
  const excerpt = annotation.content.slice(0, 80);
  const hasMore = annotation.content.length > 80;

  return (
    <button
      type="button"
      className={cn(
        'w-full rounded-md p-2 text-left transition-colors',
        isSelected
          ? 'bg-primary/10 border border-primary/30'
          : 'hover:bg-muted/50 border border-transparent'
      )}
      onClick={onClick}
    >
      {/* Quoted text */}
      {annotation.target?.selector?.exact && (
        <div className="mb-1.5 rounded bg-muted/50 px-2 py-1 text-xs text-muted-foreground italic border-l-2 border-primary/30">
          &ldquo;{annotation.target.selector.exact.slice(0, 60)}
          {annotation.target.selector.exact.length > 60 && '...'}&rdquo;
        </div>
      )}

      {/* Author and date */}
      <div className="flex items-center gap-1.5 mb-1">
        <User className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs font-medium truncate">{authorName}</span>
        <span className="text-xs text-muted-foreground">·</span>
        <span className="text-xs text-muted-foreground">
          {new Date(annotation.createdAt).toLocaleDateString()}
        </span>
      </div>

      {/* Comment excerpt */}
      <p className="text-xs text-muted-foreground line-clamp-2">
        {excerpt}
        {hasMore && '...'}
      </p>
    </button>
  );
}

// =============================================================================
// SKELETON
// =============================================================================

/**
 * Loading skeleton for AnnotationSidebar.
 */
export function AnnotationSidebarSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-lg border bg-card', className)}>
      <div className="border-b px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-8" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 flex-1" />
          <Skeleton className="h-7 w-16" />
        </div>
      </div>
      <div className="p-2 space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="p-2">
            <Skeleton className="h-4 w-20 mb-2" />
            <Skeleton className="h-16 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
