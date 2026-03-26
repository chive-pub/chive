'use client';

/**
 * React hooks for admin dashboard data fetching and mutations.
 *
 * @remarks
 * Provides TanStack Query hooks for all admin API endpoints.
 * Uses manual fetch with service auth since admin endpoints
 * are not in the generated XRPC types.
 *
 * @packageDocumentation
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { getApiBaseUrl } from '@/lib/api/client';
import { getServiceAuthToken } from '@/lib/auth/service-auth';
import { getCurrentAgent } from '@/lib/auth/oauth-client';

// =============================================================================
// FETCH HELPERS
// =============================================================================

/**
 * Performs an authenticated GET request to an admin XRPC endpoint.
 *
 * @param nsid - XRPC namespace identifier (e.g., "pub.chive.admin.getOverview")
 * @param params - Optional query parameters
 * @returns Parsed JSON response
 */
async function adminFetch<T>(nsid: string, params?: Record<string, string>): Promise<T> {
  const apiBase = getApiBaseUrl();
  const headers: Record<string, string> = {};
  const agent = getCurrentAgent();

  if (agent) {
    const token = await getServiceAuthToken(agent, nsid);
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = new URL(`${apiBase}/xrpc/${nsid}`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url.toString(), { headers });

  if (!response.ok) {
    const error = (await response.json().catch(() => ({ message: 'Request failed' }))) as {
      message?: string;
    };
    throw new Error(error.message ?? `Admin API error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Performs an authenticated POST request to an admin XRPC endpoint.
 *
 * @param nsid - XRPC namespace identifier
 * @param body - Request body
 * @returns Parsed JSON response
 */
async function adminPost<T>(nsid: string, body: unknown): Promise<T> {
  const apiBase = getApiBaseUrl();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const agent = getCurrentAgent();

  if (agent) {
    const token = await getServiceAuthToken(agent, nsid);
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${apiBase}/xrpc/${nsid}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => ({ message: 'Request failed' }))) as {
      message?: string;
    };
    throw new Error(error.message ?? `Admin API error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// =============================================================================
// QUERY KEY FACTORY
// =============================================================================

/**
 * Query key factory for all admin queries.
 *
 * @remarks
 * Follows TanStack Query best practices for hierarchical cache key management.
 * Enables fine-grained cache invalidation across admin dashboard sections.
 */
export const adminKeys = {
  /** Base key for all admin queries */
  all: ['admin'] as const,

  // System
  overview: () => [...adminKeys.all, 'overview'] as const,
  health: () => [...adminKeys.all, 'health'] as const,
  prometheus: () => [...adminKeys.all, 'prometheus'] as const,

  // Users
  users: () => [...adminKeys.all, 'users'] as const,
  userSearch: (query: string) => [...adminKeys.users(), 'search', query] as const,
  userDetail: (did: string) => [...adminKeys.users(), 'detail', did] as const,

  // Content
  content: () => [...adminKeys.all, 'content'] as const,
  eprints: (filters?: Record<string, unknown>) =>
    [...adminKeys.content(), 'eprints', filters] as const,
  reviews: (filters?: Record<string, unknown>) =>
    [...adminKeys.content(), 'reviews', filters] as const,
  endorsements: (filters?: Record<string, unknown>) =>
    [...adminKeys.content(), 'endorsements', filters] as const,

  // Firehose
  firehose: () => [...adminKeys.all, 'firehose'] as const,
  dlq: (filters?: Record<string, unknown>) => [...adminKeys.firehose(), 'dlq', filters] as const,

  // Backfill
  backfill: () => [...adminKeys.all, 'backfill'] as const,

  // PDS
  pds: () => [...adminKeys.all, 'pds'] as const,
  pdsList: (filters?: Record<string, unknown>) => [...adminKeys.pds(), 'list', filters] as const,
  imports: (filters?: Record<string, unknown>) => [...adminKeys.pds(), 'imports', filters] as const,

  // Graph
  graph: () => [...adminKeys.all, 'graph'] as const,

  // Metrics & Analytics
  metrics: () => [...adminKeys.all, 'metrics'] as const,
  metricsOverview: (period?: string) => [...adminKeys.metrics(), 'overview', period] as const,
  searchAnalytics: (period?: string) => [...adminKeys.metrics(), 'search', period] as const,
  activityCorrelation: (period?: string) => [...adminKeys.metrics(), 'activity', period] as const,
  trendingVelocity: (window?: string) => [...adminKeys.metrics(), 'trending', window] as const,
  viewDownloads: (uri?: string, granularity?: string) =>
    [...adminKeys.metrics(), 'viewDownloads', uri, granularity] as const,
  endpoints: () => [...adminKeys.metrics(), 'endpoints'] as const,
  nodeMetrics: () => [...adminKeys.metrics(), 'node'] as const,

  // Governance
  governance: () => [...adminKeys.all, 'governance'] as const,
  auditLog: (filters?: Record<string, unknown>) =>
    [...adminKeys.governance(), 'audit', filters] as const,
  warnings: () => [...adminKeys.governance(), 'warnings'] as const,
  violations: () => [...adminKeys.governance(), 'violations'] as const,
};

// =============================================================================
// RESPONSE TYPES
// =============================================================================

/**
 * System overview data returned by the admin overview endpoint.
 */
export interface AdminOverview {
  eprints: number;
  authors: number;
  reviews: number;
  endorsements: number;
  collections: number;
  tags: number;
}

/**
 * Health status for a single database connection.
 */
export interface DatabaseHealth {
  name: string;
  healthy: boolean;
  latencyMs?: number;
  error?: string;
}

/**
 * Aggregated system health.
 */
export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  databases: DatabaseHealth[];
  uptime: number;
  timestamp: string;
}

/**
 * Prometheus-style metrics response.
 */
export interface PrometheusMetrics {
  timestamp: string;
  metrics: MetricEntry[];
}

/**
 * Single metric data point.
 */
export interface MetricEntry {
  name: string;
  value: number;
  labels?: Record<string, string>;
  type: 'counter' | 'gauge' | 'histogram';
}

/**
 * User record with roles for admin listing.
 */
export interface AdminUser {
  did: string;
  handle: string;
  displayName?: string;
  roles: string[];
  createdAt: string;
  lastActiveAt?: string;
}

/**
 * Detailed user information for the admin user detail view.
 */
export interface AdminUserDetail extends AdminUser {
  email?: string;
  avatar?: string;
  eprintCount: number;
  reviewCount: number;
  endorsementCount: number;
  pdsEndpoint?: string;
  flags?: string[];
  warnings?: Array<{ type?: string; reason?: string; createdAt?: string }>;
  recentActivity?: Array<{ type?: string; description?: string; createdAt?: string }>;
}

/**
 * Content item for admin content list.
 */
export interface AdminContent {
  uri: string;
  type: string;
  title?: string;
  authorDid: string;
  authorHandle?: string;
  status: string;
  createdAt: string;
  flagged?: boolean;
  flagReason?: string;
}

/**
 * Eprint item in admin content listing.
 */
export interface AdminEprint {
  uri: string;
  title: string;
  authorDid: string;
  authorHandle?: string;
  status: string;
  fieldUris?: string[];
  createdAt: string;
  indexedAt: string;
  flagged?: boolean;
  flagReason?: string;
}

/**
 * Review item in admin content listing.
 */
export interface AdminReview {
  uri: string;
  cid: string;
  eprintUri: string;
  reviewerDid: string;
  content: string;
  motivation: string;
  replyCount: number;
  endorsementCount: number;
  eprintTitle?: string;
  createdAt: string;
  indexedAt: string;
}

/**
 * Endorsement item in admin content listing.
 */
export interface AdminEndorsement {
  uri: string;
  cid: string;
  eprintUri: string;
  endorserDid: string;
  endorsementType: string;
  comment: string | null;
  eprintTitle?: string;
  createdAt: string;
  indexedAt: string;
}

/**
 * Firehose and indexer status.
 */
export interface FirehoseStatus {
  cursor: string | null;
  dlqCount: number;
  timestamp: string;
}

/**
 * Dead letter queue entry.
 */
export interface DLQEntry {
  id: string;
  uri: string;
  collection: string;
  error: string;
  attempts: number;
  createdAt: string;
  lastAttemptAt: string;
}

/**
 * Backfill operation status.
 */
export interface BackfillStatus {
  operations: BackfillOperation[];
}

/**
 * Single backfill operation.
 */
export interface BackfillOperation {
  id: string;
  type: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  recordsProcessed?: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

/**
 * PDS registry entry.
 */
export interface PDSEntry {
  url: string;
  did?: string;
  status: 'active' | 'stale' | 'unreachable';
  lastScanAt?: string;
  recordCount: number;
  userCount: number;
}

/**
 * Knowledge graph statistics.
 */
export interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  fieldNodes: number;
  authorNodes: number;
  institutionNodes: number;
  pendingProposals: number;
}

/**
 * Trending eprint entry from the metrics overview.
 */
export interface MetricsOverviewTrendingEntry {
  uri: string;
  score: number;
  velocity?: number;
}

/**
 * Metrics overview for a given time period.
 */
export interface MetricsOverview {
  trending: MetricsOverviewTrendingEntry[];
  period: { days: number; window: string };
}

/**
 * Search analytics data.
 */
export interface SearchAnalytics {
  totalQueries: number;
  totalClicks: number;
  impressions: number;
  clicks: number;
  ctr: number;
  avgDwellTimeMs: number | null;
  positionDistribution: Array<{ position: number; count: number }>;
  topQueries: Array<{ query: string; impressionCount: number; clickCount: number }>;
  zeroResultCount: number;
  relevanceGradeDistribution: Array<{ relevanceGrade: number; count: number }>;
  timestamp: string;
}

/**
 * Activity correlation data.
 */
export interface ActivityCorrelation {
  metrics: Array<{
    hour: string;
    category: string;
    total: number;
    confirmed: number;
    failed: number;
    timeout: number;
    pending: number;
    confirmationRatePct: number;
    avgLatencyMs: number | null;
    p95LatencyMs: number | null;
  }>;
  timestamp: string;
}

/**
 * Trending velocity data for a time window.
 */
export interface TrendingVelocity {
  items: Array<{
    uri: string;
    title: string;
    velocity: number;
    views: number;
    downloads: number;
    trend: 'rising' | 'stable' | 'falling';
  }>;
}

/**
 * View and download time series data.
 */
export interface ViewDownloadTimeSeries {
  buckets: Array<{
    timestamp: string;
    views: number;
    downloads: number;
  }>;
  timestamp: string;
}

/**
 * A single endpoint performance metric entry.
 */
export interface EndpointMetric {
  method: string;
  path: string;
  requestCount: number;
  errorCount: number;
  errorRate: number;
  p50: number;
  p95: number;
  p99: number;
}

/**
 * Endpoint performance metrics.
 */
export interface EndpointMetrics {
  metrics: EndpointMetric[];
}

/**
 * Node.js process information returned by the backend.
 */
export interface NodeProcessInfo {
  pid: number;
  uptime: number;
  heapUsed: number;
  heapTotal: number;
  rss: number;
  external?: number;
  cpuUser?: number;
  cpuSystem?: number;
  eventLoopLag?: number;
}

/**
 * A single Node.js runtime metric entry.
 */
export interface NodeMetricEntry {
  name: string;
  value: string;
  type: string;
  unit?: string;
}

/**
 * Node.js runtime metrics.
 */
export interface NodeMetrics {
  metrics: NodeMetricEntry[];
  processInfo: NodeProcessInfo;
}

/**
 * Audit log entry.
 */
export interface AuditLogEntry {
  id: string;
  actorDid: string;
  actorHandle?: string;
  action: string;
  targetUri?: string;
  targetDid?: string;
  details?: Record<string, unknown>;
  timestamp: string;
  ipAddress?: string;
}

/**
 * Governance warning issued to a user.
 */
export interface GovernanceWarning {
  id: string;
  targetDid: string;
  targetHandle?: string;
  reason: string;
  issuedBy: string;
  issuedAt: string;
  acknowledged: boolean;
  acknowledgedAt?: string;
}

/**
 * Governance violation record.
 */
export interface GovernanceViolation {
  id: string;
  targetDid: string;
  targetHandle?: string;
  targetUri?: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  detectedAt: string;
  resolvedAt?: string;
  resolution?: string;
}

// =============================================================================
// MUTATION INPUT TYPES
// =============================================================================

/** Input for assigning a role to a user. */
export interface AssignRoleInput {
  did: string;
  role: string;
}

/** Input for revoking a role from a user. */
export interface RevokeRoleInput {
  did: string;
  role: string;
  reason?: string;
}

/** Input for triggering a backfill operation. */
export interface TriggerBackfillInput {
  type: string;
  options?: Record<string, unknown>;
}

/** Input for content deletion. */
export interface DeleteContentInput {
  uri: string;
  collection: string;
  reason: string;
}

/** Input for rescanning a PDS. */
export interface RescanPDSInput {
  pdsUrl: string;
}

// =============================================================================
// SYSTEM HOOKS
// =============================================================================

/**
 * Fetches the admin dashboard overview.
 *
 * @returns Query result with system overview data
 */
export function useAdminOverview() {
  return useQuery({
    queryKey: adminKeys.overview(),
    queryFn: () => adminFetch<AdminOverview>('pub.chive.admin.getOverview'),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

/**
 * Fetches system health status for all services.
 *
 * @returns Query result with service health data
 */
export function useSystemHealth() {
  return useQuery({
    queryKey: adminKeys.health(),
    queryFn: () => adminFetch<SystemHealth>('pub.chive.admin.getSystemHealth'),
    staleTime: 10_000,
    refetchInterval: 10_000,
  });
}

/**
 * Fetches Prometheus-style metrics for charts.
 *
 * @returns Query result with metrics data
 */
export function usePrometheusMetrics() {
  return useQuery({
    queryKey: adminKeys.prometheus(),
    queryFn: () => adminFetch<PrometheusMetrics>('pub.chive.admin.getPrometheusMetrics'),
    staleTime: 15_000,
    refetchInterval: 15_000,
  });
}

// =============================================================================
// USER HOOKS
// =============================================================================

/**
 * Searches users by query string (handle or display name).
 *
 * @remarks
 * Only enabled when the query string is at least 2 characters.
 *
 * @param query - Search query
 * @returns Query result with matching users
 */
export function useAdminUserSearch(query: string) {
  return useQuery({
    queryKey: adminKeys.userSearch(query),
    queryFn: () =>
      adminFetch<{ users: AdminUser[]; cursor?: string; total?: number }>(
        'pub.chive.admin.searchUsers',
        { query }
      ),
    enabled: query.length >= 2,
    staleTime: 30_000,
  });
}

/**
 * Fetches detailed information for a specific user.
 *
 * @param did - User's DID
 * @returns Query result with user detail
 */
export function useAdminUserDetail(did: string) {
  return useQuery({
    queryKey: adminKeys.userDetail(did),
    queryFn: () => adminFetch<AdminUserDetail>('pub.chive.admin.getUserDetail', { did }),
    enabled: !!did,
    staleTime: 30_000,
  });
}

/**
 * Mutation hook for assigning a role to a user.
 *
 * @returns Mutation object for role assignment
 */
export function useAssignRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AssignRoleInput) =>
      adminPost<{ success: boolean }>('pub.chive.admin.assignRole', input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.userDetail(variables.did) });
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
    },
  });
}

/**
 * Mutation hook for revoking a role from a user.
 *
 * @returns Mutation object for role revocation
 */
export function useRevokeRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RevokeRoleInput) =>
      adminPost<{ success: boolean }>('pub.chive.admin.revokeRole', input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.userDetail(variables.did) });
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
    },
  });
}

/**
 * Alias for useRevokeRole for backward compatibility with admin pages.
 */
export const useRevokeAdminRole = useRevokeRole;

/**
 * Alias for useAdminUserSearch for backward compatibility with admin pages.
 *
 * @param query - Search query string
 * @returns Query result with matching users and total count
 */
export function useAdminUsers(query: string) {
  return useQuery({
    queryKey: adminKeys.userSearch(query),
    queryFn: () =>
      adminFetch<{ users: AdminUser[]; cursor?: string; total?: number }>(
        'pub.chive.admin.searchUsers',
        { query }
      ),
    enabled: query.length >= 2,
    staleTime: 30_000,
  });
}

// =============================================================================
// CONTENT HOOKS
// =============================================================================

/**
 * Fetches admin eprint list with optional filtering.
 *
 * @param filters - Optional filter parameters
 * @returns Query result with eprint items
 */
export function useAdminEprints(filters: string | Record<string, unknown> = {}) {
  const normalizedFilters = typeof filters === 'string' ? { q: filters } : filters;
  return useQuery({
    queryKey: adminKeys.eprints(normalizedFilters),
    queryFn: () => {
      const params: Record<string, string> = {};
      for (const [key, value] of Object.entries(normalizedFilters)) {
        if (value !== undefined && value !== null) params[key] = String(value);
      }
      return adminFetch<{ eprints: AdminEprint[]; cursor?: string; total?: number }>(
        'pub.chive.admin.listEprints',
        params
      );
    },
    staleTime: 30_000,
  });
}

/**
 * Fetches admin review list with optional filtering.
 *
 * @param filters - Optional filter parameters
 * @returns Query result with review items
 */
export function useAdminReviews(filters: string | Record<string, unknown> = {}) {
  const normalizedFilters = typeof filters === 'string' ? { q: filters } : filters;
  return useQuery({
    queryKey: adminKeys.reviews(normalizedFilters),
    queryFn: () => {
      const params: Record<string, string> = {};
      for (const [key, value] of Object.entries(normalizedFilters)) {
        if (value !== undefined && value !== null) params[key] = String(value);
      }
      return adminFetch<{ items: AdminReview[]; total: number }>(
        'pub.chive.admin.listReviews',
        params
      );
    },
    staleTime: 30_000,
  });
}

/**
 * Fetches admin endorsement list with optional filtering.
 *
 * @param filters - Optional filter parameters
 * @returns Query result with endorsement items
 */
export function useAdminEndorsements(filters: string | Record<string, unknown> = {}) {
  const normalizedFilters = typeof filters === 'string' ? { q: filters } : filters;
  return useQuery({
    queryKey: adminKeys.endorsements(normalizedFilters),
    queryFn: () => {
      const params: Record<string, string> = {};
      for (const [key, value] of Object.entries(normalizedFilters)) {
        if (value !== undefined && value !== null) params[key] = String(value);
      }
      return adminFetch<{ items: AdminEndorsement[]; total: number }>(
        'pub.chive.admin.listEndorsements',
        params
      );
    },
    staleTime: 30_000,
  });
}

/**
 * Mutation hook for deleting content (admin moderation action).
 *
 * @returns Mutation object for content deletion
 */
export function useDeleteContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: DeleteContentInput) =>
      adminPost<{ success: boolean }>('pub.chive.admin.deleteContent', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.content() });
      queryClient.invalidateQueries({ queryKey: adminKeys.overview() });
    },
  });
}

// =============================================================================
// FIREHOSE HOOKS
// =============================================================================

/**
 * Fetches firehose and indexer status.
 *
 * @remarks
 * Polls every 5 seconds since firehose status changes frequently.
 *
 * @returns Query result with firehose status
 */
export function useFirehoseStatus() {
  return useQuery({
    queryKey: adminKeys.firehose(),
    queryFn: () => adminFetch<FirehoseStatus>('pub.chive.admin.getFirehoseStatus'),
    staleTime: 5_000,
    refetchInterval: 5_000,
  });
}

/**
 * Fetches dead letter queue entries with optional filtering.
 *
 * @param filters - Optional filter parameters (collection, status, limit, cursor)
 * @returns Query result with DLQ entries
 */
export function useAdminDLQEntries(filters: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: adminKeys.dlq(filters),
    queryFn: () => {
      const params: Record<string, string> = {};
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null) params[key] = String(value);
      }
      return adminFetch<{ entries: DLQEntry[]; cursor?: string; total: number }>(
        'pub.chive.admin.listDLQEntries',
        params
      );
    },
    staleTime: 30_000,
  });
}

/**
 * Mutation hook for retrying a single dead letter queue entry.
 *
 * @returns Mutation object for DLQ retry
 */
export function useRetryDLQEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { index: number }) =>
      adminPost<{ success: boolean }>('pub.chive.admin.retryDLQEntry', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.firehose() });
    },
  });
}

/**
 * Mutation hook for retrying all dead letter queue entries.
 *
 * @returns Mutation object for bulk DLQ retry
 */
export function useRetryAllDLQ() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { errorType?: string } | void) =>
      adminPost<{ success: boolean; retriedCount: number }>(
        'pub.chive.admin.retryAllDLQ',
        input ?? {}
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.firehose() });
    },
  });
}

/**
 * Mutation hook for dismissing a single DLQ entry.
 *
 * @returns Mutation object for DLQ dismissal
 */
export function useDismissDLQEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { index: number }) =>
      adminPost<{ success: boolean }>('pub.chive.admin.dismissDLQEntry', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.firehose() });
    },
  });
}

/**
 * Mutation hook for purging old DLQ entries.
 *
 * @returns Mutation object for DLQ purge
 */
export function usePurgeOldDLQ() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input?: { olderThanDays?: number }) =>
      adminPost<{ success: boolean; purged: number }>('pub.chive.admin.purgeOldDLQ', input ?? {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.firehose() });
    },
  });
}

/**
 * Alias for useAdminDLQEntries for backward compatibility.
 */
export const useAdminDLQ = useAdminDLQEntries;

/**
 * Alias for usePurgeOldDLQ for backward compatibility.
 */
export const usePurgeDLQ = usePurgeOldDLQ;

// =============================================================================
// BACKFILL HOOKS
// =============================================================================

/**
 * Fetches backfill operation status.
 *
 * @remarks
 * Polls every 5 seconds when active backfill operations are running.
 *
 * @returns Query result with backfill status
 */
export function useBackfillStatus() {
  return useQuery({
    queryKey: adminKeys.backfill(),
    queryFn: () => adminFetch<BackfillStatus>('pub.chive.admin.getBackfillStatus'),
    staleTime: 5_000,
    refetchInterval: 5_000,
  });
}

/**
 * Fetches backfill operation history (completed and failed operations).
 *
 * @returns Query result with past backfill operations
 */
export function useBackfillHistory() {
  return useQuery({
    queryKey: [...adminKeys.backfill(), 'history'] as const,
    queryFn: () =>
      adminFetch<{ operations: BackfillOperation[]; cursor?: string }>(
        'pub.chive.admin.getBackfillHistory'
      ),
    staleTime: 30_000,
  });
}

/**
 * Mutation hook for triggering a generic backfill operation.
 *
 * @returns Mutation object for backfill trigger
 */
export function useTriggerBackfill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { type: string; params?: Record<string, unknown> }) =>
      adminPost<{ success: boolean; operationId?: string }>(
        'pub.chive.admin.triggerBackfill',
        input
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.backfill() });
    },
  });
}

/**
 * Mutation hook for triggering a PDS scan.
 *
 * @returns Mutation object for PDS scan trigger
 */
export function useTriggerPDSScan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { pdsUrl?: string }) =>
      adminPost<{ success: boolean }>('pub.chive.admin.triggerPDSScan', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.backfill() });
    },
  });
}

/**
 * Mutation hook for triggering a freshness scan across all PDS entries.
 *
 * @returns Mutation object for freshness scan trigger
 */
export function useTriggerFreshnessScan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => adminPost<{ success: boolean }>('pub.chive.admin.triggerFreshnessScan', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.backfill() });
    },
  });
}

/**
 * Mutation hook for triggering citation extraction for a specific eprint.
 *
 * @returns Mutation object for citation extraction trigger
 */
export function useTriggerCitationExtraction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      adminPost<{ success: boolean }>('pub.chive.admin.triggerCitationExtraction', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.backfill() });
    },
  });
}

/**
 * Mutation hook for triggering a full reindex of all records.
 *
 * @returns Mutation object for full reindex trigger
 */
export function useTriggerFullReindex() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TriggerBackfillInput) =>
      adminPost<{ success: boolean; operationId: string }>(
        'pub.chive.admin.triggerFullReindex',
        input
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.backfill() });
    },
  });
}

/**
 * Mutation hook for triggering governance sync from the governance PDS.
 *
 * @returns Mutation object for governance sync trigger
 */
export function useTriggerGovernanceSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => adminPost<{ success: boolean }>('pub.chive.admin.triggerGovernanceSync', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.backfill() });
      queryClient.invalidateQueries({ queryKey: adminKeys.governance() });
      queryClient.invalidateQueries({ queryKey: adminKeys.graph() });
    },
  });
}

/**
 * Mutation hook for triggering DID document sync for all known users.
 *
 * @returns Mutation object for DID sync trigger
 */
export function useTriggerDIDSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { did: string }) =>
      adminPost<{ success: boolean }>('pub.chive.admin.triggerDIDSync', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.backfill() });
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
    },
  });
}

/**
 * Mutation hook for cancelling an active backfill operation.
 *
 * @returns Mutation object for backfill cancellation
 */
export function useCancelBackfill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { operationId?: string; id?: string }) =>
      adminPost<{ success: boolean }>('pub.chive.admin.cancelBackfill', {
        operationId: input.operationId ?? input.id,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.backfill() });
    },
  });
}

// =============================================================================
// PDS HOOKS
// =============================================================================

/**
 * Fetches PDS registry entries with optional filtering.
 *
 * @param filters - Optional filter parameters (status, limit, cursor)
 * @returns Query result with PDS entries
 */
export function useAdminPDSes(filters: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: adminKeys.pdsList(filters),
    queryFn: () => {
      const params: Record<string, string> = {};
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null) params[key] = String(value);
      }
      return adminFetch<{
        stats: {
          total: number;
          healthy: number;
          unhealthy: number;
          withRecords: number;
          items: PDSEntry[];
        };
      }>('pub.chive.admin.listPDSes', params);
    },
    staleTime: 30_000,
  });
}

/**
 * Mutation hook for rescanning a specific PDS.
 *
 * @returns Mutation object for PDS rescan
 */
export function useRescanPDS() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RescanPDSInput) =>
      adminPost<{ success: boolean }>('pub.chive.admin.rescanPDS', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.pds() });
    },
  });
}

/**
 * Fetches import history with optional source filtering.
 *
 * @param source - Optional source filter (e.g., "arxiv", "crossref")
 * @returns Query result with import entries
 */
export function useAdminImports(source?: string) {
  return useQuery({
    queryKey: adminKeys.imports(source ? { source } : undefined),
    queryFn: () =>
      adminFetch<{ items: unknown[]; total: number }>(
        'pub.chive.admin.listImports',
        source ? { source } : undefined
      ),
    staleTime: 30_000,
  });
}

// =============================================================================
// GRAPH HOOKS
// =============================================================================

/**
 * Fetches knowledge graph statistics.
 *
 * @returns Query result with graph stats
 */
export function useAdminGraphStats() {
  return useQuery({
    queryKey: adminKeys.graph(),
    queryFn: () => adminFetch<GraphStats>('pub.chive.admin.getGraphStats'),
    staleTime: 30_000,
  });
}

// =============================================================================
// METRICS & ANALYTICS HOOKS
// =============================================================================

/**
 * Fetches metrics overview for a given time period.
 *
 * @param period - Time period (e.g., "1h", "24h", "7d", "30d")
 * @returns Query result with metrics overview
 */
export function useAdminMetricsOverview(period?: string) {
  return useQuery({
    queryKey: adminKeys.metricsOverview(period),
    queryFn: () => {
      const params: Record<string, string> = {};
      if (period) {
        const daysMap: Record<string, string> = {
          '24h': '1',
          '7d': '7',
          '30d': '30',
          '90d': '90',
        };
        params['days'] = daysMap[period] ?? '7';
      }
      return adminFetch<MetricsOverview>('pub.chive.admin.getMetricsOverview', params);
    },
    staleTime: 30_000,
  });
}

/**
 * Fetches search analytics data.
 *
 * @param period - Time period for analytics
 * @returns Query result with search analytics
 */
export function useSearchAnalytics(period?: string) {
  return useQuery({
    queryKey: adminKeys.searchAnalytics(period),
    queryFn: () => {
      const params: Record<string, string> = {};
      if (period) params['period'] = period;
      return adminFetch<SearchAnalytics>('pub.chive.admin.getSearchAnalytics', params);
    },
    staleTime: 30_000,
  });
}

/**
 * Fetches activity correlation data.
 *
 * @param period - Time period for correlation analysis
 * @returns Query result with activity correlation
 */
export function useActivityCorrelation(period?: string) {
  return useQuery({
    queryKey: adminKeys.activityCorrelation(period),
    queryFn: () => {
      const params: Record<string, string> = {};
      if (period) params['period'] = period;
      return adminFetch<ActivityCorrelation>('pub.chive.admin.getActivityCorrelation', params);
    },
    staleTime: 30_000,
  });
}

/**
 * Fetches trending velocity data for eprints.
 *
 * @param window - Time window (e.g., "1h", "24h", "7d")
 * @returns Query result with trending velocity data
 */
export function useTrendingVelocity(window?: string) {
  return useQuery({
    queryKey: adminKeys.trendingVelocity(window),
    queryFn: () => {
      const params: Record<string, string> = {};
      if (window) params['window'] = window;
      return adminFetch<TrendingVelocity>('pub.chive.admin.getTrendingVelocity', params);
    },
    staleTime: 30_000,
  });
}

/**
 * Fetches view and download time series data.
 *
 * @param uri - Optional eprint URI to filter by
 * @param granularity - Time granularity (e.g., "hour", "day", "week")
 * @returns Query result with view/download time series
 */
export function useViewDownloadTimeSeries(uri?: string, granularity?: string) {
  return useQuery({
    queryKey: adminKeys.viewDownloads(uri, granularity),
    queryFn: () => {
      const params: Record<string, string> = {};
      if (uri) params['uri'] = uri;
      if (granularity) params['granularity'] = granularity;
      return adminFetch<ViewDownloadTimeSeries>(
        'pub.chive.admin.getViewDownloadTimeSeries',
        params
      );
    },
    staleTime: 30_000,
  });
}

/**
 * Fetches endpoint performance metrics.
 *
 * @returns Query result with endpoint metrics
 */
export function useEndpointMetrics() {
  return useQuery({
    queryKey: adminKeys.endpoints(),
    queryFn: () => adminFetch<EndpointMetrics>('pub.chive.admin.getEndpointMetrics'),
    staleTime: 15_000,
    refetchInterval: 15_000,
  });
}

/**
 * Fetches Node.js runtime metrics (heap, CPU, event loop, GC).
 *
 * @returns Query result with Node.js runtime metrics
 */
export function useNodeMetrics() {
  return useQuery({
    queryKey: adminKeys.nodeMetrics(),
    queryFn: () => adminFetch<NodeMetrics>('pub.chive.admin.getNodeMetrics'),
    staleTime: 10_000,
    refetchInterval: 10_000,
  });
}

// =============================================================================
// GOVERNANCE HOOKS
// =============================================================================

/**
 * Fetches audit log entries with optional filtering.
 *
 * @param filters - Optional filter parameters (actorDid, action, limit, cursor)
 * @returns Query result with audit log entries
 */
export function useAdminAuditLog(filters: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: adminKeys.auditLog(filters),
    queryFn: () => {
      const params: Record<string, string> = {};
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null) params[key] = String(value);
      }
      return adminFetch<{ entries: AuditLogEntry[]; cursor?: string; total: number }>(
        'pub.chive.admin.getAuditLog',
        params
      );
    },
    staleTime: 30_000,
  });
}

/**
 * Fetches governance warnings.
 *
 * @returns Query result with warnings
 */
export function useAdminWarnings() {
  return useQuery({
    queryKey: adminKeys.warnings(),
    queryFn: () => adminFetch<{ warnings: GovernanceWarning[] }>('pub.chive.admin.listWarnings'),
    staleTime: 30_000,
  });
}

/**
 * Fetches governance violations.
 *
 * @returns Query result with violations
 */
export function useAdminViolations() {
  return useQuery({
    queryKey: adminKeys.violations(),
    queryFn: () =>
      adminFetch<{ violations: GovernanceViolation[] }>('pub.chive.admin.listViolations'),
    staleTime: 30_000,
  });
}
