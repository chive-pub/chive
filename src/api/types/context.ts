/**
 * Hono context type extensions for Chive API.
 *
 * @remarks
 * Defines the context variables available in Hono handlers. Services,
 * Redis client, logger, and user information are injected via middleware.
 *
 * @packageDocumentation
 * @public
 */

import type { Redis } from 'ioredis';

import type { ActivityService } from '../../services/activity/activity-service.js';
import type { AlphaApplicationService } from '../../services/alpha/alpha-application-service.js';
import type { BacklinkService } from '../../services/backlink/backlink-service.js';
import type { BlobProxyService } from '../../services/blob-proxy/proxy-service.js';
import type { ClaimingService } from '../../services/claiming/claiming-service.js';
import type { DiscoveryService } from '../../services/discovery/discovery-service.js';
import type { EprintService } from '../../services/eprint/eprint-service.js';
import type { EdgeService } from '../../services/governance/edge-service.js';
import type { GovernancePDSWriter } from '../../services/governance/governance-pds-writer.js';
import type { NodeService } from '../../services/governance/node-service.js';
import type { TrustedEditorService } from '../../services/governance/trusted-editor-service.js';
import type { ImportService } from '../../services/import/import-service.js';
import type { KnowledgeGraphService } from '../../services/knowledge-graph/graph-service.js';
import type { MetricsService } from '../../services/metrics/metrics-service.js';
import type { PDSSyncService } from '../../services/pds-sync/sync-service.js';
import type { ReviewService } from '../../services/review/review-service.js';
import type { RankingService } from '../../services/search/ranking-service.js';
import type { IRelevanceLogger } from '../../services/search/relevance-logger.js';
import type { SearchService } from '../../services/search/search-service.js';
import type { EdgeRepository } from '../../storage/neo4j/edge-repository.js';
import type { FacetManager } from '../../storage/neo4j/facet-manager.js';
import type { GraphAlgorithmCache } from '../../storage/neo4j/graph-algorithm-cache.js';
import type { NodeRepository } from '../../storage/neo4j/node-repository.js';
import type { RecommendationService } from '../../storage/neo4j/recommendations.js';
import type { TagManager } from '../../storage/neo4j/tag-manager.js';
import type { DID } from '../../types/atproto.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';

/**
 * Services container injected into Hono context.
 *
 * @public
 */
export interface ChiveServices {
  readonly eprint: EprintService;
  readonly search: SearchService;
  readonly ranking?: RankingService;
  readonly relevanceLogger: IRelevanceLogger;
  readonly metrics: MetricsService;
  readonly graph: KnowledgeGraphService;
  readonly blobProxy: BlobProxyService;
  readonly review: ReviewService;
  readonly tagManager: TagManager;
  readonly facetManager: FacetManager;
  readonly nodeRepository: NodeRepository;
  readonly edgeRepository: EdgeRepository;
  readonly nodeService: NodeService;
  readonly edgeService: EdgeService;
  readonly backlink: BacklinkService;
  readonly claiming: ClaimingService;
  readonly import: ImportService;
  readonly pdsSync: PDSSyncService;
  readonly activity: ActivityService;
  readonly discovery?: DiscoveryService;
  readonly recommendationService?: RecommendationService;
  readonly graphAlgorithmCache?: GraphAlgorithmCache;
  readonly trustedEditor?: TrustedEditorService;
  readonly governancePdsWriter?: GovernancePDSWriter;
}

/**
 * Authenticated user information.
 *
 * @remarks
 * Set by auth middleware when a valid Bearer token is present.
 * Contains user DID and permission flags for rate limiting and access control.
 *
 * @public
 */
export interface AuthenticatedUser {
  /**
   * User's decentralized identifier.
   */
  readonly did: DID;

  /**
   * User's handle (e.g., "alice.bsky.social").
   */
  readonly handle?: string;

  /**
   * Admin flag for elevated rate limits and permissions.
   */
  readonly isAdmin: boolean;

  /**
   * Premium tier flag for enhanced rate limits.
   */
  readonly isPremium: boolean;

  /**
   * Alpha tester flag for alpha access gating.
   */
  readonly isAlphaTester: boolean;

  /**
   * User's granted scopes.
   */
  readonly scopes?: readonly string[];

  /**
   * Current session ID.
   */
  readonly sessionId?: string;

  /**
   * Current token ID (jti claim).
   */
  readonly tokenId?: string;
}

/**
 * Rate limit tier for request classification.
 *
 * @public
 */
export type RateLimitTier = 'anonymous' | 'authenticated' | 'premium' | 'admin';

/**
 * Hono environment bindings for Chive API.
 *
 * @remarks
 * Extends Hono's generic types to provide type-safe access to injected
 * services and request-scoped variables.
 *
 * @example
 * ```typescript
 * import type { Context } from 'hono';
 * import type { ChiveEnv } from './types/context.js';
 *
 * async function handler(c: Context<ChiveEnv>) {
 *   const services = c.get('services');
 *   const eprint = await services.eprint.getEprint(uri);
 * }
 * ```
 *
 * @public
 */
export interface ChiveEnv {
  /**
   * Environment bindings (unused in Node.js runtime).
   */
  Bindings: Record<string, never>;

  /**
   * Context variables set by middleware.
   */
  Variables: {
    /**
     * Injected service instances.
     */
    services: ChiveServices;

    /**
     * Redis client for rate limiting and caching.
     */
    redis: Redis;

    /**
     * Logger instance with request context.
     */
    logger: ILogger;

    /**
     * Alpha application service.
     */
    alphaService: AlphaApplicationService;

    /**
     * Authenticated user (undefined if anonymous).
     */
    user?: AuthenticatedUser;

    /**
     * User's rate limit tier.
     */
    rateLimitTier: RateLimitTier;

    /**
     * Validated request input (set by validation middleware).
     */
    validatedInput?: unknown;

    /**
     * Unique request identifier for correlation.
     */
    requestId: string;

    /**
     * Request start time for duration tracking.
     */
    requestStartTime: number;
  };
}
