/**
 * Manual citation extraction script for backfilling or re-extracting citations.
 *
 * @remarks
 * Processes eprints through the citation extraction pipeline:
 * 1. Fetches eprint metadata from PostgreSQL
 * 2. Extracts citations via GROBID (PDF) or document text extraction
 * 3. Enriches with Semantic Scholar and Crossref
 * 4. Matches citations to Chive-indexed eprints
 * 5. Stores results in PostgreSQL and Neo4j citation graph
 *
 * Usage:
 *   npx tsx scripts/extract-citations.ts [uri1] [uri2] ...
 *   npx tsx scripts/extract-citations.ts --all
 *
 * Environment variables:
 * - DATABASE_URL: PostgreSQL connection string
 * - REDIS_URL: Redis connection string
 * - NEO4J_URI: Neo4j bolt URI
 * - NEO4J_USER: Neo4j username
 * - NEO4J_PASSWORD: Neo4j password
 * - PLC_DIRECTORY_URL: PLC directory for DID resolution
 * - GROBID_URL: GROBID service URL
 *
 * @packageDocumentation
 */

import 'reflect-metadata';

import { Redis } from 'ioredis';
import { Pool } from 'pg';

import { DIDResolver } from '../src/auth/did/did-resolver.js';
import { getGrobidConfig } from '../src/config/grobid.js';
import type { CitationExtractionJobResult } from '../src/jobs/citation-extraction-job.js';
import { CitationExtractionJob } from '../src/jobs/citation-extraction-job.js';
import { PinoLogger } from '../src/observability/logger.js';
import { ATRepository } from '../src/atproto/repository/at-repository.js';
import { CitationExtractionService } from '../src/services/citation/citation-extraction-service.js';
import { DocumentTextExtractor } from '../src/services/citation/document-text-extractor.js';
import { GrobidClient } from '../src/services/citation/grobid-client.js';
import { createResiliencePolicy } from '../src/services/common/resilience.js';
import { CitationGraph } from '../src/storage/neo4j/citation-graph.js';
import { Neo4jConnection } from '../src/storage/neo4j/connection.js';
import type { AtUri } from '../src/types/atproto.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  batchSize: 10,
  delayBetweenBatchesMs: 2000,
};

// =============================================================================
// TYPES
// =============================================================================

interface ExtractionStats {
  total: number;
  success: number;
  failed: number;
  totalCitationsExtracted: number;
  startTime: number;
  endTime?: number;
  failedRecords: { uri: string; error: string }[];
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

async function checkRedisHealth(redis: Redis): Promise<boolean> {
  try {
    const pong = await redis.ping();
    return pong === 'PONG';
  } catch (error) {
    console.error('Redis health check failed:', error);
    return false;
  }
}

async function checkNeo4jHealth(connection: Neo4jConnection): Promise<boolean> {
  try {
    const health = await connection.healthCheck();
    return health.healthy;
  } catch (error) {
    console.error('Neo4j health check failed:', error);
    return false;
  }
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  // ==========================================================================
  // PARSE CLI ARGUMENTS
  // ==========================================================================

  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage:');
    console.error('  npx tsx scripts/extract-citations.ts [uri1] [uri2] ...');
    console.error('  npx tsx scripts/extract-citations.ts --all');
    process.exit(1);
  }

  const extractAll = args.includes('--all');
  const uris = extractAll ? [] : args;

  console.log('='.repeat(60));
  console.log('CITATION EXTRACTION SCRIPT');
  console.log('='.repeat(60));
  console.log();

  if (extractAll) {
    console.log('Mode: Extract citations for ALL eprints');
  } else {
    console.log(`Mode: Extract citations for ${uris.length} eprint(s)`);
    for (const uri of uris) {
      console.log(`  ${uri}`);
    }
  }
  console.log();

  console.log('Configuration:');
  console.log(`  Batch size: ${CONFIG.batchSize}`);
  console.log(`  Delay between batches: ${CONFIG.delayBetweenBatchesMs}ms`);
  console.log();

  // ==========================================================================
  // INITIALIZE LOGGER
  // ==========================================================================

  const logger = new PinoLogger({
    level: 'info',
    service: 'extract-citations',
    environment: 'script',
    pretty: true,
  });

  // ==========================================================================
  // CONNECT TO DATABASES
  // ==========================================================================

  console.log('Connecting to databases...');

  const pgPool = new Pool({
    connectionString:
      process.env.DATABASE_URL || 'postgresql://chive:chive_test_password@127.0.0.1:5432/chive',
  });

  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

  const neo4jConnection = new Neo4jConnection();
  await neo4jConnection.initialize({
    uri: process.env.NEO4J_URI || 'bolt://127.0.0.1:7687',
    username: process.env.NEO4J_USER || 'neo4j',
    password: process.env.NEO4J_PASSWORD || 'chive_test_password',
  });

  // ==========================================================================
  // HEALTH CHECKS
  // ==========================================================================

  console.log('Running health checks...');

  const [pgHealthy, redisHealthy, neo4jHealthy] = await Promise.all([
    checkPostgresHealth(pgPool),
    checkRedisHealth(redis),
    checkNeo4jHealth(neo4jConnection),
  ]);

  if (!pgHealthy) {
    throw new Error('PostgreSQL is not healthy - aborting extraction');
  }
  console.log('  ✓ PostgreSQL is healthy');

  if (!redisHealthy) {
    throw new Error('Redis is not healthy - aborting extraction');
  }
  console.log('  ✓ Redis is healthy');

  if (!neo4jHealthy) {
    throw new Error('Neo4j is not healthy - aborting extraction');
  }
  console.log('  ✓ Neo4j is healthy');

  console.log();

  // ==========================================================================
  // INITIALIZE CITATION EXTRACTION PIPELINE
  // ==========================================================================

  console.log('Initializing citation extraction pipeline...');

  const identity = new DIDResolver({
    redis,
    logger,
    config: {
      plcDirectoryUrl: process.env.PLC_DIRECTORY_URL || 'https://plc.directory',
      cacheTtlSeconds: 300,
      timeoutMs: 10000,
    },
  });

  const resiliencePolicy = createResiliencePolicy({
    circuitBreaker: {
      name: 'pds',
      failureThreshold: 5,
      timeout: 60000,
      logger,
    },
    retry: {
      name: 'pds',
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      logger,
    },
  });

  const repository = new ATRepository({
    identity,
    resiliencePolicy,
    logger,
    config: { timeoutMs: 30000 },
  });

  const grobidConfig = getGrobidConfig();
  const grobidClient = new GrobidClient({ config: grobidConfig, logger });
  const documentTextExtractor = new DocumentTextExtractor({ logger });
  const citationGraph = new CitationGraph(neo4jConnection);

  const citationExtractionService = new CitationExtractionService({
    grobidClient,
    repository,
    db: pgPool,
    citationGraph,
    logger,
    documentTextExtractor,
  });

  const citationExtractionJob = new CitationExtractionJob({
    citationExtractionService,
    db: pgPool,
    logger,
  });

  console.log('  ✓ Pipeline initialized');
  console.log();

  // ==========================================================================
  // BUILD URI LIST
  // ==========================================================================

  let targetUris: string[];

  if (extractAll) {
    console.log('Fetching eprints from PostgreSQL...');

    const result = await pgPool.query(
      `SELECT uri FROM eprints_index WHERE deleted_at IS NULL ORDER BY created_at DESC`
    );

    targetUris = result.rows.map((row: { uri: string }) => row.uri);
    console.log(`Found ${targetUris.length} eprints to process`);
  } else {
    targetUris = uris;
  }

  if (targetUris.length === 0) {
    console.log('No eprints to process. Exiting.');
    await cleanup(pgPool, redis, neo4jConnection);
    return;
  }

  console.log();

  // ==========================================================================
  // PROCESS EPRINTS
  // ==========================================================================

  const stats: ExtractionStats = {
    total: targetUris.length,
    success: 0,
    failed: 0,
    totalCitationsExtracted: 0,
    startTime: Date.now(),
    failedRecords: [],
  };

  if (extractAll) {
    // Process in batches
    const totalBatches = Math.ceil(targetUris.length / CONFIG.batchSize);
    console.log(`Processing ${targetUris.length} eprints in ${totalBatches} batches...`);
    console.log();

    for (let i = 0; i < totalBatches; i++) {
      const start = i * CONFIG.batchSize;
      const end = Math.min(start + CONFIG.batchSize, targetUris.length);
      const batch = targetUris.slice(start, end);
      const batchStartTime = Date.now();

      for (const uri of batch) {
        await processUri(uri, citationExtractionJob, stats);
      }

      // Calculate progress and ETA
      const elapsed = Date.now() - stats.startTime;
      const processed = stats.success + stats.failed;
      const rate = processed / (elapsed / 1000);
      const remaining = stats.total - processed;
      const etaMs = rate > 0 ? (remaining / rate) * 1000 : 0;

      const batchDuration = Date.now() - batchStartTime;
      console.log(
        `  Batch ${i + 1}/${totalBatches} complete in ${formatDuration(batchDuration)} ` +
          `(${stats.success} ok, ${stats.failed} fail) - ` +
          `ETA: ${formatDuration(etaMs)}`
      );

      // Delay between batches to avoid overwhelming services
      if (i < totalBatches - 1) {
        await sleep(CONFIG.delayBetweenBatchesMs);
      }
    }
  } else {
    // Process each URI sequentially
    console.log('Processing eprints...');
    console.log();

    for (const uri of targetUris) {
      await processUri(uri, citationExtractionJob, stats);
    }
  }

  // ==========================================================================
  // PRINT SUMMARY
  // ==========================================================================

  stats.endTime = Date.now();
  const duration = stats.endTime - stats.startTime;

  console.log();
  console.log('='.repeat(60));
  console.log('CITATION EXTRACTION COMPLETE');
  console.log('='.repeat(60));
  console.log();
  console.log(`Duration: ${formatDuration(duration)}`);
  console.log(`Total records: ${stats.total}`);
  console.log(
    `  Successful: ${stats.success} (${((stats.success / stats.total) * 100).toFixed(1)}%)`
  );
  console.log(`  Failed: ${stats.failed} (${((stats.failed / stats.total) * 100).toFixed(1)}%)`);
  console.log(`Total citations extracted: ${stats.totalCitationsExtracted}`);

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

  await cleanup(pgPool, redis, neo4jConnection);

  // Exit with error code if there were failures
  if (stats.failed > 0) {
    console.log();
    console.log('WARNING: Some records failed citation extraction. Check logs above.');
    process.exit(1);
  }
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Process a single URI through the citation extraction job.
 */
async function processUri(
  uri: string,
  citationExtractionJob: CitationExtractionJob,
  stats: ExtractionStats
): Promise<void> {
  try {
    const result: CitationExtractionJobResult = await citationExtractionJob.run(uri as AtUri);

    if (result.success && result.extraction) {
      stats.success++;
      stats.totalCitationsExtracted += result.extraction.totalExtracted;
      console.log(
        `  OK: ${uri} - ${result.extraction.totalExtracted} citations ` +
          `(${result.extraction.matchedToChive} matched to Chive)`
      );
    } else {
      stats.failed++;
      const errorMsg = result.error || 'Unknown error';
      stats.failedRecords.push({ uri, error: errorMsg });
      console.log(`  FAIL: ${uri} - ${errorMsg}`);
    }
  } catch (error) {
    stats.failed++;
    const errorMsg = error instanceof Error ? error.message : String(error);
    stats.failedRecords.push({ uri, error: errorMsg });
    console.log(`  FAIL: ${uri} - ${errorMsg}`);
  }
}

/**
 * Close all database connections.
 */
async function cleanup(pool: Pool, redis: Redis, neo4jConnection: Neo4jConnection): Promise<void> {
  await pool.end();
  await redis.quit();
  await neo4jConnection.close();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
