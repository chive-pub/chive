import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';

import { logger } from '@/lib/observability';
import { ChiveError } from '@/lib/errors';

const queryLogger = logger.child({ component: 'query-client' });

/**
 * Creates a configured QueryClient instance.
 * Used for both client and server-side rendering.
 *
 * @remarks
 * Configuration follows user preference for fresh data (30s staleTime).
 * Includes global error handlers for observability.
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Fresh data priority: 30s staleTime per user preference
        staleTime: 30 * 1000,
        // Garbage collection after 5 minutes
        gcTime: 5 * 60 * 1000,
        // Refetch on window focus for fresh data
        refetchOnWindowFocus: true,
        // Refetch on reconnect
        refetchOnReconnect: true,
        // Single retry on failure
        retry: 1,
        // Don't refetch on mount if data is fresh
        refetchOnMount: true,
      },
      mutations: {
        // No retry for mutations
        retry: 0,
      },
    },
    queryCache: new QueryCache({
      onError: (error, query) => {
        queryLogger.warn('Query failed', {
          queryKey: query.queryKey,
          error: error instanceof Error ? error.message : String(error),
          code: error instanceof ChiveError ? error.code : undefined,
        });
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        queryLogger.error('Mutation failed', error instanceof Error ? error : undefined, {
          mutationKey: mutation.options.mutationKey,
          error: error instanceof Error ? error.message : String(error),
          code: error instanceof ChiveError ? error.code : undefined,
        });
      },
    }),
  });
}

// Browser query client singleton
let browserQueryClient: QueryClient | undefined;

/**
 * Gets the query client for use in components.
 * Creates a singleton for browser, new instance for server.
 */
export function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') {
    // Server: always create new client
    return makeQueryClient();
  }

  // Browser: use singleton
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}
