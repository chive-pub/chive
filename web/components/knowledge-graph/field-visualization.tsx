'use client';

/**
 * Interactive field visualization using React Flow.
 *
 * @remarks
 * Renders the knowledge graph field as a simple node display.
 * A more complete implementation would fetch edges and related nodes.
 *
 * @example
 * ```tsx
 * <FieldVisualization fieldId="computer-science" />
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
  Position,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useRouter } from 'next/navigation';

import { useField } from '@/lib/hooks/use-field';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for FieldVisualization.
 */
export interface FieldVisualizationProps {
  /** Field ID to visualize */
  fieldId: string;
  /** Depth of hierarchy to display */
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
  type: 'root' | 'field' | 'subfield';
  status: string;
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
          {data.status}
        </Badge>
      </div>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  field: FieldNode,
};

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
  height = '500px',
  className,
}: FieldVisualizationProps) {
  const router = useRouter();
  const { data: field, isLoading, error } = useField(fieldId);

  const { initialNodes, initialEdges } = useMemo(() => {
    if (!field) return { initialNodes: [], initialEdges: [] };

    // Create a simple single-node visualization
    // A more complete implementation would fetch edges and related nodes
    const nodes: Node<FieldNodeData>[] = [
      {
        id: field.id,
        type: 'field',
        position: { x: 0, y: 0 },
        data: {
          label: field.label,
          type: 'field',
          status: field.status,
          isCurrent: true,
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      },
    ];

    const edges: Edge[] = [];

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
            {field.label}
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
