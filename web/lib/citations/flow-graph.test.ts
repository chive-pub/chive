/**
 * Tests for what the citation network hands React Flow.
 *
 * @remarks
 * The fault these exist for: every edge in the old view was styled
 * `stroke: var(--green-500)`, a variable this application does not define, so
 * the browser drew no line and no arrowhead between any two papers. The first
 * two tests below fail against that code.
 *
 * @packageDocumentation
 */

import { MarkerType } from '@xyflow/react';
import { describe, expect, it } from 'vitest';

import {
  buildFlowEdges,
  buildFlowNodes,
  DOT_SIZE,
  neighbourhoodOf,
  NODE_HEIGHT,
  NODE_WIDTH,
  nodeLabel,
  sizeFor,
} from './flow-graph';
import { assignEdgeRoles, NETWORK_COLORS, type NetworkEdge } from './network-model';
import type { CitedPaper } from './paper-label';

const cite = (citingUri: string, citedUri: string): NetworkEdge => ({ citingUri, citedUri });

const EDGES: NetworkEdge[] = [cite('focus', 'ref'), cite('citer', 'focus'), cite('far', 'other')];

describe('buildFlowEdges', () => {
  it('gives every citation an arrowhead', () => {
    // Without one, "A cites B" and "B cites A" are the same line.
    const edges = buildFlowEdges(EDGES, assignEdgeRoles(EDGES, { focusUri: 'focus' }));
    expect(edges).toHaveLength(3);
    for (const edge of edges) {
      expect(edge.markerEnd).toMatchObject({ type: MarkerType.ArrowClosed });
    }
  });

  it('resolves every stroke to a colour that exists', () => {
    const edges = buildFlowEdges(EDGES, assignEdgeRoles(EDGES, { focusUri: 'focus' }));
    for (const edge of edges) {
      const stroke = edge.style?.stroke;
      expect(typeof stroke).toBe('string');
      expect(stroke).toMatch(/^(#[0-9A-Fa-f]{6}|rgba\()/);
      // The specific thing that was broken.
      expect(stroke).not.toContain('var(');
    }
  });

  it('colours the arrowhead to match its line', () => {
    // A coloured line ending in a black arrow reads as two things meeting.
    const edges = buildFlowEdges(EDGES, assignEdgeRoles(EDGES, { focusUri: 'focus' }));
    for (const edge of edges) {
      expect(edge.markerEnd).toMatchObject({ color: edge.style?.stroke });
    }
  });

  it('draws a reference red and a citation blue', () => {
    const edges = buildFlowEdges(EDGES, assignEdgeRoles(EDGES, { focusUri: 'focus' }));
    const byId = new Map(edges.map((edge) => [edge.id, edge]));
    expect(byId.get('focus->ref')?.style?.stroke).toBe(NETWORK_COLORS.reference);
    expect(byId.get('citer->focus')?.style?.stroke).toBe(NETWORK_COLORS.citer);
  });

  it('fades the rest of the network back rather than hiding it', () => {
    const edges = buildFlowEdges(EDGES, assignEdgeRoles(EDGES, { focusUri: 'focus' }));
    const background = edges.find((edge) => edge.id === 'far->other');
    expect(background?.style?.stroke).toContain('rgba');
    expect(background?.style?.strokeDasharray).toBe('4 4');
    // Still drawn: it is the context the focus sits in.
    expect(background?.markerEnd).toBeDefined();
  });

  it('never sets opacity, which would show the line through the arrowhead', () => {
    // Element opacity applies to the path and the marker alike, so where the
    // line runs under the arrowhead the two composite and the line shows
    // through it as a darker streak. The fade goes in the colour instead.
    for (const edge of buildFlowEdges(EDGES, assignEdgeRoles(EDGES, { focusUri: 'focus' }))) {
      expect(edge.style?.opacity).toBeUndefined();
    }
  });

  it('paints the arrowhead in exactly the colour of its line', () => {
    for (const edge of buildFlowEdges(EDGES, assignEdgeRoles(EDGES, { focusUri: 'focus' }))) {
      expect(edge.markerEnd).toMatchObject({ color: edge.style?.stroke });
    }
  });

  it('paints lit edges above the background ones, by ordering', () => {
    const edges = buildFlowEdges(EDGES, assignEdgeRoles(EDGES, { focusUri: 'focus' }));
    const ids = edges.map((edge) => edge.id);
    // Later in the array is painted higher within the edge layer.
    expect(ids.indexOf('focus->ref')).toBeGreaterThan(ids.indexOf('far->other'));
    expect(ids.indexOf('citer->focus')).toBeGreaterThan(ids.indexOf('far->other'));
  });

  it('leaves every edge in the layer React Flow draws beneath the nodes', () => {
    // An explicit zIndex lifts an edge out of that layer, which put every lit
    // arrow on top of the papers it runs between.
    const edges = buildFlowEdges(EDGES, assignEdgeRoles(EDGES, { focusUri: 'focus' }));
    for (const edge of edges) {
      expect(edge.zIndex).toBeUndefined();
    }
  });

  it('routes every edge through the floating type, not a handle-bound one', () => {
    // A handle is fixed to one side of a node, so a built-in edge whose target
    // sat above its source ran up through the target's body to reach its top.
    for (const edge of buildFlowEdges(EDGES, new Map())) {
      expect(edge.type).toBe('floating');
    }
  });

  it('runs the edge from the citing paper to the cited one', () => {
    const [edge] = buildFlowEdges([cite('a', 'b')], new Map());
    expect(edge.source).toBe('a');
    expect(edge.target).toBe('b');
  });

  it('keeps both directions between the same pair as separate edges', () => {
    const edges = buildFlowEdges([cite('a', 'b'), cite('b', 'a')], new Map());
    expect(new Set(edges.map((edge) => edge.id)).size).toBe(2);
  });
});

describe('buildFlowNodes', () => {
  const positions = new Map([
    ['focus', { x: 0, y: 0 }],
    ['ref', { x: 100, y: 40 }],
  ]);
  const papers = new Map<string, CitedPaper>([
    [
      'focus',
      {
        uri: 'focus',
        title: 'Discovering classes of attitude verbs',
        authors: ['Aaron Steven White'],
        year: 2014,
      },
    ],
  ]);

  it('places each paper where the layout put it', () => {
    // A labelled node sits exactly where the layout put it; an unlabelled dot
    // is centred on the same point, which is a smaller box at a shifted origin.
    const roles = new Map([['ref', { relation: 'citer' as const, tier: 'primary' as const }]]);
    expect(buildFlowNodes(positions, papers, roles).find((n) => n.id === 'ref')?.position).toEqual({
      x: 100,
      y: 40,
    });
    const dot = buildFlowNodes(positions, papers, new Map()).find((n) => n.id === 'ref');
    expect(dot!.position.x + DOT_SIZE / 2).toBe(100 + NODE_WIDTH / 2);
  });

  it('carries the role through, so the node can paint itself', () => {
    const roles = new Map([['focus', { relation: 'anchor' as const, tier: 'primary' as const }]]);
    const nodes = buildFlowNodes(positions, papers, roles);
    expect(nodes.find((node) => node.id === 'focus')?.data.role).toEqual({
      relation: 'anchor',
      tier: 'primary',
    });
  });

  it('draws a labelled paper as a pill and a background one as a dot', () => {
    // A few hundred labels is a wall of words; the names worth reading are the
    // ones beside the paper in hand.
    const roles = new Map([['focus', { relation: 'anchor' as const, tier: 'primary' as const }]]);
    const nodes = buildFlowNodes(positions, papers, roles);
    const focus = nodes.find((node) => node.id === 'focus');
    const background = nodes.find((node) => node.id === 'ref');
    expect(focus).toMatchObject({ width: NODE_WIDTH, height: NODE_HEIGHT });
    expect(background).toMatchObject({ width: DOT_SIZE, height: DOT_SIZE });
  });

  it('centres a dot where its pill would have been', () => {
    // Otherwise a paper jumps across the canvas when selecting something makes
    // it grow a label.
    const roles = new Map([['focus', { relation: 'anchor' as const, tier: 'primary' as const }]]);
    const labelled = buildFlowNodes(positions, papers, roles).find((n) => n.id === 'focus');
    const dot = buildFlowNodes(positions, papers, new Map()).find((n) => n.id === 'focus');
    expect(labelled!.position.x + NODE_WIDTH / 2).toBe(dot!.position.x + DOT_SIZE / 2);
    expect(labelled!.position.y + NODE_HEIGHT / 2).toBe(dot!.position.y + DOT_SIZE / 2);
  });

  it('treats a paper with no role as background rather than dropping it', () => {
    const nodes = buildFlowNodes(positions, papers, new Map());
    expect(nodes.find((node) => node.id === 'ref')?.data.role).toEqual({
      relation: 'none',
      tier: 'none',
    });
  });
});

describe('nodeLabel', () => {
  it('names a paper by author and year', () => {
    expect(
      nodeLabel(
        { uri: 'x', title: 'Long title here', authors: ['Aaron Steven White'], year: 2014 },
        'x'
      )
    ).toBe('White 2014');
  });

  it('names two authors, and shortens three', () => {
    expect(
      nodeLabel({ uri: 'x', title: 't', authors: ['A Smith', 'B Jones'], year: 2020 }, 'x')
    ).toBe('Smith and Jones 2020');
    expect(
      nodeLabel({ uri: 'x', title: 't', authors: ['A Smith', 'B Jones', 'C Lee'], year: 2020 }, 'x')
    ).toBe('Smith et al. 2020');
  });

  it('falls back to a shortened title when there is no byline', () => {
    expect(nodeLabel({ uri: 'x', title: 'A short title' }, 'x')).toBe('A short title');
    expect(
      nodeLabel({ uri: 'x', title: 'A title that runs on well past what a node can hold' }, 'x')
    ).toBe('A title that runs on well past w…');
  });

  it('falls back to the record key when the paper is not in the index', () => {
    // A citation can name a paper the metadata query did not return. A node
    // reading "undefined" would be worse than one reading its record key.
    expect(nodeLabel(undefined, 'at://did:plc:abc/pub.chive.eprint.submission/3xyz')).toBe('3xyz');
  });
});

describe('neighbourhoodOf', () => {
  it('collects the paper and everything directly attached to it', () => {
    expect(neighbourhoodOf('focus', EDGES).sort()).toEqual(['citer', 'focus', 'ref']);
  });

  it('returns the paper alone when nothing touches it', () => {
    expect(neighbourhoodOf('alone', EDGES)).toEqual(['alone']);
  });
});

describe('sizeFor', () => {
  it('gives a labelled paper the pill and everything else the dot', () => {
    expect(sizeFor({ relation: 'anchor', tier: 'primary' })).toEqual({
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    });
    expect(sizeFor({ relation: 'citer', tier: 'secondary' })).toEqual({
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    });
    expect(sizeFor({ relation: 'none', tier: 'none' })).toEqual({
      width: DOT_SIZE,
      height: DOT_SIZE,
    });
  });
});
