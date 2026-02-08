'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ChevronRight, FolderTree, ChevronDown, ChevronUp } from 'lucide-react';

import { FieldCardSkeleton } from '@/components/knowledge-graph';
import { InlineSearch } from '@/components/search';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useFieldHierarchy } from '@/lib/hooks/use-field';
import { useNodeSearch } from '@/lib/hooks/use-nodes';

/**
 * Hierarchy node from API response.
 */
interface HierarchyNode {
  node: {
    id: string;
    uri: string;
    label: string;
    description?: string;
    status: string;
  };
  children: HierarchyNode[];
  depth: number;
}

/**
 * Flattened field with depth and parent info.
 */
interface FlatField {
  id: string;
  uri: string;
  name: string;
  description?: string;
  status: string;
  depth: number;
  parentName?: string;
  hasChildren: boolean;
  /** ID of the top-level root ancestor */
  rootId?: string;
}

/**
 * Flatten hierarchy tree into a list with depth info.
 */
function flattenHierarchy(
  roots: HierarchyNode[],
  parentName?: string,
  depth = 0,
  rootId?: string
): FlatField[] {
  const result: FlatField[] = [];
  for (const item of roots) {
    const currentRootId = depth === 0 ? item.node.id : rootId;
    result.push({
      id: item.node.id,
      uri: item.node.uri,
      name: item.node.label,
      description: item.node.description,
      status: item.node.status,
      depth,
      parentName,
      hasChildren: item.children.length > 0,
      rootId: currentRootId,
    });
    if (item.children.length > 0) {
      result.push(...flattenHierarchy(item.children, item.node.label, depth + 1, currentRootId));
    }
  }
  return result;
}

/**
 * Client-side fields page content.
 *
 * @remarks
 * Displays fields in a hierarchical list with depth indication.
 * Uses server-side search when query is 2+ characters.
 *
 * @returns React element with fields list
 */
export function FieldsPageContent() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedOnly, setExpandedOnly] = useState(true); // Show only top-level by default

  // Fetch field hierarchy
  const {
    data: hierarchyData,
    isLoading: isLoadingHierarchy,
    error: hierarchyError,
  } = useFieldHierarchy();

  // Search fields server-side (enabled when query is 2+ chars)
  const {
    data: searchData,
    isLoading: isSearching,
    error: searchError,
  } = useNodeSearch(
    searchQuery,
    { subkind: 'field', status: 'established', limit: 50 },
    { enabled: searchQuery.length >= 2 }
  );

  // Flatten hierarchy for display
  const flatFields = useMemo(() => {
    if (!hierarchyData?.roots) return [];
    return flattenHierarchy(hierarchyData.roots);
  }, [hierarchyData?.roots]);

  // Determine which data to display
  const isSearchActive = searchQuery.length >= 2;
  const _isLoading = isSearchActive ? isSearching : isLoadingHierarchy;
  const error = isSearchActive ? searchError : hierarchyError;

  // Get display fields based on search or hierarchy
  const displayFields = useMemo(() => {
    if (isSearchActive && searchData?.nodes) {
      // Map search results to FlatField with hierarchy info
      const depthMap = new Map(flatFields.map((f) => [f.id, f]));
      const matchedFields = searchData.nodes.map((node) => {
        const hierarchyInfo = depthMap.get(node.id);
        return {
          id: node.id,
          uri: node.uri,
          name: node.label,
          description: node.description,
          status: node.status,
          depth: hierarchyInfo?.depth ?? 0,
          parentName: hierarchyInfo?.parentName,
          hasChildren: hierarchyInfo?.hasChildren ?? false,
          rootId: hierarchyInfo?.rootId,
        } as FlatField;
      });

      // Find the highest-level (lowest depth) matched field in each subtree
      // to use as the grouping key
      const groupedByHighestMatch = new Map<string, FlatField[]>();

      for (const field of matchedFields) {
        // Find the highest ancestor that is also matched
        let highestMatchedAncestorId = field.id;
        let highestMatchedDepth = field.depth;

        // Check all matched fields to find if any is an ancestor of this field
        for (const other of matchedFields) {
          if (other.id === field.id) continue;
          // other is an ancestor if it has lower depth and same rootId
          if (other.rootId === field.rootId && other.depth < field.depth) {
            // Check if field is actually a descendant of other
            // by seeing if other appears in the hierarchy above field
            const fieldInFlat = flatFields.find((f) => f.id === field.id);
            const otherInFlat = flatFields.find((f) => f.id === other.id);
            if (fieldInFlat && otherInFlat && otherInFlat.depth < fieldInFlat.depth) {
              if (other.depth < highestMatchedDepth) {
                highestMatchedAncestorId = other.id;
                highestMatchedDepth = other.depth;
              }
            }
          }
        }

        if (!groupedByHighestMatch.has(highestMatchedAncestorId)) {
          groupedByHighestMatch.set(highestMatchedAncestorId, []);
        }
        // Only add if not already present
        const group = groupedByHighestMatch.get(highestMatchedAncestorId)!;
        if (!group.some((f) => f.id === field.id)) {
          group.push(field);
        }
      }

      // Build result: only matched fields, sorted by depth within each group
      const result: FlatField[] = [];
      const groupEntries = Array.from(groupedByHighestMatch.entries());

      // Sort groups by depth of the highest matched field (shallowest first)
      groupEntries.sort((a, b) => {
        const groupAHead = matchedFields.find((f) => f.id === a[0]);
        const groupBHead = matchedFields.find((f) => f.id === b[0]);
        return (groupAHead?.depth ?? 0) - (groupBHead?.depth ?? 0);
      });

      for (const [_groupId, fields] of groupEntries) {
        // Sort by depth (parents before children)
        fields.sort((a, b) => a.depth - b.depth);
        result.push(...fields);
      }

      // Deduplicate
      const seen = new Set<string>();
      return result.filter((f) => {
        if (seen.has(f.id)) return false;
        seen.add(f.id);
        return true;
      });
    }

    // Filter by search query (1 char) or show based on expand state
    if (searchQuery.length === 1) {
      return flatFields.filter(
        (f) =>
          f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          f.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Show top-level only or all
    return expandedOnly ? flatFields.filter((f) => f.depth === 0) : flatFields;
  }, [isSearchActive, searchData?.nodes, flatFields, searchQuery, expandedOnly]);

  const totalCount = flatFields.length;
  const topLevelCount = flatFields.filter((f) => f.depth === 0).length;

  // Show initial loading skeleton only before hierarchy is loaded
  if (isLoadingHierarchy) {
    return <FieldsGridSkeleton count={12} />;
  }

  return (
    <div className="space-y-6">
      {/* Controls - always visible */}
      <div className="flex flex-wrap items-center gap-4">
        <InlineSearch
          placeholder="Filter fields..."
          onSearch={setSearchQuery}
          debounceMs={200}
          className="max-w-md flex-1"
        />
        {!isSearchActive && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpandedOnly(!expandedOnly)}
            className="gap-2"
          >
            {expandedOnly ? (
              <>
                <ChevronDown className="h-4 w-4" />
                Show all ({totalCount})
              </>
            ) : (
              <>
                <ChevronUp className="h-4 w-4" />
                Top-level only ({topLevelCount})
              </>
            )}
          </Button>
        )}
      </div>

      {/* Error state */}
      {error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-8 text-center">
          <p className="text-destructive">Failed to load fields</p>
          <p className="mt-2 text-sm text-muted-foreground">{(error as Error).message}</p>
        </div>
      ) : isSearching ? (
        /* Search loading state */
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="ml-2 text-muted-foreground">Searching...</span>
        </div>
      ) : displayFields.length === 0 ? (
        /* Empty state */
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            {searchQuery ? 'No fields match your search.' : 'No fields available.'}
          </p>
        </div>
      ) : (
        /* Fields list */
        <div className="space-y-1">
          {displayFields.map((field) => (
            <FieldRow key={field.id} field={field} />
          ))}
        </div>
      )}

      {/* Total count */}
      <p className="text-center text-sm text-muted-foreground">
        Showing {displayFields.length} of {totalCount} fields
      </p>
    </div>
  );
}

/**
 * Single field row with depth indication.
 */
function FieldRow({ field }: { field: FlatField }) {
  const fieldUrl = `/fields/${encodeURIComponent(field.id)}`;

  // Depth styling - colors get lighter as depth increases
  const depthColors = [
    'bg-primary/10 border-primary/20', // depth 0
    'bg-primary/5 border-primary/10', // depth 1
    'bg-muted/50 border-muted', // depth 2
    'bg-muted/30 border-muted/50', // depth 3+
  ];
  const depthColor = depthColors[Math.min(field.depth, 3)];

  return (
    <Link
      href={fieldUrl}
      className={cn(
        'flex items-center gap-3 rounded-lg border p-3 transition-all hover:shadow-md',
        depthColor
      )}
      style={{ marginLeft: `${field.depth * 24}px` }}
    >
      {/* Icon with depth indication */}
      <div className="flex items-center gap-1">
        {field.depth > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        <FolderTree
          className={cn('h-4 w-4', field.depth === 0 ? 'text-primary' : 'text-muted-foreground')}
        />
      </div>

      {/* Field info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn('font-medium truncate', field.depth === 0 && 'text-primary')}>
            {field.name}
          </span>
          {field.parentName && (
            <span className="text-xs text-muted-foreground truncate">in {field.parentName}</span>
          )}
        </div>
        {field.description && (
          <p className="text-sm text-muted-foreground line-clamp-1">{field.description}</p>
        )}
      </div>

      {/* Badges */}
      <div className="flex items-center gap-2 shrink-0">
        {field.hasChildren && (
          <Badge variant="secondary" className="text-xs">
            has subfields
          </Badge>
        )}
        <FieldDepthBadge depth={field.depth} />
      </div>
    </Link>
  );
}

/**
 * Badge showing field depth level.
 */
function FieldDepthBadge({ depth }: { depth: number }) {
  const labels = ['Top-level', 'L2', 'L3', 'L4', 'L5'];
  const label = labels[Math.min(depth, 4)];

  if (depth === 0) {
    return (
      <Badge variant="default" className="text-xs">
        {label}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="text-xs">
      {label}
    </Badge>
  );
}

/**
 * Grid skeleton for fields.
 */
function FieldsGridSkeleton({ count }: { count: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <FieldCardSkeleton key={i} />
      ))}
    </div>
  );
}
