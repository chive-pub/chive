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
import { Queue } from 'bullmq';

import { transformPDSRecord } from '../src/services/eprint/pds-record-transformer.js';
import { mapEprintToDocument } from '../src/storage/elasticsearch/document-mapper.js';
import { setupElasticsearch } from '../src/storage/elasticsearch/setup.js';
import {
  needsLabelResolution,
  resolveFieldLabels,
  type NodeLookup,
} from '../src/utils/field-label.js';
import type { AtUri, CID } from '../src/types/atproto.js';
import { INDEX_RETRY_QUEUE_NAME } from '../src/workers/index-retry-worker.js';
import { makeJobId } from '../src/utils/at-uri.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  batchSize: parseInt(process.env.REINDEX_BATCH_SIZE ?? '50', 10),
  delayBetweenBatchesMs: parseInt(process.env.REINDEX_DELAY_MS ?? '1000', 10),
  maxRetries: parseInt(process.env.REINDEX_MAX_RETRIES ?? '3', 10),
  pdsTimeoutMs: 30000,
  /**
   * How long to wait for the Neo4j knowledge graph to become populated before
   * aborting. Deploys recreate Neo4j and repopulate it asynchronously, so the
   * graph is routinely empty for the first few seconds after a restart.
   */
  graphWaitMs: parseInt(process.env.REINDEX_GRAPH_WAIT_MS ?? '60000', 10),
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
  /**
   * Records that no longer exist in their PDS and were therefore removed from
   * the index (orphans left behind when a firehose delete was missed). These
   * are a successful outcome, not a failure.
   */
  pruned: number;
  startTime: number;
  endTime?: number;
  failedRecords: ReindexResult[];
  prunedRecords: string[];
}

/**
 * Whether an error from `getRecord` means the record is definitively gone from
 * its PDS (deleted), as opposed to a transient failure (timeout, network, 5xx).
 *
 * @remarks
 * Only a definitive "not found" justifies pruning the index row. Transient
 * errors must keep retrying/failing so a flaky PDS never causes data loss.
 */
function isRecordGoneError(error: Error): boolean {
  const message = error.message.toLowerCase();
  const name = (error as { error?: string }).error?.toLowerCase() ?? '';
  return (
    name === 'recordnotfound' ||
    message.includes('could not locate record') ||
    message.includes('record not found')
  );
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
// NEO4J NODE LOOKUP ADAPTER
// =============================================================================

/**
 * Create a NodeLookup adapter from a raw Neo4j driver.
 * Includes a label cache for batch efficiency across multiple records.
 */
function createNodeLookup(driver: Driver): NodeLookup & { cacheSize: number } {
  const cache = new Map<string, string>();
  return {
    async getNodesByIds(ids: readonly string[]) {
      const map = new Map<string, { label: string }>();
      const uncached: string[] = [];
      for (const id of ids) {
        if (cache.has(id)) {
          map.set(id, { label: cache.get(id)! });
        } else {
          uncached.push(id);
        }
      }
      if (uncached.length === 0) return map;
      const session = driver.session();
      try {
        const result = await session.run(
          'MATCH (n:Node) WHERE n.id IN $ids RETURN n.id AS id, n.label AS label',
          { ids: uncached }
        );
        for (const record of result.records) {
          const id = record.get('id');
          const label = record.get('label');
          if (id && label) {
            cache.set(id, label);
            map.set(id, { label });
          }
        }
      } finally {
        await session.close();
      }
      return map;
    },
    get cacheSize() {
      return cache.size;
    },
  };
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

/**
 * Waits until the Neo4j knowledge graph actually contains nodes.
 *
 * @param driver - Neo4j driver
 * @param timeoutMs - How long to wait before giving up
 * @returns The node count once non-zero, or 0 if the timeout elapsed
 *
 * @remarks
 * A passing health check only proves Neo4j is reachable, not that the graph is
 * populated. Deploys recreate Neo4j and repopulate it asynchronously, so this
 * script can otherwise win the race and resolve every field label against an
 * empty graph — silently persisting UUIDs into PostgreSQL and Elasticsearch,
 * where they stay visible in the UI until someone reindexes by hand.
 */
async function waitForPopulatedGraph(driver: Driver, timeoutMs: number): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  let reported = false;

  for (;;) {
    const session = driver.session();
    try {
      const result = await session.run('MATCH (n:Node) RETURN count(n) AS count');
      const count = result.records[0]?.get('count')?.toNumber?.() ?? 0;
      if (count > 0) return count;
    } catch (error) {
      console.error('  Neo4j node count query failed:', error);
    } finally {
      await session.close();
    }

    if (Date.now() >= deadline) return 0;

    if (!reported) {
      console.log('  Knowledge graph is empty, waiting for it to populate...');
      reported = true;
    }
    await sleep(5000);
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
  nodeLookup: NodeLookup,
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

  // Resolve field labels from Neo4j knowledge graph. If the graph cannot resolve
  // a label, fall back to whatever PostgreSQL already holds for that field id:
  // an unresolvable lookup must never downgrade a good label to a raw UUID.
  const resolved = await resolveFieldLabels(eprint.fields, nodeLookup);
  const fieldsWithLabels = await preserveResolvedLabels(pgPool, uri, resolved);

  // Update PostgreSQL with fields (including resolved labels)
  await pgPool.query(
    `
    UPDATE eprints_index
    SET fields = $2,
        indexed_at = NOW()
    WHERE uri = $1
    `,
    [uri, fieldsWithLabels.length > 0 ? JSON.stringify(fieldsWithLabels) : null]
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

/**
 * Keeps labels that PostgreSQL already resolved when the graph cannot resolve them.
 *
 * @param pool - PostgreSQL pool
 * @param uri - AT-URI of the eprint being reindexed
 * @param fields - Fields as returned by the knowledge graph lookup
 * @returns Fields with any unresolved label replaced by the stored one, when present
 *
 * @remarks
 * `resolveFieldLabels` returns the original value — typically a raw UUID — when
 * Neo4j has no matching node, and swallows the error that caused it. Writing
 * that straight back replaces a correct label with a UUID, which is what put
 * UUIDs on production eprint cards after a deploy wiped the graph. Preserving
 * the stored label makes a failed or racing lookup a no-op instead of damage.
 */
async function preserveResolvedLabels(
  pool: Pool,
  uri: string,
  fields: { uri: string; label: string; id: string }[]
): Promise<{ uri: string; label: string; id: string }[]> {
  if (fields.length === 0) return fields;
  if (!fields.some((f) => needsLabelResolution(f.label))) return fields;

  try {
    const existing = await pool.query<{ fields: string | null }>(
      'SELECT fields::text AS fields FROM eprints_index WHERE uri = $1',
      [uri]
    );

    const raw = existing.rows[0]?.fields;
    if (!raw) return fields;

    const stored = JSON.parse(raw) as { id?: string; label?: string }[];
    const byId = new Map(
      stored
        .filter((f) => f.id && f.label && !needsLabelResolution(f.label))
        .map((f) => [f.id as string, f.label as string])
    );
    if (byId.size === 0) return fields;

    return fields.map((f) =>
      needsLabelResolution(f.label) && byId.has(f.id)
        ? { ...f, label: byId.get(f.id) as string }
        : f
    );
  } catch {
    return fields;
  }
}

// =============================================================================
// BATCH PROCESSING
// =============================================================================

/**
 * Remove an orphaned eprint (deleted from its PDS but still indexed) from the
 * Postgres and Elasticsearch indexes.
 *
 * @remarks
 * Deleting from the AppView's own indexes is ATProto-compliant: the PDS remains
 * the source of truth and the record is already gone there. This is the same
 * cleanup the firehose delete performs; doing it here makes a full reindex
 * self-healing for orphans a missed firehose event left behind.
 */
async function pruneEprintFromIndex(
  uri: string,
  esClient: ElasticsearchClient,
  pgPool: Pool,
  indexName: string
): Promise<void> {
  await pgPool.query(`DELETE FROM eprints_index WHERE uri = $1`, [uri]);

  try {
    await esClient.delete({ index: indexName, id: uri });
  } catch (error) {
    // A 404 here just means it was never indexed in ES; ignore it.
    const status = (error as { meta?: { statusCode?: number } }).meta?.statusCode;
    if (status !== 404) {
      throw error;
    }
  }
}

async function processBatch(
  batch: Array<{ uri: string; pds_url: string; paper_did: string; submitted_by: string }>,
  esClient: ElasticsearchClient,
  pgPool: Pool,
  nodeLookup: NodeLookup,
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
    let pruned = false;

    // Retry loop with exponential backoff
    for (let attempt = 0; attempt <= CONFIG.maxRetries; attempt++) {
      try {
        await reindexSingleRecord(
          uri,
          pdsUrl,
          recordOwner,
          esClient,
          pgPool,
          nodeLookup,
          indexName
        );

        stats.success++;
        retries = attempt;
        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        retries = attempt;

        // The record is gone from its PDS (deleted): retrying won't help. Prune
        // the orphaned index row instead of failing the whole reindex.
        if (isRecordGoneError(lastError)) {
          await pruneEprintFromIndex(uri, esClient, pgPool, indexName);
          stats.pruned++;
          stats.prunedRecords.push(uri);
          console.log(`  PRUNE: ${uri} - deleted from PDS, removed from index`);
          pruned = true;
          break;
        }

        if (attempt < CONFIG.maxRetries) {
          const delay = getBackoffDelay(attempt);
          console.log(`  RETRY ${attempt + 1}/${CONFIG.maxRetries}: ${uri} - ${lastError.message}`);
          await sleep(delay);
        }
      }
    }

    // Record failure if all retries exhausted (pruned records are not failures)
    if (!pruned && lastError && retries >= CONFIG.maxRetries) {
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

  // Deploys recreate Neo4j and repopulate it asynchronously, so give the graph a
  // moment before resolving anything against it.
  const graphNodeCount = await waitForPopulatedGraph(neo4jDriver, CONFIG.graphWaitMs);
  if (graphNodeCount === 0) {
    console.warn(
      `  ! Knowledge graph is empty after ${Math.round(CONFIG.graphWaitMs / 1000)}s. Field labels ` +
        'cannot be resolved; already-resolved labels will be preserved rather than overwritten.'
    );
  } else {
    console.log(`  ✓ Knowledge graph is populated (${graphNodeCount} nodes)`);
  }

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

  const nodeLookup = createNodeLookup(neo4jDriver);

  const stats: ReindexStats = {
    total: records.length,
    success: 0,
    failed: 0,
    skipped: 0,
    pruned: 0,
    startTime: Date.now(),
    failedRecords: [],
    prunedRecords: [],
  };

  console.log('Starting reindexing...');
  console.log();

  for (let i = 0; i < totalBatches; i++) {
    const start = i * CONFIG.batchSize;
    const end = Math.min(start + CONFIG.batchSize, records.length);
    const batch = records.slice(start, end);

    await processBatch(batch, esClient, pgPool, nodeLookup, indexName, stats, i, totalBatches);

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
  console.log(
    `  Pruned (deleted from PDS): ${stats.pruned} (${((stats.pruned / stats.total) * 100).toFixed(1)}%)`
  );
  console.log(`Field labels cached: ${nodeLookup.cacheSize}`);

  // A run that resolved nothing while unresolved labels remain means the
  // knowledge graph lookups silently failed: resolveFieldLabels swallows all
  // errors and returns the original UUID. Surface it instead of reporting a
  // clean reindex over visibly broken data.
  const unresolved = await pgPool.query<{ count: string }>(
    `SELECT count(*) AS count
     FROM eprints_index
     WHERE fields::text ~ '"label": "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"'
       AND deleted_at IS NULL`
  );
  const unresolvedCount = parseInt(unresolved.rows[0]?.count ?? '0', 10);
  let unresolvedLabels = false;
  if (unresolvedCount > 0 && graphNodeCount > 0) {
    console.error();
    console.error(
      `ERROR: ${unresolvedCount} eprint(s) still carry raw UUIDs as field labels after reindexing,`
    );
    console.error(
      `even though the knowledge graph holds ${graphNodeCount} nodes. Those field ids are missing`
    );
    console.error('from the graph, or the lookup failed silently.');
    unresolvedLabels = true;
  } else if (unresolvedCount > 0) {
    console.warn(
      `  ! ${unresolvedCount} eprint(s) carry unresolved field labels because the knowledge graph ` +
        'is empty. Populate it via the governance sync, then reindex.'
    );
  } else {
    console.log('Field labels: all resolved');
  }

  if (stats.prunedRecords.length > 0) {
    console.log();
    console.log('Pruned orphaned records (no longer in PDS):');
    for (const uri of stats.prunedRecords.slice(0, 20)) {
      console.log(`  ${uri}`);
    }
    if (stats.prunedRecords.length > 20) {
      console.log(`  ... and ${stats.prunedRecords.length - 20} more`);
    }
  }

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

  // A record Chive could not fetch is not a reason to fail the run.
  //
  // The records live in user PDSes, any of which can be unreachable,
  // rate-limiting or slow at the moment this happens to run. That leaves the
  // index stale, not wrong, and this script is not the last step of a deploy —
  // failing here skips everything after it.
  //
  // Failures that would leave the index serving something *wrong* are treated
  // differently: a record gone from its PDS is pruned earlier in the run, and
  // unresolved field labels still exit non-zero below.
  const transient = stats.failedRecords.filter((record) => isTransient(record.error));
  const permanent = stats.failed - transient.length;

  if (transient.length > 0) {
    console.log();
    const queued = await enqueueForRetry(transient);
    console.log(
      `${String(transient.length)} record(s) could not be fetched from their PDS; ` +
        `${String(queued)} queued for background retry.`
    );
  }

  if (permanent > 0) {
    console.log();
    console.log('WARNING: Some records failed to reindex for reasons other than PDS access.');
    process.exit(1);
  }

  // Unresolved labels mean the index is live with raw UUIDs where field names
  // belong. Fail so the deploy surfaces it rather than reporting success.
  if (unresolvedLabels) {
    process.exit(1);
  }
}

/**
 * Whether a reindex failure is a transient inability to reach a PDS.
 *
 * @param error - The recorded failure message
 * @returns True when the record could not be fetched, rather than being wrong
 *
 * @remarks
 * A PDS that is down, rate-limiting, or slow is an ordinary condition for an
 * AppView, and the record is still whatever it was — nothing about the index is
 * now incorrect, only stale. A parse or validation failure is different: that
 * record cannot be indexed correctly however many times it is retried.
 */
function isTransient(error: string | undefined): boolean {
  const message = (error ?? '').toLowerCase();
  return (
    message.includes('fetch failed') ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('econnrefused') ||
    message.includes('econnreset') ||
    message.includes('enotfound') ||
    message.includes('socket hang up') ||
    message.includes('rate limit') ||
    message.includes('429') ||
    message.includes('502') ||
    message.includes('503') ||
    message.includes('504')
  );
}

/**
 * Hands unfetched records to the retry worker.
 *
 * @param records - Records the reindex could not fetch
 * @returns How many were queued
 *
 * @remarks
 * The running service has an index retry worker — a BullMQ queue that resolves
 * the DID, re-fetches from the PDS and indexes, backing off exponentially
 * across ten attempts — so failures go there rather than being reported and
 * forgotten. The reindex finishes, the deploy proceeds, and the records are
 * retried in the background.
 *
 * If the queue exhausts its attempts, the periodic freshness scan selects
 * records by how long ago they were synced, so one that was never fetched sorts
 * to the front of the next scan. Between the two there is no state in which a
 * record is stale and nothing will try it again.
 *
 * Jobs are keyed by URI, so a record already queued is not queued twice.
 *
 * Failing to enqueue is logged and otherwise ignored: the reindex has already
 * done its work, and Redis being unavailable is not a reason to fail a deploy
 * either.
 */
async function enqueueForRetry(records: readonly ReindexResult[]): Promise<number> {
  if (records.length === 0) return 0;

  const redisUrl = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');
  const queue = new Queue(INDEX_RETRY_QUEUE_NAME, {
    connection: {
      host: redisUrl.hostname,
      port: Number.parseInt(redisUrl.port || '6379', 10),
    },
  });

  let queued = 0;

  try {
    for (const record of records) {
      // at://did/collection/rkey
      const [, , did, collection, rkey] = record.uri.split('/');
      if (!did || !collection || !rkey) continue;

      await queue.add(
        'index-retry',
        {
          uri: record.uri,
          did,
          collection,
          rkey,
          originalError: record.error,
          failedAt: new Date().toISOString(),
        },
        { jobId: makeJobId('retry', record.uri) }
      );
      queued += 1;
    }
  } catch (error) {
    console.log(
      `  Could not queue records for retry: ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    await queue.close();
  }

  return queued;
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
