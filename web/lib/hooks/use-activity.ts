/**
 * Activity logging hook for tracking user-initiated write actions.
 *
 * @remarks
 * Provides activity logging before PDS writes with firehose correlation.
 * Activities are logged to the Chive backend before writing to the user's PDS,
 * then correlated with firehose events when they appear.
 *
 * **Usage Pattern:**
 * 1. Call `logActivity()` before performing PDS write
 * 2. Perform PDS write (createRecord, putRecord, deleteRecord)
 * 3. If write fails, call `markFailed()` to update activity status
 *
 * @packageDocumentation
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

import { authApi } from '../api/client';
import { TID } from '@atproto/common-web';
import { logger } from '@/lib/observability';

const activityLogger = logger.child({ component: 'activity' });

// =============================================================================
// TYPES
// =============================================================================

/**
 * Activity action types.
 *
 * @remarks
 * Open union to match lexicon definition, allowing for future extensions.
 */
export type ActivityAction = 'create' | 'update' | 'delete' | (string & {});

/**
 * Activity categories (semantic action types).
 *
 * @remarks
 * Open union to match lexicon definition, allowing for future extensions.
 */
export type ActivityCategory =
  | 'eprint_submit'
  | 'eprint_update'
  | 'eprint_delete'
  | 'review_create'
  | 'review_update'
  | 'review_delete'
  | 'endorsement_create'
  | 'endorsement_delete'
  | 'tag_create'
  | 'tag_delete'
  | 'profile_update'
  | 'proposal_create'
  | 'vote_create'
  | (string & {});

/**
 * Activity status.
 *
 * @remarks
 * Open union to match lexicon definition, allowing for future extensions.
 */
export type ActivityStatus = 'pending' | 'confirmed' | 'failed' | 'timeout' | (string & {});

/**
 * Activity record.
 *
 * @remarks
 * Aligned with lexicon's `ActivityView` type from `pub.chive.activity.getFeed`.
 */
export interface Activity {
  readonly id: string;
  readonly actorDid: string;
  readonly collection: string;
  readonly rkey: string;
  readonly action: ActivityAction;
  readonly category: ActivityCategory;
  readonly status: ActivityStatus;
  readonly initiatedAt: string;
  readonly confirmedAt?: string;
  readonly firehoseUri?: string;
  readonly firehoseCid?: string;
  readonly targetUri?: string;
  readonly targetTitle?: string;
  readonly latencyMs?: number;
  readonly errorCode?: string;
  readonly errorMessage?: string;
}

/**
 * Log activity input.
 *
 * @remarks
 * Aligned with lexicon's `InputSchema` for `pub.chive.activity.log`.
 * `uiContext` and `recordSnapshot` are JSON strings per the lexicon.
 */
export interface LogActivityInput {
  readonly collection: string;
  readonly rkey: string;
  readonly action: ActivityAction;
  readonly category: ActivityCategory;
  readonly targetUri?: string;
  readonly targetTitle?: string;
  readonly uiContext?: string;
  readonly recordSnapshot?: string;
}

/**
 * Mark failed input.
 */
export interface MarkFailedInput {
  readonly collection: string;
  readonly rkey: string;
  readonly errorCode: string;
  readonly errorMessage: string;
}

/**
 * Activity feed options.
 */
export interface ActivityFeedOptions {
  readonly category?: ActivityCategory;
  readonly status?: ActivityStatus;
  readonly limit?: number;
}

// =============================================================================
// QUERY KEYS
// =============================================================================

/**
 * Query key factory for activity logging.
 */
export const activityKeys = {
  all: ['activity'] as const,
  feed: (options?: ActivityFeedOptions) => [...activityKeys.all, 'feed', options] as const,
};

// =============================================================================
// TID GENERATION
// =============================================================================

/**
 * Generate a new record key (TID) for ATProto records.
 *
 * @returns Time-ordered identifier string
 *
 * @remarks
 * TIDs are time-ordered identifiers used as record keys in ATProto.
 * They are guaranteed to be unique per user and sortable by time.
 *
 * @example
 * ```typescript
 * const rkey = generateRkey();
 * // Use rkey when creating a new record
 * ```
 */
export function generateRkey(): string {
  return TID.nextStr();
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Hook for logging a new activity.
 *
 * @returns Mutation for logging activities
 *
 * @remarks
 * Call this before performing a PDS write operation. The activity will
 * be correlated with the firehose event when the record appears.
 *
 * @example
 * ```typescript
 * const logActivityMutation = useLogActivity();
 * const rkey = generateRkey();
 *
 * // Log activity before PDS write
 * await logActivityMutation.mutateAsync({
 *   collection: 'pub.chive.eprint.submission',
 *   rkey,
 *   action: 'create',
 *   category: 'eprint_submit',
 * });
 *
 * // Perform PDS write with the same rkey
 * await agent.com.atproto.repo.createRecord({
 *   repo: did,
 *   collection: 'pub.chive.eprint.submission',
 *   rkey, // Use generated rkey for correlation
 *   record,
 * });
 * ```
 */
export function useLogActivity(): UseMutationResult<
  { activityId: string },
  Error,
  LogActivityInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: LogActivityInput) => {
      const response = await authApi.pub.chive.activity.log(input);
      return { activityId: response.data.activityId };
    },
    onSuccess: () => {
      // Invalidate activity feed queries
      queryClient.invalidateQueries({ queryKey: activityKeys.all });
    },
  });
}

/**
 * Hook for marking an activity as failed.
 *
 * @returns Mutation for marking activities as failed
 *
 * @remarks
 * Call this when a PDS write fails after logging the activity.
 *
 * @example
 * ```typescript
 * const logActivity = useLogActivity();
 * const markFailed = useMarkActivityFailed();
 *
 * try {
 *   await logActivity.mutateAsync({ ... });
 *   await agent.com.atproto.repo.createRecord({ ... });
 * } catch (error) {
 *   await markFailed.mutateAsync({
 *     collection: 'pub.chive.eprint.submission',
 *     rkey,
 *     errorCode: 'PDS_WRITE_FAILED',
 *     errorMessage: error.message,
 *   });
 * }
 * ```
 */
export function useMarkActivityFailed(): UseMutationResult<
  { success: boolean },
  Error,
  MarkFailedInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: MarkFailedInput) => {
      const response = await authApi.pub.chive.activity.markFailed(input);
      return { success: response.data.success };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activityKeys.all });
    },
  });
}

/**
 * Hook for getting the user's activity feed.
 *
 * @param options - Filter and pagination options
 * @returns Query result with activities
 *
 * @example
 * ```typescript
 * const { data, isLoading } = useActivityFeed({
 *   category: 'eprint_submit',
 *   limit: 20,
 * });
 * ```
 */
export function useActivityFeed(
  options?: ActivityFeedOptions
): UseQueryResult<{ activities: Activity[]; cursor: string | null; hasMore: boolean }> {
  return useQuery({
    queryKey: activityKeys.feed(options),
    queryFn: async () => {
      const response = await authApi.pub.chive.activity.getFeed({
        category: options?.category,
        status: options?.status,
        limit: options?.limit,
      });
      return {
        activities: response.data.activities,
        cursor: response.data.cursor ?? null,
        hasMore: response.data.hasMore,
      };
    },
  });
}

// =============================================================================
// UTILITY HOOKS
// =============================================================================

/**
 * Combined hook for activity-tracked PDS writes.
 *
 * @returns Object with activity logging utilities
 *
 * @remarks
 * Provides a convenient way to perform PDS writes with automatic
 * activity logging and error handling.
 *
 * @example
 * ```typescript
 * const { withActivityLogging, generateRkey } = useActivityLogging();
 *
 * // Create an eprint with activity tracking
 * await withActivityLogging({
 *   category: 'eprint_submit',
 *   action: 'create',
 *   targetTitle: 'My Eprint',
 *   perform: async (collection, rkey) => {
 *     return await agent.com.atproto.repo.createRecord({
 *       repo: did,
 *       collection,
 *       rkey, // Use the provided rkey for correlation
 *       record,
 *     });
 *   },
 * });
 * ```
 */
export function useActivityLogging() {
  const logActivity = useLogActivity();
  const markFailed = useMarkActivityFailed();

  /**
   * Perform a PDS write with automatic activity logging.
   */
  async function withActivityLogging<T>(params: {
    collection: string;
    category: ActivityCategory;
    action: ActivityAction;
    targetUri?: string;
    targetTitle?: string;
    /** UI context metadata; will be serialized to JSON string for the API */
    uiContext?: Record<string, unknown>;
    /** Record snapshot; will be serialized to JSON string for the API */
    recordSnapshot?: Record<string, unknown>;
    perform: (collection: string, rkey: string) => Promise<T>;
  }): Promise<T> {
    const rkey = generateRkey();

    // Log activity before PDS write
    try {
      await logActivity.mutateAsync({
        collection: params.collection,
        rkey,
        action: params.action,
        category: params.category,
        targetUri: params.targetUri,
        targetTitle: params.targetTitle,
        // Serialize objects to JSON strings per lexicon spec
        uiContext: params.uiContext ? JSON.stringify(params.uiContext) : undefined,
        recordSnapshot: params.recordSnapshot ? JSON.stringify(params.recordSnapshot) : undefined,
      });
    } catch (error) {
      // Log activity failed; still attempt the PDS write.
      activityLogger.warn('Failed to log activity', {
        collection: params.collection,
        category: params.category,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Perform PDS write
    try {
      return await params.perform(params.collection, rkey);
    } catch (error) {
      // Mark activity as failed
      try {
        await markFailed.mutateAsync({
          collection: params.collection,
          rkey,
          errorCode: 'PDS_WRITE_FAILED',
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      } catch {
        activityLogger.warn('Failed to mark activity as failed', { collection: params.collection });
      }
      throw error;
    }
  }

  /**
   * Perform a record deletion with activity logging.
   */
  async function withDeleteLogging(params: {
    uri: string;
    category: ActivityCategory;
    targetTitle?: string;
    perform: () => Promise<void>;
  }): Promise<void> {
    // Parse the URI to get collection and rkey
    const match = /^at:\/\/(did:[^/]+)\/([^/]+)\/(.+)$/.exec(params.uri);
    if (!match) {
      throw new Error('Invalid AT-URI format');
    }

    // Extract collection and rkey from match groups
    // match[0] = full match, match[1] = did, match[2] = collection, match[3] = rkey
    const collection = match[2];
    const rkey = match[3];

    // TypeScript narrowing: verify captures are defined
    if (!collection || !rkey) {
      throw new Error('Invalid AT-URI format: missing collection or rkey');
    }

    // Log activity before PDS delete
    try {
      await logActivity.mutateAsync({
        collection,
        rkey,
        action: 'delete',
        category: params.category,
        targetUri: params.uri,
        targetTitle: params.targetTitle,
      });
    } catch (error) {
      activityLogger.warn('Failed to log delete activity', {
        uri: params.uri,
        category: params.category,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Perform PDS delete
    try {
      await params.perform();
    } catch (error) {
      // Mark activity as failed
      try {
        await markFailed.mutateAsync({
          collection,
          rkey,
          errorCode: 'PDS_DELETE_FAILED',
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      } catch {
        activityLogger.warn('Failed to mark delete activity as failed', { uri: params.uri });
      }
      throw error;
    }
  }

  return {
    logActivity,
    markFailed,
    withActivityLogging,
    withDeleteLogging,
    generateRkey,
  };
}

// =============================================================================
// COLLECTION CONSTANTS
// =============================================================================

/**
 * ATProto collection NSIDs for Chive.
 */
export const COLLECTIONS = {
  EPRINT_SUBMISSION: 'pub.chive.eprint.submission',
  REVIEW_COMMENT: 'pub.chive.review.comment',
  REVIEW_ENDORSEMENT: 'pub.chive.review.endorsement',
  EPRINT_TAG: 'pub.chive.eprint.userTag',
  FIELD_PROPOSAL: 'pub.chive.graph.fieldProposal',
  VOTE: 'pub.chive.graph.vote',
  ACTOR_PROFILE: 'pub.chive.actor.profile',
} as const;
