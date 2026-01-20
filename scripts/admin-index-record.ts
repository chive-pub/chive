#!/usr/bin/env npx tsx
/**
 * Admin script to manually index a record from PDS.
 *
 * @remarks
 * Bypasses normal auth checks by using the retry worker directly.
 * Run with: npx tsx scripts/admin-index-record.ts <uri>
 *
 * @example
 * npx tsx scripts/admin-index-record.ts "at://did:plc:abc/pub.chive.eprint.submission/123"
 */

import { createLogger } from '../src/observability/logging.js';
import { createEprintService } from '../src/services/eprint/index.js';
import { createPostgresStorage } from '../src/storage/postgres/index.js';
import { createElasticsearchClient } from '../src/storage/elasticsearch/client.js';
import { loadConfig } from '../src/config/index.js';
import type { AtUri, CID, DID } from '../src/types/atproto.js';
import type { RecordMetadata } from '../src/services/eprint/eprint-service.js';
import { transformPDSRecord } from '../src/services/eprint/pds-record-transformer.js';

/**
 * Parse an AT URI into its components.
 */
function parseAtUri(uri: string): { did: DID; collection: string; rkey: string } | null {
  const match = /^at:\/\/([^/]+)\/([^/]+)\/(.+)$/.exec(uri);
  if (!match?.[1] || !match[2] || !match[3]) {
    return null;
  }
  return {
    did: match[1] as DID,
    collection: match[2],
    rkey: match[3],
  };
}

/**
 * Resolve DID to PDS endpoint using PLC directory.
 */
async function resolvePdsEndpoint(did: DID): Promise<string | null> {
  try {
    if (did.startsWith('did:plc:')) {
      const response = await fetch(`https://plc.directory/${did}`);
      if (!response.ok) {
        return null;
      }
      const doc = (await response.json()) as {
        service?: { id: string; type: string; serviceEndpoint: string }[];
      };
      const pdsService = doc.service?.find(
        (s) => s.id === '#atproto_pds' || s.type === 'AtprotoPersonalDataServer'
      );
      return pdsService?.serviceEndpoint ?? null;
    }

    if (did.startsWith('did:web:')) {
      const domain = did.replace('did:web:', '').replace(/%3A/g, ':');
      const response = await fetch(`https://${domain}/.well-known/did.json`);
      if (!response.ok) {
        return null;
      }
      const doc = (await response.json()) as {
        service?: { id: string; type: string; serviceEndpoint: string }[];
      };
      const pdsService = doc.service?.find(
        (s) => s.id === '#atproto_pds' || s.type === 'AtprotoPersonalDataServer'
      );
      return pdsService?.serviceEndpoint ?? null;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch a record from a PDS.
 */
async function fetchRecordFromPds(
  pdsUrl: string,
  did: DID,
  collection: string,
  rkey: string
): Promise<{ uri: string; cid: string; value: unknown } | null> {
  try {
    const url = new URL('/xrpc/com.atproto.repo.getRecord', pdsUrl);
    url.searchParams.set('repo', did);
    url.searchParams.set('collection', collection);
    url.searchParams.set('rkey', rkey);

    const response = await fetch(url.toString());
    if (!response.ok) {
      console.error('PDS returned error:', response.status, await response.text());
      return null;
    }

    const record = (await response.json()) as { uri: string; cid: string; value: unknown };
    return record;
  } catch (error) {
    console.error('Failed to fetch from PDS:', error);
    return null;
  }
}

async function main() {
  const uri = process.argv[2];
  if (!uri) {
    console.error('Usage: npx tsx scripts/admin-index-record.ts <at-uri>');
    console.error(
      'Example: npx tsx scripts/admin-index-record.ts "at://did:plc:abc/pub.chive.eprint.submission/123"'
    );
    process.exit(1);
  }

  console.log('Admin index record script');
  console.log('URI:', uri);

  // Parse the AT URI
  const parsed = parseAtUri(uri);
  if (!parsed) {
    console.error('Invalid AT URI format');
    process.exit(1);
  }

  const { did, collection, rkey } = parsed;
  console.log('DID:', did);
  console.log('Collection:', collection);
  console.log('Rkey:', rkey);

  if (collection !== 'pub.chive.eprint.submission') {
    console.error('Only pub.chive.eprint.submission is supported');
    process.exit(1);
  }

  // Load config
  const config = loadConfig();
  const logger = createLogger(config.logging);

  console.log('\nResolving PDS endpoint...');
  const pdsUrl = await resolvePdsEndpoint(did);
  if (!pdsUrl) {
    console.error('Failed to resolve PDS endpoint for DID:', did);
    process.exit(1);
  }
  console.log('PDS URL:', pdsUrl);

  console.log('\nFetching record from PDS...');
  const record = await fetchRecordFromPds(pdsUrl, did, collection, rkey);
  if (!record) {
    console.error('Record not found on PDS');
    process.exit(1);
  }
  console.log('Record CID:', record.cid);
  console.log('Record value:', JSON.stringify(record.value, null, 2).slice(0, 500) + '...');

  console.log('\nInitializing services...');

  // Create storage and services
  const storage = await createPostgresStorage({
    connectionString: config.database.connectionString,
    maxConnections: 5,
    logger,
  });

  const esClient = createElasticsearchClient({
    node: config.elasticsearch?.url ?? 'http://localhost:9200',
  });

  const eprintService = createEprintService({
    storage,
    searchClient: esClient,
    logger,
  });

  console.log('\nTransforming and indexing record...');

  // Build metadata for indexing
  const metadata: RecordMetadata = {
    uri: uri as AtUri,
    cid: record.cid as CID,
    pdsUrl,
    indexedAt: new Date(),
  };

  // Transform PDS record to internal Eprint model
  const eprintRecord = transformPDSRecord(record.value, uri as AtUri, record.cid as CID);

  // Index the eprint
  const result = await eprintService.indexEprint(eprintRecord, metadata);

  if (!result.ok) {
    console.error('Failed to index record:', result.error.message);
    process.exit(1);
  }

  console.log('\n✅ Successfully indexed record!');
  console.log('URI:', uri);
  console.log('CID:', record.cid);

  // Clean up
  await storage.close();
  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
