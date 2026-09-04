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
  FollowerNotification,
  CollectionAddNotification,
  ListFollowersResponse,
  ListCollectionAddsResponse,
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
  /** Key for the people following the user */
  followers: (params?: { limit?: number; cursor?: string }) =>
    [...notificationKeys.all, 'followers', params] as const,
  /** Key for the user's eprints added to other people's collections */
  collectionAdds: (params?: { limit?: number; cursor?: string }) =>
    [...notificationKeys.all, 'collection-adds', params] as const,
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

interface UseFollowerNotificationsOptions {
  /** Number of notifications to fetch */
  limit?: number;
  /** Pagination cursor */
  cursor?: string;
  /** Whether the query is enabled */
  enabled?: boolean;
}

/**
 * Fetches the people who follow the authenticated user.
 *
 * @param options - Query options
 * @returns Query result with follower notifications
 *
 * @example
 * ```tsx
 * function Followers() {
 *   const { data, isLoading } = useFollowerNotifications({ limit: 20 });
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return (
 *     <ul>
 *       {data?.notifications.map((n) => (
 *         <li key={n.collectionUri}>{n.follower.did} follows you</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useFollowerNotifications(options: UseFollowerNotificationsOptions = {}) {
  const { limit = 50, cursor, enabled = true } = options;

  return useQuery<ListFollowersResponse>({
    queryKey: notificationKeys.followers({ limit, cursor }),
    queryFn: async () => {
      try {
        const response = await authApi.pub.chive.notification.listFollowers({ limit, cursor });
        return response.data;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch followers',
          undefined,
          'pub.chive.notification.listFollowers'
        );
      }
    },
    enabled,
    staleTime: 30_000, // 30 seconds
  });
}

interface UseCollectionAddNotificationsOptions {
  /** Number of notifications to fetch */
  limit?: number;
  /** Pagination cursor */
  cursor?: string;
  /** Whether the query is enabled */
  enabled?: boolean;
}

/**
 * Fetches the user's eprints that other people added to their collections.
 *
 * @param options - Query options
 * @returns Query result with collection-add notifications
 *
 * @example
 * ```tsx
 * function CollectionAdds() {
 *   const { data, isLoading } = useCollectionAddNotifications({ limit: 20 });
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return (
 *     <ul>
 *       {data?.notifications.map((n) => (
 *         <li key={n.uri}>{n.actor.did} collected {n.eprintTitle}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useCollectionAddNotifications(options: UseCollectionAddNotificationsOptions = {}) {
  const { limit = 50, cursor, enabled = true } = options;

  return useQuery<ListCollectionAddsResponse>({
    queryKey: notificationKeys.collectionAdds({ limit, cursor }),
    queryFn: async () => {
      try {
        const response = await authApi.pub.chive.notification.listCollectionAdds({ limit, cursor });
        return response.data;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch collection additions',
          undefined,
          'pub.chive.notification.listCollectionAdds'
        );
      }
    },
    enabled,
    staleTime: 30_000, // 30 seconds
  });
}

// Re-export types for convenience
export type {
  ReviewNotification,
  EndorsementNotification,
  FollowerNotification,
  CollectionAddNotification,
};
