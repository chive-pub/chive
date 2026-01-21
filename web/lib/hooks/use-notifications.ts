/**
 * React hooks for notification queries.
 *
 * @remarks
 * Provides hooks for fetching reviews and endorsements on the user's papers.
 */

import { useQuery } from '@tanstack/react-query';

import { authApi } from '@/lib/api/client';
import { APIError } from '@/lib/errors';
import type {
  ReviewNotification,
  EndorsementNotification,
  ReviewNotificationsResponse,
  EndorsementNotificationsResponse,
} from '@/lib/api/schema';

/**
 * Query key factory for notification-related queries.
 */
export const notificationKeys = {
  /** Base key for all notification queries */
  all: ['notifications'] as const,
  /** Key for review notifications on user's papers */
  reviewsOnMyPapers: (params?: { limit?: number; cursor?: string }) =>
    [...notificationKeys.all, 'reviews', params] as const,
  /** Key for endorsement notifications on user's papers */
  endorsementsOnMyPapers: (params?: { limit?: number; cursor?: string }) =>
    [...notificationKeys.all, 'endorsements', params] as const,
};

// =============================================================================
// QUERY HOOKS
// =============================================================================

interface UseReviewNotificationsOptions {
  /** Number of notifications to fetch */
  limit?: number;
  /** Pagination cursor */
  cursor?: string;
  /** Whether the query is enabled */
  enabled?: boolean;
}

/**
 * Fetches review notifications on the authenticated user's papers.
 *
 * @param options - Query options
 * @returns Query result with review notifications
 *
 * @example
 * ```tsx
 * function ReviewNotifications() {
 *   const { data, isLoading } = useReviewNotifications({ limit: 20 });
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return (
 *     <ul>
 *       {data?.notifications.map((n) => (
 *         <li key={n.uri}>{n.reviewerDisplayName} reviewed {n.eprintTitle}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useReviewNotifications(options: UseReviewNotificationsOptions = {}) {
  const { limit = 50, cursor, enabled = true } = options;

  return useQuery<ReviewNotificationsResponse>({
    queryKey: notificationKeys.reviewsOnMyPapers({ limit, cursor }),
    queryFn: async () => {
      try {
        const response = await authApi.pub.chive.notification.listReviewsOnMyPapers({
          limit,
          cursor,
        });
        return response.data;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch review notifications',
          undefined,
          'pub.chive.notification.listReviewsOnMyPapers'
        );
      }
    },
    enabled,
    staleTime: 30_000, // 30 seconds
  });
}

interface UseEndorsementNotificationsOptions {
  /** Number of notifications to fetch */
  limit?: number;
  /** Pagination cursor */
  cursor?: string;
  /** Whether the query is enabled */
  enabled?: boolean;
}

/**
 * Fetches endorsement notifications on the authenticated user's papers.
 *
 * @param options - Query options
 * @returns Query result with endorsement notifications
 *
 * @example
 * ```tsx
 * function EndorsementNotifications() {
 *   const { data, isLoading } = useEndorsementNotifications({ limit: 20 });
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return (
 *     <ul>
 *       {data?.notifications.map((n) => (
 *         <li key={n.uri}>{n.endorserDisplayName} endorsed {n.eprintTitle}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useEndorsementNotifications(options: UseEndorsementNotificationsOptions = {}) {
  const { limit = 50, cursor, enabled = true } = options;

  return useQuery<EndorsementNotificationsResponse>({
    queryKey: notificationKeys.endorsementsOnMyPapers({ limit, cursor }),
    queryFn: async () => {
      try {
        const response = await authApi.pub.chive.notification.listEndorsementsOnMyPapers({
          limit,
          cursor,
        });
        return response.data;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch endorsement notifications',
          undefined,
          'pub.chive.notification.listEndorsementsOnMyPapers'
        );
      }
    },
    enabled,
    staleTime: 30_000, // 30 seconds
  });
}

// Re-export types for convenience
export type { ReviewNotification, EndorsementNotification };
