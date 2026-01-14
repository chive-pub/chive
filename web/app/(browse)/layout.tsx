import { AlphaGate } from '@/components/alpha';
import { PageContainer } from '@/components/layout';

/**
 * Layout for browse route group.
 *
 * @remarks
 * Provides a consistent layout for browse/faceted search pages.
 * Uses the "browse" variant (max-w-7xl) for grid layouts.
 * Protected by AlphaGate during alpha period.
 */
export default function BrowseLayout({ children }: { children: React.ReactNode }) {
  return (
    <AlphaGate>
      <PageContainer variant="browse" as="main">
        {children}
      </PageContainer>
    </AlphaGate>
  );
}
