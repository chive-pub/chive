/**
 * Reindex all eprints from their PDSes.
 *
 * Usage: npx tsx scripts/reindex-all-eprints.ts
 */

import { Pool } from 'pg';
import { AtpAgent } from '@atproto/api';
import { Client as ElasticsearchClient } from '@elastic/elasticsearch';
import neo4j from 'neo4j-driver';

import { transformPDSRecord } from '../src/services/eprint/pds-record-transformer.js';
import { mapEprintToDocument } from '../src/storage/elasticsearch/document-mapper.js';
import type { AtUri, CID } from '../src/types/atproto.js';

// Cache for field labels to avoid repeated Neo4j lookups
const fieldLabelCache = new Map<string, string>();

async function main() {
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

  // Connect to Neo4j
  const neo4jDriver = neo4j.driver(
    process.env.NEO4J_URL || 'bolt://127.0.0.1:7687',
    neo4j.auth.basic(
      process.env.NEO4J_USER || 'neo4j',
      process.env.NEO4J_PASSWORD || 'chive_test_password'
    )
  );

  /**
   * Resolve field ID to human-readable label from Neo4j knowledge graph.
   */
  async function resolveFieldLabel(fieldId: string): Promise<string> {
    // Check cache first
    if (fieldLabelCache.has(fieldId)) {
      return fieldLabelCache.get(fieldId)!;
    }

    const session = neo4jDriver.session();
    try {
      const result = await session.run('MATCH (n:Node {id: $id}) RETURN n.label as label', {
        id: fieldId,
      });
      const label = result.records[0]?.get('label') ?? fieldId;
      fieldLabelCache.set(fieldId, label);
      return label;
    } catch {
      return fieldId; // Fall back to ID if lookup fails
    } finally {
      await session.close();
    }
  }

  // Get all indexed eprints from PostgreSQL
  const result = await pgPool.query(`
    SELECT uri, pds_url, submitted_by, paper_did
    FROM eprints_index
    ORDER BY created_at DESC
  `);

  console.log(`Found ${result.rows.length} eprints to reindex\n`);

  for (const row of result.rows) {
    const uri = row.uri as string;
    const pdsUrl = row.pds_url as string;
    const recordOwner = row.paper_did || row.submitted_by;

    console.log(`Reindexing: ${uri}`);
    console.log(`  PDS: ${pdsUrl}`);

    try {
      // Fetch fresh record from PDS
      const agent = new AtpAgent({ service: pdsUrl });

      // Extract rkey from URI
      const rkey = uri.split('/').pop()!;
      const did = uri.split('/')[2];

      const response = await agent.com.atproto.repo.getRecord({
        repo: recordOwner || did,
        collection: 'pub.chive.eprint.submission',
        rkey,
      });

      // Transform the record using the updated transformer (which now includes fields)
      const eprint = transformPDSRecord(
        response.data.value as Record<string, unknown>,
        uri as AtUri,
        response.data.cid as CID
      );

      // Resolve field labels from Neo4j knowledge graph
      let fieldsWithLabels = eprint.fields;
      if (eprint.fields && eprint.fields.length > 0) {
        fieldsWithLabels = await Promise.all(
          eprint.fields.map(async (f) => {
            const label = await resolveFieldLabel(f.uri);
            return { ...f, label };
          })
        );
      }

      console.log(`  Title: ${eprint.title.substring(0, 50)}...`);
      console.log(`  Fields: ${fieldsWithLabels?.map((f) => f.label).join(', ') || 'none'}`);

      // Update PostgreSQL with fields (including resolved labels)
      await pgPool.query(
        `
        UPDATE eprints_index
        SET fields = $2,
            indexed_at = NOW()
        WHERE uri = $1
      `,
        [uri, fieldsWithLabels ? JSON.stringify(fieldsWithLabels) : null]
      );

      // Map to Elasticsearch document using the resolved field labels
      const eprintWithResolvedFields = { ...eprint, fields: fieldsWithLabels };
      const esDocument = mapEprintToDocument(eprintWithResolvedFields, pdsUrl);

      // Update Elasticsearch
      await esClient.index({
        index: 'eprints-v1',
        id: uri,
        document: esDocument,
      });

      console.log(`  Successfully reindexed!`);
      console.log(
        `  field_nodes: ${esDocument.field_nodes?.map((f) => f.label).join(', ') || 'none'}`
      );
    } catch (error) {
      console.error(`  Error: ${error instanceof Error ? error.message : String(error)}`);
    }

    console.log('');
  }

  // Refresh ES index
  await esClient.indices.refresh({ index: 'eprints-v1' });

  console.log('Done! All eprints reindexed.');
  console.log(`Field label cache: ${fieldLabelCache.size} unique fields resolved`);

  await pgPool.end();
  await esClient.close();
  await neo4jDriver.close();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
