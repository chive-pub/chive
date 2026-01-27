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
import EventEmitter2Module from 'eventemitter2';
import { Redis } from 'ioredis';
import { container } from 'tsyringe';

const { EventEmitter2 } = EventEmitter2Module;
type EventEmitter2Type = InstanceType<typeof EventEmitter2>;

import { createServer, type ServerConfig } from './api/server.js';
import { ATRepository } from './atproto/repository/at-repository.js';
import { AuthorizationService } from './auth/authorization/authorization-service.js';
import { DIDResolver } from './auth/did/did-resolver.js';
import { FreshnessScanJob } from './jobs/freshness-scan-job.js';
import { GovernanceSyncJob } from './jobs/governance-sync-job.js';
import { PDSScanSchedulerJob } from './jobs/pds-scan-scheduler-job.js';
import { TagSyncJob } from './jobs/tag-sync-job.js';
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
import { EprintService } from './services/eprint/eprint-service.js';
import { EdgeService } from './services/governance/edge-service.js';
import { NodeService } from './services/governance/node-service.js';
import { TrustedEditorService } from './services/governance/trusted-editor-service.js';
import { ImportService } from './services/import/import-service.js';
import { KnowledgeGraphService } from './services/knowledge-graph/graph-service.js';
import { MetricsService } from './services/metrics/metrics-service.js';
import { PDSRegistry } from './services/pds-discovery/pds-registry.js';
import { PDSScanner } from './services/pds-discovery/pds-scanner.js';
import { PDSRateLimiter } from './services/pds-sync/pds-rate-limiter.js';
import { PDSSyncService } from './services/pds-sync/sync-service.js';
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
import { EdgeRepository } from './storage/neo4j/edge-repository.js';
import { FacetManager } from './storage/neo4j/facet-manager.js';
import { NodeRepository } from './storage/neo4j/node-repository.js';
import { TagManager } from './storage/neo4j/tag-manager.js';
import { PostgreSQLAdapter } from './storage/postgresql/adapter.js';
import { getDatabaseConfig } from './storage/postgresql/config.js';
import { closePool, createPool } from './storage/postgresql/connection.js';
import { FacetUsageHistoryRepository } from './storage/postgresql/facet-usage-history-repository.js';
import type { DID } from './types/atproto.js';
import type { ICacheProvider } from './types/interfaces/cache.interface.js';
import type { IMetrics } from './types/interfaces/metrics.interface.js';
import { FreshnessWorker } from './workers/freshness-worker.js';
import { IndexRetryWorker } from './workers/index-retry-worker.js';

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
  readonly neo4jEncrypted?: 'ENCRYPTION_ON' | 'ENCRYPTION_OFF';

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

  // Governance PDS
  readonly governancePdsUrl: string;
  readonly governanceDid: string;

  // Freshness system
  readonly freshnessEnabled: boolean;
  readonly freshnessScanIntervalMs: number;
  readonly freshnessPdsRateLimit: number;
  readonly freshnessPdsRateWindowMs: number;
  readonly freshnessWorkerConcurrency: number;
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
    neo4jEncrypted: process.env.NEO4J_ENCRYPTED as 'ENCRYPTION_ON' | 'ENCRYPTION_OFF' | undefined,

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

    // Governance PDS (uses remote governance.chive.pub for local development)
    governancePdsUrl: process.env.GOVERNANCE_PDS_URL ?? 'https://governance.chive.pub',
    governanceDid: process.env.GOVERNANCE_DID ?? 'did:plc:5wzpn4a4nbqtz3q45hyud6hd',

    // Freshness system
    freshnessEnabled: process.env.FRESHNESS_ENABLED !== 'false',
    freshnessScanIntervalMs: parseInt(process.env.FRESHNESS_SCAN_INTERVAL_MS ?? '60000', 10), // 1 minute
    freshnessPdsRateLimit: parseInt(process.env.FRESHNESS_PDS_RATE_LIMIT ?? '10', 10),
    freshnessPdsRateWindowMs: parseInt(process.env.FRESHNESS_PDS_RATE_WINDOW_MS ?? '60000', 10),
    freshnessWorkerConcurrency: parseInt(process.env.FRESHNESS_WORKER_CONCURRENCY ?? '5', 10),
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
  governanceSyncJob?: GovernanceSyncJob;
  freshnessWorker?: FreshnessWorker;
  freshnessScanJob?: FreshnessScanJob;
  pdsScanSchedulerJob?: PDSScanSchedulerJob;
  tagSyncJob?: TagSyncJob;
  eventBus?: EventEmitter2Type;
  indexRetryWorker?: IndexRetryWorker;
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
    encrypted: config.neo4jEncrypted,
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

  // Create tag manager early so it can be used by EprintService for keyword-to-tag indexing
  const tagManager = new TagManager({
    connection: neo4jConnection,
    logger,
  });

  // Create services
  const eprintService = new EprintService({
    storage: storageAdapter,
    search: searchAdapter,
    repository,
    identity: identityResolver,
    logger,
    tagManager, // Auto-generate tags from eprint keywords
    graph: graphAdapter, // Resolve field labels from knowledge graph
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

  // Wire facet usage history repository to TagManager (TagManager created earlier for EprintService)
  const facetUsageHistoryRepository = new FacetUsageHistoryRepository(pgPool, logger);
  tagManager.setFacetHistoryRepository(facetUsageHistoryRepository);

  // Create facet manager
  const facetManager = new FacetManager(neo4jConnection);

  // Create node and edge repositories
  const nodeRepository = new NodeRepository(neo4jConnection);
  const edgeRepository = new EdgeRepository(neo4jConnection);

  // Create node and edge services
  const nodeService = new NodeService({
    nodeRepository,
    logger,
  });
  const edgeService = new EdgeService({
    edgeRepository,
    logger,
  });

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

  // Create trusted editor service for governance role management
  const trustedEditorService = new TrustedEditorService({
    pool: pgPool,
    logger,
  });

  // Create PDS Discovery services
  const pdsRegistry = new PDSRegistry(pgPool, logger);

  const pdsScanner = new PDSScanner(pdsRegistry, eprintService, reviewService, logger);

  // Create index retry worker for failed indexRecord calls
  const redisUrl = new URL(config.redisUrl);
  const indexRetryWorker = new IndexRetryWorker({
    connection: {
      host: redisUrl.hostname,
      port: parseInt(redisUrl.port || '6379', 10),
    },
    eprintService,
    logger,
    concurrency: 3,
    maxAttempts: 10,
    baseDelayMs: 60_000, // 1 minute base delay
  });

  return {
    eprintService,
    searchService,
    metricsService,
    graphService,
    blobProxyService,
    reviewService,
    tagManager,
    facetManager,
    nodeRepository,
    edgeRepository,
    nodeService,
    edgeService,
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
    trustedEditorService,
    pdsRegistry,
    pdsScanner,
    indexRetryWorker,
    identityResolver,
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

  // Stop governance sync job
  if (state.governanceSyncJob) {
    state.logger.info('Stopping governance sync job...');
    state.governanceSyncJob.stop();
  }

  // Stop freshness scan job
  if (state.freshnessScanJob) {
    state.logger.info('Stopping freshness scan job...');
    state.freshnessScanJob.stop();
  }

  // Stop PDS scan scheduler job
  if (state.pdsScanSchedulerJob) {
    state.logger.info('Stopping PDS scan scheduler job...');
    state.pdsScanSchedulerJob.stop();
  }

  // Stop tag sync job
  if (state.tagSyncJob) {
    state.logger.info('Stopping tag sync job...');
    state.tagSyncJob.stop();
  }

  // Close freshness worker
  if (state.freshnessWorker) {
    state.logger.info('Closing freshness worker...');
    await state.freshnessWorker.close();
  }

  // Close index retry worker
  if (state.indexRetryWorker) {
    state.logger.info('Closing index retry worker...');
    await state.indexRetryWorker.close();
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
 * Seeds the PDS registry with PDSes from known DIDs.
 *
 * @remarks
 * On startup, queries all unique DIDs from eprints_index (submitted_by and
 * authors), resolves each to its PDS, and registers in the PDS registry.
 * This ensures we scan PDSes for all users who already have records indexed.
 *
 * This is critical for ATProto compliance: we NEVER rely solely on the
 * firehose. We proactively discover and scan PDSes to catch records that
 * may have been missed.
 */
async function seedPDSRegistryFromKnownDIDs(
  pgPool: ReturnType<typeof createPool>,
  identityResolver: InstanceType<typeof DIDResolver>,
  pdsRegistry: PDSRegistry,
  logger: PinoLogger
): Promise<void> {
  logger.info('Seeding PDS registry from known DIDs...');

  try {
    // Check if pds_registry table exists (migrations may not have run yet)
    const tableCheck = await pgPool.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'pds_registry'
      ) as exists
    `);

    if (!tableCheck.rows[0]?.exists) {
      logger.warn('pds_registry table does not exist, skipping seed (run migrations first)');
      return;
    }

    // Query all unique DIDs from eprints_index
    const result = await pgPool.query<{ did: DID }>(`
      SELECT DISTINCT did FROM (
        SELECT submitted_by as did FROM eprints_index WHERE submitted_by IS NOT NULL
        UNION
        SELECT jsonb_array_elements(authors)->>'did' as did FROM eprints_index WHERE authors IS NOT NULL
      ) dids
      WHERE did IS NOT NULL AND did != ''
    `);

    const uniqueDIDs = result.rows.map((row) => row.did);
    logger.info('Found unique DIDs to seed from', { count: uniqueDIDs.length });

    if (uniqueDIDs.length === 0) {
      logger.info('No DIDs found in eprints_index, skipping PDS registry seed');
      return;
    }

    // Resolve each DID to its PDS and register
    const pdsUrls = new Set<string>();
    let resolved = 0;
    let failed = 0;

    for (const did of uniqueDIDs) {
      try {
        const pdsUrl = await identityResolver.getPDSEndpoint(did);
        if (pdsUrl) {
          pdsUrls.add(pdsUrl);
          resolved++;
        } else {
          logger.debug('Could not resolve PDS for DID', { did });
          failed++;
        }
      } catch (error) {
        logger.debug('Failed to resolve DID', {
          did,
          error: error instanceof Error ? error.message : String(error),
        });
        failed++;
      }
    }

    logger.info('Resolved DIDs to PDSes', {
      resolved,
      failed,
      uniquePDSes: pdsUrls.size,
    });

    // Register each PDS in the registry
    let registered = 0;
    for (const pdsUrl of pdsUrls) {
      try {
        await pdsRegistry.registerPDS(pdsUrl, 'did_mention');
        registered++;
      } catch (error) {
        logger.debug('Failed to register PDS', {
          pdsUrl,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info('PDS registry seeded', {
      totalDIDs: uniqueDIDs.length,
      resolvedDIDs: resolved,
      uniquePDSes: pdsUrls.size,
      registeredPDSes: registered,
    });

    // Optionally trigger immediate scans for high-priority PDSes (those with Chive records)
    // The PDSScanSchedulerJob will pick these up and scan them
    logger.info('PDS registry seed complete, PDSScanSchedulerJob will scan registered PDSes');
  } catch (error) {
    logger.error('Failed to seed PDS registry', error instanceof Error ? error : undefined);
    // Don't fail startup, just log the error
  }
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

    // Store index retry worker in state for shutdown handling
    state.indexRetryWorker = serverConfig.indexRetryWorker;

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

    // Index retry worker is already initialized via createServices
    logger.info('Index retry worker initialized', {
      concurrency: 3,
      maxAttempts: 10,
      baseDelayMs: 60_000,
    });

    // Initialize plugin system (hybrid search/import architecture)
    state.importScheduler = await initializePluginSystem(
      redis,
      serverConfig.importService,
      serverConfig.claimingService,
      logger
    );

    // Start governance sync job to sync nodes/edges from Governance PDS to Neo4j
    state.governanceSyncJob = new GovernanceSyncJob({
      pdsUrl: config.governancePdsUrl,
      governanceDid: config.governanceDid as DID,
      nodeService: serverConfig.nodeService,
      edgeService: serverConfig.edgeService,
      logger,
      syncIntervalMs: 30_000, // Sync every 30 seconds
    });
    await state.governanceSyncJob.start();
    logger.info('Governance sync job started', {
      pdsUrl: config.governancePdsUrl,
      governanceDid: config.governanceDid,
    });

    // Initialize freshness system (if enabled)
    if (config.freshnessEnabled) {
      logger.info('Initializing freshness system...');

      // Create event bus for freshness events
      state.eventBus = new EventEmitter2({
        wildcard: true,
        maxListeners: 20,
      });

      // Create PDS rate limiter
      const pdsRateLimiter = new PDSRateLimiter({
        redis,
        logger,
        maxRequestsPerWindow: config.freshnessPdsRateLimit,
        windowMs: config.freshnessPdsRateWindowMs,
      });

      // Create freshness worker
      state.freshnessWorker = new FreshnessWorker({
        redis: {
          host: new URL(config.redisUrl).hostname,
          port: parseInt(new URL(config.redisUrl).port || '6379', 10),
        },
        syncService: serverConfig.pdsSyncService,
        rateLimiter: pdsRateLimiter,
        eventBus: state.eventBus,
        logger,
        concurrency: config.freshnessWorkerConcurrency,
      });

      // Create freshness scan job
      state.freshnessScanJob = new FreshnessScanJob({
        pool: pgPool,
        freshnessWorker: state.freshnessWorker,
        logger,
        scanIntervalMs: config.freshnessScanIntervalMs,
      });

      // Start the scan job
      await state.freshnessScanJob.start();

      logger.info('Freshness system initialized', {
        scanIntervalMs: config.freshnessScanIntervalMs,
        pdsRateLimit: config.freshnessPdsRateLimit,
        workerConcurrency: config.freshnessWorkerConcurrency,
      });
    } else {
      logger.info('Freshness system disabled');
    }

    // Initialize PDS scan scheduler job
    if (serverConfig.pdsRegistry && serverConfig.pdsScanner && serverConfig.identityResolver) {
      logger.info('Initializing PDS scan scheduler...');

      // First, seed the registry from known DIDs so we scan their PDSes
      await seedPDSRegistryFromKnownDIDs(
        pgPool,
        serverConfig.identityResolver as InstanceType<typeof DIDResolver>,
        serverConfig.pdsRegistry as PDSRegistry,
        logger
      );

      // Then start the scheduler which will scan the registered PDSes
      state.pdsScanSchedulerJob = new PDSScanSchedulerJob({
        registry: serverConfig.pdsRegistry,
        scanner: serverConfig.pdsScanner,
        logger,
        scanIntervalMs: 15 * 60 * 1000, // 15 minutes
        batchSize: 10,
      });
      await state.pdsScanSchedulerJob.start();
      logger.info('PDS scan scheduler initialized');
    }

    // Initialize tag sync job (syncs Neo4j tags to PostgreSQL for trending)
    logger.info('Initializing tag sync job...');
    state.tagSyncJob = new TagSyncJob({
      neo4jConnection: state.neo4jConnection,
      pool: pgPool,
      logger,
      syncIntervalMs: 60 * 60 * 1000, // 1 hour
      runOnStartup: true, // Backfill existing tags on startup
    });
    await state.tagSyncJob.start();
    logger.info('Tag sync job initialized');
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
