'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';

import { makeQueryClient } from '@/lib/api/query-client';

/**
 * Props for the QueryProvider component.
 */
interface QueryProviderProps {
  /** Child components that will have access to the query client */
  children: React.ReactNode;
}

/**
 * TanStack Query provider for client-side data fetching.
 *
 * @remarks
 * Creates a single QueryClient instance that persists across re-renders.
 * Includes React Query DevTools in development mode only.
 * Should wrap the root layout to provide query capabilities to all components.
 *
 * @example
 * ```tsx
 * // app/layout.tsx
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <QueryProvider>
 *           {children}
 *         </QueryProvider>
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 *
 * @param props - Component props
 * @returns React element with query context provider
 */
export function QueryProvider({ children }: QueryProviderProps) {
  // Create client in useState to avoid recreating on re-render
  const [queryClient] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      )}
    </QueryClientProvider>
  );
}
