/**
 * Reindex all eprints from their PDSes.
 *
 * @remarks
 * Production-grade reindexing script with:
 * - Connection health checks before starting
 * - Rate limiting for PDS fetches (prevents overwhelming external servers)
 * - Progress tracking with ETA
 * - Retry logic with exponential backoff
 * - Comprehensive error handling and failure summary
 * - AT-URI to UUID normalization for Neo4j lookups
 * - Configurable batch size and concurrency
 *
 * Usage: npx tsx scripts/reindex-all-eprints.ts
 *
 * Environment variables:
 * - DATABASE_URL: PostgreSQL connection string
 * - ELASTICSEARCH_URL: Elasticsearch URL
 * - NEO4J_URI: Neo4j bolt URI
 * - NEO4J_USER: Neo4j username
 * - NEO4J_PASSWORD: Neo4j password
 * - REINDEX_BATCH_SIZE: Number of records per batch (default: 50)
 * - REINDEX_DELAY_MS: Delay between batches in ms (default: 1000)
 * - REINDEX_MAX_RETRIES: Max retries per record (default: 3)
 *
 * @packageDocumentation
 */

import { Pool } from 'pg';
import { AtpAgent } from '@atproto/api';
import { Client as ElasticsearchClient } from '@elastic/elasticsearch';
import neo4j, { Driver } from 'neo4j-driver';

import { transformPDSRecord } from '../src/services/eprint/pds-record-transformer.js';
import { mapEprintToDocument } from '../src/storage/elasticsearch/document-mapper.js';
import { setupElasticsearch } from '../src/storage/elasticsearch/setup.js';
import { extractRkeyOrPassthrough, normalizeFieldUri } from '../src/utils/at-uri.js';
import type { AtUri, CID } from '../src/types/atproto.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  batchSize: parseInt(process.env.REINDEX_BATCH_SIZE ?? '50', 10),
  delayBetweenBatchesMs: parseInt(process.env.REINDEX_DELAY_MS ?? '1000', 10),
  maxRetries: parseInt(process.env.REINDEX_MAX_RETRIES ?? '3', 10),
  pdsTimeoutMs: 30000,
  indexAlias: 'eprints',
  indexName: 'eprints-v1', // Fallback if alias doesn't exist
};

// =============================================================================
// TYPES
// =============================================================================

interface ReindexResult {
  uri: string;
  success: boolean;
  error?: string;
  retries: number;
}

interface ReindexStats {
  total: number;
  success: number;
  failed: number;
  skipped: number;
  startTime: number;
  endTime?: number;
  failedRecords: ReindexResult[];
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Sleep for specified milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay.
 */
function getBackoffDelay(attempt: number, baseMs: number = 1000): number {
  return Math.min(baseMs * Math.pow(2, attempt), 30000);
}

/**
 * Format duration in human-readable format.
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

// =============================================================================
// FIELD LABEL CACHE
// =============================================================================

class FieldLabelCache {
  private cache = new Map<string, string>();
  private driver: Driver;

  constructor(driver: Driver) {
    this.driver = driver;
  }

  /**
   * Resolve field ID to human-readable label from Neo4j knowledge graph.
   *
   * @param fieldUri - Full AT-URI or UUID of the field
   * @returns Human-readable label, or the UUID if not found
   */
  async resolveLabel(fieldUri: string): Promise<string> {
    // Normalize AT-URI to UUID
    const fieldId = extractRkeyOrPassthrough(fieldUri);

    // Check cache first
    if (this.cache.has(fieldId)) {
      return this.cache.get(fieldId)!;
    }

    const session = this.driver.session();
    try {
      // Query with Field label filter to match normal indexing behavior
      // This matches the query pattern used by getNodesByIds in node-repository.ts
      const result = await session.run(
        `
        MATCH (n:Node:Field)
        WHERE n.id = $id
        RETURN n.label as label
        LIMIT 1
        `,
        { id: fieldId }
      );

      const record = result.records[0];
      const label = record?.get('label') ?? fieldId;
      this.cache.set(fieldId, label);
      return label;
    } catch (error) {
      // Log but don't fail - use ID as fallback
      console.warn(`  Warning: Failed to resolve field label for ${fieldId}:`, error);
      this.cache.set(fieldId, fieldId);
      return fieldId;
    } finally {
      await session.close();
    }
  }

  get size(): number {
    return this.cache.size;
  }
}

// =============================================================================
// CONNECTION HEALTH CHECKS
// =============================================================================

async function checkPostgresHealth(pool: Pool): Promise<boolean> {
  try {
    const result = await pool.query('SELECT 1 as health');
    return result.rows[0]?.health === 1;
  } catch (error) {
    console.error('PostgreSQL health check failed:', error);
    return false;
  }
}

async function checkElasticsearchHealth(client: ElasticsearchClient): Promise<boolean> {
  try {
    const health = await client.cluster.health();
    return health.status === 'green' || health.status === 'yellow';
  } catch (error) {
    console.error('Elasticsearch health check failed:', error);
    return false;
  }
}

async function checkNeo4jHealth(driver: Driver): Promise<boolean> {
  const session = driver.session();
  try {
    await session.run('RETURN 1 as health');
    return true;
  } catch (error) {
    console.error('Neo4j health check failed:', error);
    return false;
  } finally {
    await session.close();
  }
}

// =============================================================================
// SINGLE RECORD REINDEXING
// =============================================================================

async function reindexSingleRecord(
  uri: string,
  pdsUrl: string,
  recordOwner: string,
  esClient: ElasticsearchClient,
  pgPool: Pool,
  fieldLabelCache: FieldLabelCache,
  indexName: string
): Promise<void> {
  // Validate inputs
  if (!uri) throw new Error('Missing URI');
  if (!pdsUrl) throw new Error('Missing PDS URL');

  // Extract rkey and DID from URI
  const parts = uri.split('/');
  const rkey = parts[parts.length - 1];
  const did = parts[2];

  if (!rkey || !did) {
    throw new Error(`Invalid AT-URI format: ${uri}`);
  }

  // Determine which DID to use for fetching
  const fetchDid = recordOwner || did;

  // Fetch fresh record from PDS
  const agent = new AtpAgent({ service: pdsUrl });

  const response = await Promise.race([
    agent.com.atproto.repo.getRecord({
      repo: fetchDid,
      collection: 'pub.chive.eprint.submission',
      rkey,
    }),
    sleep(CONFIG.pdsTimeoutMs).then(() => {
      throw new Error(`PDS request timed out after ${CONFIG.pdsTimeoutMs}ms`);
    }),
  ]);

  // Transform the record
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
        // Normalize URI to AT-URI format before resolving label
        const normalizedUri = normalizeFieldUri(f.uri);
        const label = await fieldLabelCache.resolveLabel(normalizedUri);
        return { ...f, uri: normalizedUri, label };
      })
    );
  }

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

  // Map to Elasticsearch document
  const eprintWithResolvedFields = { ...eprint, fields: fieldsWithLabels };
  const esDocument = mapEprintToDocument(eprintWithResolvedFields, pdsUrl);

  // Index to Elasticsearch
  await esClient.index({
    index: indexName,
    id: uri,
    document: esDocument,
  });
}

// =============================================================================
// BATCH PROCESSING
// =============================================================================

async function processBatch(
  batch: Array<{ uri: string; pds_url: string; paper_did: string; submitted_by: string }>,
  esClient: ElasticsearchClient,
  pgPool: Pool,
  fieldLabelCache: FieldLabelCache,
  indexName: string,
  stats: ReindexStats,
  batchIndex: number,
  totalBatches: number
): Promise<void> {
  const startTime = Date.now();

  for (const row of batch) {
    const uri = row.uri;
    const pdsUrl = row.pds_url;
    const recordOwner = row.paper_did || row.submitted_by;

    // Skip if missing required data
    if (!pdsUrl) {
      console.log(`  SKIP: ${uri} - Missing PDS URL`);
      stats.skipped++;
      continue;
    }

    let lastError: Error | undefined;
    let retries = 0;

    // Retry loop with exponential backoff
    for (let attempt = 0; attempt <= CONFIG.maxRetries; attempt++) {
      try {
        await reindexSingleRecord(
          uri,
          pdsUrl,
          recordOwner,
          esClient,
          pgPool,
          fieldLabelCache,
          indexName
        );

        stats.success++;
        retries = attempt;
        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        retries = attempt;

        if (attempt < CONFIG.maxRetries) {
          const delay = getBackoffDelay(attempt);
          console.log(`  RETRY ${attempt + 1}/${CONFIG.maxRetries}: ${uri} - ${lastError.message}`);
          await sleep(delay);
        }
      }
    }

    // Record failure if all retries exhausted
    if (lastError && retries >= CONFIG.maxRetries) {
      stats.failed++;
      stats.failedRecords.push({
        uri,
        success: false,
        error: lastError.message,
        retries,
      });
      console.log(`  FAIL: ${uri} - ${lastError.message}`);
    }
  }

  // Calculate progress and ETA
  const elapsed = Date.now() - stats.startTime;
  const processed = stats.success + stats.failed + stats.skipped;
  const rate = processed / (elapsed / 1000);
  const remaining = stats.total - processed;
  const etaMs = (remaining / rate) * 1000;

  const batchDuration = Date.now() - startTime;
  console.log(
    `  Batch ${batchIndex + 1}/${totalBatches} complete in ${formatDuration(batchDuration)} ` +
      `(${stats.success} ok, ${stats.failed} fail, ${stats.skipped} skip) - ` +
      `ETA: ${formatDuration(etaMs)}`
  );
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('='.repeat(60));
  console.log('EPRINT REINDEXING SCRIPT');
  console.log('='.repeat(60));
  console.log();

  console.log('Configuration:');
  console.log(`  Batch size: ${CONFIG.batchSize}`);
  console.log(`  Delay between batches: ${CONFIG.delayBetweenBatchesMs}ms`);
  console.log(`  Max retries per record: ${CONFIG.maxRetries}`);
  console.log();

  // ==========================================================================
  // CONNECT TO DATABASES
  // ==========================================================================

  console.log('Connecting to databases...');

  const pgPool = new Pool({
    connectionString:
      process.env.DATABASE_URL || 'postgresql://chive:chive_test_password@127.0.0.1:5432/chive',
  });

  const esClient = new ElasticsearchClient({
    node: process.env.ELASTICSEARCH_URL || 'http://127.0.0.1:9200',
  });

  const neo4jDriver = neo4j.driver(
    process.env.NEO4J_URI || 'bolt://127.0.0.1:7687',
    neo4j.auth.basic(
      process.env.NEO4J_USER || 'neo4j',
      process.env.NEO4J_PASSWORD || 'chive_test_password'
    )
  );

  // ==========================================================================
  // HEALTH CHECKS
  // ==========================================================================

  console.log('Running health checks...');

  const [pgHealthy, esHealthy, neo4jHealthy] = await Promise.all([
    checkPostgresHealth(pgPool),
    checkElasticsearchHealth(esClient),
    checkNeo4jHealth(neo4jDriver),
  ]);

  if (!pgHealthy) {
    throw new Error('PostgreSQL is not healthy - aborting reindex');
  }
  console.log('  ✓ PostgreSQL is healthy');

  if (!esHealthy) {
    throw new Error('Elasticsearch is not healthy - aborting reindex');
  }
  console.log('  ✓ Elasticsearch is healthy');

  if (!neo4jHealthy) {
    throw new Error('Neo4j is not healthy - aborting reindex');
  }
  console.log('  ✓ Neo4j is healthy');

  // ==========================================================================
  // RECREATE ELASTICSEARCH INDEX
  // ==========================================================================
  // Delete and recreate the index to apply the latest mapping template.
  // This is safe because all data is re-fetched from PDSes.

  console.log();
  console.log('Recreating Elasticsearch index with latest mapping...');

  const indexName = 'eprints-v1';
  const aliasName = 'eprints';

  // Delete existing index if it exists
  const indexExists = await esClient.indices.exists({ index: indexName });
  if (indexExists) {
    console.log(`  Deleting existing index '${indexName}'...`);
    await esClient.indices.delete({ index: indexName });
  }

  // Run full Elasticsearch setup (creates ILM policy, template, pipeline, and index)
  console.log('  Running Elasticsearch setup...');
  await setupElasticsearch(esClient);
  console.log(`  ✓ Index '${indexName}' created with alias '${aliasName}'`);

  console.log();

  // ==========================================================================
  // FETCH ALL EPRINTS
  // ==========================================================================

  console.log('Fetching eprints from PostgreSQL...');

  const result = await pgPool.query(`
    SELECT uri, pds_url, submitted_by, paper_did
    FROM eprints_index
    WHERE pds_url IS NOT NULL
    ORDER BY created_at DESC
  `);

  const records = result.rows;
  const totalBatches = Math.ceil(records.length / CONFIG.batchSize);

  console.log(`Found ${records.length} eprints to reindex (${totalBatches} batches)`);
  console.log();

  if (records.length === 0) {
    console.log('No eprints to reindex. Exiting.');
    await cleanup(pgPool, esClient, neo4jDriver);
    return;
  }

  // ==========================================================================
  // PROCESS IN BATCHES
  // ==========================================================================

  const fieldLabelCache = new FieldLabelCache(neo4jDriver);

  const stats: ReindexStats = {
    total: records.length,
    success: 0,
    failed: 0,
    skipped: 0,
    startTime: Date.now(),
    failedRecords: [],
  };

  console.log('Starting reindexing...');
  console.log();

  for (let i = 0; i < totalBatches; i++) {
    const start = i * CONFIG.batchSize;
    const end = Math.min(start + CONFIG.batchSize, records.length);
    const batch = records.slice(start, end);

    await processBatch(batch, esClient, pgPool, fieldLabelCache, indexName, stats, i, totalBatches);

    // Delay between batches to avoid overwhelming services
    if (i < totalBatches - 1) {
      await sleep(CONFIG.delayBetweenBatchesMs);
    }
  }

  // ==========================================================================
  // REFRESH INDEX
  // ==========================================================================

  console.log();
  console.log('Refreshing Elasticsearch index...');
  await esClient.indices.refresh({ index: indexName });

  // ==========================================================================
  // PRINT SUMMARY
  // ==========================================================================

  stats.endTime = Date.now();
  const duration = stats.endTime - stats.startTime;

  console.log();
  console.log('='.repeat(60));
  console.log('REINDEXING COMPLETE');
  console.log('='.repeat(60));
  console.log();
  console.log(`Duration: ${formatDuration(duration)}`);
  console.log(`Total records: ${stats.total}`);
  console.log(
    `  Successful: ${stats.success} (${((stats.success / stats.total) * 100).toFixed(1)}%)`
  );
  console.log(`  Failed: ${stats.failed} (${((stats.failed / stats.total) * 100).toFixed(1)}%)`);
  console.log(`  Skipped: ${stats.skipped} (${((stats.skipped / stats.total) * 100).toFixed(1)}%)`);
  console.log(`Field labels cached: ${fieldLabelCache.size}`);

  if (stats.failedRecords.length > 0) {
    console.log();
    console.log('Failed records:');
    for (const record of stats.failedRecords.slice(0, 20)) {
      console.log(`  ${record.uri}: ${record.error}`);
    }
    if (stats.failedRecords.length > 20) {
      console.log(`  ... and ${stats.failedRecords.length - 20} more`);
    }
  }

  // ==========================================================================
  // CLEANUP
  // ==========================================================================

  await cleanup(pgPool, esClient, neo4jDriver);

  // Exit with error code if there were failures
  if (stats.failed > 0) {
    console.log();
    console.log('WARNING: Some records failed to reindex. Check logs above.');
    process.exit(1);
  }
}

async function cleanup(pool: Pool, esClient: ElasticsearchClient, neo4jDriver: Driver) {
  await pool.end();
  await esClient.close();
  await neo4jDriver.close();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
