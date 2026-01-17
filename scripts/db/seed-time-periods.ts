/**
 * Seed script for time period nodes.
 *
 * @remarks
 * Seeds time periods (time facet values) with no subkind.
 * These values are linked to the `time` facet via `has-value` edges.
 *
 * @packageDocumentation
 */

import { NodeCreator, type ExternalId } from './lib/node-creator.js';

/**
 * Time period definitions.
 */
const TIME_PERIODS = [
  {
    slug: '19th-century',
    label: '19th Century',
    description: 'Research focused on the 1800s (1801-1900).',
    externalIds: [
      { system: 'wikidata', identifier: 'Q6955', uri: 'https://www.wikidata.org/wiki/Q6955' },
    ],
  },
  {
    slug: '20th-century',
    label: '20th Century',
    description: 'Research focused on the 1900s (1901-2000).',
    externalIds: [
      { system: 'wikidata', identifier: 'Q6927', uri: 'https://www.wikidata.org/wiki/Q6927' },
    ],
  },
  {
    slug: '21st-century',
    label: '21st Century',
    description: 'Research focused on the 2000s (2001-present).',
    externalIds: [
      { system: 'wikidata', identifier: 'Q6939', uri: 'https://www.wikidata.org/wiki/Q6939' },
    ],
  },
  {
    slug: 'pre-industrial',
    label: 'Pre-Industrial Era',
    description: 'Research focused on the period before industrialization.',
    externalIds: [
      { system: 'wikidata', identifier: 'Q3772521', uri: 'https://www.wikidata.org/wiki/Q3772521' },
    ],
  },
  {
    slug: 'industrial-revolution',
    label: 'Industrial Revolution',
    description: 'Research focused on the Industrial Revolution period (c. 1760-1840).',
    externalIds: [
      { system: 'wikidata', identifier: 'Q2269', uri: 'https://www.wikidata.org/wiki/Q2269' },
    ],
  },
  {
    slug: 'world-war-i-era',
    label: 'World War I Era',
    description: 'Research focused on the World War I period (1914-1918).',
    externalIds: [
      { system: 'wikidata', identifier: 'Q361', uri: 'https://www.wikidata.org/wiki/Q361' },
    ],
  },
  {
    slug: 'interwar-period',
    label: 'Interwar Period',
    description: 'Research focused on the period between WWI and WWII (1918-1939).',
    externalIds: [
      { system: 'wikidata', identifier: 'Q154611', uri: 'https://www.wikidata.org/wiki/Q154611' },
    ],
  },
  {
    slug: 'world-war-ii-era',
    label: 'World War II Era',
    description: 'Research focused on the World War II period (1939-1945).',
    externalIds: [
      { system: 'wikidata', identifier: 'Q362', uri: 'https://www.wikidata.org/wiki/Q362' },
    ],
  },
  {
    slug: 'cold-war-era',
    label: 'Cold War Era',
    description: 'Research focused on the Cold War period (1947-1991).',
    externalIds: [
      { system: 'wikidata', identifier: 'Q8683', uri: 'https://www.wikidata.org/wiki/Q8683' },
    ],
  },
  {
    slug: 'post-cold-war',
    label: 'Post-Cold War',
    description: 'Research focused on the period after the Cold War (1991-present).',
    externalIds: [
      {
        system: 'wikidata',
        identifier: 'Q17152871',
        uri: 'https://www.wikidata.org/wiki/Q17152871',
      },
    ],
  },
  {
    slug: 'digital-age',
    label: 'Digital Age',
    description: 'Research focused on the digital/information age (1970s-present).',
    externalIds: [
      { system: 'wikidata', identifier: 'Q956129', uri: 'https://www.wikidata.org/wiki/Q956129' },
    ],
  },
  {
    slug: 'covid-19-era',
    label: 'COVID-19 Era',
    description: 'Research focused on the COVID-19 pandemic period (2019-present).',
    externalIds: [
      {
        system: 'wikidata',
        identifier: 'Q81068910',
        uri: 'https://www.wikidata.org/wiki/Q81068910',
      },
    ],
  },
  {
    slug: 'contemporary',
    label: 'Contemporary',
    description: 'Research focused on the contemporary period (2010-present).',
    externalIds: [],
  },
  {
    slug: 'historical',
    label: 'Historical',
    description: 'Research focused on historical periods (pre-1900).',
    externalIds: [],
  },
  {
    slug: 'ancient',
    label: 'Ancient',
    description: 'Research focused on the ancient period (pre-500 CE).',
    externalIds: [
      { system: 'wikidata', identifier: 'Q486761', uri: 'https://www.wikidata.org/wiki/Q486761' },
    ],
  },
] as const;

/**
 * Seeds time period nodes.
 *
 * @param nodeCreator - Node creator instance
 * @returns Number of nodes created
 */
export async function seedTimePeriods(nodeCreator: NodeCreator): Promise<number> {
  let count = 0;

  for (const period of TIME_PERIODS) {
    const externalIds: ExternalId[] = period.externalIds.map((ext) => ({
      system: ext.system,
      identifier: ext.identifier,
      uri: ext.uri,
      matchType: 'exact' as const,
    }));

    await nodeCreator.createNode({
      slug: `time-${period.slug}`,
      kind: 'object',
      // No subkind - specific time period, display determined by context
      label: period.label,
      description: period.description,
      externalIds: externalIds.length > 0 ? externalIds : undefined,
      status: 'established',
    });
    count++;
  }

  return count;
}

/**
 * Export time period slugs for edge creation.
 */
export const TIME_PERIOD_SLUGS = TIME_PERIODS.map((t) => t.slug);
