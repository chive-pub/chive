/**
 * Chive Firehose Indexer Entry Point
 *
 * Bootstraps database connections and starts the IndexingService
 * to consume the AT Protocol firehose and index pub.chive.* records.
 *
 * @remarks
 * This is a separate process from the API server (index.ts).
 * It consumes the global firehose and indexes:
 * - pub.chive.eprint.submission
 * - pub.chive.review.comment
 * - pub.chive.review.endorsement
 * - pub.chive.eprint.userTag
 * - pub.chive.graph.fieldProposal
 * - pub.chive.graph.vote
 * - pub.chive.actor.profile
 *
 * @packageDocumentation
 */

// Must be imported first for tsyringe dependency injection
import 'reflect-metadata';

import { Redis, type RedisOptions } from 'ioredis';

import { ATRepository } from './atproto/repository/at-repository.js';
import { DIDResolver } from './auth/did/did-resolver.js';
import { PinoLogger } from './observability/logger.js';
import { ActivityService } from './services/activity/activity-service.js';
import { createResiliencePolicy } from './services/common/resilience.js';
import { EprintService } from './services/eprint/eprint-service.js';
import { AutomaticProposalService } from './services/governance/automatic-proposal-service.js';
import { GovernancePDSWriter } from './services/governance/governance-pds-writer.js';
import { createEventProcessor } from './services/indexing/event-processor.js';
import { IndexingService } from './services/indexing/indexing-service.js';
import { KnowledgeGraphService } from './services/knowledge-graph/graph-service.js';
import { PDSRegistry } from './services/pds-discovery/pds-registry.js';
import { ReviewService } from './services/review/review-service.js';
import { ElasticsearchAdapter } from './storage/elasticsearch/adapter.js';
import { ElasticsearchConnectionPool } from './storage/elasticsearch/connection.js';
import { Neo4jAdapter } from './storage/neo4j/adapter.js';
import { Neo4jConnection } from './storage/neo4j/connection.js';
import { TagManager } from './storage/neo4j/tag-manager.js';
import { PostgreSQLAdapter } from './storage/postgresql/adapter.js';
import { getDatabaseConfig } from './storage/postgresql/config.js';
import { closePool, createPool } from './storage/postgresql/connection.js';
import type { DID } from './types/atproto.js';

/**
 * Indexer configuration loaded from environment variables.
 */
interface IndexerConfig {
  readonly nodeEnv: string;

  // ATProto relay
  readonly relayUrl: string;

  // PostgreSQL
  readonly postgresHost: string;
  readonly postgresPort: number;
  readonly postgresDb: string;
  readonly postgresUser: string;
  readonly postgresPassword: string;

  // Redis
  readonly redisUrl: string;

  // Elasticsearch
  readonly elasticsearchUrl: string;
  readonly elasticsearchUser?: string;
  readonly elasticsearchPassword?: string;

  // Neo4j
  readonly neo4jUri: string;
  readonly neo4jUser: string;
  readonly neo4jPassword: string;
  readonly neo4jEncrypted?: 'ENCRYPTION_ON' | 'ENCRYPTION_OFF';

  // PLC Directory
  readonly plcDirectoryUrl: string;

  // Graph PDS (optional for automatic proposals)
  readonly graphPdsUrl?: string;
  readonly graphPdsDid?: string;
  readonly graphPdsSigningKey?: string;

  // Indexer settings
  readonly concurrency: number;
  readonly maxQueueDepth: number;
}

/**
 * Loads configuration from environment variables.
 */
function loadConfig(): IndexerConfig {
  return {
    nodeEnv: process.env.NODE_ENV ?? 'development',

    // ATProto relay - default to Bluesky network
    relayUrl: process.env.ATPROTO_RELAY_URL ?? 'wss://bsky.network',

    // PostgreSQL
    postgresHost: process.env.POSTGRES_HOST ?? 'localhost',
    postgresPort: parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
    postgresDb: process.env.POSTGRES_DB ?? 'chive',
    postgresUser: process.env.POSTGRES_USER ?? 'chive',
    postgresPassword: process.env.POSTGRES_PASSWORD ?? 'chive_test_password',

    // Redis
    redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',

    // Elasticsearch
    elasticsearchUrl: process.env.ELASTICSEARCH_URL ?? 'http://localhost:9200',
    elasticsearchUser: process.env.ELASTICSEARCH_USER,
    elasticsearchPassword: process.env.ELASTICSEARCH_PASSWORD,

    // Neo4j
    neo4jUri: process.env.NEO4J_URI ?? 'bolt://localhost:7687',
    neo4jUser: process.env.NEO4J_USER ?? 'neo4j',
    neo4jPassword: process.env.NEO4J_PASSWORD ?? 'chive_test_password',
    neo4jEncrypted: process.env.NEO4J_ENCRYPTED as 'ENCRYPTION_ON' | 'ENCRYPTION_OFF' | undefined,

    // PLC Directory
    plcDirectoryUrl: process.env.PLC_DIRECTORY_URL ?? 'https://plc.directory',

    // Graph PDS (optional)
    graphPdsUrl: process.env.GRAPH_PDS_URL,
    graphPdsDid: process.env.GRAPH_PDS_DID,
    graphPdsSigningKey: process.env.GRAPH_PDS_SIGNING_KEY,

    // Indexer settings
    concurrency: parseInt(process.env.INDEXER_CONCURRENCY ?? '10', 10),
    maxQueueDepth: parseInt(process.env.INDEXER_MAX_QUEUE_DEPTH ?? '1000', 10),
  };
}

/**
 * Application state for cleanup.
 */
interface IndexerState {
  readonly config: IndexerConfig;
  readonly logger: PinoLogger;
  readonly pgPool: ReturnType<typeof createPool>;
  readonly redis: Redis;
  readonly esPool: ElasticsearchConnectionPool;
  readonly neo4jConnection: Neo4jConnection;
  indexingService?: IndexingService;
}

/**
 * Initializes all database connections.
 */
async function initializeDatabases(
  config: IndexerConfig,
  logger: PinoLogger
): Promise<Pick<IndexerState, 'pgPool' | 'redis' | 'esPool' | 'neo4jConnection'>> {
  logger.info('Initializing database connections...');

  // PostgreSQL
  const pgConfig = getDatabaseConfig();
  const pgPool = createPool(pgConfig);
  logger.info('PostgreSQL pool created');

  // Redis
  const redis = new Redis(config.redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => Math.min(times * 100, 3000),
  });
  await redis.ping();
  logger.info('Redis connected');

  // Elasticsearch
  const esPool = new ElasticsearchConnectionPool({
    node: config.elasticsearchUrl,
    auth:
      config.elasticsearchUser && config.elasticsearchPassword
        ? { username: config.elasticsearchUser, password: config.elasticsearchPassword }
        : undefined,
  });
  const esHealth = await esPool.healthCheck();
  if (!esHealth.healthy) {
    logger.warn('Elasticsearch cluster not fully healthy', { status: esHealth.status });
  } else {
    logger.info('Elasticsearch connected');
  }

  // Neo4j
  const neo4jConnection = new Neo4jConnection();
  await neo4jConnection.initialize({
    uri: config.neo4jUri,
    username: config.neo4jUser,
    password: config.neo4jPassword,
    encrypted: config.neo4jEncrypted,
  });
  logger.info('Neo4j connected');

  return { pgPool, redis, esPool, neo4jConnection };
}

/**
 * Parses Redis URL into connection options for BullMQ.
 */
function parseRedisUrl(url: string): RedisOptions {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379', 10),
    password: parsed.password || undefined,
    db: parsed.pathname ? parseInt(parsed.pathname.slice(1), 10) : 0,
  };
}

/**
 * Gracefully shuts down all connections.
 */
async function shutdown(state: IndexerState, signal: string): Promise<void> {
  state.logger.info(`Received ${signal}, starting graceful shutdown...`);

  // Stop indexing service
  if (state.indexingService) {
    state.logger.info('Stopping indexing service...');
    await state.indexingService.stop();
  }

  // Close database connections
  state.logger.info('Closing database connections...');

  try {
    await Promise.all([
      closePool(state.pgPool),
      state.redis.quit(),
      state.esPool.close(),
      state.neo4jConnection.close(),
    ]);
    state.logger.info('All connections closed successfully');
  } catch (error) {
    state.logger.error('Error during shutdown', error instanceof Error ? error : undefined);
  }

  process.exit(0);
}

/**
 * Main entry point.
 */
async function main(): Promise<void> {
  const config = loadConfig();
  const logger = new PinoLogger({
    level: config.nodeEnv === 'production' ? 'info' : 'debug',
    service: 'chive-indexer',
    environment: config.nodeEnv,
    pretty: config.nodeEnv === 'development',
  });

  logger.info('Starting Chive Firehose Indexer...', {
    nodeEnv: config.nodeEnv,
    relay: config.relayUrl,
  });

  try {
    // Initialize databases
    const { pgPool, redis, esPool, neo4jConnection } = await initializeDatabases(config, logger);

    // Create application state
    const state: IndexerState = {
      config,
      logger,
      pgPool,
      redis,
      esPool,
      neo4jConnection,
    };

    // Register shutdown handlers
    process.on('SIGTERM', () => {
      void shutdown(state, 'SIGTERM');
    });
    process.on('SIGINT', () => {
      void shutdown(state, 'SIGINT');
    });

    // Create adapters
    const storageAdapter = new PostgreSQLAdapter(pgPool);
    const searchAdapter = new ElasticsearchAdapter(esPool);
    const graphAdapter = new Neo4jAdapter(neo4jConnection);

    // Create DID resolver
    const identityResolver = new DIDResolver({
      redis,
      logger,
      config: {
        plcDirectoryUrl: config.plcDirectoryUrl,
        cacheTtlSeconds: 300,
        timeoutMs: 10000,
      },
    });

    // Create resilience policy for PDS requests
    const pdsResiliencePolicy = createResiliencePolicy({
      circuitBreaker: {
        name: 'pds-indexer',
        failureThreshold: 5,
        timeout: 30000,
        logger,
      },
      retry: {
        name: 'pds-indexer',
        maxAttempts: 3,
        baseDelay: 1000,
        maxDelay: 10000,
        logger,
      },
    });

    // Create ATRepository (required by EprintService)
    const repository = new ATRepository({
      identity: identityResolver,
      resiliencePolicy: pdsResiliencePolicy,
      logger,
      config: {
        timeoutMs: 30000,
        maxBlobSize: 50 * 1024 * 1024,
        defaultPageSize: 50,
        userAgent: 'Chive-Indexer/1.0',
      },
    });

    // Create tag manager for keyword-to-tag indexing
    const tagManager = new TagManager({
      connection: neo4jConnection,
      logger,
    });

    // Create services for event processing
    const eprintService = new EprintService({
      storage: storageAdapter,
      search: searchAdapter,
      repository,
      identity: identityResolver,
      logger,
      tagManager, // Auto-generate tags from eprint keywords
      graph: graphAdapter, // Resolve field labels from knowledge graph
    });

    const reviewService = new ReviewService({
      pool: pgPool,
      storage: storageAdapter,
      logger,
    });

    const graphService = new KnowledgeGraphService({
      graph: graphAdapter,
      storage: storageAdapter,
      logger,
    });

    const activityService = new ActivityService({
      pool: pgPool,
      logger,
      timeoutInterval: '1 hour',
    });

    // Create PDS registry for automatic PDS discovery
    const pdsRegistry = new PDSRegistry(pgPool, logger);

    // Create automatic proposal service if graph PDS is configured
    let automaticProposalService: AutomaticProposalService | undefined;
    if (config.graphPdsUrl && config.graphPdsDid && config.graphPdsSigningKey) {
      const graphPdsWriter = new GovernancePDSWriter({
        graphPdsDid: config.graphPdsDid as DID,
        pdsUrl: config.graphPdsUrl,
        signingKey: config.graphPdsSigningKey,
        pool: pgPool,
        cache: redis,
        logger,
      });

      automaticProposalService = new AutomaticProposalService({
        pool: pgPool,
        graph: graphAdapter,
        logger,
        governancePdsWriter: graphPdsWriter,
        graphPdsDid: config.graphPdsDid as DID,
      });

      logger.info('Automatic proposal service initialized', {
        graphPdsDid: config.graphPdsDid,
        graphPdsUrl: config.graphPdsUrl,
      });
    } else {
      logger.info('Automatic proposal service disabled (graph PDS not configured)');
    }

    // Create event processor with PDS auto-discovery
    const processor = createEventProcessor({
      pool: pgPool,
      activity: activityService,
      eprintService,
      reviewService,
      graphService,
      automaticProposalService,
      identity: identityResolver,
      logger,
      pdsRegistry, // Auto-register PDSes discovered during indexing
    });

    // Create indexing service
    const indexingService = new IndexingService({
      relays: [config.relayUrl],
      db: pgPool,
      redis,
      redisConnection: parseRedisUrl(config.redisUrl),
      serviceName: 'chive-indexer',
      processor,
      concurrency: config.concurrency,
      maxQueueDepth: config.maxQueueDepth,
      logger,
    });

    state.indexingService = indexingService;

    // Start indexing
    logger.info('Starting firehose consumption...', {
      relay: config.relayUrl,
      concurrency: config.concurrency,
    });

    await indexingService.start();
  } catch (error) {
    logger.error('Failed to start indexer', error instanceof Error ? error : undefined);
    process.exit(1);
  }
}

// Run
main().catch((error) => {
  console.error('Unhandled error during startup:', error);
  process.exit(1);
});
