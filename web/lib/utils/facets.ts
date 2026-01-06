/**
 * PMEST and FAST facet type definitions for Chive frontend.
 *
 * @remarks
 * Provides type definitions and configuration for the 10-dimensional
 * faceted classification system used in Chive:
 * - PMEST (Ranganathan): Personality, Matter, Energy, Space, Time
 * - FAST (Library of Congress): Person, Organization, Event, Work, Form-Genre
 *
 * @packageDocumentation
 */

/**
 * PMEST dimension types (Ranganathan's Colon Classification).
 */
export type PMESTDimension = 'personality' | 'matter' | 'energy' | 'space' | 'time';

/**
 * FAST entity facet types (Library of Congress).
 */
export type FASTDimension = 'person' | 'organization' | 'event' | 'work' | 'form-genre';

/**
 * All facet dimension types (10 dimensions total).
 */
export type FacetDimension = PMESTDimension | FASTDimension;

/**
 * Configuration for a facet dimension.
 */
export interface FacetConfig {
  /** The dimension identifier */
  dimension: FacetDimension;
  /** Human-readable label */
  label: string;
  /** Lucide icon name */
  icon: string;
  /** Description of what this dimension represents */
  description: string;
  /** URL parameter key */
  paramKey: string;
  /** Example values */
  examples: string[];
}

/**
 * A single facet value with count.
 */
export interface FacetValue {
  /** The facet value */
  value: string;
  /** Human-readable label (may differ from value) */
  label?: string;
  /** Number of items with this facet value */
  count: number;
}

/**
 * Facet counts for all dimensions.
 */
export interface FacetCounts {
  personality?: FacetValue[];
  matter?: FacetValue[];
  energy?: FacetValue[];
  space?: FacetValue[];
  time?: FacetValue[];
  person?: FacetValue[];
  organization?: FacetValue[];
  event?: FacetValue[];
  work?: FacetValue[];
  'form-genre'?: FacetValue[];
}

/**
 * Selected facet filters.
 */
export interface FacetFilters {
  personality?: string[];
  matter?: string[];
  energy?: string[];
  space?: string[];
  time?: string[];
  person?: string[];
  organization?: string[];
  event?: string[];
  work?: string[];
  formGenre?: string[];
}

/**
 * PMEST facet configurations.
 */
export const PMEST_FACETS: Record<PMESTDimension, FacetConfig> = {
  personality: {
    dimension: 'personality',
    label: 'Personality',
    icon: 'Atom',
    description: 'Specific entities, objects, or phenomena being studied',
    paramKey: 'personality',
    examples: ['Proteins', 'COVID-19', 'BERT model', 'Quantum dots'],
  },
  matter: {
    dimension: 'matter',
    label: 'Matter',
    icon: 'BookOpen',
    description: 'Subject, discipline, or field of study',
    paramKey: 'matter',
    examples: ['Computer Science', 'Molecular Biology', 'Physics', 'Economics'],
  },
  energy: {
    dimension: 'energy',
    label: 'Energy',
    icon: 'Zap',
    description: 'Process, action, or operation being performed',
    paramKey: 'energy',
    examples: ['Classification', 'Synthesis', 'Prediction', 'Analysis'],
  },
  space: {
    dimension: 'space',
    label: 'Space',
    icon: 'Globe',
    description: 'Geographic location or spatial context',
    paramKey: 'space',
    examples: ['United States', 'Sub-Saharan Africa', 'Pacific Ocean', 'Global'],
  },
  time: {
    dimension: 'time',
    label: 'Time',
    icon: 'Clock',
    description: 'Temporal period or time frame',
    paramKey: 'time',
    examples: ['21st century', '2020-2024', 'Holocene', 'Real-time'],
  },
};

/**
 * FAST entity facet configurations.
 */
export const FAST_FACETS: Record<FASTDimension, FacetConfig> = {
  person: {
    dimension: 'person',
    label: 'Person',
    icon: 'User',
    description: 'People mentioned or studied in the work',
    paramKey: 'person',
    examples: ['Einstein, Albert', 'Darwin, Charles', 'Curie, Marie'],
  },
  organization: {
    dimension: 'organization',
    label: 'Organization',
    icon: 'Building',
    description: 'Organizations, institutions, or groups',
    paramKey: 'organization',
    examples: ['NASA', 'World Health Organization', 'CERN'],
  },
  event: {
    dimension: 'event',
    label: 'Event',
    icon: 'Calendar',
    description: 'Historical events or occurrences',
    paramKey: 'event',
    examples: ['COVID-19 pandemic', 'Industrial Revolution', 'Apollo 11'],
  },
  work: {
    dimension: 'work',
    label: 'Work',
    icon: 'FileText',
    description: 'Referenced works, theories, or datasets',
    paramKey: 'work',
    examples: ['Theory of Relativity', 'Human Genome Project', 'ImageNet'],
  },
  'form-genre': {
    dimension: 'form-genre',
    label: 'Form/Genre',
    icon: 'Tag',
    description: 'Document type or genre',
    paramKey: 'formGenre',
    examples: ['Review article', 'Meta-analysis', 'Case study', 'Survey'],
  },
};

/**
 * All facet configurations combined.
 */
export const ALL_FACETS: Record<FacetDimension, FacetConfig> = {
  ...PMEST_FACETS,
  ...FAST_FACETS,
};

/**
 * Array of PMEST dimensions in display order.
 */
export const PMEST_DIMENSIONS: PMESTDimension[] = [
  'personality',
  'matter',
  'energy',
  'space',
  'time',
];

/**
 * Array of FAST dimensions in display order.
 */
export const FAST_DIMENSIONS: FASTDimension[] = [
  'person',
  'organization',
  'event',
  'work',
  'form-genre',
];

/**
 * Array of all dimensions in display order.
 */
export const ALL_DIMENSIONS: FacetDimension[] = [...PMEST_DIMENSIONS, ...FAST_DIMENSIONS];

/**
 * Checks if a dimension is a PMEST dimension.
 *
 * @param dimension - The dimension to check
 * @returns True if the dimension is a PMEST dimension
 */
export function isPMESTDimension(dimension: string): dimension is PMESTDimension {
  return PMEST_DIMENSIONS.includes(dimension as PMESTDimension);
}

/**
 * Checks if a dimension is a FAST dimension.
 *
 * @param dimension - The dimension to check
 * @returns True if the dimension is a FAST dimension
 */
export function isFASTDimension(dimension: string): dimension is FASTDimension {
  return FAST_DIMENSIONS.includes(dimension as FASTDimension);
}

/**
 * Gets the configuration for a facet dimension.
 *
 * @param dimension - The dimension to get configuration for
 * @returns The facet configuration, or undefined if not found
 */
export function getFacetConfig(dimension: string): FacetConfig | undefined {
  return ALL_FACETS[dimension as FacetDimension];
}

/**
 * Counts the total number of active filters.
 *
 * @param filters - The facet filters
 * @returns Total count of active filter values
 */
export function countActiveFilters(filters: FacetFilters): number {
  return Object.values(filters).reduce((count, values) => count + (values?.length ?? 0), 0);
}

/**
 * Checks if any filters are active.
 *
 * @param filters - The facet filters
 * @returns True if any filters are active
 */
export function hasActiveFilters(filters: FacetFilters): boolean {
  return countActiveFilters(filters) > 0;
}

/**
 * Converts facet filters to URL search params.
 *
 * @param filters - The facet filters
 * @returns URLSearchParams object
 */
export function filtersToSearchParams(filters: FacetFilters): URLSearchParams {
  const params = new URLSearchParams();

  for (const [key, values] of Object.entries(filters)) {
    if (values && values.length > 0) {
      const config = getFacetConfig(key);
      const paramKey = config?.paramKey ?? key;
      for (const value of values) {
        params.append(paramKey, value);
      }
    }
  }

  return params;
}

/**
 * Parses URL search params into facet filters.
 *
 * @param searchParams - URLSearchParams to parse
 * @returns Parsed facet filters
 */
export function searchParamsToFilters(searchParams: URLSearchParams): FacetFilters {
  return {
    personality: searchParams.getAll('personality'),
    matter: searchParams.getAll('matter'),
    energy: searchParams.getAll('energy'),
    space: searchParams.getAll('space'),
    time: searchParams.getAll('time'),
    person: searchParams.getAll('person'),
    organization: searchParams.getAll('organization'),
    event: searchParams.getAll('event'),
    work: searchParams.getAll('work'),
    formGenre: searchParams.getAll('formGenre'),
  };
}

/**
 * Gets the human-readable label for a facet dimension.
 *
 * @param dimension - The dimension to get the label for
 * @returns The human-readable label
 */
export function getDimensionLabel(dimension: FacetDimension): string {
  return ALL_FACETS[dimension]?.label ?? dimension;
}

/**
 * Gets the Tailwind color class for a facet dimension.
 *
 * @param dimension - The dimension to get the color for
 * @returns Tailwind color class string
 */
export function getDimensionColor(dimension: FacetDimension): string {
  const colors: Record<FacetDimension, string> = {
    // PMEST dimensions (warm colors)
    personality: 'text-orange-600 dark:text-orange-400',
    matter: 'text-blue-600 dark:text-blue-400',
    energy: 'text-yellow-600 dark:text-yellow-400',
    space: 'text-green-600 dark:text-green-400',
    time: 'text-purple-600 dark:text-purple-400',
    // FAST dimensions (cool colors)
    person: 'text-pink-600 dark:text-pink-400',
    organization: 'text-indigo-600 dark:text-indigo-400',
    event: 'text-red-600 dark:text-red-400',
    work: 'text-cyan-600 dark:text-cyan-400',
    'form-genre': 'text-slate-600 dark:text-slate-400',
  };

  return colors[dimension] ?? 'text-foreground';
}
