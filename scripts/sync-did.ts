#!/usr/bin/env npx tsx
/**
 * Sync specific DIDs to local index.
 *
 * Usage:
 *   pnpm tsx scripts/sync-did.ts <DID> [DID...]
 *
 * Example:
 *   pnpm tsx scripts/sync-did.ts did:plc:n2zv4h5ua2ajlkvjqbotz77w did:plc:7ra5nksqml3pwkxwzpksxec2
 */

import pg from 'pg';
import { AtpAgent } from '@atproto/api';

import type { AtUri, CID, DID } from '../src/types/atproto.js';
import { transformPDSRecord } from '../src/services/eprint/pds-record-transformer.js';
import type { RecordMetadata } from '../src/services/eprint/eprint-service.js';
import { EprintService } from '../src/services/eprint/eprint-service.js';
import { EprintsRepository } from '../src/storage/postgresql/eprints-repository.js';

// =============================================================================
// Configuration
// =============================================================================

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://chive:chive_test_password@localhost:5432/chive';

// =============================================================================
// Simple Logger
// =============================================================================

const logger = {
  info: (msg: string, ctx?: object) => console.log(`[INFO] ${msg}`, ctx ? JSON.stringify(ctx) : ''),
  warn: (msg: string, ctx?: object) => console.log(`[WARN] ${msg}`, ctx ? JSON.stringify(ctx) : ''),
  error: (msg: string, err?: Error, ctx?: object) =>
    console.error(`[ERROR] ${msg}`, err?.message ?? '', ctx ?? ''),
  debug: (msg: string, ctx?: object) => {
    if (process.env.DEBUG) console.log(`[DEBUG] ${msg}`, ctx ? JSON.stringify(ctx) : '');
  },
  child: () => logger,
};

// =============================================================================
// DID Resolution
// =============================================================================

async function resolvePdsEndpoint(did: string): Promise<string | null> {
  try {
    if (did.startsWith('did:plc:')) {
      const response = await fetch(`https://plc.directory/${did}`);
      if (!response.ok) return null;
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

// =============================================================================
// Record Fetching
// =============================================================================

interface ListRecordsRecord {
  uri: string;
  cid: string;
  value: Record<string, unknown>;
}

async function listChiveRecords(pdsUrl: string, did: string): Promise<ListRecordsRecord[]> {
  const agent = new AtpAgent({ service: pdsUrl });
  const records: ListRecordsRecord[] = [];

  try {
    const response = await agent.com.atproto.repo.listRecords({
      repo: did,
      collection: 'pub.chive.eprint.submission',
      limit: 100,
    });

    for (const record of response.data.records) {
      records.push({
        uri: record.uri,
        cid: record.cid,
        value: record.value as Record<string, unknown>,
      });
    }
  } catch (error) {
    console.error(`Failed to list records for ${did}:`, error);
  }

  return records;
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
  const dids = process.argv.slice(2);

  if (dids.length === 0) {
    console.log(`
Usage: pnpm tsx scripts/sync-did.ts <DID> [DID...]

Example:
  pnpm tsx scripts/sync-did.ts did:plc:n2zv4h5ua2ajlkvjqbotz77w did:plc:7ra5nksqml3pwkxwzpksxec2
`);
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: DATABASE_URL });

  try {
    await pool.query('SELECT 1');
    console.log('Connected to PostgreSQL\n');
  } catch (error) {
    console.error('Failed to connect to PostgreSQL:', error);
    process.exit(1);
  }

  // Initialize services
  const eprintsRepository = new EprintsRepository(pool, logger);
  const eprintService = new EprintService({
    eprintsRepository,
    logger,
  });

  let totalIndexed = 0;

  for (const did of dids) {
    console.log(`\n📋 Processing ${did}...`);

    // Resolve PDS
    const pdsUrl = await resolvePdsEndpoint(did);
    if (!pdsUrl) {
      console.error(`  ❌ Could not resolve PDS for ${did}`);
      continue;
    }
    console.log(`  📍 PDS: ${pdsUrl}`);

    // List records
    const records = await listChiveRecords(pdsUrl, did);
    console.log(`  📄 Found ${records.length} record(s)`);

    // Index each record
    for (const record of records) {
      try {
        // Transform PDS record to internal format
        const transformed = transformPDSRecord(
          record.value,
          record.uri as AtUri,
          record.cid as CID
        );

        // Build metadata
        const metadata: RecordMetadata = {
          uri: record.uri as AtUri,
          cid: record.cid as CID,
          pdsUrl,
          indexedAt: new Date(),
        };

        // Index via service
        const result = await eprintService.indexEprint(transformed, metadata);

        if (result.ok) {
          console.log(`  ✅ Indexed: ${transformed.title}`);
          totalIndexed++;
        } else {
          console.log(`  ⚠️  ${result.error.message}: ${transformed.title}`);
        }
      } catch (error) {
        console.error(
          `  ❌ Failed to index ${record.uri}:`,
          error instanceof Error ? error.message : error
        );
      }
    }
  }

  console.log(`\n✨ Done! Indexed ${totalIndexed} new record(s).`);

  await pool.end();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
