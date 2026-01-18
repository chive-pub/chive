/**
 * Relation type definitions for unified knowledge graph.
 *
 * @remarks
 * Defines all relation types available in the edge model.
 * Relation types are themselves nodes with `kind=type` and `subkind=relation`.
 *
 * @packageDocumentation
 */

/**
 * Relation type definition for seeding.
 */
export interface RelationDefinition {
  /** Human-readable slug (e.g., 'broader', 'narrower') */
  readonly slug: string;
  /** Display label */
  readonly label: string;
  /** Description of what this relation represents */
  readonly description: string;
  /** Inverse relation slug (for bidirectional relations) */
  readonly inverseSlug?: string;
  /** Whether this relation is symmetric (same as inverse) */
  readonly symmetric?: boolean;
  /** SKOS concept URI if applicable */
  readonly skosUri?: string;
  /** Wikidata property ID if applicable */
  readonly wikidataProperty?: string;
}

/**
 * All relation type definitions.
 *
 * @remarks
 * These are seeded as type nodes (kind=type, subkind=relation).
 * Each relation can be used in edges to connect nodes.
 */
export const RELATIONS: readonly RelationDefinition[] = [
  // =============================================================================
  // SKOS-based hierarchical relations
  // =============================================================================
  {
    slug: 'broader',
    label: 'Broader',
    description: 'Parent/superclass relationship (SKOS broader)',
    inverseSlug: 'narrower',
    skosUri: 'http://www.w3.org/2004/02/skos/core#broader',
    wikidataProperty: 'P279', // subclass of
  },
  {
    slug: 'narrower',
    label: 'Narrower',
    description: 'Child/subclass relationship (SKOS narrower)',
    inverseSlug: 'broader',
    skosUri: 'http://www.w3.org/2004/02/skos/core#narrower',
  },

  // =============================================================================
  // SKOS-based associative relations
  // =============================================================================
  {
    slug: 'related',
    label: 'Related',
    description: 'Associated but not hierarchical (SKOS related)',
    symmetric: true,
    skosUri: 'http://www.w3.org/2004/02/skos/core#related',
    wikidataProperty: 'P527', // has part
  },
  {
    slug: 'exact-match',
    label: 'Exact Match',
    description: 'Same concept in different vocabularies (SKOS exactMatch)',
    symmetric: true,
    skosUri: 'http://www.w3.org/2004/02/skos/core#exactMatch',
    wikidataProperty: 'P2888', // exact match
  },
  {
    slug: 'close-match',
    label: 'Close Match',
    description: 'Similar concept in different vocabularies (SKOS closeMatch)',
    symmetric: true,
    skosUri: 'http://www.w3.org/2004/02/skos/core#closeMatch',
  },

  // =============================================================================
  // Domain-specific relations
  // =============================================================================
  {
    slug: 'has-value',
    label: 'Has Value',
    description: 'Facet dimension has this value as a valid option',
    inverseSlug: 'value-of',
  },
  {
    slug: 'value-of',
    label: 'Value Of',
    description: 'Node is a valid value for this facet dimension',
    inverseSlug: 'has-value',
  },
  {
    slug: 'interdisciplinary-with',
    label: 'Interdisciplinary With',
    description: 'Cross-domain connection between fields',
    symmetric: true,
  },
  {
    slug: 'supersedes',
    label: 'Supersedes',
    description: 'Replaces deprecated term',
    inverseSlug: 'superseded-by',
  },
  {
    slug: 'superseded-by',
    label: 'Superseded By',
    description: 'Replaced by newer term',
    inverseSlug: 'supersedes',
  },

  // =============================================================================
  // Organizational relations
  // =============================================================================
  {
    slug: 'affiliated-with',
    label: 'Affiliated With',
    description: 'Institutional affiliation (person to institution)',
    wikidataProperty: 'P108', // employer
  },
  {
    slug: 'part-of',
    label: 'Part Of',
    description: 'Compositional relationship',
    inverseSlug: 'has-part',
    wikidataProperty: 'P361', // part of
  },
  {
    slug: 'has-part',
    label: 'Has Part',
    description: 'Contains component',
    inverseSlug: 'part-of',
    wikidataProperty: 'P527', // has part
  },
  {
    slug: 'located-in',
    label: 'Located In',
    description: 'Geographic location relationship',
    wikidataProperty: 'P131', // located in administrative territorial entity
  },
  {
    slug: 'member-of',
    label: 'Member Of',
    description: 'Membership in organization or group',
    wikidataProperty: 'P463', // member of
  },

  // =============================================================================
  // Research-specific relations
  // =============================================================================
  {
    slug: 'studies',
    label: 'Studies',
    description: 'Field studies a topic',
    inverseSlug: 'studied-by',
  },
  {
    slug: 'studied-by',
    label: 'Studied By',
    description: 'Topic is studied by a field',
    inverseSlug: 'studies',
  },
  {
    slug: 'applies-to',
    label: 'Applies To',
    description: 'Methodology applies to a domain',
    inverseSlug: 'applied-in',
  },
  {
    slug: 'applied-in',
    label: 'Applied In',
    description: 'Domain uses a methodology',
    inverseSlug: 'applies-to',
  },
];

/**
 * Get relation by slug.
 */
export function getRelation(slug: string): RelationDefinition | undefined {
  return RELATIONS.find((r) => r.slug === slug);
}

/**
 * Get inverse relation slug if it exists.
 */
export function getInverseRelation(slug: string): string | undefined {
  const relation = getRelation(slug);
  if (!relation) return undefined;
  if (relation.symmetric) return slug;
  return relation.inverseSlug;
}

/**
 * Get all hierarchical relations (broader/narrower family).
 */
export function getHierarchicalRelations(): readonly RelationDefinition[] {
  return RELATIONS.filter((r) => r.slug === 'broader' || r.slug === 'narrower');
}

/**
 * Get all associative (non-hierarchical) relations.
 */
export function getAssociativeRelations(): readonly RelationDefinition[] {
  return RELATIONS.filter((r) => r.slug !== 'broader' && r.slug !== 'narrower');
}
