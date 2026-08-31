/**
 * Affiliation tree formatting utilities.
 *
 * @packageDocumentation
 */

/**
 * Minimal affiliation node shape for formatting.
 */
interface AffNode {
  name: string;
  children?: AffNode[];
}

const MAX_DEPTH = 10;

/**
 * Collects all root-to-leaf paths from an affiliation tree.
 *
 * Given a tree like:
 *   University of Rochester
 *     School of Arts and Sciences
 *       Department of Linguistics
 *       Department of Computer Science
 *     School of Medicine
 *
 * Returns:
 *   ["University of Rochester > School of Arts and Sciences > Department of Linguistics",
 *    "University of Rochester > School of Arts and Sciences > Department of Computer Science",
 *    "University of Rochester > School of Medicine"]
 *
 * If the node has no children, returns a single path with just the node name.
 */
export function getAffiliationPaths(aff: AffNode, separator = ' > '): string[] {
  const paths: string[] = [];
  collectPaths(aff, [], paths, 0, separator);
  return paths;
}

function collectPaths(
  node: AffNode,
  prefix: string[],
  paths: string[],
  depth: number,
  separator: string
): void {
  const current = [...prefix, node.name];

  if (!node.children || node.children.length === 0 || depth >= MAX_DEPTH) {
    paths.push(current.join(separator));
    return;
  }

  for (const child of node.children) {
    collectPaths(child, current, paths, depth + 1, separator);
  }
}

/**
 * Formats a single affiliation for compact display (e.g., tooltips, badges).
 * If the tree has multiple paths, joins them with "; ".
 */
export function formatAffiliationCompact(aff: AffNode): string {
  return getAffiliationPaths(aff, ' > ').join('; ');
}

/**
 * An affiliation grouped for display: the institution, and its sub-units.
 *
 * @public
 */
export interface AffiliationDisplay {
  /** The root institution */
  institution: string;
  /** Each sub-unit path below the root, without the institution prefix */
  units: string[];
}

/**
 * Groups an affiliation tree by its institution.
 *
 * @param aff - Affiliation tree
 * @returns The root institution and the sub-unit paths beneath it
 *
 * @remarks
 * {@link getAffiliationPaths} returns one fully-qualified path per leaf, so a
 * profile listing three departments at one university produced three lines that
 * each repeated the university's name — and with several affiliations the
 * header became a wall of near-identical long strings. Naming the institution
 * once and listing what sits under it says the same thing in a fraction of the
 * space, and it is how affiliations are conventionally written.
 *
 * A leaf-only affiliation returns no units, which renders as the institution
 * alone.
 *
 * @public
 */
export function getAffiliationDisplay(aff: AffNode, separator = ' > '): AffiliationDisplay {
  const paths = getAffiliationPaths(aff, separator);
  const prefix = `${aff.name}${separator}`;

  const units = paths
    .filter((path) => path !== aff.name)
    .map((path) => (path.startsWith(prefix) ? path.slice(prefix.length) : path));

  return { institution: aff.name, units };
}
