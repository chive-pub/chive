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

// =============================================================================
// TYPES
// =============================================================================

/**
 * Activity action types.
 */
export type ActivityAction = 'create' | 'update' | 'delete';

/**
 * Activity categories (semantic action types).
 */
export type ActivityCategory =
  | 'preprint_submit'
  | 'preprint_update'
  | 'preprint_delete'
  | 'review_create'
  | 'review_update'
  | 'review_delete'
  | 'endorsement_create'
  | 'endorsement_delete'
  | 'tag_create'
  | 'tag_delete'
  | 'profile_update'
  | 'proposal_create'
  | 'vote_create';

/**
 * Activity status.
 */
export type ActivityStatus = 'pending' | 'confirmed' | 'failed' | 'timeout';

/**
 * Activity record.
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
  readonly confirmedAt: string | null;
  readonly firehoseUri: string | null;
  readonly firehoseCid: string | null;
  readonly targetUri: string | null;
  readonly targetTitle: string | null;
  readonly latencyMs: number | null;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
}

/**
 * Log activity input.
 */
export interface LogActivityInput {
  readonly collection: string;
  readonly rkey: string;
  readonly action: ActivityAction;
  readonly category: ActivityCategory;
  readonly targetUri?: string;
  readonly targetTitle?: string;
  readonly uiContext?: Record<string, unknown>;
  readonly recordSnapshot?: Record<string, unknown>;
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
 *   collection: 'pub.chive.preprint.submission',
 *   rkey,
 *   action: 'create',
 *   category: 'preprint_submit',
 * });
 *
 * // Perform PDS write with the same rkey
 * await agent.com.atproto.repo.createRecord({
 *   repo: did,
 *   collection: 'pub.chive.preprint.submission',
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
      const response = await authApi.POST('/xrpc/pub.chive.activity.log', {
        body: input,
      });

      if (!response.data) {
        throw new Error('Failed to log activity');
      }

      return response.data;
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
 *     collection: 'pub.chive.preprint.submission',
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
      const response = await authApi.POST('/xrpc/pub.chive.activity.markFailed', {
        body: input,
      });

      if (!response.data) {
        throw new Error('Failed to mark activity as failed');
      }

      return response.data;
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
 *   category: 'preprint_submit',
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
      const response = await authApi.GET('/xrpc/pub.chive.activity.getFeed', {
        params: {
          query: {
            category: options?.category,
            status: options?.status,
            limit: options?.limit,
          },
        },
      });

      if (!response.data) {
        throw new Error('Failed to get activity feed');
      }

      return response.data;
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
 * // Create a preprint with activity tracking
 * await withActivityLogging({
 *   category: 'preprint_submit',
 *   action: 'create',
 *   targetTitle: 'My Preprint',
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
    uiContext?: Record<string, unknown>;
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
        uiContext: params.uiContext,
        recordSnapshot: params.recordSnapshot,
      });
    } catch (error) {
      // Log activity failed; still attempt the PDS write.
      console.warn('Failed to log activity:', error);
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
        console.warn('Failed to mark activity as failed');
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
      console.warn('Failed to log delete activity:', error);
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
        console.warn('Failed to mark delete activity as failed');
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
  PREPRINT_SUBMISSION: 'pub.chive.preprint.submission',
  REVIEW_COMMENT: 'pub.chive.review.comment',
  REVIEW_ENDORSEMENT: 'pub.chive.review.endorsement',
  PREPRINT_TAG: 'pub.chive.preprint.userTag',
  FIELD_PROPOSAL: 'pub.chive.graph.fieldProposal',
  VOTE: 'pub.chive.graph.vote',
  ACTOR_PROFILE: 'pub.chive.actor.profile',
} as const;
