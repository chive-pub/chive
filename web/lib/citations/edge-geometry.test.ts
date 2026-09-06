/**
 * Tests for where a citation edge meets its papers.
 *
 * @remarks
 * The fault these exist for: handles fixed at the top and bottom of a node made
 * every edge run to the target's top edge, so an edge whose target sat above
 * its source travelled up through the target's body -- crossing the pill and
 * putting the arrowhead inside it. The two properties that rule that out are
 * that each endpoint lies on its own node's outline, and that the segment
 * between them enters neither node.
 *
 * @packageDocumentation
 */

import { describe, expect, it } from 'vitest';

import { boundaryPoint, centreOf, floatingEnds, type NodeBox } from './edge-geometry';

/** A node of the size the network draws. */
function box(x: number, y: number, width = 184, height = 26): NodeBox {
  return { x, y, width, height };
}

/** Whether a point is strictly inside a node's box. */
function inside(b: NodeBox, x: number, y: number): boolean {
  return x > b.x && x < b.x + b.width && y > b.y && y < b.y + b.height;
}

describe('centreOf', () => {
  it('is the midpoint of the drawn node', () => {
    expect(centreOf(box(0, 0, 100, 20))).toEqual({ x: 50, y: 10 });
  });
});

describe('boundaryPoint', () => {
  it('leaves by the right side when the other node is to the right', () => {
    const b = box(0, 0, 100, 20);
    const p = boundaryPoint(b, { x: 500, y: 10 });
    expect(p).toEqual({ x: 100, y: 10 });
  });

  it('leaves by the left side when the other node is to the left', () => {
    const b = box(0, 0, 100, 20);
    expect(boundaryPoint(b, { x: -500, y: 10 })).toEqual({ x: 0, y: 10 });
  });

  it('leaves by the top when the other node is directly above', () => {
    const b = box(0, 0, 100, 20);
    expect(boundaryPoint(b, { x: 50, y: -500 })).toEqual({ x: 50, y: 0 });
  });

  it('leaves by the bottom when the other node is directly below', () => {
    const b = box(0, 0, 100, 20);
    expect(boundaryPoint(b, { x: 50, y: 500 })).toEqual({ x: 50, y: 20 });
  });

  it('always lands on the outline, never inside or beyond it', () => {
    const b = box(0, 0, 184, 26);
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 12) {
      const target = { x: 92 + Math.cos(angle) * 1000, y: 13 + Math.sin(angle) * 1000 };
      const p = boundaryPoint(b, target);
      const onEdge =
        Math.abs(p.x - b.x) < 0.001 ||
        Math.abs(p.x - (b.x + b.width)) < 0.001 ||
        Math.abs(p.y - b.y) < 0.001 ||
        Math.abs(p.y - (b.y + b.height)) < 0.001;
      expect(onEdge).toBe(true);
      expect(inside(b, p.x, p.y)).toBe(false);
    }
  });

  it('pushes the point clear of the outline by the padding', () => {
    const b = box(0, 0, 100, 20);
    expect(boundaryPoint(b, { x: 500, y: 10 }, 5)).toEqual({ x: 105, y: 10 });
  });

  it('returns the centre when there is no direction to leave in', () => {
    const b = box(0, 0, 100, 20);
    expect(boundaryPoint(b, { x: 50, y: 10 })).toEqual({ x: 50, y: 10 });
  });
});

describe('floatingEnds', () => {
  it('runs between the facing sides of two papers side by side', () => {
    const ends = floatingEnds(box(0, 0, 100, 20), box(300, 0, 100, 20), 0);
    expect(ends).toEqual({ sourceX: 100, sourceY: 10, targetX: 300, targetY: 10 });
  });

  it('points upwards when the cited paper sits above the citing one', () => {
    // The case the fixed handles got wrong: the edge used to travel up through
    // the target to reach its top edge.
    const source = box(0, 500, 100, 20);
    const target = box(0, 0, 100, 20);
    const ends = floatingEnds(source, target, 0);
    // Leaves the source by its top, arrives at the target's bottom.
    expect(ends.sourceY).toBe(500);
    expect(ends.targetY).toBe(20);
  });

  it('never places an endpoint inside either paper', () => {
    const source = box(0, 0);
    for (const target of [box(400, 0), box(-400, 0), box(0, 300), box(0, -300), box(250, -180)]) {
      const ends = floatingEnds(source, target);
      expect(inside(source, ends.sourceX, ends.sourceY)).toBe(false);
      expect(inside(target, ends.targetX, ends.targetY)).toBe(false);
      expect(inside(target, ends.sourceX, ends.sourceY)).toBe(false);
      expect(inside(source, ends.targetX, ends.targetY)).toBe(false);
    }
  });

  it('draws a segment that enters neither paper along its whole length', () => {
    // Sampled rather than reasoned: this is the property a reader sees.
    const source = box(0, 0);
    const target = box(260, -200);
    const ends = floatingEnds(source, target);
    for (let t = 0; t <= 1; t += 0.02) {
      const x = ends.sourceX + (ends.targetX - ends.sourceX) * t;
      const y = ends.sourceY + (ends.targetY - ends.sourceY) * t;
      expect(inside(source, x, y)).toBe(false);
      expect(inside(target, x, y)).toBe(false);
    }
  });

  it('leaves clearance at both ends so an arrowhead sits against the border', () => {
    const ends = floatingEnds(box(0, 0, 100, 20), box(300, 0, 100, 20), 4);
    expect(ends.sourceX).toBe(104);
    expect(ends.targetX).toBe(296);
  });
});
