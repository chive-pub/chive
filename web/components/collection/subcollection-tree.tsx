'use client';

/**
 * Recursive subcollection tree browser.
 *
 * @remarks
 * Renders subcollections as a tree of expandable nodes, each displaying the
 * collection name (as a link), item count badge, and visibility icon. Child
 * subcollections are loaded lazily via useSubcollections when a node is
 * expanded. Includes an optional parent breadcrumb at the top.
 *
 * When `isOwner` is true, a drag handle icon is rendered on each node for
 * future drag-and-drop reparenting support.
 *
 * @example
 * ```tsx
 * <SubcollectionTree
 *   subcollections={subcollections}
 *   currentUri={collectionUri}
 *   parentCollection={parentCollection}
 *   isOwner={isOwner}
 * />
 * ```
 *
 * @packageDocumentation
 */

import { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Globe,
  GripVertical,
  Link as LinkIcon,
  Loader2,
  Lock,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useSubcollections, type CollectionView } from '@/lib/hooks/use-collections';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for the SubcollectionTree component.
 */
interface SubcollectionTreeProps {
  /** Direct subcollections of the current collection. */
  subcollections: CollectionView[];
  /** AT-URI of the current collection. */
  currentUri: string;
  /** Parent collection for breadcrumb display, or null for top-level. */
  parentCollection?: CollectionView | null;
  /** Whether the current user owns this collection tree. */
  isOwner?: boolean;
  /** Additional CSS class names. */
  className?: string;
}

/**
 * Props for a single recursive tree node.
 */
interface SubcollectionTreeNodeProps {
  /** The collection to render as a tree node. */
  collection: CollectionView;
  /** Nesting depth (0 for top-level subcollections). */
  depth: number;
  /** Whether the current user owns this collection tree. */
  isOwner?: boolean;
}

// =============================================================================
// VISIBILITY HELPERS
// =============================================================================

/** Maps visibility levels to their icon and label. */
const VISIBILITY_ICONS = {
  public: { icon: Globe, label: 'Public' },
  unlisted: { icon: LinkIcon, label: 'Unlisted' },
  private: { icon: Lock, label: 'Private' },
} as const;

// =============================================================================
// TREE NODE
// =============================================================================

/**
 * Recursive tree node for a single subcollection.
 *
 * @remarks
 * Renders an expand/collapse chevron, collection name as a link, item count
 * badge, visibility icon, and an optional drag handle. When expanded, lazily
 * fetches child subcollections via the useSubcollections hook and renders
 * them recursively.
 *
 * @param props - node props
 * @returns React element for a single tree node and its children
 */
function SubcollectionTreeNode({ collection, depth, isOwner }: SubcollectionTreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Lazily fetch children only when the node is expanded
  const { data: childData, isLoading: childrenLoading } = useSubcollections(collection.uri, {
    enabled: isExpanded,
  });

  const children = childData?.collections ?? [];
  const hasChildren = collection.itemCount > 0 || children.length > 0;

  const VisibilityIcon = VISIBILITY_ICONS[collection.visibility].icon;
  const visibilityLabel = VISIBILITY_ICONS[collection.visibility].label;

  const handleToggle = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className="flex items-center gap-1 py-1 group" style={{ paddingLeft: depth * 16 }}>
        {/* Drag handle (owner only) */}
        {isOwner && (
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        )}

        {/* Expand/collapse trigger */}
        <CollapsibleTrigger asChild>
          <button
            type="button"
            onClick={handleToggle}
            className="flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent transition-colors flex-shrink-0"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {childrenLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        </CollapsibleTrigger>

        {/* Collection name (link) */}
        <Link
          href={`/collections/${encodeURIComponent(collection.uri)}`}
          className="flex-1 min-w-0 truncate text-sm font-medium hover:underline transition-colors"
          title={collection.label}
        >
          {collection.label}
        </Link>

        {/* Item count badge */}
        <Badge variant="secondary" className="text-[10px] flex-shrink-0">
          {collection.itemCount}
        </Badge>

        {/* Visibility icon */}
        <VisibilityIcon
          className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0"
          aria-label={visibilityLabel}
        />
      </div>

      {/* Children (rendered recursively when expanded) */}
      <CollapsibleContent>
        {childrenLoading && children.length === 0 && (
          <div
            className="flex items-center gap-2 py-1.5 text-xs text-muted-foreground"
            style={{ paddingLeft: (depth + 1) * 16 + 24 }}
          >
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading subcollections...
          </div>
        )}
        {!childrenLoading && children.length === 0 && isExpanded && hasChildren && (
          <div
            className="py-1 text-xs text-muted-foreground"
            style={{ paddingLeft: (depth + 1) * 16 + 24 }}
          >
            No subcollections
          </div>
        )}
        {children.map((child) => (
          <SubcollectionTreeNode
            key={child.uri}
            collection={child}
            depth={depth + 1}
            isOwner={isOwner}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * Renders a parent breadcrumb and a recursive subcollection tree.
 *
 * @remarks
 * If a parent collection exists, displays a breadcrumb link at the top.
 * Subcollections are rendered as an indented tree of expandable nodes.
 * Each node lazily loads its own children when expanded.
 *
 * @param props - component props
 * @returns React element for the subcollection tree, or null if empty
 */
export function SubcollectionTree({
  subcollections,
  currentUri: _currentUri,
  parentCollection,
  isOwner,
  className,
}: SubcollectionTreeProps) {
  const hasParent = !!parentCollection;
  const hasSubcollections = subcollections.length > 0;

  if (!hasParent && !hasSubcollections) {
    return null;
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Parent breadcrumb */}
      {parentCollection && (
        <div>
          <Link
            href={`/collections/${encodeURIComponent(parentCollection.uri)}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <FolderOpen className="h-4 w-4" />
            <span>Parent:</span>
            <span className="font-medium">{parentCollection.label}</span>
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      {/* Subcollection tree */}
      {hasSubcollections && (
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Subcollections</h2>
          <div className="rounded-md border p-2">
            {subcollections.map((sub) => (
              <SubcollectionTreeNode key={sub.uri} collection={sub} depth={0} isOwner={isOwner} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
