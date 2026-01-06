'use client';

import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/lib/auth';
import { QueryProvider } from './query-provider';
import { ThemeProvider } from './theme-provider';

/**
 * Root providers wrapper combining all client-side providers.
 *
 * @remarks
 * Provider order matters:
 * 1. ThemeProvider: Theme must be available to all components
 * 2. AuthProvider: Auth context available for queries and components
 * 3. QueryProvider: TanStack Query for data fetching
 * 4. TooltipProvider: UI tooltips
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <QueryProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </QueryProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export { QueryProvider } from './query-provider';
export { ThemeProvider } from './theme-provider';
