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

import { edgeKey, roleStyle, withAlpha, type NetworkEdge, type NodeRole } from './network-model';
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
 * The diameter of an unlabelled node.
 *
 * @remarks
 * A paper more than one citation from whatever is being read against carries no
 * text at all. A few dozen names is a network; a few hundred is a wall of
 * words, and the names worth reading are the ones beside the paper in hand. The
 * rest are the shape of the field around it, which a dot conveys and a label
 * obscures.
 *
 * @public
 */
export const DOT_SIZE = 12;

/**
 * The size a node is drawn at, which depends on whether it is labelled.
 *
 * @param role - The node's place in the network
 * @returns Its width and height
 *
 * @public
 */
export function sizeFor(role: NodeRole): { width: number; height: number } {
  return role.tier === 'none'
    ? { width: DOT_SIZE, height: DOT_SIZE }
    : { width: NODE_WIDTH, height: NODE_HEIGHT };
}

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
  return [...positions.entries()].map(([uri, position]) => {
    const role = roles.get(uri) ?? UNRELATED;
    const size = sizeFor(role);
    return {
      id: uri,
      type: 'paper',
      // An unlabelled dot is centred where its pill would have been, so a paper
      // does not jump across the canvas when selecting something makes it grow
      // a label.
      position: {
        x: position.x + (NODE_WIDTH - size.width) / 2,
        y: position.y + (NODE_HEIGHT - size.height) / 2,
      },
      width: size.width,
      height: size.height,
      data: { label: nodeLabel(papers.get(uri), uri), role, uri },
    };
  });
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
  const built = citations.map((citation) => {
    const key = edgeKey(citation);
    const role = roles.get(key) ?? UNRELATED;
    const style = roleStyle(role);
    const lit = role.tier !== 'none';

    // The fade is carried in the colour rather than in `opacity`. Element
    // opacity applies to the path and the arrowhead alike, so wherever the line
    // runs under the marker the two composite together and the line shows
    // through the arrowhead as a darker streak. One solid colour on both makes
    // the overlap invisible.
    const colour = lit ? style.stroke : withAlpha(style.stroke, 0.28);

    return {
      lit,
      edge: {
        id: key,
        source: citation.citingUri,
        target: citation.citedUri,
        type: 'floating',
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: lit ? 18 : 14,
          height: lit ? 18 : 14,
          color: colour,
        },
        style: {
          stroke: colour,
          strokeWidth: lit ? 1.8 : 1,
          ...(lit ? {} : { strokeDasharray: '4 4' }),
        },
      } satisfies Edge,
    };
  });

  // Lit edges paint over the background ones, so a neighbourhood reads as one
  // shape rather than as lines crossing a mesh -- but by ordering rather than
  // by `zIndex`. An explicit zIndex lifts an edge out of the edge layer, which
  // React Flow draws beneath the nodes, and put every lit arrow on top of the
  // papers it runs between. Within the layer, later is painted higher.
  return [...built.filter((e) => !e.lit), ...built.filter((e) => e.lit)].map((e) => e.edge);
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
