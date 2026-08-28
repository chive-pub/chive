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
import type { Pool } from 'pg';

import { ServiceAuthVerifier, type IServiceAuthVerifier } from '../auth/service-auth/index.js';
import type { ActivityService } from '../services/activity/activity-service.js';
import type { AdminService } from '../services/admin/admin-service.js';
import type { BackfillManager } from '../services/admin/backfill-manager.js';
import type { AnnotationService } from '../services/annotation/annotation-service.js';
import type { BacklinkService } from '../services/backlink/backlink-service.js';
import type { CitationExtractionService } from '../services/citation/citation-extraction-service.js';
import type { ClaimingService } from '../services/claiming/claiming-service.js';
import type { CollaborationService } from '../services/collaboration/collaboration-service.js';
import type { CollectionService } from '../services/collection/collection-service.js';
import type { DiscoveryService } from '../services/discovery/discovery-service.js';
import type { EprintService } from '../services/eprint/eprint-service.js';
import type { EdgeService } from '../services/governance/edge-service.js';
import type { GovernancePDSWriter } from '../services/governance/governance-pds-writer.js';
import type { NodeService } from '../services/governance/node-service.js';
import type { TrustedEditorService } from '../services/governance/trusted-editor-service.js';
import type { PersonalGraphService } from '../services/graph/personal-graph-service.js';
import type { ImportService } from '../services/import/import-service.js';
import type { KnowledgeGraphService } from '../services/knowledge-graph/graph-service.js';
import type { MetricsService } from '../services/metrics/metrics-service.js';
import type { ContentReportService } from '../services/moderation/content-report-service.js';
import type { IPDSRegistry } from '../services/pds-discovery/pds-registry.js';
import type { PDSScanner } from '../services/pds-discovery/pds-scanner.js';
import type { PDSSyncService } from '../services/pds-sync/sync-service.js';
import type { ProfileHydrator } from '../services/profile/profile-hydrator.js';
import type { ReviewService } from '../services/review/review-service.js';
import type { RankingService } from '../services/search/ranking-service.js';
import type { IRelevanceLogger } from '../services/search/relevance-logger.js';
import type { SearchService } from '../services/search/search-service.js';
import type { EdgeRepository } from '../storage/neo4j/edge-repository.js';
import type { FacetManager } from '../storage/neo4j/facet-manager.js';
import type { GraphAlgorithmCache } from '../storage/neo4j/graph-algorithm-cache.js';
import type { NodeRepository } from '../storage/neo4j/node-repository.js';
import type { RecommendationService } from '../storage/neo4j/recommendations.js';
import type { TagManager } from '../storage/neo4j/tag-manager.js';
import type { IAuthorizationService } from '../types/interfaces/authorization.interface.js';
import type { IIdentityResolver } from '../types/interfaces/identity.interface.js';
import type { ILogger } from '../types/interfaces/logger.interface.js';
import type { IndexRetryWorker } from '../workers/index-retry-worker.js';

import { CORS_CONFIG, HEALTH_PATHS } from './config.js';
import { METRICS_PATH } from './handlers/rest/metrics.js';
import { authenticateServiceAuth, requireAuth, requireAdmin } from './middleware/auth.js';
import { errorHandler } from './middleware/error-handler.js';
import { conditionalRateLimiter, autocompleteRateLimiter } from './middleware/rate-limit.js';
import { requestContext } from './middleware/request-context.js';
import { AUTOCOMPLETE_RATE_LIMIT_PATHS } from './rate-limit-paths.js';
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

  /**
   * Review service instance.
   */
  readonly reviewService: ReviewService;

  /**
   * Annotation service instance.
   */
  readonly annotationService: AnnotationService;

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
   * PostgreSQL connection pool for direct queries (optional).
   *
   * @remarks
   * Used by handlers that need raw SQL access (e.g., ORCID verification).
   */
  readonly pool?: Pool;

  /**
   * Redis client for rate limiting and caching.
   */
  readonly redis: Redis;

  /**
   * Cache of precomputed graph algorithm results.
   *
   * @remarks
   * Two handlers read `services.graphAlgorithmCache`, but `ServerConfig` had no
   * field for it and nothing ever set it, so it was always undefined:
   * `getCommunities` returned an empty list on every request and `getTrending`
   * never used its cache. The graph algorithm job builds and populates the very
   * same cache — nothing was reading what it wrote.
   */
  readonly graphAlgorithmCache?: GraphAlgorithmCache;

  /**
   * Shared, Redis-backed profile lookup.
   *
   * @remarks
   * Handler-level profile fetching was open-coded at several sites, none of
   * them cached. Passing one hydrator gives them a single implementation and
   * a shared cache, so the same author rendered across a page costs one lookup
   * rather than one per appearance.
   */
  readonly profileHydrator?: ProfileHydrator;

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
   * Optional custom service auth verifier for testing.
   * If not provided, a default verifier is created using serviceDid.
   */
  readonly serviceAuthVerifier?: IServiceAuthVerifier;

  /**
   * Personal graph service for user-created nodes and edges (optional).
   */
  readonly personalGraphService?: PersonalGraphService;

  /**
   * Collection service for indexing and querying collections (optional).
   */
  readonly collectionService?: CollectionService;

  /**
   * Collaboration service for indexing invites / acceptances and deriving
   * active collaborators (optional).
   */
  readonly collaborationService?: CollaborationService;

  /**
   * Admin service for dashboard operations (optional).
   */
  readonly adminService?: AdminService;

  /**
   * Backfill manager for tracking backfill operations (optional).
   */
  readonly backfillManager?: BackfillManager;

  /**
   * Citation extraction service for extracting references from eprints (optional).
   */
  readonly citationExtractionService?: CitationExtractionService;

  /**
   * Recommendation service for graph-based similarity (optional).
   */
  readonly recommendationService?: RecommendationService;

  /**
   * Content report service for user-submitted content reports (optional).
   */
  readonly contentReportService?: ContentReportService;
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
  app.use(
    '*',
    secureHeaders({
      // `secureHeaders()` sets no Content-Security-Policy by default, so the
      // API shipped without one. It answers JSON and nothing else, which makes
      // the policy both strict and easy: nothing may load, nothing may frame
      // it, and no base tag or form action can be introduced by injected
      // markup. Had this been here, the stored-XSS hole fixed in 0.8.0 would
      // have been far harder to exploit.
      contentSecurityPolicy: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
        sandbox: [],
      },
      crossOriginResourcePolicy: 'same-site',
      referrerPolicy: 'no-referrer',
    })
  );

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
      review: config.reviewService,
      annotation: config.annotationService,
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
      graphAlgorithmCache: config.graphAlgorithmCache,
      profileHydrator: config.profileHydrator,
      relevanceLogger: config.relevanceLogger,
      ranking: config.rankingService,
      discovery: config.discoveryService,
      activity: config.activityService,
      trustedEditor: config.trustedEditorService,
      governancePdsWriter: config.governancePdsWriter,
      pdsRegistry: config.pdsRegistry,
      pdsScanner: config.pdsScanner,
      indexRetryWorker: config.indexRetryWorker,
      personalGraph: config.personalGraphService,
      collection: config.collectionService,
      collaborationService: config.collaborationService,
      admin: config.adminService,
      backfillManager: config.backfillManager,
      citationExtraction: config.citationExtractionService,
      recommendationService: config.recommendationService,
      contentReport: config.contentReportService,
    } as ChiveServices);
    c.set('redis', config.redis);
    if (config.pool) {
      c.set('pool', config.pool);
    }
    c.set('logger', config.logger);
    await next();
  });

  // 4. Request context (ID, timing, logging)
  app.use('*', requestContext());

  // 5. ATProto service auth (optional; sets user if valid token present)
  app.use('*', authenticateServiceAuth(serviceAuthVerifier, config.authzService));

  // 5b. Admin route protection (require auth + admin role)
  app.use('/xrpc/pub.chive.admin.*', requireAuth(), requireAdmin());

  // 6. Rate limiting
  // Autocomplete endpoints get higher rate limits (5x for anonymous)
  const isAutocompleteEndpoint = (path: string): boolean =>
    AUTOCOMPLETE_RATE_LIMIT_PATHS.some((pattern) => path.startsWith(pattern));

  // The metrics endpoint is scraped on a fixed interval, so counting it against
  // a rate limit would eventually starve the scraper of the very data that
  // would show it happening.
  const isHealthCheck = (path: string): boolean =>
    path === HEALTH_PATHS.liveness || path === HEALTH_PATHS.readiness || path === METRICS_PATH;

  // Apply autocomplete rate limiter to search/autocomplete endpoints
  // Note: Hono matches exact paths; query strings are not part of the path
  for (const pattern of AUTOCOMPLETE_RATE_LIMIT_PATHS) {
    app.use(pattern, autocompleteRateLimiter());
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
