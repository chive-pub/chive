/**
 * Naming a paper the way a reader would cite it.
 *
 * @remarks
 * The citation graph stores only URIs on its nodes, so an edge read back from
 * it carries nothing recognisable. Both surfaces that draw citations (the
 * network graph and the summary list) need the same answer, and a copy in each
 * is how one of them comes to render an AT-URI while the other reads correctly.
 *
 * The graph draws its node labels as plain strings, so {@link paperLabel}
 * returns one. The list can set the title in italics, so
 * {@link paperLabelParts} hands back the byline and the title separately. Both
 * go through {@link formatAuthors}, which is the part worth getting right.
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
 * A citation split into the part naming its authors and the part naming itself.
 *
 * @public
 */
export interface PaperLabelParts {
  /** Surnames and year, absent when the API gave neither. */
  readonly byline?: string;
  /** The paper's title, as given. */
  readonly title: string;
}

/**
 * Name fragments that belong to the surname rather than preceding it.
 *
 * @remarks
 * "Rens van de Schoot" is cited as van de Schoot, not as Schoot. Compared
 * case-insensitively, since usage is split on whether the particle is
 * capitalised.
 */
const NAME_PARTICLES: ReadonlySet<string> = new Set([
  'van',
  'von',
  'der',
  'den',
  'de',
  'del',
  'della',
  'di',
  'da',
  'dos',
  'das',
  'du',
  'la',
  'le',
  'lo',
  'ten',
  'ter',
  'bin',
  'ibn',
  'al',
  'abu',
]);

/**
 * Generational and honorific suffixes, which are not the surname.
 */
const NAME_SUFFIXES: ReadonlySet<string> = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'phd', 'md']);

/**
 * Lowercases a name token and drops the punctuation around it.
 */
function bare(token: string): string {
  return token.toLowerCase().replace(/[.,]/g, '');
}

/**
 * Takes the surname out of a written-out name.
 *
 * @param name - The name as the eprint record gives it
 * @returns The surname, or the whole name when it has no separable one
 *
 * @remarks
 * A citation is spoken by surname, and the full name crowds a graph node and a
 * list row alike. Three shapes are handled: "Grove, Julian" names the surname
 * first; "Martin Luther King Jr." ends in a suffix that is not a name; and
 * "Rens van de Schoot" carries particles that belong to the surname.
 *
 * A single-token name has no surname to find, so it is returned whole: taking
 * the last token of "Julian" would present a given name as a surname without
 * anything marking it as one.
 *
 * @public
 */
export function formatSurname(name: string): string {
  const trimmed = name.trim();
  if (trimmed === '') return '';

  // "Grove, Julian" gives the surname first, so take it as offered.
  const comma = trimmed.indexOf(',');
  if (comma > 0) return trimmed.slice(0, comma).trim();

  const tokens = trimmed.split(/\s+/);
  while (tokens.length > 1 && NAME_SUFFIXES.has(bare(tokens[tokens.length - 1]))) {
    tokens.pop();
  }

  // Never walk past the first token: whatever else it is, it is not the surname
  // of a multi-word name.
  let start = tokens.length - 1;
  while (start > 1 && NAME_PARTICLES.has(bare(tokens[start - 1]))) {
    start -= 1;
  }

  return tokens.slice(start).join(' ');
}

/**
 * Lists a paper's authors as a citation would.
 *
 * @param authors - The author names the API gave, in order
 * @returns The author part of a byline, or undefined when there is none
 *
 * @remarks
 * One or two authors are both named; three or more become the first and "et
 * al.". Naming only the first author of a two-author paper misattributes it to
 * one of them, which is the thing a byline exists to avoid.
 *
 * @public
 */
export function formatAuthors(authors: readonly string[] | undefined): string | undefined {
  const surnames = (authors ?? []).map(formatSurname).filter((surname) => surname !== '');

  if (surnames.length === 0) return undefined;
  if (surnames.length === 1) return surnames[0];
  if (surnames.length === 2) return `${surnames[0]} and ${surnames[1]}`;
  return `${surnames[0]} et al.`;
}

/**
 * Splits a paper into the byline and the title, for a surface that can set the
 * title apart typographically.
 *
 * @param paper - The paper, as the citation API named it
 * @returns The byline (when there is one) and the title
 *
 * @public
 */
export function paperLabelParts(paper: CitedPaper): PaperLabelParts {
  const authors = formatAuthors(paper.authors);
  const year = paper.year !== undefined ? String(paper.year) : undefined;
  const byline = [authors, year].filter(Boolean).join(' ');

  return byline === '' ? { title: paper.title } : { byline, title: paper.title };
}

/**
 * Renders a paper as a single line, for a surface that can only take one.
 *
 * @param paper - The paper, when the API named it
 * @param fallback - What to show when it did not
 * @param maxTitleLength - Where to cut a title too long for the space
 * @returns A label a reader can recognise
 *
 * @remarks
 * Authors, then year, then title. The graph draws its node labels as plain
 * text, so this is where the title gets cut rather than wrapped; the summary
 * list uses {@link paperLabelParts} and lets its own layout do the truncating.
 *
 * @public
 */
export function paperLabel(
  paper: CitedPaper | undefined,
  fallback: string,
  maxTitleLength = 44
): string {
  if (!paper) return fallback;

  const { byline, title } = paperLabelParts(paper);
  const shown = title.length > maxTitleLength ? `${title.slice(0, maxTitleLength)}...` : title;

  return byline ? `${byline}. ${shown}` : shown;
}

/**
 * Indexes the papers a citation response names, by URI.
 *
 * @param papers - The `papers` array from a citation response
 * @returns A lookup for the edges to resolve against
 *
 * @public
 */
export function papersByUri(papers: readonly CitedPaper[] | undefined): Map<string, CitedPaper> {
  return new Map((papers ?? []).map((paper) => [paper.uri, paper]));
}
