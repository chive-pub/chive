import { AlphaGate } from '@/components/alpha';
import { PageContainer } from '@/components/layout';

/**
 * Layout for tags route group.
 *
 * @remarks
 * Provides a consistent layout for tag browsing pages.
 * Uses the "browse" variant for list/grid views.
 * Protected by AlphaGate during alpha period.
 */
export default function TagsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AlphaGate>
      <PageContainer variant="browse" as="main">
        {children}
      </PageContainer>
    </AlphaGate>
  );
}
