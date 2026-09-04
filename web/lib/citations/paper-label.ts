/**
 * Naming a paper the way a reader would cite it.
 *
 * @remarks
 * The citation graph stores only URIs on its nodes, so an edge read back from
 * it carries nothing recognisable. Both surfaces that draw citations — the
 * network graph and the summary list — need the same answer, and a copy in each
 * is how one of them comes to render an AT-URI while the other reads correctly.
 *
 * @packageDocumentation
 */

/**
 * A paper as the citation API names it.
 *
 * @public
 */
export interface CitedPaper {
  readonly uri: string;
  readonly title: string;
  readonly authors?: readonly string[];
  readonly year?: number;
  readonly venue?: string;
}

/**
 * Renders a paper as a reader would refer to it.
 *
 * @param paper - The paper, when the API named it
 * @param fallback - What to show when it did not
 * @returns A label a reader can recognise
 *
 * @remarks
 * First author's surname, year, then the title — how a citation is spoken. The
 * surname alone, because the full name crowds a node and a list row alike.
 */
export function paperLabel(paper: CitedPaper | undefined, fallback: string): string {
  if (!paper) return fallback;

  const first = paper.authors?.[0];
  const surname = first?.trim().split(/\s+/).pop();
  const byline = [surname, paper.year ? String(paper.year) : undefined].filter(Boolean).join(' ');

  const title = paper.title.length > 44 ? `${paper.title.slice(0, 44)}...` : paper.title;
  return byline ? `${byline} — ${title}` : title;
}

/**
 * Indexes the papers a citation response names, by URI.
 *
 * @param papers - The `papers` array from a citation response
 * @returns A lookup for the edges to resolve against
 */
export function papersByUri(papers: readonly CitedPaper[] | undefined): Map<string, CitedPaper> {
  return new Map((papers ?? []).map((paper) => [paper.uri, paper]));
}
