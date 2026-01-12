/**
 * Chive AppView Server Entry Point
 *
 * Bootstraps all services, adapters, and database connections, then starts
 * the HTTP server.
 *
 * @packageDocumentation
 */

// Must be imported first for tsyringe dependency injection
import 'reflect-metadata';

import { serve } from '@hono/node-server';
import { Redis } from 'ioredis';
import { container } from 'tsyringe';

import { createServer, type ServerConfig } from './api/server.js';
import { ATRepository } from './atproto/repository/at-repository.js';
import { AuthorizationService } from './auth/authorization/authorization-service.js';
import { DIDResolver } from './auth/did/did-resolver.js';
import { PinoLogger } from './observability/logger.js';
import {
  registerPluginSystem,
  getPluginManager,
  ArxivPlugin,
  LingBuzzPlugin,
  OpenReviewPlugin,
  PsyArxivPlugin,
  SemanticsArchivePlugin,
  ImportScheduler,
} from './plugins/index.js';
import { ActivityService } from './services/activity/activity-service.js';
import { AlphaApplicationService } from './services/alpha/alpha-application-service.js';
import { BacklinkService } from './services/backlink/backlink-service.js';
import { CDNAdapter } from './services/blob-proxy/cdn-adapter.js';
import { CIDVerifier } from './services/blob-proxy/cid-verifier.js';
import { BlobProxyService, type BlobFetchResult } from './services/blob-proxy/proxy-service.js';
import { RedisCache } from './services/blob-proxy/redis-cache.js';
import { RequestCoalescer } from './services/blob-proxy/request-coalescer.js';
import { ClaimingService } from './services/claiming/claiming-service.js';
import { createResiliencePolicy } from './services/common/resilience.js';
import { DiscoveryService } from './services/discovery/discovery-service.js';
import { ImportService } from './services/import/import-service.js';
import { KnowledgeGraphService } from './services/knowledge-graph/graph-service.js';
import { MetricsService } from './services/metrics/metrics-service.js';
import { PDSSyncService } from './services/pds-sync/sync-service.js';
import { EprintService } from './services/eprint/eprint-service.js';
import { ReviewService } from './services/review/review-service.js';
import { TaxonomyCategoryMatcher } from './services/search/category-matcher.js';
import { RankingService } from './services/search/ranking-service.js';
import { NoOpRelevanceLogger, RelevanceLogger } from './services/search/relevance-logger.js';
import { SearchService } from './services/search/search-service.js';
import { AcademicTextScorer } from './services/search/text-scorer.js';
import { ElasticsearchAdapter } from './storage/elasticsearch/adapter.js';
import { ElasticsearchConnectionPool } from './storage/elasticsearch/connection.js';
import { Neo4jAdapter } from './storage/neo4j/adapter.js';
import { CitationGraph } from './storage/neo4j/citation-graph.js';
import { Neo4jConnection } from './storage/neo4j/connection.js';
import { ContributionTypeManager } from './storage/neo4j/contribution-type-manager.js';
import { TagManager } from './storage/neo4j/tag-manager.js';
import { PostgreSQLAdapter } from './storage/postgresql/adapter.js';
import { getDatabaseConfig } from './storage/postgresql/config.js';
import { closePool, createPool } from './storage/postgresql/connection.js';
import { FacetUsageHistoryRepository } from './storage/postgresql/facet-usage-history-repository.js';
import type { ICacheProvider } from './types/interfaces/cache.interface.js';
import type { IMetrics } from './types/interfaces/metrics.interface.js';

/**
 * Environment configuration.
 */
interface EnvConfig {
  readonly port: number;
  readonly nodeEnv: string;

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

  // Security
  readonly jwtSecret: string;
  readonly sessionSecret: string;

  // Cloudflare R2 / CDN (optional; blob proxy will skip CDN if not configured)
  readonly r2Endpoint?: string;
  readonly r2Bucket?: string;
  readonly r2AccessKeyId?: string;
  readonly r2SecretAccessKey?: string;
  readonly cdnBaseUrl?: string;

  // PLC Directory
  readonly plcDirectoryUrl: string;

  // ATProto OAuth
  readonly oauthClientId: string;
  readonly oauthRedirectUri: string;
  readonly sessionEncryptionKey?: string;

  // ATProto Service Auth
  readonly serviceDid: string;

  // Relevance logging (for LTR training)
  readonly relevanceLoggingEnabled?: boolean;
}

/**
 * Loads configuration from environment variables.
 */
function loadConfig(): EnvConfig {
  return {
    port: parseInt(process.env.PORT ?? '3000', 10),
    nodeEnv: process.env.NODE_ENV ?? 'development',

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

    // Security
    jwtSecret: process.env.JWT_SECRET ?? 'dev-jwt-secret-not-for-production',
    sessionSecret: process.env.SESSION_SECRET ?? 'dev-session-secret-not-for-production',

    // Cloudflare R2 / CDN (optional)
    r2Endpoint: process.env.R2_ENDPOINT,
    r2Bucket: process.env.R2_BUCKET,
    r2AccessKeyId: process.env.R2_ACCESS_KEY_ID,
    r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    cdnBaseUrl: process.env.CDN_BASE_URL,

    // PLC Directory
    plcDirectoryUrl: process.env.PLC_DIRECTORY_URL ?? 'https://plc.directory',

    // ATProto OAuth
    oauthClientId: process.env.OAUTH_CLIENT_ID ?? 'https://chive.pub/oauth/client-metadata.json',
    oauthRedirectUri: process.env.OAUTH_REDIRECT_URI ?? 'https://chive.pub/oauth/callback',
    sessionEncryptionKey: process.env.SESSION_ENCRYPTION_KEY,

    // ATProto Service Auth
    serviceDid: process.env.SERVICE_DID ?? 'did:web:chive.pub',

    // Relevance logging
    relevanceLoggingEnabled: process.env.RELEVANCE_LOGGING_ENABLED !== 'false',
  };
}

/**
 * Application state for cleanup.
 */
interface AppState {
  readonly config: EnvConfig;
  readonly logger: PinoLogger;
  readonly pgPool: ReturnType<typeof createPool>;
  readonly redis: Redis;
  readonly esPool: ElasticsearchConnectionPool;
  readonly neo4jConnection: Neo4jConnection;
  server?: ReturnType<typeof serve>;
  importScheduler?: ImportScheduler;
}

/**
 * Initializes all database connections.
 */
async function initializeDatabases(
  config: EnvConfig,
  logger: PinoLogger
): Promise<Pick<AppState, 'pgPool' | 'redis' | 'esPool' | 'neo4jConnection'>> {
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
  });
  logger.info('Neo4j connected');

  return { pgPool, redis, esPool, neo4jConnection };
}

/**
 * Creates all services with their dependencies.
 */
function createServices(
  config: EnvConfig,
  pgPool: ReturnType<typeof createPool>,
  redis: Redis,
  esPool: ElasticsearchConnectionPool,
  neo4jConnection: Neo4jConnection,
  logger: PinoLogger
): ServerConfig {
  // Create adapters
  const storageAdapter = new PostgreSQLAdapter(pgPool);
  const searchAdapter = new ElasticsearchAdapter(esPool);
  const graphAdapter = new Neo4jAdapter(neo4jConnection);

  // Create DID resolver (implements IIdentityResolver)
  const identityResolver = new DIDResolver({
    redis,
    logger,
    config: {
      plcDirectoryUrl: config.plcDirectoryUrl,
      cacheTtlSeconds: 300, // 5 minutes
      timeoutMs: 10000, // 10 seconds
    },
  });

  // Create resilience policy for PDS requests
  const pdsResiliencePolicy = createResiliencePolicy({
    circuitBreaker: {
      name: 'pds',
      failureThreshold: 5,
      timeout: 30000, // 30 seconds half-open timeout
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

  // Create ATRepository (implements IRepository)
  const repository = new ATRepository({
    identity: identityResolver,
    resiliencePolicy: pdsResiliencePolicy,
    logger,
    config: {
      timeoutMs: 30000,
      maxBlobSize: 50 * 1024 * 1024, // 50MB
      defaultPageSize: 50,
      userAgent: 'Chive-AppView/1.0',
    },
  });

  // Create blob proxy dependencies
  const redisCache = new RedisCache({
    redis,
    defaultTTL: 3600, // 1 hour
    beta: 1.0,
    maxBlobSize: 10 * 1024 * 1024, // 10MB
    keyPrefix: 'chive:blob:',
    logger,
  });

  const cidVerifier = new CIDVerifier({ logger });

  const coalescer = new RequestCoalescer<BlobFetchResult>({
    maxWaitTime: 30000, // 30 seconds
    logger,
  });

  // Create CDN adapter (optional; only if R2 is configured)
  const cdnAdapter = createCDNAdapter(config, logger);

  // Create services
  const eprintService = new EprintService({
    storage: storageAdapter,
    search: searchAdapter,
    repository,
    identity: identityResolver,
    logger,
  });

  const searchService = new SearchService({
    search: searchAdapter,
    logger,
  });

  const metricsService = new MetricsService({
    pool: pgPool,
    storage: storageAdapter,
    redis,
    logger,
  });

  const graphService = new KnowledgeGraphService({
    graph: graphAdapter,
    storage: storageAdapter,
    logger,
  });

  const blobProxyService = new BlobProxyService({
    repository,
    identity: identityResolver,
    redisCache,
    cdnAdapter,
    cidVerifier,
    coalescer,
    resiliencePolicy: pdsResiliencePolicy,
    logger,
  });

  // Create review service
  const reviewService = new ReviewService({
    pool: pgPool,
    storage: storageAdapter,
    logger,
  });

  // Create tag manager
  const tagManager = new TagManager({
    connection: neo4jConnection,
    logger,
  });

  // Create facet usage history repository and wire it to TagManager
  const facetUsageHistoryRepository = new FacetUsageHistoryRepository(pgPool, logger);
  tagManager.setFacetHistoryRepository(facetUsageHistoryRepository);

  // Create contribution type manager
  const contributionTypeManager = new ContributionTypeManager(neo4jConnection);

  // Create backlink service
  const backlinkService = new BacklinkService(logger, pgPool);

  // Create import service
  const importService = new ImportService(logger, pgPool);

  // Create claiming service
  const claimingService = new ClaimingService(logger, pgPool, importService, identityResolver);

  // Create PDS sync service
  const pdsSyncService = new PDSSyncService({
    pool: pgPool,
    storage: storageAdapter,
    repository,
    resiliencePolicy: pdsResiliencePolicy,
    logger,
  });

  // Create relevance logger for LTR training data
  // Can be disabled via environment variable for development
  const relevanceLoggingEnabled = config.relevanceLoggingEnabled ?? true;
  const relevanceLogger = relevanceLoggingEnabled
    ? new RelevanceLogger({
        pool: pgPool,
        redis,
        logger,
        enabled: true,
      })
    : new NoOpRelevanceLogger();

  // Create activity service for tracking user actions with firehose correlation
  const activityService = new ActivityService({
    pool: pgPool,
    logger,
    timeoutInterval: '1 hour',
  });

  // Create discovery service dependencies
  const textScorer = new AcademicTextScorer();
  const categoryMatcher = new TaxonomyCategoryMatcher();
  const rankingService = new RankingService(pgPool, logger, textScorer, categoryMatcher);
  const citationGraph = new CitationGraph(neo4jConnection);

  // Create discovery service
  const discoveryService = new DiscoveryService(
    logger,
    pgPool,
    searchAdapter,
    rankingService,
    citationGraph
  );

  // Create authorization service for role-based access control
  const authzService = new AuthorizationService({
    redis,
    logger,
  });

  // Create alpha application service
  const alphaService = new AlphaApplicationService({
    pool: pgPool,
    logger,
  });

  return {
    eprintService,
    searchService,
    metricsService,
    graphService,
    blobProxyService,
    reviewService,
    tagManager,
    contributionTypeManager,
    backlinkService,
    claimingService,
    importService,
    pdsSyncService,
    relevanceLogger,
    activityService,
    discoveryService,
    rankingService,
    authzService,
    alphaService,
    redis,
    logger,
    serviceDid: config.serviceDid,
    plcDirectoryUrl: config.plcDirectoryUrl,
  };
}

/**
 * Creates CDN adapter if R2 is configured.
 *
 * @remarks
 * Returns a minimal no-op adapter if R2 is not configured. This allows the
 * blob proxy service to function without CDN caching in development.
 */
function createCDNAdapter(config: EnvConfig, logger: PinoLogger): CDNAdapter {
  if (
    config.r2Endpoint &&
    config.r2Bucket &&
    config.r2AccessKeyId &&
    config.r2SecretAccessKey &&
    config.cdnBaseUrl
  ) {
    logger.info('Initializing CDN adapter with Cloudflare R2');
    return new CDNAdapter({
      endpoint: config.r2Endpoint,
      bucket: config.r2Bucket,
      accessKeyId: config.r2AccessKeyId,
      secretAccessKey: config.r2SecretAccessKey,
      cdnBaseURL: config.cdnBaseUrl,
      defaultTTL: 86400, // 24 hours
      maxBlobSize: 100 * 1024 * 1024, // 100MB
      logger,
    });
  }

  // Return no-op CDN adapter for development
  logger.warn('CDN not configured - blob proxy will skip L2 caching');
  return createNoOpCDNAdapter();
}

/**
 * Creates a no-op CDN adapter for development without R2.
 *
 * @remarks
 * Uses BLOB_BASE_URL environment variable if set, otherwise falls back to
 * a development-mode URL pattern that indicates blobs should be fetched
 * directly from the user's PDS.
 */
function createNoOpCDNAdapter(): CDNAdapter {
  const blobBaseUrl = process.env.BLOB_BASE_URL ?? process.env.CDN_BASE_URL;

  // Create a minimal adapter that always misses
  return {
    get: () => Promise.resolve(null),
    set: () => Promise.resolve({ ok: true, value: undefined }),
    has: () => Promise.resolve(false),
    delete: () => Promise.resolve({ ok: true, value: undefined }),
    getPublicURL: (cid: string) => {
      if (blobBaseUrl) {
        return `${blobBaseUrl}/blobs/${cid}`;
      }
      // Development fallback: indicate blob should be fetched from PDS
      // This URL signals to clients that they should use the blob proxy endpoint
      return `/api/v1/blobs/${cid}`;
    },
  } as unknown as CDNAdapter;
}

/**
 * Gracefully shuts down all connections.
 */
async function shutdown(state: AppState, signal: string): Promise<void> {
  state.logger.info(`Received ${signal}, starting graceful shutdown...`);

  // Stop accepting new connections
  if (state.server) {
    state.logger.info('Closing HTTP server...');
    state.server.close();
  }

  // Stop import scheduler
  if (state.importScheduler) {
    state.logger.info('Stopping import scheduler...');
    await state.importScheduler.stopAll();
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
 * Creates a Redis-backed cache provider for the plugin system.
 */
function createPluginCacheProvider(redis: Redis): ICacheProvider {
  const PREFIX = 'chive:plugin:';
  return {
    async get<T>(key: string): Promise<T | null> {
      const value = await redis.get(`${PREFIX}${key}`);
      if (value === null) return null;
      try {
        return JSON.parse(value) as T;
      } catch {
        return null;
      }
    },
    async set<T>(key: string, value: T, ttl?: number): Promise<void> {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await redis.setex(`${PREFIX}${key}`, ttl, serialized);
      } else {
        await redis.set(`${PREFIX}${key}`, serialized);
      }
    },
    async delete(key: string): Promise<void> {
      await redis.del(`${PREFIX}${key}`);
    },
    async exists(key: string): Promise<boolean> {
      const result = await redis.exists(`${PREFIX}${key}`);
      return result === 1;
    },
    async expire(key: string, ttl: number): Promise<void> {
      await redis.expire(`${PREFIX}${key}`, ttl);
    },
  };
}

/**
 * Creates a no-op metrics provider for the plugin system.
 * In production, this would be replaced with Prometheus metrics.
 */
function createNoopMetrics(): IMetrics {
  return {
    incrementCounter: (_name, _labels, _value) => {
      // No-op for development
    },
    setGauge: (_name, _value, _labels) => {
      // No-op for development
    },
    observeHistogram: (_name, _value, _labels) => {
      // No-op for development
    },
    startTimer: (_name, _labels) => () => {
      // No-op for development
    },
  };
}

/**
 * Initializes the plugin system with hybrid search/import architecture.
 *
 * @remarks
 * Plugins are categorized as:
 * - SearchablePlugins (arXiv, OpenReview, PsyArXiv): On-demand search via external APIs
 * - ImportingPlugins (LingBuzz, Semantics Archive): Periodic bulk import via scraping
 *
 * This hybrid approach minimizes storage and API load while ensuring full coverage.
 *
 * @param redis - Redis client for caching
 * @param importService - Import service for storing imported eprints
 * @param claimingService - Claiming service to wire with plugin manager
 * @param logger - Logger instance
 * @returns Import scheduler for shutdown cleanup
 */
async function initializePluginSystem(
  redis: Redis,
  importService: ImportService,
  claimingService: ClaimingService,
  logger: PinoLogger
): Promise<ImportScheduler> {
  logger.info('Initializing plugin system (hybrid architecture)...');

  // Register dependencies with tsyringe container
  container.register('ILogger', { useValue: logger });
  container.register('ICacheProvider', { useValue: createPluginCacheProvider(redis) });
  container.register('IMetrics', { useValue: createNoopMetrics() });

  // Register plugin system components
  registerPluginSystem();

  // Get plugin manager
  const pluginManager = getPluginManager();

  // Create import scheduler for scraping-based plugins
  const scheduler = new ImportScheduler({ logger });

  // Plugin context with import service
  const pluginContext = { importService };

  // =========================================================================
  // Search-based plugins (on-demand)
  // =========================================================================

  // Load ArxivPlugin (searchable)
  try {
    const arxivPlugin = new ArxivPlugin();
    await pluginManager.loadBuiltinPlugin(arxivPlugin, pluginContext);
    logger.info('ArxivPlugin loaded (searchable)', { pluginId: arxivPlugin.id });
  } catch (err) {
    logger.error('Failed to load ArxivPlugin', err instanceof Error ? err : undefined);
  }

  // Load OpenReviewPlugin (searchable)
  try {
    const openReviewPlugin = new OpenReviewPlugin();
    await pluginManager.loadBuiltinPlugin(openReviewPlugin, pluginContext);
    logger.info('OpenReviewPlugin loaded (searchable)', { pluginId: openReviewPlugin.id });
  } catch (err) {
    logger.error('Failed to load OpenReviewPlugin', err instanceof Error ? err : undefined);
  }

  // Load PsyArxivPlugin (searchable)
  try {
    const psyarxivPlugin = new PsyArxivPlugin();
    await pluginManager.loadBuiltinPlugin(psyarxivPlugin, pluginContext);
    logger.info('PsyArXivPlugin loaded (searchable)', { pluginId: psyarxivPlugin.id });
  } catch (err) {
    logger.error('Failed to load PsyArXivPlugin', err instanceof Error ? err : undefined);
  }

  // =========================================================================
  // Scraping-based plugins (periodic import)
  // =========================================================================

  // Load LingBuzzPlugin (requires periodic import)
  try {
    const lingbuzzPlugin = new LingBuzzPlugin();
    await pluginManager.loadBuiltinPlugin(lingbuzzPlugin, pluginContext);
    logger.info('LingBuzzPlugin loaded (scraping)', { pluginId: lingbuzzPlugin.id });

    // Schedule periodic imports (12 hours)
    scheduler.schedulePlugin({
      plugin: lingbuzzPlugin,
      intervalMs: 12 * 60 * 60 * 1000, // 12 hours
      runOnStart: true,
    });
  } catch (err) {
    logger.error('Failed to load LingBuzzPlugin', err instanceof Error ? err : undefined);
  }

  // Load SemanticsArchivePlugin (requires periodic import)
  try {
    const semanticsPlugin = new SemanticsArchivePlugin();
    await pluginManager.loadBuiltinPlugin(semanticsPlugin, pluginContext);
    logger.info('SemanticsArchivePlugin loaded (scraping)', { pluginId: semanticsPlugin.id });

    // Schedule periodic imports (12 hours)
    scheduler.schedulePlugin({
      plugin: semanticsPlugin,
      intervalMs: 12 * 60 * 60 * 1000, // 12 hours
      runOnStart: true,
    });
  } catch (err) {
    logger.error('Failed to load SemanticsArchivePlugin', err instanceof Error ? err : undefined);
  }

  // =========================================================================
  // Wire plugin manager to claiming service for federated search
  // =========================================================================
  claimingService.setPluginManager(pluginManager);

  logger.info('Plugin system initialized (hybrid)', {
    loadedPlugins: pluginManager.getPluginCount(),
    searchPlugins: ['arxiv', 'openreview', 'psyarxiv'],
    scrapingPlugins: ['lingbuzz', 'semantics-archive'],
    scheduledPlugins: scheduler.getScheduledPluginIds(),
  });

  return scheduler;
}

/**
 * Main entry point.
 */
async function main(): Promise<void> {
  const config = loadConfig();
  const logger = new PinoLogger({
    level: config.nodeEnv === 'production' ? 'info' : 'debug',
    service: 'chive-appview',
    environment: config.nodeEnv,
    pretty: config.nodeEnv === 'development',
  });

  logger.info('Starting Chive AppView...', {
    nodeEnv: config.nodeEnv,
    port: config.port,
  });

  try {
    // Initialize databases
    const { pgPool, redis, esPool, neo4jConnection } = await initializeDatabases(config, logger);

    // Create application state
    const state: AppState = {
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

    // Create services
    const serverConfig = createServices(config, pgPool, redis, esPool, neo4jConnection, logger);

    // Create Hono app
    const app = createServer(serverConfig);

    // Start HTTP server
    state.server = serve({
      fetch: app.fetch,
      port: config.port,
    });

    logger.info(`Chive AppView listening on port ${config.port}`);
    logger.info(`Health check: http://localhost:${config.port}/health`);
    logger.info(`API docs: http://localhost:${config.port}/docs`);

    // Initialize plugin system (hybrid search/import architecture)
    state.importScheduler = await initializePluginSystem(
      redis,
      serverConfig.importService,
      serverConfig.claimingService,
      logger
    );
  } catch (error) {
    logger.error('Failed to start server', error instanceof Error ? error : undefined);
    process.exit(1);
  }
}

// Run
main().catch((error) => {
  console.error('Unhandled error during startup:', error);
  process.exit(1);
});
