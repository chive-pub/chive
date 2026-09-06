/**
 * Tests for the parts of the citation network that draw themselves.
 *
 * @remarks
 * The graph canvas needs a real layout engine to render, so what is held here
 * is everything outside it: the node, the key, and the bibliography card. The
 * geometry and the colour rules are covered as pure functions in
 * `lib/citations`.
 *
 * @packageDocumentation
 */

import { render, screen } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { describe, expect, it } from 'vitest';

import { NETWORK_COLORS } from '@/lib/citations/network-model';

import { NetworkLegend } from '../network-legend';
import { NetworkNode } from '../network-node';
import { PaperHoverCard } from '../paper-hover-card';

function renderNode(role: {
  relation: 'anchor' | 'reference' | 'citer' | 'none';
  tier: 'primary' | 'secondary' | 'none';
}) {
  return render(
    <ReactFlowProvider>
      <NetworkNode data={{ label: 'White 2014', role, uri: 'at://did:plc:a/c/1' }} />
    </ReactFlowProvider>
  );
}

describe('NetworkNode', () => {
  it('names the paper the way a reader would refer to it', () => {
    renderNode({ relation: 'anchor', tier: 'primary' });
    expect(screen.getByText('White 2014')).toBeInTheDocument();
  });

  it('draws a paper beyond one citation as a dot, with no text at all', () => {
    // A few hundred labels is a wall of words. The names worth reading are the
    // ones beside the paper in hand; the rest are the shape of the field.
    renderNode({ relation: 'none', tier: 'none' });
    const node = screen.getByTestId('network-node');
    expect(node).toHaveAttribute('data-labelled', 'false');
    expect(node.textContent).toBe('');
    // Still nameable without reading the canvas.
    expect(node).toHaveAttribute('aria-label', 'White 2014');
  });

  it('labels a paper the moment it attaches to the focus or the selection', () => {
    renderNode({ relation: 'citer', tier: 'secondary' });
    const node = screen.getByTestId('network-node');
    expect(node).toHaveAttribute('data-labelled', 'true');
    expect(screen.getByText('White 2014')).toBeInTheDocument();
  });

  it('records its role, so the colour and the meaning cannot drift apart', () => {
    renderNode({ relation: 'citer', tier: 'secondary' });
    const node = screen.getByTestId('network-node');
    expect(node).toHaveAttribute('data-relation', 'citer');
    expect(node).toHaveAttribute('data-tier', 'secondary');
  });

  it('fills the focus tier solid and the selection tier pale', () => {
    const solid = renderNode({ relation: 'citer', tier: 'primary' });
    expect(solid.getByTestId('network-node').style.background).toContain('rgb(46, 111, 183)');
    solid.unmount();

    renderNode({ relation: 'citer', tier: 'secondary' });
    expect(screen.getByTestId('network-node').style.background).toContain('0.22');
  });

  it('fades a paper attached to neither anchor', () => {
    renderNode({ relation: 'none', tier: 'none' });
    expect(Number(screen.getByTestId('network-node').style.opacity)).toBeLessThan(1);
  });
});

describe('NetworkLegend', () => {
  it('names the three colours', () => {
    render(<NetworkLegend hasSelection={false} />);
    expect(screen.getByText('This paper')).toBeInTheDocument();
    // Worded with an explicit subject: "Cited by it" reads either way round,
    // and the direction is the whole content of the colour.
    expect(screen.getByText('Papers citing it')).toBeInTheDocument();
    expect(screen.getByText('Papers it cites')).toBeInTheDocument();
  });

  it('says nothing about a selection until there is one', () => {
    render(<NetworkLegend hasSelection={false} />);
    expect(screen.queryByText('Selected paper')).not.toBeInTheDocument();
  });

  it('explains the pale tier once a paper is selected', () => {
    render(<NetworkLegend hasSelection />);
    expect(screen.getByText('Selected paper')).toBeInTheDocument();
    expect(screen.getAllByText('Papers citing it')).toHaveLength(2);
    expect(screen.getAllByText('Papers it cites')).toHaveLength(2);
  });
});

describe('PaperHoverCard', () => {
  const PAPER = {
    uri: 'at://did:plc:a/pub.chive.eprint.submission/1',
    title: 'Discovering classes of attitude verbs using subcategorization frame distributions',
    authors: ['Aaron Steven White', 'Rachel Dudley', 'Valentine Hacquard', 'Jeffrey Lidz'],
    year: 2014,
    venue: 'NELS 44',
    doi: '10.1234/nels.44',
  };

  it('reads as a bibliography entry, with every author named', () => {
    // Distinct from the node label, which shortens to "White et al." to fit.
    render(
      <PaperHoverCard
        paper={PAPER}
        role={{ relation: 'citer', tier: 'primary' }}
        at={{ x: 10, y: 10 }}
        width={800}
      />
    );
    expect(screen.getByText(PAPER.title)).toBeInTheDocument();
    expect(
      screen.getByText('Aaron Steven White, Rachel Dudley, Valentine Hacquard, and Jeffrey Lidz')
    ).toBeInTheDocument();
    expect(screen.getByText('2014 · NELS 44')).toBeInTheDocument();
    expect(screen.getByText('10.1234/nels.44')).toBeInTheDocument();
  });

  it('says what the paper is to the one being read against', () => {
    render(
      <PaperHoverCard
        paper={PAPER}
        role={{ relation: 'citer', tier: 'primary' }}
        at={{ x: 10, y: 10 }}
        width={800}
      />
    );
    expect(screen.getByText('Cites this paper')).toBeInTheDocument();
  });

  it('attributes a pale role to the selection rather than to the focus', () => {
    render(
      <PaperHoverCard
        paper={PAPER}
        role={{ relation: 'reference', tier: 'secondary' }}
        at={{ x: 10, y: 10 }}
        width={800}
      />
    );
    expect(screen.getByText('The selected paper cites it')).toBeInTheDocument();
  });

  it('says nothing about a relation a background paper does not have', () => {
    render(
      <PaperHoverCard
        paper={PAPER}
        role={{ relation: 'none', tier: 'none' }}
        at={{ x: 10, y: 10 }}
        width={800}
      />
    );
    expect(screen.getByText(PAPER.title)).toBeInTheDocument();
    expect(screen.queryByText(/cites|cited by/i)).not.toBeInTheDocument();
  });

  it('renders a paper the index knows little about', () => {
    render(
      <PaperHoverCard
        paper={{ uri: 'at://x/c/1', title: 'A paper' }}
        role={{ relation: 'anchor', tier: 'primary' }}
        at={{ x: 10, y: 10 }}
        width={800}
      />
    );
    expect(screen.getByText('A paper')).toBeInTheDocument();
  });

  it('flips to the left rather than running off the canvas', () => {
    render(
      <PaperHoverCard
        paper={PAPER}
        role={{ relation: 'anchor', tier: 'primary' }}
        at={{ x: 780, y: 10 }}
        width={800}
      />
    );
    const card = screen.getByTestId('paper-hover-card');
    expect(Number.parseInt(card.style.left, 10)).toBeLessThan(780);
  });

  it('borders itself in the colour of the node it describes', () => {
    render(
      <PaperHoverCard
        paper={PAPER}
        role={{ relation: 'reference', tier: 'primary' }}
        at={{ x: 10, y: 10 }}
        width={800}
      />
    );
    const card = screen.getByTestId('paper-hover-card');
    expect(card.style.borderColor.toLowerCase()).toContain('196, 68, 58');
    expect(NETWORK_COLORS.reference).toBe('#C4443A');
  });
});
