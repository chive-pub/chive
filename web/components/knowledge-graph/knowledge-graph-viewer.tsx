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
import {
  Network,
  Search,
  Layers,
  Building2,
  User,
  Tag,
  FileType,
  Scale,
  Award,
  Clock,
  ExternalLink,
  ChevronRight,
  Filter,
  Grid3X3,
  List,
} from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
 * Node from the knowledge graph.
 */
export interface GraphNode {
  uri: string;
  id: string;
  label: string;
  alternateLabels?: string[];
  description?: string;
  kind: NodeKind;
  subkind: string;
  status: NodeStatus;
  externalIds?: ExternalId[];
  createdAt: string;
}

/**
 * Edge in the knowledge graph.
 */
export interface GraphEdge {
  uri: string;
  sourceUri: string;
  targetUri: string;
  relationSlug: string;
  status: string;
}

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

  /** Show edge relationships */
  showEdges?: boolean;

  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// SUBKIND CONFIGURATION
// =============================================================================

interface SubkindConfig {
  slug: string;
  kind: NodeKind;
  label: string;
  icon: typeof Network;
  description: string;
}

const SUBKIND_CONFIGS: SubkindConfig[] = [
  // Type nodes
  {
    slug: 'field',
    kind: 'type',
    label: 'Academic Fields',
    icon: Layers,
    description: 'Research disciplines and subject areas',
  },
  {
    slug: 'facet',
    kind: 'type',
    label: 'Facets',
    icon: Tag,
    description: 'Classification dimensions',
  },
  {
    slug: 'contribution-type',
    kind: 'type',
    label: 'Contribution Types',
    icon: Award,
    description: 'CRediT contributor roles',
  },
  {
    slug: 'document-format',
    kind: 'type',
    label: 'Document Formats',
    icon: FileType,
    description: 'File format types',
  },
  {
    slug: 'license',
    kind: 'type',
    label: 'Licenses',
    icon: Scale,
    description: 'Distribution licenses',
  },
  {
    slug: 'publication-status',
    kind: 'type',
    label: 'Publication Statuses',
    icon: Clock,
    description: 'Publication lifecycle stages',
  },
  {
    slug: 'institution-type',
    kind: 'type',
    label: 'Institution Types',
    icon: Building2,
    description: 'Organization classifications',
  },
  {
    slug: 'paper-type',
    kind: 'type',
    label: 'Paper Types',
    icon: FileType,
    description: 'Research document types',
  },
  // Object nodes
  {
    slug: 'institution',
    kind: 'object',
    label: 'Institutions',
    icon: Building2,
    description: 'Research organizations',
  },
  { slug: 'person', kind: 'object', label: 'People', icon: User, description: 'Named individuals' },
  {
    slug: 'event',
    kind: 'object',
    label: 'Events',
    icon: Clock,
    description: 'Conferences and workshops',
  },
];

const SUBKIND_BY_SLUG = new Map(SUBKIND_CONFIGS.map((c) => [c.slug, c]));

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

async function fetchEdges(nodeUri: string): Promise<GraphEdge[]> {
  const params = new URLSearchParams({ sourceUri: nodeUri });
  const response = await fetch(`/xrpc/pub.chive.graph.listEdges?${params.toString()}`);

  if (!response.ok) return [];

  const data = (await response.json()) as { edges: GraphEdge[] };
  return data.edges ?? [];
}

// =============================================================================
// NODE CARD
// =============================================================================

interface NodeCardProps {
  node: GraphNode;
  onClick?: () => void;
  showSubkind?: boolean;
  compact?: boolean;
}

function NodeCard({ node, onClick, showSubkind = false, compact = false }: NodeCardProps) {
  const config = SUBKIND_BY_SLUG.get(node.subkind);
  const Icon = config?.icon ?? Network;

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

  if (compact) {
    return (
      <button
        onClick={onClick}
        className="flex items-center gap-2 rounded-lg border p-2 text-left transition-colors hover:bg-muted/50 w-full"
      >
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate font-medium text-sm">{node.label}</span>
        <Badge variant="secondary" className={cn('text-[10px]', getStatusColor(node.status))}>
          {node.status}
        </Badge>
      </button>
    );
  }

  return (
    <Card
      className={cn(
        'transition-colors cursor-pointer hover:border-primary/50',
        onClick && 'hover:shadow-sm'
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">{node.label}</CardTitle>
          </div>
          <div className="flex items-center gap-1">
            {showSubkind && config && (
              <Badge variant="outline" className="text-[10px]">
                {config.label}
              </Badge>
            )}
            <Badge variant="secondary" className={cn('text-[10px]', getStatusColor(node.status))}>
              {node.status}
            </Badge>
          </div>
        </div>
        {node.description && (
          <CardDescription className="line-clamp-2">{node.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap items-center gap-2">
          {node.alternateLabels && node.alternateLabels.length > 0 && (
            <span className="text-xs text-muted-foreground">
              Also: {node.alternateLabels.slice(0, 3).join(', ')}
              {node.alternateLabels.length > 3 && '...'}
            </span>
          )}
          {node.externalIds && node.externalIds.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <ExternalLink className="h-3 w-3" />
              <span>
                {node.externalIds.length} external ID{node.externalIds.length > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
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
  onNodeSelect,
  showEdges = true,
  className,
}: KnowledgeGraphViewerProps) {
  const [activeSubkind, setActiveSubkind] = useState(initialSubkind);
  const [kindFilter, setKindFilter] = useState<NodeKind | 'all'>(initialKind ?? 'all');
  const [statusFilter, setStatusFilter] = useState<NodeStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

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

  // Fetch edges for selected node
  const { data: nodeEdges } = useQuery({
    queryKey: ['edges', 'list', selectedNode?.uri],
    queryFn: () => (selectedNode ? fetchEdges(selectedNode.uri) : Promise.resolve([])),
    enabled: !!selectedNode && showEdges,
    staleTime: 5 * 60 * 1000,
  });

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      setSelectedNode(node);
      onNodeSelect?.(node);
    },
    [onNodeSelect]
  );

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
                    node={node}
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
                    node={node}
                    onClick={() => handleNodeClick(node)}
                    showSubkind={searchQuery.length >= 2}
                    compact
                  />
                ))}
              </div>
            ))}
        </div>
      </div>

      {/* Selected node detail panel */}
      {selectedNode && showEdges && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <ChevronRight className="h-5 w-5" />
                {selectedNode.label}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setSelectedNode(null)}>
                Close
              </Button>
            </div>
            {selectedNode.description && (
              <CardDescription>{selectedNode.description}</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* External IDs */}
              {selectedNode.externalIds && selectedNode.externalIds.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">External Identifiers</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedNode.externalIds.map((ext, i) => (
                      <Badge key={i} variant="outline">
                        {ext.system}: {ext.identifier}
                        {ext.uri && (
                          <a
                            href={ext.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-1 text-primary"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="h-3 w-3 inline" />
                          </a>
                        )}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Edges */}
              {nodeEdges && nodeEdges.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Relationships</h4>
                  <div className="space-y-1">
                    {nodeEdges.map((edge, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <Badge variant="outline" className="text-[10px]">
                          {edge.relationSlug}
                        </Badge>
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground truncate">{edge.targetUri}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
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
