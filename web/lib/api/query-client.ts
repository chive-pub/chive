import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';

import { logger } from '@/lib/observability';
import { getFaro } from '@/lib/observability/faro/initialize';
import { ChiveError, APIError } from '@/lib/errors';

/**
 * Reports an error to Faro telemetry.
 */
function reportQueryErrorToFaro(error: unknown, context: Record<string, string>): void {
  try {
    const faro = getFaro();
    if (!faro) return;

    const errorObj = error instanceof Error ? error : new Error(String(error));
    faro.api.pushError(errorObj, {
      context,
      type: 'react-query-error',
    });
  } catch {
    // Silently fail - don't let telemetry errors affect the app
  }
}

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
        // Skip logging 404 errors - they're often expected (e.g., user hasn't endorsed yet)
        if (error instanceof APIError && error.statusCode === 404) {
          return;
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorCode = error instanceof ChiveError ? error.code : undefined;

        queryLogger.warn('Query failed', {
          queryKey: query.queryKey,
          error: errorMessage,
          code: errorCode,
        });

        // Report to Faro telemetry
        reportQueryErrorToFaro(error, {
          queryKey: JSON.stringify(query.queryKey),
          errorType: error instanceof Error ? error.name : 'UnknownError',
          code: errorCode ?? '',
          path: typeof window !== 'undefined' ? window.location.pathname : '',
        });
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorCode = error instanceof ChiveError ? error.code : undefined;

        queryLogger.error('Mutation failed', error instanceof Error ? error : undefined, {
          mutationKey: mutation.options.mutationKey,
          error: errorMessage,
          code: errorCode,
        });

        // Report to Faro telemetry
        reportQueryErrorToFaro(error, {
          mutationKey: mutation.options.mutationKey
            ? JSON.stringify(mutation.options.mutationKey)
            : 'unknown',
          errorType: error instanceof Error ? error.name : 'UnknownError',
          code: errorCode ?? '',
          path: typeof window !== 'undefined' ? window.location.pathname : '',
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
