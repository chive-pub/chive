#!/usr/bin/env tsx
/**
 * Script to list and delete records from a user's PDS.
 *
 * Usage:
 *   pnpm tsx scripts/cleanup-pds-records.ts list <did>
 *   pnpm tsx scripts/cleanup-pds-records.ts delete <did> <collection> [rkey]
 */

import { Agent } from '@atproto/api';

const COLLECTIONS = [
  'pub.chive.eprint.submission',
  'pub.chive.eprint.version',
  'pub.chive.actor.profile',
  'pub.chive.discovery.settings',
  'pub.chive.review.comment',
  'pub.chive.review.endorsement',
  'pub.chive.graph.node',
  'pub.chive.graph.nodeProposal',
  'pub.chive.graph.edge',
  'pub.chive.graph.edgeProposal',
  'pub.chive.graph.vote',
];

async function listRecords(pdsUrl: string, did: string) {
  console.log(`\nListing records for ${did} from ${pdsUrl}...\n`);

  for (const collection of COLLECTIONS) {
    try {
      const response = await fetch(
        `${pdsUrl}/xrpc/com.atproto.repo.listRecords?repo=${did}&collection=${collection}&limit=100`
      );

      if (!response.ok) {
        if (response.status === 400) {
          // Collection doesn't exist, skip
          continue;
        }
        console.error(`Error fetching ${collection}: ${response.status}`);
        continue;
      }

      const data = (await response.json()) as {
        records: Array<{ uri: string; cid: string; value: unknown }>;
      };

      if (data.records && data.records.length > 0) {
        console.log(`\n📁 ${collection} (${data.records.length} records):`);
        for (const record of data.records) {
          const rkey = record.uri.split('/').pop();
          const value = record.value as Record<string, unknown>;
          const title = value.title || value.displayName || value.text || '(no title)';
          console.log(`  - ${rkey}: ${String(title).slice(0, 60)}...`);
        }
      }
    } catch (error) {
      console.error(`Error listing ${collection}:`, error);
    }
  }
}

async function deleteAllRecordsInCollection(agent: Agent, did: string, collection: string) {
  console.log(`\nDeleting all records in ${collection}...`);

  const response = await agent.com.atproto.repo.listRecords({
    repo: did,
    collection,
    limit: 100,
  });

  if (!response.data.records || response.data.records.length === 0) {
    console.log(`No records found in ${collection}`);
    return;
  }

  console.log(`Found ${response.data.records.length} records to delete`);

  for (const record of response.data.records) {
    const rkey = record.uri.split('/').pop()!;
    try {
      await agent.com.atproto.repo.deleteRecord({
        repo: did,
        collection,
        rkey,
      });
      console.log(`  ✓ Deleted ${rkey}`);
    } catch (error) {
      console.error(`  ✗ Failed to delete ${rkey}:`, error);
    }
  }
}

async function deleteRecord(agent: Agent, did: string, collection: string, rkey: string) {
  console.log(`\nDeleting ${collection}/${rkey}...`);

  try {
    await agent.com.atproto.repo.deleteRecord({
      repo: did,
      collection,
      rkey,
    });
    console.log(`  ✓ Deleted successfully`);
  } catch (error) {
    console.error(`  ✗ Failed to delete:`, error);
  }
}

async function main() {
  const [command, did, collection, rkey] = process.argv.slice(2);

  if (!command || !did) {
    console.log(`
Usage:
  pnpm tsx scripts/cleanup-pds-records.ts list <did>
  pnpm tsx scripts/cleanup-pds-records.ts delete <did> <collection> [rkey]

Examples:
  pnpm tsx scripts/cleanup-pds-records.ts list did:plc:34mbm5v3umztwvvgnttvcz6e
  pnpm tsx scripts/cleanup-pds-records.ts delete did:plc:34mbm5v3umztwvvgnttvcz6e pub.chive.eprint.submission
  pnpm tsx scripts/cleanup-pds-records.ts delete did:plc:34mbm5v3umztwvvgnttvcz6e pub.chive.eprint.submission abc123

Collections:
${COLLECTIONS.map((c) => `  - ${c}`).join('\n')}
`);
    process.exit(1);
  }

  // Resolve DID to PDS URL
  let pdsUrl = 'https://bsky.social';
  try {
    const plcResponse = await fetch(`https://plc.directory/${did}`);
    if (plcResponse.ok) {
      const plcData = (await plcResponse.json()) as {
        service: Array<{ id: string; serviceEndpoint: string }>;
      };
      const pdsService = plcData.service?.find((s) => s.id === '#atproto_pds');
      if (pdsService) {
        pdsUrl = pdsService.serviceEndpoint;
      }
    }
  } catch {
    console.log('Could not resolve PDS URL, using bsky.social');
  }

  console.log(`PDS URL: ${pdsUrl}`);

  if (command === 'list') {
    await listRecords(pdsUrl, did);
  } else if (command === 'delete') {
    if (!collection) {
      console.error('Collection is required for delete command');
      process.exit(1);
    }

    // For delete, we need authentication
    // This would need to be run with proper auth context
    console.log(`
To delete records, you need to be authenticated.
Use the app's UI or run this with proper authentication.

For now, listing what would be deleted...
`);
    await listRecords(pdsUrl, did);
  } else {
    console.error(`Unknown command: ${command}`);
    process.exit(1);
  }
}

main().catch(console.error);
