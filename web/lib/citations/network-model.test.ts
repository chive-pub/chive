/**
 * Tests for the citation network's roles and colours.
 *
 * @remarks
 * The behaviour worth pinning hardest is the one that makes the graph
 * explorable: clicking a second paper must never repaint the paper the reader
 * arrived on. Everything else follows from that rule.
 *
 * @packageDocumentation
 */

import { describe, expect, it } from 'vitest';

import {
  assignEdgeRoles,
  assignRoles,
  edgeKey,
  neighboursOf,
  NETWORK_COLORS,
  roleStyle,
  urisIn,
  withAlpha,
  type NetworkEdge,
} from './network-model';

const cite = (citingUri: string, citedUri: string): NetworkEdge => ({ citingUri, citedUri });

//   old  ──cited by──▶  focus  ──cites──▶  ref
//                         ▲
//   other ──cites──▶  citer ──cites──▶ focus
const EDGES: NetworkEdge[] = [
  cite('focus', 'ref'),
  cite('citer', 'focus'),
  cite('other', 'citer'),
  cite('loner', 'stranger'),
];

describe('neighboursOf', () => {
  it('separates what a paper cites from what cites it', () => {
    const { references, citers } = neighboursOf('focus', EDGES);
    expect([...references]).toEqual(['ref']);
    expect([...citers]).toEqual(['citer']);
  });

  it('reports nothing for a paper with no citations either way', () => {
    const { references, citers } = neighboursOf('absent', EDGES);
    expect(references.size).toBe(0);
    expect(citers.size).toBe(0);
  });
});

describe('urisIn', () => {
  it('names every paper an edge touches, once each', () => {
    expect(urisIn(EDGES).sort()).toEqual(['citer', 'focus', 'loner', 'other', 'ref', 'stranger']);
  });

  it('includes a focus that nothing cites', () => {
    // Otherwise a paper with no citations vanishes from its own network view.
    expect(urisIn([], 'alone')).toEqual(['alone']);
  });
});

describe('assignRoles', () => {
  it('names the focus, what it cites, and what cites it', () => {
    const roles = assignRoles(urisIn(EDGES, 'focus'), EDGES, { focusUri: 'focus' });
    expect(roles.get('focus')).toEqual({ relation: 'anchor', tier: 'primary' });
    expect(roles.get('ref')).toEqual({ relation: 'reference', tier: 'primary' });
    expect(roles.get('citer')).toEqual({ relation: 'citer', tier: 'primary' });
  });

  it('leaves the rest of the network as background', () => {
    const roles = assignRoles(urisIn(EDGES, 'focus'), EDGES, { focusUri: 'focus' });
    expect(roles.get('loner')).toEqual({ relation: 'none', tier: 'none' });
    expect(roles.get('stranger')).toEqual({ relation: 'none', tier: 'none' });
  });

  it('lights a clicked paper and its neighbours in the pale tier', () => {
    const roles = assignRoles(urisIn(EDGES, 'focus'), EDGES, {
      focusUri: 'focus',
      selectedUri: 'citer',
    });
    expect(roles.get('citer')).toEqual({ relation: 'citer', tier: 'primary' });
    expect(roles.get('other')).toEqual({ relation: 'citer', tier: 'secondary' });
  });

  it('never repaints the focus or its neighbours when a second paper is clicked', () => {
    // The reader has to be able to get back to where they started, so the
    // original neighbourhood stays solid however far they wander.
    const withSelection = assignRoles(urisIn(EDGES, 'focus'), EDGES, {
      focusUri: 'focus',
      selectedUri: 'other',
    });
    expect(withSelection.get('focus')).toEqual({ relation: 'anchor', tier: 'primary' });
    expect(withSelection.get('ref')).toEqual({ relation: 'reference', tier: 'primary' });
    // `citer` is cited by the selection AND cites the focus. The focus wins.
    expect(withSelection.get('citer')).toEqual({ relation: 'citer', tier: 'primary' });
    expect(withSelection.get('other')).toEqual({ relation: 'anchor', tier: 'secondary' });
  });

  it('treats clicking the focus itself as no selection at all', () => {
    const roles = assignRoles(urisIn(EDGES, 'focus'), EDGES, {
      focusUri: 'focus',
      selectedUri: 'focus',
    });
    expect(roles.get('focus')).toEqual({ relation: 'anchor', tier: 'primary' });
  });

  it('works with no focus, which is the view of the whole network', () => {
    const roles = assignRoles(urisIn(EDGES), EDGES, { selectedUri: 'loner' });
    expect(roles.get('loner')).toEqual({ relation: 'anchor', tier: 'secondary' });
    expect(roles.get('stranger')).toEqual({ relation: 'reference', tier: 'secondary' });
    expect(roles.get('focus')).toEqual({ relation: 'none', tier: 'none' });
  });
});

describe('assignEdgeRoles', () => {
  it('colours an edge by the direction it runs from its anchor', () => {
    const roles = assignEdgeRoles(EDGES, { focusUri: 'focus' });
    expect(roles.get('focus->ref')).toEqual({ relation: 'reference', tier: 'primary' });
    expect(roles.get('citer->focus')).toEqual({ relation: 'citer', tier: 'primary' });
  });

  it('leaves edges touching neither anchor as background', () => {
    const roles = assignEdgeRoles(EDGES, { focusUri: 'focus' });
    expect(roles.get('loner->stranger')).toEqual({ relation: 'none', tier: 'none' });
  });

  it('gives the selection its own pale edges', () => {
    const roles = assignEdgeRoles(EDGES, { focusUri: 'focus', selectedUri: 'citer' });
    expect(roles.get('other->citer')).toEqual({ relation: 'citer', tier: 'secondary' });
    // Still the focus's edge, still solid.
    expect(roles.get('citer->focus')).toEqual({ relation: 'citer', tier: 'primary' });
  });

  it('keys an edge by its ordered pair, so both directions can coexist', () => {
    expect(edgeKey(cite('a', 'b'))).toBe('a->b');
    expect(edgeKey(cite('b', 'a'))).toBe('b->a');
  });
});

describe('roleStyle', () => {
  it('draws the focus tier solid and the selection tier pale, in one hue', () => {
    const primary = roleStyle({ relation: 'citer', tier: 'primary' });
    const secondary = roleStyle({ relation: 'citer', tier: 'secondary' });
    expect(primary.fill).toBe(NETWORK_COLORS.citer);
    expect(primary.stroke).toBe(NETWORK_COLORS.citer);
    expect(secondary.stroke).toBe(NETWORK_COLORS.citer);
    expect(secondary.fill).toContain('rgba');
    expect(secondary.fill).not.toBe(primary.fill);
  });

  it('uses mustard for the anchor, red for references and blue for citers', () => {
    expect(roleStyle({ relation: 'anchor', tier: 'primary' }).fill).toBe('#C99700');
    expect(roleStyle({ relation: 'reference', tier: 'primary' }).fill).toBe('#C4443A');
    expect(roleStyle({ relation: 'citer', tier: 'primary' }).fill).toBe('#2E6FB7');
  });

  it('fades the rest of the network back', () => {
    const background = roleStyle({ relation: 'none', tier: 'none' });
    expect(background.opacity).toBeLessThan(1);
    expect(background.stroke).toBe(NETWORK_COLORS.none);
  });

  it('never resolves a colour to nothing', () => {
    // The previous graph styled every edge with a CSS variable this
    // application does not define, so no edge was drawn at all.
    for (const relation of ['anchor', 'reference', 'citer', 'none'] as const) {
      for (const tier of ['primary', 'secondary', 'none'] as const) {
        const style = roleStyle({ relation, tier });
        expect(style.stroke).toMatch(/^(#[0-9A-Fa-f]{6}|rgba\()/);
        expect(style.fill).toMatch(/^(#[0-9A-Fa-f]{6}|rgba\()/);
      }
    }
  });
});

describe('withAlpha', () => {
  it('restates a hex colour as rgba', () => {
    expect(withAlpha('#C99700', 0.22)).toBe('rgba(201, 151, 0, 0.22)');
    expect(withAlpha('#000000', 1)).toBe('rgba(0, 0, 0, 1)');
    expect(withAlpha('#FFFFFF', 0)).toBe('rgba(255, 255, 255, 0)');
  });
});
