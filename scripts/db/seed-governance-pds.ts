#!/usr/bin/env tsx

/**
 * Governance PDS comprehensive seed script - Unified Node Model.
 *
 * @remarks
 * Seeds the Governance PDS with all knowledge graph entities using the unified
 * node model. All entities are `pub.chive.graph.node` records with different
 * `subkind` values. Relationships are `pub.chive.graph.edge` records.
 *
 * **Seeding Order**:
 * 1. Meta-types: subkinds, relations
 * 2. Form type nodes: licenses, document-formats, publication-statuses, etc.
 * 3. Platform type nodes: code, data, preprint, etc.
 * 4. Hierarchical type nodes: fields (with edges), facets
 * 5. Other type nodes: paper-types, motivations, endorsement-contributions
 *
 * **ATProto Compliance**: All records are written to the Governance PDS as
 * ATProto records. The AppView indexes these from the firehose into Neo4j.
 *
 * @packageDocumentation
 */

import { AtpAgent } from '@atproto/api';

import type { DID } from '../../src/types/atproto.js';
import { NodeCreator } from './lib/node-creator.js';
import { EdgeCreator } from './lib/edge-creator.js';
import { seedSubkinds } from './seed-subkinds.js';
import { seedRelations } from './seed-relations.js';
import { seedContributionTypes } from './seed-contribution-types.js';
import { seedContributionDegrees } from './seed-contribution-degrees.js';
import { seedDocumentFormats } from './seed-document-formats.js';
import { seedPublicationStatuses } from './seed-publication-statuses.js';
import { seedAccessTypes } from './seed-access-types.js';
import { seedPlatforms } from './seed-platforms.js';
import { seedSupplementaryCategories } from './seed-supplementary-categories.js';
import { seedInstitutionTypes } from './seed-institution-types.js';
import { seedPresentationTypes } from './seed-presentation-types.js';
import { seedMotivations } from './seed-motivations.js';
import { seedPaperTypes } from './seed-paper-types.js';
import { seedLicenses } from './seed-licenses.js';
import { seedEndorsementContributions } from './seed-endorsement-contributions.js';
import { seedFields } from './seed-fields.js';
import { seedFacets } from './seed-facets.js';
import { seedGeographicRegions } from './seed-geographic-regions.js';
import { seedMethodologies } from './seed-methodologies.js';
import { seedTimePeriods } from './seed-time-periods.js';
import { seedFacetValueEdges, FACET_VALUE_COUNTS } from './seed-facet-values.js';

// =============================================================================
// Configuration
// =============================================================================

interface SeedConfig {
  /** Governance PDS endpoint */
  pdsUrl: string;
  /** Governance DID */
  governanceDid: DID;
  /** Governance PDS handle */
  handle: string;
  /** Governance PDS password (for seeding only) */
  password: string;
  /** Dry run mode (log but don't write) */
  dryRun: boolean;
}

function getConfig(): SeedConfig {
  const pdsUrl = process.env.GOVERNANCE_PDS_URL ?? 'https://governance.chive.pub';
  const governanceDid = (process.env.GOVERNANCE_DID ?? 'did:plc:5wzpn4a4nbqtz3q45hyud6hd') as DID;
  const handle = process.env.GOVERNANCE_HANDLE ?? 'chive-governance.governance.chive.pub';
  const password = process.env.GOVERNANCE_PASSWORD;
  const dryRun = process.env.DRY_RUN === 'true';

  if (!password && !dryRun) {
    throw new Error('GOVERNANCE_PASSWORD environment variable required (or set DRY_RUN=true)');
  }

  return { pdsUrl, governanceDid, handle, password: password ?? '', dryRun };
}

// =============================================================================
// PDS Writer Adapter
// =============================================================================

/**
 * Creates a PDS writer adapter from an authenticated AtpAgent.
 */
function createPdsWriter(agent: AtpAgent, governanceDid: DID) {
  return {
    async createNode(collection: string, rkey: string, record: unknown): Promise<{ uri: string }> {
      await agent.com.atproto.repo.createRecord({
        repo: governanceDid,
        collection,
        rkey,
        record,
      });
      return { uri: `at://${governanceDid}/${collection}/${rkey}` };
    },

    async createEdge(collection: string, rkey: string, record: unknown): Promise<{ uri: string }> {
      await agent.com.atproto.repo.createRecord({
        repo: governanceDid,
        collection,
        rkey,
        record,
      });
      return { uri: `at://${governanceDid}/${collection}/${rkey}` };
    },
  };
}

// =============================================================================
// Logger
// =============================================================================

const logger = {
  info(message: string, data?: Record<string, unknown>): void {
    if (data) {
      console.log(`[INFO] ${message}`, JSON.stringify(data));
    } else {
      console.log(`[INFO] ${message}`);
    }
  },
  warn(message: string, data?: Record<string, unknown>): void {
    if (data) {
      console.warn(`[WARN] ${message}`, JSON.stringify(data));
    } else {
      console.warn(`[WARN] ${message}`);
    }
  },
  error(message: string, error?: Error, data?: Record<string, unknown>): void {
    if (error) {
      console.error(`[ERROR] ${message}:`, error.message);
    } else if (data) {
      console.error(`[ERROR] ${message}`, JSON.stringify(data));
    } else {
      console.error(`[ERROR] ${message}`);
    }
  },
};

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
  const config = getConfig();

  console.log('===========================================');
  console.log('Governance PDS Unified Node Seed Script');
  console.log('===========================================');
  console.log(`PDS URL: ${config.pdsUrl}`);
  console.log(`Governance DID: ${config.governanceDid}`);
  console.log(`Dry Run: ${config.dryRun}`);
  console.log();

  let pdsWriter: ReturnType<typeof createPdsWriter> | undefined;

  if (!config.dryRun) {
    // Create and authenticate agent
    const agent = new AtpAgent({ service: config.pdsUrl });

    console.log('Authenticating...');
    await agent.login({
      identifier: config.handle,
      password: config.password,
    });
    console.log('Authenticated successfully.\n');

    pdsWriter = createPdsWriter(agent, config.governanceDid);
  }

  // Create node and edge creators
  const nodeCreator = new NodeCreator({
    governanceDid: config.governanceDid,
    pdsWriter,
    logger,
    dryRun: config.dryRun,
  });

  const edgeCreator = new EdgeCreator({
    governanceDid: config.governanceDid,
    pdsWriter,
    logger,
    dryRun: config.dryRun,
  });

  // ==========================================================================
  // Phase 1: Meta-types
  // ==========================================================================
  console.log('=== Phase 1: Meta-types ===\n');

  console.log('Seeding subkinds...');
  const subkindCount = await seedSubkinds(nodeCreator);
  console.log(`  Created ${subkindCount} subkind nodes.\n`);

  console.log('Seeding relation types...');
  const relationCount = await seedRelations(nodeCreator);
  console.log(`  Created ${relationCount} relation type nodes.\n`);

  // ==========================================================================
  // Phase 2: Form type nodes
  // ==========================================================================
  console.log('=== Phase 2: Form Type Nodes ===\n');

  console.log('Seeding licenses...');
  const licenseCount = await seedLicenses(nodeCreator);
  console.log(`  Created ${licenseCount} license nodes.\n`);

  console.log('Seeding document formats...');
  const formatCount = await seedDocumentFormats(nodeCreator);
  console.log(`  Created ${formatCount} document format nodes.\n`);

  console.log('Seeding publication statuses...');
  const statusCount = await seedPublicationStatuses(nodeCreator);
  console.log(`  Created ${statusCount} publication status nodes.\n`);

  console.log('Seeding access types...');
  const accessCount = await seedAccessTypes(nodeCreator, edgeCreator);
  console.log(`  Created ${accessCount} access type nodes.\n`);

  console.log('Seeding contribution types...');
  const contribTypeCount = await seedContributionTypes(nodeCreator);
  console.log(`  Created ${contribTypeCount} contribution type nodes.\n`);

  console.log('Seeding contribution degrees...');
  const degreeCount = await seedContributionDegrees(nodeCreator);
  console.log(`  Created ${degreeCount} contribution degree nodes.\n`);

  console.log('Seeding supplementary categories...');
  const suppCount = await seedSupplementaryCategories(nodeCreator);
  console.log(`  Created ${suppCount} supplementary category nodes.\n`);

  // ==========================================================================
  // Phase 3: Platform type nodes
  // ==========================================================================
  console.log('=== Phase 3: Platform Type Nodes ===\n');

  console.log('Seeding platforms (code, data, preprint, preregistration, protocol)...');
  const platformCount = await seedPlatforms(nodeCreator);
  console.log(`  Created ${platformCount} platform nodes.\n`);

  // ==========================================================================
  // Phase 4: Other type nodes
  // ==========================================================================
  console.log('=== Phase 4: Other Type Nodes ===\n');

  console.log('Seeding institution types...');
  const instTypeCount = await seedInstitutionTypes(nodeCreator);
  console.log(`  Created ${instTypeCount} institution type nodes.\n`);

  console.log('Seeding presentation types...');
  const presCount = await seedPresentationTypes(nodeCreator);
  console.log(`  Created ${presCount} presentation type nodes.\n`);

  console.log('Seeding paper types...');
  const paperCount = await seedPaperTypes(nodeCreator);
  console.log(`  Created ${paperCount} paper type nodes.\n`);

  console.log('Seeding annotation motivations...');
  const motivationCount = await seedMotivations(nodeCreator);
  console.log(`  Created ${motivationCount} motivation nodes.\n`);

  console.log('Seeding endorsement contributions...');
  const endorseCount = await seedEndorsementContributions(nodeCreator);
  console.log(`  Created ${endorseCount} endorsement contribution nodes.\n`);

  // ==========================================================================
  // Phase 5: Hierarchical type nodes with edges
  // ==========================================================================
  console.log('=== Phase 5: Hierarchical Type Nodes ===\n');

  console.log('Seeding academic fields with hierarchy...');
  const fieldResult = await seedFields(nodeCreator, edgeCreator);
  console.log(
    `  Created ${fieldResult.nodeCount} field nodes and ${fieldResult.edgeCount} hierarchy edges.\n`
  );

  console.log('Seeding facets (10 PMEST+FAST dimensions)...');
  const facetCount = await seedFacets(nodeCreator);
  console.log(`  Created ${facetCount} facet nodes.\n`);

  // ==========================================================================
  // Phase 6: Facet value nodes
  // ==========================================================================
  console.log('=== Phase 6: Facet Value Nodes ===\n');

  console.log('Seeding geographic regions (space facet values)...');
  const geoCount = await seedGeographicRegions(nodeCreator);
  console.log(`  Created ${geoCount} geographic region nodes.\n`);

  console.log('Seeding research methodologies (energy facet values)...');
  const methodCount = await seedMethodologies(nodeCreator);
  console.log(`  Created ${methodCount} methodology nodes.\n`);

  console.log('Seeding time periods (time facet values)...');
  const timeCount = await seedTimePeriods(nodeCreator);
  console.log(`  Created ${timeCount} time period nodes.\n`);

  // ==========================================================================
  // Phase 7: Facet-to-value edges
  // ==========================================================================
  console.log('=== Phase 7: Facet-to-Value Edges ===\n');

  console.log('Seeding has-value edges linking facets to values...');
  console.log(`  space → ${FACET_VALUE_COUNTS.space} geographic regions`);
  console.log(`  energy → ${FACET_VALUE_COUNTS.energy} methodologies`);
  console.log(`  time → ${FACET_VALUE_COUNTS.time} time periods`);
  console.log(`  form-genre → ${FACET_VALUE_COUNTS['form-genre']} paper types`);
  const facetEdgeCount = await seedFacetValueEdges(nodeCreator, edgeCreator);
  console.log(`  Created ${facetEdgeCount} facet-value edges.\n`);

  // ==========================================================================
  // Summary
  // ==========================================================================
  const totalNodes = nodeCreator.getAllCreatedNodes().length;
  const totalEdges = edgeCreator.getAllCreatedEdges().length;

  console.log('===========================================');
  console.log('Governance PDS seeding complete!');
  console.log('===========================================');
  console.log(`Total nodes: ${totalNodes}`);
  console.log(`Total edges: ${totalEdges}`);
  console.log();

  if (!config.dryRun) {
    console.log('NOTE: The AppView must be running to index these records from the firehose.');
    console.log('Records will appear in Neo4j after the event processor indexes them.');
  } else {
    console.log('DRY RUN: No records were written to the PDS.');
  }
}

main().catch((error) => {
  console.error('Seed script failed:', error);
  process.exit(1);
});
