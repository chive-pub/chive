'use client';

/**
 * A citation drawn between the outlines of the two papers.
 *
 * @remarks
 * React Flow's built-in edges run between handles, and a handle is fixed to one
 * side of its node. With a target handle at the top, every edge arrived at the
 * top of the cited paper -- so an edge whose target sat above its source ran up
 * through the target's body, crossing the pill and leaving the arrowhead inside
 * it. A citation network has no top or bottom; an edge should meet each paper
 * wherever its outline faces the other one.
 *
 * @packageDocumentation
 */

import { getStraightPath, useInternalNode, type EdgeProps } from '@xyflow/react';

import { floatingEnds, type NodeBox } from '@/lib/citations/edge-geometry';

/**
 * Reads a node's drawn box out of React Flow's internal state.
 *
 * @param node - The internal node, when React Flow has one
 * @returns Its position and measured size, or null before it is measured
 *
 * @remarks
 * `measured` is what the node actually occupies, which is what the geometry
 * needs: a background paper is drawn as a small circle and a highlighted one as
 * a labelled pill, and an edge has to meet each at its own outline.
 */
function boxOf(node: ReturnType<typeof useInternalNode>): NodeBox | null {
  if (!node) return null;
  const width = node.measured?.width ?? node.width;
  const height = node.measured?.height ?? node.height;
  if (width === undefined || height === undefined) return null;
  return {
    x: node.internals.positionAbsolute.x,
    y: node.internals.positionAbsolute.y,
    width,
    height,
  };
}

/**
 * Renders one citation.
 *
 * @param props - React Flow edge props
 * @returns The path, or nothing until both ends have been measured
 *
 * @public
 */
export function FloatingEdge({ id, source, target, markerEnd, style }: EdgeProps) {
  const sourceBox = boxOf(useInternalNode(source));
  const targetBox = boxOf(useInternalNode(target));

  if (!sourceBox || !targetBox) return null;

  const ends = floatingEnds(sourceBox, targetBox);
  const [path] = getStraightPath(ends);

  return (
    <path
      id={id}
      d={path}
      className="react-flow__edge-path"
      markerEnd={markerEnd}
      style={style}
      fill="none"
    />
  );
}
