'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, ChevronDown, FolderTree, Home } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useFieldChildren } from '@/lib/hooks/use-field';
import type { FieldAncestor, FieldChild, FieldDetail, FieldSummary } from '@/lib/api/schema';

/**
 * Props for the FieldBreadcrumb component.
 */
export interface FieldBreadcrumbProps {
  /** Current field */
  field: FieldDetail;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Breadcrumb navigation showing field ancestry.
 *
 * @remarks
 * Server component that renders the path from root to current field.
 * Each ancestor is a clickable link.
 *
 * @example
 * ```tsx
 * <FieldBreadcrumb field={fieldDetail} />
 * ```
 *
 * @param props - Component props
 * @returns React element displaying the breadcrumb
 */
export function FieldBreadcrumb({ field, className }: FieldBreadcrumbProps) {
  const ancestors = field.ancestors ?? [];

  return (
    <nav aria-label="Field hierarchy" className={cn('flex items-center gap-1 text-sm', className)}>
      <Link
        href="/fields"
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
      >
        <Home className="h-4 w-4" />
        <span className="sr-only">All fields</span>
      </Link>

      {ancestors.map((ancestor: FieldAncestor) => (
        <span key={ancestor.id} className="flex items-center gap-1">
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <Link
            href={`/fields/${encodeURIComponent(ancestor.id)}`}
            className="text-muted-foreground hover:text-foreground hover:underline"
          >
            {ancestor.name}
          </Link>
        </span>
      ))}

      <ChevronRight className="h-4 w-4 text-muted-foreground" />
      <span className="font-medium">{field.name}</span>
    </nav>
  );
}

/**
 * Props for the FieldChildren component.
 */
export interface FieldChildrenProps {
  /** Child fields to display */
  fields: FieldChild[];
  /** Whether to show as expandable tree */
  expandable?: boolean;
  /** Maximum children to show */
  maxVisible?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays child fields in a list or expandable tree.
 *
 * @example
 * ```tsx
 * <FieldChildren fields={field.children} expandable />
 * ```
 */
export function FieldChildren({
  fields,
  expandable: _expandable = false,
  maxVisible = 10,
  className,
}: FieldChildrenProps) {
  const [showAll, setShowAll] = useState(false);

  if (!fields || fields.length === 0) {
    return null;
  }

  const visibleChildren = showAll ? fields : fields.slice(0, maxVisible);
  const hasMore = fields.length > maxVisible;

  return (
    <div className={cn('space-y-2', className)}>
      <h4 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <FolderTree className="h-4 w-4" />
        Subfields ({fields.length})
      </h4>
      <ul className="space-y-1">
        {visibleChildren.map((child) => (
          <li key={child.id}>
            <Link
              href={`/fields/${encodeURIComponent(child.id)}`}
              className="flex items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-accent"
            >
              <span>{child.name}</span>
              {child.preprintCount !== undefined && (
                <span className="text-xs text-muted-foreground">{child.preprintCount}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>

      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-xs text-primary hover:underline"
        >
          {showAll ? 'Show less' : `Show ${fields.length - maxVisible} more`}
        </button>
      )}
    </div>
  );
}

/**
 * Props for the FieldTree component.
 */
export interface FieldTreeProps {
  /** Root fields */
  fields: FieldChild[];
  /** Currently selected field ID */
  selectedId?: string;
  /** Callback when field is selected */
  onSelect?: (id: string) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Interactive tree view of field hierarchy.
 *
 * @remarks
 * Client component that renders an expandable tree of fields.
 * Supports selection and keyboard navigation.
 *
 * @example
 * ```tsx
 * <FieldTree
 *   fields={rootFields}
 *   selectedId={currentFieldId}
 *   onSelect={(id) => navigateToField(id)}
 * />
 * ```
 */
export function FieldTree({ fields, selectedId, onSelect, className }: FieldTreeProps) {
  return (
    <ul className={cn('space-y-1', className)} role="tree">
      {fields.map((field) => (
        <FieldTreeNode
          key={field.id}
          field={field}
          selectedId={selectedId}
          onSelect={onSelect}
          level={0}
        />
      ))}
    </ul>
  );
}

/**
 * Tree node field type - accepts either FieldChild or FieldSummary.
 *
 * @remarks
 * FieldChild is used for root-level nodes passed to FieldTree.
 * FieldSummary is returned by useFieldChildren and has childCount for determining expandability.
 */
type TreeNodeField = FieldChild | FieldSummary;

/**
 * Props for the FieldTreeNode component.
 */
interface FieldTreeNodeProps {
  /** Field data (FieldChild for root nodes, FieldSummary for fetched children) */
  field: TreeNodeField;
  /** Currently selected field ID */
  selectedId?: string;
  /** Callback when field is selected */
  onSelect?: (id: string) => void;
  /** Nesting level for indentation */
  level: number;
}

/**
 * Type guard to check if field is a FieldSummary with childCount.
 */
function hasChildCount(field: TreeNodeField): field is FieldSummary {
  return 'childCount' in field && typeof field.childCount === 'number';
}

/**
 * Single node in the field tree with lazy-loaded children.
 *
 * @remarks
 * Fetches children on-demand when expanded. For root-level nodes (FieldChild),
 * assumes children may exist and shows expand button. For fetched nodes
 * (FieldSummary), uses childCount to determine expandability.
 *
 * @example
 * ```tsx
 * <FieldTreeNode
 *   field={{ id: 'physics', name: 'Physics', childCount: 5 }}
 *   selectedId="quantum-mechanics"
 *   onSelect={(id) => console.log('Selected:', id)}
 *   level={0}
 * />
 * ```
 */
function FieldTreeNode({ field, selectedId, onSelect, level }: FieldTreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isSelected = field.id === selectedId;

  // Determine if field might have children:
  // - FieldSummary: use childCount
  // - FieldChild (root): assume might have children (will verify on expand)
  const mightHaveChildren = hasChildCount(field) ? (field.childCount ?? 0) > 0 : true;

  // Fetch children when expanded
  const { data: children, isLoading: isLoadingChildren } = useFieldChildren(field.id, {
    enabled: isExpanded && mightHaveChildren,
  });

  // Update hasChildren based on actual data once fetched
  const hasChildren = mightHaveChildren && (!isExpanded || (children && children.length > 0));

  return (
    <li
      role="treeitem"
      aria-selected={isSelected}
      aria-expanded={hasChildren ? isExpanded : undefined}
    >
      <div
        className={cn(
          'flex items-center gap-1 rounded px-2 py-1.5',
          isSelected ? 'bg-accent' : 'hover:bg-accent/50',
          'cursor-pointer'
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => onSelect?.(field.id)}
      >
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="rounded p-0.5 hover:bg-muted"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
        )}
        {!hasChildren && <span className="w-4" />}
        <FolderTree className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1 text-sm">{field.name}</span>
        {field.preprintCount !== undefined && (
          <span className="text-xs text-muted-foreground">{field.preprintCount}</span>
        )}
      </div>

      {/* Loading indicator */}
      {isExpanded && isLoadingChildren && (
        <div
          className="flex items-center gap-2 py-2 text-sm text-muted-foreground"
          style={{ paddingLeft: `${(level + 1) * 16 + 8}px` }}
        >
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-primary" />
          <span>Loading...</span>
        </div>
      )}

      {/* Render children when expanded */}
      {isExpanded && children && children.length > 0 && (
        <ul role="group">
          {children.map((child) => (
            <FieldTreeNode
              key={child.id}
              field={child}
              selectedId={selectedId}
              onSelect={onSelect}
              level={level + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * Props for the FieldBreadcrumbSkeleton component.
 */
export interface FieldBreadcrumbSkeletonProps {
  /** Number of items to show */
  items?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Loading skeleton for FieldBreadcrumb.
 */
export function FieldBreadcrumbSkeleton({ items = 3, className }: FieldBreadcrumbSkeletonProps) {
  return (
    <nav className={cn('flex items-center gap-1', className)}>
      <div className="h-4 w-4 animate-pulse rounded bg-muted" />
      {Array.from({ length: items }).map((_, i) => (
        <span key={i} className="flex items-center gap-1">
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <div className="h-4 w-20 animate-pulse rounded bg-muted" />
        </span>
      ))}
    </nav>
  );
}
