/**
 * Turning a citation network into what React Flow draws.
 *
 * @remarks
 * Kept apart from the component so the part that can be wrong is the part that
 * can be tested. The fault this view was built to fix lived exactly here: every
 * edge was styled `stroke: var(--green-500)`, a variable this application has
 * never defined, so the browser drew no line and no arrowhead and the citation
 * network rendered as scattered boxes with nothing between them. Nothing caught
 * it because the styling was written inline in a component that needs a canvas
 * to render at all.
 *
 * @packageDocumentation
 */

import { MarkerType, type Edge, type Node } from '@xyflow/react';

import { edgeKey, roleStyle, type NetworkEdge, type NodeRole } from './network-model';
import { formatAuthors, type CitedPaper } from './paper-label';

/** What a network node carries. */
export interface FlowNodeData {
  [key: string]: unknown;
  /** Surname and year, or a shortened title when the record named neither. */
  label: string;
  /** What this paper is to the papers being read against. */
  role: NodeRole;
  /** The paper's AT-URI. */
  uri: string;
}

const UNRELATED: NodeRole = { relation: 'none', tier: 'none' };

/**
 * The width every node is drawn at.
 *
 * @remarks
 * Uniform rather than fitted to the label. Two things depend on it: the minimap
 * draws from node dimensions and had nothing to draw while they were unknown,
 * and a dense graph whose pills are all one size reads as a network rather
 * than as a ransom note.
 *
 * @public
 */
export const NODE_WIDTH = 184;

/**
 * The height every node is drawn at.
 *
 * @public
 */
export const NODE_HEIGHT = 26;

/**
 * Names a paper the way it would be referred to in passing.
 *
 * @param paper - The paper, when the API named it
 * @param uri - Its AT-URI, for the case where it did not
 * @returns A label short enough for a node
 *
 * @remarks
 * A surname and a year: long enough to recognise, short enough that a few
 * hundred fit on one canvas. The previous view put a truncated title and two
 * badges on every node, which is why it could draw four papers and not four
 * hundred. Everything else is on the hover card.
 *
 * @public
 */
export function nodeLabel(paper: CitedPaper | undefined, uri: string): string {
  if (!paper) return uri.split('/').pop() ?? uri;

  const byline = [
    formatAuthors(paper.authors),
    paper.year !== undefined ? String(paper.year) : undefined,
  ]
    .filter(Boolean)
    .join(' ');
  if (byline) return byline;

  return paper.title.length > 32 ? `${paper.title.slice(0, 32)}…` : paper.title;
}

/**
 * Builds the nodes React Flow draws.
 *
 * @param positions - Where the layout put each paper
 * @param papers - Paper metadata, by URI
 * @param roles - Each paper's place in the network
 * @returns React Flow nodes
 *
 * @public
 */
export function buildFlowNodes(
  positions: ReadonlyMap<string, { x: number; y: number }>,
  papers: ReadonlyMap<string, CitedPaper>,
  roles: ReadonlyMap<string, NodeRole>
): Node<FlowNodeData>[] {
  return [...positions.entries()].map(([uri, position]) => ({
    id: uri,
    type: 'paper',
    position,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
    data: {
      label: nodeLabel(papers.get(uri), uri),
      role: roles.get(uri) ?? UNRELATED,
      uri,
    },
  }));
}

/**
 * Builds the edges React Flow draws.
 *
 * @param citations - Every citation in the network
 * @param roles - Each citation's place in the network
 * @returns React Flow edges, each with an arrowhead
 *
 * @remarks
 * Every edge carries a `markerEnd`. Without one, "A cites B" and "B cites A"
 * are the same line, and the direction is the whole content of a citation.
 * The arrowhead takes the edge's own colour, because a coloured line ending in
 * a black arrow reads as two different things meeting.
 *
 * Edges attached to neither anchor are drawn thin, faint and dashed. They are
 * the rest of the network -- context for where the paper sits, not something to
 * read edge by edge.
 *
 * @public
 */
export function buildFlowEdges(
  citations: readonly NetworkEdge[],
  roles: ReadonlyMap<string, NodeRole>
): Edge[] {
  return citations.map((citation) => {
    const key = edgeKey(citation);
    const role = roles.get(key) ?? UNRELATED;
    const style = roleStyle(role);
    const lit = role.tier !== 'none';

    return {
      id: key,
      source: citation.citingUri,
      target: citation.citedUri,
      type: 'straight',
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: lit ? 18 : 14,
        height: lit ? 18 : 14,
        color: style.stroke,
      },
      style: {
        stroke: style.stroke,
        strokeWidth: lit ? 1.8 : 1,
        opacity: lit ? 0.9 : 0.25,
        ...(lit ? {} : { strokeDasharray: '4 4' }),
      },
      // Lit edges paint over the background, so a neighbourhood reads as one
      // shape rather than as lines crossing a mesh.
      zIndex: lit ? 1 : 0,
    };
  });
}

/**
 * The papers one hop from a given paper, including itself.
 *
 * @param uri - The paper at the centre
 * @param citations - Every citation in the network
 * @returns URIs of the paper and everything directly attached to it
 *
 * @remarks
 * What the view opens on. Fitting the whole network into the viewport gives a
 * field of unreadable dots and leaves the reader to find their own paper in it;
 * zooming out from a neighbourhood is a gesture, searching a full graph is not.
 *
 * @public
 */
export function neighbourhoodOf(uri: string, citations: readonly NetworkEdge[]): string[] {
  const around = new Set<string>([uri]);
  for (const citation of citations) {
    if (citation.citingUri === uri) around.add(citation.citedUri);
    if (citation.citedUri === uri) around.add(citation.citingUri);
  }
  return [...around];
}
