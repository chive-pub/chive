/**
 * Manual script to index a user's eprints from their PDS.
 *
 * Usage: npx tsx scripts/index-user-eprints.ts
 */

import { AtpAgent } from '@atproto/api';
import { Pool } from 'pg';
import { Client as ElasticsearchClient } from '@elastic/elasticsearch';

import { transformPDSRecord } from '../src/services/eprint/pds-record-transformer.js';
import type { AtUri, CID } from '../src/types/atproto.js';

async function main() {
  const users = [
    { pdsUrl: 'https://eurosky.social', did: 'did:plc:n2zv4h5ua2ajlkvjqbotz77w' },
    {
      pdsUrl: 'https://shimeji.us-east.host.bsky.network',
      did: 'did:plc:mgcfy7hmflw4zuvc27caz2wn',
    },
    { pdsUrl: 'https://button.us-west.host.bsky.network', did: 'did:plc:nlgzz5gr6dlaku5hzx4oolq5' },
    {
      pdsUrl: 'https://phellinus.us-west.host.bsky.network',
      did: 'did:plc:7ra5nksqml3pwkxwzpksxec2',
    },
    { pdsUrl: 'https://morel.us-east.host.bsky.network', did: 'did:plc:34mbm5v3umztwvvgnttvcz6e' },
  ];

  console.log('Connecting to databases...');

  // Connect to PostgreSQL
  const pgPool = new Pool({
    connectionString:
      process.env.DATABASE_URL || 'postgresql://chive:chive_test_password@127.0.0.1:5432/chive',
  });

  // Connect to Elasticsearch
  const esClient = new ElasticsearchClient({
    node: process.env.ELASTICSEARCH_URL || 'http://127.0.0.1:9200',
  });

  let totalIndexed = 0;

  for (const { pdsUrl, did } of users) {
    console.log(`\n--- Fetching eprints for ${did} from ${pdsUrl} ---`);

    const agent = new AtpAgent({ service: pdsUrl });

    try {
      const response = await agent.com.atproto.repo.listRecords({
        repo: did,
        collection: 'pub.chive.eprint.submission',
        limit: 100,
      });

      console.log(`Found ${response.data.records.length} eprints`);

      for (const record of response.data.records) {
        console.log(`\nIndexing: ${record.uri}`);
        console.log(`  Title: ${(record.value as any).title?.substring(0, 50)}...`);

        try {
          const transformed = transformPDSRecord(
            record.value as Record<string, unknown>,
            record.uri as AtUri,
            record.cid as CID
          );

          const existing = await pgPool.query('SELECT uri FROM eprints_index WHERE uri = $1', [
            record.uri,
          ]);

          if (existing.rows.length > 0) {
            console.log('  Already indexed, updating...');
          }

          const createdAtDate = new Date(transformed.createdAt);

          await pgPool.query(
            `
            INSERT INTO eprints_index (
              uri, cid, title, abstract, abstract_plain_text, authors, keywords,
              license, document_blob_cid, document_blob_mime_type, document_blob_size,
              document_format, pds_url, created_at, indexed_at, updated_at, submitted_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            ON CONFLICT (uri) DO UPDATE SET
              cid = EXCLUDED.cid,
              title = EXCLUDED.title,
              abstract = EXCLUDED.abstract,
              abstract_plain_text = EXCLUDED.abstract_plain_text,
              authors = EXCLUDED.authors,
              keywords = EXCLUDED.keywords,
              license = EXCLUDED.license,
              document_blob_cid = EXCLUDED.document_blob_cid,
              document_blob_mime_type = EXCLUDED.document_blob_mime_type,
              document_blob_size = EXCLUDED.document_blob_size,
              document_format = EXCLUDED.document_format,
              pds_url = EXCLUDED.pds_url,
              updated_at = EXCLUDED.updated_at
          `,
            [
              record.uri,
              record.cid,
              transformed.title,
              JSON.stringify(transformed.abstract),
              transformed.abstractPlainText || '',
              JSON.stringify(transformed.authors),
              transformed.keywords || [],
              transformed.license,
              transformed.documentBlobRef.ref,
              transformed.documentBlobRef.mimeType,
              transformed.documentBlobRef.size,
              transformed.documentFormat || 'pdf',
              pdsUrl,
              createdAtDate,
              new Date(),
              new Date(),
              transformed.submittedBy,
            ]
          );

          await esClient.index({
            index: 'eprints',
            id: record.uri,
            document: {
              uri: record.uri,
              cid: record.cid,
              title: transformed.title,
              abstract: transformed.abstractPlainText || '',
              authors: transformed.authors.map((a) => ({
                did: a.did,
                name: a.name,
                orcid: a.orcid,
                order: a.order,
              })),
              keywords: transformed.keywords || [],
              license: transformed.license,
              document_format: transformed.documentFormat || 'pdf',
              pds_url: pdsUrl,
              created_at: transformed.createdAt,
              indexed_at: new Date().toISOString(),
              submitted_by: transformed.submittedBy,
            },
          });

          console.log('  Successfully indexed!');
          totalIndexed++;
        } catch (error) {
          console.error(`  Error: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Update PDS registry for this PDS
      await pgPool.query(
        `
        UPDATE pds_registry
        SET status = 'active',
            has_chive_records = true,
            chive_record_count = $2,
            last_scan_at = NOW(),
            next_scan_at = NOW() + INTERVAL '24 hours'
        WHERE pds_url = $1
      `,
        [pdsUrl, response.data.records.length]
      );
    } catch (error) {
      console.error(
        `  Failed to fetch from ${pdsUrl}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  console.log(`\nDone! Indexed ${totalIndexed} eprints across ${users.length} PDSes.`);

  await pgPool.end();
  await esClient.close();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
