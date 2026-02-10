'use client';

/**
 * Sidebar for displaying and navigating inline annotations.
 *
 * @remarks
 * Shows annotations (comments) and entity links grouped by page.
 * Clicking an item scrolls to its location in the PDF.
 *
 * @packageDocumentation
 */

import { useState, useMemo } from 'react';
import {
  MessageSquare,
  ChevronDown,
  ChevronRight,
  User,
  Filter,
  FileText,
  Link2,
  Trash2,
} from 'lucide-react';

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
import { useAuth } from '@/lib/auth';
import {
  useAnnotations,
  useDeleteAnnotation,
  useDeleteEntityLink,
  type AnnotationView,
  type EntityLinkView,
} from '@/lib/hooks/use-annotations';

// =============================================================================
// TYPES
// =============================================================================

export interface AnnotationSidebarProps {
  eprintUri: string;
  selectedUri?: string;
  onAnnotationClick?: (uri: string, pageNumber?: number) => void;
  className?: string;
}

/**
 * A sidebar item is either an annotation comment or an entity link.
 */
type SidebarItem =
  | { kind: 'annotation'; data: AnnotationView }
  | { kind: 'entityLink'; data: EntityLinkView };

interface PageGroup {
  pageNumber: number;
  items: SidebarItem[];
}

type SortOption = 'page' | 'date' | 'author';

// =============================================================================
// HELPERS
// =============================================================================

function getEntityLabel(linkedEntity: unknown): string {
  if (typeof linkedEntity !== 'object' || linkedEntity === null) return 'Unknown entity';
  const entity = linkedEntity as Record<string, unknown>;
  return (entity.label ?? entity.displayName ?? entity.title ?? 'Unknown entity') as string;
}

function getItemPageNumber(item: SidebarItem): number {
  return item.data.target?.refinedBy?.pageNumber ?? 0;
}

function getItemCreatedAt(item: SidebarItem): string {
  return item.data.createdAt;
}

function getItemAuthorName(item: SidebarItem): string {
  if (item.kind === 'annotation') {
    return item.data.author.displayName ?? item.data.author.handle ?? '';
  }
  return item.data.creator.displayName ?? item.data.creator.handle ?? '';
}

// =============================================================================
// COMPONENT
// =============================================================================

export function AnnotationSidebar({
  eprintUri,
  selectedUri,
  onAnnotationClick,
  className,
}: AnnotationSidebarProps) {
  const [sortBy, setSortBy] = useState<SortOption>('page');
  const [expandedPages, setExpandedPages] = useState<Set<number>>(new Set([0]));

  const { user } = useAuth();
  const { data, isLoading, error } = useAnnotations(eprintUri);
  const deleteAnnotation = useDeleteAnnotation();
  const deleteEntityLink = useDeleteEntityLink();

  // Merge annotations and entity links into a unified list grouped by page
  const pageGroups = useMemo<PageGroup[]>(() => {
    const items: SidebarItem[] = [];

    for (const annotation of data?.annotations ?? []) {
      items.push({ kind: 'annotation', data: annotation });
    }
    for (const entityLink of data?.entityLinks ?? []) {
      items.push({ kind: 'entityLink', data: entityLink });
    }

    if (items.length === 0) return [];

    // Group by page
    const groups = new Map<number, SidebarItem[]>();
    for (const item of items) {
      const pageNumber = getItemPageNumber(item);
      const existing = groups.get(pageNumber) ?? [];
      groups.set(pageNumber, [...existing, item]);
    }

    const sorted = Array.from(groups.entries())
      .map(([pageNumber, pageItems]) => ({ pageNumber, items: pageItems }))
      .sort((a, b) => a.pageNumber - b.pageNumber);

    // Sort items within each group
    if (sortBy === 'date') {
      for (const group of sorted) {
        group.items.sort(
          (a, b) =>
            new Date(getItemCreatedAt(b)).getTime() - new Date(getItemCreatedAt(a)).getTime()
        );
      }
    } else if (sortBy === 'author') {
      for (const group of sorted) {
        group.items.sort((a, b) => getItemAuthorName(a).localeCompare(getItemAuthorName(b)));
      }
    }

    return sorted;
  }, [data?.annotations, data?.entityLinks, sortBy]);

  const totalItems = (data?.annotations?.length ?? 0) + (data?.entityLinks?.length ?? 0);

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

  const expandAll = () => {
    setExpandedPages(new Set(pageGroups.map((g) => g.pageNumber)));
  };

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
            {totalItems}
          </Badge>
        </div>

        {totalItems > 0 && (
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

      {/* Item list */}
      <ScrollArea className="flex-1">
        {totalItems === 0 ? (
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
              <PageItemGroup
                key={group.pageNumber}
                pageNumber={group.pageNumber}
                items={group.items}
                isExpanded={expandedPages.has(group.pageNumber)}
                onToggle={() => togglePage(group.pageNumber)}
                selectedUri={selectedUri}
                onAnnotationClick={onAnnotationClick}
                currentUserDid={user?.did}
                onDeleteAnnotation={(uri) => deleteAnnotation.mutate({ uri, eprintUri })}
                onDeleteEntityLink={(uri) => deleteEntityLink.mutate({ uri, eprintUri })}
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

interface PageItemGroupProps {
  pageNumber: number;
  items: SidebarItem[];
  isExpanded: boolean;
  onToggle: () => void;
  selectedUri?: string;
  onAnnotationClick?: (uri: string, pageNumber?: number) => void;
  currentUserDid?: string;
  onDeleteAnnotation?: (uri: string) => void;
  onDeleteEntityLink?: (uri: string) => void;
}

function PageItemGroup({
  pageNumber,
  items,
  isExpanded,
  onToggle,
  selectedUri,
  onAnnotationClick,
  currentUserDid,
  onDeleteAnnotation,
  onDeleteEntityLink,
}: PageItemGroupProps) {
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
            Page {pageNumber + 1}
          </span>
          <Badge variant="outline" className="text-xs">
            {items.length}
          </Badge>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pl-6 pr-2 pb-2 space-y-1">
          {items.map((item) =>
            item.kind === 'annotation' ? (
              <AnnotationItem
                key={item.data.uri}
                annotation={item.data}
                isSelected={selectedUri === item.data.uri}
                onClick={() => onAnnotationClick?.(item.data.uri, pageNumber)}
                canDelete={!!currentUserDid && item.data.author.did === currentUserDid}
                onDelete={() => onDeleteAnnotation?.(item.data.uri)}
              />
            ) : (
              <EntityLinkItem
                key={item.data.uri}
                entityLink={item.data}
                isSelected={selectedUri === item.data.uri}
                onClick={() => onAnnotationClick?.(item.data.uri, pageNumber)}
                canDelete={!!currentUserDid && item.data.creator.did === currentUserDid}
                onDelete={() => onDeleteEntityLink?.(item.data.uri)}
              />
            )
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// =============================================================================
// ANNOTATION ITEM
// =============================================================================

function AnnotationItem({
  annotation,
  isSelected,
  onClick,
  canDelete,
  onDelete,
}: {
  annotation: AnnotationView;
  isSelected?: boolean;
  onClick?: () => void;
  canDelete?: boolean;
  onDelete?: () => void;
}) {
  const authorName = annotation.author.displayName ?? annotation.author.handle ?? 'Anonymous';
  const excerpt = annotation.content.slice(0, 80);
  const hasMore = annotation.content.length > 80;

  return (
    <div
      className={cn(
        'group relative w-full rounded-md p-2 text-left transition-colors cursor-pointer',
        isSelected
          ? 'bg-primary/10 border border-primary/30'
          : 'hover:bg-muted/50 border border-transparent'
      )}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick?.();
      }}
    >
      {canDelete && (
        <button
          type="button"
          className="absolute top-1.5 right-1.5 hidden group-hover:flex h-5 w-5 items-center justify-center rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.();
          }}
          title="Delete comment"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
      {annotation.target?.selector?.exact && (
        <div className="mb-1.5 rounded bg-muted/50 px-2 py-1 text-xs text-muted-foreground italic border-l-2 border-primary/30">
          &ldquo;{annotation.target.selector.exact.slice(0, 60)}
          {annotation.target.selector.exact.length > 60 && '...'}&rdquo;
        </div>
      )}
      <div className="flex items-center gap-1.5 mb-1">
        <MessageSquare className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs font-medium truncate">{authorName}</span>
        <span className="text-xs text-muted-foreground">·</span>
        <span className="text-xs text-muted-foreground">
          {new Date(annotation.createdAt).toLocaleDateString()}
        </span>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2">
        {excerpt}
        {hasMore && '...'}
      </p>
    </div>
  );
}

// =============================================================================
// ENTITY LINK ITEM
// =============================================================================

function EntityLinkItem({
  entityLink,
  isSelected,
  onClick,
  canDelete,
  onDelete,
}: {
  entityLink: EntityLinkView;
  isSelected?: boolean;
  onClick?: () => void;
  canDelete?: boolean;
  onDelete?: () => void;
}) {
  const creatorName = entityLink.creator.displayName ?? entityLink.creator.handle ?? 'Anonymous';
  const label = getEntityLabel(entityLink.linkedEntity);
  const excerpt = entityLink.target?.selector?.exact;

  return (
    <div
      className={cn(
        'group relative w-full rounded-md p-2 text-left transition-colors cursor-pointer',
        isSelected
          ? 'bg-primary/10 border border-primary/30'
          : 'hover:bg-muted/50 border border-transparent'
      )}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick?.();
      }}
    >
      {canDelete && (
        <button
          type="button"
          className="absolute top-1.5 right-1.5 hidden group-hover:flex h-5 w-5 items-center justify-center rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.();
          }}
          title="Delete entity link"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
      {excerpt && (
        <div className="mb-1.5 rounded bg-muted/50 px-2 py-1 text-xs text-muted-foreground italic border-l-2 border-blue-400/50">
          &ldquo;{excerpt.slice(0, 60)}
          {excerpt.length > 60 && '...'}&rdquo;
        </div>
      )}
      <div className="flex items-center gap-1.5 mb-1">
        <Link2 className="h-3 w-3 text-blue-500" />
        <span className="text-xs font-medium truncate">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <User className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground truncate">{creatorName}</span>
      </div>
    </div>
  );
}

// =============================================================================
// SKELETON
// =============================================================================

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
