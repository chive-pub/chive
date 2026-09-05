'use client';

/**
 * One paper in the citation network.
 *
 * @remarks
 * A node names its paper the way a reader would refer to it in conversation --
 * a surname and a year -- and nothing else. The previous view gave every node a
 * truncated title and two badges, which is why it could show four papers and
 * not four hundred; the rest of what is known about a paper lives on the hover
 * card, where it costs nothing until asked for.
 *
 * @packageDocumentation
 */

import { Handle, Position } from '@xyflow/react';

import { NODE_HEIGHT, NODE_WIDTH, type FlowNodeData } from '@/lib/citations/flow-graph';
import { roleStyle } from '@/lib/citations/network-model';

export type { FlowNodeData as NetworkNodeData };

/**
 * Renders one paper.
 *
 * @param props - React Flow node props
 * @returns The node
 *
 * @public
 */
export function NetworkNode({ data, selected }: { data: FlowNodeData; selected?: boolean }) {
  const style = roleStyle(data.role);
  const isAnchor = data.role.relation === 'anchor' && data.role.tier !== 'none';

  return (
    <div
      data-testid="network-node"
      data-relation={data.role.relation}
      data-tier={data.role.tier}
      className="cursor-pointer overflow-hidden rounded-full border px-3 text-center text-xs font-medium leading-[26px] transition-transform hover:scale-105"
      style={{
        background: style.fill,
        borderColor: style.stroke,
        color: style.text,
        opacity: style.opacity,
        borderWidth: isAnchor ? 2 : 1,
        boxShadow: selected ? `0 0 0 3px ${style.stroke}55` : undefined,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      }}
      title={data.label}
    >
      {/* React Flow needs a source and a target for an edge to attach to. They
          are drawn at zero size: a citation network has no natural direction on
          the page, so an edge should leave a node from wherever the other end
          happens to be rather than from a fixed side. */}
      <Handle type="target" position={Position.Top} style={{ opacity: 0, width: 1, height: 1 }} />
      <span className="block truncate">{data.label}</span>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0, width: 1, height: 1 }}
      />
    </div>
  );
}
