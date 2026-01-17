/**
 * Facet dimension definitions.
 *
 * @remarks
 * Defines the 10 classification dimensions based on PMEST + FAST:
 *
 * **PMEST (5 conceptual dimensions):**
 * - personality: Discipline/domain perspective
 * - matter: Subject matter being studied
 * - energy: Methods/processes/techniques
 * - space: Geographic/spatial scope
 * - time: Temporal scope/period
 *
 * **FAST Entities (5 concrete dimensions):**
 * - person: Personal names as subjects
 * - organization: Corporate bodies
 * - event: Named events/conferences
 * - work: Titles of discussed works
 * - form-genre: Document types
 *
 * These are seeded as nodes with `subkind: 'facet'`. Facet values
 * (e.g., "Europe", "Meta-analysis") are separate nodes linked via
 * `has-value` edges.
 *
 * @see {@link https://www.oclc.org/research/areas/data-science/fast.html | FAST}
 * @see {@link https://en.wikipedia.org/wiki/Colon_classification | PMEST}
 *
 * @packageDocumentation
 */

/**
 * Facet dimension slugs.
 */
export type FacetDimension =
  | 'personality'
  | 'matter'
  | 'energy'
  | 'space'
  | 'time'
  | 'person'
  | 'organization'
  | 'event'
  | 'work'
  | 'form-genre';

/**
 * External mapping for authority linking.
 */
export interface ExternalMapping {
  readonly system: 'fast' | 'lcsh' | 'wikidata' | 'geonames' | 'skos';
  readonly identifier: string;
  readonly uri: string;
  readonly matchType: 'exact-match' | 'close-match' | 'related-match';
}

/**
 * Facet dimension definition.
 *
 * @remarks
 * Facets are classification dimensions, NOT values. Values are linked
 * via has-value edges.
 */
export interface FacetDefinition {
  /** Unique slug for the facet dimension */
  readonly slug: FacetDimension;
  /** Display label */
  readonly label: string;
  /** Description of what this dimension classifies */
  readonly description: string;
  /** Source framework (PMEST or FAST) */
  readonly framework: 'pmest' | 'fast';
  /** External authority mappings */
  readonly externalMappings: readonly ExternalMapping[];
  /** Display order in UI */
  readonly displayOrder: number;
}

// =============================================================================
// PMEST Facets (Conceptual Dimensions)
// =============================================================================

/**
 * PMEST-based classification dimensions.
 *
 * @remarks
 * Based on S.R. Ranganathan's Colon Classification (1933).
 * These represent abstract categories for classifying knowledge.
 */
export const PMEST_FACETS: readonly FacetDefinition[] = [
  {
    slug: 'personality',
    label: 'Discipline',
    description:
      'The primary discipline or domain perspective from which research is conducted. Answers: "What field is this from?"',
    framework: 'pmest',
    externalMappings: [
      {
        system: 'wikidata',
        identifier: 'Q11862829',
        uri: 'https://www.wikidata.org/wiki/Q11862829',
        matchType: 'close-match',
      },
    ],
    displayOrder: 1,
  },
  {
    slug: 'matter',
    label: 'Subject Matter',
    description: 'The subject matter or topic being studied. Answers: "What is being studied?"',
    framework: 'pmest',
    externalMappings: [
      {
        system: 'wikidata',
        identifier: 'Q24724',
        uri: 'https://www.wikidata.org/wiki/Q24724',
        matchType: 'close-match',
      },
    ],
    displayOrder: 2,
  },
  {
    slug: 'energy',
    label: 'Research Methodology',
    description: 'The methods, processes, or techniques employed. Answers: "How was it studied?"',
    framework: 'pmest',
    externalMappings: [
      {
        system: 'wikidata',
        identifier: 'Q1379672',
        uri: 'https://www.wikidata.org/wiki/Q1379672',
        matchType: 'close-match',
      },
    ],
    displayOrder: 3,
  },
  {
    slug: 'space',
    label: 'Geographic Focus',
    description: 'The geographic or spatial scope of the research. Answers: "Where does it apply?"',
    framework: 'pmest',
    externalMappings: [
      {
        system: 'wikidata',
        identifier: 'Q82794',
        uri: 'https://www.wikidata.org/wiki/Q82794',
        matchType: 'close-match',
      },
    ],
    displayOrder: 4,
  },
  {
    slug: 'time',
    label: 'Time Period',
    description:
      'The temporal scope or historical period of the research. Answers: "When does it apply?"',
    framework: 'pmest',
    externalMappings: [
      {
        system: 'wikidata',
        identifier: 'Q11471',
        uri: 'https://www.wikidata.org/wiki/Q11471',
        matchType: 'close-match',
      },
    ],
    displayOrder: 5,
  },
];

// =============================================================================
// FAST Entity Facets (Concrete Dimensions)
// =============================================================================

/**
 * FAST-based entity classification dimensions.
 *
 * @remarks
 * Based on OCLC's Faceted Application of Subject Terminology (FAST).
 * These represent concrete entity types that can be linked.
 */
export const FAST_FACETS: readonly FacetDefinition[] = [
  {
    slug: 'person',
    label: 'Person',
    description: 'Personal names mentioned as subjects of research. Answers: "Who is discussed?"',
    framework: 'fast',
    externalMappings: [
      {
        system: 'fast',
        identifier: 'fst00100',
        uri: 'https://id.worldcat.org/fast/facet/100',
        matchType: 'exact-match',
      },
    ],
    displayOrder: 6,
  },
  {
    slug: 'organization',
    label: 'Organization',
    description:
      'Corporate bodies, institutions, or organizations as subjects. Answers: "What organization is discussed?"',
    framework: 'fast',
    externalMappings: [
      {
        system: 'fast',
        identifier: 'fst00110',
        uri: 'https://id.worldcat.org/fast/facet/110',
        matchType: 'exact-match',
      },
    ],
    displayOrder: 7,
  },
  {
    slug: 'event',
    label: 'Event',
    description: 'Named events, conferences, or meetings. Answers: "What event is referenced?"',
    framework: 'fast',
    externalMappings: [
      {
        system: 'fast',
        identifier: 'fst00111',
        uri: 'https://id.worldcat.org/fast/facet/111',
        matchType: 'exact-match',
      },
    ],
    displayOrder: 8,
  },
  {
    slug: 'work',
    label: 'Work',
    description: 'Titles of works being discussed or analyzed. Answers: "What work is analyzed?"',
    framework: 'fast',
    externalMappings: [
      {
        system: 'fast',
        identifier: 'fst00130',
        uri: 'https://id.worldcat.org/fast/facet/130',
        matchType: 'exact-match',
      },
    ],
    displayOrder: 9,
  },
  {
    slug: 'form-genre',
    label: 'Document Type',
    description: 'The form or genre of the document. Answers: "What type of document is this?"',
    framework: 'fast',
    externalMappings: [
      {
        system: 'fast',
        identifier: 'fst00155',
        uri: 'https://id.worldcat.org/fast/facet/155',
        matchType: 'exact-match',
      },
    ],
    displayOrder: 10,
  },
];

// =============================================================================
// Combined Exports
// =============================================================================

/**
 * All 10 facet dimensions.
 */
export const FACET_DEFINITIONS: readonly FacetDefinition[] = [...PMEST_FACETS, ...FAST_FACETS];

/**
 * PMEST dimension slugs.
 */
export const PMEST_DIMENSIONS: readonly FacetDimension[] = [
  'personality',
  'matter',
  'energy',
  'space',
  'time',
];

/**
 * FAST dimension slugs.
 */
export const FAST_DIMENSIONS: readonly FacetDimension[] = [
  'person',
  'organization',
  'event',
  'work',
  'form-genre',
];

/**
 * All dimension slugs.
 */
export const ALL_DIMENSIONS: readonly FacetDimension[] = [...PMEST_DIMENSIONS, ...FAST_DIMENSIONS];

/**
 * Check if a slug is a PMEST dimension.
 */
export function isPMESTDimension(slug: string): slug is FacetDimension {
  return (PMEST_DIMENSIONS as readonly string[]).includes(slug);
}

/**
 * Check if a slug is a FAST dimension.
 */
export function isFASTDimension(slug: string): slug is FacetDimension {
  return (FAST_DIMENSIONS as readonly string[]).includes(slug);
}

/**
 * Get a facet definition by slug.
 */
export function getFacetDefinition(slug: string): FacetDefinition | undefined {
  return FACET_DEFINITIONS.find((f) => f.slug === slug);
}
