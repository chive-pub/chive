import { AlphaGate } from '@/components/alpha';
import { PageContainer } from '@/components/layout';

/**
 * Layout for authors route group.
 *
 * @remarks
 * Provides a consistent layout for author profile pages.
 * Uses the "browse" variant for author listings.
 * Protected by AlphaGate during alpha period.
 */
export default function AuthorsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AlphaGate>
      <PageContainer variant="browse" as="main">
        {children}
      </PageContainer>
    </AlphaGate>
  );
}
