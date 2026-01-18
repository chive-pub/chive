/**
 * Seed script for facet-to-value edges.
 *
 * @remarks
 * Creates `has-value` edges linking facet dimensions to their values:
 * - `personality` facet → academic field values (Discipline)
 * - `space` facet → geographic region values
 * - `energy` facet → methodology values
 * - `time` facet → time period values
 * - `form-genre` facet → paper type values
 *
 * Note: `matter`, `person`, `organization`, `event`, and `work` facets
 * remain empty as they are entity-type facets populated by user tagging.
 *
 * This script should run AFTER all facets and value nodes are seeded.
 *
 * @packageDocumentation
 */

import { EdgeCreator } from './lib/edge-creator.js';
import { NodeCreator } from './lib/node-creator.js';
import { FIELD_SLUGS } from './lib/fields.js';
import { GEOGRAPHIC_REGION_SLUGS } from './seed-geographic-regions.js';
import { METHODOLOGY_SLUGS } from './seed-methodologies.js';
import { TIME_PERIOD_SLUGS } from './seed-time-periods.js';
import { PAPER_TYPE_SLUGS } from './seed-paper-types.js';

/**
 * Facet-to-value mappings.
 *
 * @remarks
 * Maps facet dimension slugs to their value node slug prefixes and subkinds.
 */
interface FacetValueMapping {
  /** Facet dimension slug (e.g., 'space', 'energy') */
  readonly facetSlug: string;
  /** Value node slug prefix (e.g., 'geo-', 'method-') */
  readonly valuePrefix: string;
  /** Value subkind (undefined for generic values, or subkind slug for typed values) */
  readonly valueSubkind: string | undefined;
  /** Value slugs */
  readonly valueSlugs: readonly string[];
}

/**
 * All facet-to-value mappings.
 */
const FACET_VALUE_MAPPINGS: readonly FacetValueMapping[] = [
  {
    facetSlug: 'personality',
    valuePrefix: '', // Fields don't have a prefix
    valueSubkind: 'field', // Fields have subkind 'field'
    valueSlugs: FIELD_SLUGS,
  },
  {
    facetSlug: 'space',
    valuePrefix: 'geo-',
    valueSubkind: undefined, // Generic value (object)
    valueSlugs: GEOGRAPHIC_REGION_SLUGS,
  },
  {
    facetSlug: 'energy',
    valuePrefix: 'method-',
    valueSubkind: undefined, // Generic value (object)
    valueSlugs: METHODOLOGY_SLUGS,
  },
  {
    facetSlug: 'time',
    valuePrefix: 'time-',
    valueSubkind: undefined, // Generic value (object)
    valueSlugs: TIME_PERIOD_SLUGS,
  },
  {
    facetSlug: 'form-genre',
    valuePrefix: 'paper-type-',
    valueSubkind: 'paper-type', // Paper types have a subkind
    valueSlugs: PAPER_TYPE_SLUGS,
  },
];

/**
 * Seeds facet-to-value edges.
 *
 * @param nodeCreator - Node creator instance (for URI generation)
 * @param edgeCreator - Edge creator instance
 * @returns Number of edges created
 */
export async function seedFacetValueEdges(
  nodeCreator: NodeCreator,
  edgeCreator: EdgeCreator
): Promise<number> {
  let count = 0;

  for (const mapping of FACET_VALUE_MAPPINGS) {
    // Get facet URI (facets have subkind 'facet')
    const facetUri = nodeCreator.getNodeUri('facet', mapping.facetSlug);

    for (const valueSlug of mapping.valueSlugs) {
      // Get value URI using the appropriate subkind
      const valueNodeSlug = `${mapping.valuePrefix}${valueSlug}`;
      const valueUri = nodeCreator.getNodeUri(mapping.valueSubkind, valueNodeSlug);

      // Create has-value edge (with inverse value-of edge)
      await edgeCreator.createEdgeWithInverse(
        {
          sourceUri: facetUri,
          targetUri: valueUri,
          relationSlug: 'has-value',
          status: 'established',
          metadata: {
            source: 'seed',
          },
        },
        'value-of'
      );
      count += 2; // Both forward and inverse edges
    }
  }

  return count;
}

/**
 * Export mapping counts for logging.
 */
export const FACET_VALUE_COUNTS = {
  personality: FIELD_SLUGS.length,
  space: GEOGRAPHIC_REGION_SLUGS.length,
  energy: METHODOLOGY_SLUGS.length,
  time: TIME_PERIOD_SLUGS.length,
  'form-genre': PAPER_TYPE_SLUGS.length,
};
