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

import { DOT_SIZE, NODE_HEIGHT, NODE_WIDTH, type FlowNodeData } from '@/lib/citations/flow-graph';
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
  const labelled = data.role.tier !== 'none';

  // React Flow needs a source and a target for an edge to attach to. They are
  // drawn at zero size and their position is immaterial: the edges compute
  // their own endpoints from the node outlines, because a citation network has
  // no direction of flow for a handle to sit on the near side of.
  const handles = (
    <>
      <Handle type="target" position={Position.Top} style={{ opacity: 0, width: 1, height: 1 }} />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0, width: 1, height: 1 }}
      />
    </>
  );

  // A paper more than one citation away from whatever is being read against is
  // drawn as a dot. At a few hundred papers the labels are the clutter, and the
  // ones worth reading are the ones beside the paper in hand; the rest are the
  // shape of the field, which a dot conveys and a name obscures. Hovering still
  // names it.
  if (!labelled) {
    return (
      <div
        data-testid="network-node"
        data-relation={data.role.relation}
        data-tier={data.role.tier}
        data-labelled="false"
        className="cursor-pointer rounded-full border transition-transform hover:scale-150"
        style={{
          background: style.fill,
          borderColor: style.stroke,
          opacity: style.opacity,
          width: DOT_SIZE,
          height: DOT_SIZE,
        }}
        title={data.label}
        aria-label={data.label}
      >
        {handles}
      </div>
    );
  }

  return (
    <div
      data-testid="network-node"
      data-relation={data.role.relation}
      data-tier={data.role.tier}
      data-labelled="true"
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
      {handles}
      <span className="block truncate">{data.label}</span>
    </div>
  );
}
