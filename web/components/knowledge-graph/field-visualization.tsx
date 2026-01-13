'use client';

/**
 * Interactive field visualization using React Flow.
 *
 * @remarks
 * Renders the knowledge graph field hierarchy as an interactive node graph.
 * Supports zooming, panning, and clicking nodes to navigate.
 *
 * @example
 * ```tsx
 * <FieldVisualization fieldId="computer-science" depth={2} />
 * ```
 *
 * @packageDocumentation
 */

import { useCallback, useMemo } from 'react';
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

import { useField } from '@/lib/hooks/use-field';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { FieldChild, FieldRelationship } from '@/lib/api/schema';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for FieldVisualization.
 */
export interface FieldVisualizationProps {
  /** Field ID to visualize */
  fieldId: string;
  /** Depth of relationships to show */
  depth?: number;
  /** Height of the visualization */
  height?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Field node data.
 *
 * @remarks
 * Index signature required for React Flow Node type compatibility.
 */
interface FieldNodeData {
  [key: string]: unknown; // Required for React Flow compatibility
  label: string;
  type: 'root' | 'field' | 'subfield' | 'topic';
  status: string;
  eprintCount?: number;
  isCurrent?: boolean;
}

// =============================================================================
// CUSTOM NODE COMPONENT
// =============================================================================

/**
 * Custom node component for field visualization.
 */
function FieldNode({ data }: { data: FieldNodeData }) {
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'root':
        return 'bg-primary text-primary-foreground';
      case 'field':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200';
      case 'subfield':
        return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200';
      case 'topic':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div
      className={cn(
        'px-4 py-3 rounded-lg border-2 shadow-sm min-w-[150px] max-w-[250px]',
        'transition-all duration-200 hover:shadow-md',
        data.isCurrent ? 'border-primary ring-2 ring-primary/20' : 'border-border',
        getTypeColor(data.type)
      )}
    >
      <div className="font-medium text-sm truncate">{data.label}</div>
      <div className="flex items-center gap-2 mt-1">
        <Badge variant="outline" className="text-xs capitalize">
          {data.type}
        </Badge>
        {data.eprintCount !== undefined && (
          <span className="text-xs opacity-75">{data.eprintCount} papers</span>
        )}
      </div>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  field: FieldNode,
};

// =============================================================================
// LAYOUT UTILS
// =============================================================================

/**
 * Simple tree layout algorithm.
 */
function layoutNodes(centerField: {
  id: string;
  name: string;
  type: string;
  status: string;
  eprintCount?: number;
  parent?: { id: string; name: string };
  children?: Array<{ id: string; name: string; type: string; eprintCount?: number }>;
  relationships?: Array<{
    targetId: string;
    targetName: string;
    type: 'broader' | 'narrower' | 'related';
  }>;
}): { nodes: Node<FieldNodeData>[]; edges: Edge[] } {
  const nodes: Node<FieldNodeData>[] = [];
  const edges: Edge[] = [];

  const nodeHeight = 80;
  const horizontalSpacing = 250;
  const verticalSpacing = 120;

  // Center node
  nodes.push({
    id: centerField.id,
    type: 'field',
    position: { x: 0, y: 0 },
    data: {
      label: centerField.name,
      type: centerField.type as FieldNodeData['type'],
      status: centerField.status,
      eprintCount: centerField.eprintCount,
      isCurrent: true,
    },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  });

  // Parent node (above)
  if (centerField.parent) {
    nodes.push({
      id: centerField.parent.id,
      type: 'field',
      position: { x: 0, y: -verticalSpacing },
      data: {
        label: centerField.parent.name,
        type: 'field',
        status: 'approved',
      },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    });

    edges.push({
      id: `${centerField.parent.id}-${centerField.id}`,
      source: centerField.parent.id,
      target: centerField.id,
      type: 'smoothstep',
      animated: false,
      style: { stroke: 'var(--primary)' },
      markerEnd: { type: MarkerType.ArrowClosed },
    });
  }

  // Children (below)
  if (centerField.children && centerField.children.length > 0) {
    const childCount = centerField.children.length;
    const startX = -((childCount - 1) * horizontalSpacing) / 2;

    centerField.children.forEach((child, index) => {
      const x = startX + index * horizontalSpacing;

      nodes.push({
        id: child.id,
        type: 'field',
        position: { x, y: verticalSpacing },
        data: {
          label: child.name,
          type: (child.type as FieldNodeData['type']) || 'subfield',
          status: 'approved',
          eprintCount: child.eprintCount,
        },
        sourcePosition: Position.Top,
        targetPosition: Position.Bottom,
      });

      edges.push({
        id: `${centerField.id}-${child.id}`,
        source: centerField.id,
        target: child.id,
        type: 'smoothstep',
        animated: false,
        style: { stroke: 'var(--muted-foreground)' },
        markerEnd: { type: MarkerType.ArrowClosed },
      });
    });
  }

  // Related fields (to the side)
  if (centerField.relationships) {
    const relatedFields = centerField.relationships.filter((r) => r.type === 'related');
    relatedFields.forEach((rel, index) => {
      const y = -verticalSpacing / 2 + index * (nodeHeight + 20);

      nodes.push({
        id: rel.targetId,
        type: 'field',
        position: { x: horizontalSpacing + 50, y },
        data: {
          label: rel.targetName,
          type: 'field',
          status: 'approved',
        },
        sourcePosition: Position.Left,
        targetPosition: Position.Right,
      });

      edges.push({
        id: `${centerField.id}-${rel.targetId}-related`,
        source: centerField.id,
        target: rel.targetId,
        type: 'smoothstep',
        animated: true,
        style: { stroke: 'var(--muted-foreground)', strokeDasharray: '5 5' },
        label: 'related',
        labelStyle: { fontSize: 10 },
      });
    });
  }

  return { nodes, edges };
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Interactive field visualization component.
 *
 * @param props - Component props
 * @returns React Flow visualization element
 */
export function FieldVisualization({
  fieldId,
  depth: _depth = 1,
  height = '500px',
  className,
}: FieldVisualizationProps) {
  const router = useRouter();
  const {
    data: field,
    isLoading,
    error,
  } = useField(fieldId, {
    includeRelationships: true,
    includeChildren: true,
    includeAncestors: true,
  });

  const { initialNodes, initialEdges } = useMemo(() => {
    if (!field) return { initialNodes: [], initialEdges: [] };

    // Determine field type from hierarchy position (FieldDetail doesn't have a type property)
    const fieldType = field.ancestors && field.ancestors.length > 0 ? 'subfield' : 'field';

    const { nodes, edges } = layoutNodes({
      id: field.id,
      name: field.name,
      type: fieldType,
      status: field.status,
      eprintCount: field.eprintCount,
      parent: field.ancestors?.[0]
        ? { id: field.ancestors[0].id, name: field.ancestors[0].name }
        : undefined,
      children: field.children?.map((child: FieldChild) => ({
        id: child.id,
        name: child.name,
        type: 'subfield' as const,
        eprintCount: child.eprintCount,
      })),
      relationships: field.relationships
        ?.filter(
          (
            r: FieldRelationship
          ): r is FieldRelationship & { type: 'broader' | 'narrower' | 'related' } =>
            r.type === 'broader' || r.type === 'narrower' || r.type === 'related'
        )
        .map((r: FieldRelationship) => ({
          targetId: r.targetId,
          targetName: r.targetName,
          type: r.type,
        })),
    });

    return { initialNodes: nodes, initialEdges: edges };
  }, [field]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes when field data changes
  useMemo(() => {
    if (initialNodes.length > 0) {
      setNodes(initialNodes);
      setEdges(initialEdges);
    }
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node<FieldNodeData>) => {
      if (node.id !== fieldId) {
        router.push(`/fields/${node.id}`);
      }
    },
    [fieldId, router]
  );

  if (isLoading) {
    return <FieldVisualizationSkeleton height={height} className={className} />;
  }

  if (error || !field) {
    return (
      <div
        className={cn(
          'rounded-lg border border-destructive/50 bg-destructive/5 p-8 text-center',
          className
        )}
      >
        <p className="text-destructive">Failed to load field visualization</p>
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
        fitViewOptions={{ padding: 0.2 }}
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
            if (node.data?.isCurrent) return 'var(--primary)';
            return 'var(--muted-foreground)';
          }}
          maskColor="var(--background)"
          className="!bg-card !border-border"
        />
        <Panel position="top-right" className="flex gap-2">
          <Badge variant="outline" className="bg-card">
            {field.name}
          </Badge>
        </Panel>
      </ReactFlow>
    </div>
  );
}

/**
 * Loading skeleton for field visualization.
 */
export function FieldVisualizationSkeleton({
  height = '500px',
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
