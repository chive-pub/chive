'use client';

/**
 * A paper's place in the Chive citation network.
 *
 * @remarks
 * The view this replaces could only draw a star. It fetched one paper's citing
 * and cited lists, stacked them in two columns, and had no way to show that two
 * of a paper's citers also cite each other -- which is the only thing a network
 * picture is for. Its edges were styled with a CSS variable this application
 * has never defined, so nothing was drawn between the boxes at all: no lines,
 * no arrowheads, no direction.
 *
 * This draws the network. Every citation Chive holds is fetched at once, laid
 * out by simulation so that proximity means something, and coloured by what
 * each paper is to the paper the reader arrived on. Clicking a second paper
 * lights its own neighbourhood in the same three colours a shade paler, so a
 * reader can follow the graph outwards without ever losing the paper they came
 * for.
 *
 * @packageDocumentation
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import Link from 'next/link';
import { ExternalLink, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { forceLayout } from '@/lib/citations/force-layout';
import {
  buildFlowEdges,
  buildFlowNodes,
  neighbourhoodOf,
  NODE_HEIGHT,
  NODE_WIDTH,
  type FlowNodeData,
} from '@/lib/citations/flow-graph';
import {
  assignEdgeRoles,
  assignRoles,
  NETWORK_COLORS,
  roleStyle,
  urisIn,
} from '@/lib/citations/network-model';
import { formatAuthors, papersByUri } from '@/lib/citations/paper-label';
import { cn } from '@/lib/utils';

import { NetworkLegend } from './network-legend';
import { NetworkNode } from './network-node';
import { PaperHoverCard } from './paper-hover-card';
import { useCitationNetwork } from './use-citation-network';

/** Props for {@link CitationNetwork}. */
export interface CitationNetworkProps {
  /** The paper the reader arrived on. */
  readonly eprintUri: string;
  /** Height of the canvas. */
  readonly height?: string;
  readonly className?: string;
}

const nodeTypes: NodeTypes = { paper: NetworkNode };

/**
 * The graph itself.
 *
 * @remarks
 * Split from the exported component because the viewport helpers it uses are
 * only available inside a React Flow provider.
 */
function CitationNetworkCanvas({ eprintUri, height = '70vh', className }: CitationNetworkProps) {
  const { network, isLoading, error } = useCitationNetwork(eprintUri);
  const { setCenter } = useReactFlow();
  const container = useRef<HTMLDivElement>(null);

  const [selectedUri, setSelectedUri] = useState<string | undefined>();
  const [hover, setHover] = useState<{ uri: string; x: number; y: number } | undefined>();

  const papers = useMemo(() => papersByUri(network?.papers), [network]);
  const citations = useMemo(() => network?.citations ?? [], [network]);
  const focusUri = network?.focusUri ?? eprintUri;

  // Laid out once per network. The roles below change as the reader clicks
  // around; the positions must not, or the graph would rearrange itself under
  // the cursor every time they selected something.
  const positions = useMemo(() => {
    const uris = urisIn(citations, focusUri);
    return forceLayout(
      uris.map((uri) => ({ id: uri })),
      citations.map((citation) => ({ source: citation.citingUri, target: citation.citedUri })),
      { centerOn: focusUri }
    );
  }, [citations, focusUri]);

  const roles = useMemo(
    () => assignRoles(urisIn(citations, focusUri), citations, { focusUri, selectedUri }),
    [citations, focusUri, selectedUri]
  );

  const edgeRoles = useMemo(
    () => assignEdgeRoles(citations, { focusUri, selectedUri }),
    [citations, focusUri, selectedUri]
  );

  const flowNodes = useMemo(
    () => buildFlowNodes(positions, papers, roles),
    [positions, papers, roles]
  );

  const flowEdges = useMemo(() => buildFlowEdges(citations, edgeRoles), [citations, edgeRoles]);

  const [nodes, , onNodesChange] = useNodesState<Node<FlowNodeData>>([]);
  const [edges, , onEdgesChange] = useEdgesState<Edge>([]);

  // React Flow keeps its own copy of the nodes so it can move them; these are
  // derived, so they are handed over on every change rather than merged.
  const nodesToRender = flowNodes.length > 0 ? flowNodes : nodes;
  const edgesToRender = flowEdges.length > 0 ? flowEdges : edges;

  const focusNeighbourhood = useMemo(
    () => neighbourhoodOf(focusUri, citations),
    [citations, focusUri]
  );

  // Framed from the positions this component computed, not from what React
  // Flow has measured. `fitView` needs every node's rendered size, which is not
  // known on the first paint, and a fit against unmeasured nodes lands the
  // viewport near the network rather than on it. The layout is already in hand,
  // so the arithmetic is done here and the answer is exact from the first frame.
  const frameFocus = useCallback(
    (duration: number) => {
      const points = focusNeighbourhood
        .map((id) => positions.get(id))
        .filter((point): point is { x: number; y: number } => point !== undefined);
      if (points.length === 0) return;

      const xs = points.map((point) => point.x);
      const ys = points.map((point) => point.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      const width = container.current?.clientWidth ?? 800;
      const height = container.current?.clientHeight ?? 600;
      // Pad by roughly a node, so the outermost papers are not clipped.
      const zoom = Math.min(
        Math.max(Math.min(width / (maxX - minX + 340), height / (maxY - minY + 180)), 0.25),
        1.4
      );

      // Positions are node top-left corners, so the visual centre of the
      // neighbourhood is half a node further along each axis.
      setCenter((minX + maxX) / 2 + NODE_WIDTH / 2, (minY + maxY) / 2 + NODE_HEIGHT / 2, {
        zoom,
        duration,
      });
    },
    [focusNeighbourhood, positions, setCenter]
  );

  // Open on the paper the reader came from and what touches it, not on the
  // whole network -- which, fitted to the viewport, is a field of unreadable
  // dots they then have to search for their own paper in.
  // Deliberately on `onInit` rather than in an effect. React Flow computes the
  // transform for `setCenter` from its own viewport size, and an effect fires
  // before that size is known -- which centred the network against a viewport
  // of zero and left the neighbourhood in the corner.
  const hasFramed = useRef(false);
  const onInit = useCallback(() => {
    if (hasFramed.current) return;
    hasFramed.current = true;
    requestAnimationFrame(() => {
      frameFocus(0);
    });
  }, [frameFocus]);

  const showFocus = useCallback(() => {
    frameFocus(400);
  }, [frameFocus]);

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node<FlowNodeData>) => {
    // Clicking selects rather than navigates. The graph is the thing being
    // read; leaving it on every click made it a list of links with positions.
    setSelectedUri((current) => (current === node.id ? undefined : node.id));
  }, []);

  const onNodeMouseEnter = useCallback((event: React.MouseEvent, node: Node<FlowNodeData>) => {
    const bounds = container.current?.getBoundingClientRect();
    if (!bounds) return;
    setHover({ uri: node.id, x: event.clientX - bounds.left, y: event.clientY - bounds.top });
  }, []);

  const onNodeMouseLeave = useCallback(() => {
    setHover(undefined);
  }, []);

  if (isLoading) {
    return <CitationNetworkSkeleton height={height} className={className} />;
  }

  if (error) {
    return (
      <div
        className={cn(
          'rounded-lg border border-destructive/50 bg-destructive/5 p-8 text-center',
          className
        )}
      >
        <p className="text-destructive">The citation network could not be loaded.</p>
      </div>
    );
  }

  if (!network || network.citations.length === 0) {
    return (
      <div className={cn('rounded-lg border bg-muted/50 p-8 text-center', className)}>
        <p className="text-muted-foreground">
          Nothing in Chive cites this paper yet, and none of its references have been matched to a
          paper Chive holds.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          The network draws citations where both papers are indexed here, so it fills in as more of
          the literature arrives.
        </p>
      </div>
    );
  }

  const hovered = hover ? papers.get(hover.uri) : undefined;
  const selected = selectedUri ? papers.get(selectedUri) : undefined;

  return (
    <div
      ref={container}
      className={cn('relative overflow-hidden rounded-lg border bg-card', className)}
      style={{ height }}
    >
      <ReactFlow
        nodes={nodesToRender}
        edges={edgesToRender}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        onInit={onInit}
        nodeTypes={nodeTypes}
        // Zooming out to the whole network is the point, so let it go far.
        minZoom={0.05}
        maxZoom={2.5}
        nodesDraggable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor={(node) => {
            const role = (node.data as FlowNodeData | undefined)?.role;
            return role ? roleStyle(role).stroke : NETWORK_COLORS.none;
          }}
          nodeStrokeWidth={3}
          // A node whose size React Flow has not measured yet draws as nothing,
          // which left the minimap an empty grey rectangle. Giving it a floor
          // means every paper appears the moment the graph does.
          nodeBorderRadius={8}
          className="!border-border !bg-card"
        />

        <Panel position="top-left">
          <NetworkLegend hasSelection={Boolean(selectedUri && selectedUri !== focusUri)} />
        </Panel>

        <Panel position="top-right" className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="bg-card">
            {network.papers.length} papers
          </Badge>
          <Badge variant="outline" className="bg-card">
            {network.citations.length} citations
          </Badge>
          {network.truncated && (
            <Badge
              variant="secondary"
              className="bg-card"
              title={`${String(network.totalCitations)} in the whole network`}
            >
              showing part
            </Badge>
          )}
          <Button variant="outline" size="sm" className="h-7 bg-card text-xs" onClick={showFocus}>
            Back to this paper
          </Button>
        </Panel>

        {selected && selectedUri !== focusUri && (
          <Panel position="bottom-center" className="max-w-[min(32rem,calc(100vw-3rem))]">
            <div className="flex items-start gap-3 rounded-lg border bg-card/95 p-3 shadow-lg backdrop-blur">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-snug">{selected.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {[formatAuthors(selected.authors), selected.year].filter(Boolean).join(' · ')}
                </p>
                <Link
                  href={`/eprints/${encodeURIComponent(selected.uri)}`}
                  className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Open this paper
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                aria-label="Clear selection"
                onClick={() => {
                  setSelectedUri(undefined);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </Panel>
        )}
      </ReactFlow>

      {hover && hovered && (
        <PaperHoverCard
          paper={hovered}
          role={roles.get(hover.uri) ?? { relation: 'none', tier: 'none' }}
          at={{ x: hover.x, y: hover.y }}
          width={container.current?.clientWidth ?? 0}
        />
      )}
    </div>
  );
}

/**
 * A paper's place in the citation network.
 *
 * @param props - Component props
 * @returns The graph
 *
 * @public
 */
export function CitationNetwork(props: CitationNetworkProps) {
  return (
    <ReactFlowProvider>
      <CitationNetworkCanvas {...props} />
    </ReactFlowProvider>
  );
}

/**
 * Placeholder while the network loads.
 *
 * @param props - Height and class
 * @returns The placeholder
 *
 * @public
 */
export function CitationNetworkSkeleton({
  height = '70vh',
  className,
}: {
  height?: string;
  className?: string;
}) {
  return (
    <div className={cn('rounded-lg border bg-card', className)} style={{ height }}>
      <div className="flex h-full items-center justify-center">
        <div className="space-y-4 text-center">
          <Skeleton className="mx-auto h-6 w-40 rounded-full" />
          <div className="flex justify-center gap-3">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-28 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <Skeleton className="mx-auto h-6 w-32 rounded-full" />
        </div>
      </div>
    </div>
  );
}
