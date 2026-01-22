'use client';

import { Suspense } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/lib/auth';
import { ObservabilityProvider, FaroRouteTracker, parameterizePath } from '@/lib/observability';
import { QueryProvider } from './query-provider';
import { ThemeProvider } from './theme-provider';

/**
 * Root providers wrapper combining all client-side providers.
 *
 * @remarks
 * Provider order matters:
 * 1. ThemeProvider: Theme must be available to all components
 * 2. ObservabilityProvider: Trace context, Faro, and logging
 * 3. FaroRouteTracker: Route change tracking (must be inside ObservabilityProvider)
 * 4. AuthProvider: Auth context available for queries and components
 * 5. QueryProvider: TanStack Query for data fetching
 * 6. TooltipProvider: UI tooltips
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ObservabilityProvider>
        <Suspense fallback={null}>
          <FaroRouteTracker
            ignorePaths={[/^\/api\//, /^\/_next\//]}
            transformPath={parameterizePath}
          />
        </Suspense>
        <AuthProvider>
          <QueryProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </QueryProvider>
        </AuthProvider>
      </ObservabilityProvider>
    </ThemeProvider>
  );
}

export { QueryProvider } from './query-provider';
export { ThemeProvider } from './theme-provider';
