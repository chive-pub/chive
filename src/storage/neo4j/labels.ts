/**
 * Safe construction of Neo4j label identifiers.
 *
 * @remarks
 * Neo4j has no parameter binding for labels, so a label used in a `MATCH` must
 * be interpolated into the query string. Anything interpolated into Cypher is a
 * potential injection point, and node subkinds arrive from unauthenticated
 * callers via `pub.chive.graph.listNodes` and `pub.chive.graph.getHierarchy`.
 *
 * This module is the single place that turns a subkind slug into a label, so
 * the validation cannot be bypassed by a caller that builds the label itself.
 *
 * @packageDocumentation
 * @public
 */

import { ValidationError } from '../../types/errors.js';

/**
 * A valid Neo4j label: a letter followed by letters, digits, or underscores.
 *
 * @remarks
 * Deliberately narrower than Neo4j's own rules, which permit almost anything
 * inside backticks. Chive's subkinds are hyphenated slugs, so the PascalCase
 * form of a legitimate subkind always fits this shape.
 */
const SAFE_LABEL = /^[A-Za-z][A-Za-z0-9_]*$/;

/**
 * Converts a subkind slug to its Neo4j label, rejecting anything unsafe.
 *
 * @param subkind - Subkind slug, e.g. `field` or `research-method`
 * @returns The PascalCase label, e.g. `Field` or `ResearchMethod`
 *
 * @throws {ValidationError} If the resulting label is not a plain identifier
 *
 * @remarks
 * The previous implementations — duplicated in `adapter.ts` and
 * `node-repository.ts` — only capitalised and joined the hyphen-separated
 * parts. Parentheses, whitespace, and comment markers passed straight through
 * into the query, so a crafted `subkind` could close the `MATCH` pattern and
 * append arbitrary Cypher.
 *
 * @example
 * ```typescript
 * subkindToLabel('research-method'); // 'ResearchMethod'
 * subkindToLabel('a) DETACH DELETE n //'); // throws ValidationError
 * ```
 *
 * @public
 */
export function subkindToLabel(subkind: string): string {
  const label = subkind
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

  if (!SAFE_LABEL.test(label)) {
    throw new ValidationError(
      `Invalid subkind '${subkind}': must contain only letters, digits, hyphens and underscores`,
      'subkind',
      'format'
    );
  }

  return label;
}

/**
 * Converts a node kind to its Neo4j label.
 *
 * @param kind - Either `type` or `object`
 * @returns `Type` or `Object`
 *
 * @public
 */
export function kindToLabel(kind: 'type' | 'object'): string {
  return kind === 'type' ? 'Type' : 'Object';
}
