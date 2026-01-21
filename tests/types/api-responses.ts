/**
 * Shared API response types for integration tests.
 *
 * @remarks
 * Types used for response body assertions in tests.
 * These are manually defined to match the lexicon-generated types.
 *
 * @packageDocumentation
 */

// Re-export response types from lexicon-generated types
export type { OutputSchema as EprintResponse } from '@/lexicons/generated/types/pub/chive/eprint/getSubmission.js';
export type { OutputSchema as EprintListResponse } from '@/lexicons/generated/types/pub/chive/eprint/listByAuthor.js';
export type { EprintSummary } from '@/lexicons/generated/types/pub/chive/eprint/listByAuthor.js';
export type { OutputSchema as SearchResultsResponse } from '@/lexicons/generated/types/pub/chive/eprint/searchSubmissions.js';

export type { OutputSchema as NodeListResponse } from '@/lexicons/generated/types/pub/chive/graph/listNodes.js';
export type { GraphNode as GraphNodeResponse } from '@/lexicons/generated/types/pub/chive/graph/listNodes.js';
export type { OutputSchema as NodeSearchResponse } from '@/lexicons/generated/types/pub/chive/graph/searchNodes.js';
export type { OutputSchema as FacetedBrowseResponse } from '@/lexicons/generated/types/pub/chive/graph/browseFaceted.js';

/** Source info included in eprint responses. */
export interface EprintSourceInfo {
  pdsEndpoint: string;
  recordUrl: string;
  blobUrl: string;
  lastVerifiedAt: string;
  stale: boolean;
}

/**
 * ATProto-compliant error response shape for tests.
 *
 * @remarks
 * ATProto uses a flat error format with `error` as the error type string
 * and `message` as the human-readable description.
 *
 * Error types:
 * - `InvalidRequest` - Validation errors (400)
 * - `NotFound` - Resource not found (404)
 * - `AuthenticationRequired` - Missing auth (401)
 * - `Forbidden` - Insufficient permissions (403)
 * - `InternalServerError` - Server error (500)
 */
export interface ErrorResponse {
  error: string;
  message: string;
}

/**
 * Rate limit error response with retry information.
 */
export interface RateLimitResponse extends ErrorResponse {
  error: 'RateLimitExceeded';
  message: string;
}

/**
 * Validation error response.
 */
export interface ValidationErrorResponse extends ErrorResponse {
  error: 'InvalidRequest';
  message: string;
}

/**
 * Health check response.
 */
export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks?: Record<
    string,
    {
      status: 'pass' | 'fail';
      latencyMs?: number;
      message?: string;
    }
  >;
}

/**
 * Trending eprints response.
 */
export interface TrendingResponse {
  eprints: {
    uri: string;
    title: string;
    score: number;
    source: {
      pdsEndpoint: string;
      lastVerifiedAt: string;
      stale: boolean;
    };
  }[];
  window: string;
}
