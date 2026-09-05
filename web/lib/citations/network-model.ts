/**
 * What each node and edge in a citation network means to the reader.
 *
 * @remarks
 * The network draws two things at once: where one paper sits among the others,
 * and where a second paper the reader clicked sits. Both need the same three
 * distinctions -- this paper, the papers it cites, the papers that cite it --
 * and they have to be told apart without either one disappearing.
 *
 * So a node carries a relation and a tier. The relation says what it is to
 * whichever paper it is being read against; the tier says which paper that was.
 * The paper the reader arrived on always wins the tier, which is what keeps it
 * legible while they explore: clicking around the graph never repaints the
 * paper they came for.
 *
 * Colour is derived from the pair rather than stored, so a node cannot end up
 * labelled one thing and painted another.
 *
 * @packageDocumentation
 */

/** What a node is, relative to the paper it is being read against. */
export type NodeRelation =
  /** The paper being read against. */
  | 'anchor'
  /** A paper the anchor cites. */
  | 'reference'
  /** A paper that cites the anchor. */
  | 'citer'
  /** Neither, and not the anchor. */
  | 'none';

/** Which anchor a node's relation was computed against. */
export type Tier =
  /** The paper the reader arrived on. Drawn solid. */
  | 'primary'
  /** A paper the reader clicked while exploring. Drawn pale. */
  | 'secondary'
  /** Attached to neither. Drawn as background. */
  | 'none';

/** A node's place in the network. */
export interface NodeRole {
  readonly relation: NodeRelation;
  readonly tier: Tier;
}

/** One directed citation. */
export interface NetworkEdge {
  readonly citingUri: string;
  readonly citedUri: string;
  readonly isInfluential?: boolean;
}

/** Which papers the reader is currently reading the network against. */
export interface NetworkAnchors {
  /** The paper whose page the reader came from. */
  readonly focusUri?: string;
  /** A paper they clicked while exploring. */
  readonly selectedUri?: string;
}

/**
 * The colours the network is drawn in.
 *
 * @remarks
 * Fixed hex rather than theme tokens. The previous graph styled its edges
 * `stroke: var(--green-500)`, a variable this application has never defined, so
 * every edge resolved to nothing and the network rendered as scattered boxes
 * with no lines between them at all. A palette a stylesheet cannot silently
 * withdraw is worth more here than one that matches the theme.
 *
 * The three hues are mid-tone on purpose: each reads against both the light and
 * the dark ground, so one palette serves both themes. The pale tier is the same
 * hue at low alpha rather than a lighter colour, for the same reason -- a
 * translucent fill sits correctly on either ground, a fixed pale one does not.
 *
 * @public
 */
export const NETWORK_COLORS = {
  /** Mustard, for the paper being read against. Sits beside Chive's green. */
  anchor: '#C99700',
  /** Red, for papers the anchor cites. */
  reference: '#C4443A',
  /** Blue, for papers that cite the anchor. */
  citer: '#2E6FB7',
  /** Slate, for the rest of the network. */
  none: '#94A3B8',
} as const satisfies Record<NodeRelation, string>;

/** How a node or edge should be painted. */
export interface RoleStyle {
  /** Border and edge stroke. */
  readonly stroke: string;
  /** Node fill. */
  readonly fill: string;
  /** Label colour. */
  readonly text: string;
  /** Edge and node opacity. */
  readonly opacity: number;
}

/**
 * Turns a role into the colours it is drawn in.
 *
 * @param role - The node's relation and tier
 * @returns Stroke, fill, text colour and opacity
 *
 * @remarks
 * The primary tier is solid and the secondary pale, in the same hue. That is
 * the whole mechanism by which a reader can click through the graph without
 * losing the paper they started from.
 *
 * @public
 */
export function roleStyle(role: NodeRole): RoleStyle {
  const base = NETWORK_COLORS[role.relation];

  if (role.tier === 'primary') {
    return { stroke: base, fill: base, text: '#FFFFFF', opacity: 1 };
  }
  if (role.tier === 'secondary') {
    return { stroke: base, fill: withAlpha(base, 0.22), text: base, opacity: 1 };
  }
  return {
    stroke: NETWORK_COLORS.none,
    fill: withAlpha(NETWORK_COLORS.none, 0.14),
    text: 'currentColor',
    opacity: 0.55,
  };
}

/**
 * Restates a hex colour as rgba at a given alpha.
 *
 * @param hex - A six-digit `#rrggbb` colour
 * @param alpha - Opacity between 0 and 1
 * @returns The same colour, translucent
 *
 * @public
 */
export function withAlpha(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${String(r)}, ${String(g)}, ${String(b)}, ${String(alpha)})`;
}

/**
 * The citing and cited neighbours of one paper.
 *
 * @param uri - The paper to read the network against
 * @param edges - Every citation in the network
 * @returns Papers it cites, and papers that cite it
 *
 * @public
 */
export function neighboursOf(
  uri: string,
  edges: readonly NetworkEdge[]
): { references: Set<string>; citers: Set<string> } {
  const references = new Set<string>();
  const citers = new Set<string>();

  for (const edge of edges) {
    if (edge.citingUri === uri) references.add(edge.citedUri);
    if (edge.citedUri === uri) citers.add(edge.citingUri);
  }

  return { references, citers };
}

/**
 * Assigns every paper in the network its role.
 *
 * @param uris - Every paper in the network
 * @param edges - Every citation in the network
 * @param anchors - The papers the reader is reading it against
 * @returns A role per paper
 *
 * @remarks
 * The focus wins every contest. A paper that cites the focus and is also cited
 * by the reader's current selection is drawn as a citer of the focus, solidly:
 * the alternative repaints part of the original neighbourhood every time the
 * reader clicks elsewhere, which is the behaviour that makes an explorable
 * graph disorienting rather than useful.
 *
 * A paper is its own anchor even with no edges, so a focused paper still
 * appears when nothing cites it -- though the network as a whole will be empty
 * in that case, which the caller handles.
 *
 * @public
 */
export function assignRoles(
  uris: readonly string[],
  edges: readonly NetworkEdge[],
  anchors: NetworkAnchors
): Map<string, NodeRole> {
  const roles = new Map<string, NodeRole>();

  const focus = anchors.focusUri;
  const selected = anchors.selectedUri === anchors.focusUri ? undefined : anchors.selectedUri;

  const focusLinks = focus ? neighboursOf(focus, edges) : undefined;
  const selectedLinks = selected ? neighboursOf(selected, edges) : undefined;

  for (const uri of uris) {
    roles.set(uri, {
      relation:
        relationTo(uri, focus, focusLinks) ?? relationTo(uri, selected, selectedLinks) ?? 'none',
      tier: relationTo(uri, focus, focusLinks)
        ? 'primary'
        : relationTo(uri, selected, selectedLinks)
          ? 'secondary'
          : 'none',
    });
  }

  return roles;
}

/**
 * What one paper is to an anchor, or nothing when it is unrelated.
 *
 * @param uri - The paper being classified
 * @param anchor - The paper it is read against, when there is one
 * @param links - That anchor's neighbours
 * @returns The relation, or undefined when there is none
 */
function relationTo(
  uri: string,
  anchor: string | undefined,
  links: { references: Set<string>; citers: Set<string> } | undefined
): NodeRelation | undefined {
  if (!anchor || !links) return undefined;
  if (uri === anchor) return 'anchor';
  if (links.references.has(uri)) return 'reference';
  if (links.citers.has(uri)) return 'citer';
  return undefined;
}

/**
 * Assigns every citation its role.
 *
 * @param edges - Every citation in the network
 * @param anchors - The papers the reader is reading it against
 * @returns A role per edge, keyed as `citingUri->citedUri`
 *
 * @remarks
 * An edge takes the colour of the direction it runs relative to its anchor:
 * away from the anchor is a reference and reads red, into the anchor is a
 * citation and reads blue. That is the same rule the nodes follow, so an edge
 * and the node it lands on always agree.
 *
 * @public
 */
export function assignEdgeRoles(
  edges: readonly NetworkEdge[],
  anchors: NetworkAnchors
): Map<string, NodeRole> {
  const roles = new Map<string, NodeRole>();
  const focus = anchors.focusUri;
  const selected = anchors.selectedUri === anchors.focusUri ? undefined : anchors.selectedUri;

  for (const edge of edges) {
    const key = edgeKey(edge);
    if (focus && edge.citingUri === focus)
      roles.set(key, { relation: 'reference', tier: 'primary' });
    else if (focus && edge.citedUri === focus)
      roles.set(key, { relation: 'citer', tier: 'primary' });
    else if (selected && edge.citingUri === selected)
      roles.set(key, { relation: 'reference', tier: 'secondary' });
    else if (selected && edge.citedUri === selected)
      roles.set(key, { relation: 'citer', tier: 'secondary' });
    else roles.set(key, { relation: 'none', tier: 'none' });
  }

  return roles;
}

/**
 * The stable identity of an edge.
 *
 * @param edge - The citation
 * @returns A key unique to the ordered pair
 *
 * @public
 */
export function edgeKey(edge: NetworkEdge): string {
  return `${edge.citingUri}->${edge.citedUri}`;
}

/**
 * Every paper named by a set of citations, plus the focus.
 *
 * @param edges - Every citation in the network
 * @param focusUri - The focused paper, which belongs in the network even when
 * nothing cites it
 * @returns Paper URIs, once each
 *
 * @public
 */
export function urisIn(edges: readonly NetworkEdge[], focusUri?: string): string[] {
  const uris = new Set<string>();
  if (focusUri) uris.add(focusUri);
  for (const edge of edges) {
    uris.add(edge.citingUri);
    uris.add(edge.citedUri);
  }
  return [...uris];
}
