/**
 * Hono application factory for Chive API.
 *
 * @remarks
 * Creates a configured Hono instance with middleware stack and routes.
 * Follows application factory pattern for testability.
 *
 * Middleware stack (in order):
 * 1. Security headers (secureHeaders)
 * 2. CORS
 * 3. Service injection
 * 4. Request context (ID, timing, logging)
 * 5. Authentication (ATProto service auth)
 * 6. Rate limiting
 * 7. Error handling
 *
 * @packageDocumentation
 * @public
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import type { Redis } from 'ioredis';

import { ServiceAuthVerifier, type IServiceAuthVerifier } from '../auth/service-auth/index.js';
import type { ActivityService } from '../services/activity/activity-service.js';
import type { AlphaApplicationService } from '../services/alpha/alpha-application-service.js';
import type { BacklinkService } from '../services/backlink/backlink-service.js';
import type { BlobProxyService } from '../services/blob-proxy/proxy-service.js';
import type { ClaimingService } from '../services/claiming/claiming-service.js';
import type { DiscoveryService } from '../services/discovery/discovery-service.js';
import type { EprintService } from '../services/eprint/eprint-service.js';
import type { EdgeService } from '../services/governance/edge-service.js';
import type { GovernancePDSWriter } from '../services/governance/governance-pds-writer.js';
import type { NodeService } from '../services/governance/node-service.js';
import type { TrustedEditorService } from '../services/governance/trusted-editor-service.js';
import type { ImportService } from '../services/import/import-service.js';
import type { KnowledgeGraphService } from '../services/knowledge-graph/graph-service.js';
import type { MetricsService } from '../services/metrics/metrics-service.js';
import type { IPDSRegistry } from '../services/pds-discovery/pds-registry.js';
import type { PDSScanner } from '../services/pds-discovery/pds-scanner.js';
import type { PDSSyncService } from '../services/pds-sync/sync-service.js';
import type { ReviewService } from '../services/review/review-service.js';
import type { RankingService } from '../services/search/ranking-service.js';
import type { IRelevanceLogger } from '../services/search/relevance-logger.js';
import type { SearchService } from '../services/search/search-service.js';
import type { EdgeRepository } from '../storage/neo4j/edge-repository.js';
import type { FacetManager } from '../storage/neo4j/facet-manager.js';
import type { NodeRepository } from '../storage/neo4j/node-repository.js';
import type { TagManager } from '../storage/neo4j/tag-manager.js';
import type { IAuthorizationService } from '../types/interfaces/authorization.interface.js';
import type { IIdentityResolver } from '../types/interfaces/identity.interface.js';
import type { ILogger } from '../types/interfaces/logger.interface.js';
import type { IndexRetryWorker } from '../workers/index-retry-worker.js';

import { CORS_CONFIG, HEALTH_PATHS } from './config.js';
import { authenticateServiceAuth } from './middleware/auth.js';
import { errorHandler } from './middleware/error-handler.js';
import { conditionalRateLimiter, autocompleteRateLimiter } from './middleware/rate-limit.js';
import { requestContext } from './middleware/request-context.js';
import { registerRoutes } from './routes.js';
import type { ChiveEnv, ChiveServices } from './types/context.js';

/**
 * Server configuration with injected dependencies.
 *
 * @public
 */
export interface ServerConfig {
  /**
   * Eprint service instance.
   */
  readonly eprintService: EprintService;

  /**
   * Search service instance.
   */
  readonly searchService: SearchService;

  /**
   * Metrics service instance.
   */
  readonly metricsService: MetricsService;

  /**
   * Knowledge graph service instance.
   */
  readonly graphService: KnowledgeGraphService;

  /**
   * Blob proxy service instance.
   */
  readonly blobProxyService: BlobProxyService;

  /**
   * Review service instance.
   */
  readonly reviewService: ReviewService;

  /**
   * Tag manager instance.
   */
  readonly tagManager: TagManager;

  /**
   * Node repository for unified graph nodes.
   */
  readonly nodeRepository: NodeRepository;

  /**
   * Edge repository for graph edges.
   */
  readonly edgeRepository: EdgeRepository;

  /**
   * Node service for graph node operations.
   */
  readonly nodeService: NodeService;

  /**
   * Edge service for graph edge operations.
   */
  readonly edgeService: EdgeService;

  /**
   * Facet manager for PMEST/FAST classification.
   */
  readonly facetManager: FacetManager;

  /**
   * Backlink service instance.
   */
  readonly backlinkService: BacklinkService;

  /**
   * Claiming service instance.
   */
  readonly claimingService: ClaimingService;

  /**
   * Import service instance.
   */
  readonly importService: ImportService;

  /**
   * PDS sync service instance.
   */
  readonly pdsSyncService: PDSSyncService;

  /**
   * Relevance logger for LTR training data.
   */
  readonly relevanceLogger: IRelevanceLogger;

  /**
   * Activity logging service for firehose correlation.
   */
  readonly activityService: ActivityService;

  /**
   * Ranking service for personalized search (optional).
   */
  readonly rankingService?: RankingService;

  /**
   * Discovery service for recommendations (optional).
   */
  readonly discoveryService?: DiscoveryService;

  /**
   * Trusted editor service for role management (optional).
   */
  readonly trustedEditorService?: TrustedEditorService;

  /**
   * PDS registry for tracking known PDSes (optional).
   */
  readonly pdsRegistry?: IPDSRegistry;

  /**
   * PDS scanner for discovering eprints from PDSes (optional).
   */
  readonly pdsScanner?: PDSScanner;

  /**
   * Index retry worker for retrying failed indexRecord calls (optional).
   */
  readonly indexRetryWorker?: IndexRetryWorker;

  /**
   * Identity resolver for DID resolution (optional).
   */
  readonly identityResolver?: IIdentityResolver;

  /**
   * Governance PDS writer for authority records (optional).
   */
  readonly governancePdsWriter?: GovernancePDSWriter;

  /**
   * Redis client for rate limiting and caching.
   */
  readonly redis: Redis;

  /**
   * Logger instance.
   */
  readonly logger: ILogger;

  /**
   * Chive's service DID for ATProto service auth.
   *
   * @remarks
   * This DID is used as the audience (aud) claim in service auth JWTs.
   * Should be a did:web or did:plc that identifies Chive's service identity.
   *
   * @example 'did:web:chive.pub' or 'did:plc:chive...'
   */
  readonly serviceDid: string;

  /**
   * PLC directory URL for DID resolution.
   *
   * @defaultValue 'https://plc.directory'
   */
  readonly plcDirectoryUrl?: string;

  /**
   * Authorization service for role management.
   */
  readonly authzService: IAuthorizationService;

  /**
   * Alpha application service.
   */
  readonly alphaService: AlphaApplicationService;

  /**
   * Optional custom service auth verifier for testing.
   * If not provided, a default verifier is created using serviceDid.
   */
  readonly serviceAuthVerifier?: IServiceAuthVerifier;
}

/**
 * Creates a Hono application with full middleware stack.
 *
 * @param config - Server configuration with injected services
 * @returns Configured Hono application
 *
 * @remarks
 * The application factory pattern enables:
 * - Dependency injection for services
 * - Easy testing with mock services
 * - Multiple app instances with different configurations
 *
 * @example
 * ```typescript
 * const app = createServer({
 *   eprintService,
 *   searchService,
 *   metricsService,
 *   graphService,
 *   blobProxyService,
 *   redis,
 *   logger,
 * });
 *
 * // Node.js server
 * import { serve } from '@hono/node-server';
 * serve({ fetch: app.fetch, port: 3000 });
 *
 * // Bun
 * export default { port: 3000, fetch: app.fetch };
 * ```
 *
 * @public
 */
export function createServer(config: ServerConfig): Hono<ChiveEnv> {
  const app = new Hono<ChiveEnv>();

  // Use injected verifier (for testing) or create default one
  const serviceAuthVerifier =
    config.serviceAuthVerifier ??
    new ServiceAuthVerifier({
      logger: config.logger,
      config: {
        serviceDid: config.serviceDid,
        plcDirectoryUrl: config.plcDirectoryUrl,
      },
    });

  // 1. Security headers (first, applied to all responses)
  app.use('*', secureHeaders());

  // 2. CORS (before any request processing)
  app.use(
    '*',
    cors({
      origin: [...CORS_CONFIG.origins],
      allowMethods: [...CORS_CONFIG.allowMethods],
      allowHeaders: [...CORS_CONFIG.allowHeaders],
      exposeHeaders: [...CORS_CONFIG.exposeHeaders],
      maxAge: CORS_CONFIG.maxAge,
      credentials: CORS_CONFIG.credentials,
    })
  );

  // 3. Inject services into context
  app.use('*', async (c, next) => {
    c.set('services', {
      eprint: config.eprintService,
      search: config.searchService,
      metrics: config.metricsService,
      graph: config.graphService,
      blobProxy: config.blobProxyService,
      review: config.reviewService,
      tagManager: config.tagManager,
      facetManager: config.facetManager,
      nodeRepository: config.nodeRepository,
      edgeRepository: config.edgeRepository,
      nodeService: config.nodeService,
      edgeService: config.edgeService,
      backlink: config.backlinkService,
      claiming: config.claimingService,
      import: config.importService,
      pdsSync: config.pdsSyncService,
      relevanceLogger: config.relevanceLogger,
      ranking: config.rankingService,
      discovery: config.discoveryService,
      activity: config.activityService,
      trustedEditor: config.trustedEditorService,
      governancePdsWriter: config.governancePdsWriter,
      pdsRegistry: config.pdsRegistry,
      pdsScanner: config.pdsScanner,
      indexRetryWorker: config.indexRetryWorker,
    } as ChiveServices);
    c.set('redis', config.redis);
    c.set('logger', config.logger);
    c.set('alphaService', config.alphaService);
    await next();
  });

  // 4. Request context (ID, timing, logging)
  app.use('*', requestContext());

  // 5. ATProto service auth (optional; sets user if valid token present)
  app.use('*', authenticateServiceAuth(serviceAuthVerifier, config.authzService));

  // 6. Rate limiting
  // Autocomplete endpoints get higher rate limits (5x for anonymous)
  const autocompletePatterns = [
    '/xrpc/pub.chive.search.searchSubmissions',
    '/xrpc/pub.chive.actor.autocompleteOrcid',
    '/xrpc/pub.chive.actor.autocompleteAffiliation',
    '/xrpc/pub.chive.actor.autocompleteKeyword',
    '/xrpc/pub.chive.actor.autocompleteOpenReview',
    '/xrpc/pub.chive.claiming.autocomplete',
    '/api/v1/search', // REST search endpoint
  ];

  const isAutocompleteEndpoint = (path: string): boolean =>
    autocompletePatterns.some((pattern) => path.startsWith(pattern));

  const isHealthCheck = (path: string): boolean =>
    path === HEALTH_PATHS.liveness || path === HEALTH_PATHS.readiness;

  // Apply autocomplete rate limiter to search/autocomplete endpoints
  for (const pattern of autocompletePatterns) {
    app.use(`${pattern}*`, autocompleteRateLimiter());
  }

  // Apply standard rate limiter to all other endpoints (skip health checks and autocomplete)
  app.use(
    '*',
    conditionalRateLimiter((c) => {
      const path = c.req.path;
      return isHealthCheck(path) || isAutocompleteEndpoint(path);
    })
  );

  // 7. Error handling (wraps all routes)
  app.onError(errorHandler);

  // Register all routes
  registerRoutes(app);

  // 404 handler (ATProto flat format)
  app.notFound((c) => {
    return c.json(
      {
        error: 'NotFound',
        message: `Route not found: ${c.req.method} ${c.req.path}`,
      },
      404
    );
  });

  return app;
}
