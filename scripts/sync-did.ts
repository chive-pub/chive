#!/usr/bin/env npx tsx
/**
 * Sync specific DIDs to local PostgreSQL index.
 *
 * @remarks
 * Fetches eprints from the specified DIDs and indexes them into PostgreSQL
 * using the EprintsRepository. Does NOT update Elasticsearch - use
 * reindex-all-eprints.ts for full reindex including Elasticsearch.
 *
 * Usage:
 *   pnpm tsx scripts/sync-did.ts <DID> [DID...]
 *
 * Example:
 *   pnpm tsx scripts/sync-did.ts did:plc:n2zv4h5ua2ajlkvjqbotz77w
 *
 * @packageDocumentation
 */

import pg from 'pg';
import { AtpAgent } from '@atproto/api';

import type { AtUri, CID } from '../src/types/atproto.js';
import type { StoredEprint } from '../src/types/interfaces/storage.interface.js';
import type { Eprint } from '../src/types/models/eprint.js';
import { transformPDSRecord } from '../src/services/eprint/pds-record-transformer.js';
import { EprintsRepository } from '../src/storage/postgresql/eprints-repository.js';

// =============================================================================
// Configuration
// =============================================================================

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://chive:chive_test_password@localhost:5432/chive';

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
// Type Conversion
// =============================================================================

/**
 * Convert Eprint model to StoredEprint for repository storage.
 *
 * @remarks
 * Handles type conversions:
 * - Timestamp (number) → Date for createdAt
 * - Adds indexing metadata (pdsUrl, indexedAt)
 * - Converts readonly arrays to mutable for storage
 */
function toStoredEprint(eprint: Eprint, pdsUrl: string): StoredEprint {
  return {
    uri: eprint.uri,
    cid: eprint.cid,
    authors: eprint.authors,
    submittedBy: eprint.submittedBy,
    paperDid: eprint.paperDid,
    title: eprint.title,
    abstract: eprint.abstract,
    abstractPlainText: eprint.abstractPlainText,
    documentBlobRef: eprint.documentBlobRef,
    documentFormat: eprint.documentFormat,
    supplementaryMaterials: eprint.supplementaryMaterials,
    previousVersionUri: eprint.previousVersionUri,
    version: eprint.version,
    versionNotes: eprint.versionNotes,
    keywords: eprint.keywords,
    fields: eprint.fields?.map((f) => ({
      uri: f.uri,
      label: f.label ?? f.uri, // Use URI as fallback if no label
      id: f.id,
    })),
    license: eprint.license,
    publicationStatus: eprint.publicationStatus,
    publishedVersion: eprint.publishedVersion,
    externalIds: eprint.externalIds,
    relatedWorks: eprint.relatedWorks,
    repositories: eprint.repositories,
    funding: eprint.funding,
    conferencePresentation: eprint.conferencePresentation,
    pdsUrl,
    indexedAt: new Date(),
    // Convert Timestamp (number) to Date
    createdAt: new Date(eprint.createdAt),
  };
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

  // Initialize repository
  const eprintsRepository = new EprintsRepository(pool);

  let totalIndexed = 0;
  let totalFailed = 0;

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
        // Transform PDS record to Eprint model
        const eprint = transformPDSRecord(record.value, record.uri as AtUri, record.cid as CID);

        // Convert to StoredEprint and store via repository
        const storedEprint = toStoredEprint(eprint, pdsUrl);
        const result = await eprintsRepository.store(storedEprint);

        if (result.ok) {
          console.log(`  ✅ Indexed: ${eprint.title}`);
          totalIndexed++;
        } else {
          console.log(`  ⚠️  Failed: ${result.error.message}`);
          totalFailed++;
        }
      } catch (error) {
        console.error(
          `  ❌ Failed to index ${record.uri}:`,
          error instanceof Error ? error.message : error
        );
        totalFailed++;
      }
    }
  }

  console.log(`\n✨ Done! Indexed ${totalIndexed} record(s) to PostgreSQL.`);
  if (totalFailed > 0) {
    console.log(`⚠️  ${totalFailed} record(s) failed.`);
  }
  console.log(`Note: Run reindex-all-eprints.ts to update Elasticsearch.`);

  await pool.end();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
