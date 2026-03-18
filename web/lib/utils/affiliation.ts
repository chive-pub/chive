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
