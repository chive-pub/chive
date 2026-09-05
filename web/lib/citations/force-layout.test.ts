/**
 * Tests for the citation network layout.
 *
 * @remarks
 * The property this has to hold above all others is determinism: a graph that
 * lays out differently on each render is one a reader can build no memory of,
 * and it cannot be tested at all.
 *
 * @packageDocumentation
 */

import { describe, expect, it } from 'vitest';

import { forceLayout, hashString, type LayoutLink, type LayoutNode } from './force-layout';

function nodes(...ids: string[]): LayoutNode[] {
  return ids.map((id) => ({ id }));
}

function link(source: string, target: string): LayoutLink {
  return { source, target };
}

/** Distance between two laid-out nodes. */
function gap(positions: Map<string, { x: number; y: number }>, a: string, b: string): number {
  const pa = positions.get(a);
  const pb = positions.get(b);
  if (!pa || !pb) throw new Error('missing node');
  return Math.hypot(pa.x - pb.x, pa.y - pb.y);
}

describe('hashString', () => {
  it('is stable for the same input', () => {
    expect(hashString('at://did:plc:a/c/1')).toBe(hashString('at://did:plc:a/c/1'));
  });

  it('separates different inputs', () => {
    expect(hashString('a')).not.toBe(hashString('b'));
  });

  it('stays a non-negative 32-bit integer', () => {
    for (const value of ['', 'a', 'at://did:plc:xyz/pub.chive.eprint.submission/3abc']) {
      const hash = hashString(value);
      expect(Number.isInteger(hash)).toBe(true);
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(hash).toBeLessThanOrEqual(0xffffffff);
    }
  });
});

describe('forceLayout', () => {
  it('places nothing for an empty network', () => {
    expect(forceLayout([], []).size).toBe(0);
  });

  it('places a lone paper at the origin', () => {
    expect(forceLayout(nodes('a'), [])).toEqual(new Map([['a', { x: 0, y: 0 }]]));
  });

  it('gives the same answer every time', () => {
    const n = nodes('a', 'b', 'c', 'd', 'e');
    const l = [link('a', 'b'), link('b', 'c'), link('c', 'd'), link('a', 'e')];
    const first = forceLayout(n, l);
    const second = forceLayout(n, l);
    expect([...second.entries()]).toEqual([...first.entries()]);
  });

  it('does not depend on the order the nodes arrive in', () => {
    // The API returns papers in whatever order the query produced. A layout
    // that moved with it would shift every time the index changed.
    const l = [link('a', 'b'), link('b', 'c')];
    const forward = forceLayout(nodes('a', 'b', 'c'), l);
    const reversed = forceLayout(nodes('c', 'b', 'a'), l);
    expect([...reversed.entries()].sort()).toEqual([...forward.entries()].sort());
  });

  it('puts the focus at the origin', () => {
    const positions = forceLayout(nodes('a', 'b', 'c'), [link('a', 'b')], { centerOn: 'b' });
    expect(positions.get('b')).toEqual({ x: 0, y: 0 });
  });

  it('centres on the middle of the network when no focus is named', () => {
    const positions = forceLayout(nodes('a', 'b', 'c', 'd'), [link('a', 'b'), link('c', 'd')]);
    const points = [...positions.values()];
    const meanX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
    const meanY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
    expect(Math.abs(meanX)).toBeLessThan(2);
    expect(Math.abs(meanY)).toBeLessThan(2);
  });

  it('separates papers that are not connected', () => {
    // Repulsion is the only thing acting on them, so they must not overlap.
    const positions = forceLayout(nodes('a', 'b', 'c'), []);
    expect(gap(positions, 'a', 'b')).toBeGreaterThan(50);
    expect(gap(positions, 'b', 'c')).toBeGreaterThan(50);
    expect(gap(positions, 'a', 'c')).toBeGreaterThan(50);
  });

  it('draws cited papers closer than unrelated ones', () => {
    // This is the whole point of laying it out by simulation: proximity has to
    // mean something, or the picture is decorative.
    const positions = forceLayout(nodes('a', 'b', 'far'), [link('a', 'b')]);
    expect(gap(positions, 'a', 'b')).toBeLessThan(gap(positions, 'a', 'far'));
  });

  it('keeps a cluster together and away from another cluster', () => {
    const n = nodes('a1', 'a2', 'a3', 'b1', 'b2', 'b3');
    const l = [
      link('a1', 'a2'),
      link('a2', 'a3'),
      link('a3', 'a1'),
      link('b1', 'b2'),
      link('b2', 'b3'),
      link('b3', 'b1'),
    ];
    const positions = forceLayout(n, l);
    const within = Math.max(gap(positions, 'a1', 'a2'), gap(positions, 'a2', 'a3'));
    const between = Math.min(
      gap(positions, 'a1', 'b1'),
      gap(positions, 'a2', 'b2'),
      gap(positions, 'a3', 'b3')
    );
    expect(between).toBeGreaterThan(within);
  });

  it('ignores a citation naming a paper that is not in the network', () => {
    const positions = forceLayout(nodes('a', 'b'), [link('a', 'ghost'), link('a', 'b')]);
    expect([...positions.keys()].sort()).toEqual(['a', 'b']);
  });

  it('ignores a paper citing itself', () => {
    const positions = forceLayout(nodes('a', 'b'), [link('a', 'a'), link('a', 'b')]);
    expect(positions.size).toBe(2);
    for (const point of positions.values()) {
      expect(Number.isFinite(point.x)).toBe(true);
      expect(Number.isFinite(point.y)).toBe(true);
    }
  });

  it('produces finite positions for a network of a few hundred papers', () => {
    const n = nodes(...Array.from({ length: 300 }, (_, i) => `p${String(i)}`));
    const l = Array.from({ length: 600 }, (_, i) =>
      link(`p${String(i % 300)}`, `p${String((i * 7 + 3) % 300)}`)
    );
    const positions = forceLayout(n, l, { iterations: 60 });
    expect(positions.size).toBe(300);
    for (const point of positions.values()) {
      expect(Number.isFinite(point.x)).toBe(true);
      expect(Number.isFinite(point.y)).toBe(true);
    }
  });
});

describe('forceLayout node separation', () => {
  const SIZE = { width: 184, height: 26 };

  /** Whether two nodes' drawn boxes overlap. */
  function overlaps(
    positions: Map<string, { x: number; y: number }>,
    a: string,
    b: string
  ): boolean {
    const pa = positions.get(a);
    const pb = positions.get(b);
    if (!pa || !pb) throw new Error('missing node');
    return Math.abs(pa.x - pb.x) < SIZE.width && Math.abs(pa.y - pb.y) < SIZE.height;
  }

  it('stops drawn nodes sitting on top of each other', () => {
    // The simulation treats nodes as points, so a layout that reads fine as
    // dots can be unreadable once each dot is 184 pixels wide.
    const n = nodes(...Array.from({ length: 12 }, (_, i) => `p${String(i)}`));
    const l = Array.from({ length: 11 }, (_, i) => link('p0', `p${String(i + 1)}`));

    const positions = forceLayout(n, l, { nodeSize: SIZE });

    for (let i = 0; i < 12; i += 1) {
      for (let j = i + 1; j < 12; j += 1) {
        expect(overlaps(positions, `p${String(i)}`, `p${String(j)}`)).toBe(false);
      }
    }
  });

  it('leaves the shape of the network alone', () => {
    // Separation runs after the simulation, so cited papers must still end up
    // nearer than unrelated ones.
    const positions = forceLayout(nodes('a', 'b', 'far'), [link('a', 'b')], { nodeSize: SIZE });
    expect(gap(positions, 'a', 'b')).toBeLessThan(gap(positions, 'a', 'far'));
  });

  it('stays deterministic with separation on', () => {
    const n = nodes('a', 'b', 'c', 'd', 'e', 'f');
    const l = [link('a', 'b'), link('a', 'c'), link('a', 'd'), link('e', 'f')];
    const first = forceLayout(n, l, { nodeSize: SIZE });
    const second = forceLayout(n, l, { nodeSize: SIZE });
    expect([...second.entries()]).toEqual([...first.entries()]);
  });

  it('keeps the focus at the origin after separating', () => {
    const positions = forceLayout(nodes('a', 'b', 'c'), [link('a', 'b')], {
      centerOn: 'a',
      nodeSize: SIZE,
    });
    expect(positions.get('a')).toEqual({ x: 0, y: 0 });
  });
});
