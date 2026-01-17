'use client';

/**
 * Knowledge Graph node search component.
 *
 * @remarks
 * Unified search component for finding nodes in the knowledge graph.
 * Supports filtering by kind (type/object) and subkind, with
 * debounced search and status indicators.
 *
 * @example
 * ```tsx
 * <NodeSearch
 *   query="machine learning"
 *   onSelect={handleSelectNode}
 *   filterSubkind="field"
 * />
 * ```
 *
 * @packageDocumentation
 */

import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, ExternalLink } from 'lucide-react';

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  getSubkindColorClasses,
  getSubkindIcon,
  getSubkindLabel,
  SUBKIND_ICONS,
} from '@/lib/constants/subkind-colors';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Node kind in the unified model.
 */
export type NodeKind = 'type' | 'object';

/**
 * Node status.
 */
export type NodeStatus = 'proposed' | 'provisional' | 'established' | 'deprecated';

/**
 * External ID entry.
 */
export interface ExternalId {
  system: string;
  identifier: string;
  uri?: string;
}

/**
 * Node search result.
 */
export interface NodeResult {
  /** AT-URI */
  uri: string;

  /** Node ID */
  id: string;

  /** Display label */
  label: string;

  /** Alternative labels */
  alternateLabels?: string[];

  /** Description */
  description?: string;

  /** Node kind */
  kind: NodeKind;

  /** Subkind slug */
  subkind: string;

  /** Status */
  status: NodeStatus;

  /** External identifiers */
  externalIds?: ExternalId[];

  /** Usage count (if available) */
  usageCount?: number;
}

/**
 * Props for NodeSearch.
 */
export interface NodeSearchProps {
  /** Search query */
  query: string;

  /** Callback when node is selected */
  onSelect: (node: NodeResult) => void;

  /** Filter by node kind */
  filterKind?: NodeKind;

  /** Filter by subkind */
  filterSubkind?: string;

  /** Maximum results */
  limit?: number;

  /** Status filter */
  statusFilter?: NodeStatus | NodeStatus[];

  /** Additional CSS classes */
  className?: string;

  /** Show subkind badges */
  showSubkind?: boolean;

  /** Show external ID indicators */
  showExternalIds?: boolean;

  /** Custom empty message */
  emptyMessage?: string;
}

// Icons and labels are imported from @/lib/constants/subkind-colors

// =============================================================================
// API
// =============================================================================

async function searchNodes(
  query: string,
  limit: number,
  filterKind?: NodeKind,
  filterSubkind?: string,
  statusFilter?: NodeStatus | NodeStatus[]
): Promise<NodeResult[]> {
  if (query.length < 2) return [];

  const params = new URLSearchParams({
    query,
    limit: String(limit),
  });

  if (filterKind) {
    params.set('kind', filterKind);
  }

  if (filterSubkind) {
    params.set('subkind', filterSubkind);
  }

  // Handle status filter
  if (statusFilter) {
    const statuses = Array.isArray(statusFilter) ? statusFilter : [statusFilter];
    // API might support comma-separated statuses or just one
    params.set('status', statuses[0]);
  }

  const response = await fetch(`/xrpc/pub.chive.graph.searchNodes?${params.toString()}`);

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as {
    nodes: Array<{
      uri: string;
      id: string;
      label: string;
      alternateLabels?: string[];
      description?: string;
      kind: string;
      subkind: string;
      status: string;
      externalIds?: Array<{ system: string; identifier: string; uri?: string }>;
    }>;
  };

  return (data.nodes ?? []).map((n) => ({
    uri: n.uri,
    id: n.id,
    label: n.label,
    alternateLabels: n.alternateLabels,
    description: n.description,
    kind: n.kind as NodeKind,
    subkind: n.subkind,
    status: n.status as NodeStatus,
    externalIds: n.externalIds,
  }));
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Search knowledge graph nodes.
 *
 * @param props - Component props
 * @returns Search results element
 */
export function NodeSearch({
  query,
  onSelect,
  filterKind,
  filterSubkind,
  limit = 10,
  statusFilter,
  className,
  showSubkind = true,
  showExternalIds = false,
  emptyMessage = 'No nodes found',
}: NodeSearchProps) {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  // Debounce query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const {
    data: results,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['nodes', 'search', debouncedQuery, limit, filterKind, filterSubkind, statusFilter],
    queryFn: () => searchNodes(debouncedQuery, limit, filterKind, filterSubkind, statusFilter),
    enabled: debouncedQuery.length >= 2,
    staleTime: 5 * 60 * 1000,
  });

  const getStatusColor = (status: NodeStatus) => {
    switch (status) {
      case 'established':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'provisional':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'proposed':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'deprecated':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    }
  };

  // Group results by subkind
  const groupedResults = useMemo(() => {
    if (!results) return {};
    return results.reduce(
      (acc, node) => {
        const key = node.subkind;
        if (!acc[key]) acc[key] = [];
        acc[key].push(node);
        return acc;
      },
      {} as Record<string, NodeResult[]>
    );
  }, [results]);

  return (
    <Command className={cn('', className)} data-testid="node-search">
      <CommandList>
        {isLoading && (
          <div className="flex items-center justify-center py-6" role="status" aria-label="Loading">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="py-6 text-center text-sm text-destructive">Search failed. Try again.</div>
        )}

        {!isLoading && !error && query.length < 2 && (
          <CommandEmpty>Type at least 2 characters to search</CommandEmpty>
        )}

        {!isLoading && !error && query.length >= 2 && results?.length === 0 && (
          <CommandEmpty>{emptyMessage}</CommandEmpty>
        )}

        {Object.entries(groupedResults).map(([subkind, nodes]) => {
          const Icon = getSubkindIcon(subkind);
          const label = getSubkindLabel(subkind);
          const colorClasses = getSubkindColorClasses(subkind);

          return (
            <CommandGroup key={subkind} heading={label}>
              {nodes.map((node) => (
                <CommandItem
                  key={node.uri}
                  value={`${node.label}-${node.id}`}
                  onSelect={() => onSelect(node)}
                  className="cursor-pointer"
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground mr-2" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{node.label}</span>
                      {showSubkind && (
                        <Badge variant="secondary" className={cn('text-[10px]', colorClasses)}>
                          {label}
                        </Badge>
                      )}
                      <Badge
                        variant="secondary"
                        className={cn('text-[10px]', getStatusColor(node.status))}
                      >
                        {node.status}
                      </Badge>
                      {showExternalIds && node.externalIds && node.externalIds.length > 0 && (
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                    {node.description && (
                      <p className="text-xs text-muted-foreground truncate">{node.description}</p>
                    )}
                    {node.alternateLabels && node.alternateLabels.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Also: {node.alternateLabels.slice(0, 3).join(', ')}
                        {node.alternateLabels.length > 3 && '...'}
                      </p>
                    )}
                  </div>
                  {node.usageCount !== undefined && node.usageCount > 0 && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {node.usageCount.toLocaleString()}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}
      </CommandList>
    </Command>
  );
}
