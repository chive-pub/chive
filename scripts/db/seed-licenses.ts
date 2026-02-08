/**
 * Seed script for license type nodes.
 *
 * @remarks
 * Seeds distribution license types with SPDX IDs.
 *
 * @packageDocumentation
 */

import { NodeCreator, type ExternalId } from './lib/node-creator.js';

/**
 * License definitions with SPDX identifiers.
 */
const LICENSE_DEFINITIONS = [
  {
    slug: 'cc-by-4.0',
    label: 'CC BY 4.0',
    description: 'Creative Commons Attribution 4.0 International License.',
    spdxId: 'CC-BY-4.0',
    wikidataId: 'Q20007257',
    displayOrder: 1,
  },
  {
    slug: 'cc-by-sa-4.0',
    label: 'CC BY-SA 4.0',
    description: 'Creative Commons Attribution-ShareAlike 4.0 International License.',
    spdxId: 'CC-BY-SA-4.0',
    wikidataId: 'Q18199165',
    displayOrder: 2,
  },
  {
    slug: 'cc-by-nc-4.0',
    label: 'CC BY-NC 4.0',
    description: 'Creative Commons Attribution-NonCommercial 4.0 International License.',
    spdxId: 'CC-BY-NC-4.0',
    wikidataId: 'Q34179348',
    displayOrder: 3,
  },
  {
    slug: 'cc-by-nc-sa-4.0',
    label: 'CC BY-NC-SA 4.0',
    description: 'Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License.',
    spdxId: 'CC-BY-NC-SA-4.0',
    wikidataId: 'Q42553662',
    displayOrder: 4,
  },
  {
    slug: 'cc-by-nd-4.0',
    label: 'CC BY-ND 4.0',
    description: 'Creative Commons Attribution-NoDerivatives 4.0 International License.',
    spdxId: 'CC-BY-ND-4.0',
    wikidataId: 'Q36795408',
    displayOrder: 5,
  },
  {
    slug: 'cc-by-nc-nd-4.0',
    label: 'CC BY-NC-ND 4.0',
    description:
      'Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International License.',
    spdxId: 'CC-BY-NC-ND-4.0',
    wikidataId: 'Q24082749',
    displayOrder: 6,
  },
  {
    slug: 'cc0-1.0',
    label: 'CC0 1.0',
    description: 'Creative Commons Zero - Public Domain Dedication.',
    spdxId: 'CC0-1.0',
    wikidataId: 'Q6938433',
    displayOrder: 7,
  },
  {
    slug: 'mit',
    label: 'MIT License',
    description: 'MIT License - permissive open source license.',
    spdxId: 'MIT',
    wikidataId: 'Q334661',
    displayOrder: 8,
  },
  {
    slug: 'apache-2.0',
    label: 'Apache License 2.0',
    description: 'Apache License, Version 2.0.',
    spdxId: 'Apache-2.0',
    wikidataId: 'Q616526',
    displayOrder: 9,
  },
  {
    slug: 'gpl-3.0',
    label: 'GPL 3.0',
    description: 'GNU General Public License v3.0.',
    spdxId: 'GPL-3.0-only',
    wikidataId: 'Q10513445',
    displayOrder: 10,
  },
  {
    slug: 'bsd-3-clause',
    label: 'BSD 3-Clause',
    description: 'BSD 3-Clause "New" or "Revised" License.',
    spdxId: 'BSD-3-Clause',
    wikidataId: 'Q18491847',
    displayOrder: 11,
  },
  {
    slug: 'arxiv-perpetual',
    label: 'arXiv Perpetual License',
    description: 'arXiv.org perpetual, non-exclusive license to distribute.',
    displayOrder: 12,
  },
  {
    slug: 'all-rights-reserved',
    label: 'All Rights Reserved',
    description: 'No reuse permitted without explicit permission.',
    displayOrder: 13,
  },
  // CC 3.0 variants (still widely used)
  {
    slug: 'cc-by-3.0',
    label: 'CC BY 3.0',
    description: 'Creative Commons Attribution 3.0 Unported License.',
    spdxId: 'CC-BY-3.0',
    wikidataId: 'Q14947546',
    displayOrder: 14,
  },
  {
    slug: 'cc-by-sa-3.0',
    label: 'CC BY-SA 3.0',
    description: 'Creative Commons Attribution-ShareAlike 3.0 Unported License.',
    spdxId: 'CC-BY-SA-3.0',
    wikidataId: 'Q14946043',
    displayOrder: 15,
  },
  {
    slug: 'cc-by-nc-3.0',
    label: 'CC BY-NC 3.0',
    description: 'Creative Commons Attribution-NonCommercial 3.0 Unported License.',
    spdxId: 'CC-BY-NC-3.0',
    wikidataId: 'Q18810331',
    displayOrder: 16,
  },
  // Public domain
  {
    slug: 'public-domain',
    label: 'Public Domain',
    description: 'Work is in the public domain, free of copyright restrictions.',
    wikidataId: 'Q19652',
    displayOrder: 17,
  },
  {
    slug: 'unlicense',
    label: 'The Unlicense',
    description: 'Public domain equivalent license - no conditions.',
    spdxId: 'Unlicense',
    wikidataId: 'Q21659044',
    displayOrder: 18,
  },
  // Additional open source licenses
  {
    slug: 'agpl-3.0',
    label: 'AGPL 3.0',
    description: 'GNU Affero General Public License v3.0.',
    spdxId: 'AGPL-3.0-only',
    wikidataId: 'Q27017232',
    displayOrder: 19,
  },
  {
    slug: 'lgpl-3.0',
    label: 'LGPL 3.0',
    description: 'GNU Lesser General Public License v3.0.',
    spdxId: 'LGPL-3.0-only',
    wikidataId: 'Q18534393',
    displayOrder: 20,
  },
  {
    slug: 'mpl-2.0',
    label: 'MPL 2.0',
    description: 'Mozilla Public License 2.0.',
    spdxId: 'MPL-2.0',
    wikidataId: 'Q25428413',
    displayOrder: 21,
  },
  {
    slug: 'isc',
    label: 'ISC License',
    description: 'ISC License - permissive free software license.',
    spdxId: 'ISC',
    wikidataId: 'Q386474',
    displayOrder: 22,
  },
  {
    slug: 'bsd-2-clause',
    label: 'BSD 2-Clause',
    description: 'BSD 2-Clause "Simplified" License.',
    spdxId: 'BSD-2-Clause',
    wikidataId: 'Q18517294',
    displayOrder: 23,
  },
  {
    slug: 'eupl-1.2',
    label: 'EUPL 1.2',
    description: 'European Union Public License 1.2.',
    spdxId: 'EUPL-1.2',
    wikidataId: 'Q1376919',
    displayOrder: 24,
  },
  // Data licenses
  {
    slug: 'odc-by',
    label: 'ODC-By',
    description: 'Open Data Commons Attribution License.',
    spdxId: 'ODC-By-1.0',
    displayOrder: 25,
  },
  {
    slug: 'odbl',
    label: 'ODbL',
    description: 'Open Database License.',
    spdxId: 'ODbL-1.0',
    wikidataId: 'Q1224853',
    displayOrder: 26,
  },
  {
    slug: 'pddl',
    label: 'PDDL',
    description: 'Open Data Commons Public Domain Dedication and License.',
    spdxId: 'PDDL-1.0',
    displayOrder: 27,
  },
  // Publisher-specific licenses
  {
    slug: 'elsevier-user',
    label: 'Elsevier User License',
    description: 'Elsevier user license for personal, non-commercial use.',
    displayOrder: 28,
  },
  {
    slug: 'springer-bespoke',
    label: 'Springer Bespoke License',
    description: 'Springer Nature bespoke license terms.',
    displayOrder: 29,
  },
] as const;

/**
 * Seeds all license type nodes.
 *
 * @param nodeCreator - Node creator instance
 * @returns Number of nodes created
 */
export async function seedLicenses(nodeCreator: NodeCreator): Promise<number> {
  let count = 0;

  for (const license of LICENSE_DEFINITIONS) {
    const externalIds: ExternalId[] = [];

    if ('spdxId' in license && license.spdxId) {
      externalIds.push({
        system: 'spdx',
        identifier: license.spdxId,
        uri: `https://spdx.org/licenses/${license.spdxId}.html`,
        matchType: 'exact',
      });
    }

    if ('wikidataId' in license && license.wikidataId) {
      externalIds.push({
        system: 'wikidata',
        identifier: license.wikidataId,
        uri: `https://www.wikidata.org/wiki/${license.wikidataId}`,
        matchType: 'exact',
      });
    }

    await nodeCreator.createNode({
      slug: license.slug,
      kind: 'object',
      subkind: 'license',
      label: license.label,
      description: license.description,
      externalIds: externalIds.length > 0 ? externalIds : undefined,
      metadata: {
        spdxId: 'spdxId' in license ? license.spdxId : undefined,
        displayOrder: license.displayOrder,
      },
      status: 'established',
    });
    count++;
  }

  return count;
}
