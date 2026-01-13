'use client';

/**
 * Interactive citation network visualization using React Flow.
 *
 * @remarks
 * Renders citation relationships for a eprint as an interactive node graph.
 * Shows papers that cite this eprint and papers this eprint references.
 *
 * @example
 * ```tsx
 * <CitationVisualization eprintUri="at://did:plc:.../pub.chive.eprint.submission/abc" />
 * ```
 *
 * @packageDocumentation
 */

import { useCallback, useMemo, useEffect, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes,
  MarkerType,
  Position,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useRouter } from 'next/navigation';

import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for CitationVisualization.
 */
export interface CitationVisualizationProps {
  /** Eprint URI to visualize citations for */
  eprintUri: string;
  /** Height of the visualization */
  height?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Citation node data.
 */
interface CitationNodeData {
  [key: string]: unknown;
  label: string;
  type: 'center' | 'citing' | 'reference';
  isInfluential?: boolean;
  uri: string;
}

/**
 * Citation data from API.
 */
interface CitationData {
  eprint: {
    uri: string;
    title: string;
  };
  counts: {
    citedByCount: number;
    referencesCount: number;
    influentialCitedByCount: number;
  };
  citations: Array<{
    citingUri: string;
    citedUri: string;
    isInfluential?: boolean;
  }>;
}

// =============================================================================
// CUSTOM NODE COMPONENT
// =============================================================================

/**
 * Custom node component for citation visualization.
 */
function CitationNode({ data }: { data: CitationNodeData }) {
  const getTypeColor = (type: string, isInfluential?: boolean) => {
    if (type === 'center') {
      return 'bg-primary text-primary-foreground border-primary';
    }
    if (isInfluential) {
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 border-amber-500';
    }
    if (type === 'citing') {
      return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200 border-green-500';
    }
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 border-blue-500';
  };

  return (
    <div
      className={cn(
        'px-4 py-3 rounded-lg border-2 shadow-sm min-w-[150px] max-w-[250px]',
        'transition-all duration-200 hover:shadow-md cursor-pointer',
        getTypeColor(data.type, data.isInfluential)
      )}
    >
      <div className="font-medium text-sm truncate">{data.label}</div>
      <div className="flex items-center gap-2 mt-1">
        <Badge variant="outline" className="text-xs capitalize">
          {data.type === 'center'
            ? 'this paper'
            : data.type === 'citing'
              ? 'cites this'
              : 'referenced'}
        </Badge>
        {data.isInfluential && (
          <Badge variant="secondary" className="text-xs">
            influential
          </Badge>
        )}
      </div>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  citation: CitationNode,
};

// =============================================================================
// LAYOUT UTILS
// =============================================================================

/**
 * Layout citation nodes in a radial pattern.
 */
function layoutCitationNodes(
  centerEprint: { uri: string; title: string },
  citations: CitationData['citations'],
  counts: CitationData['counts']
): { nodes: Node<CitationNodeData>[]; edges: Edge[] } {
  const nodes: Node<CitationNodeData>[] = [];
  const edges: Edge[] = [];

  const horizontalSpacing = 300;
  const verticalSpacing = 100;

  // Center node
  nodes.push({
    id: centerEprint.uri,
    type: 'citation',
    position: { x: 0, y: 0 },
    data: {
      label:
        centerEprint.title.length > 50
          ? centerEprint.title.substring(0, 50) + '...'
          : centerEprint.title,
      type: 'center',
      uri: centerEprint.uri,
    },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  });

  // Split citations into citing and referenced
  const citingPapers = citations.filter((c) => c.citedUri === centerEprint.uri);
  const referencedPapers = citations.filter((c) => c.citingUri === centerEprint.uri);

  // Layout citing papers (left side - papers that cite this one)
  citingPapers.slice(0, 10).forEach((citation, index) => {
    const y = -((citingPapers.length - 1) * verticalSpacing) / 2 + index * verticalSpacing;
    const nodeId = citation.citingUri;

    nodes.push({
      id: nodeId,
      type: 'citation',
      position: { x: -horizontalSpacing, y },
      data: {
        label: `Citing paper ${index + 1}`,
        type: 'citing',
        isInfluential: citation.isInfluential,
        uri: citation.citingUri,
      },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    });

    edges.push({
      id: `${nodeId}-${centerEprint.uri}`,
      source: nodeId,
      target: centerEprint.uri,
      type: 'smoothstep',
      animated: citation.isInfluential,
      style: {
        stroke: citation.isInfluential ? 'var(--amber-500)' : 'var(--green-500)',
        strokeWidth: citation.isInfluential ? 2 : 1,
      },
      markerEnd: { type: MarkerType.ArrowClosed },
    });
  });

  // Layout referenced papers (right side - papers this one cites)
  referencedPapers.slice(0, 10).forEach((citation, index) => {
    const y = -((referencedPapers.length - 1) * verticalSpacing) / 2 + index * verticalSpacing;
    const nodeId = citation.citedUri;

    nodes.push({
      id: nodeId,
      type: 'citation',
      position: { x: horizontalSpacing, y },
      data: {
        label: `Reference ${index + 1}`,
        type: 'reference',
        isInfluential: citation.isInfluential,
        uri: citation.citedUri,
      },
      sourcePosition: Position.Left,
      targetPosition: Position.Right,
    });

    edges.push({
      id: `${centerEprint.uri}-${nodeId}`,
      source: centerEprint.uri,
      target: nodeId,
      type: 'smoothstep',
      animated: false,
      style: { stroke: 'var(--blue-500)' },
      markerEnd: { type: MarkerType.ArrowClosed },
    });
  });

  return { nodes, edges };
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Hook to fetch citation data.
 */
function useCitations(eprintUri: string) {
  const [data, setData] = useState<CitationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchCitations() {
      try {
        setIsLoading(true);
        const response = await fetch(
          `/xrpc/pub.chive.discovery.getCitations?uri=${encodeURIComponent(eprintUri)}&direction=both&limit=20`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch citations');
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setIsLoading(false);
      }
    }

    fetchCitations();
  }, [eprintUri]);

  return { data, isLoading, error };
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Interactive citation network visualization.
 *
 * @param props - Component props
 * @returns React Flow visualization element
 */
export function CitationVisualization({
  eprintUri,
  height = '400px',
  className,
}: CitationVisualizationProps) {
  const router = useRouter();
  const { data, isLoading, error } = useCitations(eprintUri);

  const { initialNodes, initialEdges } = useMemo(() => {
    if (!data) return { initialNodes: [], initialEdges: [] };

    const { nodes, edges } = layoutCitationNodes(data.eprint, data.citations, data.counts);

    return { initialNodes: nodes, initialEdges: edges };
  }, [data]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes when data changes
  useEffect(() => {
    if (initialNodes.length > 0) {
      setNodes(initialNodes);
      setEdges(initialEdges);
    }
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node<CitationNodeData>) => {
      if (node.id !== eprintUri && node.data.uri) {
        // Navigate to the clicked eprint
        const rkey = node.data.uri.split('/').pop();
        if (rkey) {
          router.push(`/eprints/${encodeURIComponent(node.data.uri)}`);
        }
      }
    },
    [eprintUri, router]
  );

  if (isLoading) {
    return <CitationVisualizationSkeleton height={height} className={className} />;
  }

  if (error || !data) {
    return (
      <div
        className={cn(
          'rounded-lg border border-destructive/50 bg-destructive/5 p-8 text-center',
          className
        )}
      >
        <p className="text-destructive">Failed to load citation network</p>
      </div>
    );
  }

  if (data.citations.length === 0) {
    return (
      <div className={cn('rounded-lg border bg-muted/50 p-8 text-center', className)}>
        <p className="text-muted-foreground">No citation relationships found yet</p>
      </div>
    );
  }

  return (
    <div className={cn('rounded-lg border bg-card', className)} style={{ height }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.5}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'smoothstep',
        }}
      >
        <Background color="var(--muted)" gap={16} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(node) => {
            if (node.data?.type === 'center') return 'var(--primary)';
            if (node.data?.isInfluential) return 'var(--amber-500)';
            if (node.data?.type === 'citing') return 'var(--green-500)';
            return 'var(--blue-500)';
          }}
          maskColor="var(--background)"
          className="!bg-card !border-border"
        />
        <Panel position="top-right" className="flex gap-2">
          <Badge variant="outline" className="bg-card">
            {data.counts.citedByCount} citing
          </Badge>
          <Badge variant="outline" className="bg-card">
            {data.counts.referencesCount} references
          </Badge>
          {data.counts.influentialCitedByCount > 0 && (
            <Badge variant="secondary" className="bg-card">
              {data.counts.influentialCitedByCount} influential
            </Badge>
          )}
        </Panel>
      </ReactFlow>
    </div>
  );
}

/**
 * Loading skeleton for citation visualization.
 */
export function CitationVisualizationSkeleton({
  height = '400px',
  className,
}: {
  height?: string;
  className?: string;
}) {
  return (
    <div className={cn('rounded-lg border bg-card', className)} style={{ height }}>
      <div className="flex items-center justify-center h-full">
        <div className="space-y-4 text-center">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-4 w-32 mx-auto" />
          <div className="flex gap-4 justify-center mt-8">
            <Skeleton className="h-16 w-32 rounded-lg" />
            <Skeleton className="h-16 w-32 rounded-lg" />
            <Skeleton className="h-16 w-32 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
