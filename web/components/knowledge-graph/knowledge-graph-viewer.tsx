'use client';

/**
 * Knowledge Graph Viewer component.
 *
 * @remarks
 * Comprehensive viewer for exploring the unified knowledge graph.
 * Displays nodes organized by subkind with search, filtering, and
 * navigation capabilities.
 *
 * @example
 * ```tsx
 * <KnowledgeGraphViewer
 *   initialSubkind="field"
 *   onNodeSelect={handleNodeClick}
 * />
 * ```
 *
 * @packageDocumentation
 */

import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Network, Search, Filter, Grid3X3, List } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import type { GraphNode, NodeKind, NodeStatus, NodeCardData } from './types';
import { SUBKIND_CONFIGS, SUBKIND_BY_SLUG, graphNodeToCardData } from './types';
import { NodeCard } from './node-card';
import { NodeDetailModal } from './node-detail-modal';

/**
 * Props for KnowledgeGraphViewer.
 */
export interface KnowledgeGraphViewerProps {
  /** Initial subkind to display */
  initialSubkind?: string;

  /** Initial kind filter */
  initialKind?: NodeKind;

  /** Callback when a node is selected */
  onNodeSelect?: (node: GraphNode) => void;

  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// API
// =============================================================================

async function fetchNodes(
  subkind: string,
  kind?: NodeKind,
  status?: NodeStatus
): Promise<GraphNode[]> {
  const allNodes: GraphNode[] = [];
  let cursor: string | undefined;
  const pageLimit = 100;

  // Fetch all pages
  do {
    const params = new URLSearchParams({
      subkind,
      limit: String(pageLimit),
    });

    if (kind) params.set('kind', kind);
    if (status) params.set('status', status);
    if (cursor) params.set('cursor', cursor);

    const response = await fetch(`/xrpc/pub.chive.graph.listNodes?${params.toString()}`);

    if (!response.ok) {
      throw new Error('Failed to fetch nodes');
    }

    const data = (await response.json()) as { nodes: GraphNode[]; cursor?: string };
    allNodes.push(...(data.nodes ?? []));
    cursor = data.cursor;
  } while (cursor);

  return allNodes;
}

async function searchNodesApi(
  query: string,
  subkind?: string,
  kind?: NodeKind
): Promise<GraphNode[]> {
  if (query.length < 2) return [];

  const params = new URLSearchParams({
    q: query,
    limit: '20',
  });

  if (subkind) params.set('subkind', subkind);
  if (kind) params.set('kind', kind);

  const response = await fetch(`/xrpc/pub.chive.graph.searchNodes?${params.toString()}`);

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as { nodes: GraphNode[] };
  return data.nodes ?? [];
}

// =============================================================================
// NODE LIST SKELETON
// =============================================================================

function NodeListSkeleton({ count = 6, compact = false }: { count?: number; compact?: boolean }) {
  if (compact) {
    return (
      <div className="space-y-2">
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-5 w-32" />
            </div>
            <Skeleton className="h-4 w-full" />
          </CardHeader>
          <CardContent className="pt-0">
            <Skeleton className="h-3 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * Knowledge Graph Viewer.
 *
 * Displays and allows exploration of the unified knowledge graph.
 */
export function KnowledgeGraphViewer({
  initialSubkind = 'field',
  initialKind,
  onNodeSelect: _onNodeSelect,
  className,
}: KnowledgeGraphViewerProps) {
  const [activeSubkind, setActiveSubkind] = useState(initialSubkind);
  const [kindFilter, setKindFilter] = useState<NodeKind | 'all'>(initialKind ?? 'all');
  const [statusFilter, setStatusFilter] = useState<NodeStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [modalNode, setModalNode] = useState<NodeCardData | null>(null);

  const activeConfig = SUBKIND_BY_SLUG.get(activeSubkind);

  // Filter subkinds by kind
  const filteredSubkinds = useMemo(() => {
    if (kindFilter === 'all') return SUBKIND_CONFIGS;
    return SUBKIND_CONFIGS.filter((c) => c.kind === kindFilter);
  }, [kindFilter]);

  // Fetch nodes for active subkind
  const {
    data: nodes,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['nodes', 'list', activeSubkind, statusFilter === 'all' ? undefined : statusFilter],
    queryFn: () =>
      fetchNodes(activeSubkind, undefined, statusFilter === 'all' ? undefined : statusFilter),
    staleTime: 5 * 60 * 1000,
  });

  // Search query
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: [
      'nodes',
      'search',
      searchQuery,
      activeSubkind,
      kindFilter === 'all' ? undefined : kindFilter,
    ],
    queryFn: () =>
      searchNodesApi(searchQuery, activeSubkind, kindFilter === 'all' ? undefined : kindFilter),
    enabled: searchQuery.length >= 2,
    staleTime: 30 * 1000,
  });

  const handleNodeClick = useCallback((node: GraphNode) => {
    setModalNode(graphNodeToCardData(node));
  }, []);

  const displayNodes = searchQuery.length >= 2 ? searchResults : nodes;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Network className="h-6 w-6" />
            Knowledge Graph
          </h2>
          <p className="text-sm text-muted-foreground">
            Explore and navigate the unified knowledge graph
          </p>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search nodes..."
            className="pl-9"
          />
        </div>

        {/* Kind filter */}
        <Select value={kindFilter} onValueChange={(v) => setKindFilter(v as NodeKind | 'all')}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Kind" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Kinds</SelectItem>
            <SelectItem value="type">Types</SelectItem>
            <SelectItem value="object">Objects</SelectItem>
          </SelectContent>
        </Select>

        {/* Status filter */}
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as NodeStatus | 'all')}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="established">Established</SelectItem>
            <SelectItem value="provisional">Provisional</SelectItem>
            <SelectItem value="proposed">Proposed</SelectItem>
            <SelectItem value="deprecated">Deprecated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Main content */}
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        {/* Sidebar - subkind tabs */}
        <Card className="h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Node Types
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              <div className="p-2 space-y-1">
                {filteredSubkinds.map((config) => {
                  const Icon = config.icon;
                  const isActive = activeSubkind === config.slug;
                  return (
                    <button
                      key={config.slug}
                      onClick={() => setActiveSubkind(config.slug)}
                      className={cn(
                        'flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm transition-colors text-left',
                        isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted/50'
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1">{config.label}</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px]',
                          isActive && 'border-primary-foreground/30 text-primary-foreground'
                        )}
                      >
                        {config.kind}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Node list */}
        <div className="space-y-4">
          {activeConfig && (
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  {(() => {
                    const IconComp = activeConfig.icon;
                    return <IconComp className="h-5 w-5" />;
                  })()}
                  {activeConfig.label}
                </h3>
                <p className="text-sm text-muted-foreground">{activeConfig.description}</p>
              </div>
              {displayNodes && (
                <Badge variant="secondary">
                  {displayNodes.length} node{displayNodes.length !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          )}

          {(isLoading || isSearching) && (
            <NodeListSkeleton count={6} compact={viewMode === 'list'} />
          )}

          {error && (
            <Card className="border-destructive">
              <CardContent className="py-6 text-center text-sm text-destructive">
                Failed to load nodes. Please try again.
              </CardContent>
            </Card>
          )}

          {!isLoading && !error && displayNodes && displayNodes.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Network className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-sm text-muted-foreground">
                  {searchQuery.length >= 2
                    ? 'No nodes match your search'
                    : 'No nodes in this category yet'}
                </p>
              </CardContent>
            </Card>
          )}

          {!isLoading &&
            !error &&
            displayNodes &&
            displayNodes.length > 0 &&
            (viewMode === 'grid' ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {displayNodes.map((node) => (
                  <NodeCard
                    key={node.uri}
                    node={graphNodeToCardData(node)}
                    onClick={() => handleNodeClick(node)}
                    showSubkind={searchQuery.length >= 2}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {displayNodes.map((node) => (
                  <NodeCard
                    key={node.uri}
                    node={graphNodeToCardData(node)}
                    onClick={() => handleNodeClick(node)}
                    showSubkind={searchQuery.length >= 2}
                    compact
                  />
                ))}
              </div>
            ))}
        </div>
      </div>

      <NodeDetailModal
        node={modalNode}
        open={!!modalNode}
        onOpenChange={(open) => {
          if (!open) setModalNode(null);
        }}
      />
    </div>
  );
}

/**
 * Skeleton for KnowledgeGraphViewer.
 */
export function KnowledgeGraphViewerSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-1 h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-9 w-9" />
        </div>
      </div>
      <div className="flex flex-col gap-4 sm:flex-row">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <Skeleton className="h-[450px]" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    </div>
  );
}
