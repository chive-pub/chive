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
  /** Whether this relation is symmetric (A rel B implies B rel A) */
  readonly symmetric?: boolean;
  /** Whether this relation is transitive (A rel B and B rel C implies A rel C) */
  readonly transitive?: boolean;
  /** Whether this relation is reflexive (A rel A is always valid) */
  readonly reflexive?: boolean;
  /** Whether this relation is functional (each source has at most one target) */
  readonly functional?: boolean;
  /** SKOS concept URI if applicable */
  readonly skosUri?: string;
  /** Wikidata property ID if applicable */
  readonly wikidataProperty?: string;
  /**
   * Cosmik/Semble connection type when this relation is mirrored to
   * `network.cosmik.connection` records (cosmik.network ecosystem).
   */
  readonly cosmikConnectionType?: string;
  /** CiTO (Citation Typing Ontology) URI if applicable (SPAR Ontologies). */
  readonly citoUri?: string;
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
    transitive: true,
    skosUri: 'http://www.w3.org/2004/02/skos/core#broader',
    wikidataProperty: 'P279', // subclass of
  },
  {
    slug: 'narrower',
    label: 'Narrower',
    description: 'Child/subclass relationship (SKOS narrower)',
    inverseSlug: 'broader',
    transitive: true,
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
    cosmikConnectionType: 'RELATED',
  },
  {
    slug: 'exact-match',
    label: 'Exact Match',
    description: 'Same concept in different vocabularies (SKOS exactMatch)',
    symmetric: true,
    transitive: true,
    reflexive: true,
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
    transitive: true,
    wikidataProperty: 'P361', // part of
    cosmikConnectionType: 'PART_OF',
  },
  {
    slug: 'has-part',
    label: 'Has Part',
    description: 'Contains component',
    inverseSlug: 'part-of',
    transitive: true,
    wikidataProperty: 'P527', // has part
    cosmikConnectionType: 'HAS_PART',
  },
  {
    slug: 'located-in',
    label: 'Located In',
    description: 'Geographic location relationship',
    transitive: true,
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

  // =============================================================================
  // Academic / citation relations (CiTO-aligned)
  // =============================================================================
  {
    slug: 'cites',
    label: 'Cites',
    description: 'Work formally references another work',
    inverseSlug: 'cited-by',
    citoUri: 'http://purl.org/spar/cito/cites',
    wikidataProperty: 'P2860', // cites work
    cosmikConnectionType: 'REFERENCES',
  },
  {
    slug: 'cited-by',
    label: 'Cited By',
    description: 'Work is formally referenced by another work',
    inverseSlug: 'cites',
    citoUri: 'http://purl.org/spar/cito/isCitedBy',
    cosmikConnectionType: 'CITED_BY',
  },
  {
    slug: 'builds-on',
    label: 'Builds On',
    description: 'Derivative work extending prior work',
    inverseSlug: 'extended-by',
    citoUri: 'http://purl.org/spar/cito/extends',
    cosmikConnectionType: 'BUILDS_ON',
  },
  {
    slug: 'extended-by',
    label: 'Extended By',
    description: 'Earlier work extended by a derivative',
    inverseSlug: 'builds-on',
    citoUri: 'http://purl.org/spar/cito/isExtendedBy',
    cosmikConnectionType: 'EXTENDED_BY',
  },
  {
    slug: 'supports',
    label: 'Supports',
    description: 'Work corroborates or substantiates another',
    inverseSlug: 'supported-by',
    citoUri: 'http://purl.org/spar/cito/confirms',
    cosmikConnectionType: 'SUPPORTS',
  },
  {
    slug: 'supported-by',
    label: 'Supported By',
    description: 'Work is corroborated by another',
    inverseSlug: 'supports',
    citoUri: 'http://purl.org/spar/cito/isConfirmedBy',
  },
  {
    slug: 'contradicts',
    label: 'Contradicts',
    description: 'Work disputes or disagrees with another',
    inverseSlug: 'contradicted-by',
    citoUri: 'http://purl.org/spar/cito/disagreesWith',
    cosmikConnectionType: 'OPPOSES',
  },
  {
    slug: 'contradicted-by',
    label: 'Contradicted By',
    description: 'Work is disputed by another',
    inverseSlug: 'contradicts',
    citoUri: 'http://purl.org/spar/cito/isDisagreedWithBy',
  },
  {
    slug: 'replicates',
    label: 'Replicates',
    description: 'Work replicates findings of another',
    inverseSlug: 'replicated-by',
    citoUri: 'http://purl.org/spar/cito/includesExcerptFrom',
    cosmikConnectionType: 'REPLICATES',
  },
  {
    slug: 'replicated-by',
    label: 'Replicated By',
    description: 'Work is replicated by another',
    inverseSlug: 'replicates',
  },
  {
    slug: 'explains',
    label: 'Explains',
    description: 'Work elaborates or clarifies another',
    inverseSlug: 'explained-by',
    citoUri: 'http://purl.org/spar/cito/discusses',
    cosmikConnectionType: 'EXPLAINER',
  },
  {
    slug: 'explained-by',
    label: 'Explained By',
    description: 'Work is explained by another',
    inverseSlug: 'explains',
    citoUri: 'http://purl.org/spar/cito/isDiscussedBy',
  },
  {
    slug: 'supplements',
    label: 'Supplements',
    description: 'Work provides supplementary material for another',
    inverseSlug: 'supplemented-by',
    citoUri: 'http://purl.org/spar/cito/providesDataFor',
    cosmikConnectionType: 'SUPPLEMENT',
  },
  {
    slug: 'supplemented-by',
    label: 'Supplemented By',
    description: 'Work is supplemented by another',
    inverseSlug: 'supplements',
    citoUri: 'http://purl.org/spar/cito/hasReplyFrom',
  },
  {
    slug: 'depends-on',
    label: 'Depends On',
    description: 'Work requires or builds upon another as prerequisite',
    inverseSlug: 'depended-on-by',
    cosmikConnectionType: 'DEPENDS_ON',
  },
  {
    slug: 'depended-on-by',
    label: 'Depended On By',
    description: 'Work is a prerequisite for another',
    inverseSlug: 'depends-on',
  },
  {
    slug: 'leads-to',
    label: 'Leads To',
    description: 'Work leads naturally to another (sequential reading order)',
    inverseSlug: 'follows-from',
    cosmikConnectionType: 'LEADS_TO',
  },
  {
    slug: 'follows-from',
    label: 'Follows From',
    description: 'Work follows from another',
    inverseSlug: 'leads-to',
  },
  {
    slug: 'addresses',
    label: 'Addresses',
    description: 'Work addresses a question, problem, or phenomenon',
    inverseSlug: 'addressed-by',
    cosmikConnectionType: 'ADDRESSES',
  },
  {
    slug: 'addressed-by',
    label: 'Addressed By',
    description: 'Question/problem is addressed by a work',
    inverseSlug: 'addresses',
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
