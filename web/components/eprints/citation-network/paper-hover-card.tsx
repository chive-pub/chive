'use client';

/**
 * A paper as a bibliography entry, shown while the cursor is over its node.
 *
 * @remarks
 * The nodes carry only a surname and a year, because a network of a few hundred
 * papers cannot show more without becoming a wall of text -- the previous view
 * put a title and two badges on every node and could only ever draw four of
 * them. Everything else about a paper belongs here, where it costs nothing
 * until it is asked for.
 *
 * One card serves the whole graph, positioned at the cursor, rather than one
 * per node. A card per node means a portal per node, which is a real cost at
 * the sizes this view is meant to reach.
 *
 * @packageDocumentation
 */

import { formatAuthorList, type CitedPaper } from '@/lib/citations/paper-label';
import { roleStyle, type NodeRole } from '@/lib/citations/network-model';

/** Props for {@link PaperHoverCard}. */
export interface PaperHoverCardProps {
  /** The paper under the cursor. */
  readonly paper: CitedPaper;
  /** What it is to the papers the reader is reading the network against. */
  readonly role: NodeRole;
  /** Where to draw the card, in pixels within the graph. */
  readonly at: { readonly x: number; readonly y: number };
  /** How wide the graph is, so the card can flip rather than overflow. */
  readonly width: number;
}

/** What a role says in words. */
function describeRole(role: NodeRole): string | undefined {
  if (role.tier === 'none') return undefined;
  const anchor = role.tier === 'primary' ? 'this paper' : 'the selected paper';
  if (role.relation === 'anchor') return role.tier === 'primary' ? 'This paper' : 'Selected';
  if (role.relation === 'reference') return `Cited by ${anchor}`;
  if (role.relation === 'citer') return `Cites ${anchor}`;
  return undefined;
}

/**
 * Renders the bibliography entry for one paper.
 *
 * @param props - Component props
 * @returns The card
 *
 * @public
 */
export function PaperHoverCard({ paper, role, at, width }: PaperHoverCardProps) {
  const authors = formatAuthorList(paper.authors);
  const relation = describeRole(role);
  const style = roleStyle(role);

  // Flip to the left of the cursor when there is no room on the right, so the
  // card never leaves the canvas it is describing.
  const cardWidth = 320;
  const flip = at.x + cardWidth + 24 > width;

  return (
    <div
      role="tooltip"
      data-testid="paper-hover-card"
      className="pointer-events-none absolute z-50 rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg"
      style={{
        width: cardWidth,
        left: flip ? at.x - cardWidth - 12 : at.x + 12,
        top: at.y + 12,
        borderColor: style.stroke,
      }}
    >
      {relation && (
        <p className="mb-1 text-xs font-medium" style={{ color: style.stroke }}>
          {relation}
        </p>
      )}
      <p className="text-sm font-medium leading-snug">{paper.title}</p>
      {authors && <p className="mt-1 text-xs text-muted-foreground">{authors}</p>}
      <p className="mt-1 text-xs text-muted-foreground">
        {[paper.year !== undefined ? String(paper.year) : undefined, paper.venue]
          .filter(Boolean)
          .join(' · ')}
      </p>
      {paper.doi && (
        <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{paper.doi}</p>
      )}
    </div>
  );
}
