/**
 * Shared API response types for integration tests.
 *
 * @remarks
 * Re-exports types from API schemas for use in tests.
 * This provides proper typing for response body assertions.
 *
 * @packageDocumentation
 */

// Re-export response types from schemas
export type {
  EprintResponse,
  EprintSummary,
  EprintListResponse,
  SearchResultsResponse,
  EprintSourceInfo,
} from '@/api/schemas/eprint.js';

export type {
  GraphNodeResponse,
  NodeListResponse,
  NodeSearchResponse,
  FacetedBrowseResponse,
} from '@/api/schemas/graph.js';

export type { ErrorResponseType } from '@/api/schemas/error.js';

/**
 * Generic error response shape for tests.
 */
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    requestId?: string;
    field?: string;
    retryAfter?: number;
  };
}

/**
 * Rate limit error response with retry information.
 */
export interface RateLimitResponse extends ErrorResponse {
  error: {
    code: 'RATE_LIMIT_EXCEEDED';
    message: string;
    requestId: string;
    retryAfter: number;
  };
}

/**
 * Validation error response with field information.
 */
export interface ValidationErrorResponse extends ErrorResponse {
  error: {
    code: 'VALIDATION_ERROR';
    message: string;
    requestId: string;
    field: string;
  };
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
