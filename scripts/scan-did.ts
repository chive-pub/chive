/**
 * One-off script to scan a specific DID for Chive records.
 * Usage: npx tsx scripts/scan-did.ts <did> <pds_url>
 */

import 'reflect-metadata';

import { Redis } from 'ioredis';

import { ATRepository } from '../src/atproto/repository/at-repository.js';
import { DIDResolver } from '../src/auth/did/did-resolver.js';
import { PinoLogger } from '../src/observability/logger.js';
import { createResiliencePolicy } from '../src/services/common/resilience.js';
import { EprintService } from '../src/services/eprint/eprint-service.js';
import { PDSRegistry } from '../src/services/pds-discovery/pds-registry.js';
import { PDSScanner } from '../src/services/pds-discovery/pds-scanner.js';
import { ReviewService } from '../src/services/review/review-service.js';
import { ElasticsearchAdapter } from '../src/storage/elasticsearch/adapter.js';
import { ElasticsearchConnectionPool } from '../src/storage/elasticsearch/connection.js';
import { Neo4jAdapter } from '../src/storage/neo4j/adapter.js';
import { Neo4jConnection } from '../src/storage/neo4j/connection.js';
import { TagManager } from '../src/storage/neo4j/tag-manager.js';
import { PostgreSQLAdapter } from '../src/storage/postgresql/adapter.js';
import { getDatabaseConfig } from '../src/storage/postgresql/config.js';
import { closePool, createPool } from '../src/storage/postgresql/connection.js';
import type { DID } from '../src/types/atproto.js';

async function main() {
  const did = process.argv[2] as DID;
  const pdsUrl = process.argv[3];

  if (!did || !pdsUrl) {
    console.error('Usage: npx tsx scripts/scan-did.ts <did> <pds_url>');
    process.exit(1);
  }

  const logger = new PinoLogger({
    level: 'info',
    service: 'scan-did',
    environment: 'development',
    pretty: true,
  });

  logger.info('Scanning DID for Chive records', { did, pdsUrl });

  // Initialize databases
  const pgConfig = getDatabaseConfig();
  const pgPool = createPool(pgConfig);

  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: 3,
  });

  const esPool = new ElasticsearchConnectionPool({
    node: process.env.ELASTICSEARCH_URL ?? 'http://localhost:9200',
  });

  const neo4jConnection = new Neo4jConnection();
  await neo4jConnection.initialize({
    uri: process.env.NEO4J_URI ?? 'bolt://localhost:7687',
    username: process.env.NEO4J_USER ?? 'neo4j',
    password: process.env.NEO4J_PASSWORD ?? 'chive_test_password',
  });

  // Create adapters
  const storageAdapter = new PostgreSQLAdapter(pgPool);
  const searchAdapter = new ElasticsearchAdapter(esPool, {
    indexName: 'eprints',
  });

  // Create DID resolver
  const identityResolver = new DIDResolver({
    redis,
    logger,
    config: {
      plcDirectoryUrl: 'https://plc.directory',
      cacheTtlSeconds: 300,
      timeoutMs: 10000,
    },
  });

  const pdsResiliencePolicy = createResiliencePolicy({
    circuitBreaker: {
      name: 'pds-scan',
      failureThreshold: 5,
      timeout: 30000,
      logger,
    },
    retry: {
      name: 'pds-scan',
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      logger,
    },
  });

  const repository = new ATRepository({
    identity: identityResolver,
    resiliencePolicy: pdsResiliencePolicy,
    logger,
    config: {
      timeoutMs: 30000,
      maxBlobSize: 50 * 1024 * 1024,
      defaultPageSize: 50,
      userAgent: 'Chive-Scanner/1.0',
    },
  });

  const graphAdapter = new Neo4jAdapter(neo4jConnection);

  const tagManager = new TagManager({
    connection: neo4jConnection,
    logger,
  });

  const eprintService = new EprintService({
    storage: storageAdapter,
    search: searchAdapter,
    repository,
    identity: identityResolver,
    logger,
    tagManager,
    graph: graphAdapter,
  });

  const reviewService = new ReviewService({
    pool: pgPool,
    storage: storageAdapter,
    logger,
  });

  const pdsRegistry = new PDSRegistry(pgPool, logger);
  const scanner = new PDSScanner(pdsRegistry, eprintService, reviewService, logger);

  try {
    const recordsIndexed = await scanner.scanDID(pdsUrl, did);
    logger.info('Scan complete', { did, pdsUrl, recordsIndexed });
  } catch (error) {
    logger.error('Scan failed', error instanceof Error ? error : undefined);
  } finally {
    await closePool(pgPool);
    await redis.quit();
    await esPool.close();
    await neo4jConnection.close();
  }
}

main().catch(console.error);
