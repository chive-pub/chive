#!/usr/bin/env tsx

/**
 * Cleanup script for Graph PDS records.
 * Deletes all pub.chive records to prepare for reseeding.
 */

import { AtpAgent } from '@atproto/api';

const PDS_URL = process.env.GRAPH_PDS_URL ?? 'https://governance.chive.pub';
const DID = process.env.GRAPH_PDS_DID ?? 'did:plc:5wzpn4a4nbqtz3q45hyud6hd';
const HANDLE = process.env.GRAPH_PDS_HANDLE ?? 'chive-governance.governance.chive.pub';
const PASSWORD = process.env.GRAPH_PDS_PASSWORD;

// Old collections that might still have records
const OLD_COLLECTIONS = [
  'pub.chive.graph.field',
  'pub.chive.graph.fieldProposal',
  'pub.chive.graph.facet',
  'pub.chive.graph.facetProposal',
  'pub.chive.graph.concept',
  'pub.chive.graph.conceptProposal',
  'pub.chive.contribution.type',
  'pub.chive.contribution.typeProposal',
];

// New unified collections
const NEW_COLLECTIONS = [
  'pub.chive.graph.node',
  'pub.chive.graph.edge',
  'pub.chive.graph.nodeProposal',
  'pub.chive.graph.edgeProposal',
  'pub.chive.graph.reconciliation',
];

async function deleteAllInCollection(agent: AtpAgent, collection: string): Promise<number> {
  let deleted = 0;
  let cursor: string | undefined;

  do {
    const response = await agent.com.atproto.repo.listRecords({
      repo: DID,
      collection,
      limit: 100,
      cursor,
    });

    if (!response.data.records || response.data.records.length === 0) break;

    for (const record of response.data.records) {
      const rkey = record.uri.split('/').pop()!;
      try {
        await agent.com.atproto.repo.deleteRecord({
          repo: DID,
          collection,
          rkey,
        });
        deleted++;
        process.stdout.write('.');
      } catch (e) {
        console.error(`Failed to delete ${rkey}:`, e);
      }
    }

    cursor = response.data.cursor;
  } while (cursor);

  return deleted;
}

async function main(): Promise<void> {
  if (!PASSWORD) {
    throw new Error('GOVERNANCE_PASSWORD environment variable required');
  }

  console.log('===========================================');
  console.log('Governance PDS Cleanup Script');
  console.log('===========================================');
  console.log(`PDS URL: ${PDS_URL}`);
  console.log(`DID: ${DID}`);
  console.log();

  const agent = new AtpAgent({ service: PDS_URL });

  console.log('Authenticating...');
  await agent.login({ identifier: HANDLE, password: PASSWORD });
  console.log('Authenticated.\n');

  let totalDeleted = 0;

  console.log('=== Deleting OLD collection records ===');
  for (const collection of OLD_COLLECTIONS) {
    process.stdout.write(`Deleting ${collection}... `);
    const count = await deleteAllInCollection(agent, collection);
    totalDeleted += count;
    console.log(` ${count} deleted`);
  }

  console.log('\n=== Deleting NEW collection records (if any) ===');
  for (const collection of NEW_COLLECTIONS) {
    process.stdout.write(`Deleting ${collection}... `);
    const count = await deleteAllInCollection(agent, collection);
    totalDeleted += count;
    console.log(` ${count} deleted`);
  }

  console.log('\n===========================================');
  console.log(`Total records deleted: ${totalDeleted}`);
  console.log('Governance PDS is now clean for reseeding.');
  console.log('===========================================');
}

main().catch((error) => {
  console.error('Cleanup failed:', error);
  process.exit(1);
});
