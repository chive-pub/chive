/**
 * Seed script for geographic region nodes.
 *
 * @remarks
 * Seeds geographic regions (space facet values) with no subkind.
 * These values are linked to the `space` facet via `has-value` edges.
 *
 * @packageDocumentation
 */

import { NodeCreator, type ExternalId } from './lib/node-creator.js';

/**
 * Geographic region definitions.
 */
const GEOGRAPHIC_REGIONS = [
  {
    slug: 'global',
    label: 'Global',
    description: 'Research with worldwide scope or applicability.',
    externalIds: [
      { system: 'wikidata', identifier: 'Q2', uri: 'https://www.wikidata.org/wiki/Q2' },
    ],
  },
  {
    slug: 'africa',
    label: 'Africa',
    description: 'Research focused on the African continent.',
    externalIds: [
      { system: 'wikidata', identifier: 'Q15', uri: 'https://www.wikidata.org/wiki/Q15' },
      { system: 'geonames', identifier: '6255146', uri: 'https://www.geonames.org/6255146' },
    ],
  },
  {
    slug: 'asia',
    label: 'Asia',
    description: 'Research focused on the Asian continent.',
    externalIds: [
      { system: 'wikidata', identifier: 'Q48', uri: 'https://www.wikidata.org/wiki/Q48' },
      { system: 'geonames', identifier: '6255147', uri: 'https://www.geonames.org/6255147' },
    ],
  },
  {
    slug: 'europe',
    label: 'Europe',
    description: 'Research focused on the European continent.',
    externalIds: [
      { system: 'wikidata', identifier: 'Q46', uri: 'https://www.wikidata.org/wiki/Q46' },
      { system: 'geonames', identifier: '6255148', uri: 'https://www.geonames.org/6255148' },
    ],
  },
  {
    slug: 'north-america',
    label: 'North America',
    description: 'Research focused on North America.',
    externalIds: [
      { system: 'wikidata', identifier: 'Q49', uri: 'https://www.wikidata.org/wiki/Q49' },
      { system: 'geonames', identifier: '6255149', uri: 'https://www.geonames.org/6255149' },
    ],
  },
  {
    slug: 'south-america',
    label: 'South America',
    description: 'Research focused on South America.',
    externalIds: [
      { system: 'wikidata', identifier: 'Q18', uri: 'https://www.wikidata.org/wiki/Q18' },
      { system: 'geonames', identifier: '6255150', uri: 'https://www.geonames.org/6255150' },
    ],
  },
  {
    slug: 'oceania',
    label: 'Oceania',
    description: 'Research focused on Oceania and the Pacific Islands.',
    externalIds: [
      { system: 'wikidata', identifier: 'Q55643', uri: 'https://www.wikidata.org/wiki/Q55643' },
      { system: 'geonames', identifier: '6255151', uri: 'https://www.geonames.org/6255151' },
    ],
  },
  {
    slug: 'antarctica',
    label: 'Antarctica',
    description: 'Research focused on Antarctica.',
    externalIds: [
      { system: 'wikidata', identifier: 'Q51', uri: 'https://www.wikidata.org/wiki/Q51' },
      { system: 'geonames', identifier: '6255152', uri: 'https://www.geonames.org/6255152' },
    ],
  },
  {
    slug: 'middle-east',
    label: 'Middle East',
    description: 'Research focused on the Middle East region.',
    externalIds: [
      { system: 'wikidata', identifier: 'Q7204', uri: 'https://www.wikidata.org/wiki/Q7204' },
    ],
  },
  {
    slug: 'southeast-asia',
    label: 'Southeast Asia',
    description: 'Research focused on Southeast Asian countries.',
    externalIds: [
      { system: 'wikidata', identifier: 'Q11708', uri: 'https://www.wikidata.org/wiki/Q11708' },
    ],
  },
  {
    slug: 'east-asia',
    label: 'East Asia',
    description: 'Research focused on East Asian countries.',
    externalIds: [
      { system: 'wikidata', identifier: 'Q27231', uri: 'https://www.wikidata.org/wiki/Q27231' },
    ],
  },
  {
    slug: 'south-asia',
    label: 'South Asia',
    description: 'Research focused on South Asian countries.',
    externalIds: [
      { system: 'wikidata', identifier: 'Q771405', uri: 'https://www.wikidata.org/wiki/Q771405' },
    ],
  },
  {
    slug: 'central-asia',
    label: 'Central Asia',
    description: 'Research focused on Central Asian countries.',
    externalIds: [
      { system: 'wikidata', identifier: 'Q27275', uri: 'https://www.wikidata.org/wiki/Q27275' },
    ],
  },
  {
    slug: 'western-europe',
    label: 'Western Europe',
    description: 'Research focused on Western European countries.',
    externalIds: [
      { system: 'wikidata', identifier: 'Q27496', uri: 'https://www.wikidata.org/wiki/Q27496' },
    ],
  },
  {
    slug: 'eastern-europe',
    label: 'Eastern Europe',
    description: 'Research focused on Eastern European countries.',
    externalIds: [
      { system: 'wikidata', identifier: 'Q27468', uri: 'https://www.wikidata.org/wiki/Q27468' },
    ],
  },
  {
    slug: 'sub-saharan-africa',
    label: 'Sub-Saharan Africa',
    description: 'Research focused on Sub-Saharan African countries.',
    externalIds: [
      { system: 'wikidata', identifier: 'Q132959', uri: 'https://www.wikidata.org/wiki/Q132959' },
    ],
  },
  {
    slug: 'latin-america',
    label: 'Latin America',
    description: 'Research focused on Latin American countries.',
    externalIds: [
      { system: 'wikidata', identifier: 'Q12585', uri: 'https://www.wikidata.org/wiki/Q12585' },
    ],
  },
  {
    slug: 'caribbean',
    label: 'Caribbean',
    description: 'Research focused on Caribbean nations and territories.',
    externalIds: [
      { system: 'wikidata', identifier: 'Q664609', uri: 'https://www.wikidata.org/wiki/Q664609' },
    ],
  },
  {
    slug: 'arctic',
    label: 'Arctic',
    description: 'Research focused on the Arctic region.',
    externalIds: [
      { system: 'wikidata', identifier: 'Q25322', uri: 'https://www.wikidata.org/wiki/Q25322' },
    ],
  },
  {
    slug: 'pacific',
    label: 'Pacific Region',
    description: 'Research focused on the Pacific Ocean region.',
    externalIds: [
      { system: 'wikidata', identifier: 'Q3359409', uri: 'https://www.wikidata.org/wiki/Q3359409' },
    ],
  },
] as const;

/**
 * Seeds geographic region nodes.
 *
 * @param nodeCreator - Node creator instance
 * @returns Number of nodes created
 */
export async function seedGeographicRegions(nodeCreator: NodeCreator): Promise<number> {
  let count = 0;

  for (const region of GEOGRAPHIC_REGIONS) {
    const externalIds: ExternalId[] = region.externalIds.map((ext) => ({
      system: ext.system,
      identifier: ext.identifier,
      uri: ext.uri,
      matchType: 'exact' as const,
    }));

    await nodeCreator.createNode({
      slug: `geo-${region.slug}`,
      kind: 'object',
      // No subkind - specific geographic region, display determined by context
      label: region.label,
      description: region.description,
      externalIds,
      status: 'established',
    });
    count++;
  }

  return count;
}

/**
 * Export region slugs for edge creation.
 */
export const GEOGRAPHIC_REGION_SLUGS = GEOGRAPHIC_REGIONS.map((r) => r.slug);
