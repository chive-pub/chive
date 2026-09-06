/**
 * Where a citation edge meets the papers at its ends.
 *
 * @remarks
 * React Flow routes an edge between two handles, and a handle sits at a fixed
 * side of its node. With a target handle at the top and a source handle at the
 * bottom -- the arrangement a top-to-bottom flow chart wants -- every edge runs
 * from the bottom of one paper to the *top* of another, whatever their actual
 * positions. When the target happens to sit above the source, the line has to
 * travel up through the target's body to reach its top edge, so it crosses the
 * pill and the arrowhead lands somewhere inside it.
 *
 * A citation network has no such flow. Two papers are wherever the layout put
 * them, and an edge should leave and arrive at whichever point on each node's
 * outline faces the other one. That is what these compute, and it fixes both
 * faults at once: nothing overshoots, because the endpoint is the boundary, and
 * nothing crosses a node body, because the segment stops there.
 *
 * @packageDocumentation
 */

/** A node as the geometry needs it: where it is and how big it is drawn. */
export interface NodeBox {
  /** Left edge, in flow coordinates. */
  readonly x: number;
  /** Top edge, in flow coordinates. */
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A point in flow coordinates. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * The centre of a node.
 *
 * @param box - The node
 * @returns Its midpoint
 *
 * @public
 */
export function centreOf(box: NodeBox): Point {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * Where the line towards a point leaves a node's outline.
 *
 * @param box - The node the line starts inside
 * @param towards - The point it heads for
 * @param padding - How far beyond the outline to sit, in pixels
 * @returns The boundary point, pushed out by `padding`
 *
 * @remarks
 * A ray from the centre towards `towards`, clipped to the rectangle: whichever
 * of the vertical and horizontal sides it would reach first is the side it
 * leaves by. The padding puts an arrowhead's tip against the border rather than
 * under it.
 *
 * Two nodes at the same point have no direction between them, so the centre is
 * returned unchanged rather than a division by zero.
 *
 * @public
 */
export function boundaryPoint(box: NodeBox, towards: Point, padding = 0): Point {
  const centre = centreOf(box);
  const dx = towards.x - centre.x;
  const dy = towards.y - centre.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return centre;

  const halfWidth = box.width / 2;
  const halfHeight = box.height / 2;
  const scaleX = dx === 0 ? Number.POSITIVE_INFINITY : halfWidth / Math.abs(dx);
  const scaleY = dy === 0 ? Number.POSITIVE_INFINITY : halfHeight / Math.abs(dy);
  const scale = Math.min(scaleX, scaleY);

  return {
    x: centre.x + dx * scale + (dx / distance) * padding,
    y: centre.y + dy * scale + (dy / distance) * padding,
  };
}

/** The two ends of an edge. */
export interface EdgeEnds {
  readonly sourceX: number;
  readonly sourceY: number;
  readonly targetX: number;
  readonly targetY: number;
}

/**
 * The endpoints of a citation, on the outlines of the two papers.
 *
 * @param source - The citing paper
 * @param target - The cited paper
 * @param padding - Clearance to leave at each end
 * @returns Coordinates for a straight segment between the two outlines
 *
 * @remarks
 * Each end faces the other node's centre, so the segment lies entirely between
 * the two papers and touches neither.
 *
 * @public
 */
export function floatingEnds(source: NodeBox, target: NodeBox, padding = 3): EdgeEnds {
  const from = boundaryPoint(source, centreOf(target), padding);
  const to = boundaryPoint(target, centreOf(source), padding);
  return { sourceX: from.x, sourceY: from.y, targetX: to.x, targetY: to.y };
}
