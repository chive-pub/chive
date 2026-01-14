import { AlphaGate } from '@/components/alpha';
import { PageContainer } from '@/components/layout';

/**
 * Layout for search route group.
 *
 * @remarks
 * Provides a consistent layout for search-related pages.
 * Uses the "browse" variant (max-w-7xl) for search results.
 * Protected by AlphaGate during alpha period.
 */
export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return (
    <AlphaGate>
      <PageContainer variant="browse" as="main">
        {children}
      </PageContainer>
    </AlphaGate>
  );
}
